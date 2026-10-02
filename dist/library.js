import { isRoot, readingOf } from "./morphology.js";
/** User exploration never changes the dictionary-backed root collection. */
export class RootLibrary {
    #dictionary;
    #proposed = new Map();
    constructor(dictionary, proposedKeys = []) {
        this.#dictionary = dictionary;
        for (const key of proposedKeys)
            if (isRoot(key))
                this.resolve(key);
    }
    roots(tab) {
        return tab === "dictionary"
            ? this.#dictionary
            : [...this.#proposed.values()];
    }
    all() {
        return [...this.#dictionary, ...this.#proposed.values()];
    }
    removeProposal(key) {
        return this.#proposed.delete(key);
    }
    resolve(key) {
        if (!isRoot(key))
            throw new Error("A root must contain three Arabic consonants.");
        const existing = this.all().find((root) => root.key === key);
        if (existing)
            return existing;
        const root = {
            key,
            reading: readingOf(key),
            title: "Kullanıcı önerisi",
            meaning: "anlamı doğrulanmamış harf birleşimi",
            custom: true,
        };
        this.#proposed.set(key, root);
        return root;
    }
}
