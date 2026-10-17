/** Presentation only. Morphology and dictionary precedence are already resolved. */
import type {
  DictionaryEntry,
  GeneratedForm,
  KnownRoot,
  RootCandidate,
  RootFamily,
} from "./model.js";

export function escapeHtml(value: string): string {
  const entities: Readonly<Record<string, string>> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(
    /[&<>"']/g,
    (character) => entities[character] ?? character,
  );
}

const e = escapeHtml;

export function renderKnownRoots(roots: readonly KnownRoot[]): string {
  return roots
    .map(
      (root) => `<article class="known-card">
    <button class="root-link" data-query="${e(root.key)}"><strong>${e(root.reading)}</strong><span>${e(root.title)}</span><span aria-hidden="true">↗</span></button>
    <p class="known-words">${root.words.map((word) => `<button data-query="${e(word)}">${e(word)}</button>`).join('<span aria-hidden="true"> · </span>')}</p>
  </article>`,
    )
    .join("");
}

export function renderChoices(candidates: readonly RootCandidate[]): string {
  return `<p class="choice-explanation">Bu okunuş birden fazla Arapça köke karşılık gelebilir. Birini seçin:</p>
    <div class="choices">${candidates
      .map(
        (candidate) => `<button class="choice" data-query="${e(candidate.key)}">
      <strong>${e(candidate.reading)}</strong><span lang="ar" dir="rtl">${e(candidate.key)}</span>
      <small>${e(candidate.known?.words.join(" · ") ?? "Sözlük seçkisinde kayıt yok")}</small>
    </button>`,
      )
      .join("")}</div>`;
}

function dictionaryRow(entry: DictionaryEntry): string {
  const subentry =
    entry.source.scope === "subentry"
      ? ` · ${entry.source.headword} alt maddesi`
      : "";
  return `<tr class="dictionary-row">
    <td><strong class="form-word">${e(entry.word)}</strong><span class="badge attested">Nişanyan kaydı</span></td>
    <td class="original" lang="ar" dir="rtl">${e(entry.arabic)}</td>
    <td><span class="pattern-name">${e(entry.pattern)}</span></td>
    <td>${e(entry.definition)}${entry.originNote ? `<p class="origin-note">${e(entry.originNote)}</p>` : ""}
      <a class="source" href="${e(entry.source.url)}" target="_blank" rel="noreferrer">Nişanyan ↗${e(subentry)}</a>
      <span class="checked-on">Kontrol: ${e(entry.source.checkedOn)}</span></td>
  </tr>`;
}

function generatedRow(form: GeneratedForm): string {
  return `<tr class="generated-row">
    <td><strong class="form-word">${e(form.reading)}</strong><span class="badge generated">${form.surface === "raw-template" ? "Ham kalıp" : "Üretilen aday"}</span></td>
    <td class="original" lang="ar" dir="rtl">${e(form.arabic)}</td>
    <td><span class="pattern-name">${e(form.pattern.label)}</span></td>
    <td>${e(form.pattern.description)}</td>
  </tr>`;
}

function table(rows: string, label: string): string {
  return `<div class="table-scroll"><table aria-label="${e(label)}"><thead><tr>
    <th scope="col">Biçim</th><th scope="col" class="original">Arapça</th><th scope="col">Kalıp</th><th scope="col">Anlam / açıklama</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function renderFamily(
  family: RootFamily,
  includeGenerated: boolean,
): string {
  const known = family.dictionary.length > 0;
  const warning = family.generated.some(
    (form) => form.surface === "raw-template",
  );
  return `<div class="family-heading"><div><p class="eyebrow">${known ? "SÖZLÜKTEKİ KÖK AİLESİ" : "HARF BİRLEŞİMİ"}</p>
    <h2>${e(family.root.reading)} <span class="original root-arabic" lang="ar" dir="rtl">${e(family.root.key)}</span></h2>
    <p>${e(family.root.meaning)}</p></div><span class="family-count">${family.dictionary.length} kayıt · ${family.generated.length} aday</span></div>
    ${known ? `<section class="form-section"><h3>Nişanyan kayıtları <span>${family.dictionary.length}</span></h3>${table(family.dictionary.map(dictionaryRow).join(""), "Nişanyan kayıtları")}</section>` : '<p class="notice">Bu kök için yerel Nişanyan seçkisinde kayıt yok. Bu durum kökün veya biçimlerin bulunmadığını göstermez.</p>'}
    ${
      includeGenerated
        ? `<section class="form-section"><h3>Üretilen adaylar <span>${family.generated.length}</span></h3>
      <p class="section-note">Bunlar kalıpların Türkçe harflerle yaklaşık okunuşlarıdır. Türkçede veya Arapçada kullanıldıkları doğrulanmamıştır; açıklamalar kalıbın olası işlevini gösterir. Sözlük kaydıyla eşleşen biçimler burada tekrarlanmaz.</p>
      ${warning ? '<p class="notice">“Ham kalıp” olarak işaretlenen adaylarda zayıf harf, ikiz kök, hemze veya benzeşme için gereken ses ve yazım kuralları uygulanmamıştır.</p>' : ""}
      ${family.generated.length ? table(family.generated.map(generatedRow).join(""), "Üretilen adaylar") : '<p class="section-note">Desteklenen bütün adayların sözlük karşılığı var.</p>'}</section>`
        : ""
    }`;
}
