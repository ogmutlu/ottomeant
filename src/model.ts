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
export type Inventory = "arabic" | "turkish";
export interface RootReference {
  readonly inventory: Inventory;
  readonly key: string;
}
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
  readonly patternId: string;
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
  readonly schemaVersion: 2;
  readonly buildId: string;
  readonly engineVersion: string;
  readonly letters: readonly string[];
  readonly readings: readonly string[];
  readonly turkishLetters: readonly string[];
  readonly turkishRootCount: number;
  readonly rootCount: number;
  readonly dictionaryRootCount: number;
  readonly dictionaryEntryCount: number;
  readonly generatedFormCount: number;
  readonly patterns: readonly Pattern[];
  readonly lexicalPatterns: readonly Pattern[];
  readonly groups: readonly FormGroupDefinition[];
  readonly knownRoots: readonly KnownRoot[];
}
export interface SearchWord {
  readonly word: string;
  readonly root: string;
}
export interface SearchIndex {
  readonly schemaVersion: 2;
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
export type SurfaceStatus =
  | "regular-template"
  | "raw-template"
  | "experimental";
export interface ArabicSpelling {
  readonly root: string;
  readonly arabic: string;
  readonly surface: SurfaceStatus;
}
export interface GeneratedForm {
  readonly kind: "generated";
  readonly pattern: Pattern;
  readonly arabic: string | null;
  readonly reading: string;
  readonly surface: SurfaceStatus;
  readonly spellings?: readonly ArabicSpelling[];
}
export type Form = DictionaryEntry | GeneratedForm;
export interface RootFamily {
  readonly inventory: Inventory;
  readonly root: Root;
  readonly classes: readonly RootClass[];
  readonly dictionary: readonly DictionaryEntry[];
  readonly generated: readonly GeneratedForm[];
}
/** A display projection can represent several roots without inventing one identity. */
export interface FamilyView {
  readonly inventory: Inventory;
  readonly reading: string;
  readonly meaning: string;
  readonly arabicRoots: readonly Root[];
  readonly dictionary: readonly DictionaryEntry[];
  readonly generated: readonly GeneratedForm[];
}
export interface RootCandidate extends RootReference {
  readonly reading: string;
  readonly known?: KnownRoot;
  readonly sampleForms?: readonly string[];
}
export interface FormGroupDefinition {
  readonly role: Role;
  readonly label: string;
  readonly description: string;
}
export interface FormSlot {
  readonly pattern: Pattern;
  readonly forms: readonly Form[];
}
export interface FormGroup extends FormGroupDefinition {
  readonly slots: readonly FormSlot[];
}
export type Resolution =
  | { readonly kind: "empty" }
  | { readonly kind: "not-found"; readonly query: string }
  | { readonly kind: "resolved"; readonly candidate: RootCandidate }
  | {
      readonly kind: "equivalent";
      readonly candidates: readonly RootCandidate[];
    }
  | {
      readonly kind: "ambiguous";
      readonly candidates: readonly RootCandidate[];
    };
