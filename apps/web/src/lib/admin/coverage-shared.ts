/**
 * Coverage view — client-safe types and the column derivation rule
 * (2026-06-12 IA amendment). Matrix columns derive ONLY from masters an
 * admin marked as tracked; column groups derive from each master's
 * category. Proxy's SecureDocs/Setup layout is org configuration written by
 * the tracking migration backfill, not a hardcode.
 */

export type TrackedTemplateSource = "document_template" | "form";

export type TrackedTemplate = {
  id: string;
  source: TrackedTemplateSource;
  name: string;
  /** Spine catalog key, when the master maps to one (signature templates). */
  documentKey: string | null;
  tracked: boolean;
  category: string | null;
};

export type CoverageColumn = {
  templateId: string;
  source: TrackedTemplateSource;
  name: string;
  documentKey: string | null;
};

export type CoverageColumnGroup = {
  /** Raw category value ("" for the uncategorized group). */
  category: string;
  label: string;
  columns: CoverageColumn[];
};

/** Known category spellings that plain title-casing would get wrong. */
const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  securedocs: "SecureDocs",
};

export function coverageCategoryLabel(category: string | null): string {
  if (!category || category.trim() === "") return "Tracked";
  const normalized = category.trim().toLowerCase();
  const override = CATEGORY_LABEL_OVERRIDES[normalized];
  if (override) return override;
  return normalized
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Derive coverage column groups from masters. Only tracked masters become
 * columns. Groups follow first-seen category order; the uncategorized group
 * ("Tracked") always renders last. With no categories at all, everything
 * lands in one graceful "Tracked" group.
 */
export function deriveCoverageGroups(templates: TrackedTemplate[]): CoverageColumnGroup[] {
  const groups = new Map<string, CoverageColumnGroup>();

  for (const template of templates) {
    if (!template.tracked) continue;
    const category = template.category?.trim().toLowerCase() ?? "";
    let group = groups.get(category);
    if (!group) {
      group = {
        category,
        label: coverageCategoryLabel(template.category),
        columns: [],
      };
      groups.set(category, group);
    }
    group.columns.push({
      templateId: template.id,
      source: template.source,
      name: template.name,
      documentKey: template.documentKey,
    });
  }

  const ordered = [...groups.values()];
  const uncategorizedIndex = ordered.findIndex((g) => g.category === "");
  if (uncategorizedIndex >= 0) {
    const [uncategorized] = ordered.splice(uncategorizedIndex, 1);
    ordered.push(uncategorized);
  }
  return ordered;
}
