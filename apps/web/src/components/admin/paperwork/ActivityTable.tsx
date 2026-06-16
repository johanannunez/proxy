"use client";

/**
 * ActivityTable — the shared instance table for the Signatures + Forms hubs.
 * Columns: Document / Who / Status / Sent / Seen / (Signed|Submitted). The Seen
 * column is emphasized (the "did the client open it" signal). Rows are buttons
 * that open the per-instance drawer. Filters render in a slot above the table.
 */

import type { ReactNode } from "react";
import styles from "./ActivityTable.module.css";

export type ActivityStatusTone =
  | "awaiting"
  | "complete"
  | "declined"
  | "viewed"
  | "draft";

export type ActivityRow = {
  id: string;
  doc: string;
  /** Small leading glyph for the document (icon node). */
  glyph: ReactNode;
  glyphTone?: { bg: string; fg: string };
  who: string;
  whoColor: string;
  context?: { label: string; muted?: boolean };
  status: { label: string; tone: ActivityStatusTone };
  sent: string;
  /** Seen timestamp, or null when not yet opened (renders a muted dash). */
  seen: string | null;
  /** Final-stage date (Signed / Submitted), or "—". */
  last: string;
  onOpen: () => void;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export function ActivityTable({
  rows,
  lastLabel,
  sentLabel = "Sent",
  contextLabel,
  hideSeen = false,
  filters,
  emptyText = "No activity yet.",
}: {
  rows: ActivityRow[];
  /** Header for the final column: "Signed" (signatures) or "Submitted" (forms). */
  lastLabel: string;
  /** Header for the first date column. Forms use "Started". */
  sentLabel?: string;
  /** Optional contextual column, for example Property. */
  contextLabel?: string;
  /** Hide the Seen column (forms have no per-response open signal). */
  hideSeen?: boolean;
  filters?: ReactNode;
  emptyText?: string;
}) {
  const tableClass = [
    styles.table,
    hideSeen ? styles.noSeen : "",
    contextLabel ? styles.hasContext : "",
  ].filter(Boolean).join(" ");
  return (
    <div className={styles.wrap}>
      {filters ? <div className={styles.filters}>{filters}</div> : null}

      {rows.length === 0 ? (
        <div className={styles.empty}>{emptyText}</div>
      ) : (
        <div className={tableClass} role="table">
          <div className={styles.head} role="row">
            <span className={styles.colDoc}>Document</span>
            <span className={styles.colWho}>Who</span>
            {contextLabel ? <span className={styles.colContext}>{contextLabel}</span> : null}
            <span className={styles.colStatus}>Status</span>
            <span className={styles.colDate}>{sentLabel}</span>
            {!hideSeen && <span className={styles.colDate}>Seen</span>}
            <span className={styles.colDate}>{lastLabel}</span>
          </div>
          {rows.map((r) => (
            <button
              type="button"
              key={r.id}
              className={styles.row}
              onClick={r.onOpen}
              aria-label={`${r.doc} for ${r.who}: ${r.status.label}. Open details.`}
            >
              <span className={styles.colDoc}>
                <span
                  className={styles.docIcon}
                  style={r.glyphTone ? { background: r.glyphTone.bg, color: r.glyphTone.fg } : undefined}
                  aria-hidden
                >
                  {r.glyph}
                </span>
                <span className={styles.docName}>{r.doc}</span>
              </span>
              <span className={styles.colWho}>
                <span
                  className={styles.avatar}
                  style={{ background: r.whoColor }}
                  aria-hidden
                >
                  {initials(r.who)}
                </span>
                <span className={styles.whoName}>{r.who}</span>
              </span>
              {contextLabel ? (
                <span className={styles.colContext}>
                  <span className={r.context?.muted ? styles.contextMuted : styles.contextText}>
                    {r.context?.label ?? "Not attached"}
                  </span>
                </span>
              ) : null}
              <span className={styles.colStatus}>
                <span className={`${styles.pill} ${styles[`st_${r.status.tone}`]}`}>
                  <span className={styles.pillDot} aria-hidden />
                  {r.status.label}
                </span>
              </span>
              <span className={styles.colDate}>{r.sent}</span>
              {!hideSeen && (
                <span className={`${styles.colDate} ${r.seen ? styles.colSeen : ""}`}>
                  {r.seen ?? "—"}
                </span>
              )}
              <span className={styles.colDate}>{r.last}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
