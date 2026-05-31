"use client";

import { useState } from "react";
import { X, FilePdf, UploadSimple } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import { uploadAndCreateTemplate } from "./template-actions";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./CreateTemplateSlideOver.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onTemplateCreated: (template: DocumentTemplate) => void;
};

const GATE_OPTIONS: SelectOption[] = [
  { value: "", label: "None (manual / standalone)" },
  { value: "1", label: "Agreement (step 1)" },
  { value: "2", label: "Payment (step 2)" },
  { value: "3", label: "Banking (step 3)" },
  { value: "4", label: "Identity / other (step 4)" },
];

const AVAILABLE_ROLES = ["Owner", "Proxy", "Tenant", "Co-owner"];

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function CreateTemplateSlideOver({
  open,
  onClose,
  onTemplateCreated,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [documentKey, setDocumentKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [roles, setRoles] = useState<string[]>(["Owner", "Proxy"]);
  const [requiresCounter, setRequiresCounter] = useState(true);
  const [gateStep, setGateStep] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  if (!open) return null;

  function handleNameChange(v: string) {
    setDisplayName(v);
    if (!keyEdited) setDocumentKey(toSlug(v));
  }

  function handleKeyChange(v: string) {
    setDocumentKey(toSlug(v));
    setKeyEdited(true);
  }

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("signer_roles", JSON.stringify(roles));
    formData.set("requires_countersignature", String(requiresCounter));
    formData.set("gate_step", gateStep);

    setSubmitting(true);
    try {
      const result = await uploadAndCreateTemplate(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onTemplateCreated(result.template);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>New Document Template</h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="display_name">
              Display name
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              className={styles.input}
              placeholder="Host Rental Agreement"
              value={displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="document_key">
              Document key
            </label>
            <input
              id="document_key"
              name="document_key"
              type="text"
              className={styles.input}
              placeholder="host_rental_agreement"
              value={documentKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              required
            />
            <p className={styles.hint}>
              Lowercase letters, numbers, and underscores only.
            </p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="description">
              Description{" "}
              <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              className={styles.textarea}
              rows={2}
              placeholder="What is this document for?"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Signer roles</span>
            <div className={styles.roleGrid}>
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} className={styles.roleChip}>
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className={styles.roleCheckbox}
                  />
                  <span className={styles.roleLabel}>{role}</span>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.toggleRow}>
              <span className={styles.label} style={{ marginBottom: 0 }}>
                Requires Proxy countersignature
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={requiresCounter}
                className={`${styles.toggle} ${requiresCounter ? styles.toggleOn : ""}`}
                onClick={() => setRequiresCounter((v) => !v)}
              >
                <span className={styles.toggleThumb} />
              </button>
            </label>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="gate_step">
              Onboarding gate step
            </label>
            <CustomSelect
              value={gateStep}
              onChange={(v) => setGateStep(v)}
              options={GATE_OPTIONS}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>PDF document</span>
            <label className={styles.uploadZone}>
              <input
                type="file"
                name="pdf"
                accept="application/pdf"
                className={styles.fileInput}
                onChange={(e) =>
                  setFileName(e.target.files?.[0]?.name ?? null)
                }
                required
              />
              <div className={styles.uploadContent}>
                {fileName ? (
                  <>
                    <FilePdf
                      size={24}
                      weight="duotone"
                      className={styles.uploadIcon}
                    />
                    <span className={styles.fileName}>{fileName}</span>
                    <span className={styles.uploadChange}>
                      Click to change
                    </span>
                  </>
                ) : (
                  <>
                    <UploadSimple
                      size={24}
                      weight="duotone"
                      className={styles.uploadIcon}
                    />
                    <span>Click or drag a PDF here</span>
                  </>
                )}
              </div>
            </label>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Build Template"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
