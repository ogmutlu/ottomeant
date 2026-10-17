/** Pure domain projection: one stable pattern order, independent of evidence. */
import type { Form, FormGroup, Manifest, RootFamily } from "./model.js";

export function groupFamily(
  family: Pick<RootFamily, "dictionary" | "generated">,
  manifest: Manifest,
  includeGenerated = true,
): readonly FormGroup[] {
  const byPattern = new Map<string, Form[]>();
  for (const entry of family.dictionary) {
    const forms = byPattern.get(entry.patternId) ?? [];
    forms.push(entry);
    byPattern.set(entry.patternId, forms);
  }
  if (includeGenerated) {
    for (const form of family.generated) {
      // Evidence always wins, even if a malformed caller supplied both variants.
      if (!byPattern.has(form.pattern.id))
        byPattern.set(form.pattern.id, [form]);
    }
  }
  const patterns = [...manifest.patterns, ...manifest.lexicalPatterns];
  return manifest.groups.map((group) => ({
    ...group,
    slots: patterns
      .filter(
        (pattern) => pattern.role === group.role && byPattern.has(pattern.id),
      )
      .map((pattern) => ({ pattern, forms: byPattern.get(pattern.id) ?? [] })),
  }));
}
