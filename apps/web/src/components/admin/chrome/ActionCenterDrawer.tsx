"use client";

/**
 * ActionCenterDrawer: on-demand paperwork command surface (2026-06-14 redesign,
 * Round 2 card treatment ported 2026-06-15). Right-side slide-over, toggled by a
 * CustomEvent from the Status Board header, lazy-fetching three sections:
 *   1. Needs attention: action queue with OpportunityCard-style cards.
 *   2. Expiring soon: renewal-window items (populated when expiry engine ships).
 *   3. Lapsed: past-expiry items (populated when expiry engine ships).
 *
 * Portal + event-toggle pattern mirrors NotificationPopover.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Lightning,
  X,
  CheckCircle,
  Bell,
  ArrowsClockwise,
  Eye,
  Signature,
  FileText,
  CaretDown,
  PenNib,
} from "@phosphor-icons/react";
import {
  sendDocumentToOwner,
  sendDocumentReminder,
} from "@/app/(admin)/admin/paperwork/document-actions";
import {
  SECURE_DOC_TYPES,
  type SecureDocKey,
  type SignedDocRow,
  stageOfSignedDoc,
  avatarColor,
  fmtShortDate,
} from "@/lib/admin/documents-hub-shared";
import type { ActionQueueItem, ActionQueuePrimaryAction } from "@/lib/admin/action-queue-types";
import type {
  ActionCenterItem,
  ActionCenterResponse,
} from "@/app/api/admin/action-center/route";
import styles from "./ActionCenterDrawer.module.css";

function isSecureKey(key: string): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

/* ─── Helpers ─── */

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

type BadgeTone = "overdue" | "awaiting" | "countersign" | "declined";

function badgeToneOf(item: ActionCenterItem): BadgeTone {
  if (item.urgency === "high") return "overdue";
  if (item.kind === "pending_countersignature") return "countersign";
  if (item.kind === "declined_signature") return "declined";
  return "awaiting";
}

function badgeLabelOf(item: ActionCenterItem): string {
  switch (item.kind) {
    case "declined_signature": return "Declined";
    case "stuck_review": return "Stuck";
    case "expiring_document": return "Expiring";
    case "pending_countersignature": return "Countersign";
    case "overdue_unsigned": return "Overdue";
    default: return "Pending";
  }
}

function headlineOf(item: ActionCenterItem): string {
  const d = item.days_waiting;
  const dayLabel = d === 1 ? "1 day" : `${d} days`;
  if (item.kind === "pending_countersignature") return `Waiting on you · ${dayLabel}`;
  if (item.kind === "stuck_review") return `Review needed · ${dayLabel}`;
  if (item.kind === "declined_signature") return `Declined ${dayLabel} ago`;
  return `${dayLabel} waiting`;
}

function contextOf(item: ActionCenterItem, row: SignedDocRow | null): string {
  const first = item.owner_name.split(" ")[0] ?? item.owner_name;

  if (item.kind === "declined_signature") {
    return `${first} declined this document. Resend when the issue is resolved.`;
  }
  if (item.kind === "pending_countersignature") {
    return `${first} has signed. Your countersignature is the final step.`;
  }
  if (item.kind === "stuck_review") {
    return `${first} completed their part. Your review is holding this up.`;
  }
  if (row?.viewedAt && !row.signedAt) {
    const rCount = row.reminderRoundsSent ?? 0;
    const reminderNote = rCount > 0 ? ` ${rCount} ${rCount === 1 ? "reminder" : "reminders"} sent.` : "";
    return `${first} opened it but has not signed yet.${reminderNote}`;
  }
  if (item.kind === "overdue_unsigned" && row && !row.viewedAt) {
    return `${first} has not opened this yet. A reminder may move things along.`;
  }
  const d = item.days_waiting;
  return `Sent ${d} ${d === 1 ? "day" : "days"} ago and still waiting on ${first}.`;
}

type ChipTone = "neutral" | "danger" | "warn" | "brand";

type Chip = { label: string; tone: ChipTone };

function chipsOf(item: ActionCenterItem, row: SignedDocRow | null): Chip[] {
  const chips: Chip[] = [];

  // Kind chip
  const isSignature = ["declined_signature", "pending_countersignature", "overdue_unsigned", "stuck_review"].includes(item.kind);
  chips.push({ label: isSignature ? "Signature" : "Form", tone: "neutral" });

  // Impact chip
  if (item.kind === "declined_signature") {
    chips.push({ label: "Re-send needed", tone: "danger" });
  } else if (item.urgency === "high") {
    chips.push({ label: "High urgency", tone: "danger" });
  } else if (item.kind === "pending_countersignature") {
    chips.push({ label: "Awaiting you", tone: "brand" });
  } else if (item.urgency === "medium") {
    chips.push({ label: "Follow up soon", tone: "warn" });
  }

  // Reminder count chip
  if (row && row.reminderRoundsSent > 0) {
    const n = row.reminderRoundsSent;
    chips.push({
      label: `${n} ${n === 1 ? "reminder" : "reminders"} sent`,
      tone: n >= 2 ? "warn" : "neutral",
    });
  }

  return chips;
}

/* Sent / Seen / Signed meter stages derived from the SignedDocRow. */
type Stage = { label: string; done: boolean };

function stagesOf(row: SignedDocRow | null): Stage[] | null {
  if (!row) return null;
  const stage = stageOfSignedDoc(row);
  const stageMap: Record<string, number> = {
    created: 0, sent: 1, viewed: 2, signed: 3, on_file: 3,
  };
  const idx = stageMap[stage] ?? 0;
  return [
    { label: "Sent", done: idx >= 1 },
    { label: "Seen", done: idx >= 2 },
    { label: "Signed", done: idx >= 3 },
  ];
}

function footerOf(item: ActionCenterItem, row: SignedDocRow | null): string {
  if (!row) {
    const d = item.days_waiting;
    return `Waiting ${d} ${d === 1 ? "day" : "days"}`;
  }
  const by = row.sentByName ? `Sent by ${row.sentByName}` : "Sent";
  const when = row.sentAt ? ` · ${fmtShortDate(row.sentAt)}` : "";
  return `${by}${when}`;
}

/* ─── Card ─── */

function ActionCard({
  item,
  row,
  busy,
  onPrimaryAction,
  onSecondaryAction,
  onView,
}: {
  item: ActionCenterItem;
  row: SignedDocRow | null;
  busy: boolean;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  onView: () => void;
}) {
  const badgeTone = badgeToneOf(item);
  const badgeLabel = badgeLabelOf(item);
  const headline = headlineOf(item);
  const context = contextOf(item, row);
  const chips = chipsOf(item, row);
  const stages = stagesOf(row);
  const footer = footerOf(item, row);

  const isSignatureKind = ["declined_signature", "pending_countersignature", "overdue_unsigned", "stuck_review"].includes(item.kind);
  const DocIcon = isSignatureKind ? Signature : FileText;

  // Button configuration based on primary_action
  const primaryAction = item.primary_action;

  const PRIMARY_META: Record<ActionQueuePrimaryAction, { Icon: typeof Bell; label: string }> = {
    remind: { Icon: Bell, label: "Remind" },
    resend: { Icon: ArrowsClockwise, label: "Resend" },
    countersign: { Icon: PenNib, label: "Countersign" },
    review: { Icon: Eye, label: "Review" },
  };
  const { Icon: PrimaryIcon, label: primaryLabel } = PRIMARY_META[primaryAction];

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <span className={`${styles.cardIconChip} ${isSignatureKind ? styles.chipSignature : styles.chipForm}`}>
          <DocIcon size={15} weight="duotone" />
        </span>
        <span className={styles.cardDocName}>{item.document_title}</span>
        <span className={`${styles.badge} ${styles[`badge_${badgeTone}`]}`}>
          <span className={styles.badgeDot} aria-hidden />
          {badgeLabel}
        </span>
      </div>

      <div className={styles.cardDivider} aria-hidden />

      {/* Who */}
      <div className={styles.cardWho}>
        {item.owner_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic owner avatar URL from Supabase, dimensions unknown at render time
          <img
            src={item.owner_avatar_url}
            alt={item.owner_name}
            className={styles.avatar}
          />
        ) : (
          <span className={styles.avatar} style={{ background: avatarColor(item.owner_name) }}>
            {initialsOf(item.owner_name)}
          </span>
        )}
        <span className={styles.whoText}>
          <span className={styles.whoName}>{item.owner_name}</span>
          <span className={styles.whoSub}>{item.ownerEmail ?? ""}</span>
        </span>
      </div>

      {/* Headline */}
      <p className={`${styles.cardHeadline} ${styles[`headline_${badgeTone}`]}`}>
        {headline}
      </p>

      {/* Why context */}
      <p className={styles.cardContext}>{context}</p>

      {/* Chips */}
      <div className={styles.chipRow}>
        {chips.map((c) => (
          <span key={c.label} className={`${styles.chip} ${styles[`chip_t_${c.tone}`]}`}>
            {c.label}
          </span>
        ))}
      </div>

      {/* Stage meter (Sent / Seen / Signed): only rendered when a SignedDocRow exists */}
      {stages && (
        <div className={styles.stageMeter}>
          {stages.map((s, i) => (
            <span key={s.label} className={styles.stageStep}>
              {i > 0 && (
                <span
                  className={`${styles.stageLine} ${stages[i].done ? styles.stageLineDone : ""}`}
                  aria-hidden
                />
              )}
              <span className={`${styles.stageDot} ${s.done ? styles.stageDotDone : ""}`} aria-hidden />
              <span className={`${styles.stageLabel} ${s.done ? styles.stageLabelDone : ""}`}>
                {s.label}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className={styles.cardDivider} aria-hidden />

      {/* Footer */}
      <div className={styles.cardFooterRow}>
        <span className={styles.cardFooter}>{footer}</span>
      </div>

      {/* Action buttons */}
      <div className={styles.cardActions}>
        {/* Primary action (Remind / Resend / Countersign / Review) */}
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onPrimaryAction}
          disabled={busy}
        >
          <PrimaryIcon size={13} weight="bold" />
          {busy ? "Working..." : primaryLabel}
        </button>
        {/* Resend as secondary: only when primary is Remind (offers both options) */}
        {primaryAction === "remind" && (
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onSecondaryAction}
            disabled={busy}
          >
            <ArrowsClockwise size={13} weight="bold" />
            Resend
          </button>
        )}
        {/* View */}
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={onView}
        >
          <Eye size={13} weight="bold" />
          View
        </button>
      </div>
    </div>
  );
}

/* ─── Section ─── */

function DrawerSection({
  id,
  label,
  danger,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  danger?: boolean;
  count: number;
  collapsed: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.sectionHead}
        onClick={() => onToggle(id)}
        aria-expanded={!collapsed}
      >
        <span className={`${styles.sectionTone} ${styles[`tone_${id}`]}`} aria-hidden />
        <span className={styles.sectionTitle}>{label}</span>
        <span className={`${styles.sectionCount} ${danger ? styles.sectionCountDanger : ""}`}>
          {count}
        </span>
        <span className={styles.sectionChevron} aria-hidden>
          <CaretDown
            size={14}
            weight="bold"
            className={collapsed ? "" : styles.sectionChevronOpen}
          />
        </span>
      </button>
      {!collapsed && <div className={styles.sectionCards}>{children}</div>}
    </section>
  );
}

/* ─── Drawer ─── */

export function ActionCenterDrawer() {
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ActionCenterResponse | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/action-center");
      if (res.ok) setData((await res.json()) as ActionCenterResponse);
    } finally {
      setLoading(false);
    }
  }, []);

  /* Toggle from the Status Board header pill. */
  useEffect(() => {
    const toggle = () => {
      setOpen((prev) => {
        if (!prev) {
          setNotice(null);
          fetchData();
        }
        return !prev;
      });
    };
    window.addEventListener("admin:action-center-toggle", toggle);
    return () => window.removeEventListener("admin:action-center-toggle", toggle);
  }, [fetchData]);

  /* Escape closes. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const toggleSection = useCallback((id: string) => {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }, []);

  const handleView = useCallback(
    (item: ActionCenterItem) => {
      setOpen(false);
      router.push(item.deepLink);
    },
    [router],
  );

  const handleAction = useCallback(
    (base: ActionQueueItem) => {
      const item = data?.needsAttention.find((i) => i.id === base.id);
      if (!item) return;

      if (item.primary_action === "review" || item.primary_action === "countersign") {
        handleView(item);
        return;
      }

      setNotice(null);
      setBusyId(item.id);
      startTransition(async () => {
        try {
          if (item.primary_action === "resend") {
            if (!item.profileId || !item.ownerEmail || !isSecureKey(item.document_key)) {
              handleView(item);
              return;
            }
            const res = await sendDocumentToOwner(
              item.profileId,
              item.ownerEmail,
              item.owner_name,
              item.document_key,
            );
            setNotice(
              res.ok
                ? { tone: "success", text: `Resent ${item.document_title} to ${item.owner_name}.` }
                : { tone: "error", text: res.error ?? "Resend failed." },
            );
            if (res.ok) fetchData();
            return;
          }

          /* remind */
          if (!item.latestDocumentId || !item.latestSubmissionId || !item.ownerEmail) {
            handleView(item);
            return;
          }
          const res = await sendDocumentReminder(
            item.latestDocumentId,
            item.latestSubmissionId,
            item.ownerEmail,
          );
          setNotice(
            res.ok
              ? { tone: "success", text: `Reminder sent to ${item.owner_name}.` }
              : { tone: "error", text: res.error ?? "Reminder failed." },
          );
          if (res.ok) fetchData();
        } finally {
          setBusyId(null);
        }
      });
    },
    [data, fetchData, handleView],
  );

  /* Secondary action (Resend when primary is Remind). */
  const handleResendAsSecondary = useCallback(
    (item: ActionCenterItem) => {
      if (!item.profileId || !item.ownerEmail || !isSecureKey(item.document_key)) {
        handleView(item);
        return;
      }
      setNotice(null);
      setBusyId(item.id);
      startTransition(async () => {
        try {
          const res = await sendDocumentToOwner(
            item.profileId!,
            item.ownerEmail!,
            item.owner_name,
            item.document_key as SecureDocKey,
          );
          setNotice(
            res.ok
              ? { tone: "success", text: `Resent ${item.document_title} to ${item.owner_name}.` }
              : { tone: "error", text: res.error ?? "Resend failed." },
          );
          if (res.ok) fetchData();
        } finally {
          setBusyId(null);
        }
      });
    },
    [fetchData, handleView],
  );

  if (!mounted) return null;

  const needsAttention = data?.needsAttention ?? [];
  const expiring = data?.expiring ?? [];
  const lapsed = data?.lapsed ?? [];
  const totalCount = needsAttention.length + expiring.length + lapsed.length;
  const allClear = !loading && totalCount === 0;

  const rowsByDocumentId = new Map<string, SignedDocRow>(
    (data?.rows ?? []).map((r) => [r.id, r]),
  );

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ac-scrim"
            className={styles.scrim}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.18 }}
            onMouseDown={close}
            aria-hidden
          />
          <motion.aside
            key="ac-panel"
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Action Center"
            initial={{ x: prefersReduced ? 0 : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: prefersReduced ? 0 : "100%" }}
            transition={{ duration: prefersReduced ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className={styles.header}>
              <div className={styles.headerTitleWrap}>
                <span className={styles.headerIcon} aria-hidden>
                  <Lightning size={16} weight="duotone" />
                </span>
                <div>
                  <h2 className={styles.headerTitle}>Action Center</h2>
                  <p className={styles.headerSub}>
                    {loading
                      ? "Loading..."
                      : totalCount === 0
                      ? "Nothing needs you"
                      : `${totalCount} ${totalCount === 1 ? "item" : "items"} to handle`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={close}
                aria-label="Close Action Center"
              >
                <X size={16} weight="bold" />
              </button>
            </header>

            {notice && (
              <div
                className={notice.tone === "success" ? styles.noticeSuccess : styles.noticeError}
                role="status"
              >
                {notice.text}
              </div>
            )}

            <div className={styles.body}>
              {loading ? (
                <div className={styles.loadingStack}>
                  <div className={styles.shimmer} />
                  <div className={styles.shimmer} />
                  <div className={styles.shimmer} />
                </div>
              ) : allClear ? (
                <div className={styles.allClear}>
                  <span className={styles.allClearIcon}>
                    <CheckCircle size={26} weight="duotone" />
                  </span>
                  <p className={styles.allClearTitle}>All clear</p>
                  <p className={styles.allClearBody}>
                    No signatures need chasing, nothing is expiring, nothing has
                    lapsed. We will surface anything here the moment it needs you.
                  </p>
                </div>
              ) : (
                <>
                  <DrawerSection
                    id="needs"
                    label="Needs attention"
                    count={needsAttention.length}
                    collapsed={!!collapsed.needs}
                    onToggle={toggleSection}
                  >
                    {needsAttention.length === 0 ? (
                      <p className={styles.sectionEmpty}>No items need attention right now.</p>
                    ) : (
                      needsAttention.map((item) => (
                        <ActionCard
                          key={item.id}
                          item={item}
                          row={rowsByDocumentId.get(item.document_id) ?? null}
                          busy={busyId === item.id}
                          onPrimaryAction={() => handleAction(item)}
                          onSecondaryAction={
                            item.primary_action === "remind"
                              ? () => handleResendAsSecondary(item)
                              : undefined
                          }
                          onView={() => handleView(item)}
                        />
                      ))
                    )}
                  </DrawerSection>

                  <DrawerSection
                    id="expiring"
                    label="Expiring soon"
                    count={expiring.length}
                    collapsed={!!collapsed.expiring}
                    onToggle={toggleSection}
                  >
                    {/* Honest empty state: the expiry engine (deferred wave) will
                        populate `expiring`, at which point this renders its own
                        card type. Count stays 0 until then, so it cannot disagree. */}
                    <p className={styles.sectionEmpty}>
                      Nothing inside its renewal window. Cards, insurance, permits,
                      and IDs will appear here before they lapse.
                    </p>
                  </DrawerSection>

                  <DrawerSection
                    id="lapsed"
                    label="Lapsed"
                    danger
                    count={lapsed.length}
                    collapsed={!!collapsed.lapsed}
                    onToggle={toggleSection}
                  >
                    <p className={styles.sectionEmpty}>Nothing has lapsed. Good.</p>
                  </DrawerSection>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
