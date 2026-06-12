"use client";

import type { Form } from "@/lib/admin/forms-types";
import { FormRenderer } from "@/components/forms/FormRenderer";
import styles from "./FormPreviewPanel.module.css";

type Props = {
  form: Form;
};

export function FormPreviewPanel({ form }: Props) {
  const hasFields = form.schema.fields.length > 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Preview</span>
        <span className={styles.liveTag}>Live</span>
      </div>

      <div className={styles.body}>
        {!hasFields ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>
              Add fields from the left panel to see a live preview of your form.
            </p>
          </div>
        ) : (
          <div className={styles.formCard}>
            <div className={styles.formMeta}>
              <h2 className={styles.formTitle}>{form.name || "Untitled Form"}</h2>
              {form.description && (
                <p className={styles.formDescription}>{form.description}</p>
              )}
            </div>
            {/* Interactive preview so conditional visibility can be exercised
                live; entered values persist while conditions are edited. */}
            <FormRenderer form={form} preview />
          </div>
        )}
      </div>
    </div>
  );
}
