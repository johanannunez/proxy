"use client";

/**
 * ActionQueue — the "Needs Action" daily driver for the paperwork hub.
 * Card list of every document needing admin attention: declined signatures,
 * stuck reviews, expirations, pending countersignatures, overdue unsigned.
 * Each card carries one primary one-click action plus a details link.
 */
import {
  ArrowsClockwise,
  Bell,
  CheckCircle,
  Eye,
  PenNib,
  Signature,
} from "@phosphor-icons/react";
import {
  avatarColor,
  stageOfSignedDoc,
  fmtRelativeTime,
  firstNameOf,
  type SignedDocRow,
} from "@/lib/admin/documents-hub-shared";
import { StageMeter } from "./StageMeter";
import type {
  ActionQueueItem,
  ActionQueueItemKind,
  ActionQueuePrimaryAction,
} from "@/lib/admin/action-queue-types";
import styles from "./ActionQueue.module.css";

interface ActionQueueProps {
  items: ActionQueueItem[];
  onAction: (item: ActionQueueItem) => void;
  onView: (item: ActionQueueItem) => void;
  /** Item id whose primary action is currently running (disables its button). */
  busyId?: string | null;
  /** Signature rows by document id, for the stage meter + engagement chips. */
  rowsByDocumentId?: Map<string, SignedDocRow>;
}

const KIND_META: Record<ActionQueueItemKind, { label: string; className: string }> = {
  declined_signature: { label: "Declined", className: "badgeDeclined" },
  stuck_review: { label: "Stuck in review", className: "badgeStuck" },
  expiring_document: { label: "Expiring", className: "badgeExpiring" },
  pending_countersignature: { label: "Countersign", className: "badgeCountersign" },
  overdue_unsigned: { label: "Overdue", className: "badgeOverdue" },
};

const ACTION_META: Record<ActionQueuePrimaryAction, { label: string; Icon: typeof Bell }> = {
  resend: { label: "Resend", Icon: ArrowsClockwise },
  countersign: { label: "Countersign", Icon: Signature },
  review: { label: "Review", Icon: PenNib },
  remind: { label: "Remind", Icon: Bell },
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

function waitingMeta(item: ActionQueueItem): { text: string; className: string } | null {
  if (item.kind === "expiring_document") {
    if (!item.expires_at) return null;
    const days = Math.ceil(
      (new Date(item.expires_at).getTime() - Date.now()) / 86_400_000,
    );
    if (days < 0) return { text: "Expired", className: styles.waitRed };
    if (days === 0) return { text: "Expires today", className: styles.waitRed };
    return {
      text: `Expires in ${days} ${days === 1 ? "day" : "days"}`,
      className: days <= 7 ? styles.waitRed : styles.waitAmber,
    };
  }
  const d = item.days_waiting;
  const dayLabel = `${d} ${d === 1 ? "day" : "days"}`;
  const first = firstNameOf(item.owner_name);
  const text =
    item.kind === "overdue_unsigned"
      ? `Waiting on ${first} to sign · ${dayLabel}`
      : item.kind === "pending_countersignature"
      ? `Waiting on you to countersign · ${dayLabel}`
      : item.kind === "stuck_review"
      ? `Waiting on your review · ${dayLabel}`
      : item.kind === "declined_signature"
      ? `${first} declined this · ${dayLabel} ago`
      : `${dayLabel} waiting`;
  if (d > 14) return { text, className: styles.waitRed };
  if (d > 7) return { text, className: styles.waitAmber };
  return { text, className: styles.waitNeutral };
}

function QueueCard({
  item,
  onAction,
  onView,
  busy,
  row,
}: {
  item: ActionQueueItem;
  onAction: (item: ActionQueueItem) => void;
  onView: (item: ActionQueueItem) => void;
  busy: boolean;
  row: SignedDocRow | null;
}) {
  const kind = KIND_META[item.kind];
  const action = ACTION_META[item.primary_action];
  const waiting = waitingMeta(item);
  const ActionIcon = action.Icon;

  return (
    <div
      className={`${styles.card} ${
        item.urgency === "high"
          ? styles.cardHigh
          : item.urgency === "medium"
          ? styles.cardMedium
          : styles.cardLow
      }`}
    >
      {item.owner_avatar_url ? (
        <img
          src={item.owner_avatar_url}
          alt={item.owner_name}
          className={styles.avatar}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <div className={styles.avatar} style={{ background: avatarColor(item.owner_name) }}>
          {initialsOf(item.owner_name)}
        </div>
      )}

      <div className={styles.cardBody}>
        <div className={styles.cardTopRow}>
          <span className={styles.ownerName}>{item.owner_name}</span>
          <span className={`${styles.kindBadge} ${styles[kind.className]}`}>
            {kind.label}
          </span>
        </div>
        <div className={styles.cardBottomRow}>
          <span className={styles.docTitle}>{item.document_title}</span>
          {waiting && (
            <>
              <span className={styles.metaSep} aria-hidden="true">
                ·
              </span>
              <span className={`${styles.waiting} ${waiting.className}`}>
                {waiting.text}
              </span>
            </>
          )}
          {row?.viewedAt && (
            <span className={styles.viewedChip}>
              <Eye size={11} weight="duotone" />
              Viewed {fmtRelativeTime(row.viewedAt)}
            </span>
          )}
        </div>
        {row && (
          <div className={styles.stageMeterRow}>
            <StageMeter stage={stageOfSignedDoc(row)} compact />
          </div>
        )}
      </div>

      <div className={styles.cardActions}>
        <button
          type="button"
          className={styles.viewLink}
          onClick={() => onView(item)}
        >
          <Eye size={13} weight="duotone" />
          View details
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => onAction(item)}
          disabled={busy}
        >
          <ActionIcon size={13} weight="bold" />
          {busy ? "Working…" : action.label}
        </button>
      </div>
    </div>
  );
}

export function ActionQueue({
  items,
  onAction,
  onView,
  busyId = null,
  rowsByDocumentId,
}: ActionQueueProps) {
  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <CheckCircle size={48} weight="duotone" />
        </div>
        <p className={styles.emptyTitle}>No actions needed</p>
        <p className={styles.emptyBody}>
          You&apos;re all caught up. Declined, stuck, expiring, and overdue
          documents will surface here the moment they need you.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.queue} role="list" aria-label="Documents needing action">
      {items.map((item) => (
        <div role="listitem" key={item.id}>
          <QueueCard
            item={item}
            onAction={onAction}
            onView={onView}
            busy={busyId === item.id}
            row={rowsByDocumentId?.get(item.document_id) ?? null}
          />
        </div>
      ))}
    </div>
  );
}
