"use client";

/**
 * StatusBoardTab — the default Paperwork landing (2026-06-14 redesign).
 * The workspace completion matrix is the whole tab; a slim toolbar above it
 * carries the Action Center trigger. The old always-on "Needs Action" queue
 * moved into that on-demand slide-over, so the board reads as one calm surface.
 */

import { useCallback } from "react";
import { Lightning } from "@phosphor-icons/react";
import type { StatusBoard } from "@/lib/admin/status-board-types";
import { StatusBoardView } from "@/components/admin/status-board/StatusBoardView";
import styles from "./StatusBoardTab.module.css";

export function StatusBoardTab({
  board,
  actionCount,
}: {
  board: StatusBoard;
  /** Items needing attention — drives the trigger's count badge. */
  actionCount: number;
}) {
  const openActionCenter = useCallback(() => {
    window.dispatchEvent(new CustomEvent("admin:action-center-toggle"));
  }, []);

  const workspaceCount = board.workspaces.length;

  return (
    <div className={styles.tab}>
      <div className={styles.toolbar}>
        <p className={styles.caption}>
          <span className={styles.captionStrong}>{workspaceCount}</span>{" "}
          {workspaceCount === 1 ? "workspace" : "workspaces"} tracked
        </p>

        <button
          type="button"
          className={`${styles.actionCenterBtn} ${actionCount > 0 ? styles.actionCenterBtnActive : ""}`}
          onClick={openActionCenter}
          aria-label={
            actionCount > 0
              ? `Open Action Center, ${actionCount} ${actionCount === 1 ? "item needs" : "items need"} attention`
              : "Open Action Center"
          }
        >
          <Lightning size={15} weight="duotone" aria-hidden />
          Action Center
          {actionCount > 0 && (
            <span className={styles.actionCenterCount}>{actionCount}</span>
          )}
        </button>
      </div>

      <StatusBoardView board={board} />
    </div>
  );
}
