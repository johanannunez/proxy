"use client";

/**
 * CreateTemplateModal — a centered, guarded, multi-step modal for building a
 * signature document template. Opens instantly from client state (no route
 * navigation). The backdrop never dismisses it; closing goes through Cancel/X
 * and, if anything has been entered, an inline discard confirmation, so a
 * misclick cannot wipe out in-progress work.
 *
 * Flow: Step 1 Details -> Step 2 Document (upload + live preview) -> Build,
 * which creates the DocuSeal template and hands off to full-screen field
 * placement (Step 3) on the template's detail page.
 */

import { useEffect, useRef, useState } from "react";
import {
  X,
  FilePdf,
  UploadSimple,
  Check,
  Plus,
  CaretRight,
  CaretLeft,
  SpinnerGap,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import { uploadAndCreateTemplate, checkDocumentKeyAvailable } from "./template-actions";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./CreateTemplateModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (template: DocumentTemplate) => void;
};

const GATE_OPTIONS: SelectOption[] = [
  { value: "", label: "None (manual / standalone)" },
  { value: "1", label: "Agreement (step 1)" },
  { value: "2", label: "Payment (step 2)" },
  { value: "3", label: "Banking (step 3)" },
  { value: "4", label: "Identity / other (step 4)" },
];

const BUILTIN_ROLES = ["Owner", "Proxy", "Tenant", "Co-owner"];
const ROLE_LABELS: Record<string, string> = { Proxy: "You (countersigner)" };
const roleLabel = (role: string) => ROLE_LABELS[role] ?? role;

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const STEPS = ["Details", "Document", "Place fields"] as const;

export function CreateTemplateModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [documentKey, setDocumentKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [description, setDescription] = useState("");
  const [roleOptions, setRoleOptions] = useState<string[]>(BUILTIN_ROLES);
  const [roles, setRoles] = useState<string[]>(["Owner", "Proxy"]);
  const [newRole, setNewRole] = useState("");
  const [requiresCounter, setRequiresCounter] = useState(true);
  const [gateStep, setGateStep] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);

  const dirty =
    displayName.trim() !== "" ||
    description.trim() !== "" ||
    pdfFile !== null ||
    keyEdited;

  // Live document-key availability, debounced.
  useEffect(() => {
    const key = documentKey.trim();
    if (!key) {
      setKeyStatus("idle");
      return;
    }
    setKeyStatus("checking");
    const handle = setTimeout(async () => {
      const { available } = await checkDocumentKeyAvailable(key);
      setKeyStatus(available ? "available" : "taken");
    }, 350);
    return () => clearTimeout(handle);
  }, [documentKey]);

  // Guarded Escape: never silently lose work.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        attemptClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty, confirmingDiscard]);

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  if (!open) return null;

  function resetAndClose() {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    setStep(1);
    setSubmitting(false);
    setError(null);
    setConfirmingDiscard(false);
    setDisplayName("");
    setDocumentKey("");
    setKeyEdited(false);
    setKeyStatus("idle");
    setDescription("");
    setRoleOptions(BUILTIN_ROLES);
    setRoles(["Owner", "Proxy"]);
    setNewRole("");
    setRequiresCounter(true);
    setGateStep("");
    setPdfFile(null);
    setPdfUrl(null);
    onClose();
  }

  function attemptClose() {
    if (confirmingDiscard) return;
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    resetAndClose();
  }

  function handleNameChange(v: string) {
    setDisplayName(v);
    if (!keyEdited) setDocumentKey(toSlug(v));
  }

  function setFile(file: File | null) {
    if (pdfUrlRef.current) {
      URL.revokeObjectURL(pdfUrlRef.current);
      pdfUrlRef.current = null;
    }
    if (file && file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      pdfUrlRef.current = url;
      setPdfFile(file);
      setPdfUrl(url);
      setError(null);
    } else if (file) {
      setError("Only PDF files are supported.");
    }
  }

  function addCustomRole() {
    const role = newRole.trim();
    if (!role) return;
    if (!roleOptions.some((r) => r.toLowerCase() === role.toLowerCase())) {
      setRoleOptions((prev) => [...prev, role]);
    }
    if (!roles.includes(role)) setRoles((prev) => [...prev, role]);
    setNewRole("");
  }

  const step1Valid =
    displayName.trim() !== "" &&
    /^[a-z0-9_]+$/.test(documentKey.trim()) &&
    keyStatus !== "taken" &&
    roles.length > 0;

  async function handleBuild() {
    if (!pdfFile) {
      setError("A PDF document is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("display_name", displayName.trim());
      formData.set("document_key", documentKey.trim());
      if (description.trim()) formData.set("description", description.trim());
      formData.set("signer_roles", JSON.stringify(roles));
      formData.set("requires_countersignature", String(requiresCounter));
      formData.set("gate_step", gateStep);
      formData.set("pdf", pdfFile);

      const result = await uploadAndCreateTemplate(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.template);
      resetAndClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.backdrop}>
      <motion.div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Build a document template"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
      >
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>New document template</h2>
            <p className={styles.subtitle}>
              Build it once, then send it to any owner or property.
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={attemptClose}
            aria-label="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </header>

        <div className={styles.stepper} aria-hidden>
          {STEPS.map((label, i) => {
            const n = (i + 1) as 1 | 2 | 3;
            const state = n < step ? "done" : n === step ? "active" : "todo";
            return (
              <div key={label} className={styles.stepItem}>
                <span className={`${styles.stepDot} ${styles[`step${state}`]}`}>
                  {state === "done" ? <Check size={12} weight="bold" /> : n}
                </span>
                <span className={styles.stepLabel}>{label}</span>
                {i < STEPS.length - 1 && <span className={styles.stepBar} />}
              </div>
            );
          })}
        </div>

        <div className={styles.body}>
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="details"
                className={styles.stepPane}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="ct_name">Display name</label>
                  <input
                    id="ct_name"
                    type="text"
                    className={styles.input}
                    placeholder="Host Rental Agreement"
                    value={displayName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="ct_key">Document key</label>
                  <div className={styles.keyWrap}>
                    <input
                      id="ct_key"
                      type="text"
                      className={`${styles.input} ${keyStatus === "taken" ? styles.inputError : ""}`}
                      placeholder="host_rental_agreement"
                      value={documentKey}
                      onChange={(e) => {
                        setDocumentKey(toSlug(e.target.value));
                        setKeyEdited(true);
                      }}
                      aria-invalid={keyStatus === "taken"}
                    />
                    {keyStatus === "available" && (
                      <span className={`${styles.keyStatus} ${styles.keyOk}`}>
                        <Check size={13} weight="bold" /> Available
                      </span>
                    )}
                    {keyStatus === "taken" && (
                      <span className={`${styles.keyStatus} ${styles.keyBad}`}>Already in use</span>
                    )}
                  </div>
                  <p className={styles.hint}>
                    A unique id for this document, used across the system.
                    Lowercase letters, numbers, and underscores only.
                  </p>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="ct_desc">
                    Description <span className={styles.optional}>(optional)</span>
                  </label>
                  <textarea
                    id="ct_desc"
                    className={styles.textarea}
                    rows={2}
                    placeholder="What is this document for?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <span className={styles.label}>Signer roles</span>
                  <div className={styles.roleGrid}>
                    {roleOptions.map((role) => (
                      <label key={role} className={styles.roleChip}>
                        <input
                          type="checkbox"
                          checked={roles.includes(role)}
                          onChange={() =>
                            setRoles((prev) =>
                              prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
                            )
                          }
                          className={styles.roleCheckbox}
                        />
                        <span className={styles.roleLabel}>{roleLabel(role)}</span>
                      </label>
                    ))}
                  </div>
                  <div className={styles.addRoleRow}>
                    <input
                      type="text"
                      className={styles.addRoleInput}
                      placeholder="Add a role (e.g. Guarantor)"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomRole();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.addRoleBtn}
                      onClick={addCustomRole}
                      disabled={!newRole.trim()}
                    >
                      <Plus size={13} weight="bold" /> Add
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.toggleRow}>
                    <span className={styles.label} style={{ marginBottom: 0 }}>
                      Requires your countersignature
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
                  <span className={styles.label}>Onboarding gate step</span>
                  <CustomSelect value={gateStep} onChange={setGateStep} options={GATE_OPTIONS} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="document"
                className={styles.stepPane}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {pdfUrl ? (
                  <div className={styles.previewWrap}>
                    <object data={pdfUrl} type="application/pdf" className={styles.previewObject}>
                      <div className={styles.previewFallback}>
                        <FilePdf size={28} weight="duotone" />
                        <span>{pdfFile?.name}</span>
                      </div>
                    </object>
                    <div className={styles.previewBar}>
                      <FilePdf size={16} weight="duotone" />
                      <span className={styles.previewName}>{pdfFile?.name}</span>
                      <label className={styles.replaceBtn}>
                        Replace
                        <input
                          type="file"
                          accept="application/pdf"
                          className={styles.fileInput}
                          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`${styles.uploadZone} ${dragging ? styles.uploadDragging : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      setFile(e.dataTransfer.files?.[0] ?? null);
                    }}
                  >
                    <input
                      type="file"
                      accept="application/pdf"
                      className={styles.fileInput}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <UploadSimple size={30} weight="duotone" className={styles.uploadIcon} />
                    <span className={styles.uploadTitle}>Drag a PDF here, or click to browse</span>
                    <span className={styles.uploadHint}>
                      You will place the signature fields next.
                    </span>
                  </label>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.ghostBtn} onClick={attemptClose}>
            Cancel
          </button>
          <div className={styles.footerRight}>
            {step === 2 && (
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                <CaretLeft size={13} weight="bold" /> Back
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => setStep(2)}
                disabled={!step1Valid}
              >
                Next <CaretRight size={13} weight="bold" />
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleBuild}
                disabled={submitting || !pdfFile}
              >
                {submitting ? (
                  <>
                    <SpinnerGap size={14} weight="bold" className={styles.spin} /> Building…
                  </>
                ) : (
                  "Build template"
                )}
              </button>
            )}
          </div>
        </footer>

        <AnimatePresence>
          {confirmingDiscard && (
            <motion.div
              className={styles.discardOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <div className={styles.discardCard}>
                <h3 className={styles.discardTitle}>Discard this template?</h3>
                <p className={styles.discardBody}>
                  You have unsaved details. Closing now will lose them.
                </p>
                <div className={styles.discardActions}>
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    onClick={() => setConfirmingDiscard(false)}
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={resetAndClose}
                  >
                    Discard
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
