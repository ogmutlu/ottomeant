import { roots, entries } from "./data.js";
import {
  categories,
  derive,
  isRoot,
  letters,
  latin,
  normalize,
  parseRoot,
  requiresSoundRules,
} from "./morphology.js";
import { RootLibrary } from "./library.js";
import type { LibraryTab } from "./library.js";
import type { Entry, Root, View } from "./model.js";

function element<T extends HTMLElement>(selector: string): T {
  const result = document.querySelector<T>(selector);
  if (!result) throw new Error(`Missing application element: ${selector}`);
  return result;
}
const input = (selector: string): HTMLInputElement => element(selector);
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
const dialog = element<HTMLDialogElement>("#info");
function loadRootKeys(storageKey: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (key): key is string => typeof key === "string" && isRoot(key),
        )
      : [];
  } catch {
    return [];
  }
}
const library = new RootLibrary(roots, loadRootKeys("ottomeant-proposed"));
const state: {
  root: Root;
  view: View;
  savedOnly: boolean;
  libraryTab: LibraryTab;
  showArabic: boolean;
  saved: Set<string>;
} = {
  root: roots[0],
  view: "all",
  savedOnly: false,
  libraryTab: "dictionary",
  showArabic: false,
  saved: loadSaved(),
};
function loadSaved(): Set<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("ottomeant-saved") ?? "[]",
    );
    return new Set(
      Array.isArray(value)
        ? value.filter(
            (key): key is string => typeof key === "string" && isRoot(key),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}
function ensureRoot(key: string): Root {
  const root = library.resolve(key);
  persistProposals();
  return root;
}
function persistProposals(): void {
  try {
    localStorage.setItem(
      "ottomeant-proposed",
      JSON.stringify(library.roots("proposed").map((root) => root.key)),
    );
  } catch {
    /* User proposals remain available for this session. */
  }
}
function removeProposal(key: string): void {
  if (!library.removeProposal(key)) return;
  state.saved.delete(key);
  persistProposals();
  try {
    localStorage.setItem("ottomeant-saved", JSON.stringify([...state.saved]));
  } catch {
    /* Session-only storage remains usable. */
  }
  if (state.root.key === key) {
    state.root = library.roots("proposed")[0] ?? roots[0];
    history.replaceState(null, "", "#" + encodeURIComponent(state.root.key));
  }
  render();
}
function selectRoot(key: string): void {
  if (!isRoot(key)) return;
  state.root = ensureRoot(key);
  state.libraryTab = state.root.custom ? "proposed" : "dictionary";
  history.replaceState(null, "", "#" + encodeURIComponent(key));
  render();
}
function setLibraryTab(tab: LibraryTab): void {
  state.libraryTab = tab;
  renderLibrary();
}
function rootText(root: Root): string {
  return state.showArabic
    ? root.key.split("").join(" ")
    : root.reading.split("-").join(" ");
}
function renderLibrary(): void {
  const query = normalize(input("#search").value);
  const collection = library.roots(state.libraryTab);
  const filtered = collection.filter(
    (root) =>
      (!state.savedOnly || state.saved.has(root.key)) &&
      normalize(
        [
          root.key,
          root.reading,
          root.title,
          root.meaning,
          ...entries
            .filter((entry) => entry.root === root.key)
            .map((entry) => `${entry.word} ${entry.definition}`),
        ].join(" "),
      ).includes(query),
  );
  element("#root-count").textContent = `${collection.length} kök`;
  for (const tab of ["dictionary", "proposed"] as const) {
    const button = element(`[data-library="${tab}"]`);
    button.classList.toggle("active", state.libraryTab === tab);
    button.setAttribute("aria-selected", String(state.libraryTab === tab));
    element(`#${tab}-count`).textContent = String(library.roots(tab).length);
  }
  element("#saved-count").textContent = String(state.saved.size);
  element("#root-list").innerHTML = filtered.length
    ? filtered
        .map(
          (root) => `
    <div class="root-row"><button class="root-item ${root.key === state.root.key ? "active" : ""}" data-root="${root.key}">
      <span><b>${escapeHtml(root.reading)}</b><small>${escapeHtml(root.title)}</small></span>
      <span class="arabic" ${state.showArabic ? 'lang="ar" dir="rtl"' : ""}>${rootText(root)}</span>
    </button>${root.custom ? `<button class="remove-proposal" data-remove-root="${root.key}" aria-label="${escapeHtml(root.reading)} önerisini kaldır" title="Öneriyi kaldır">Kaldır</button>` : ""}</div>`,
        )
        .join("")
    : '<p class="empty">Kök bulunamadı. Aşağıdan yeni bir kök deneyebilirsiniz.</p>';
}
/** Highlight the actual headword, preserving its spelling and the sentence's context. */
function renderExample(example: string, word: string): string {
  const index = example.indexOf(word);
  if (index < 0) throw new Error(`Example does not contain headword: ${word}`);
  return (
    escapeHtml(example.slice(0, index)) +
    "<strong>" +
    escapeHtml(word) +
    "</strong>" +
    escapeHtml(example.slice(index + word.length))
  );
}
function renderCard(entry: Entry): string {
  const verified = entry.kind === "dictionary";
  const category = categories.find((category) => category.id === entry.role)!;
  const examples =
    entry.kind === "dictionary"
      ? `
    <div class="examples"><span class="lang-label">TÜRKÇE ÖRNEK</span>
      <p lang="tr">${renderExample(entry.example, entry.word)}</p>
      <small>Özgün örnek cümle · sözlükten alıntı değildir.</small></div>
    <div class="source-line"><a href="${escapeHtml(entry.source.url)}" target="_blank" rel="noreferrer">
      Nişanyan Sözlük ↗</a><span>${entry.source.scope === "subentry" ? `“${escapeHtml(entry.source.headword)}” maddesinde` : "Sözcük kaydı"} · ${entry.source.checkedOn}</span></div>
    ${entry.originNote ? `<div class="card-note">${escapeHtml(entry.originNote)}</div>` : ""}`
      : `
    <div class="examples"><span class="lang-label">TÜRKÇE ÖRNEK · VARSAYIMSAL KULLANIM</span>
      <p lang="tr">${renderExample(entry.example, entry.reading)}</p>
      <small>Önerilen anlamı göstermek için kurgulanmıştır; gerçek kullanım kanıtı değildir.</small></div>
    <div class="card-note">Bu biçim için atlasın sözlük seçkisinde eşleşen kayıt yok. Önerilen anlam ve örnek varsayımsaldır; sözcüğün Türkçede veya Arapçada bulunmadığı ileri sürülmez.
      ${entry.requiresSoundRules ? "Kök, ek ses ve yazım kuralları gerektirir; gösterilen biçim ham şablondur." : ""}</div>`;
  return `<article class="card" data-status="${entry.kind}">
    <div class="card-head"><span class="badge ${verified ? "" : "hyp"}">${verified ? "● Nişanyan’da kayıtlı" : "◇ Varsayımsal · kayıt eşleşmesi yok"}</span>
      <span class="pattern">${category.label} · ${escapeHtml(entry.pattern)}</span></div>
    <div class="card-main"><div><span class="lang-label">${verified ? "TÜRKÇE SÖZCÜK" : "VARSAYIMSAL BİÇİM"}</span>
      <div><span class="word" lang="tr">${escapeHtml(entry.reading)}</span>
      ${state.showArabic ? `<span class="source-script" lang="ar" dir="rtl">${escapeHtml(entry.arabic)}</span>` : ""}</div></div>
      <div class="arrow">→</div><div><span class="lang-label">${verified ? "ANLAMI" : "ÖNERİLEN ANLAMI"}</span>
      <div class="definition">${escapeHtml(entry.definition)}</div></div></div>${examples}</article>`;
}
function render(): void {
  renderLibrary();
  const root = state.root;
  element("#crumb").textContent = root.reading.toLocaleUpperCase("tr");
  element("#root-heading").innerHTML =
    `<div class="heading"><div class="root-large" ${state.showArabic ? 'lang="ar" dir="rtl"' : ""}>${rootText(root)}</div>
    <div><h2>${escapeHtml(root.title)}</h2><p>${escapeHtml(root.reading)} · ${escapeHtml(root.meaning)}</p></div></div>`;
  element("#root-kind").textContent = requiresSoundRules(root.key)
    ? "Özel ses kuralları gerekir"
    : "Düzenli kök şablonları";
  element("#save-root").textContent = state.saved.has(root.key)
    ? "★ Kaydedildi"
    : "☆ Kökü kaydet";
  const allForms = derive(root);
  const forms = allForms.filter(
    (entry) =>
      input("#include-unverified").checked || entry.kind === "dictionary",
  );
  const verifiedCount = allForms.filter(
    (entry) => entry.kind === "dictionary",
  ).length;
  element("#coverage").textContent =
    `${verifiedCount} Nişanyan kaydı · ${allForms.length - verifiedCount} varsayımsal biçim`;
  const sourceRoots: Readonly<Record<string, string>> = {
    كتب: "ktb",
    علم: "ˁlm",
    درس: "drs",
    فتح: "ftḥ",
    حكم: "ḥkm",
    عمل: "ˁml",
    نظر: "nẓr",
    حفظ: "ḥfẓ",
    سلم: "slm",
    خلق: "χlḳ",
    شكر: "şkr",
    صبر: "ṣbr",
  };
  const sourceLink = element<HTMLAnchorElement>("#root-source");
  sourceLink.href =
    "https://www.nisanyansozluk.com/arama/sonuc?semiticRoot=" +
    encodeURIComponent(
      root.sourceRoot ??
        sourceRoots[root.key] ??
        root.reading.replaceAll("-", ""),
    );
  element("#tabs").innerHTML = categories
    .map(
      (
        category,
      ) => `<button role="tab" tabindex="${state.view === category.id ? 0 : -1}" aria-selected="${state.view === category.id}"
    class="${state.view === category.id ? "active" : ""}" data-role="${category.id}">${category.label}<span>${forms.filter((entry) => category.id === "all" || entry.role === category.id).length}</span></button>`,
    )
    .join("");
  const category = categories.find((category) => category.id === state.view)!;
  element("#role-title").textContent = category.title;
  element("#role-description").textContent = category.description;
  const visible = forms.filter(
    (entry) => state.view === "all" || entry.role === state.view,
  );
  element("#cards").innerHTML = visible.length
    ? visible.map(renderCard).join("")
    : '<div class="empty">Bu görünümde sözlük kaydı yok. Önerilen anlamları görmek için “Varsayımsal biçimler” seçeneğini açın.</div>';
}
function setView(view: View): void {
  state.view = view;
  render();
  element(`[data-role="${view}"]`).focus();
}
function setFilter(savedOnly: boolean): void {
  state.savedOnly = savedOnly;
  element("#all-filter").classList.toggle("active", !savedOnly);
  element("#saved-filter").classList.toggle("active", savedOnly);
  renderLibrary();
}
element("#root-list").addEventListener("click", (event) => {
  const remove = (event.target as Element).closest<HTMLElement>(
    "[data-remove-root]",
  );
  if (remove?.dataset.removeRoot) {
    removeProposal(remove.dataset.removeRoot);
    return;
  }
  const button = (event.target as Element).closest<HTMLElement>("[data-root]");
  if (button?.dataset.root) selectRoot(button.dataset.root);
});
element("#tabs").addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLElement>("[data-role]");
  const category = categories.find(
    (category) => category.id === button?.dataset.role,
  );
  if (category) setView(category.id);
});
element("#tabs").addEventListener("keydown", (event) => {
  if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const current = categories.findIndex(
    (category) => category.id === state.view,
  );
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? categories.length - 1
        : (current +
            (event.key === "ArrowRight" ? 1 : -1) +
            categories.length) %
          categories.length;
  setView(categories[next].id);
});
input("#search").addEventListener("input", renderLibrary);
input("#include-unverified").addEventListener("change", render);
element("#save-root").addEventListener("click", () => {
  if (state.saved.has(state.root.key)) state.saved.delete(state.root.key);
  else state.saved.add(state.root.key);
  try {
    localStorage.setItem("ottomeant-saved", JSON.stringify([...state.saved]));
  } catch {
    /* Session-only storage remains usable. */
  }
  render();
});
for (const tab of ["dictionary", "proposed"] as const) {
  element(`[data-library="${tab}"]`).addEventListener("click", () =>
    setLibraryTab(tab),
  );
}
element("#all-filter").addEventListener("click", () => setFilter(false));
for (const selector of ["#saved-filter", "#saved-nav"])
  element(selector).addEventListener("click", () => {
    setFilter(true);
    element("#explorer").scrollIntoView({ behavior: "smooth" });
  });
element("#custom-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const key = parseRoot(input("#custom-root").value, library.all());
  if (!key) {
    element("#custom-error").textContent =
      "Üç kök harfi girin; örneğin k-t-b veya d-r-s.";
    return;
  }
  element("#custom-error").textContent =
    "Türkçe okunuş bazı ses ayrımlarını birleştirir. Tam harf seçimi atlas menüsündedir.";
  input("#search").value = "";
  setFilter(false);
  selectRoot(key);
});
for (const selector of ["#about", "#method"])
  element(selector).addEventListener("click", () => dialog.showModal());
element(".close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
element("#consonants").innerHTML = [1, 2, 3]
  .map(
    (position) => `<select aria-label="${position}. kök harfi">
  ${letters.map((letter, index) => `<option value="${letter}">${latin[index]} (${index + 1})</option>`).join("")}</select>`,
  )
  .join("");
element("#browse-combination").addEventListener("click", () => {
  selectRoot(
    [...document.querySelectorAll<HTMLSelectElement>("#consonants select")]
      .map((select) => select.value)
      .join(""),
  );
  dialog.close();
});
input("#show-arabic").addEventListener("change", (event) => {
  state.showArabic = (event.target as HTMLInputElement).checked;
  document.body.classList.toggle("show-arabic", state.showArabic);
  render();
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(
      document.activeElement?.tagName ?? "",
    ) &&
    !dialog.open
  ) {
    event.preventDefault();
    input("#search").focus();
  }
});
for (const key of state.saved) ensureRoot(key);
try {
  const key = decodeURIComponent(location.hash.slice(1));
  if (isRoot(key)) {
    state.root = ensureRoot(key);
    state.libraryTab = state.root.custom ? "proposed" : "dictionary";
  }
} catch {
  /* Invalid URL fragments do not change the default root. */
}
render();
