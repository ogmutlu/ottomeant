/** Untrusted JSON becomes domain values here; casts never replace validation. */
import { roles, rootClasses } from "./model.js";
import { isExperimentalRoot } from "./lookup.js";
function record(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("Expected a JSON object");
    return value;
}
function array(value) {
    if (!Array.isArray(value))
        throw new Error("Expected a JSON array");
    return value;
}
function text(value) {
    if (typeof value !== "string" || !value.trim())
        throw new Error("Expected nonempty text");
    return value;
}
function count(value) {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
        throw new Error("Expected a nonnegative integer");
    return value;
}
function choice(value, choices) {
    const result = choices.find((item) => item === value);
    if (result === undefined)
        throw new Error(`Unexpected enum value: ${String(value)}`);
    return result;
}
function version(data, buildId) {
    if (data.schemaVersion !== 2 ||
        (buildId !== undefined && data.buildId !== buildId))
        throw new Error("Static data version mismatch; reload after deployment");
}
function root(value) {
    const data = record(value);
    return {
        key: text(data.key),
        reading: text(data.reading),
        title: text(data.title),
        meaning: text(data.meaning),
        ...(data.action !== undefined ? { action: text(data.action) } : {}),
        ...(data.sourceRoot !== undefined
            ? { sourceRoot: text(data.sourceRoot) }
            : {}),
    };
}
function pattern(value) {
    const data = record(value);
    return {
        id: text(data.id),
        label: text(data.label),
        arabic: text(data.arabic),
        reading: text(data.reading),
        role: choice(data.role, roles),
        description: text(data.description),
    };
}
function dictionaryEntry(value, key, manifest) {
    const data = record(value);
    const source = record(data.source);
    const url = new URL(text(source.url));
    const patternId = text(data.patternId);
    const selected = [...manifest.patterns, ...manifest.lexicalPatterns].find((pattern) => pattern.id === patternId);
    if (data.kind !== "dictionary" ||
        data.root !== key ||
        source.dictionary !== "Nişanyan Sözlük" ||
        url.origin !== "https://www.nisanyansozluk.com" ||
        !url.pathname.startsWith("/kelime/") ||
        !selected ||
        selected.role !== data.role)
        throw new Error("Invalid dictionary evidence");
    return {
        kind: "dictionary",
        root: key,
        word: text(data.word),
        arabic: text(data.arabic),
        reading: text(data.reading),
        role: choice(data.role, roles),
        turkish: text(data.turkish),
        definition: text(data.definition),
        pattern: text(data.pattern),
        patternId,
        example: text(data.example),
        source: {
            dictionary: "Nişanyan Sözlük",
            url: url.href,
            headword: text(source.headword),
            scope: choice(source.scope, ["headword", "subentry"]),
            checkedOn: text(source.checkedOn),
        },
        ...(data.originNote !== undefined
            ? { originNote: text(data.originNote) }
            : {}),
    };
}
export function decodeManifest(value) {
    const data = record(value);
    version(data);
    const letters = array(data.letters).map(text);
    const readings = array(data.readings).map(text);
    const knownRoots = array(data.knownRoots).map((value) => ({
        ...root(value),
        words: array(record(value).words).map(text),
    }));
    const patterns = array(data.patterns).map(pattern);
    const lexicalPatterns = array(data.lexicalPatterns).map(pattern);
    const turkishLetters = array(data.turkishLetters).map(text);
    const turkishRootCount = count(data.turkishRootCount);
    const groups = array(data.groups).map((value) => {
        const item = record(value);
        return {
            role: choice(item.role, roles),
            label: text(item.label),
            description: text(item.description),
        };
    });
    const rootCount = count(data.rootCount);
    if (letters.length !== 28 ||
        new Set(letters).size !== letters.length ||
        letters.some((letter) => [...letter].length !== 1) ||
        readings.length !== letters.length ||
        rootCount !== letters.length ** 3 ||
        new Set([...patterns, ...lexicalPatterns].map((item) => item.id)).size !==
            patterns.length + lexicalPatterns.length ||
        patterns.length === 0 ||
        turkishLetters.length !== 29 ||
        new Set(turkishLetters).size !== 29 ||
        turkishLetters.some((letter) => [...letter].length !== 1) ||
        turkishRootCount !==
            turkishLetters.length ** 3 -
                new Set(readings.filter((reading) => turkishLetters.includes(reading)))
                    .size **
                    3 ||
        groups.length !== roles.length ||
        new Set(groups.map((group) => group.role)).size !== roles.length)
        throw new Error("Invalid root inventory or patterns");
    const validRoot = (key) => [...key].length === 3 &&
        [...key].every((letter) => letters.includes(letter));
    const dictionaryRootCount = count(data.dictionaryRootCount);
    const dictionaryEntryCount = count(data.dictionaryEntryCount);
    if (knownRoots.some((item) => !validRoot(item.key)) ||
        new Set(knownRoots.map((item) => item.key)).size !== knownRoots.length ||
        knownRoots.length !== dictionaryRootCount ||
        knownRoots.reduce((sum, item) => sum + item.words.length, 0) !==
            dictionaryEntryCount)
        throw new Error("Invalid dictionary inventory");
    return {
        schemaVersion: 2,
        buildId: text(data.buildId),
        engineVersion: text(data.engineVersion),
        letters,
        readings,
        turkishLetters,
        turkishRootCount,
        rootCount,
        dictionaryRootCount,
        dictionaryEntryCount,
        generatedFormCount: count(data.generatedFormCount),
        patterns,
        lexicalPatterns,
        groups,
        knownRoots,
    };
}
export function decodeSearch(value, manifest) {
    const data = record(value);
    version(data, manifest.buildId);
    const words = array(data.words).map((value) => {
        const entry = record(value);
        const word = text(entry.word);
        const key = text(entry.root);
        if (!manifest.knownRoots.some((root) => root.key === key && root.words.includes(word)))
            throw new Error("Unknown dictionary word in search index");
        return { word, root: key };
    });
    if (words.length !== manifest.dictionaryEntryCount ||
        new Set(words.map((entry) => `${entry.root}:${entry.word}`)).size !==
            words.length)
        throw new Error("Incomplete search index");
    return { schemaVersion: 2, buildId: manifest.buildId, words };
}
export function decodeFamily(value, manifest, key, inventory = "arabic") {
    const data = record(value);
    version(data, manifest.buildId);
    const familyRoot = root(data.root);
    const alphabet = inventory === "arabic" ? manifest.letters : manifest.turkishLetters;
    if (inventory === "turkish" && !isExperimentalRoot(key, manifest))
        throw new Error("Duplicate experimental counterpart");
    if (familyRoot.key !== key ||
        data.inventory !== inventory ||
        [...key].length !== 3 ||
        [...key].some((letter) => !alphabet.includes(letter)))
        throw new Error("Root file contains a different root");
    const generated = array(data.generated).map((value) => {
        const row = array(value);
        const selected = manifest.patterns[count(row[0])];
        if (!selected ||
            row.length !== 4 ||
            typeof row[3] !== "boolean" ||
            (inventory === "turkish" && (row[1] !== null || row[3] !== false)))
            throw new Error("Invalid generated form");
        return {
            kind: "generated",
            pattern: selected,
            arabic: inventory === "turkish" ? null : text(row[1]),
            reading: text(row[2]),
            surface: inventory === "turkish"
                ? "experimental"
                : row[3]
                    ? "raw-template"
                    : "regular-template",
        };
    });
    const dictionary = array(data.dictionary).map((value) => dictionaryEntry(value, key, manifest));
    const expected = inventory === "arabic"
        ? (manifest.knownRoots.find((root) => root.key === key)?.words ?? [])
        : [];
    const filled = new Set([
        ...dictionary.map((entry) => entry.patternId),
        ...generated.map((form) => form.pattern.id),
    ]);
    if (dictionary.length !== expected.length ||
        expected.some((word) => !dictionary.some((entry) => entry.word === word)) ||
        new Set(generated.map((form) => form.pattern.id)).size !==
            generated.length ||
        generated.some((form) => dictionary.some((entry) => entry.patternId === form.pattern.id)) ||
        manifest.patterns.some((pattern) => !filled.has(pattern.id)))
        throw new Error("Incomplete root family");
    const classes = array(data.classes).map((value) => choice(value, rootClasses));
    if (inventory === "turkish" && classes.length !== 0)
        throw new Error("Experimental roots cannot carry Arabic root classes");
    return {
        inventory,
        root: familyRoot,
        classes,
        dictionary,
        generated,
    };
}
