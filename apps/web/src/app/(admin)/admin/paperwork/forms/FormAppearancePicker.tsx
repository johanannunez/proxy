"use client";

/**
 * FormAppearancePicker lets an admin give a form a custom icon (emoji or a
 * searchable Phosphor glyph) and accent color via the Notion-style IconPicker.
 * Lives on the form's Settings tab. Optimistic: the trigger updates instantly,
 * the server action persists, and a refresh reconciles. Legacy FormIconKeys
 * still render in the trigger via the resolved glyph.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FORM_TINTS, resolveFormAppearance, FormGlyph } from "./form-icon";
import { updateFormAppearanceAction } from "../templates/form-actions";
import { IconPicker, type IconValue } from "@/components/admin/IconPicker";
import styles from "./FormAppearancePicker.module.css";

function storedToValue(icon: string | null, emoji: string | null): IconValue | null {
  if (emoji) return { kind: "emoji", value: emoji };
  if (icon?.startsWith("ph:")) return { kind: "icon", value: icon.slice(3) };
  return null; // legacy FormIconKey. Trigger shows it via the resolved glyph.
}

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

  const resolved = resolveFormAppearance({
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

  function handleIcon(value: IconValue) {
    persist({
      icon: value.kind === "emoji" ? value.value : `ph:${value.value}`,
      color: current.color ?? FORM_TINTS[0].key,
    });
  }

  function handleColor(key: string) {
    persist({ icon: current.icon, color: key });
  }

  const colorOptions = FORM_TINTS.map((t) => ({ key: t.key, label: t.key, swatch: t.fg }));

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>Brand Studio</h3>
          <p className={styles.sub}>
            Choose the form symbol and accent color used across the card and
            respondent experience.
          </p>
        </div>
        <IconPicker
          value={storedToValue(current.icon, resolved.emoji)}
          onChange={handleIcon}
          color={current.color ?? undefined}
          onColorChange={handleColor}
          colorOptions={colorOptions}
          ariaLabel="Choose a form icon"
          triggerBg={resolved.bg}
          triggerFg={resolved.fg}
          triggerContent={<FormGlyph appearance={resolved} size={24} />}
        />
      </div>
    </div>
  );
}
