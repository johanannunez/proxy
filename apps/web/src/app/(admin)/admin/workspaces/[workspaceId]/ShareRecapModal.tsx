"use client";

import { useState, useTransition } from "react";
import { X, Warning, PaperPlaneRight } from "@phosphor-icons/react";
import { shareRecap } from "./meetings-actions";
import styles from "./ShareRecapModal.module.css";

type ActionItem = {
  id: string;
  text: string;
  completed: boolean;
  assignedTo: string | null;
};

type Props = {
  meetingId: string;
  ownerId: string;
  ownerFirstName: string;
  title: string;
  scheduledAt: string | null;
  aiSummary: string;
  actionItems: ActionItem[];
  phone: string | null;
  onClose: () => void;
  onShared: (updatedSummary: string) => void;
};

function formatDateShort(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ShareRecapModal({
  meetingId,
  ownerId,
  ownerFirstName,
  scheduledAt,
  aiSummary,
  actionItems,
  phone,
  onClose,
  onShared,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState(aiSummary);
  const [personalNote, setPersonalNote] = useState("");
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  function toggleItem(id: string) {
    setExcludedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const includedItems = actionItems.filter((a) => !excludedIds.includes(a.id));

  const smsPreview = (() => {
    const suffix = " - Proxy";
    const dateStr = scheduledAt ? ` from ${formatDateShort(scheduledAt)}` : "";
    const body = `Hi ${ownerFirstName}! Your meeting recap${dateStr} is ready. ${summary.slice(0, 80)}${summary.length > 80 ? "…" : ""}`;
    const max = 155 - suffix.length;
    return (body.length > max ? body.slice(0, max - 1) + "…" : body) + suffix;
  })();

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const res = await shareRecap(meetingId, ownerId, {
        summaryOverride: summary !== aiSummary ? summary : undefined,
        excludedItemIds: excludedIds.length > 0 ? excludedIds : undefined,
        personalNote: personalNote.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onShared(summary);
    });
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.headerTitle}>Preview recap for {ownerFirstName}</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className={styles.body}>
          <div>
            <div className={styles.sectionLabel}>Email preview</div>
            <div className={styles.emailPreview}>
              <div className={styles.emailPreviewHeader}>
                <span className={styles.emailPreviewLogo}>Proxy</span>
                <span className={styles.emailPreviewLabel}>Meeting Recap</span>
              </div>
              <div className={styles.emailPreviewBody}>
                <div className={styles.emailPreviewGreeting}>
                  Hi {ownerFirstName},
                </div>
                {personalNote.trim() && (
                  <div className={styles.emailPreviewNote}>{personalNote}</div>
                )}
                <div className={styles.emailPreviewSummary}>
                  {summary || <em style={{ color: "var(--color-text-tertiary)" }}>No summary yet</em>}
                </div>
                {includedItems.length > 0 && (
                  <div>
                    {includedItems.map((item) => (
                      <div key={item.id} className={styles.emailPreviewItem}>
                        <div className={styles.emailPreviewItemDot} />
                        {item.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.divider} />

          <div>
            <div className={styles.sectionLabel}>Edit summary before sending</div>
            <textarea
              className={styles.summaryArea}
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          <div>
            <div className={styles.sectionLabel}>Personal note (optional)</div>
            <textarea
              className={styles.noteArea}
              rows={2}
              value={personalNote}
              onChange={(e) => setPersonalNote(e.target.value)}
              placeholder={`Great catching up, ${ownerFirstName}! Here's a recap of what we covered…`}
            />
          </div>

          {actionItems.length > 0 && (
            <div>
              <div className={styles.sectionLabel}>Include action items</div>
              <div className={styles.actionList}>
                {actionItems.map((item) => {
                  const excluded = excludedIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={[styles.actionToggle, excluded ? styles.excluded : ""].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={() => toggleItem(item.id)}
                      />
                      {item.text}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.divider} />

          {phone && (
            <div>
              <div className={styles.sectionLabel}>SMS preview ({phone})</div>
              <div className={styles.smsPreview}>
                <div className={styles.smsBubble}>{smsPreview}</div>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.errorRow}>
              <Warning size={13} weight="fill" />
              {error}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isPending || !summary.trim()}
          >
            <PaperPlaneRight size={13} weight="fill" />
            {isPending ? "Sending…" : `Send recap to ${ownerFirstName}`}
          </button>
        </div>
      </div>
    </div>
  );
}
