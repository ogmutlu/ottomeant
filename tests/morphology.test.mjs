import assert from "node:assert/strict";
import test from "node:test";
import {
  derive,
  categories,
  letters,
  latin,
  readingOf,
  parseRoot,
  requiresSoundRules,
} from "../dist/morphology.js";
import { roots, entries } from "../dist/data.js";
import { RootLibrary } from "../dist/library.js";

test("all 21,952 ordered roots generate bounded, explicitly unverified templates", () => {
  let count = 0;
  for (const a of letters)
    for (const b of letters)
      for (const c of letters) {
        const key = a + b + c;
        const forms = derive({
          key,
          reading: "",
          title: "",
          meaning: "",
          custom: true,
        });
        assert.ok(forms.length >= 16);
        assert.equal(forms.filter((form) => form.role === "verbs").length, 10);
        for (const form of forms) {
          assert.ok(!/[123]|undefined/.test(form.arabic));
          if (form.kind === "unverified")
            assert.equal(form.requiresSoundRules, requiresSoundRules(key));
          else assert.equal(form.root, key);
        }
        count++;
      }
  assert.equal(count, 21952);
});
test("Turkish input resolves known roots; invalid input is rejected", () => {
  assert.equal(parseRoot("k-t-b", roots), "كتب");
  assert.equal(parseRoot("ş-k-r", roots), "شكر");
  assert.equal(parseRoot("كَتَبَ", roots), "كتب");
  assert.equal(parseRoot("<script>", roots), undefined);
  assert.equal(parseRoot("kt", roots), undefined);
});
test("dictionary evidence never leaks across roots", () => {
  const forms = derive({
    key: "زبك",
    reading: "z-b-k",
    title: "",
    meaning: "",
    custom: true,
  });
  assert.ok(forms.every((form) => form.kind === "unverified"));
  assert.ok(requiresSoundRules("قول"));
  assert.ok(requiresSoundRules("مدد"));
  assert.ok(!requiresSoundRules("كتب"));
});

test("verified vocabulary retains multiple words for one semantic role", () => {
  const forms = derive(roots.find((root) => root.key === "علم"));
  const agents = forms.filter(
    (entry) => entry.kind === "dictionary" && entry.role === "agent",
  );
  assert.ok(agents.some((entry) => entry.word === "muallim"));
  assert.ok(agents.some((entry) => entry.word === "âlim"));
  assert.ok(agents.some((entry) => entry.word === "allame"));
});

test("every verified word has a specific source and an exact-word Turkish example", () => {
  assert.ok(entries.length >= 324);
  const identities = new Set();
  for (const entry of entries) {
    const identity = entry.root + ":" + entry.word;
    assert.ok(!identities.has(identity), identity);
    identities.add(identity);
    assert.equal(new URL(entry.source.url).hostname, "www.nisanyansozluk.com");
    assert.ok(entry.source.headword.length > 0);
    assert.equal(entry.source.checkedOn, "2026-10-01");
    assert.ok(entry.example.length > 90, entry.word);
    assert.ok(!/[\u0600-\u06ff]/u.test(entry.example), entry.word);
    const words = entry.example.match(/[\p{L}]+/gu) ?? [];
    assert.ok(
      words.includes(entry.word),
      `Exact headword missing: ${entry.word}`,
    );
    assert.ok(!("arExample" in entry));
    assert.ok(!("pronunciation" in entry));
  }
});

test("verified Turkish words preserve uncertainty about reconstructed Arabic origins", () => {
  for (const word of ["manzara", "nazariye"]) {
    const entry = entries.find((entry) => entry.word === word);
    assert.equal(entry.kind, "dictionary");
    assert.ok(entry.originNote.includes("tanıksız"));
  }
});

test("new root input preserves distinct Turkish letters instead of search-folding them", () => {
  assert.equal(parseRoot("ş-k-z", roots), "شكز");
  assert.equal(parseRoot("s-k-z", roots), "سكز");
  assert.equal(parseRoot("s-k-r", roots), "سكر");
  assert.equal(parseRoot("Ş-K-Z", roots), "شكز");
  assert.equal(parseRoot("q-k-z", roots), undefined);
  assert.equal(parseRoot("ğ-k-z", roots), undefined);
});

test("missing supported forms retain hypothetical meanings and exact-form Turkish examples", () => {
  const root = roots.find((root) => root.key === "كتب");
  const forms = derive(root);
  const hypothetical = forms.filter((form) => form.kind === "unverified");
  assert.ok(hypothetical.some((form) => form.role === "instrument"));
  assert.equal(hypothetical.filter((form) => form.role === "verbs").length, 10);
  for (const form of hypothetical) {
    assert.ok(form.definition.includes("Bu sözcük var olsaydı"));
    assert.ok(form.definition.includes("yazma"));
    assert.ok(form.example.includes(form.reading));
    assert.ok(!/[\u0600-\u06ff]/u.test(form.example));
    assert.ok(form.example.length > 90);
  }
});

test("one attested role cannot erase an unmatched form in a different role", () => {
  // The dictionary's 'ilim' action cannot substitute for the generated theme 'ilam'.
  const forms = derive(roots.find((root) => root.key === "علم"));
  assert.ok(
    forms.some((form) => form.kind === "unverified" && form.role === "theme"),
  );
});

test("a completely new root has a proposed form for every supported role", () => {
  const forms = derive({
    key: "شكز",
    reading: "ş-k-z",
    title: "",
    meaning: "",
    custom: true,
  });
  for (const category of categories.filter(
    (category) => category.id !== "all",
  )) {
    assert.ok(
      forms.some((form) => form.role === category.id),
      category.id,
    );
  }
  assert.ok(forms.every((form) => form.kind === "unverified"));
});

test("root readings preserve letter-table alignment and new-root identity", () => {
  assert.equal(letters.length, latin.length);
  assert.equal(readingOf("شكز"), "ş-k-z");
  assert.equal(readingOf("سكر"), "s-k-r");
  assert.equal(readingOf("كتب"), "k-t-b");
  assert.equal(readingOf("درس"), "d-r-s");
  for (const reading of ["ş-k-z", "s-k-r", "b-t-y", "c-v-n"]) {
    assert.equal(readingOf(parseRoot(reading, roots)), reading);
  }
});

test("user proposals stay separate from the immutable dictionary collection", () => {
  const count = roots.length;
  const library = new RootLibrary(roots);
  const proposal = library.resolve("شكز");
  assert.equal(proposal.reading, "ş-k-z");
  assert.equal(library.roots("dictionary").length, count);
  assert.equal(library.roots("proposed").length, 1);
  assert.equal(roots.length, count);
  assert.ok(!library.roots("dictionary").some((root) => root.key === "شكز"));
  library.resolve("شكز");
  assert.equal(library.roots("proposed").length, 1);
  const restored = new RootLibrary(roots, ["شكز", "كتب", "bad"]);
  assert.deepEqual(
    restored.roots("proposed").map((root) => root.key),
    ["شكز"],
  );
  assert.equal(restored.resolve("كتب").custom, undefined);
  assert.equal(restored.removeProposal("كتب"), false);
  assert.equal(restored.removeProposal("شكز"), true);
  assert.equal(restored.removeProposal("شكز"), false);
  assert.equal(restored.roots("proposed").length, 0);
  const afterRemoval = new RootLibrary(
    roots,
    restored.roots("proposed").map((root) => root.key),
  );
  assert.equal(afterRemoval.roots("proposed").length, 0);
  assert.equal(afterRemoval.roots("dictionary").length, count);
});

test("expanded dictionary roots each have source-backed words and remain distinct", () => {
  assert.ok(roots.length >= 94);
  assert.equal(new Set(roots.map((root) => root.key)).size, roots.length);
  for (const root of roots) {
    assert.ok(
      entries.some((entry) => entry.root === root.key),
      root.reading,
    );
    assert.ok(!root.custom);
  }
  for (const word of [
    "akıl",
    "fikir",
    "delil",
    "muhasebe",
    "tahkik",
    "ikna",
    "emniyet",
    "hayal",
  ]) {
    assert.ok(
      entries.some((entry) => entry.word === word),
      word,
    );
  }
});
