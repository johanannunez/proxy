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
import { avatarColor } from "@/lib/admin/documents-hub-shared";
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
  const text = `${d} ${d === 1 ? "day" : "days"} waiting`;
  if (d > 14) return { text, className: styles.waitRed };
  if (d > 7) return { text, className: styles.waitAmber };
  return { text, className: styles.waitNeutral };
}

function QueueCard({
  item,
  onAction,
  onView,
  busy,
}: {
  item: ActionQueueItem;
  onAction: (item: ActionQueueItem) => void;
  onView: (item: ActionQueueItem) => void;
  busy: boolean;
}) {
  const kind = KIND_META[item.kind];
  const action = ACTION_META[item.primary_action];
  const waiting = waitingMeta(item);
  const ActionIcon = action.Icon;

  return (
    <div
      className={`${styles.card} ${
        item.urgency === "high" ? styles.cardHigh : styles.cardMedium
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
        </div>
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

export function ActionQueue({ items, onAction, onView, busyId = null }: ActionQueueProps) {
  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <CheckCircle size={30} weight="duotone" />
        </div>
        <p className={styles.emptyTitle}>No actions needed</p>
        <p className={styles.emptyBody}>You&apos;re all caught up.</p>
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
          />
        </div>
      ))}
    </div>
  );
}
