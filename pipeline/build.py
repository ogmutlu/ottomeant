"""Create deterministic, lazy-loaded JSON for every supported ordered root."""

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from itertools import product
from pathlib import Path

from .catalog import GROUPS, classify, lexical_patterns
from .model import (
    BuildStats,
    DictionaryEntry,
    KnownRoot,
    Lexicon,
    Manifest,
    RootFamily,
    SearchIndex,
    parse_lexicon,
)
from .morphology import (
    ENGINE_VERSION,
    LETTERS,
    PATTERNS,
    READINGS,
    TURKISH_LETTERS,
    generate,
    generate_turkish,
    is_experimental_root,
    is_root,
    reading_of,
    root_classes,
    root_id,
)

PROJECT = Path(__file__).resolve().parent.parent


def write_json(path: Path, value: object) -> int:
    content = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != content:
        temporary = path.with_suffix(".json.tmp")
        temporary.write_bytes(content)
        temporary.replace(path)
    return len(content)


def load_lexicon(path: Path) -> Lexicon:
    lexicon = parse_lexicon(json.loads(path.read_text(encoding="utf-8")))
    roots = lexicon["roots"]
    root_keys = {root["key"] for root in roots}
    if len(root_keys) != len(roots) or not all(is_root(root) for root in root_keys):
        raise ValueError("Dictionary roots must be unique supported three-radical roots")
    identities = set()
    for entry in lexicon["entries"]:
        identity = (entry["root"], entry["word"])
        source = entry.get("source", {})
        if identity in identities or entry["root"] not in root_keys:
            raise ValueError(f"Duplicate word or unknown root: {identity}")
        if (
            entry.get("kind") != "dictionary"
            or source.get("dictionary") != "Nişanyan Sözlük"
            or not source.get("url", "").startswith("https://www.nisanyansozluk.com/kelime/")
            or not source.get("checkedOn")
        ):
            raise ValueError(f"Missing dictionary evidence: {identity}")
        identities.add(identity)
    return lexicon


def build(source: Path, output: Path) -> BuildStats:
    lexicon = load_lexicon(source)
    digest = hashlib.sha256()
    for content in (
        source.read_bytes(),
        Path(__file__).read_bytes(),
        Path(__file__).with_name("model.py").read_bytes(),
        Path(__file__).with_name("morphology.py").read_bytes(),
        Path(__file__).with_name("catalog.py").read_bytes(),
    ):
        digest.update(content)
    build_id = digest.hexdigest()[:16]
    known = {root["key"]: root for root in lexicon["roots"]}
    entries: dict[str, list[DictionaryEntry]] = defaultdict(list)
    for entry in lexicon["entries"]:
        entries[entry["root"]].append(entry)

    total_bytes = 0
    generated_count = 0
    for radicals in product(LETTERS, repeat=3):
        key = "".join(radicals)
        identifier = root_id(key)
        dictionary = [classify(entry) for entry in entries[key]]
        generated = generate(key, frozenset(entry["patternId"] for entry in dictionary))
        payload: RootFamily = {
            "schemaVersion": 2,
            "buildId": build_id,
            "inventory": "arabic",
            "root": known.get(
                key,
                {
                    "key": key,
                    "reading": reading_of(key),
                    "title": "Doğrulanmamış kök",
                    "meaning": "Bu harf birleşiminin kök olarak kullanımı ve anlamı doğrulanmamıştır.",
                },
            ),
            "classes": root_classes(key),
            "dictionary": dictionary,
            "generated": generated,
        }
        total_bytes += write_json(output / "roots" / identifier[:2] / f"{identifier}.json", payload)
        generated_count += len(generated)

    turkish_count = 0
    for radicals in product(TURKISH_LETTERS, repeat=3):
        key = "".join(radicals)
        identifier = root_id(key, "turkish")
        path = output / "turkish-roots" / identifier[:2] / f"{identifier}.json"
        if not is_experimental_root(key):
            # Remove obsolete, reproducible artifacts from the previous full grid.
            path.unlink(missing_ok=True)
            continue
        turkish_count += 1
        generated = generate_turkish(key)
        payload = {
            "schemaVersion": 2,
            "buildId": build_id,
            "inventory": "turkish",
            "root": {
                "key": key,
                "reading": "-".join(key),
                "title": "Deneysel Türkçe harfli kök",
                "meaning": "Bu harf birleşimine kalıplar deneysel olarak uygulanmıştır; kökün kullanımı ve anlamı doğrulanmamıştır.",
            },
            "classes": [],
            "dictionary": [],
            "generated": generated,
        }
        total_bytes += write_json(path, payload)
        generated_count += len(generated)

    search: SearchIndex = {
        "schemaVersion": 2,
        "buildId": build_id,
        "words": [{"word": entry["word"], "root": entry["root"]} for entry in lexicon["entries"]],
    }
    total_bytes += write_json(output / "search.json", search)
    known_roots: list[KnownRoot] = [
        {**root, "words": [entry["word"] for entry in entries[root["key"]]]}
        for root in lexicon["roots"]
    ]
    manifest: Manifest = {
        "schemaVersion": 2,
        "buildId": build_id,
        "engineVersion": ENGINE_VERSION,
        "letters": list(LETTERS),
        "readings": list(READINGS),
        "turkishLetters": list(TURKISH_LETTERS),
        "turkishRootCount": turkish_count,
        "rootCount": len(LETTERS) ** 3,
        "dictionaryRootCount": len(known),
        "dictionaryEntryCount": len(lexicon["entries"]),
        "generatedFormCount": generated_count,
        "patterns": [pattern.metadata() for pattern in PATTERNS],
        "lexicalPatterns": lexical_patterns(lexicon["entries"]),
        "groups": list(GROUPS),
        "knownRoots": known_roots,
    }
    # Publish manifest last, so its version only describes a completed build.
    total_bytes += write_json(output / "manifest.json", manifest)
    return {
        "roots": len(LETTERS) ** 3,
        "turkishRoots": turkish_count,
        "patterns": len(PATTERNS),
        "generatedForms": generated_count,
        "dictionaryEntries": len(lexicon["entries"]),
        "bytes": total_bytes,
        "buildId": build_id,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=PROJECT / "data/lexicon.json")
    parser.add_argument("--output", type=Path, default=PROJECT / "public/data")
    args = parser.parse_args()
    try:
        print(json.dumps(build(args.source, args.output), ensure_ascii=False))
    except (ValueError, KeyError, OSError) as error:
        print(f"Data generation failed: {error}", file=sys.stderr)
        return 1
    return 0
