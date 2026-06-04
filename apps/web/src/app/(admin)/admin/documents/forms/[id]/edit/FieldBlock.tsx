"use client";

import type { FormField } from "@/lib/admin/forms-types";
import styles from "./FieldBlock.module.css";

type Props = {
  field: FormField;
};

export function FieldBlock({ field }: Props) {
  const { type, label, required, placeholder, options, ratingMax } = field;

  const labelEl = (
    <div className={styles.label}>
      {label || <span className={styles.placeholder}>Untitled field</span>}
      {required && <span className={styles.required}>*</span>}
    </div>
  );

  switch (type) {
    case "short_text":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.inputMock}>{placeholder || "Short answer text"}</div>
        </div>
      );

    case "long_text":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={`${styles.inputMock} ${styles.inputMockTall}`}>
            {placeholder || "Long answer text"}
          </div>
        </div>
      );

    case "number":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.inputMock}>{placeholder || "0"}</div>
        </div>
      );

    case "email":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.inputMock}>{placeholder || "email@example.com"}</div>
        </div>
      );

    case "phone":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.inputMock}>{placeholder || "+1 (555) 000-0000"}</div>
        </div>
      );

    case "date":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.inputMock}>{placeholder || "MM / DD / YYYY"}</div>
        </div>
      );

    case "single_choice":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.optionList}>
            {(options ?? ["Option 1", "Option 2"]).map((opt, i) => (
              <div key={i} className={styles.optionRow}>
                <span className={styles.radio} />
                <span className={styles.optionLabel}>{opt}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "multiple_choice":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.optionList}>
            {(options ?? ["Option 1", "Option 2"]).map((opt, i) => (
              <div key={i} className={styles.optionRow}>
                <span className={styles.checkbox} />
                <span className={styles.optionLabel}>{opt}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case "dropdown":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={`${styles.inputMock} ${styles.inputMockDropdown}`}>
            <span>{placeholder || "Select an option"}</span>
            <span className={styles.chevron}>▾</span>
          </div>
        </div>
      );

    case "file_upload":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.uploadZone}>
            <span className={styles.uploadIcon}>↑</span>
            <span>Click to upload or drag a file here</span>
          </div>
        </div>
      );

    case "rating": {
      const max = ratingMax ?? 5;
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.ratingRow}>
            {Array.from({ length: max }, (_, i) => (
              <span key={i} className={`${styles.star} ${i < 3 ? styles.starFilled : ""}`}>
                ★
              </span>
            ))}
          </div>
        </div>
      );
    }

    case "signature":
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.signatureBox}>
            <span className={styles.signatureHint}>Sign here</span>
          </div>
        </div>
      );

    case "section_header":
      return (
        <div className={styles.sectionHeader}>
          {label || "Section Header"}
        </div>
      );

    case "description":
      return (
        <div className={styles.description}>
          {label || "Add a description or instructions here."}
        </div>
      );

    case "divider": {
      const dividerLabel = label && label !== "Divider" ? label : null;
      return (
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          {dividerLabel && (
            <span className={styles.dividerLabel}>{dividerLabel}</span>
          )}
          <span className={styles.dividerLine} />
        </div>
      );
    }

    default:
      return (
        <div className={styles.field}>
          {labelEl}
          <div className={styles.inputMock}>Field</div>
        </div>
      );
  }
}
