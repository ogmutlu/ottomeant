/** A semantic browsing role is not itself a morphological derivation rule. */
export type NominalRole =
  | "agent"
  | "patient"
  | "theme"
  | "action"
  | "place"
  | "instrument"
  | "quality";
export type Role = NominalRole | "verbs";
export type View = Role | "all";
export interface Root {
  readonly key: string;
  readonly reading: string;
  readonly title: string;
  readonly meaning: string;
  readonly action?: string;
  readonly custom?: boolean;
  /** Nişanyan’s precise root spelling, used only for source searches. */
  readonly sourceRoot?: string;
}
export interface DictionarySource {
  readonly dictionary: "Nişanyan Sözlük";
  readonly url: string;
  readonly headword: string;
  readonly scope: "headword" | "subentry";
  readonly checkedOn: string;
}
interface LexicalForm {
  readonly role: Role;
  readonly arabic: string;
  readonly reading: string;
  readonly turkish: string;
  readonly definition: string;
  readonly pattern: string;
}
/** Source evidence concerns the word; the Turkish example is original editorial prose. */
export interface DictionaryEntry extends LexicalForm {
  readonly kind: "dictionary";
  readonly root: string;
  readonly role: NominalRole;
  readonly word: string;
  readonly example: string;
  readonly source: DictionarySource;
  readonly originNote?: string;
}
/** An unchecked template is neither an attested word nor evidence of nonexistence. */
export interface UnverifiedForm extends LexicalForm {
  readonly kind: "unverified";
  readonly requiresSoundRules: boolean;
  /** Fictional Turkish usage of the exact proposed form, not an attestation. */
  readonly example: string;
}
export type Entry = DictionaryEntry | UnverifiedForm;
export interface Category {
  readonly id: View;
  readonly label: string;
  readonly title: string;
  readonly description: string;
}
