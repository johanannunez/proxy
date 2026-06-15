"use client";

/**
 * StatusBoardTab — the default Paperwork landing (2026-06-14 redesign).
 * The workspace completion matrix is the whole tab. The Action Center trigger
 * now lives inline in the PaperworkShell header (beside the create button), and
 * the workspace count folded into the board's own unified count line, so the
 * tab itself is just the board on a calm surface.
 */

import type { StatusBoard } from "@/lib/admin/status-board-types";
import { StatusBoardView } from "@/components/admin/status-board/StatusBoardView";
import styles from "./StatusBoardTab.module.css";

export function StatusBoardTab({ board }: { board: StatusBoard }) {
  return (
    <div className={styles.tab}>
      <StatusBoardView board={board} />
    </div>
  );
}
