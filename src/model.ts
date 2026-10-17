/** Shared static-data contract. File boundaries are validated in codec.ts. */
export const roles = [
  "agent",
  "patient",
  "theme",
  "action",
  "place",
  "instrument",
  "quality",
  "verbs",
] as const;
export type Role = (typeof roles)[number];
export interface Root {
  readonly key: string;
  readonly reading: string;
  readonly title: string;
  readonly meaning: string;
  readonly action?: string;
  readonly sourceRoot?: string;
}
export interface KnownRoot extends Root {
  readonly words: readonly string[];
}
export interface DictionarySource {
  readonly dictionary: "Nişanyan Sözlük";
  readonly url: string;
  readonly headword: string;
  readonly scope: "headword" | "subentry";
  readonly checkedOn: string;
}
export interface DictionaryEntry {
  readonly kind: "dictionary";
  readonly root: string;
  readonly word: string;
  readonly arabic: string;
  readonly reading: string;
  readonly role: Role;
  readonly turkish: string;
  readonly definition: string;
  readonly pattern: string;
  readonly example: string;
  readonly source: DictionarySource;
  readonly originNote?: string;
}
export interface Pattern {
  readonly id: string;
  readonly label: string;
  readonly arabic: string;
  readonly reading: string;
  readonly role: Role;
  readonly description: string;
}
export interface Manifest {
  readonly schemaVersion: 1;
  readonly buildId: string;
  readonly engineVersion: string;
  readonly letters: readonly string[];
  readonly readings: readonly string[];
  readonly rootCount: number;
  readonly dictionaryRootCount: number;
  readonly dictionaryEntryCount: number;
  readonly generatedFormCount: number;
  readonly patterns: readonly Pattern[];
  readonly knownRoots: readonly KnownRoot[];
}
export interface SearchWord {
  readonly word: string;
  readonly root: string;
}
export interface SearchIndex {
  readonly schemaVersion: 1;
  readonly buildId: string;
  readonly words: readonly SearchWord[];
}
export const rootClasses = [
  "hamzated",
  "initial-weak",
  "hollow",
  "defective",
  "doubled",
] as const;
export type RootClass = (typeof rootClasses)[number];
export interface GeneratedForm {
  readonly kind: "generated";
  readonly pattern: Pattern;
  readonly arabic: string;
  readonly reading: string;
  readonly surface: "regular-template" | "raw-template";
}
export type Form = DictionaryEntry | GeneratedForm;
export interface RootFamily {
  readonly root: Root;
  readonly classes: readonly RootClass[];
  readonly dictionary: readonly DictionaryEntry[];
  readonly generated: readonly GeneratedForm[];
}
export interface RootCandidate {
  readonly key: string;
  readonly reading: string;
  readonly known?: KnownRoot;
}
export type Resolution =
  | { readonly kind: "empty" }
  | { readonly kind: "not-found"; readonly query: string }
  | { readonly kind: "resolved"; readonly candidate: RootCandidate }
  | {
      readonly kind: "ambiguous";
      readonly candidates: readonly RootCandidate[];
    };
