"""Domain regressions plus verification of the complete static Cartesian product."""

import json
import tempfile
import unittest
from copy import deepcopy
from itertools import product
from pathlib import Path

from pipeline.build import PROJECT, load_lexicon
from pipeline.catalog import GROUPS, classify, identify_pattern
from pipeline.model import parse_lexicon
from pipeline.morphology import (
    LETTERS,
    PATTERNS,
    TURKISH_LETTERS,
    form_key,
    generate,
    generate_turkish,
    is_experimental_root,
    reading_of,
    root_classes,
    root_id,
)
from scripts.inspect_nisanyan import read_page


class MorphologyTests(unittest.TestCase):
    def test_new_dictionary_patterns_override_hypotheticals_with_nisanyan_sources(self) -> None:
        lexicon = load_lexicon(PROJECT / "data/lexicon.json")
        dictionary = [entry for entry in lexicon["entries"] if entry["root"] == "فتش"]
        self.assertEqual({entry["word"] for entry in dictionary}, {"teftiş", "müfettiş"})
        self.assertEqual(
            {classify(entry)["patternId"] for entry in dictionary}, {"II.masdar", "II.agent"}
        )
        self.assertTrue(
            all(entry["source"]["dictionary"] == "Nişanyan Sözlük" for entry in lexicon["entries"])
        )
        generated = generate("فتش", frozenset(classify(entry)["patternId"] for entry in dictionary))
        self.assertTrue(
            {"II.masdar", "II.agent"}.isdisjoint(PATTERNS[row[0]].id for row in generated)
        )

    def test_official_metadata_reader_rejects_empty_and_mismatched_pages(self) -> None:
        page = '<meta name="og:title" content="teftiş - Nişanyan Sözlük"><meta name="description" content="Arapça √ftş &amp; test">'
        entry = read_page("teftiş", page)
        self.assertEqual(entry.description, "Arapça √ftş & test")
        self.assertEqual(entry.url, "https://www.nisanyansozluk.com/kelime/tefti%C5%9F")
        for invalid in (
            "",
            '<meta name="og:title" content="teftiş - Nişanyan Sözlük">',
            page.replace("teftiş -", "başka -"),
        ):
            with self.assertRaises(ValueError):
                read_page("teftiş", invalid)

    def test_dictionary_overrides_same_root_and_spelling_without_losing_variants(self) -> None:
        lexicon = load_lexicon(PROJECT / "data/lexicon.json")
        dictionary = [entry for entry in lexicon["entries"] if entry["root"] == "كتب"]
        forms = generate("كتب", frozenset(classify(entry)["patternId"] for entry in dictionary))
        identifiers = {PATTERNS[row[0]].id for row in forms}
        self.assertNotIn("I.agent", identifiers)  # كاتب -> kâtip
        self.assertNotIn("I.patient", identifiers)  # مكتوب -> mektup
        self.assertNotIn("I.place", identifiers)  # مكتب -> mektep
        self.assertIn("I.instrument", identifiers)  # Same family is not a merge key.
        self.assertTrue({"kitabe", "kitabet"}.issubset({entry["word"] for entry in dictionary}))
        # Evidence from a different root must not suppress anything.
        self.assertEqual(len(generate("شكز")), len(PATTERNS))

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
        generated = generate("علم", frozenset(classify(entry)["patternId"] for entry in dictionary))
        self.assertNotIn("II.agent", {PATTERNS[row[0]].id for row in generated})
        # An attested II agent must not suppress the distinct IV agent.
        self.assertIn("IV.agent", {PATTERNS[row[0]].id for row in generated})

    def test_exceptional_roots_are_explicitly_raw(self) -> None:
        for key in ("قول", "مدد", "ءكل", "رمي", "وعد"):
            self.assertTrue(root_classes(key))
            self.assertTrue(all(row[3] for row in generate(key)))
        self.assertEqual(root_classes("كتك"), [])  # First and last equality is not gemination.
        forms = generate("دخل")
        self.assertTrue(all(row[3] for row in forms if PATTERNS[row[0]].id.startswith("VIII.")))
        self.assertTrue(
            all(not row[3] for row in forms if not PATTERNS[row[0]].id.startswith("VIII."))
        )

    def test_readings_preserve_letters_and_long_vowels(self) -> None:
        self.assertEqual(reading_of("شكز"), "ş-k-z")
        self.assertEqual(reading_of("سكز"), "s-k-z")
        forms = {PATTERNS[row[0]].id: row for row in generate("كتب")}
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
            generate("<x>")

    def test_experimental_roots_preserve_all_turkish_letters_without_arabic_spelling(self) -> None:
        self.assertEqual(len(TURKISH_LETTERS), 29)
        for root in ("jkl", "pçğ", "ıöü"):
            forms = generate_turkish(root)
            self.assertEqual(len(forms), 43)
            self.assertTrue(all(arabic is None and raw is False for _, arabic, _, raw in forms))
        by_id = {PATTERNS[row[0]].id: row for row in generate_turkish("jkl")}
        self.assertEqual(by_id["I.agent"][2], "jâkil")
        self.assertEqual(by_id["I.patient"][2], "majkûl")
        with self.assertRaises(ValueError):
            generate_turkish("qkl")
        for root in ("ktb", "şkz", "skz"):
            self.assertFalse(is_experimental_root(root))
            with self.assertRaises(ValueError):
                generate_turkish(root)

    def test_unvocalized_dictionary_spelling_does_not_suppress_unrelated_patterns(self) -> None:
        lexicon = load_lexicon(PROJECT / "data/lexicon.json")
        dictionary = [entry for entry in lexicon["entries"] if entry["root"] == "علم"]
        ilim = next(entry for entry in dictionary if entry["word"] == "ilim")
        self.assertIsNone(identify_pattern(ilim))  # fi'l is not the fa'l candidate.
        forms = generate("علم", frozenset(classify(entry)["patternId"] for entry in dictionary))
        self.assertTrue({"I.masdar", "I.verb"}.issubset({PATTERNS[row[0]].id for row in forms}))

    def test_fixed_groups_cover_the_whole_generator_once(self) -> None:
        self.assertEqual(
            [group["role"] for group in GROUPS],
            ["agent", "patient", "action", "place", "instrument", "quality", "theme", "verbs"],
        )
        self.assertEqual(
            [sum(pattern.role == group["role"] for pattern in PATTERNS) for group in GROUPS],
            [10, 9, 10, 1, 1, 1, 1, 10],
        )


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
            self.assertEqual(payload["schemaVersion"], 2)
            self.assertEqual(payload["inventory"], "arabic")
            attested = {entry["patternId"] for entry in payload["dictionary"]}
            for entry in payload["dictionary"]:
                identity = (key, entry["word"])
                self.assertEqual(
                    {name: value for name, value in entry.items() if name != "patternId"},
                    originals[identity],
                )
                found_words.add(identity)
            seen_patterns = set()
            for index, arabic, reading, raw in payload["generated"]:
                self.assertNotIn(PATTERNS[index].id, attested, (key, arabic))
                self.assertNotIn(index, seen_patterns)
                self.assertTrue(0 <= index < len(PATTERNS))
                self.assertNotRegex(arabic + reading, r"[123]|undefined")
                self.assertIsInstance(raw, bool)
                seen_patterns.add(index)
            generated_count += len(payload["generated"])
        self.assertEqual(len(identifiers), 28**3)
        self.assertEqual(len(list((output / "roots").glob("*/*.json"))), 28**3)
        self.assertEqual(found_words, set(originals))
        self.assertEqual(manifest["dictionaryEntryCount"], len(originals))
        for radicals in product(TURKISH_LETTERS, repeat=3):
            key = "".join(radicals)
            identifier = root_id(key, "turkish")
            path = output / "turkish-roots" / identifier[:2] / f"{identifier}.json"
            if not is_experimental_root(key):
                self.assertFalse(path.exists(), f"Duplicate experimental artifact: {key}")
                continue
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(payload["root"]["key"], key)
            self.assertEqual(payload["root"]["reading"], "-".join(key))
            self.assertEqual(payload["buildId"], manifest["buildId"])
            self.assertEqual(payload["inventory"], "turkish")
            self.assertEqual(payload["dictionary"], [])
            self.assertEqual(payload["classes"], [])
            self.assertEqual(len(payload["generated"]), len(PATTERNS))
            self.assertEqual({row[0] for row in payload["generated"]}, set(range(len(PATTERNS))))
            self.assertTrue(all(row[1] is None and row[3] is False for row in payload["generated"]))
            generated_count += len(payload["generated"])
        self.assertEqual(len(list((output / "turkish-roots").glob("*/*.json"))), 18557)
        self.assertEqual(manifest["turkishRootCount"], 18557)
        self.assertEqual(generated_count, manifest["generatedFormCount"])


if __name__ == "__main__":
    unittest.main()
