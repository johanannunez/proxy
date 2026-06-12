import { describe, expect, it } from "vitest";
import {
  coverageCategoryLabel,
  deriveCoverageGroups,
  type TrackedTemplate,
} from "../coverage-shared";

function template(overrides: Partial<TrackedTemplate>): TrackedTemplate {
  return {
    id: "t-1",
    source: "document_template",
    name: "Template",
    documentKey: null,
    tracked: true,
    category: null,
    ...overrides,
  };
}

describe("deriveCoverageGroups", () => {
  it("returns no groups when nothing is tracked", () => {
    expect(deriveCoverageGroups([])).toEqual([]);
    expect(
      deriveCoverageGroups([template({ tracked: false, category: "setup" })]),
    ).toEqual([]);
  });

  it("excludes untracked masters even when categorized", () => {
    const groups = deriveCoverageGroups([
      template({ id: "a", category: "setup" }),
      template({ id: "b", category: "setup", tracked: false }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].columns.map((c) => c.templateId)).toEqual(["a"]);
  });

  it("groups columns by category in first-seen order", () => {
    const groups = deriveCoverageGroups([
      template({ id: "a", category: "securedocs", documentKey: "w9" }),
      template({ id: "b", category: "setup" }),
      template({ id: "c", category: "securedocs" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["SecureDocs", "Setup"]);
    expect(groups[0].columns.map((c) => c.templateId)).toEqual(["a", "c"]);
    expect(groups[0].columns[0].documentKey).toBe("w9");
  });

  it("falls back to a single graceful Tracked group when categories are null", () => {
    const groups = deriveCoverageGroups([
      template({ id: "a", category: null }),
      template({ id: "b", category: "" }),
      template({ id: "c", category: "   " }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Tracked");
    expect(groups[0].columns).toHaveLength(3);
  });

  it("renders the uncategorized group last", () => {
    const groups = deriveCoverageGroups([
      template({ id: "a", category: null }),
      template({ id: "b", category: "setup" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Setup", "Tracked"]);
  });

  it("normalizes category casing into one group", () => {
    const groups = deriveCoverageGroups([
      template({ id: "a", category: "Setup" }),
      template({ id: "b", category: "setup" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].columns).toHaveLength(2);
  });
});

describe("coverageCategoryLabel", () => {
  it("title-cases multi-word categories", () => {
    expect(coverageCategoryLabel("owner_onboarding")).toBe("Owner Onboarding");
    expect(coverageCategoryLabel("tax docs")).toBe("Tax Docs");
  });

  it("uses the SecureDocs override", () => {
    expect(coverageCategoryLabel("securedocs")).toBe("SecureDocs");
  });

  it("labels empty categories Tracked", () => {
    expect(coverageCategoryLabel(null)).toBe("Tracked");
    expect(coverageCategoryLabel("")).toBe("Tracked");
  });
});
