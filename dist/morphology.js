import { entries } from "./data.js";
import { proposeMeaning } from "./hypotheses.js";
export const letters = "ءبتثجحخدذرزسشصضطظعغفقكلمنهوي".split("");
/** One Turkish reading per Arabic letter, in exactly the same order as `letters`. */
export const latin = [
    "’",
    "b",
    "t",
    "s",
    "c",
    "h",
    "h",
    "d",
    "z",
    "r",
    "z",
    "s",
    "ş",
    "s",
    "d",
    "t",
    "z",
    "a",
    "g",
    "f",
    "k",
    "k",
    "l",
    "m",
    "n",
    "h",
    "v",
    "y",
];
export const categories = [
    [
        "all",
        "Tüm biçimler",
        "Kökün anlam haritası",
        "Bir kökten türeyen sözcükleri ve olası anlamlarını keşfedin.",
    ],
    ["agent", "Yapan", "Yapan · fail", "Eylemi yapan kişi veya varlık."],
    [
        "patient",
        "Etkilenen",
        "Etkilenen · meful",
        "Eylemden etkilenen kişi veya nesne.",
    ],
    [
        "theme",
        "Konu",
        "Konu · tema",
        "Eylemin konusu veya ürünü; tek bir kalıpla sınırlı değildir.",
    ],
    [
        "action",
        "Eylem",
        "Eylem · mastar",
        "Eylemin veya sürecin isim olarak ifadesi.",
    ],
    ["place", "Yer", "Yer · mekân", "Eylemin gerçekleştiği yer."],
    [
        "instrument",
        "Araç",
        "Araç · alet",
        "Eylemi gerçekleştirmeye yarayan nesne.",
    ],
    [
        "quality",
        "Nitelik",
        "Nitelik ve durum",
        "Bir varlığın niteliğini veya durumunu anlatan sözcükler.",
    ],
    [
        "verbs",
        "Fiil şablonları",
        "Fiil kalıpları",
        "Birinci ile onuncu biçimlerin düzenli kök şablonları.",
    ],
].map(([id, label, title, description]) => ({
    id: id,
    label,
    title,
    description,
}));
const templates = [
    ["agent", "1َا2ِ3", "1a2i3", "Yapan kişi", "Bu kökün eylemini yapan kişi."],
    [
        "patient",
        "مَ1ْ2ُو3",
        "me12u3",
        "Etkilenen varlık",
        "Bu kökün eyleminden etkilenen varlık.",
    ],
    [
        "theme",
        "1ِ2َا3",
        "1i2a3",
        "Olası ürün veya konu",
        "Bu kökle ilişkili bir ürün veya konu olabilir; bu kalıp tema rolünü garanti etmez.",
    ],
    [
        "action",
        "1َ2ْ3",
        "1a23",
        "Eylem veya süreç",
        "Bu kökle ilişkili eylem veya süreç. Birinci biçimin mastarı sözlükten öğrenilir.",
    ],
    [
        "place",
        "مَ1ْ2َ3",
        "me12a3",
        "Eylemin yeri",
        "Bu kökün eyleminin gerçekleştiği yer.",
    ],
    [
        "instrument",
        "مِ1ْ2َا3",
        "mi12a3",
        "Eylemin aracı",
        "Bu kökün eylemini gerçekleştiren araç.",
    ],
    [
        "quality",
        "1َ2ِي3",
        "1a2i3",
        "Süreklilik gösteren nitelik",
        "Bu sıfat kalıbının kökteki gerçek kullanımı ve anlamı sözlük doğrulaması gerektirir.",
    ],
];
const verbs = [
    ["1َ2َ3َ", "1a2a3a", "Temel eylem"],
    ["1َ2َّ3َ", "1a22a3a", "Yoğunlaştırma veya yaptırma"],
    ["1َا2َ3َ", "1a2a3a", "Karşılıklı ilişki veya katılım"],
    ["أَ1ْ2َ3َ", "e12a3a", "Yaptırma"],
    ["تَ1َ2َّ3َ", "te1a22a3a", "İkinci biçimin dönüşlü anlamı"],
    ["تَ1َا2َ3َ", "te1a2a3a", "Karşılıklılık"],
    ["اِنْ1َ2َ3َ", "in1a2a3a", "Oluşa veya dönüşüme katılma"],
    ["اِ1ْتَ2َ3َ", "i1te2a3a", "Dönüşlü veya edinimsel anlam"],
    ["اِ1ْ2َ3َّ", "i12a33a", "Renk veya bedensel özellik"],
    ["اِسْتَ1ْ2َ3َ", "iste12a3a", "İsteme veya sayma"],
];
export function normalize(value) {
    return value
        .toLocaleLowerCase("tr")
        .normalize("NFD")
        .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "")
        .replace(/[\sـ-]/g, "");
}
export function readingOf(key) {
    return [...key]
        .map((letter) => latin[letters.indexOf(letter)] ?? letter)
        .join("-");
}
export function isRoot(key) {
    return ([...key].length === 3 &&
        [...key].every((letter) => letters.includes(letter)));
}
export function requiresSoundRules(key) {
    return /[ويء]/.test(key) || new Set(key).size < 3;
}
function instantiate(template, key, roman) {
    return template.replace(/[123]/g, (position) => {
        const radical = key[Number(position) - 1];
        return roman ? latin[letters.indexOf(radical)] : radical;
    });
}
export function derive(root) {
    const known = entries.filter((entry) => entry.root === root.key);
    const candidate = (role, arabic, reading, turkish, definition) => {
        const word = instantiate(reading, root.key, true);
        const proposal = proposeMeaning(root, role, word, turkish);
        return {
            kind: "unverified",
            pattern: role === "verbs"
                ? turkish
                : `İsim şablonu · ${instantiate(reading, "فعل", true)}`,
            role,
            arabic: instantiate(arabic, root.key, false),
            reading: word,
            turkish,
            definition: `${proposal.definition} ${definition}`,
            example: proposal.example,
            requiresSoundRules: requiresSoundRules(root.key),
        };
    };
    const nominal = templates.map(([role, arabic, reading, meaning, definition]) => candidate(role, arabic, reading, meaning, root.custom
        ? definition
        : `${definition} İlgili anlam alanı: ${root.meaning}.`));
    const verbal = verbs.map(([arabic, reading, meaning], index) => candidate("verbs", arabic, reading, `${index + 1}. biçim · ${meaning}`, `Olası işlev: ${meaning.toLocaleLowerCase("tr")}. Bu kökte kullanımı doğrulanmamıştır.`));
    // Match actual forms, not broad semantic roles: a root may have many agents.
    const remainingNominal = nominal.filter((form) => !known.some((entry) => entry.role === form.role &&
        normalize(entry.arabic) === normalize(form.arabic)));
    return [...known, ...remainingNominal, ...verbal];
}
/** Search folding is deliberately excluded: distinct Turkish root letters stay distinct.
 * Known roots resolve ambiguous Arabic spellings; other input uses the stated mapping.
 */
export function parseRoot(input, roots) {
    const value = input
        .toLocaleLowerCase("tr")
        .normalize("NFC")
        .replace(/[\u064b-\u065f\u0670]/g, "")
        .replace(/[\sـ-]/g, "");
    const known = roots.find((root) => root.reading.replaceAll("-", "") === value);
    if (known)
        return known.key;
    const mapping = {
        b: "ب",
        c: "ج",
        d: "د",
        f: "ف",
        g: "غ",
        h: "ح",
        k: "ك",
        l: "ل",
        m: "م",
        n: "ن",
        r: "ر",
        s: "س",
        ş: "ش",
        t: "ت",
        v: "و",
        y: "ي",
        z: "ز",
        a: "ع",
    };
    const key = [...value].map((letter) => mapping[letter] ?? letter).join("");
    return isRoot(key) ? key : undefined;
}
