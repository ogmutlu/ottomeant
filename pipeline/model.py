"""Typed data contract and validation at the editable JSON boundary."""

from typing import Literal, NotRequired, TypeAlias, TypedDict, TypeVar, cast

Role: TypeAlias = Literal[
    "agent", "patient", "theme", "action", "place", "instrument", "quality", "verbs"
]
ROLES: tuple[Role, ...] = (
    "agent",
    "patient",
    "theme",
    "action",
    "place",
    "instrument",
    "quality",
    "verbs",
)
RootClass: TypeAlias = Literal["hamzated", "initial-weak", "hollow", "defective", "doubled"]


class Root(TypedDict):
    key: str
    reading: str
    title: str
    meaning: str
    action: NotRequired[str]
    sourceRoot: NotRequired[str]


class DictionarySource(TypedDict):
    dictionary: Literal["Nişanyan Sözlük"]
    url: str
    headword: str
    scope: Literal["headword", "subentry"]
    checkedOn: str


class DictionaryEntry(TypedDict):
    kind: Literal["dictionary"]
    root: str
    role: Role
    word: str
    arabic: str
    reading: str
    turkish: str
    definition: str
    pattern: str
    example: str
    source: DictionarySource
    originNote: NotRequired[str]


class Lexicon(TypedDict):
    schemaVersion: Literal[1]
    roots: list[Root]
    entries: list[DictionaryEntry]


class PatternMetadata(TypedDict):
    id: str
    label: str
    arabic: str
    reading: str
    role: Role
    description: str


# Compact on disk; expanded into named TypeScript objects at the fetch boundary.
GeneratedRow: TypeAlias = tuple[int, str, str, bool]


class RootFamily(TypedDict):
    schemaVersion: Literal[1]
    buildId: str
    root: Root
    classes: list[RootClass]
    dictionary: list[DictionaryEntry]
    generated: list[GeneratedRow]


class KnownRoot(Root):
    words: list[str]


class Manifest(TypedDict):
    schemaVersion: Literal[1]
    buildId: str
    engineVersion: str
    letters: list[str]
    readings: list[str]
    rootCount: int
    dictionaryRootCount: int
    dictionaryEntryCount: int
    generatedFormCount: int
    patterns: list[PatternMetadata]
    knownRoots: list[KnownRoot]


class SearchWord(TypedDict):
    word: str
    root: str


class SearchIndex(TypedDict):
    schemaVersion: Literal[1]
    buildId: str
    words: list[SearchWord]


class BuildStats(TypedDict):
    roots: int
    patterns: int
    generatedForms: int
    dictionaryEntries: int
    bytes: int
    buildId: str


def _record(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError("Expected a JSON object")
    return cast(dict[str, object], value)


def _array(value: object) -> list[object]:
    if not isinstance(value, list):
        raise ValueError("Expected a JSON array")
    return cast(list[object], value)


def _text(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Expected nonempty text")
    return value


T = TypeVar("T", bound=str)


def _choice(value: object, choices: tuple[T, ...]) -> T:
    for choice in choices:
        if value == choice:
            return choice
    raise ValueError(f"Unsupported value: {value!r}")


def _root(value: object) -> Root:
    data = _record(value)
    root: Root = {
        "key": _text(data["key"]),
        "reading": _text(data["reading"]),
        "title": _text(data["title"]),
        "meaning": _text(data["meaning"]),
    }
    if "action" in data:
        root["action"] = _text(data["action"])
    if "sourceRoot" in data:
        root["sourceRoot"] = _text(data["sourceRoot"])
    return root


def _entry(value: object) -> DictionaryEntry:
    data = _record(value)
    source = _record(data["source"])
    entry: DictionaryEntry = {
        "kind": _choice(data["kind"], ("dictionary",)),
        "root": _text(data["root"]),
        "role": _choice(data["role"], ROLES),
        "word": _text(data["word"]),
        "arabic": _text(data["arabic"]),
        "reading": _text(data["reading"]),
        "turkish": _text(data["turkish"]),
        "definition": _text(data["definition"]),
        "pattern": _text(data["pattern"]),
        "example": _text(data["example"]),
        "source": {
            "dictionary": _choice(source["dictionary"], ("Nişanyan Sözlük",)),
            "url": _text(source["url"]),
            "headword": _text(source["headword"]),
            "scope": _choice(source["scope"], ("headword", "subentry")),
            "checkedOn": _text(source["checkedOn"]),
        },
    }
    if "originNote" in data:
        entry["originNote"] = _text(data["originNote"])
    return entry


def parse_lexicon(value: object) -> Lexicon:
    data = _record(value)
    if data.get("schemaVersion") != 1:
        raise ValueError("Unsupported lexicon schema")
    return {
        "schemaVersion": 1,
        "roots": [_root(root) for root in _array(data["roots"])],
        "entries": [_entry(entry) for entry in _array(data["entries"])],
    }
