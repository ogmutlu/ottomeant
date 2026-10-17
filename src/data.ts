/** IO only: lazy static JSON loading, validation, versioning, and caching. */
import { decodeFamily, decodeManifest, decodeSearch } from "./codec.js";
import { isExperimentalRoot, rootId } from "./lookup.js";
import type { Inventory, Manifest, RootFamily, SearchIndex } from "./model.js";

export type Fetcher = (url: URL, init?: RequestInit) => Promise<Response>;

export class Catalog {
  readonly #families = new Map<string, Promise<RootFamily>>();

  private constructor(
    readonly manifest: Manifest,
    readonly search: SearchIndex,
    readonly baseUrl: URL,
    readonly fetcher: Fetcher,
  ) {}

  static async load(
    baseUrl = new URL("../public/data/", import.meta.url),
    fetcher: Fetcher = fetch,
  ): Promise<Catalog> {
    const manifest = decodeManifest(
      await readJson(new URL("manifest.json", baseUrl), fetcher, "no-cache"),
    );
    const searchUrl = versionedUrl("search.json", baseUrl, manifest.buildId);
    const search = decodeSearch(await readJson(searchUrl, fetcher), manifest);
    return new Catalog(manifest, search, baseUrl, fetcher);
  }

  family(key: string, inventory: Inventory = "arabic"): Promise<RootFamily> {
    if (inventory === "turkish" && !isExperimentalRoot(key, this.manifest)) {
      throw new Error("An Arabic counterpart already exists for this root");
    }
    const identity = `${inventory}:${key}`;
    const cached = this.#families.get(identity);
    if (cached) return cached;
    const alphabet =
      inventory === "arabic"
        ? this.manifest.letters
        : this.manifest.turkishLetters;
    const id = rootId(key, alphabet);
    const directory = inventory === "arabic" ? "roots" : "turkish-roots";
    const url = versionedUrl(
      `${directory}/${id.slice(0, 2)}/${id}.json`,
      this.baseUrl,
      this.manifest.buildId,
    );
    const pending = readJson(url, this.fetcher).then((value) =>
      decodeFamily(value, this.manifest, key, inventory),
    );
    this.#families.set(identity, pending);
    // Failed requests are retryable after a network or deployment error.
    void pending.catch(() => {
      this.#families.delete(identity);
    });
    return pending;
  }
}

function versionedUrl(path: string, base: URL, buildId: string): URL {
  const url = new URL(path, base);
  url.searchParams.set("v", buildId);
  return url;
}

async function readJson(
  url: URL,
  fetcher: Fetcher,
  cache?: RequestCache,
): Promise<unknown> {
  const response = await fetcher(url, cache ? { cache } : undefined);
  if (!response.ok)
    throw new Error(
      `Static data request failed: ${response.status} ${url.pathname}`,
    );
  const value: unknown = await response.json();
  return value;
}
