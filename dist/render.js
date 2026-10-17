import { groupFamily } from "./grouping.js";
import { familyView } from "./families.js";
export function escapeHtml(value) {
    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };
    return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}
const e = escapeHtml;
export function renderKnownRoots(roots) {
    return roots
        .map((root) => `<article class="known-card">
    <button class="root-link" data-query="${e(root.key)}"><strong>${e(root.reading)}</strong><span>${e(root.title)}</span><span aria-hidden="true">↗</span></button>
    <p class="known-words">${root.words.map((word) => `<button data-query="${e(word)}">${e(word)}</button>`).join('<span aria-hidden="true"> · </span>')}</p>
  </article>`)
        .join("");
}
export function renderChoices(candidates) {
    return `<p class="choice-explanation">Bu aramayla eşleşen farklı kök aileleri var. Sözcüklere ve anlamlarına göre seçin:</p>
    <div class="choices">${candidates
        .map((candidate) => `<button class="choice" data-query="${e(candidate.key)}">
      <strong>${e(candidate.known?.words.join(" · ") ?? candidate.sampleForms?.join(" · ") ?? candidate.reading)}</strong><span class="original" lang="ar" dir="rtl">${e(candidate.key)}</span>
      <small>${e(candidate.known?.meaning ?? "Sözlük seçkisinde kayıt yok; varsayımsal biçimler farklı.")}</small>
      <small class="choice-reading">Kök okunuşu: ${e(candidate.reading)}</small>
    </button>`)
        .join("")}</div>`;
}
function dictionaryRow(entry, pattern) {
    const subentry = entry.source.scope === "subentry"
        ? ` · ${entry.source.headword} alt maddesi`
        : "";
    return `<tr class="dictionary-row" data-pattern="${e(pattern.id)}">
    <td><strong class="form-word">${e(entry.word)}</strong><span class="badge attested">Nişanyan kaydı</span></td>
    <td class="original" lang="ar" dir="rtl">${e(entry.arabic)}</td>
    <td><span class="pattern-name" title="${e(entry.pattern)}">${e(pattern.label)}</span></td>
    <td>${e(entry.definition)}${entry.originNote ? `<p class="origin-note">${e(entry.originNote)}</p>` : ""}
      <a class="source" href="${e(entry.source.url)}" target="_blank" rel="noreferrer">Nişanyan ↗${e(subentry)}</a>
      <span class="checked-on">Kontrol: ${e(entry.source.checkedOn)}</span></td>
  </tr>`;
}
function generatedRow(form) {
    const spellings = form.spellings ?? [];
    const arabic = spellings.length > 1
        ? `<details class="form-spellings"><summary lang="tr" dir="ltr">${spellings.length} yazım</summary>${spellings.map((spelling) => `<span title="${e(spelling.surface === "raw-template" ? "Ham kalıp: ses ve yazım kuralları uygulanmadı" : "Düzenli kalıp adayı")}">${e(spelling.root)} ← ${e(spelling.arabic)}</span>`).join("")}</details>`
        : e(form.arabic ?? "—");
    return `<tr class="generated-row" data-pattern="${e(form.pattern.id)}">
    <td><strong class="form-word">${e(form.reading)}</strong><span class="badge generated"${form.surface === "raw-template" ? ' title="Kök harfleri doğrudan kalıba yerleştirildi; özel ses ve yazım kuralları henüz uygulanmıyor."' : ""}>${form.surface === "experimental" ? "Deneysel aday" : form.surface === "raw-template" ? "Ham kalıp" : "Varsayımsal"}</span></td>
    <td class="original" lang="ar" dir="rtl">${arabic}</td>
    <td><span class="pattern-name">${e(form.pattern.label)}</span></td>
    <td>${e(form.pattern.description)}</td>
  </tr>`;
}
function table(rows, label) {
    return `<div class="table-scroll"><table aria-label="${e(label)}"><thead><tr>
    <th scope="col">Biçim</th><th scope="col" class="original">Arapça</th><th scope="col">Kalıp</th><th scope="col">Anlam / açıklama</th>
  </tr></thead><tbody>${rows}</tbody></table></div>`;
}
export function renderFamily(input, manifest, includeGenerated, selectedRole = "agent") {
    const family = familyView(input);
    const [root] = family.arabicRoots;
    const alternatives = family.arabicRoots.length > 1;
    const known = family.dictionary.length > 0;
    const experimental = family.inventory === "turkish";
    const groups = groupFamily(family, manifest, includeGenerated);
    return `<div class="family-heading"><div><p class="eyebrow">${experimental ? "DENEYSEL TÜRKÇE HARFLİ KÖK" : known ? "SÖZLÜKTEKİ KÖK AİLESİ" : alternatives ? "ORTAK TÜRKÇE OKUNUŞ" : "ARAPÇA HARF BİRLEŞİMİ"}</p>
    <h2>${e(family.reading)} ${root && !alternatives ? `<span class="original root-arabic" lang="ar" dir="rtl">${e(root.key)}</span>` : ""}</h2>
    <p>${e(family.meaning)}</p></div><span class="family-count">${family.dictionary.length} kayıt · ${family.generated.length} varsayımsal</span></div>
    ${alternatives ? `<details class="arabic-alternatives"><summary>Arapça yazım seçenekleri (${family.arabicRoots.length})</summary><p>Bu harf birleşimlerinin varsayımsal Türkçe okunuşları aynı olduğu için biçimler bir kez gösterilir. Bunlar ayrı Arapça kök kimlikleridir.</p><div>${family.arabicRoots.map((item) => `<button data-query="${e(item.key)}" lang="ar" dir="rtl">${e(item.key)}</button>`).join("")}</div></details>` : ""}
    ${experimental ? '<p class="notice">Kalıplar girdiğiniz Türkçe harflere doğrudan uygulanmıştır. Bu deneysel köke Arapça yazım, Arapça kök kimliği veya sözlük anlamı atanmamıştır.</p>' : !known ? '<p class="notice">Bu kök için yerel Nişanyan seçkisinde kayıt yok. Bu durum kökün veya biçimlerin bulunmadığını göstermez.</p>' : ""}
    <p class="section-note">Gruplar ve kalıplar her kökte aynı sıradadır. Yeşil biçimler Nişanyan kayıtlarıdır; diğerleri ${experimental ? "deneysel ve varsayımsaldır" : "varsayımsaldır"}. Grup açıklamaları gerçek kullanımı veya anlamı garanti etmez.</p>
    <div class="category-tabs" role="tablist" aria-label="Biçim kategorileri">${groups.map((group) => `<button type="button" role="tab" id="tab-${group.role}" data-role-tab="${group.role}" aria-controls="group-${group.role}" aria-selected="${group.role === selectedRole}" tabindex="${group.role === selectedRole ? 0 : -1}">${e(group.label)} <span>${group.slots.reduce((total, slot) => total + slot.forms.length, 0)}</span></button>`).join("")}</div>
    ${groups
        .map((group) => `<section class="form-section" role="tabpanel" id="group-${group.role}" aria-labelledby="tab-${group.role}" data-role="${group.role}" tabindex="0" ${group.role === selectedRole ? "" : "hidden"}>
      <h3>${e(group.label)} <span>${group.slots.reduce((total, slot) => total + slot.forms.length, 0)}</span></h3>
      <p class="section-note">${e(group.description)}</p>
      ${group.slots.length ? table(group.slots.flatMap((slot) => slot.forms.map((form) => (form.kind === "dictionary" ? dictionaryRow(form, slot.pattern) : generatedRow(form)))).join(""), group.label) : '<p class="empty-group">Bu grupta gösterilecek sözlük kaydı yok.</p>'}
    </section>`)
        .join("")}`;
}
