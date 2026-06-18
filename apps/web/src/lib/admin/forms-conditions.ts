/**
 * Conditional field visibility engine for the forms builder.
 *
 * Pure and client-safe (no server imports) so the builder preview, the
 * public form renderer, the submit server action, and tests all share the
 * exact same logic. Re-exported from forms.ts for server-side callers.
 */

import type {
  FieldCondition,
  FieldConditionGroup,
  FormField,
} from "./forms-types";

/** Hard cap on condition rows per field in the builder UI. */
export const MAX_FIELD_CONDITIONS = 5;

function isEmptyValue(raw: unknown): boolean {
  if (raw === undefined || raw === null) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  return String(raw) === "";
}

function evaluateCondition(
  condition: FieldCondition,
  values: Record<string, unknown>,
): boolean {
  const raw = values[condition.field];
  const expected = condition.value ?? "";
  // Multiple-choice answers are arrays: match against whole options so
  // "contains Pool" never matches a selection of ["Poolhouse"].
  const list = Array.isArray(raw) ? raw.map(String) : null;
  const text = raw === undefined || raw === null ? "" : String(raw);

  switch (condition.operator) {
    case "equals":
      return list ? list.includes(expected) : text === expected;
    case "not_equals":
      return list ? !list.includes(expected) : text !== expected;
    case "contains":
      return list ? list.includes(expected) : text.includes(expected);
    case "not_contains":
      return list ? !list.includes(expected) : !text.includes(expected);
    case "is_empty":
      return isEmptyValue(raw);
    case "is_not_empty":
      return !isEmptyValue(raw);
    default:
      return true;
  }
}

/**
 * Returns true when the field should be visible for the given values.
 * A missing group or an empty condition list always shows the field.
 */
export function evaluateConditions(
  group: FieldConditionGroup | undefined,
  values: Record<string, unknown>,
): boolean {
  if (!group || group.conditions.length === 0) return true;
  const results = group.conditions.map((c) => evaluateCondition(c, values));
  return group.combinator === "and"
    ? results.every(Boolean)
    : results.some(Boolean);
}

/**
 * Resolves which fields are visible, including cascades: when a controller
 * field is hidden, its (possibly stale) value is masked so every dependent
 * re-evaluates as if the controller were never answered. Conditions that
 * reference fields no longer in the schema are ignored rather than hiding
 * the field forever.
 *
 * Runs to a fixpoint; visibility only ever shrinks per pass, so the loop is
 * bounded by the field count and cannot oscillate.
 */
export function getVisibleFieldIds(
  fields: FormField[],
  values: Record<string, unknown>,
): Set<string> {
  const fieldIds = new Set(fields.map((f) => f.id));

  function liveGroup(
    group: FieldConditionGroup | undefined,
  ): FieldConditionGroup | undefined {
    if (!group) return undefined;
    const conditions = group.conditions.filter((c) => fieldIds.has(c.field));
    return { combinator: group.combinator, conditions };
  }

  // Start from "nothing answered" and re-derive visibility against only the
  // values of currently visible fields, until the set stops changing.
  let visible = new Set<string>();
  for (let pass = 0; pass <= fields.length; pass += 1) {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (visible.has(key)) masked[key] = value;
    }
    const next = new Set<string>();
    for (const f of fields) {
      if (evaluateConditions(liveGroup(f.conditions), masked)) {
        next.add(f.id);
      }
    }
    const stable =
      next.size === visible.size && [...next].every((id) => visible.has(id));
    if (stable) return next;
    visible = next;
  }
  return visible;
}

/**
 * Drops values belonging to hidden fields (and unknown keys) so they never
 * reach the submission payload. Used client-side at submit and server-side
 * as the trust boundary in the submit action.
 */
export function stripHiddenValues(
  fields: FormField[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const visible = getVisibleFieldIds(fields, values);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (visible.has(key)) result[key] = value;
  }
  return result;
}
