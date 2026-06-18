import { describe, it, expect, vi } from "vitest";

/**
 * Workstream A5: conditional field logic.
 *
 * evaluateConditions lives in the client-safe forms-conditions module and is
 * re-exported from forms.ts (server-only) so both sides share one engine.
 * The matrix below covers every operator, both combinators, missing values,
 * array (multiple choice) values, and hidden-field cascades.
 */

vi.mock("server-only", () => ({}));

import {
  evaluateConditions,
  getVisibleFieldIds,
  stripHiddenValues,
  MAX_FIELD_CONDITIONS,
} from "../forms";
import type { FieldConditionGroup, FormField } from "../forms-types";

function and(
  conditions: FieldConditionGroup["conditions"],
): FieldConditionGroup {
  return { combinator: "and", conditions };
}

function or(
  conditions: FieldConditionGroup["conditions"],
): FieldConditionGroup {
  return { combinator: "or", conditions };
}

describe("evaluateConditions", () => {
  it("shows field when no conditions", () => {
    expect(evaluateConditions(undefined, {})).toBe(true);
  });

  it("shows field when condition group is empty", () => {
    expect(evaluateConditions(and([]), { f1: "anything" })).toBe(true);
  });

  // ── equals ──────────────────────────────────────────────────────────────
  it("shows field when equals condition passes", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "equals", value: "yes" }]),
        { f1: "yes" },
      ),
    ).toBe(true);
  });

  it("hides field when equals condition fails", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "equals", value: "yes" }]),
        { f1: "no" },
      ),
    ).toBe(false);
  });

  it("hides field when equals target value is missing", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "equals", value: "yes" }]),
        {},
      ),
    ).toBe(false);
  });

  it("coerces non-string values for equals", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "equals", value: "5" }]),
        { f1: 5 },
      ),
    ).toBe(true);
  });

  // ── not_equals ──────────────────────────────────────────────────────────
  it("shows field when not_equals condition passes", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "not_equals", value: "yes" }]),
        { f1: "no" },
      ),
    ).toBe(true);
  });

  it("hides field when not_equals condition fails", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "not_equals", value: "yes" }]),
        { f1: "yes" },
      ),
    ).toBe(false);
  });

  it("treats missing value as not equal", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "not_equals", value: "yes" }]),
        {},
      ),
    ).toBe(true);
  });

  // ── contains ────────────────────────────────────────────────────────────
  it("shows field when contains condition passes", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "contains", value: "world" }]),
        { f1: "hello world" },
      ),
    ).toBe(true);
  });

  it("hides field when contains condition fails", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "contains", value: "mars" }]),
        { f1: "hello world" },
      ),
    ).toBe(false);
  });

  it("hides field when contains target is missing", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "contains", value: "x" }]),
        {},
      ),
    ).toBe(false);
  });

  it("contains with empty condition value passes for any present value", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "contains" }]), {
        f1: "anything",
      }),
    ).toBe(true);
  });

  // ── not_contains ────────────────────────────────────────────────────────
  it("shows field when not_contains condition passes", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "not_contains", value: "mars" }]),
        { f1: "hello world" },
      ),
    ).toBe(true);
  });

  it("hides field when not_contains condition fails", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "not_contains", value: "world" }]),
        { f1: "hello world" },
      ),
    ).toBe(false);
  });

  // ── is_empty / is_not_empty ─────────────────────────────────────────────
  it("is_empty passes when value is missing", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_empty" }]), {}),
    ).toBe(true);
  });

  it("is_empty passes when value is empty string", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_empty" }]), {
        f1: "",
      }),
    ).toBe(true);
  });

  it("is_empty passes when value is null", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_empty" }]), {
        f1: null,
      }),
    ).toBe(true);
  });

  it("is_empty fails when value is present", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_empty" }]), {
        f1: "x",
      }),
    ).toBe(false);
  });

  it("is_not_empty passes when value is present", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_not_empty" }]), {
        f1: "x",
      }),
    ).toBe(true);
  });

  it("is_not_empty fails when value is missing", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_not_empty" }]), {}),
    ).toBe(false);
  });

  // ── array values (multiple choice) ──────────────────────────────────────
  it("equals matches any selected option in an array value", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "equals", value: "Pool" }]),
        { f1: ["Gym", "Pool"] },
      ),
    ).toBe(true);
  });

  it("contains matches whole options only in an array value", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "contains", value: "Poo" }]),
        { f1: ["Gym", "Pool"] },
      ),
    ).toBe(false);
  });

  it("contains matches a selected option in an array value", () => {
    expect(
      evaluateConditions(
        and([{ field: "f1", operator: "contains", value: "Gym" }]),
        { f1: ["Gym", "Pool"] },
      ),
    ).toBe(true);
  });

  it("is_empty passes for an empty array value", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_empty" }]), {
        f1: [],
      }),
    ).toBe(true);
  });

  it("is_not_empty passes for a non-empty array value", () => {
    expect(
      evaluateConditions(and([{ field: "f1", operator: "is_not_empty" }]), {
        f1: ["a"],
      }),
    ).toBe(true);
  });

  // ── combinators ─────────────────────────────────────────────────────────
  it("handles or combinator", () => {
    expect(
      evaluateConditions(
        or([
          { field: "f1", operator: "equals", value: "a" },
          { field: "f1", operator: "equals", value: "b" },
        ]),
        { f1: "b" },
      ),
    ).toBe(true);
  });

  it("or fails when no condition passes", () => {
    expect(
      evaluateConditions(
        or([
          { field: "f1", operator: "equals", value: "a" },
          { field: "f2", operator: "equals", value: "b" },
        ]),
        { f1: "x", f2: "y" },
      ),
    ).toBe(false);
  });

  it("and requires every condition to pass", () => {
    expect(
      evaluateConditions(
        and([
          { field: "f1", operator: "equals", value: "a" },
          { field: "f2", operator: "is_not_empty" },
        ]),
        { f1: "a", f2: "" },
      ),
    ).toBe(false);
  });

  it("and passes when every condition passes", () => {
    expect(
      evaluateConditions(
        and([
          { field: "f1", operator: "equals", value: "a" },
          { field: "f2", operator: "is_not_empty" },
        ]),
        { f1: "a", f2: "filled" },
      ),
    ).toBe(true);
  });

  it("conditions across different fields evaluate independently", () => {
    expect(
      evaluateConditions(
        or([
          { field: "f1", operator: "contains", value: "needle" },
          { field: "f2", operator: "is_empty" },
        ]),
        { f1: "haystack", f2: "" },
      ),
    ).toBe(true);
  });
});

// ── Visibility resolution with cascades ─────────────────────────────────────

function field(id: string, conditions?: FieldConditionGroup): FormField {
  return { id, type: "short_text", label: id, conditions };
}

describe("getVisibleFieldIds", () => {
  it("returns every field when none have conditions", () => {
    const fields = [field("a"), field("b")];
    expect(getVisibleFieldIds(fields, {})).toEqual(new Set(["a", "b"]));
  });

  it("hides a field whose conditions fail", () => {
    const fields = [
      field("a"),
      field("b", and([{ field: "a", operator: "equals", value: "yes" }])),
    ];
    expect(getVisibleFieldIds(fields, { a: "no" })).toEqual(new Set(["a"]));
  });

  it("shows a field whose conditions pass", () => {
    const fields = [
      field("a"),
      field("b", and([{ field: "a", operator: "equals", value: "yes" }])),
    ];
    expect(getVisibleFieldIds(fields, { a: "yes" })).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("cascades: hiding a controller hides its dependents even with stale values", () => {
    // c depends on b, b depends on a. a flips to "no", but b still holds a
    // stale value "yes" from before it was hidden. b hides, so c must hide too.
    const fields = [
      field("a"),
      field("b", and([{ field: "a", operator: "equals", value: "yes" }])),
      field("c", and([{ field: "b", operator: "equals", value: "yes" }])),
    ];
    expect(getVisibleFieldIds(fields, { a: "no", b: "yes" })).toEqual(
      new Set(["a"]),
    );
  });

  it("cascades through is_empty: a hidden field counts as empty", () => {
    const fields = [
      field("a"),
      field("b", and([{ field: "a", operator: "equals", value: "yes" }])),
      field("c", and([{ field: "b", operator: "is_empty" }])),
    ];
    // b is hidden (a !== yes) so even though b holds "stale", c sees empty.
    expect(getVisibleFieldIds(fields, { a: "no", b: "stale" })).toEqual(
      new Set(["a", "c"]),
    );
  });

  it("ignores conditions that reference fields no longer in the form", () => {
    const fields = [
      field("a"),
      field("b", and([{ field: "deleted", operator: "equals", value: "x" }])),
    ];
    expect(getVisibleFieldIds(fields, {})).toEqual(new Set(["a", "b"]));
  });

  it("keeps a mixed group working after one referenced field is deleted", () => {
    const fields = [
      field("a"),
      field(
        "b",
        and([
          { field: "deleted", operator: "equals", value: "x" },
          { field: "a", operator: "equals", value: "yes" },
        ]),
      ),
    ];
    expect(getVisibleFieldIds(fields, { a: "no" })).toEqual(new Set(["a"]));
    expect(getVisibleFieldIds(fields, { a: "yes" })).toEqual(
      new Set(["a", "b"]),
    );
  });

  it("resolves mutually dependent fields deterministically (both hide)", () => {
    // a shows only if b is filled; b shows only if a is filled. Neither is
    // filled, so both hide and stay hidden — no oscillation.
    const fields = [
      field("a", and([{ field: "b", operator: "is_not_empty" }])),
      field("b", and([{ field: "a", operator: "is_not_empty" }])),
    ];
    expect(getVisibleFieldIds(fields, { a: "x", b: "y" })).toEqual(new Set());
  });
});

describe("stripHiddenValues", () => {
  it("keeps values for visible fields", () => {
    const fields = [
      field("a"),
      field("b", and([{ field: "a", operator: "equals", value: "yes" }])),
    ];
    expect(stripHiddenValues(fields, { a: "yes", b: "kept" })).toEqual({
      a: "yes",
      b: "kept",
    });
  });

  it("drops values for hidden fields", () => {
    const fields = [
      field("a"),
      field("b", and([{ field: "a", operator: "equals", value: "yes" }])),
    ];
    expect(stripHiddenValues(fields, { a: "no", b: "stale" })).toEqual({
      a: "no",
    });
  });

  it("drops values cascaded from hidden controllers", () => {
    const fields = [
      field("a"),
      field("b", and([{ field: "a", operator: "equals", value: "yes" }])),
      field("c", and([{ field: "b", operator: "is_not_empty" }])),
    ];
    expect(
      stripHiddenValues(fields, { a: "no", b: "stale", c: "stale-too" }),
    ).toEqual({ a: "no" });
  });

  it("drops values whose keys do not match any field in the schema", () => {
    const fields = [field("a")];
    expect(stripHiddenValues(fields, { a: "x", ghost: "y" })).toEqual({
      a: "x",
    });
  });
});

describe("MAX_FIELD_CONDITIONS", () => {
  it("caps condition rows at five", () => {
    expect(MAX_FIELD_CONDITIONS).toBe(5);
  });
});
