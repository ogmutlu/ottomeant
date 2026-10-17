import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Lookup, normalizeWord, rootId } from "../dist/lookup.js";
import { decodeFamily, decodeManifest, decodeSearch } from "../dist/codec.js";
import { Catalog } from "../dist/data.js";
import { renderChoices, renderFamily } from "../dist/render.js";

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
const familyJson = async (key) => {
  const id = rootId(key, manifest.letters);
  return readJson(`roots/${id.slice(0, 2)}/${id}.json`);
};

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

test("unknown root letters stay exact and every Arabic combination is addressable", () => {
  for (const [query, letter] of [
    ["ş-k-z", "ش"],
    ["s-k-z", "س"],
  ]) {
    const result = lookup.resolve(query);
    assert.equal(result.kind, "ambiguous");
    assert.ok(result.candidates.some((item) => item.key[0] === letter));
    assert.ok(
      result.candidates.every((item) =>
        query.startsWith("ş") ? item.key[0] === "ش" : item.key[0] !== "ش",
      ),
    );
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
  for (const query of ["evlerimizden", "<script>", "ğ-k-z", "abcd", "q-k-z"])
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
  assert.ok(
    requests
      .slice(1)
      .every((url) => new URL(url).searchParams.get("v") === manifest.buildId),
  );
});

test("presentation preserves evidence, escapes content, and can hide generated forms", async () => {
  const family = decodeFamily(await familyJson("كتب"), manifest, "كتب");
  const html = renderFamily(family, true);
  assert.match(html, /Nişanyan kaydı/);
  assert.match(html, /mektup/);
  assert.match(html, /Üretilen adaylar/);
  assert.doesNotMatch(renderFamily(family, false), /generated-row/);
  assert.doesNotMatch(
    renderChoices([{ key: "<script>", reading: "<script>" }]),
    /<script>/,
  );
  assert.match(
    renderChoices([{ key: "<script>", reading: "<script>" }]),
    /&lt;script&gt;/,
  );
});
