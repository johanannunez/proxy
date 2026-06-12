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
  BellSlash,
  Eye,
  Info,
  CheckCircle,
  Clock,
  Circle,
  Phone,
  EnvelopeSimple,
  Certificate,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  fmtDate,
  avatarColor,
  stageOfSignedDoc,
  nextReminderDate,
  fmtReminderDay,
  fmtRelativeTime,
  firstNameOf,
  type DocHubOwner,
  type SecureDocKey,
  type FormKey,
  type SignedDocRow,
} from "@/lib/admin/documents-hub-shared";
import { DocumentTimeline } from "@/components/workspace/documents/DocumentTimeline";
import type { TimelineEvent } from "@/components/workspace/documents/packet-types";
import {
  sendDocumentToOwner,
  sendDocumentReminder,
  setDocumentReminderMute,
  getDocumentAuditLog,
  type DocumentAuditLog,
} from "./document-actions";
import { StageMeter } from "./StageMeter";
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
            <EnvelopeSimple size={11} style={{ flexShrink: 0, color: "var(--text-tertiary)" }} />
            <span className={styles.ownerContactValue}>{owner.email}</span>
            <CopyBtn value={owner.email} />
          </span>
          {owner.phone && (
            <span className={styles.ownerContactItem}>
              <Phone size={11} style={{ flexShrink: 0, color: "var(--text-tertiary)" }} />
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

/* ─── Status panel: stage meter + verb-first status + reminders ───
   Human language naming who owes what, the package-tracking stage meter, the
   "Viewed Xh ago" engagement chip, and the visible auto-reminder schedule with
   a per-document mute (premium upgrades 1, 2, 3, 7). */
function statusSentence(
  latest: SignedDocRow | null,
  status: "completed" | "pending" | "not_sent",
  ownerName: string,
): string {
  if (!latest || status === "not_sent") {
    return `Not sent to ${firstNameOf(ownerName)} yet`;
  }
  if (status === "completed") {
    return latest.signedAt
      ? `${firstNameOf(ownerName)} signed this on ${fmtDate(latest.signedAt)}`
      : `Signed and on file`;
  }
  const s = latest.status?.toLowerCase();
  if (s === "awaiting_countersignature") {
    return `${firstNameOf(ownerName)} signed. Waiting on you to countersign`;
  }
  const since = latest.sentAt ?? latest.createdAt;
  const days = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));
  const dayLabel = days === 0 ? "sent today" : `${days} ${days === 1 ? "day" : "days"}`;
  return `Waiting on ${firstNameOf(ownerName)} to sign · ${dayLabel}`;
}

function StatusPanel({
  latest,
  status,
  ownerName,
}: {
  latest: SignedDocRow | null;
  status: "completed" | "pending" | "not_sent";
  ownerName: string;
}) {
  const [muted, setMuted] = useState(latest?.remindersMuted ?? false);
  const [mutePending, startMuteTransition] = useTransition();

  const stage = latest ? stageOfSignedDoc(latest) : "created";
  const reminderDue =
    latest && status === "pending" && !muted
      ? nextReminderDate({ ...latest, remindersMuted: muted })
      : null;
  const roundsSpent = latest ? latest.reminderRoundsSent >= 3 : false;

  function handleToggleMute() {
    if (!latest) return;
    const next = !muted;
    setMuted(next);
    startMuteTransition(async () => {
      const res = await setDocumentReminderMute(latest.id, next);
      if (!res.ok) setMuted(!next);
    });
  }

  return (
    <div className={styles.statusPanel}>
      <StageMeter stage={status === "not_sent" ? "created" : stage} />
      <div className={styles.statusSentenceRow}>
        <span className={styles.statusSentence}>
          {statusSentence(latest, status, ownerName)}
        </span>
        {latest?.viewedAt && status === "pending" && (
          <span className={styles.viewedChip}>
            <Eye size={11} weight="duotone" />
            Viewed {fmtRelativeTime(latest.viewedAt)}
          </span>
        )}
      </div>
      {latest && status === "pending" && (
        <div className={styles.reminderRow}>
          {muted ? (
            <span className={styles.reminderTextMuted}>
              <BellSlash size={12} weight="duotone" />
              Auto-reminders are muted for this document
            </span>
          ) : roundsSpent ? (
            <span className={styles.reminderTextMuted}>
              <Bell size={12} weight="duotone" />
              All three auto-reminder rounds have gone out
            </span>
          ) : reminderDue ? (
            <span className={styles.reminderText}>
              <Bell size={12} weight="duotone" />
              Auto-reminder goes out {fmtReminderDay(reminderDue)}
            </span>
          ) : null}
          {!roundsSpent && (
            <button
              type="button"
              className={styles.muteBtn}
              onClick={handleToggleMute}
              disabled={mutePending}
            >
              {muted ? "Turn reminders on" : "Mute reminders"}
            </button>
          )}
        </div>
      )}
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
  if (latest.viewedAt) {
    events.push({ event: "viewed", timestamp: latest.viewedAt, actor: ownerName });
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
                ? latest.status.charAt(0).toUpperCase() +
                  latest.status.slice(1).replace(/_/g, " ")
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
          <FileText size={28} style={{ color: "var(--border-strong)" }} />
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
            s === "completed" ? "var(--color-success)" : s === "pending" ? "var(--status-warning)" : "var(--border-strong)";
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
                    s === "completed" ? "var(--status-success-fg)" : s === "pending" ? "var(--status-warning-fg)" : "var(--text-tertiary)",
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
                style={{ color: submitted ? "var(--color-success)" : "var(--border-strong)", flexShrink: 0 }}
              />
              <span className={styles.overviewLabel}>{def.shortLabel}</span>
              <span
                className={styles.overviewStatus}
                style={{ color: submitted ? "var(--status-success-fg)" : "var(--text-tertiary)" }}
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
                      ? "var(--status-success-fg)"
                      : v.status === "pending"
                      ? "var(--status-warning-fg)"
                      : "var(--text-tertiary)",
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

/* ─── Certificate of completion / audit panel (premium upgrade 6) ─── */

const AUDIT_EVENT_LABELS: Record<string, string> = {
  "form.viewed": "Opened the document",
  "form.started": "Started filling it out",
  "form.completed": "Signed",
  "submission.completed": "All parties signed",
  "form.declined": "Declined to sign",
  "submission.expired": "The signing request expired",
};

function AuditPanel({
  documentId,
  completed,
}: {
  documentId: string;
  completed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<DocumentAuditLog | null>(null);
  const [loading, setLoading] = useState(false);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !log && !loading) {
      setLoading(true);
      getDocumentAuditLog(documentId)
        .then(setLog)
        .finally(() => setLoading(false));
    }
  }

  return (
    <div className={styles.auditPanel}>
      <button className={styles.versionsToggle} onClick={handleToggle} type="button">
        {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
        <Certificate size={13} weight="duotone" />
        Certificate and audit trail
      </button>
      {open && (
        <div className={styles.auditBody}>
          {loading && <div className={styles.auditLoading}>Loading the audit trail…</div>}
          {log && !log.ok && (
            <div className={styles.auditLoading}>{log.error ?? "Could not load the audit trail."}</div>
          )}
          {log?.ok && (
            <>
              {log.signers.length > 0 && (
                <div className={styles.auditSection}>
                  <div className={styles.auditSectionLabel}>Signers</div>
                  {log.signers.map((s, i) => (
                    <div key={`${s.signer_email}-${i}`} className={styles.auditRow}>
                      <span className={styles.auditRowMain}>
                        {s.signer_email ?? "Unknown signer"}
                        <span className={styles.auditRowRole}>
                          {s.role === "countersigner" ? "Countersigner" : "Signer"}
                        </span>
                      </span>
                      <span className={styles.auditRowMeta}>
                        {s.status === "signed"
                          ? `Signed ${s.signed_at ? fmtDate(s.signed_at) : ""}`
                          : "Has not signed yet"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.auditSection}>
                <div className={styles.auditSectionLabel}>Event log</div>
                {log.events.length === 0 ? (
                  <div className={styles.auditLoading}>
                    No tracked events yet. Events appear as the recipient opens
                    and signs the document.
                  </div>
                ) : (
                  log.events.map((e, i) => (
                    <div key={`${e.event_type}-${i}`} className={styles.auditRow}>
                      <span className={styles.auditRowMain}>
                        {AUDIT_EVENT_LABELS[e.event_type] ?? e.event_type}
                        {e.signer_email && (
                          <span className={styles.auditRowRole}>{e.signer_email}</span>
                        )}
                      </span>
                      <span className={styles.auditRowMeta}>{fmtDate(e.occurred_at)}</span>
                    </div>
                  ))
                )}
              </div>
              {completed && (
                <a
                  href={`/api/admin/documents/${documentId}/certificate`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.certificateLink}
                >
                  <DownloadSimple size={13} weight="bold" />
                  Download completion certificate
                </a>
              )}
              <p className={styles.auditNote}>
                The certificate includes signer email addresses, IP addresses,
                and the complete signing trail.
              </p>
            </>
          )}
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

        {/* Stage meter + verb-first status — SecureDocs only */}
        {secure && (
          <StatusPanel latest={latest} status={status} ownerName={owner.fullName} />
        )}

        {/* Body — two columns on desktop (metadata left, activity right),
            single column on mobile */}
        <div
          className={`${styles.drawerBody} ${
            secure && latest ? styles.drawerBodySplit : ""
          }`}
        >
          <div className={styles.bodyMain}>
            {secure ? (
              <SecureDocBody docKey={activeDocKey as SecureDocKey} latest={latest} />
            ) : (
              <FormBody docKey={activeDocKey as FormKey} owner={owner} />
            )}

            <DocSwitcher owner={owner} activeDocKey={activeDocKey} onSwitch={handleSwitch} />

            {error && <div className={styles.errorNote}>{error}</div>}
          </div>

          {/* Activity timeline — shared with the workspace portal */}
          {secure && latest && (
            <aside className={styles.bodySide} aria-label="Document activity">
              <DocumentTimeline events={buildTimelineEvents(latest, owner.fullName)} />
            </aside>
          )}
        </div>

        {/* Versions */}
        {secure && versions.length > 0 && <VersionHistory versions={versions} />}

        {/* Certificate of completion + audit trail */}
        {secure && latest && (
          <AuditPanel documentId={latest.id} completed={status === "completed"} />
        )}

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
