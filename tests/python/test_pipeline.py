"""Domain regressions plus verification of the complete static Cartesian product."""

import json
import tempfile
import unittest
from copy import deepcopy
from itertools import product
from pathlib import Path

from pipeline.build import PROJECT, load_lexicon
from pipeline.model import parse_lexicon
from pipeline.morphology import (
    LETTERS,
    PATTERNS,
    form_key,
    generate,
    reading_of,
    root_classes,
    root_id,
)


class MorphologyTests(unittest.TestCase):
    def test_dictionary_overrides_same_root_and_spelling_without_losing_variants(self) -> None:
        lexicon = load_lexicon(PROJECT / "data/lexicon.json")
        dictionary = [entry for entry in lexicon["entries"] if entry["root"] == "كتب"]
        forms = generate("كتب", dictionary)
        identifiers = {PATTERNS[row[0]].id for row in forms}
        self.assertNotIn("I.agent", identifiers)  # كاتب -> kâtip
        self.assertNotIn("I.patient", identifiers)  # مكتوب -> mektup
        self.assertNotIn("I.place", identifiers)  # مكتب -> mektep
        self.assertIn("I.instrument", identifiers)  # Same family is not a merge key.
        self.assertTrue({"kitabe", "kitabet"}.issubset({entry["word"] for entry in dictionary}))
        # Evidence from a different root must not suppress anything.
        self.assertEqual(len(generate("شكز", dictionary)), len(PATTERNS))

    def test_gemination_is_part_of_form_identity(self) -> None:
        self.assertEqual(form_key("مُعَلِّم"), form_key("معلّم"))
        self.assertEqual(form_key("معلّم"), "معللم")
        self.assertNotEqual(form_key("مُعَلِّم"), form_key("مُعْلِم"))
        self.assertEqual(form_key("كِتَاب"), form_key("كتاب"))

    def test_multiple_sourced_agents_survive(self) -> None:
        lexicon = load_lexicon(PROJECT / "data/lexicon.json")
        dictionary = [entry for entry in lexicon["entries"] if entry["root"] == "علم"]
        self.assertTrue(
            {"âlim", "allame", "muallim"}.issubset({entry["word"] for entry in dictionary})
        )
        generated = generate("علم", dictionary)
        self.assertNotIn("II.agent", {PATTERNS[row[0]].id for row in generated})
        # An attested II agent must not suppress the distinct IV agent.
        self.assertIn("IV.agent", {PATTERNS[row[0]].id for row in generated})

    def test_exceptional_roots_are_explicitly_raw(self) -> None:
        for key in ("قول", "مدد", "ءكل", "رمي", "وعد"):
            self.assertTrue(root_classes(key))
            self.assertTrue(all(row[3] for row in generate(key, [])))
        self.assertEqual(root_classes("كتك"), [])  # First and last equality is not gemination.
        forms = generate("دخل", [])
        self.assertTrue(all(row[3] for row in forms if PATTERNS[row[0]].id.startswith("VIII.")))
        self.assertTrue(
            all(not row[3] for row in forms if not PATTERNS[row[0]].id.startswith("VIII."))
        )

    def test_readings_preserve_letters_and_long_vowels(self) -> None:
        self.assertEqual(reading_of("شكز"), "ş-k-z")
        self.assertEqual(reading_of("سكز"), "s-k-z")
        forms = {PATTERNS[row[0]].id: row for row in generate("كتب", [])}
        self.assertEqual(forms["I.verb"][2], "kataba")
        self.assertEqual(forms["III.verb"][2], "kâtaba")
        self.assertNotIn("IX.patient", forms)

    def test_invalid_lexicon_fails_at_boundary(self) -> None:
        with self.assertRaises(ValueError):
            parse_lexicon({"schemaVersion": 2})
        with self.assertRaises(ValueError):
            parse_lexicon({"schemaVersion": 1, "roots": ["not an object"], "entries": []})
        lexicon = load_lexicon(PROJECT / "data/lexicon.json")
        invalid = deepcopy(lexicon)
        invalid["entries"][0]["source"]["url"] = "https://example.com/fake"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "lexicon.json"
            path.write_text(json.dumps(invalid), encoding="utf-8")
            with self.assertRaises(ValueError):
                load_lexicon(path)
        with self.assertRaises(ValueError):
            generate("<x>", [])


class StaticArtifactTests(unittest.TestCase):
    def test_every_ordered_combination_is_present_and_dictionary_always_wins(self) -> None:
        output = PROJECT / "public/data"
        manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
        lexicon = load_lexicon(PROJECT / "data/lexicon.json")
        originals = {(entry["root"], entry["word"]): entry for entry in lexicon["entries"]}
        found_words = set()
        identifiers = set()
        generated_count = 0
        for radicals in product(LETTERS, repeat=3):
            key = "".join(radicals)
            identifier = root_id(key)
            identifiers.add(identifier)
            payload = json.loads(
                (output / "roots" / identifier[:2] / f"{identifier}.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual(payload["root"]["key"], key)
            self.assertEqual(payload["buildId"], manifest["buildId"])
            self.assertEqual(payload["schemaVersion"], 1)
            attested = {form_key(entry["arabic"]) for entry in payload["dictionary"]}
            for entry in payload["dictionary"]:
                identity = (key, entry["word"])
                self.assertEqual(entry, originals[identity])
                found_words.add(identity)
            seen_patterns = set()
            for index, arabic, reading, raw in payload["generated"]:
                self.assertNotIn(form_key(arabic), attested, (key, arabic))
                self.assertNotIn(index, seen_patterns)
                self.assertTrue(0 <= index < len(PATTERNS))
                self.assertNotRegex(arabic + reading, r"[123]|undefined")
                self.assertIsInstance(raw, bool)
                seen_patterns.add(index)
            generated_count += len(payload["generated"])
        self.assertEqual(len(identifiers), 28**3)
        self.assertEqual(len(list((output / "roots").glob("*/*.json"))), 28**3)
        self.assertEqual(found_words, set(originals))
        self.assertEqual(generated_count, manifest["generatedFormCount"])
        self.assertEqual(manifest["dictionaryEntryCount"], len(originals))


if __name__ == "__main__":
    unittest.main()
