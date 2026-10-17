/** Untrusted JSON becomes domain values here; casts never replace validation. */
import { roles, rootClasses } from "./model.js";
import type {
  DictionaryEntry,
  GeneratedForm,
  KnownRoot,
  Manifest,
  Pattern,
  Role,
  Root,
  RootFamily,
  SearchIndex,
} from "./model.js";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Expected a JSON object");
  return value as RecordValue;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected a JSON array");
  return value as unknown[];
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error("Expected nonempty text");
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("Expected a nonnegative integer");
  return value;
}
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  const result = choices.find((item) => item === value);
  if (result === undefined)
    throw new Error(`Unexpected enum value: ${String(value)}`);
  return result;
}
function version(data: RecordValue, buildId?: string): void {
  if (
    data.schemaVersion !== 1 ||
    (buildId !== undefined && data.buildId !== buildId)
  )
    throw new Error("Static data version mismatch; reload after deployment");
}
function root(value: unknown): Root {
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
function pattern(value: unknown): Pattern {
  const data = record(value);
  return {
    id: text(data.id),
    label: text(data.label),
    arabic: text(data.arabic),
    reading: text(data.reading),
    role: choice<Role>(data.role, roles),
    description: text(data.description),
  };
}
function dictionaryEntry(value: unknown, key: string): DictionaryEntry {
  const data = record(value);
  const source = record(data.source);
  const url = new URL(text(source.url));
  if (
    data.kind !== "dictionary" ||
    data.root !== key ||
    source.dictionary !== "Nişanyan Sözlük" ||
    url.origin !== "https://www.nisanyansozluk.com" ||
    !url.pathname.startsWith("/kelime/")
  )
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

export function decodeManifest(value: unknown): Manifest {
  const data = record(value);
  version(data);
  const letters = array(data.letters).map(text);
  const readings = array(data.readings).map(text);
  const knownRoots: KnownRoot[] = array(data.knownRoots).map((value) => ({
    ...root(value),
    words: array(record(value).words).map(text),
  }));
  const patterns = array(data.patterns).map(pattern);
  const rootCount = count(data.rootCount);
  if (
    letters.length !== 28 ||
    new Set(letters).size !== letters.length ||
    letters.some((letter) => [...letter].length !== 1) ||
    readings.length !== letters.length ||
    rootCount !== letters.length ** 3 ||
    new Set(patterns.map((item) => item.id)).size !== patterns.length ||
    patterns.length === 0
  )
    throw new Error("Invalid root inventory or patterns");
  const validRoot = (key: string): boolean =>
    [...key].length === 3 &&
    [...key].every((letter) => letters.includes(letter));
  const dictionaryRootCount = count(data.dictionaryRootCount);
  const dictionaryEntryCount = count(data.dictionaryEntryCount);
  if (
    knownRoots.some((item) => !validRoot(item.key)) ||
    new Set(knownRoots.map((item) => item.key)).size !== knownRoots.length ||
    knownRoots.length !== dictionaryRootCount ||
    knownRoots.reduce((sum, item) => sum + item.words.length, 0) !==
      dictionaryEntryCount
  )
    throw new Error("Invalid dictionary inventory");
  return {
    schemaVersion: 1,
    buildId: text(data.buildId),
    engineVersion: text(data.engineVersion),
    letters,
    readings,
    rootCount,
    dictionaryRootCount,
    dictionaryEntryCount,
    generatedFormCount: count(data.generatedFormCount),
    patterns,
    knownRoots,
  };
}

export function decodeSearch(value: unknown, manifest: Manifest): SearchIndex {
  const data = record(value);
  version(data, manifest.buildId);
  const words = array(data.words).map((value) => {
    const entry = record(value);
    const word = text(entry.word);
    const key = text(entry.root);
    if (
      !manifest.knownRoots.some(
        (root) => root.key === key && root.words.includes(word),
      )
    )
      throw new Error("Unknown dictionary word in search index");
    return { word, root: key };
  });
  if (
    words.length !== manifest.dictionaryEntryCount ||
    new Set(words.map((entry) => `${entry.root}:${entry.word}`)).size !==
      words.length
  )
    throw new Error("Incomplete search index");
  return { schemaVersion: 1, buildId: manifest.buildId, words };
}

export function decodeFamily(
  value: unknown,
  manifest: Manifest,
  key: string,
): RootFamily {
  const data = record(value);
  version(data, manifest.buildId);
  const familyRoot = root(data.root);
  if (familyRoot.key !== key)
    throw new Error("Root file contains a different root");
  const generated: GeneratedForm[] = array(data.generated).map((value) => {
    const row = array(value);
    const selected = manifest.patterns[count(row[0])];
    if (!selected || row.length !== 4 || typeof row[3] !== "boolean")
      throw new Error("Invalid generated form");
    return {
      kind: "generated",
      pattern: selected,
      arabic: text(row[1]),
      reading: text(row[2]),
      surface: row[3] ? "raw-template" : "regular-template",
    };
  });
  const dictionary = array(data.dictionary).map((value) =>
    dictionaryEntry(value, key),
  );
  const expected =
    manifest.knownRoots.find((root) => root.key === key)?.words ?? [];
  if (
    dictionary.length !== expected.length ||
    expected.some((word) => !dictionary.some((entry) => entry.word === word)) ||
    new Set(generated.map((form) => form.pattern.id)).size !== generated.length
  )
    throw new Error("Incomplete root family");
  return {
    root: familyRoot,
    classes: array(data.classes).map((value) => choice(value, rootClasses)),
    dictionary,
    generated,
  };
}
