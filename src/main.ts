/** DOM wiring and view state. Domain operations live in lookup.ts and Python. */
import { Catalog } from "./data.js";
import { Lookup } from "./lookup.js";
import { renderChoices, renderFamily, renderKnownRoots } from "./render.js";
import type { RootFamily } from "./model.js";

function element<T extends HTMLElement>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Missing UI element: ${selector}`);
  return value;
}

const form = element<HTMLFormElement>("#search-form");
const input = element<HTMLInputElement>("#search");
const submit = element<HTMLButtonElement>("#search-submit");
const status = element("#status");
const choices = element("#choices");
const results = element("#results");
const content = element("#family");
const includeGenerated = element<HTMLInputElement>("#include-generated");
const showArabic = element<HTMLInputElement>("#show-arabic");
const suggestions = element<HTMLDataListElement>("#suggestions");
const retry = element<HTMLButtonElement>("#retry");
let family: RootFamily | undefined;
let request = 0;

function setStatus(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function paintFamily(): void {
  if (family)
    content.innerHTML = renderFamily(family, includeGenerated.checked);
}

function queryFromHash(): string {
  return new URLSearchParams(location.hash.slice(1)).get("q") ?? "";
}

async function start(): Promise<void> {
  retry.hidden = true;
  submit.disabled = true;
  setStatus("Kökler yükleniyor…");
  let catalog: Catalog;
  try {
    catalog = await Catalog.load();
  } catch (error) {
    console.error(error);
    setStatus(
      "Kök verileri yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.",
      true,
    );
    retry.hidden = false;
    return;
  }

  const lookup = new Lookup(catalog.manifest, catalog.search);
  const manifest = catalog.manifest;
  element("#coverage").textContent =
    `${manifest.rootCount.toLocaleString("tr")} harf birleşimi · ${manifest.dictionaryRootCount} bilinen kök · ${manifest.dictionaryEntryCount} kaynaklı sözcük`;
  element("#known-count").textContent =
    `${manifest.dictionaryRootCount} kök / ${manifest.dictionaryEntryCount} sözcük`;
  const rootsContainer = element("#known-roots");
  const more = element<HTMLButtonElement>("#more-roots");
  rootsContainer.innerHTML = renderKnownRoots(manifest.knownRoots.slice(0, 12));
  more.textContent = `Tüm ${manifest.dictionaryRootCount} kökü göster`;
  more.hidden = manifest.knownRoots.length <= 12;
  more.addEventListener("click", () => {
    const expanded = more.getAttribute("aria-expanded") !== "true";
    rootsContainer.innerHTML = renderKnownRoots(
      expanded ? manifest.knownRoots : manifest.knownRoots.slice(0, 12),
    );
    more.setAttribute("aria-expanded", String(expanded));
    more.textContent = expanded
      ? "Daha az göster"
      : `Tüm ${manifest.dictionaryRootCount} kökü göster`;
  });

  async function search(query: string): Promise<void> {
    const current = ++request;
    input.value = query;
    choices.replaceChildren();
    family = undefined;
    results.hidden = true;
    results.setAttribute("aria-busy", "false");
    const resolution = lookup.resolve(query);
    switch (resolution.kind) {
      case "empty":
        setStatus("Bir Türkçe sözcük veya üç kök harfiyle başlayın.");
        return;
      case "not-found":
        setStatus(
          "Sözcük yerel seçkide bulunamadı. Bir sözlük başlığı veya k-t-b gibi üç kök harfi deneyin.",
        );
        return;
      case "ambiguous":
        setStatus(`${resolution.candidates.length} olası kök bulundu.`);
        choices.innerHTML = renderChoices(resolution.candidates);
        return;
      case "resolved": {
        results.setAttribute("aria-busy", "true");
        setStatus("Kökün biçimleri yükleniyor…");
        try {
          const loaded = await catalog.family(resolution.candidate.key);
          if (current !== request) return;
          family = loaded;
          paintFamily();
          results.hidden = false;
          setStatus(
            `${loaded.root.reading}: ${loaded.dictionary.length} sözlük kaydı, ${loaded.generated.length} üretilen aday.`,
          );
        } catch (error) {
          if (current !== request) return;
          console.error(error);
          setStatus(
            "Bu kökün verileri yüklenemedi. Arama düğmesiyle yeniden deneyebilirsiniz.",
            true,
          );
        } finally {
          if (current === request) results.setAttribute("aria-busy", "false");
        }
      }
    }
  }

  function navigate(query: string): void {
    const hash = "#" + new URLSearchParams({ q: query }).toString();
    if (location.hash === hash) void search(query);
    else location.hash = hash;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    navigate(input.value);
  });
  input.addEventListener("input", () => {
    suggestions.replaceChildren(
      ...lookup.suggest(input.value).map((item) => {
        const option = document.createElement("option");
        option.value = item.word;
        return option;
      }),
    );
  });
  document.addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("button[data-query]")
        : null;
    if (!button?.dataset.query) return;
    navigate(button.dataset.query);
    input.focus({ preventScroll: true });
    form.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  window.addEventListener("hashchange", () => {
    void search(queryFromHash());
  });
  submit.disabled = false;
  await search(queryFromHash());
}

includeGenerated.addEventListener("change", paintFamily);
showArabic.addEventListener("change", () =>
  document.body.classList.toggle("show-arabic", showArabic.checked),
);
retry.addEventListener("click", () => {
  void start();
});
void start();
