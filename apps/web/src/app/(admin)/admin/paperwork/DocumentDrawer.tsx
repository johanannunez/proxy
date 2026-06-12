"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  X,
  FileText,
  ShieldCheck,
  DownloadSimple,
  ClipboardText,
  Check,
  CaretDown,
  CaretRight,
  PaperPlaneTilt,
  Bell,
  Info,
  CheckCircle,
  Clock,
  Circle,
  Phone,
  EnvelopeSimple,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  fmtDate,
  avatarColor,
  type DocHubOwner,
  type SecureDocKey,
  type FormKey,
  type SignedDocRow,
} from "@/lib/admin/documents-hub-shared";
import { DocumentTimeline } from "@/components/workspace/documents/DocumentTimeline";
import type { TimelineEvent } from "@/components/workspace/documents/packet-types";
import { sendDocumentToOwner, sendDocumentReminder } from "./document-actions";
import styles from "./DocumentDrawer.module.css";

type DocKey = SecureDocKey | FormKey;

function isSecureKey(key: DocKey): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

/* ─── Copy button ─── */
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ""}`}
      onClick={handleCopy}
      title="Copy"
      type="button"
    >
      {copied ? <Check size={11} weight="bold" /> : <ClipboardText size={12} />}
    </button>
  );
}

/* ─── Field row ─── */
function FieldRow({
  label,
  value,
  mono,
  href,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  href?: string;
}) {
  const display = value ?? null;
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLabel}>{label}</div>
      <div
        className={`${styles.fieldValue} ${mono ? styles.fieldValueMono : ""} ${!display ? styles.fieldValueEmpty : ""}`}
      >
        {href && display ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline"
            style={{ color: "var(--color-brand)" }}
          >
            View document <ArrowSquareOut size={13} />
          </a>
        ) : (
          <>
            {display ?? "—"}
            {display && <CopyBtn value={display} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Owner header card ─── */
function OwnerHeaderCard({ owner }: { owner: DocHubOwner }) {
  const initials = owner.fullName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className={styles.ownerCard}>
      {owner.avatarUrl ? (
        <img
          src={owner.avatarUrl}
          alt={owner.fullName}
          className={styles.ownerCardAvatar}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div
          className={styles.ownerCardAvatar}
          style={{ background: avatarColor(owner.fullName) }}
        >
          {initials}
        </div>
      )}
      <div className={styles.ownerCardMeta}>
        <div className={styles.ownerCardName}>{owner.fullName}</div>
        <div className={styles.ownerCardContacts}>
          <span className={styles.ownerContactItem}>
            <EnvelopeSimple size={11} style={{ flexShrink: 0, color: "#9ca3af" }} />
            <span className={styles.ownerContactValue}>{owner.email}</span>
            <CopyBtn value={owner.email} />
          </span>
          {owner.phone && (
            <span className={styles.ownerContactItem}>
              <Phone size={11} style={{ flexShrink: 0, color: "#9ca3af" }} />
              <span className={styles.ownerContactValue}>{owner.phone}</span>
              <CopyBtn value={owner.phone} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Doc context bar ─── */
function DocContextBar({
  docKey,
  status,
  onClose,
}: {
  docKey: DocKey;
  status: "completed" | "pending" | "not_sent";
  onClose: () => void;
}) {
  const isSecure = isSecureKey(docKey);
  const def = isSecure
    ? SECURE_DOC_TYPES[docKey as SecureDocKey]
    : FORM_TYPES[docKey as FormKey];

  const badgeClass =
    status === "completed"
      ? styles.badgeCompleted
      : status === "pending"
      ? styles.badgePending
      : styles.badgeNotSent;
  const badgeLabel =
    status === "completed" ? "Completed" : status === "pending" ? "Pending" : "Not Sent";

  return (
    <div className={styles.docContextBar}>
      <div
        className={styles.docContextIcon}
        style={{ background: `${def.color}18`, color: def.color }}
      >
        {isSecure ? (
          <ShieldCheck size={13} weight="duotone" />
        ) : (
          <FileText size={13} weight="duotone" />
        )}
      </div>
      <span className={styles.docContextName}>{def.label}</span>
      {isSecure && (
        <span className={`${styles.statusBadge} ${badgeClass}`}>{badgeLabel}</span>
      )}
      <div style={{ flex: 1 }} />
      <button className={styles.btnClose} onClick={onClose} title="Close" type="button">
        <X size={13} weight="bold" />
      </button>
    </div>
  );
}

/* ─── Stat cards (replaces timeline) ─── */
function StatCards({
  latest,
  status,
}: {
  latest: SignedDocRow | null;
  status: "completed" | "pending" | "not_sent";
}) {
  if (!latest) {
    return (
      <div className={styles.statCardsRow}>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Sent</div>
          <div className={`${styles.statCardValue} ${styles.statCardEmpty}`}>Not sent yet</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Signed</div>
          <div className={`${styles.statCardValue} ${styles.statCardEmpty}`}>—</div>
        </div>
      </div>
    );
  }

  const sentLabel = latest.sentAt ? fmtDate(latest.sentAt) : fmtDate(latest.createdAt);
  const byLabel = latest.sentByName ? `by ${latest.sentByName}` : "";

  return (
    <div className={styles.statCardsRow}>
      <div className={styles.statCard}>
        <div className={styles.statCardLabel}>Sent</div>
        <div className={styles.statCardValue}>{sentLabel}</div>
        {byLabel && <div className={styles.statCardSub}>{byLabel}</div>}
      </div>
      <div
        className={`${styles.statCard} ${
          status === "completed"
            ? styles.statCardSigned
            : status === "pending"
            ? styles.statCardPending
            : ""
        }`}
      >
        <div className={styles.statCardLabel}>Signed</div>
        {status === "completed" ? (
          <div className={styles.statCardValue} style={{ color: "#15803d" }}>
            {fmtDate(latest.signedAt)}
          </div>
        ) : (
          <div className={`${styles.statCardValue} ${styles.statCardAwaitingText}`}>
            Awaiting
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Timeline events from the signature row's lifecycle timestamps ───
   Same shared component as the workspace portal; events derive from the real
   created/sent/signed timestamps on the documents spine. */
function buildTimelineEvents(latest: SignedDocRow, ownerName: string): TimelineEvent[] {
  const events: TimelineEvent[] = [{ event: "created", timestamp: latest.createdAt }];
  if (latest.sentAt) {
    events.push({
      event: "sent",
      timestamp: latest.sentAt,
      actor: latest.sentByName ?? "Proxy",
    });
  }
  if (latest.signedAt) {
    events.push({ event: "signed", timestamp: latest.signedAt, actor: ownerName });
    const s = latest.status?.toLowerCase();
    if (s === "on_file" || s === "completed") {
      events.push({ event: "on_file", timestamp: latest.signedAt });
    }
  }
  return events;
}

/* ─── Secure doc body ─── */
function SecureDocBody({
  docKey,
  latest,
}: {
  docKey: SecureDocKey;
  latest: SignedDocRow | null;
}) {
  const def = SECURE_DOC_TYPES[docKey];
  const isSensitive = docKey === "card_authorization" || docKey === "ach_authorization";

  return (
    <div>
      <div className={styles.sectionLabel}>Document Details</div>
      <div className={styles.fieldGrid}>
        <FieldRow label="Document" value={def.label} />
        <FieldRow label="Template" value={latest?.templateName ?? def.templateNames[0]} />
        {latest && <FieldRow label="BoldSign ID" value={latest.boldsignDocumentId} mono />}
        {latest && (
          <FieldRow
            label="Status"
            value={
              latest.status
                ? latest.status.charAt(0).toUpperCase() + latest.status.slice(1)
                : "—"
            }
          />
        )}
      </div>
      {isSensitive && latest && (
        <div className={styles.noteBlock} style={{ marginTop: 12 }}>
          <Info size={14} weight="duotone" style={{ flexShrink: 0, marginTop: 1 }} />
          Field data is stored in the signed PDF. Download the completed document to access
          card or routing numbers.
        </div>
      )}
    </div>
  );
}

/* ─── Form body ─── */
function FormBody({ docKey, owner }: { docKey: FormKey; owner: DocHubOwner }) {
  const entry = owner.forms[docKey];
  const def = FORM_TYPES[docKey];

  const hasPartialData = Object.keys(entry.data).length > 0;
  if (!entry.submitted && !hasPartialData) {
    return (
      <div>
        <div className={styles.sectionLabel}>Form Responses</div>
        <div className={styles.drawerEmptyState}>
          <FileText size={28} style={{ color: "#d1d5db" }} />
          <p className={styles.drawerEmptyTitle}>Not submitted</p>
          <p className={styles.drawerEmptyBody}>
            {owner.fullName} has not submitted the {def.label} form yet.
          </p>
        </div>
      </div>
    );
  }

  const fields = Object.entries(entry.data).filter(([, v]) => v !== undefined);

  return (
    <div>
      <div className={styles.sectionLabel}>Form Responses</div>
      <div className={styles.fieldGrid}>
        {fields.map(([label, value]) => {
          const isUrl = label.endsWith("_url") && typeof value === "string" && value.startsWith("http");
          const displayLabel = label.replace(/_url$/, "").replace(/_/g, " ");
          return (
            <FieldRow
              key={label}
              label={displayLabel}
              value={isUrl ? value : (value as string)}
              href={isUrl ? (value as string) : undefined}
              mono={
                !isUrl && (
                  label.toLowerCase().includes("password") ||
                  label.toLowerCase().includes("ssid")
                )
              }
            />
          );
        })}
        {fields.length === 0 && (
          <div className={styles.fieldRow}>
            <div className={styles.fieldLabel}>—</div>
            <div className={`${styles.fieldValue} ${styles.fieldValueEmpty}`}>
              No fields recorded
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Doc switcher ─── */
function DocSwitcher({
  owner,
  activeDocKey,
  onSwitch,
}: {
  owner: DocHubOwner;
  activeDocKey: DocKey;
  onSwitch: (key: DocKey) => void;
}) {
  return (
    <div>
      <div className={styles.sectionLabel}>All Documents</div>

      <div className={styles.switcherGroupLabel}>SecureDocs</div>
      <div className={styles.overviewGrid}>
        {(Object.keys(SECURE_DOC_TYPES) as SecureDocKey[]).map((k) => {
          const entry = owner.secureDocs[k];
          const def = SECURE_DOC_TYPES[k];
          const isActive = k === activeDocKey;
          const s = entry.status;
          const Icon =
            s === "completed" ? CheckCircle : s === "pending" ? Clock : Circle;
          const iconColor =
            s === "completed" ? "#16a34a" : s === "pending" ? "#d97706" : "#d1d5db";
          const sentDate = entry.latest?.sentAt ?? entry.latest?.createdAt;
          return (
            <button
              key={k}
              className={`${styles.overviewRow} ${isActive ? styles.overviewRowActive : ""}`}
              onClick={() => onSwitch(k)}
              type="button"
            >
              <Icon
                size={13}
                weight={s === "completed" ? "fill" : "duotone"}
                style={{ color: iconColor, flexShrink: 0 }}
              />
              <span className={styles.overviewLabel}>{def.shortLabel}</span>
              <span
                className={styles.overviewStatus}
                style={{
                  color:
                    s === "completed" ? "#15803d" : s === "pending" ? "#b45309" : "#9ca3af",
                }}
              >
                {s === "completed" ? "Signed" : s === "pending" ? "Pending" : "Not sent"}
              </span>
              {sentDate && (
                <span className={styles.overviewDate}>{fmtDate(sentDate)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.switcherGroupLabel} style={{ marginTop: 10 }}>
        Forms
      </div>
      <div className={styles.overviewGrid}>
        {(Object.keys(FORM_TYPES) as FormKey[]).map((k) => {
          const entry = owner.forms[k];
          const def = FORM_TYPES[k];
          const isActive = k === activeDocKey;
          const submitted = entry.submitted;
          return (
            <button
              key={k}
              className={`${styles.overviewRow} ${isActive ? styles.overviewRowActive : ""}`}
              onClick={() => onSwitch(k)}
              type="button"
            >
              <CheckCircle
                size={13}
                weight={submitted ? "fill" : "duotone"}
                style={{ color: submitted ? "#16a34a" : "#d1d5db", flexShrink: 0 }}
              />
              <span className={styles.overviewLabel}>{def.shortLabel}</span>
              <span
                className={styles.overviewStatus}
                style={{ color: submitted ? "#15803d" : "#9ca3af" }}
              >
                {submitted ? "Submitted" : "Not submitted"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Version history ─── */
function VersionHistory({ versions }: { versions: SignedDocRow[] }) {
  const [open, setOpen] = useState(false);
  if (versions.length === 0) return null;

  return (
    <div className={styles.versions}>
      <button
        className={styles.versionsToggle}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        Version History ({versions.length})
      </button>
      {open && (
        <div className={styles.versionsList}>
          {versions.map((v, i) => (
            <div key={v.id} className={styles.versionItem}>
              <span className={styles.versionBadge}>v{versions.length - i}</span>
              <span className={styles.versionDate}>
                {fmtDate(v.sentAt ?? v.createdAt)}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color:
                    v.status === "completed"
                      ? "#15803d"
                      : v.status === "pending"
                      ? "#b45309"
                      : "#9ca3af",
                  fontWeight: 500,
                }}
              >
                {v.status === "completed"
                  ? "Signed"
                  : v.status === "pending"
                  ? "Pending"
                  : "Not sent"}
              </span>
              {v.signedPdfUrl && (
                <a
                  href={v.signedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.versionPdfLink}
                  onClick={(e) => e.stopPropagation()}
                >
                  PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Drawer ─── */
export function DocumentDrawer({
  owner,
  initialDocKey,
  onClose,
}: {
  owner: DocHubOwner;
  initialDocKey: DocKey;
  onClose: () => void;
}) {
  const [activeDocKey, setActiveDocKey] = useState<DocKey>(initialDocKey);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const secure = isSecureKey(activeDocKey);
  const secureEntry = secure ? owner.secureDocs[activeDocKey as SecureDocKey] : null;
  const status = secureEntry?.status ?? "not_sent";
  const latest = secureEntry?.latest ?? null;
  const versions = secureEntry?.versions ?? [];

  function handleSwitch(key: DocKey) {
    setActiveDocKey(key);
    setError(null);
  }

  function handleSend() {
    if (!owner.profileId) return;
    setError(null);
    startTransition(async () => {
      const res = await sendDocumentToOwner(
        owner.profileId!,
        owner.email,
        owner.fullName,
        activeDocKey as SecureDocKey,
      );
      if (!res.ok) setError(res.error ?? "Failed");
      else onClose();
    });
  }

  function handleRemind() {
    if (!latest) return;
    setError(null);
    startTransition(async () => {
      const res = await sendDocumentReminder(
        latest.id,
        latest.boldsignDocumentId,
        owner.email,
      );
      if (!res.ok) setError(res.error ?? "Failed");
    });
  }

  return (
    <>
      <motion.div
        className={styles.backdrop}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
      />

      <motion.aside
        className={styles.drawer}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        aria-label="Document details"
      >
        {/* Owner card */}
        <OwnerHeaderCard owner={owner} />

        {/* Doc context bar */}
        <DocContextBar docKey={activeDocKey} status={status} onClose={onClose} />

        {/* Stat cards — SecureDocs only */}
        {secure && <StatCards latest={latest} status={status} />}

        {/* Body */}
        <div className={styles.drawerBody}>
          {/* Activity timeline — shared with the workspace portal */}
          {secure && latest && (
            <DocumentTimeline events={buildTimelineEvents(latest, owner.fullName)} />
          )}

          {secure ? (
            <SecureDocBody docKey={activeDocKey as SecureDocKey} latest={latest} />
          ) : (
            <FormBody docKey={activeDocKey as FormKey} owner={owner} />
          )}

          <DocSwitcher owner={owner} activeDocKey={activeDocKey} onSwitch={handleSwitch} />

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#b91c1c",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Versions */}
        {secure && versions.length > 0 && <VersionHistory versions={versions} />}

        {/* Footer */}
        <div className={styles.drawerFooter}>
          <div className={styles.footerLeft}>
            {latest?.signedPdfUrl && (
              <a
                href={latest.signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.btnDownload}
              >
                <DownloadSimple size={14} weight="duotone" />
                Download PDF
              </a>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {secure && status === "not_sent" && owner.profileId && (
              <button
                className={styles.btnSendFooter}
                onClick={handleSend}
                disabled={pending}
                type="button"
              >
                <PaperPlaneTilt size={13} weight="bold" />
                {pending ? "Sending..." : "Send Document"}
              </button>
            )}
            {secure && status === "pending" && latest && (
              <button
                className={styles.btnRemindFooter}
                onClick={handleRemind}
                disabled={pending}
                type="button"
              >
                <Bell size={13} weight="duotone" />
                {pending ? "Sending..." : "Send Reminder"}
              </button>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}
