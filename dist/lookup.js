/** Fold circumflex vowels for discovery; ş/s, ç/c, ö/o, ü/u stay distinct. */
export function normalizeWord(value) {
    return value
        .normalize("NFC")
        .toLocaleLowerCase("tr")
        .trim()
        .replace(/[âîû]/g, (letter) => ({ â: "a", î: "i", û: "u" })[letter] ?? letter);
}
function normalizeRoot(value) {
    return value
        .normalize("NFC")
        .toLocaleLowerCase("tr")
        .replace(/[\u064b-\u065f\u0670\sـ-]/g, "");
}
export function rootId(key, letters) {
    const radicals = [...key];
    if (radicals.length !== 3 ||
        radicals.some((letter) => !letters.includes(letter))) {
        throw new Error(`Unsupported root: ${key}`);
    }
    return radicals
        .map((letter) => letters.indexOf(letter).toString().padStart(2, "0"))
        .join("-");
}
export class Lookup {
    manifest;
    #known = new Map();
    #words = new Map();
    #readings = new Map();
    #letters = new Map();
    constructor(manifest, search) {
        this.manifest = manifest;
        for (const root of manifest.knownRoots) {
            this.#known.set(root.key, root);
            this.#insert(this.#readings, normalizeRoot(root.reading), root.key);
        }
        for (const entry of search.words)
            this.#insert(this.#words, normalizeWord(entry.word), entry.root);
        for (const reading of new Set(manifest.readings)) {
            this.#letters.set(reading, manifest.letters.filter((_, index) => manifest.readings[index] === reading));
        }
    }
    resolve(input) {
        const query = input.trim();
        if (!query)
            return { kind: "empty" };
        // A recorded headword takes precedence over interpreting three letters as a root.
        const words = this.#words.get(normalizeWord(query));
        if (words)
            return this.#resolution([...words]);
        const root = normalizeRoot(query);
        if ([...root].length !== 3)
            return { kind: "not-found", query };
        if ([...root].every((letter) => this.manifest.letters.includes(letter)))
            return this.#resolution([root]);
        // k-l-m must expose both قلم and كلم instead of silently choosing one.
        const known = this.#readings.get(root);
        if (known)
            return this.#resolution([...known]);
        const options = [...root].map((letter) => this.#letters.get(letter));
        const [first, second, third] = options;
        if (!first || !second || !third)
            return { kind: "not-found", query };
        return this.#resolution(first.flatMap((a) => second.flatMap((b) => third.map((c) => a + b + c))));
    }
    suggest(input, limit = 6) {
        const query = normalizeWord(input);
        if (!query)
            return [];
        return this.manifest.knownRoots
            .flatMap((root) => root.words
            .filter((word) => normalizeWord(word).startsWith(query))
            .map((word) => ({ word, root: root.key })))
            .slice(0, limit);
    }
    #insert(index, term, key) {
        const keys = index.get(term) ?? new Set();
        keys.add(key);
        index.set(term, keys);
    }
    #resolution(keys) {
        const candidates = keys.map((key) => {
            const known = this.#known.get(key);
            const reading = [...key]
                .map((letter) => this.manifest.readings[this.manifest.letters.indexOf(letter)])
                .join("-");
            return { key, reading, ...(known ? { known } : {}) };
        });
        const [candidate] = candidates;
        if (!candidate)
            throw new Error("A resolution must contain at least one root");
        return candidates.length === 1
            ? { kind: "resolved", candidate }
            : { kind: "ambiguous", candidates };
    }
}
