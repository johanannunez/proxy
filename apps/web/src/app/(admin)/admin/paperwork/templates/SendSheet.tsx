"use client";

/**
 * SendSheet — send a template to many recipients with a live client preview.
 * The right pane renders exactly what the recipient will see (the notification
 * email and their portal card) before anything goes out, which doubles as
 * error prevention (premium upgrade 4, 2026-06-12 design doc).
 *
 * Signature templates: multi-select owners, one tracked document instance per
 * recipient lands in the Documents tab. Form templates: the form is link-based,
 * so the sheet previews the fill experience and hands you the share link.
 */

import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  X,
  PaperPlaneTilt,
  PenNib,
  Rows,
  Eye,
  Check,
  LinkSimple,
  ArrowSquareOut,
  SpinnerGap,
} from "@phosphor-icons/react";
import { avatarColor } from "@/lib/admin/documents-hub-shared";
import { sendTemplateToOwners } from "./template-send-actions";
import type { SendRecipient, UnifiedTemplate } from "./unified-types";
import styles from "./SendSheet.module.css";

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function firstNameOf(name: string): string {
  return name.split(" ")[0] ?? name;
}

function EmailPreview({
  template,
  recipientName,
}: {
  template: UnifiedTemplate;
  recipientName: string;
}) {
  return (
    <div>
      <div className={styles.portalMockLabel} style={{ marginBottom: 8 }}>
        The email they receive
      </div>
      <div className={styles.emailMock} aria-label="Email preview">
        <div className={styles.emailMockHeader}>
          <div className={styles.emailMockMetaRow}>
            <span className={styles.emailMockMetaLabel}>From</span>
            <span>Proxy &lt;documents@myproxyhost.com&gt;</span>
          </div>
          <div className={styles.emailMockMetaRow}>
            <span className={styles.emailMockMetaLabel}>To</span>
            <span>{recipientName}</span>
          </div>
          <div className={styles.emailMockSubject}>
            {template.name} is ready for your signature
          </div>
        </div>
        <div className={styles.emailMockBody}>
          <span>Hi {firstNameOf(recipientName)},</span>
          <span>
            {template.name} is ready for you to review and sign. It takes about
            two minutes, right from your browser.
          </span>
          <span className={styles.emailMockBtn}>Review and sign</span>
        </div>
      </div>
    </div>
  );
}

function PortalCardPreview({
  template,
  recipientName,
}: {
  template: UnifiedTemplate;
  recipientName: string;
}) {
  return (
    <div>
      <div className={styles.portalMockLabel} style={{ marginBottom: 8 }}>
        Their portal checklist card
      </div>
      <div className={styles.portalCard} aria-label="Portal card preview">
        <span className={styles.portalCardIcon}>
          {template.kind === "form" ? (
            <Rows size={17} weight="duotone" />
          ) : (
            <PenNib size={17} weight="duotone" />
          )}
        </span>
        <span className={styles.portalCardBody}>
          <span className={styles.portalCardTitle}>{template.name}</span>
          <span className={styles.portalCardSub}>
            {template.kind === "form"
              ? `Waiting on ${firstNameOf(recipientName)} to fill this out`
              : `Waiting on ${firstNameOf(recipientName)} to sign`}
          </span>
        </span>
        <span className={styles.portalCardCta}>
          {template.kind === "form" ? "Fill out" : "Sign now"}
        </span>
      </div>
    </div>
  );
}

export function SendSheet({
  template,
  recipients,
  onClose,
}: {
  template: UnifiedTemplate;
  recipients: SendRecipient[];
  onClose: () => void;
}) {
  const isForm = template.kind === "form";
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const formUrl =
    isForm && template.slug
      ? `${typeof window !== "undefined" ? window.location.origin : "https://www.myproxyhost.com"}/f/${template.slug}`
      : null;

  const visibleRecipients = useMemo(
    () =>
      recipients.filter((r) =>
        search
          ? r.name.toLowerCase().includes(search.toLowerCase()) ||
            r.email.toLowerCase().includes(search.toLowerCase())
          : true,
      ),
    [recipients, search],
  );

  function alreadyHas(recipient: SendRecipient): boolean {
    return Boolean(
      template.documentKey &&
        recipient.activeDocumentKeys.includes(template.documentKey),
    );
  }

  const selectable = visibleRecipients.filter((r) => !alreadyHas(r));
  const allSelected =
    selectable.length > 0 && selectable.every((r) => selected.has(r.profileId));

  function toggle(profileId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectable.map((r) => r.profileId)));
  }

  const previewRecipient =
    recipients.find((r) => selected.has(r.profileId)) ?? recipients[0] ?? null;
  const previewName = previewRecipient?.name ?? "your client";

  function handleSend() {
    setError(null);
    setSuccess(null);
    startSending(async () => {
      const res = await sendTemplateToOwners(template.id, [...selected]);
      if (!res.ok) {
        setError(res.error ?? "Send failed.");
        return;
      }
      setSuccess(
        `Sent to ${res.sent} ${res.sent === 1 ? "recipient" : "recipients"}.${
          res.error ? ` Some were skipped: ${res.error}` : ""
        }`,
      );
      setSelected(new Set());
    });
  }

  function handleCopyLink() {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
      />
      <motion.aside
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`Send ${template.name}`}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className={styles.header}>
          <span className={styles.headerIcon}>
            <PaperPlaneTilt size={16} weight="duotone" />
          </span>
          <div className={styles.headerText}>
            <h2 className={styles.title}>Send {template.name}</h2>
            <p className={styles.subtitle}>
              {isForm
                ? "Forms are link-based: share the link below, or send it from your own inbox."
                : "Each recipient gets their own tracked copy in the Documents tab."}
            </p>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className={`${styles.body} ${isForm ? styles.bodyFormMode : ""}`}>
          {!isForm && (
            <div className={styles.recipientsPane}>
              <div className={styles.paneLabel}>Recipients</div>
              <input
                type="text"
                className={styles.recipientSearch}
                placeholder="Search owners…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search recipients"
              />
              <label className={styles.selectAllRow}>
                <input
                  type="checkbox"
                  className={styles.recipientCheckbox}
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all eligible recipients"
                />
                Select all eligible
              </label>
              <div className={styles.recipientList} role="list">
                {visibleRecipients.map((r) => {
                  const has = alreadyHas(r);
                  return (
                    <button
                      key={r.profileId}
                      type="button"
                      role="listitem"
                      className={`${styles.recipientRow} ${has ? styles.recipientRowDisabled : ""}`}
                      onClick={() => !has && toggle(r.profileId)}
                      disabled={has}
                    >
                      <input
                        type="checkbox"
                        className={styles.recipientCheckbox}
                        checked={selected.has(r.profileId)}
                        readOnly
                        tabIndex={-1}
                        aria-hidden
                      />
                      {r.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.avatarUrl}
                          alt=""
                          className={styles.recipientAvatar}
                          style={{ objectFit: "cover" }}
                        />
                      ) : (
                        <span
                          className={styles.recipientAvatar}
                          style={{ background: avatarColor(r.name) }}
                        >
                          {initialsOf(r.name)}
                        </span>
                      )}
                      <span className={styles.recipientMeta}>
                        <span className={styles.recipientName}>{r.name}</span>
                        <span className={styles.recipientEmail}>{r.email}</span>
                      </span>
                      {has && <span className={styles.alreadyTag}>Already has it</span>}
                    </button>
                  );
                })}
                {visibleRecipients.length === 0 && (
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-secondary)",
                      padding: "8px 10px",
                    }}
                  >
                    No owners match that search.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className={styles.previewPane}>
            <span className={styles.previewHint}>
              <Eye size={13} weight="duotone" />
              Live preview: exactly what {firstNameOf(previewName)} will see
            </span>

            {isForm && formUrl && (
              <div className={styles.linkBlock}>
                <span className={styles.linkText}>{formUrl}</span>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${copied ? styles.linkBtnCopied : ""}`}
                  onClick={handleCopyLink}
                >
                  {copied ? <Check size={12} weight="bold" /> : <LinkSimple size={12} weight="bold" />}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkBtn}
                >
                  <ArrowSquareOut size={12} weight="bold" />
                  Open
                </a>
              </div>
            )}

            {!isForm && (
              <EmailPreview template={template} recipientName={previewName} />
            )}
            <PortalCardPreview template={template} recipientName={previewName} />
          </div>
        </div>

        <div className={styles.footer}>
          {!isForm && (
            <span className={styles.footerCount}>
              {selected.size === 0
                ? "Select who should receive this"
                : `${selected.size} ${selected.size === 1 ? "recipient" : "recipients"} selected`}
            </span>
          )}
          {error && <span className={styles.footerError}>{error}</span>}
          {success && <span className={styles.footerSuccess}>{success}</span>}
          {isForm ? (
            <button
              type="button"
              className={styles.sendAction}
              onClick={handleCopyLink}
              disabled={!formUrl}
            >
              {copied ? <Check size={14} weight="bold" /> : <LinkSimple size={14} weight="bold" />}
              {copied ? "Link copied" : "Copy share link"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.sendAction}
              onClick={handleSend}
              disabled={sending || selected.size === 0}
            >
              {sending ? (
                <SpinnerGap size={14} weight="bold" />
              ) : (
                <PaperPlaneTilt size={14} weight="bold" />
              )}
              {sending
                ? "Sending…"
                : `Send to ${selected.size === 0 ? "recipients" : selected.size}`}
            </button>
          )}
        </div>
      </motion.aside>
    </>
  );
}
