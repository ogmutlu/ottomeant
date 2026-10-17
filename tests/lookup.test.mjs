import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  Lookup,
  isExperimentalRoot,
  normalizeWord,
  rootId,
} from "../dist/lookup.js";
import { decodeFamily, decodeManifest, decodeSearch } from "../dist/codec.js";
import { Catalog } from "../dist/data.js";
import { renderChoices, renderFamily } from "../dist/render.js";
import { groupFamily } from "../dist/grouping.js";
import {
  familyView,
  loadEquivalentFamilies,
  mergeHypotheticalFamilies,
} from "../dist/families.js";

const data = new URL("../public/data/", import.meta.url);
const readJson = async (path) =>
  JSON.parse(await readFile(new URL(path, data), "utf8"));
const manifest = decodeManifest(await readJson("manifest.json"));
const search = decodeSearch(await readJson("search.json"), manifest);
const lookup = new Lookup(manifest, search);
const keyOf = (query) => {
  const result = lookup.resolve(query);
  assert.equal(result.kind, "resolved", query);
  return result.candidate.key;
};
const familyJson = async (key, inventory = "arabic") => {
  const id = rootId(
    key,
    inventory === "arabic" ? manifest.letters : manifest.turkishLetters,
  );
  return readJson(
    `${inventory === "arabic" ? "roots" : "turkish-roots"}/${id.slice(0, 2)}/${id}.json`,
  );
};
const loadFamily = async ({ key, inventory }) =>
  decodeFamily(await familyJson(key, inventory), manifest, key, inventory);

test("identical hypothetical readings share one list with every Arabic spelling", async () => {
  const resolution = lookup.resolve("ş-k-z");
  assert.equal(resolution.kind, "equivalent");
  assert.equal(resolution.candidates.length, 6);
  const families = await Promise.all(resolution.candidates.map(loadFamily));
  const selection = await loadEquivalentFamilies(
    resolution.candidates,
    loadFamily,
  );
  assert.equal(selection.kind, "ready");
  const view = selection.view;
  assert.equal(view.generated.length, 43);
  assert.deepEqual(
    view.arabicRoots.map((root) => root.key),
    resolution.candidates.map((item) => item.key),
  );
  for (const form of view.generated) {
    assert.equal(form.arabic, null);
    assert.equal(form.spellings.length, families.length);
    for (const family of families) {
      const original = family.generated.find(
        (item) => item.pattern.id === form.pattern.id,
      );
      assert.equal(form.reading, original.reading);
      assert.deepEqual(
        form.spellings.find((item) => item.root === family.root.key),
        {
          root: family.root.key,
          arabic: original.arabic,
          surface: original.surface,
        },
      );
    }
  }
  const html = renderFamily(view, manifest, true);
  assert.equal([...html.matchAll(/class="generated-row"/g)].length, 43);
  assert.match(html, /Arapça yazım seçenekleri \(6\)/);
  assert.match(html, /class="form-spellings"/);
  assert.doesNotMatch(html, /class="choice"/);
  assert.match(
    renderFamily(
      await loadFamily({ key: "شكز", inventory: "arabic" }),
      manifest,
      true,
    ),
    /root-arabic/,
  );
  assert.equal(keyOf("شكز"), "شكز");
});

test("merging preserves per-spelling warnings and rejects unrelated or sourced roots", async () => {
  const first = await loadFamily({ key: "سسس", inventory: "arabic" });
  const second = await loadFamily({ key: "سثص", inventory: "arabic" });
  const view = mergeHypotheticalFamilies([first, second]);
  assert.ok(view.generated.every((form) => form.surface === "raw-template"));
  const agent = view.generated.find((form) => form.pattern.id === "I.agent");
  assert.deepEqual(
    agent.spellings.map((item) => item.surface),
    ["raw-template", "regular-template"],
  );
  assert.doesNotMatch(
    renderFamily(view, manifest, true),
    /İşaretleme ihtiyatlıdır/,
  );
  assert.throws(() => mergeHypotheticalFamilies([]));
  assert.throws(() => mergeHypotheticalFamilies([first, first]));
  assert.throws(() =>
    mergeHypotheticalFamilies([
      first,
      { ...second, root: { ...second.root, reading: "different" } },
    ]),
  );
  const sourced = await loadFamily({ key: "كتب", inventory: "arabic" });
  assert.throws(() => mergeHypotheticalFamilies([sourced]));
  const experimental = await loadFamily({ key: "jkl", inventory: "turkish" });
  assert.throws(() => mergeHypotheticalFamilies([experimental]));
  assert.deepEqual(familyView(sourced).dictionary, sourced.dictionary);
  assert.deepEqual(familyView(experimental).arabicRoots, []);
});

test("different outputs and lexical families stay selectable; failed loads never partially merge", async () => {
  const known = lookup.resolve("k-l-m");
  assert.equal(known.kind, "ambiguous");
  const selected = await loadEquivalentFamilies(known.candidates, () => {
    throw new Error("Must not load lexical roots for merging");
  });
  assert.equal(selected.kind, "ambiguous");
  const html = renderChoices(known.candidates);
  for (const candidate of known.candidates) {
    assert.ok(
      html.includes(`<strong>${candidate.known.words.join(" · ")}</strong>`),
    );
    assert.ok(html.includes(candidate.known.meaning));
  }
  const resolution = lookup.resolve("ş-k-z");
  const altered = await loadEquivalentFamilies(
    resolution.candidates,
    async (candidate) => {
      const family = await loadFamily(candidate);
      return candidate === resolution.candidates[0]
        ? {
            ...family,
            generated: family.generated.map((form, index) =>
              index === family.generated.length - 1
                ? { ...form, reading: "different-output" }
                : form,
            ),
          }
        : family;
    },
  );
  assert.equal(altered.kind, "ambiguous");
  assert.deepEqual(altered.candidates[0].sampleForms, ["different-output"]);
  assert.notDeepEqual(
    altered.candidates[0].sampleForms,
    altered.candidates[1].sampleForms,
  );
  await assert.rejects(
    loadEquivalentFamilies(resolution.candidates, async (candidate) => {
      if (candidate === resolution.candidates[0])
        throw new Error("Unavailable");
      return loadFamily(candidate);
    }),
    /Unavailable/,
  );
  assert.doesNotMatch(
    renderChoices([{ ...resolution.candidates[0], sampleForms: ["<script>"] }]),
    /<script>/,
  );
});

test("Turkish words, circumflex aliases, and exact Arabic roots resolve", () => {
  for (const query of [
    "kitap",
    "kâtip",
    "katip",
    "KÂTİP",
    "k-t-b",
    "كتب",
    "كَتَبَ",
  ])
    assert.equal(keyOf(query), "كتب");
  assert.equal(keyOf("muallim"), "علم");
  assert.equal(keyOf("ŞÜKÜR"), "شكر");
  assert.equal(keyOf("ders"), "درس");
  assert.notEqual(normalizeWord("ş"), normalizeWord("s"));
  assert.notEqual(normalizeWord("ü"), normalizeWord("u"));
});

test("ambiguous Turkish roots offer every known match", () => {
  const result = lookup.resolve("k-l-m");
  assert.equal(result.kind, "ambiguous");
  assert.deepEqual(
    new Set(result.candidates.map((item) => item.key)),
    new Set(["قلم", "كلم"]),
  );
  assert.equal(keyOf("قلم"), "قلم");
  assert.equal(keyOf("كلم"), "كلم");
});

test("Arabic candidates have no duplicate Turkish counterpart", () => {
  const normal = lookup.resolve("k-t-b");
  assert.equal(normal.kind, "resolved");
  assert.deepEqual(
    [normal.candidate.inventory, normal.candidate.key],
    ["arabic", "كتب"],
  );
  for (const query of ["k-t-b", "ş-k-z", "s-k-z"]) {
    assert.equal(lookup.experimental(query).kind, "not-found");
    const result = lookup.resolve(query);
    const candidates =
      result.kind === "resolved" ? [result.candidate] : result.candidates;
    assert.ok(candidates.length > 0);
    assert.ok(
      candidates.every((candidate) => candidate.inventory === "arabic"),
    );
  }
});

test("the full Turkish grid routes to Arabic or a unique nonduplicate experiment", () => {
  const ids = new Set();
  let overlaps = 0;
  for (const a of manifest.turkishLetters)
    for (const b of manifest.turkishLetters)
      for (const c of manifest.turkishLetters) {
        const key = a + b + c;
        const result = lookup.experimental(key);
        if (!isExperimentalRoot(key, manifest)) {
          assert.equal(result.kind, "not-found");
          const routed = lookup.resolve([...key].join("-"));
          const candidates =
            routed.kind === "resolved" ? [routed.candidate] : routed.candidates;
          assert.ok(candidates.length > 0);
          assert.ok(
            candidates.every((candidate) => candidate.inventory === "arabic"),
          );
          overlaps++;
          continue;
        }
        assert.equal(result.kind, "resolved");
        assert.equal(result.candidate.inventory, "turkish");
        assert.equal(result.candidate.key, key);
        ids.add(rootId(key, manifest.turkishLetters));
      }
  assert.equal(ids.size, 18557);
  assert.equal(overlaps, 5832);
  assert.equal(ids.size, manifest.turkishRootCount);
});

test("unknown root letters stay literal and every Arabic combination is addressable", () => {
  for (const [query, key] of [
    ["j-k-l", "jkl"],
    ["p-ç-ğ", "pçğ"],
    ["I-İ-Ğ", "ıiğ"],
  ]) {
    const result = lookup.resolve(query);
    assert.equal(result.kind, "resolved");
    assert.equal(result.candidate.inventory, "turkish");
    assert.equal(result.candidate.key, key);
  }
  const ids = new Set();
  for (const a of manifest.letters)
    for (const b of manifest.letters)
      for (const c of manifest.letters) {
        const key = a + b + c;
        assert.equal(keyOf(key), key);
        ids.add(rootId(key, manifest.letters));
      }
  assert.equal(ids.size, 21952);
});

test("unknown words and unsupported roots do not produce invented etymologies", () => {
  assert.equal(lookup.resolve("").kind, "empty");
  for (const query of [
    "evlerimizden",
    "<script>",
    "abcd",
    "q-k-z",
    "w-k-z",
    "x-k-z",
  ])
    assert.equal(lookup.resolve(query).kind, "not-found");
  assert.throws(() => rootId("bad-input", manifest.letters));
});

test("all recorded words remain searchable, including multiple words for one role", () => {
  for (const entry of search.words) {
    const result = lookup.resolve(entry.word);
    assert.ok(result.kind === "resolved" || result.kind === "ambiguous");
    const keys =
      result.kind === "resolved"
        ? [result.candidate.key]
        : result.candidates.map((item) => item.key);
    assert.ok(keys.includes(entry.root), entry.word);
  }
  assert.ok(lookup.suggest("muall").some((entry) => entry.word === "muallim"));
});

test("boundary rejects stale builds, crossed roots, and malformed generated forms", async () => {
  const payload = await familyJson("كتب");
  assert.throws(() =>
    decodeFamily({ ...payload, buildId: "stale" }, manifest, "كتب"),
  );
  assert.throws(() => decodeFamily(payload, manifest, "علم"));
  assert.throws(() =>
    decodeFamily(
      { ...payload, generated: [[1000, "x", "x", false]] },
      manifest,
      "كتب",
    ),
  );
  assert.throws(() => decodeSearch({ ...search, words: [] }, manifest));
  assert.throws(() => decodeManifest({ ...manifest, readings: [] }));
});

test("static loader is subpath-safe, lazy, coalesced, and retryable", async () => {
  const requests = [];
  let fail = true;
  const fetcher = async (url) => {
    requests.push(url.href);
    const path = url.pathname.replace("/ottomeant/public/data/", "");
    if (path.startsWith("roots/") && fail) {
      fail = false;
      return new Response("unavailable", { status: 503 });
    }
    return new Response(JSON.stringify(await readJson(path)), { status: 200 });
  };
  const catalog = await Catalog.load(
    new URL("https://example.test/ottomeant/public/data/"),
    fetcher,
  );
  assert.equal(requests.length, 2); // No root files loaded at startup.
  await assert.rejects(catalog.family("كتب"));
  const first = catalog.family("كتب");
  const second = catalog.family("كتب");
  assert.equal(first, second);
  assert.equal((await first).root.key, "كتب");
  assert.equal(requests.length, 4);
  const literal = await catalog.family("jkl", "turkish");
  assert.equal(literal.inventory, "turkish");
  assert.equal(literal.dictionary.length, 0);
  assert.equal((await catalog.family("كتب")).dictionary.length > 0, true);
  assert.equal(requests.length, 5);
  assert.ok(requests[4].includes("/turkish-roots/"));
  assert.throws(() => catalog.family("ktb", "turkish"));
  assert.ok(
    requests
      .slice(1)
      .every((url) => new URL(url).searchParams.get("v") === manifest.buildId),
  );
});

test("presentation preserves evidence, escapes content, and can hide generated forms", async () => {
  const family = decodeFamily(await familyJson("كتب"), manifest, "كتب");
  const html = renderFamily(family, manifest, true);
  assert.match(html, /Nişanyan kaydı/);
  assert.match(html, /mektup/);
  assert.match(html, /Yapan/);
  assert.doesNotMatch(renderFamily(family, manifest, false), /generated-row/);
  assert.doesNotMatch(
    renderChoices([{ key: "<script>", reading: "<script>" }]),
    /<script>/,
  );
  assert.match(
    renderChoices([{ key: "<script>", reading: "<script>" }]),
    /&lt;script&gt;/,
  );
});

test("group and pattern order is independent of alphabet and evidence", async () => {
  const arabic = decodeFamily(await familyJson("شكز"), manifest, "شكز");
  const turkish = decodeFamily(
    await familyJson("jkl", "turkish"),
    manifest,
    "jkl",
    "turkish",
  );
  const known = decodeFamily(await familyJson("كتب"), manifest, "كتب");
  const expected = [
    "agent",
    "patient",
    "action",
    "place",
    "instrument",
    "quality",
    "theme",
    "verbs",
  ];
  const order = (family) =>
    groupFamily(family, manifest).flatMap((group) =>
      group.slots.map((slot) => slot.pattern.id),
    );
  assert.deepEqual(
    groupFamily(known, manifest).map((group) => group.role),
    expected,
  );
  assert.deepEqual(order(arabic), order(turkish));
  assert.equal(order(turkish).length, 43);
  const knownSlots = groupFamily(known, manifest).flatMap(
    (group) => group.slots,
  );
  assert.equal(
    knownSlots.find((slot) => slot.pattern.id === "I.agent").forms[0].word,
    "kâtip",
  );
  assert.equal(
    knownSlots.find((slot) => slot.pattern.id === "I.patient").forms[0].word,
    "mektup",
  );
  assert.ok(
    knownSlots
      .find((slot) => slot.pattern.id === "II.agent")
      .forms.some((form) => form.kind === "generated"),
  );
  const html = renderFamily(known, manifest, true);
  assert.ok(html.indexOf('class="generated-row"') < html.indexOf("mektup"));
  assert.ok(html.includes('class="dictionary-row" data-pattern="I.patient"'));
});

test("an experimental file has no Arabic spelling or borrowed dictionary evidence", async () => {
  const payload = await familyJson("jkl", "turkish");
  const family = decodeFamily(payload, manifest, "jkl", "turkish");
  assert.equal(family.dictionary.length, 0);
  assert.ok(
    family.generated.every(
      (form) => form.arabic === null && form.surface === "experimental",
    ),
  );
  assert.doesNotMatch(renderFamily(family, manifest, true), /dictionary-row/);
  assert.throws(() => decodeFamily(payload, manifest, "jkl", "arabic"));
  assert.throws(() =>
    decodeFamily(
      {
        ...payload,
        generated: payload.generated.map((row) => [
          row[0],
          "جكل",
          row[2],
          row[3],
        ]),
      },
      manifest,
      "jkl",
      "turkish",
    ),
  );
  assert.throws(() =>
    decodeFamily(
      { ...payload, generated: payload.generated.slice(1) },
      manifest,
      "jkl",
      "turkish",
    ),
  );
  assert.throws(() =>
    decodeFamily(
      { ...payload, root: { ...payload.root, key: "ktb" } },
      manifest,
      "ktb",
      "turkish",
    ),
  );
});

test("category tabs expose one panel and preserve green sourced entries", async () => {
  const family = decodeFamily(await familyJson("كتب"), manifest, "كتب");
  for (const role of manifest.groups.map((group) => group.role)) {
    const html = renderFamily(family, manifest, true, role);
    const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(
      (match) => match[0],
    );
    const panels = [
      ...html.matchAll(/<section[^>]*role="tabpanel"[^>]*>/g),
    ].map((match) => match[0]);
    assert.equal(tabs.length, 8);
    assert.equal(panels.length, 8);
    assert.equal(
      tabs.filter((tag) => tag.includes('aria-selected="true"')).length,
      1,
    );
    assert.equal(panels.filter((tag) => !tag.includes("hidden")).length, 1);
    assert.ok(
      tabs
        .find((tag) => tag.includes(`id="tab-${role}"`))
        .includes('aria-selected="true"'),
    );
    assert.ok(
      !panels
        .find((tag) => tag.includes(`id="group-${role}"`))
        .includes("hidden"),
    );
    assert.match(html, /class="dictionary-row" data-pattern="I.patient"/);
    assert.doesNotMatch(html, /data-group=/);
  }
});

test("all sourced variants of one pattern share a slot and override a hypothetical", async () => {
  const family = decodeFamily(await familyJson("كتب"), manifest, "كتب");
  const original = family.dictionary.find((entry) => entry.word === "kâtip");
  const variant = { ...original, word: "test variant" };
  const hypothetical = {
    ...family.generated[0],
    pattern: manifest.patterns.find((pattern) => pattern.id === "I.agent"),
  };
  const grouped = groupFamily(
    {
      ...family,
      dictionary: [...family.dictionary, variant],
      generated: [...family.generated, hypothetical],
    },
    manifest,
  );
  const slot = grouped
    .flatMap((group) => group.slots)
    .find((slot) => slot.pattern.id === "I.agent");
  assert.equal(slot.forms.length, 2);
  assert.ok(slot.forms.every((form) => form.kind === "dictionary"));
});

test("every dictionary root decodes and retains all sourced words in the grouped list", async () => {
  let total = 0;
  for (const root of manifest.knownRoots) {
    const family = decodeFamily(await familyJson(root.key), manifest, root.key);
    const forms = groupFamily(family, manifest).flatMap((group) =>
      group.slots.flatMap((slot) => slot.forms),
    );
    const sourced = forms.filter((form) => form.kind === "dictionary");
    assert.deepEqual(
      new Set(sourced.map((entry) => entry.word)),
      new Set(root.words),
    );
    total += sourced.length;
  }
  assert.equal(total, 324);
});
