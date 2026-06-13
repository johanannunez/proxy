"use client";

/**
 * FormAppearancePicker — lets an admin give a form a custom icon and accent
 * color. Lives on the form's Settings tab. Optimistic: the chip updates
 * instantly, the server action persists, and a refresh reconciles.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FORM_ICONS,
  FORM_TINTS,
  resolveFormAppearance,
  type FormIconKey,
  type FormTintKey,
} from "./form-icon";
import { updateFormAppearanceAction } from "../templates/form-actions";
import styles from "./FormAppearancePicker.module.css";

export function FormAppearancePicker({
  formId,
  icon,
  iconColor,
}: {
  formId: string;
  icon: string | null;
  iconColor: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useState<{ icon: string | null; color: string | null }>({
    icon,
    color: iconColor,
  });

  const preview = resolveFormAppearance({
    id: formId,
    icon: current.icon,
    icon_color: current.color,
  });

  function persist(next: { icon: string | null; color: string | null }) {
    setCurrent(next);
    startTransition(async () => {
      await updateFormAppearanceAction(formId, {
        icon: next.icon,
        icon_color: next.color,
      });
      router.refresh();
    });
  }

  function pickIcon(key: FormIconKey) {
    persist({ icon: key, color: current.color ?? FORM_TINTS[0].key });
  }

  function pickColor(key: FormTintKey) {
    persist({ icon: current.icon ?? FORM_ICONS[0].key, color: key });
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>Appearance</h3>
          <p className={styles.sub}>
            Give this form a custom icon and color so it stands out in your
            library.
          </p>
        </div>
        <span
          className={styles.previewChip}
          style={{ background: preview.bg, color: preview.fg }}
        >
          <preview.Icon size={24} weight="duotone" />
        </span>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Color</span>
        <div className={styles.colorRow}>
          {FORM_TINTS.map((tint) => {
            const selected = (current.color ?? "") === tint.key;
            return (
              <button
                key={tint.key}
                type="button"
                className={`${styles.colorSwatch} ${selected ? styles.colorSelected : ""}`}
                style={{ background: tint.fg }}
                onClick={() => pickColor(tint.key)}
                aria-label={`${tint.key} accent`}
                aria-pressed={selected}
              />
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>Icon</span>
        <div className={styles.iconGrid}>
          {FORM_ICONS.map(({ key, label, Icon }) => {
            const selected = (current.icon ?? "") === key;
            return (
              <button
                key={key}
                type="button"
                className={`${styles.iconCell} ${selected ? styles.iconSelected : ""}`}
                style={
                  selected ? { background: preview.bg, color: preview.fg } : undefined
                }
                onClick={() => pickIcon(key)}
                title={label}
                aria-label={label}
                aria-pressed={selected}
              >
                <Icon size={19} weight={selected ? "duotone" : "regular"} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
