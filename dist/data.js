/** IO only: lazy static JSON loading, validation, versioning, and caching. */
import { decodeFamily, decodeManifest, decodeSearch } from "./codec.js";
import { isExperimentalRoot, rootId } from "./lookup.js";
export class Catalog {
    manifest;
    search;
    baseUrl;
    fetcher;
    #families = new Map();
    constructor(manifest, search, baseUrl, fetcher) {
        this.manifest = manifest;
        this.search = search;
        this.baseUrl = baseUrl;
        this.fetcher = fetcher;
    }
    static async load(baseUrl = new URL("../public/data/", import.meta.url), fetcher = fetch) {
        const manifest = decodeManifest(await readJson(new URL("manifest.json", baseUrl), fetcher, "no-cache"));
        const searchUrl = versionedUrl("search.json", baseUrl, manifest.buildId);
        const search = decodeSearch(await readJson(searchUrl, fetcher), manifest);
        return new Catalog(manifest, search, baseUrl, fetcher);
    }
    family(key, inventory = "arabic") {
        if (inventory === "turkish" && !isExperimentalRoot(key, this.manifest)) {
            throw new Error("An Arabic counterpart already exists for this root");
        }
        const identity = `${inventory}:${key}`;
        const cached = this.#families.get(identity);
        if (cached)
            return cached;
        const alphabet = inventory === "arabic"
            ? this.manifest.letters
            : this.manifest.turkishLetters;
        const id = rootId(key, alphabet);
        const directory = inventory === "arabic" ? "roots" : "turkish-roots";
        const url = versionedUrl(`${directory}/${id.slice(0, 2)}/${id}.json`, this.baseUrl, this.manifest.buildId);
        const pending = readJson(url, this.fetcher).then((value) => decodeFamily(value, this.manifest, key, inventory));
        this.#families.set(identity, pending);
        // Failed requests are retryable after a network or deployment error.
        void pending.catch(() => {
            this.#families.delete(identity);
        });
        return pending;
    }
}
function versionedUrl(path, base, buildId) {
    const url = new URL(path, base);
    url.searchParams.set("v", buildId);
    return url;
}
async function readJson(url, fetcher, cache) {
    const response = await fetcher(url, cache ? { cache } : undefined);
    if (!response.ok)
        throw new Error(`Static data request failed: ${response.status} ${url.pathname}`);
    const value = await response.json();
    return value;
}
