"""Shared grouping, stable pattern identities, and conservative lexical classification."""

import hashlib
import re

from .model import ClassifiedEntry, DictionaryEntry, GroupMetadata, PatternMetadata
from .morphology import PATTERNS, Pattern, form_key, instantiate

GROUPS: tuple[GroupMetadata, ...] = (
    {
        "role": "agent",
        "label": "Yapan",
        "description": "Yapan kişi veya varlık; ism-i fail ve ilgili isimler.",
    },
    {
        "role": "patient",
        "label": "Etkilenen",
        "description": "Eylemden etkilenen kişi veya varlık; ism-i meful ve ilgili isimler.",
    },
    {
        "role": "action",
        "label": "Eylem / süreç",
        "description": "Eylem ve süreç adları; mastarlar.",
    },
    {
        "role": "place",
        "label": "Yer",
        "description": "Yer bildiren kalıplar ve kaynaklı yer adları.",
    },
    {
        "role": "instrument",
        "label": "Araç",
        "description": "Araç bildiren kalıplar ve kaynaklı araç adları.",
    },
    {
        "role": "quality",
        "label": "Nitelik / durum",
        "description": "Nitelik veya durum bildiren isim ve sıfatlar.",
    },
    {
        "role": "theme",
        "label": "Diğer isimler",
        "description": "Tek bir anlamsal rolü garanti etmeyen diğer isim kalıpları.",
    },
    {"role": "verbs", "label": "Fiiller", "description": "I–X fiil biçimleri, sabit sırayla."},
)


def identify_pattern(entry: DictionaryEntry) -> Pattern | None:
    """Bind only a precise editorial ID or an unambiguous role/spelling match.

    Unvocalized spelling alone is insufficient: e.g. ilim must not suppress
    a verb, and its declared fi'l pattern must not suppress the fa'l candidate.
    Unresolved lexical patterns keep separate stable IDs instead of being forced
    into one of the 43 generated slots. Explicit IDs support later curation.
    """
    explicit = entry.get("formId")
    if explicit is not None:
        match = next((pattern for pattern in PATTERNS if pattern.id == explicit), None)
        if match is None or match.role != entry["role"]:
            raise ValueError(f"Invalid explicit pattern ID for {entry['word']}: {explicit}")
        return match
    label = entry["pattern"].casefold()
    if any(word in label for word in ("çoğul", "dişil", "adlaş", "farsça")):
        return None
    matches = [
        pattern
        for pattern in PATTERNS
        if pattern.role == entry["role"]
        and form_key(instantiate(pattern.arabic, entry["root"])) == form_key(entry["arabic"])
    ]
    # The unvocalized fa'l candidate is particularly ambiguous; only its explicit
    # dictionary label can justify replacing it. Other mastars remain lexical.
    matches = [
        pattern for pattern in matches if pattern.id != "I.masdar" or label.startswith("fal ·")
    ]
    # A declared derived form also prevents spelling coincidences across forms.
    declared = re.search(r"\b(VIII|VII|VI|IV|IX|III|II|V|X|I)\. biçim", entry["pattern"])
    if declared:
        matches = [pattern for pattern in matches if pattern.id.startswith(declared[1] + ".")]
    return matches[0] if len(matches) == 1 else None


def lexical_pattern_id(entry: DictionaryEntry) -> str:
    digest = hashlib.sha256(entry["pattern"].encode()).hexdigest()[:12]
    return f"lexical.{entry['role']}.{digest}"


def classify(entry: DictionaryEntry) -> ClassifiedEntry:
    pattern = identify_pattern(entry)
    return {**entry, "patternId": pattern.id if pattern else lexical_pattern_id(entry)}


def lexical_patterns(entries: list[DictionaryEntry]) -> list[PatternMetadata]:
    patterns: dict[str, PatternMetadata] = {}
    for entry in entries:
        if identify_pattern(entry) is not None:
            continue
        identifier = lexical_pattern_id(entry)
        patterns[identifier] = {
            "id": identifier,
            "label": entry["pattern"],
            "role": entry["role"],
            "arabic": "—",
            "reading": "—",
            "description": "Kaynaklı kaydın kalıbı; varsayımsal üretim kapsamına alınmamıştır.",
        }
    # This global order is independent of which root happens to be displayed.
    return sorted(patterns.values(), key=lambda pattern: (pattern["label"], pattern["id"]))
