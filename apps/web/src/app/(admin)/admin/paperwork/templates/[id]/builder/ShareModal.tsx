"use client";

import { useState, useEffect, useRef } from "react";
import { X, LinkSimple, CheckCircle, ArrowSquareOut, Globe, Lock } from "@phosphor-icons/react";
import { toggleFormPublicAction, updateFormSlugAction } from "../../form-actions";
import type { Form } from "@/lib/admin/forms-types";
import styles from "./ShareModal.module.css";

type Props = {
  form: Form;
  onClose: () => void;
  onIsPublicChange: (isPublic: boolean) => void;
};

export function ShareModal({ form, onClose, onIsPublicChange }: Props) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [isPublic, setIsPublic] = useState(form.is_public);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugDraft, setSlugDraft] = useState(form.slug ?? "");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugSaving, setSlugSaving] = useState(false);
  const slugInputRef = useRef<HTMLInputElement>(null);

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.myproxyhost.com");

  const publicUrl = form.slug ? `${appUrl}/f/${form.slug}` : null;
  const isActive = form.is_active;
  const canShare = isActive && !!form.slug;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (editingSlug && slugInputRef.current) {
      slugInputRef.current.focus();
      slugInputRef.current.select();
    }
  }, [editingSlug]);

  function handleCopy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  async function handleTogglePublic() {
    if (!isActive || !form.slug) return;
    setToggling(true);
    const next = !isPublic;
    setIsPublic(next);
    onIsPublicChange(next);
    const res = await toggleFormPublicAction(form.id, next);
    if (!res.ok) {
      // Revert the optimistic toggle so the UI never shows a false success.
      setIsPublic(!next);
      onIsPublicChange(!next);
    }
    setToggling(false);
  }

  function handleStartEditSlug() {
    setSlugDraft(form.slug ?? "");
    setSlugError(null);
    setEditingSlug(true);
  }

  function handleCancelEditSlug() {
    setEditingSlug(false);
    setSlugError(null);
    setSlugDraft(form.slug ?? "");
  }

  async function handleSaveSlug() {
    const trimmed = slugDraft.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!trimmed) {
      setSlugError("Slug cannot be empty");
      return;
    }
    setSlugSaving(true);
    setSlugError(null);
    const result = await updateFormSlugAction(form.id, trimmed);
    setSlugSaving(false);
    if (result.error) {
      setSlugError(result.error);
      return;
    }
    setEditingSlug(false);
  }

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Share form">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Share form</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} weight="bold" />
          </button>
        </div>

        {!canShare ? (
          <div className={styles.section}>
            <div className={styles.infoBlock}>
              <span className={styles.infoBlockText}>
                {!isActive
                  ? "Publish this form first to get a shareable link."
                  : "This form needs a URL slug. Publish it to generate one."}
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.section}>
              <span className={styles.label}>Public link</span>
              <div className={styles.urlRow}>
                <input
                  type="text"
                  className={styles.urlInput}
                  value={publicUrl ?? ""}
                  readOnly
                  aria-label="Public form URL"
                />
                <a
                  href={publicUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.openBtn}
                  aria-label="Open in new tab"
                >
                  <ArrowSquareOut size={15} weight="bold" />
                </a>
                <button
                  type="button"
                  className={`${styles.copyBtn} ${copied ? styles.copiedState : ""}`}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <CheckCircle size={14} weight="bold" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <LinkSimple size={14} weight="bold" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              {!editingSlug ? (
                <div className={styles.slugRow}>
                  <span className={styles.slugDisplay}>/f/{form.slug}</span>
                  <button
                    type="button"
                    className={styles.editUrlLink}
                    onClick={handleStartEditSlug}
                  >
                    Edit URL
                  </button>
                </div>
              ) : (
                <div className={styles.slugEditBlock}>
                  <div className={styles.slugEditRow}>
                    <span className={styles.slugPrefix}>/f/</span>
                    <input
                      ref={slugInputRef}
                      type="text"
                      className={styles.slugInput}
                      value={slugDraft}
                      onChange={(e) => setSlugDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveSlug();
                        if (e.key === "Escape") handleCancelEditSlug();
                      }}
                      placeholder="form-url-slug"
                      aria-label="Form URL slug"
                    />
                    <button
                      type="button"
                      className={styles.slugSaveBtn}
                      onClick={handleSaveSlug}
                      disabled={slugSaving}
                    >
                      {slugSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      className={styles.slugCancelBtn}
                      onClick={handleCancelEditSlug}
                    >
                      Cancel
                    </button>
                  </div>
                  {slugError && (
                    <p className={styles.slugError}>{slugError}</p>
                  )}
                </div>
              )}
            </div>

            <div className={styles.divider} />
          </>
        )}

        <div className={styles.section}>
          <div className={`${styles.toggleRow} ${!canShare ? styles.toggleRowDisabled : ""}`}>
            <div className={styles.toggleLabel}>
              <span className={styles.toggleLabelIcon}>
                {isPublic ? (
                  <Globe size={15} weight="bold" />
                ) : (
                  <Lock size={15} weight="bold" />
                )}
              </span>
              <div className={styles.toggleLabelText}>
                <span className={styles.toggleLabelPrimary}>
                  {isPublic ? "Anyone with the link can fill this form" : "Only invited users can fill this form"}
                </span>
                {!canShare && (
                  <span className={styles.toggleLabelHint}>Publish first to enable sharing</span>
                )}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              className={`${styles.toggle} ${isPublic ? styles.toggleOn : ""}`}
              onClick={handleTogglePublic}
              disabled={!canShare || toggling}
              aria-label="Toggle public access"
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
