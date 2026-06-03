"use client";

import { useState } from "react";
import { X, Sparkle, SpinnerGap, CheckCircle, ArrowsClockwise } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import type { FormField } from "@/lib/admin/forms-types";
import { FIELD_TYPE_LABELS } from "@/lib/admin/forms-types";
import styles from "./AiGenerateSlideOver.module.css";

type Props = {
  open: boolean;
  existingFields: FormField[];
  onConfirm: (fields: FormField[]) => void;
  onClose: () => void;
};

const AUDIENCE_OPTIONS: SelectOption[] = [
  { value: "", label: "Anyone" },
  { value: "Property owner / landlord", label: "Property owner / landlord" },
  { value: "Guest / renter", label: "Guest / renter" },
  { value: "Internal team / inspector", label: "Internal team / inspector" },
];

export function AiGenerateSlideOver({ open, existingFields, onConfirm, onClose }: Props) {
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<FormField[] | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  if (!open) return null;

  async function handleGenerate() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    setGenerated(null);

    try {
      const res = await fetch("/api/admin/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          context: audience || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.fields) {
        setError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      setGenerated(data.fields as FormField[]);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!generated) return;
    const final = mode === "append" ? [...existingFields, ...generated] : generated;
    onConfirm(final);
    setGenerated(null);
    setDescription("");
    setAudience("");
  }

  function handleClose() {
    setGenerated(null);
    setError(null);
    onClose();
  }

  return (
    <>
      <div className={styles.backdrop} onClick={handleClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <Sparkle size={18} weight="duotone" className={styles.sparkle} />
            <span className={styles.headerTitle}>Generate with AI</span>
          </div>
          <button type="button" className={styles.closeBtn} onClick={handleClose}>
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="ai-description">
              Describe the form you need
            </label>
            <textarea
              id="ai-description"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. A property inspection checklist covering exterior condition, interior rooms, appliances, and any damage noted"
              rows={4}
              disabled={loading}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              Intended audience (optional)
            </label>
            <CustomSelect
              value={audience}
              options={AUDIENCE_OPTIONS}
              onChange={(val) => setAudience(val)}
              placeholder="Anyone"
            />
          </div>

          <button
            type="button"
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
          >
            {loading ? (
              <>
                <SpinnerGap size={15} weight="bold" className={styles.spin} />
                Generating…
              </>
            ) : generated ? (
              <>
                <ArrowsClockwise size={15} weight="bold" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkle size={15} weight="bold" />
                Generate
              </>
            )}
          </button>

          {error && (
            <div className={styles.errorBanner}>{error}</div>
          )}

          {/* Generated preview */}
          {generated && (
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <CheckCircle size={16} weight="duotone" className={styles.checkIcon} />
                <span>{generated.length} fields generated</span>
              </div>

              <div className={styles.fieldList}>
                {generated.map((f) => (
                  <div key={f.id} className={styles.fieldPreviewRow}>
                    <span className={styles.fieldTypeBadge}>{FIELD_TYPE_LABELS[f.type]}</span>
                    <span className={styles.fieldPreviewLabel}>
                      {f.label}
                      {f.required && <span className={styles.req}>*</span>}
                    </span>
                  </div>
                ))}
              </div>

              {existingFields.length > 0 && (
                <div className={styles.modeRow}>
                  <label className={styles.label}>Apply to canvas</label>
                  <div className={styles.modeOptions}>
                    <button
                      type="button"
                      className={`${styles.modeBtn} ${mode === "replace" ? styles.modeBtnActive : ""}`}
                      onClick={() => setMode("replace")}
                    >
                      Replace all
                    </button>
                    <button
                      type="button"
                      className={`${styles.modeBtn} ${mode === "append" ? styles.modeBtnActive : ""}`}
                      onClick={() => setMode("append")}
                    >
                      Append to existing
                    </button>
                  </div>
                </div>
              )}

              <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>
                <CheckCircle size={15} weight="bold" />
                Use these fields
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
