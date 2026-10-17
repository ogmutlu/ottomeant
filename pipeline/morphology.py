"""Explicit, bounded Arabic templates; lexical existence is never inferred.

Readings use Turkish letters but Arabic vowels, not invented Turkish borrowings.
Exceptional roots retain raw templates, with a machine-readable warning. This is
a rule-based morphology baseline, not a CAMeL-backed lexical analyzer.
"""

import re
import unicodedata
from dataclasses import dataclass

from .model import GeneratedRow, Inventory, PatternMetadata, Role, RootClass

LETTERS = tuple("ءبتثجحخدذرزسشصضطظعغفقكلمنهوي")
TURKISH_LETTERS = tuple("abcçdefgğhıijklmnoöprsştuüvyz")
READINGS = (
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
)
ROMAN = dict(zip(LETTERS, READINGS, strict=True))
ARABIC_READINGS = frozenset(READINGS)
ENGINE_VERSION = "3"


@dataclass(frozen=True)
class Pattern:
    id: str
    label: str
    arabic: str
    reading: str
    role: Role
    description: str

    def metadata(self) -> PatternMetadata:
        return {
            "id": self.id,
            "label": self.label,
            "arabic": self.arabic,
            "reading": self.reading,
            "role": self.role,
            "description": self.description,
        }


# Arabic templates keep long vowels distinct in Turkish-letter readings.
PATTERNS: tuple[Pattern, ...] = (
    Pattern(
        "I.agent",
        "İsm-i fail · I",
        "1َا2ِ3",
        "1â2i3",
        "agent",
        "Eylemi yapan kişi veya varlık için bir kalıp.",
    ),
    Pattern(
        "I.patient",
        "İsm-i meful · I",
        "مَ1ْ2ُو3",
        "ma12û3",
        "patient",
        "Eylemden etkilenen kişi veya varlık için bir kalıp.",
    ),
    Pattern(
        "I.fial",
        "Fiâl",
        "1ِ2َا3",
        "1i2â3",
        "theme",
        "İsim veya mastar kalıbı; kullanım ve anlam sözlükten öğrenilir.",
    ),
    Pattern(
        "I.masdar",
        "Fa‘l · mastar adayı",
        "1َ2ْ3",
        "1a23",
        "action",
        "I. biçimin mastarı tek bir kuralla belirlenmez; bu yalnızca bir adaydır.",
    ),
    Pattern(
        "I.place",
        "Mef‘al · yer adayı",
        "مَ1ْ2َ3",
        "ma12a3",
        "place",
        "Yer adı kalıplarından biri; doğru kalıp köke bağlıdır.",
    ),
    Pattern(
        "I.instrument",
        "Mif‘âl · araç adayı",
        "مِ1ْ2َا3",
        "mi12â3",
        "instrument",
        "Araç adlarında kullanılan kalıplardan biri.",
    ),
    Pattern(
        "I.quality",
        "Faîl · nitelik adayı",
        "1َ2ِي3",
        "1a2î3",
        "quality",
        "Nitelik bildirebilen bir kalıp; her kökte kullanıldığı varsayılmaz.",
    ),
    Pattern(
        "I.verb",
        "I. fiil biçimi",
        "1َ2َ3َ",
        "1a2a3a",
        "verbs",
        "Geçmiş zaman, üçüncü tekil eril şablonu. Orta ünlü sözlükseldir; a yalnızca adaydır.",
    ),
    Pattern(
        "II.verb",
        "II. fiil biçimi",
        "1َ2َّ3َ",
        "1a22a3a",
        "verbs",
        "Yoğunlaştırma veya yaptırma bildirebilir.",
    ),
    Pattern(
        "III.verb",
        "III. fiil biçimi",
        "1َا2َ3َ",
        "1â2a3a",
        "verbs",
        "Katılım veya karşılıklı ilişki bildirebilir.",
    ),
    Pattern("IV.verb", "IV. fiil biçimi", "أَ1ْ2َ3َ", "a12a3a", "verbs", "Yaptırma bildirebilir."),
    Pattern(
        "V.verb",
        "V. fiil biçimi",
        "تَ1َ2َّ3َ",
        "ta1a22a3a",
        "verbs",
        "II. biçimle ilişkili dönüşlü anlam bildirebilir.",
    ),
    Pattern(
        "VI.verb", "VI. fiil biçimi", "تَ1َا2َ3َ", "ta1â2a3a", "verbs", "Karşılıklılık bildirebilir."
    ),
    Pattern(
        "VII.verb",
        "VII. fiil biçimi",
        "اِنْ1َ2َ3َ",
        "in1a2a3a",
        "verbs",
        "Edilgenlik veya oluş bildirebilir.",
    ),
    Pattern(
        "VIII.verb",
        "VIII. fiil biçimi",
        "اِ1ْتَ2َ3َ",
        "i1ta2a3a",
        "verbs",
        "Dönüşlü veya edinimsel anlam bildirebilir; bazı ilk harflerde benzeşme gerekir.",
    ),
    Pattern(
        "IX.verb",
        "IX. fiil biçimi",
        "اِ1ْ2َ3َّ",
        "i12a33a",
        "verbs",
        "Özellikle renk ve bedensel özelliklerle sınırlı bir kalıp; her köke uygun değildir.",
    ),
    Pattern(
        "X.verb",
        "X. fiil biçimi",
        "اِسْتَ1ْ2َ3َ",
        "ista12a3a",
        "verbs",
        "İsteme, sayma veya edinme anlamı bildirebilir.",
    ),
)

# Productive nominal templates of derived verb forms, kept separate from roles.
_DERIVED_NOUNS = (
    ("II", "تَ1ْ2ِي3", "ta12î3", "مُ1َ2ِّ3", "mu1a22i3", "مُ1َ2َّ3", "mu1a22a3"),
    ("III", "مُ1َا2َ3َة", "mu1â2a3a", "مُ1َا2ِ3", "mu1â2i3", "مُ1َا2َ3", "mu1â2a3"),
    ("IV", "إِ1ْ2َا3", "i12â3", "مُ1ْ2ِ3", "mu12i3", "مُ1ْ2َ3", "mu12a3"),
    ("V", "تَ1َ2ُّ3", "ta1a22u3", "مُتَ1َ2ِّ3", "muta1a22i3", "مُتَ1َ2َّ3", "muta1a22a3"),
    ("VI", "تَ1َا2ُ3", "ta1â2u3", "مُتَ1َا2ِ3", "muta1â2i3", "مُتَ1َا2َ3", "muta1â2a3"),
    ("VII", "اِنْ1ِ2َا3", "in1i2â3", "مُنْ1َ2ِ3", "mun1a2i3", "مُنْ1َ2َ3", "mun1a2a3"),
    ("VIII", "اِ1ْتِ2َا3", "i1ti2â3", "مُ1ْتَ2ِ3", "mu1ta2i3", "مُ1ْتَ2َ3", "mu1ta2a3"),
    ("IX", "اِ1ْ2ِ3َا3", "i12i3â3", "مُ1ْ2َ3ّ", "mu12a33", "مُ1ْ2َ3ّ", "mu12a33"),
    ("X", "اِسْتِ1ْ2َا3", "isti12â3", "مُسْتَ1ْ2ِ3", "musta12i3", "مُسْتَ1ْ2َ3", "musta12a3"),
)

for form, action_ar, action_tr, agent_ar, agent_tr, patient_ar, patient_tr in _DERIVED_NOUNS:
    PATTERNS += (
        Pattern(
            f"{form}.masdar",
            f"{form}. biçim · mastar",
            action_ar,
            action_tr,
            "action",
            "Eylem adı adayı; kökteki varlığı ve özel anlamı doğrulanmamıştır.",
        ),
        Pattern(
            f"{form}.agent",
            f"{form}. biçim · ism-i fail",
            agent_ar,
            agent_tr,
            "agent",
            "Eylemi yapanı bildiren aday; gerçek kullanım sözlük doğrulaması gerektirir.",
        ),
    )
    # Form IX is normally intransitive: do not invent a passive participle.
    if form != "IX":
        PATTERNS += (
            Pattern(
                f"{form}.patient",
                f"{form}. biçim · ism-i meful",
                patient_ar,
                patient_tr,
                "patient",
                "Eylemden etkileneni bildiren aday; edilgen türetimin uygunluğu fiile bağlıdır.",
            ),
        )


def is_root(root: str) -> bool:
    return len(root) == 3 and all(letter in ROMAN for letter in root)


def is_experimental_root(root: str) -> bool:
    """Only literal Turkish triples without an Arabic transliteration counterpart."""
    return (
        len(root) == 3
        and all(letter in TURKISH_LETTERS for letter in root)
        and not all(letter in ARABIC_READINGS for letter in root)
    )


def reading_of(root: str) -> str:
    return "-".join(ROMAN[letter] for letter in root)


def root_id(root: str, inventory: Inventory = "arabic") -> str:
    alphabet = LETTERS if inventory == "arabic" else TURKISH_LETTERS
    if len(root) != 3 or any(letter not in alphabet for letter in root):
        raise ValueError(f"Unsupported {inventory} root: {root!r}")
    return "-".join(f"{alphabet.index(letter):02}" for letter in root)


def root_classes(root: str) -> list[RootClass]:
    classes: list[RootClass] = []
    if "ء" in root:
        classes.append("hamzated")
    weak_classes: tuple[RootClass, ...] = ("initial-weak", "hollow", "defective")
    for index, name in enumerate(weak_classes):
        if root[index] in "وي":
            classes.append(name)
    if root[1] == root[2]:
        classes.append("doubled")
    return classes


def form_key(arabic: str) -> str:
    """Unvocalized spelling, preserving gemination to distinguish II from IV.

    Nişanyan-backed spellings are often unvocalized. This is spelling equality,
    not evidence that two homographs have the same sense or derivational history.
    """
    result: list[str] = []
    for letter in unicodedata.normalize("NFC", arabic):
        if letter == "ّ" and result:
            result.append(result[-1])
        elif not unicodedata.category(letter).startswith("M") and letter not in "ـ -":
            result.append(letter)
    return "".join(result)


def instantiate(template: str, root: str, *, roman: bool = False) -> str:
    return re.sub(
        r"[123]",
        lambda match: ROMAN[root[int(match[0]) - 1]] if roman else root[int(match[0]) - 1],
        template,
    )


def generate(root: str, overridden: frozenset[str] = frozenset()) -> list[GeneratedRow]:
    """Generate the unfilled pattern slots of a validated Arabic root."""
    if not is_root(root):
        raise ValueError(f"Unsupported three-radical root: {root!r}")
    exceptional = bool(root_classes(root))
    rows: list[GeneratedRow] = []
    for index, pattern in enumerate(PATTERNS):
        arabic = instantiate(pattern.arabic, root)
        if pattern.id in overridden:
            continue
        raw = exceptional or (pattern.id.startswith("VIII.") and root[0] in "تثدذزصضطظ")
        rows.append((index, arabic, instantiate(pattern.reading, root, roman=True), raw))
    return rows


def generate_turkish(root: str) -> list[GeneratedRow]:
    """Literal Turkish-letter substitution; no Arabic identity or spelling is inferred."""
    root_id(root, "turkish")
    if not is_experimental_root(root):
        raise ValueError(f"An Arabic counterpart already exists for {root!r}")
    return [
        (index, None, instantiate(pattern.reading, root), False)
        for index, pattern in enumerate(PATTERNS)
    ]
