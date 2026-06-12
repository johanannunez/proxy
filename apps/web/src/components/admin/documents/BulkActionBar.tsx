"use client";

/**
 * BulkActionBar — sticky bar that slides up from the bottom of the paperwork
 * hub when owner rows are selected in the matrix. One bar, four bulk actions.
 */
import { motion } from "motion/react";
import { Bell, EnvelopeOpen, PaperPlaneTilt, Prohibit } from "@phosphor-icons/react";
import styles from "./BulkActionBar.module.css";

interface BulkActionBarProps {
  selectedCount: number;
  onRemind: () => void;
  onRequest: () => void;
  onWaive: () => void;
  onSend: () => void;
  onClear: () => void;
  /** True while a bulk action is running; disables all buttons. */
  busy?: boolean;
  /**
   * Request and Send target one document type. When no type card is active
   * these stay disabled with this hint as their tooltip.
   */
  docTypeHint?: string | null;
}

export function BulkActionBar({
  selectedCount,
  onRemind,
  onRequest,
  onWaive,
  onSend,
  onClear,
  busy = false,
  docTypeHint = null,
}: BulkActionBarProps) {
  const needsDocType = docTypeHint != null;

  return (
    <motion.div
      className={styles.bar}
      initial={{ y: 72, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 72, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 360 }}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <div className={styles.countGroup}>
        <span className={styles.countBadge}>{selectedCount}</span>
        <span className={styles.countLabel}>
          {selectedCount === 1 ? "owner selected" : "owners selected"}
        </span>
        <button type="button" className={styles.clearLink} onClick={onClear} disabled={busy}>
          Clear
        </button>
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onRemind}
          disabled={busy}
        >
          <Bell size={13} weight="duotone" />
          Remind
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onRequest}
          disabled={busy || needsDocType}
          title={needsDocType ? docTypeHint ?? undefined : undefined}
        >
          <EnvelopeOpen size={13} weight="duotone" />
          Request
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
          onClick={onWaive}
          disabled={busy}
        >
          <Prohibit size={13} weight="duotone" />
          Waive
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          onClick={onSend}
          disabled={busy || needsDocType}
          title={needsDocType ? docTypeHint ?? undefined : undefined}
        >
          <PaperPlaneTilt size={13} weight="bold" />
          Send
        </button>
      </div>
    </motion.div>
  );
}
