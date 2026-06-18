"use client";

import { useState } from "react";
import type { Form, FormField, FormSchema, FormCompletion } from "@/lib/admin/forms-types";
import type { updateFormMetaAction } from "../../form-actions";
import styles from "./FormSettingsPanel.module.css";

type UpdateMetaParams = Parameters<typeof updateFormMetaAction>[1];

type Props = {
  form: Form;
  formName: string;
  schema: FormSchema;
  onUpdateMeta: (updates: UpdateMetaParams) => void;
  onUpdateSchema: (next: FormSchema) => void;
};

const COMPLETION_OPTIONS: Array<{
  value: FormCompletion["type"];
  label: string;
}> = [
  { value: "message", label: "Thank-you message" },
  { value: "portal_home", label: "Send to portal home" },
  { value: "custom", label: "Custom link" },
];

export function FormSettingsPanel({ form, schema, onUpdateMeta, onUpdateSchema }: Props) {
  const [description, setDescription] = useState(form.description ?? "");
  const [submitText, setSubmitText] = useState(schema.settings.submitButtonText ?? "");
  const [successMessage, setSuccessMessage] = useState(schema.settings.successMessage ?? "");

  // Derive completion state — seed customUrl from legacy redirectUrl if present
  const existingCompletion = schema.settings.completion;
  const [completionType, setCompletionType] = useState<FormCompletion["type"]>(
    existingCompletion?.type ?? "message",
  );
  const [customUrl, setCustomUrl] = useState(
    existingCompletion?.customUrl ?? schema.settings.redirectUrl ?? "",
  );

  const lastField = schema.fields[schema.fields.length - 1];
  const hasSignature = lastField?.type === "signature";

  function handleToggleSignature() {
    if (hasSignature) {
      const next = schema.fields.slice(0, -1);
      onUpdateSchema({ ...schema, fields: next });
    } else {
      const signatureField: FormField = {
        id: `field_${Date.now().toString(36)}`,
        type: "signature",
        label: "Signature",
        required: true,
      };
      onUpdateSchema({ ...schema, fields: [...schema.fields, signatureField] });
    }
  }

  function updateCompletion(type: FormCompletion["type"], url?: string) {
    const completion: FormCompletion = {
      type,
      ...(type === "custom" ? { customUrl: url ?? customUrl } : {}),
    };
    onUpdateSchema({
      ...schema,
      settings: {
        ...schema.settings,
        completion,
      },
    });
  }

  function handleCompletionTypeChange(type: FormCompletion["type"]) {
    setCompletionType(type);
    updateCompletion(type);
  }

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        <div className={styles.field}>
          <label className={styles.label}>Form description</label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onUpdateMeta({ description: description.trim() || undefined })}
            placeholder="Briefly describe this form..."
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Submit button text</label>
          <input
            className={styles.input}
            value={submitText}
            onChange={(e) => setSubmitText(e.target.value)}
            onBlur={() =>
              onUpdateSchema({
                ...schema,
                settings: {
                  ...schema.settings,
                  submitButtonText: submitText.trim() || undefined,
                },
              })
            }
            placeholder="Submit"
          />
        </div>

        {/* ── When they finish ─────────────────────── */}
        <div className={styles.field}>
          <label className={styles.label}>When they finish</label>
          <div className={styles.segmentedGroup} role="group" aria-label="Completion action">
            {COMPLETION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`${styles.segmentedBtn} ${completionType === opt.value ? styles.segmentedBtnActive : ""}`}
                onClick={() => handleCompletionTypeChange(opt.value)}
                aria-pressed={completionType === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {completionType === "message" && (
            <div className={styles.completionDetail}>
              <label className={styles.subLabel}>Thank you message</label>
              <textarea
                className={styles.textarea}
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                onBlur={() =>
                  onUpdateSchema({
                    ...schema,
                    settings: {
                      ...schema.settings,
                      successMessage: successMessage.trim() || undefined,
                      completion: { type: "message" },
                    },
                  })
                }
                placeholder="Thank you for your submission!"
                rows={3}
              />
            </div>
          )}

          {completionType === "portal_home" && (
            <p className={styles.completionHint}>
              Takes signed-in owners to their portal home. Guests with a public link will be asked to sign in.
            </p>
          )}

          {completionType === "custom" && (
            <div className={styles.completionDetail}>
              <label className={styles.subLabel}>Destination URL</label>
              <input
                className={styles.input}
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onBlur={() => updateCompletion("custom", customUrl.trim())}
                placeholder="https://..."
              />
            </div>
          )}
        </div>

        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor="sig-toggle">
            Require signature at end
          </label>
          <button
            id="sig-toggle"
            type="button"
            role="switch"
            aria-checked={hasSignature}
            className={`${styles.toggle} ${hasSignature ? styles.toggleOn : ""}`}
            onClick={handleToggleSignature}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      </div>
    </div>
  );
}
