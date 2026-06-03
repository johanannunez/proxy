"use client";

import { useState, useRef, type FormEvent } from "react";
import { SpinnerGap } from "@phosphor-icons/react";
import type { Form, FormField } from "@/lib/admin/forms-types";
import styles from "./FormRenderer.module.css";
import { FieldRenderer } from "./FieldRenderer";

type Props = {
  form: Form;
  onSubmit?: (data: Record<string, unknown>) => Promise<void>;
  readOnly?: boolean;
};

function validateField(field: FormField, value: unknown): string | null {
  if (field.type === "divider" || field.type === "section_header" || field.type === "description") {
    return null;
  }
  if (field.required) {
    if (value === undefined || value === null || value === "") return "This field is required.";
    if (Array.isArray(value) && value.length === 0) return "This field is required.";
  }
  if (field.type === "email" && typeof value === "string" && value) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  }
  if (field.type === "phone" && typeof value === "string" && value) {
    if (value.replace(/\D/g, "").length < 7) return "Enter a valid phone number.";
  }
  return null;
}

export function FormRenderer({ form, onSubmit, readOnly = false }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function setValue(id: string, value: unknown) {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!onSubmit) return;

    const newErrors: Record<string, string> = {};
    for (const field of form.schema.fields) {
      const err = validateField(field, values[field.id]);
      if (err) newErrors[field.id] = err;
    }
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setSubmitting(true);
    try {
      await onSubmit(values);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  const successMsg =
    form.schema.settings.successMessage ?? "Thank you. Your response has been recorded.";

  if (submitted) {
    return (
      <div className={styles.successCard}>
        <div className={styles.successCheck}>✓</div>
        <p className={styles.successMsg}>{successMsg}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={styles.form} noValidate>
      {form.schema.fields.map((field) => (
        <div key={field.id} className={styles.fieldWrap}>
          <FieldRenderer
            field={field}
            value={values[field.id]}
            onChange={(val) => setValue(field.id, val)}
            error={errors[field.id]}
            readOnly={readOnly}
          />
        </div>
      ))}

      {!readOnly && (
        <div className={styles.submitRow}>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <SpinnerGap size={16} weight="bold" className={styles.spin} />
                Submitting…
              </>
            ) : (
              (form.schema.settings.submitButtonText ?? "Submit")
            )}
          </button>
        </div>
      )}
    </form>
  );
}
