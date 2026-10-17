export function familyView(family) {
    if ("arabicRoots" in family)
        return family;
    return {
        inventory: family.inventory,
        reading: family.root.reading,
        meaning: family.root.meaning,
        arabicRoots: family.inventory === "arabic" ? [family.root] : [],
        dictionary: family.dictionary,
        generated: family.generated.map((form) => ({
            ...form,
            spellings: form.arabic === null
                ? []
                : [
                    {
                        root: family.root.key,
                        arabic: form.arabic,
                        surface: form.surface,
                    },
                ],
        })),
    };
}
/** Arabic spelling and raw-template flags do not change a Turkish reading.
 * We retain both per spelling instead of treating either as an arbitrary winner.
 */
function readingSignature(family) {
    return JSON.stringify(family.generated
        .map((form) => [form.pattern.id, form.reading])
        .sort(([first], [second]) => first.localeCompare(second)));
}
export function mergeHypotheticalFamilies(families) {
    const [first] = families;
    if (!first)
        throw new Error("Cannot merge an empty root collection");
    const signature = readingSignature(first);
    if (families.some((family) => family.inventory !== "arabic" ||
        family.dictionary.length !== 0 ||
        family.root.reading !== first.root.reading ||
        readingSignature(family) !== signature)) {
        throw new Error("Only identical, unsourced Turkish readings can be merged");
    }
    const roots = new Set(families.map((family) => family.root.key));
    if (roots.size !== families.length)
        throw new Error("Repeated root in hypothetical alternatives");
    const variants = families.map((family) => ({
        family,
        forms: new Map(family.generated.map((form) => [form.pattern.id, form])),
    }));
    const generated = first.generated.map((form) => {
        const spellings = variants.map(({ family, forms }) => {
            const variant = forms.get(form.pattern.id);
            if (!variant?.arabic)
                throw new Error("Missing Arabic spelling in hypothetical root");
            return {
                root: family.root.key,
                arabic: variant.arabic,
                surface: variant.surface,
            };
        });
        return {
            ...form,
            arabic: families.length === 1 ? form.arabic : null,
            spellings,
            surface: spellings.some((spelling) => spelling.surface === "raw-template")
                ? "raw-template"
                : "regular-template",
        };
    });
    return {
        inventory: "arabic",
        reading: first.root.reading,
        meaning: first.root.meaning,
        arabicRoots: families.map((family) => family.root),
        dictionary: [],
        generated,
    };
}
/** Data failures propagate: a partial load must never look like a complete merge. */
export async function loadEquivalentFamilies(candidates, load) {
    if (candidates.some((candidate) => candidate.known))
        return { kind: "ambiguous", candidates };
    const families = await Promise.all(candidates.map(load));
    const [first] = families;
    if (!first)
        throw new Error("No hypothetical roots supplied");
    const sameReading = families.every((family) => family.inventory === "arabic" &&
        family.dictionary.length === 0 &&
        family.root.reading === first.root.reading &&
        readingSignature(family) === readingSignature(first));
    if (sameReading)
        return { kind: "ready", view: mergeHypotheticalFamilies(families) };
    const readingsByPattern = new Map();
    for (const family of families)
        for (const form of family.generated) {
            const readings = readingsByPattern.get(form.pattern.id) ?? new Set();
            readings.add(form.reading);
            readingsByPattern.set(form.pattern.id, readings);
        }
    // Keep genuinely different outputs distinguishable if the generator gains
    // root-specific readings or new lexical data in a later build.
    return {
        kind: "ambiguous",
        candidates: candidates.map((candidate, index) => {
            const family = families[index];
            if (!family)
                throw new Error("Missing hypothetical root data");
            return {
                ...candidate,
                sampleForms: family.dictionary.length
                    ? family.dictionary.map((entry) => entry.word)
                    : family.generated
                        .filter((form) => (readingsByPattern.get(form.pattern.id)?.size ?? 0) > 1)
                        .slice(0, 4)
                        .map((form) => form.reading),
            };
        }),
    };
}
