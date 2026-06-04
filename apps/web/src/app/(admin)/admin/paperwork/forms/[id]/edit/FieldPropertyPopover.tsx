"use client";

import { useEffect, useRef } from "react";
import { X, Plus, Trash } from "@phosphor-icons/react";
import type { FormField } from "@/lib/admin/forms-types";
import { FIELD_TYPE_LABELS } from "@/lib/admin/forms-types";
import styles from "./FieldPropertyPopover.module.css";

type Props = {
  field: FormField;
  onUpdate: (patch: Partial<FormField>) => void;
  onClose: () => void;
};

export function FieldPropertyPopover({ field, onUpdate, onClose }: Props) {
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    labelInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const hasOptions =
    field.type === "single_choice" ||
    field.type === "multiple_choice" ||
    field.type === "dropdown";

  const hasPlaceholder =
    field.type === "short_text" ||
    field.type === "long_text" ||
    field.type === "number" ||
    field.type === "email" ||
    field.type === "phone" ||
    field.type === "dropdown";

  const isLayoutType =
    field.type === "divider" ||
    field.type === "section_header" ||
    field.type === "description";

  function addOption() {
    const opts = [...(field.options ?? [])];
    opts.push(`Option ${opts.length + 1}`);
    onUpdate({ options: opts });
  }

  function removeOption(i: number) {
    const opts = (field.options ?? []).filter((_, idx) => idx !== i);
    onUpdate({ options: opts });
  }

  function updateOption(i: number, val: string) {
    const opts = [...(field.options ?? [])];
    opts[i] = val;
    onUpdate({ options: opts });
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.typeLabel}>{FIELD_TYPE_LABELS[field.type]}</span>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={14} weight="bold" />
        </button>
      </div>

      <div className={styles.body}>
        {/* Label */}
        {!isLayoutType ? (
          <div className={styles.field}>
            <label className={styles.label}>Label</label>
            <input
              ref={labelInputRef}
              className={styles.input}
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Enter field label"
            />
          </div>
        ) : (
          <div className={styles.field}>
            <label className={styles.label}>{field.type === "divider" ? "Divider" : "Text"}</label>
            {field.type !== "divider" && (
              <input
                ref={labelInputRef}
                className={styles.input}
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder={field.type === "section_header" ? "Section title" : "Description text"}
              />
            )}
          </div>
        )}

        {/* Placeholder */}
        {hasPlaceholder && (
          <div className={styles.field}>
            <label className={styles.label}>Placeholder</label>
            <input
              className={styles.input}
              value={field.placeholder ?? ""}
              onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
              placeholder="Hint text"
            />
          </div>
        )}

        {/* Required toggle */}
        {!isLayoutType && (
          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel} htmlFor={`req-${field.id}`}>
              Required
            </label>
            <button
              id={`req-${field.id}`}
              type="button"
              role="switch"
              aria-checked={field.required ?? false}
              className={`${styles.toggle} ${field.required ? styles.toggleOn : ""}`}
              onClick={() => onUpdate({ required: !field.required })}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        )}

        {/* Rating max */}
        {field.type === "rating" && (
          <div className={styles.field}>
            <label className={styles.label}>Max rating</label>
            <div className={styles.ratingOptions}>
              {[5, 10].map((max) => (
                <button
                  key={max}
                  type="button"
                  className={`${styles.ratingOption} ${(field.ratingMax ?? 5) === max ? styles.ratingOptionActive : ""}`}
                  onClick={() => onUpdate({ ratingMax: max })}
                >
                  {max}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Options */}
        {hasOptions && (
          <div className={styles.field}>
            <label className={styles.label}>Options</label>
            <div className={styles.optionList}>
              {(field.options ?? []).map((opt, i) => (
                <div key={i} className={styles.optionRow}>
                  <input
                    className={styles.optionInput}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  <button
                    type="button"
                    className={styles.optionRemoveBtn}
                    onClick={() => removeOption(i)}
                    disabled={(field.options ?? []).length <= 1}
                    aria-label="Remove option"
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                </div>
              ))}
              <button type="button" className={styles.addOptionBtn} onClick={addOption}>
                <Plus size={12} weight="bold" />
                Add option
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
