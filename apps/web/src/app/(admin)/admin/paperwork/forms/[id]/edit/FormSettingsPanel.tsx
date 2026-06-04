"use client";

import { useState } from "react";
import type { Form, FormField, FormSchema } from "@/lib/admin/forms-types";
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

export function FormSettingsPanel({ form, schema, onUpdateMeta, onUpdateSchema }: Props) {
  const [description, setDescription] = useState(form.description ?? "");
  const [submitText, setSubmitText] = useState(schema.settings.submitButtonText ?? "");
  const [successMessage, setSuccessMessage] = useState(schema.settings.successMessage ?? "");
  const [redirectUrl, setRedirectUrl] = useState(schema.settings.redirectUrl ?? "");

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

        <div className={styles.field}>
          <label className={styles.label}>Thank you message</label>
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
                },
              })
            }
            placeholder="Thank you for your submission!"
            rows={3}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Redirect URL after submission</label>
          <input
            className={styles.input}
            type="url"
            value={redirectUrl}
            onChange={(e) => setRedirectUrl(e.target.value)}
            onBlur={() =>
              onUpdateSchema({
                ...schema,
                settings: {
                  ...schema.settings,
                  redirectUrl: redirectUrl.trim() || undefined,
                },
              })
            }
            placeholder="https://..."
          />
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
