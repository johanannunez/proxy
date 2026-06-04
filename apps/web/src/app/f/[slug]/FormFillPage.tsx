"use client";

import { FormRenderer } from "@/components/forms/FormRenderer";
import { submitFormResponseAction } from "@/app/(admin)/admin/paperwork/forms/form-actions";
import type { Form } from "@/lib/admin/forms-types";
import { FormViewTracker } from "./FormViewTracker";
import styles from "./FormFillPage.module.css";

type Props = {
  form: Form;
};

export function FormFillPage({ form }: Props) {
  async function handleSubmit(data: Record<string, unknown>) {
    await submitFormResponseAction(form.id, data);
  }

  return (
    <div className={styles.page}>
      <FormViewTracker formId={form.id} />
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.formTitle}>{form.name}</h1>
          {form.description && (
            <p className={styles.formDescription}>{form.description}</p>
          )}
        </div>
        <div className={styles.cardBody}>
          <FormRenderer form={form} onSubmit={handleSubmit} />
        </div>
        <div className={styles.poweredBy}>
          Powered by Proxy
        </div>
      </div>
    </div>
  );
}
