import type { Root } from "./model.js";
import { isRoot, readingOf } from "./morphology.js";

export type LibraryTab = "dictionary" | "proposed";

/** User exploration never changes the dictionary-backed root collection. */
export class RootLibrary {
  readonly #dictionary: readonly Root[];
  readonly #proposed = new Map<string, Root>();

  constructor(
    dictionary: readonly Root[],
    proposedKeys: readonly string[] = [],
  ) {
    this.#dictionary = dictionary;
    for (const key of proposedKeys) if (isRoot(key)) this.resolve(key);
  }

  roots(tab: LibraryTab): readonly Root[] {
    return tab === "dictionary"
      ? this.#dictionary
      : [...this.#proposed.values()];
  }

  all(): readonly Root[] {
    return [...this.#dictionary, ...this.#proposed.values()];
  }

  removeProposal(key: string): boolean {
    return this.#proposed.delete(key);
  }

  resolve(key: string): Root {
    if (!isRoot(key))
      throw new Error("A root must contain three Arabic consonants.");
    const existing = this.all().find((root) => root.key === key);
    if (existing) return existing;
    const root: Root = {
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
