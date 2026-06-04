"use client";

import { useEffect, useState } from "react";
import { X, SpinnerGap, Plus, CaretDown, UploadSimple, ArrowRight } from "@phosphor-icons/react";
import type { FormField } from "@/lib/admin/forms-types";
import styles from "./TemplatePickerModal.module.css";

export type PickerTemplate = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  fields: FormField[];
};

type Props = {
  templates: PickerTemplate[];
  creating: string | null;
  error: string | null;
  onSelect: (template: PickerTemplate) => void;
  onClose: () => void;
};

export function TemplatePickerModal({ templates, creating, error, onSelect, onClose }: Props) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const [animKey, setAnimKey] = useState(0);

  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSelect(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    setAnimKey((k) => k + 1);
  }

  const nonLayoutCount =
    selected?.fields.filter(
      (f) => !["section_header", "description", "divider"].includes(f.type),
    ).length ?? 0;

  if (!selected) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>New form</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className={styles.body}>
          <aside className={styles.sidebar}>
            <p className={styles.sidebarLabel}>Templates</p>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.templateRow} ${selectedId === t.id ? styles.templateRowActive : ""}`}
                onClick={() => handleSelect(t.id)}
              >
                <div
                  className={`${styles.rowIcon} ${t.id === "blank" ? styles.rowIconBlank : ""}`}
                >
                  {t.icon}
                </div>
                <div className={styles.rowText}>
                  <span className={styles.rowName}>{t.name}</span>
                  <span className={styles.rowDesc}>{t.description}</span>
                </div>
              </button>
            ))}
          </aside>

          <div className={styles.preview}>
            <div className={styles.previewScroll}>
              {selected.id === "blank" ? (
                <BlankPreview key={animKey} />
              ) : (
                <FormPreviewCard
                  key={animKey}
                  name={selected.name}
                  description={selected.description}
                  fields={selected.fields}
                  fieldCount={nonLayoutCount}
                />
              )}
            </div>

            <div className={styles.previewFooter}>
              {error && <p className={styles.footerError}>{error}</p>}
              <button
                type="button"
                className={styles.useBtn}
                onClick={() => onSelect(selected)}
                disabled={creating !== null}
              >
                {creating === selected.id ? (
                  <SpinnerGap size={14} weight="bold" className={styles.spin} />
                ) : (
                  <ArrowRight size={14} weight="bold" />
                )}
                {selected.id === "blank" ? "Start blank" : `Use ${selected.name}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Internal sub-components ───────────────────────────────────────────────────

function FormPreviewCard({
  name,
  description,
  fields,
  fieldCount,
}: {
  name: string;
  description: string;
  fields: FormField[];
  fieldCount: number;
}) {
  return (
    <div className={styles.previewFadeIn}>
      <div className={styles.previewCard}>
        <div className={styles.previewCardHeader}>
          <div className={styles.previewCardMeta}>
            <h3 className={styles.previewCardTitle}>{name}</h3>
            <span className={styles.previewCardCount}>
              {fieldCount} {fieldCount === 1 ? "field" : "fields"}
            </span>
          </div>
          {description && <p className={styles.previewCardDesc}>{description}</p>}
        </div>
        <div className={styles.previewCardBody}>
          <div className={styles.previewFields}>
            {fields.map((f) => (
              <FieldPreview key={f.id} field={f} />
            ))}
          </div>
          <button type="button" className={styles.previewSubmitBtn} disabled tabIndex={-1}>
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: FormField }) {
  const isLayout = ["section_header", "description", "divider"].includes(field.type);

  return (
    <div className={`${styles.pvField} ${isLayout ? styles.pvFieldLayout : ""}`}>
      {field.type === "section_header" && (
        <div className={styles.pvSectionHeader}>{field.label || "Section"}</div>
      )}

      {field.type === "description" && (
        <p className={styles.pvDescription}>{field.label}</p>
      )}

      {field.type === "divider" && <hr className={styles.pvDivider} />}

      {(field.type === "short_text" ||
        field.type === "email" ||
        field.type === "phone" ||
        field.type === "number" ||
        field.type === "date") && (
        <>
          <FieldLabel field={field} />
          <div className={styles.pvInput}>
            <span className={styles.pvPlaceholder}>
              {field.placeholder ??
                (field.type === "email"
                  ? "you@example.com"
                  : field.type === "phone"
                    ? "(555) 000-0000"
                    : field.type === "number"
                      ? "0"
                      : field.type === "date"
                        ? "MM / DD / YYYY"
                        : "Your answer")}
            </span>
          </div>
        </>
      )}

      {field.type === "long_text" && (
        <>
          <FieldLabel field={field} />
          <div className={`${styles.pvInput} ${styles.pvInputTall}`}>
            <span className={styles.pvPlaceholder}>{field.placeholder ?? "Your answer"}</span>
          </div>
        </>
      )}

      {field.type === "dropdown" && (
        <>
          <FieldLabel field={field} />
          <div className={`${styles.pvInput} ${styles.pvInputDropdown}`}>
            <span className={styles.pvPlaceholder}>
              {field.options?.[0] ?? "Select an option"}
            </span>
            <CaretDown size={12} weight="bold" className={styles.pvCaret} />
          </div>
        </>
      )}

      {(field.type === "single_choice" || field.type === "multiple_choice") && (
        <>
          <FieldLabel field={field} />
          <div className={styles.pvChoiceList}>
            {(field.options ?? []).map((opt, i) => (
              <div key={i} className={styles.pvChoiceRow}>
                <div
                  className={
                    field.type === "single_choice" ? styles.pvRadio : styles.pvCheckbox
                  }
                />
                <span className={styles.pvChoiceLabel}>{opt}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {field.type === "rating" && (
        <>
          <FieldLabel field={field} />
          <div className={styles.pvStarRow}>
            {Array.from({ length: field.ratingMax ?? 5 }).map((_, i) => (
              <span key={i} className={i < 3 ? styles.pvStarFilled : styles.pvStarEmpty}>
                ★
              </span>
            ))}
          </div>
        </>
      )}

      {field.type === "file_upload" && (
        <>
          <FieldLabel field={field} />
          <div className={styles.pvUploadZone}>
            <UploadSimple size={18} weight="duotone" className={styles.pvUploadIcon} />
            <span className={styles.pvUploadText}>Click to upload or drag and drop</span>
          </div>
        </>
      )}

      {field.type === "signature" && (
        <>
          <FieldLabel field={field} />
          <div className={styles.pvSignatureBox}>
            <span className={styles.pvSignatureHint}>Sign here</span>
          </div>
        </>
      )}
    </div>
  );
}

function FieldLabel({ field }: { field: FormField }) {
  return (
    <p className={styles.pvLabel}>
      {field.label ? (
        field.label
      ) : (
        <span className={styles.pvLabelEmpty}>Untitled field</span>
      )}
      {field.required && <span className={styles.pvRequired}> *</span>}
    </p>
  );
}

function BlankPreview() {
  return (
    <div className={`${styles.previewFadeIn} ${styles.blankPreview}`}>
      <div className={styles.blankIcon}>
        <Plus size={22} weight="bold" />
      </div>
      <h3 className={styles.blankTitle}>Start with a blank canvas</h3>
      <p className={styles.blankDesc}>
        Add fields from the palette on the left, or describe your form and let AI build the first draft.
      </p>
    </div>
  );
}
