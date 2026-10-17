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
export function hasArabicCandidates(key, readings) {
    return ([...key].length === 3 &&
        [...key].every((letter) => readings.includes(letter)));
}
export function isExperimentalRoot(key, manifest) {
    return ([...key].length === 3 &&
        [...key].every((letter) => manifest.turkishLetters.includes(letter)) &&
        !hasArabicCandidates(key, manifest.readings));
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
    #radicals = new Map();
    constructor(manifest, search) {
        this.manifest = manifest;
        for (const root of manifest.knownRoots) {
            this.#known.set(root.key, root);
            this.#insert(this.#readings, normalizeRoot(root.reading), root.key);
        }
        for (const entry of search.words)
            this.#insert(this.#words, normalizeWord(entry.word), entry.root);
        for (const reading of new Set(manifest.readings)) {
            this.#radicals.set(reading, manifest.letters.filter((_, index) => manifest.readings[index] === reading));
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
        const [first, second, third] = [...root].map((letter) => this.#radicals.get(letter));
        if (first && second && third) {
            return this.#resolution(first.flatMap((a) => second.flatMap((b) => third.map((c) => a + b + c))));
        }
        // Only triples outside the Arabic reading inventory need literal generation.
        return this.experimental(query);
    }
    experimental(input) {
        const key = normalizeRoot(input);
        if (!isExperimentalRoot(key, this.manifest)) {
            return { kind: "not-found", query: input.trim() };
        }
        return {
            kind: "resolved",
            candidate: { inventory: "turkish", key, reading: [...key].join("-") },
        };
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
            return { inventory: "arabic", key, reading, ...(known ? { known } : {}) };
        });
        const [candidate] = candidates;
        if (!candidate)
            throw new Error("A resolution must contain at least one root");
        if (candidates.length === 1)
            return { kind: "resolved", candidate };
        // With no lexical evidence, equivalent readings are inspected together rather
        // than forcing a choice between indistinguishable Turkish labels.
        if (candidates.every((item) => !item.known && item.reading === candidate.reading)) {
            return { kind: "equivalent", candidates };
        }
        return { kind: "ambiguous", candidates };
    }
}
