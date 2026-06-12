"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type {
  ConditionOperator,
  FieldCondition,
  FieldConditionGroup,
  FormField,
} from "@/lib/admin/forms-types";
import {
  CONDITION_OPERATOR_LABELS,
  INPUT_FIELD_TYPES,
} from "@/lib/admin/forms-types";
import { MAX_FIELD_CONDITIONS } from "@/lib/admin/forms-conditions";
import styles from "./ConditionEditor.module.css";

type Props = {
  field: FormField;
  allFields: FormField[];
  onChange: (conditions: FieldConditionGroup | undefined) => void;
};

// Object.keys widens to string[]; the record is keyed by ConditionOperator,
// so narrowing back is safe.
const OPERATOR_OPTIONS = (
  Object.keys(CONDITION_OPERATOR_LABELS) as ConditionOperator[]
).map((op) => ({ value: op, label: CONDITION_OPERATOR_LABELS[op] }));

const NEEDS_VALUE: Record<ConditionOperator, boolean> = {
  equals: true,
  not_equals: true,
  contains: true,
  not_contains: true,
  is_empty: false,
  is_not_empty: false,
};

function fieldOptionLabel(f: FormField, index: number): string {
  return f.label.trim() || `Field ${index + 1}`;
}

export function ConditionEditor({ field, allFields, onChange }: Props) {
  const group = field.conditions;
  const isConditional = group !== undefined;

  const eligibleFields = allFields.filter(
    (f) => f.id !== field.id && INPUT_FIELD_TYPES.includes(f.type),
  );
  const fieldOptions = eligibleFields.map((f) => ({
    value: f.id,
    label: fieldOptionLabel(f, allFields.indexOf(f)),
  }));

  function emptyCondition(): FieldCondition {
    return { field: eligibleFields[0]?.id ?? "", operator: "equals", value: "" };
  }

  function setConditional(conditional: boolean) {
    if (conditional === isConditional) return;
    onChange(
      conditional
        ? { combinator: "and", conditions: [emptyCondition()] }
        : undefined,
    );
  }

  function updateCondition(index: number, patch: Partial<FieldCondition>) {
    if (!group) return;
    const conditions = group.conditions.map((c, i) => {
      if (i !== index) return c;
      const next = { ...c, ...patch };
      // Source field changed: a previously picked option value no longer
      // applies, so reset it rather than comparing against a stale option.
      if (patch.field !== undefined && patch.field !== c.field) next.value = "";
      if (patch.operator !== undefined && !NEEDS_VALUE[next.operator]) {
        next.value = undefined;
      }
      return next;
    });
    onChange({ ...group, conditions });
  }

  function addCondition() {
    if (!group || group.conditions.length >= MAX_FIELD_CONDITIONS) return;
    onChange({ ...group, conditions: [...group.conditions, emptyCondition()] });
  }

  function removeCondition(index: number) {
    if (!group) return;
    const conditions = group.conditions.filter((_, i) => i !== index);
    onChange(
      conditions.length === 0 ? undefined : { ...group, conditions },
    );
  }

  function setCombinator(combinator: "and" | "or") {
    if (!group || group.combinator === combinator) return;
    onChange({ ...group, combinator });
  }

  function valueEditor(condition: FieldCondition, index: number) {
    if (!NEEDS_VALUE[condition.operator]) return null;
    const source = eligibleFields.find((f) => f.id === condition.field);
    const sourceOptions = source?.options ?? [];
    const isChoice =
      source !== undefined &&
      (source.type === "single_choice" ||
        source.type === "multiple_choice" ||
        source.type === "dropdown") &&
      sourceOptions.length > 0;

    if (isChoice) {
      return (
        <CustomSelect
          value={condition.value ?? ""}
          options={sourceOptions.map((o) => ({ value: o, label: o }))}
          onChange={(val) => updateCondition(index, { value: val })}
          placeholder="Choose a value"
        />
      );
    }
    return (
      <input
        className={styles.valueInput}
        value={condition.value ?? ""}
        onChange={(e) => updateCondition(index, { value: e.target.value })}
        placeholder="Enter a value"
        aria-label="Condition value"
      />
    );
  }

  return (
    <div className={styles.root}>
      <span className={styles.sectionLabel}>Show if</span>

      <div className={styles.modeToggle} role="group" aria-label="Field visibility">
        <button
          type="button"
          className={`${styles.modeBtn} ${!isConditional ? styles.modeBtnActive : ""}`}
          aria-pressed={!isConditional}
          onClick={() => setConditional(false)}
        >
          Always show
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${isConditional ? styles.modeBtnActive : ""}`}
          aria-pressed={isConditional}
          onClick={() => setConditional(true)}
          disabled={eligibleFields.length === 0}
        >
          Show conditionally
        </button>
      </div>

      {eligibleFields.length === 0 && (
        <p className={styles.hint}>
          Add another input field to this form to set up conditional visibility.
        </p>
      )}

      {isConditional && group && (
        <div className={styles.ruleList}>
          {group.conditions.map((condition, index) => (
            <div key={index}>
              {index > 0 && (
                <div
                  className={styles.combinatorRow}
                  role="group"
                  aria-label="Combine conditions with"
                >
                  <button
                    type="button"
                    className={`${styles.combinatorBtn} ${group.combinator === "and" ? styles.combinatorBtnActive : ""}`}
                    aria-pressed={group.combinator === "and"}
                    onClick={() => setCombinator("and")}
                  >
                    AND
                  </button>
                  <button
                    type="button"
                    className={`${styles.combinatorBtn} ${group.combinator === "or" ? styles.combinatorBtnActive : ""}`}
                    aria-pressed={group.combinator === "or"}
                    onClick={() => setCombinator("or")}
                  >
                    OR
                  </button>
                </div>
              )}
              <div className={styles.ruleCard}>
                <div className={styles.ruleHeader}>
                  <span className={styles.ruleIndex}>Condition {index + 1}</span>
                  <button
                    type="button"
                    className={styles.ruleRemoveBtn}
                    onClick={() => removeCondition(index)}
                    aria-label={`Remove condition ${index + 1}`}
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                </div>
                <CustomSelect
                  value={condition.field}
                  options={fieldOptions}
                  onChange={(val) => updateCondition(index, { field: val })}
                  placeholder="Choose a field"
                />
                <CustomSelect
                  value={condition.operator}
                  options={OPERATOR_OPTIONS}
                  onChange={(val) =>
                    updateCondition(index, {
                      // Options are built from CONDITION_OPERATOR_LABELS, so
                      // the select can only emit a ConditionOperator.
                      operator: val as ConditionOperator,
                    })
                  }
                />
                {valueEditor(condition, index)}
              </div>
            </div>
          ))}

          <button
            type="button"
            className={styles.addRuleBtn}
            onClick={addCondition}
            disabled={group.conditions.length >= MAX_FIELD_CONDITIONS}
          >
            <Plus size={12} weight="bold" />
            Add condition
          </button>
          {group.conditions.length >= MAX_FIELD_CONDITIONS && (
            <p className={styles.hint}>Up to {MAX_FIELD_CONDITIONS} conditions per field.</p>
          )}
        </div>
      )}
    </div>
  );
}
