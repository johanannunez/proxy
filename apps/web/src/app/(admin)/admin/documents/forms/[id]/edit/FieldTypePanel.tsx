"use client";

import {
  TextT,
  TextAlignLeft,
  Hash,
  EnvelopeSimple,
  Phone,
  CalendarBlank,
  RadioButton,
  CheckSquare,
  CaretDown,
  UploadSimple,
  Star,
  Signature,
  TextHTwo,
  AlignLeft,
  Minus,
} from "@phosphor-icons/react";
import type { FormFieldType } from "@/lib/admin/forms-types";
import { FIELD_TYPE_LABELS, INPUT_FIELD_TYPES, LAYOUT_FIELD_TYPES } from "@/lib/admin/forms-types";
import styles from "./FieldTypePanel.module.css";

type Props = {
  onAddField: (type: FormFieldType) => void;
};

const FIELD_ICONS: Record<FormFieldType, React.ReactNode> = {
  short_text: <TextT size={15} weight="duotone" />,
  long_text: <TextAlignLeft size={15} weight="duotone" />,
  number: <Hash size={15} weight="duotone" />,
  email: <EnvelopeSimple size={15} weight="duotone" />,
  phone: <Phone size={15} weight="duotone" />,
  date: <CalendarBlank size={15} weight="duotone" />,
  single_choice: <RadioButton size={15} weight="duotone" />,
  multiple_choice: <CheckSquare size={15} weight="duotone" />,
  dropdown: <CaretDown size={15} weight="duotone" />,
  file_upload: <UploadSimple size={15} weight="duotone" />,
  rating: <Star size={15} weight="duotone" />,
  signature: <Signature size={15} weight="duotone" />,
  section_header: <TextHTwo size={15} weight="duotone" />,
  description: <AlignLeft size={15} weight="duotone" />,
  divider: <Minus size={15} weight="duotone" />,
};

const FIELD_DESCRIPTIONS: Record<FormFieldType, string> = {
  short_text: "Single line text",
  long_text: "Paragraph answer",
  number: "Numeric input",
  email: "Email address",
  phone: "Phone number",
  date: "Date picker",
  single_choice: "Pick one option",
  multiple_choice: "Pick many options",
  dropdown: "Select from list",
  file_upload: "File attachment",
  rating: "Star or number rating",
  signature: "Drawn signature",
  section_header: "Section title",
  description: "Instructional text",
  divider: "Visual separator",
};

export function FieldTypePanel({ onAddField }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Fields</span>
      </div>

      <div className={styles.body}>
        <div className={styles.groupLabel}>Input Fields</div>
        {INPUT_FIELD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={styles.typeItem}
            onClick={() => onAddField(type)}
            title={FIELD_DESCRIPTIONS[type]}
          >
            <span className={styles.icon}>{FIELD_ICONS[type]}</span>
            <div className={styles.typeInfo}>
              <span className={styles.typeName}>{FIELD_TYPE_LABELS[type]}</span>
              <span className={styles.typeDesc}>{FIELD_DESCRIPTIONS[type]}</span>
            </div>
          </button>
        ))}

        <div className={styles.groupLabel} style={{ marginTop: "0.625rem" }}>Layout</div>
        {LAYOUT_FIELD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={styles.typeItem}
            onClick={() => onAddField(type)}
            title={FIELD_DESCRIPTIONS[type]}
          >
            <span className={styles.icon}>{FIELD_ICONS[type]}</span>
            <div className={styles.typeInfo}>
              <span className={styles.typeName}>{FIELD_TYPE_LABELS[type]}</span>
              <span className={styles.typeDesc}>{FIELD_DESCRIPTIONS[type]}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
