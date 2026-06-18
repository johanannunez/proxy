"use client";

import { FormRenderer } from "@/components/forms/FormRenderer";
import { submitFormResponseAction } from "@/app/(admin)/admin/paperwork/templates/form-actions";
import { resolveFormCover } from "@/lib/admin/form-cover";
import type { Form, FormCoverBackground } from "@/lib/admin/forms-types";
import { FormGlyph, resolveFormAppearance } from "@/app/(admin)/admin/paperwork/forms/form-icon";
import { FormViewTracker } from "./FormViewTracker";
import styles from "./FormFillPage.module.css";

type Props = {
  form: Form;
};

function coverBackgroundClass(background: FormCoverBackground): string {
  if (background === "mesh") return styles.coverHeaderMesh;
  if (background === "wash") return styles.coverHeaderWash;
  if (background === "minimal") return styles.coverHeaderMinimal;
  return styles.coverHeaderPaper;
}

export function FormFillPage({ form }: Props) {
  const cover = resolveFormCover(form);
  const appearance = resolveFormAppearance({
    id: form.id,
    icon: form.icon,
    icon_color: form.icon_color,
  });

  async function handleSubmit(data: Record<string, unknown>) {
    await submitFormResponseAction(form.id, data);
  }

  return (
    <div className={styles.page}>
      <FormViewTracker formId={form.id} />
      <div
        className={styles.card}
        style={{
          ["--form-tone" as string]: appearance.fg,
          ["--form-surface" as string]: appearance.bg,
          ["--form-cover-color" as string]: cover.color ?? appearance.fg,
        }}
      >
        <div
          className={`${styles.coverHeader} ${
            cover.imageUrl
              ? styles.coverHeaderPhoto
              : `${styles.coverHeaderSmart} ${coverBackgroundClass(cover.background)} ${
                  cover.showIcon ? "" : styles.coverHeaderNoIcon
                }`
          }`}
          aria-hidden
        >
          {cover.imageUrl ? (
            <>
              <img src={cover.imageUrl} alt="" className={styles.coverImage} />
              {cover.showIcon && (
                <span className={styles.coverIconBadge}>
                  <FormGlyph appearance={appearance} size={22} />
                </span>
              )}
            </>
          ) : (
            <>
              {cover.blur && <span className={styles.coverColorWash} />}
              <span className={styles.coverSmartSheet}>
                <span className={styles.coverSmartBars}>
                  <span />
                  <span />
                  <span />
                </span>
                {cover.showIcon && (
                  <span className={styles.coverSmartIcon}>
                    <FormGlyph appearance={appearance} size={28} />
                  </span>
                )}
                <span className={styles.coverSmartLines}>
                  <span />
                  <span />
                </span>
              </span>
            </>
          )}
        </div>
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
