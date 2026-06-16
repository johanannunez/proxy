"use client";

import { CaretDown } from "@phosphor-icons/react";
import styles from "./PagesRail.module.css";

interface Props {
  /** Total number of pages reported by Paged.js. */
  pageCount: number;
  /** Called with 1-based page index when user clicks a page button. */
  onJump: (i: number) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function PagesRail({
  pageCount,
  onJump,
  collapsed,
  onToggleCollapsed,
}: Props) {
  if (collapsed) {
    return (
      <div className={styles.railCollapsed} aria-label="Pages rail (collapsed)">
        <button
          type="button"
          className={styles.toggleBtnStrip}
          onClick={onToggleCollapsed}
          aria-label="Expand pages rail"
          title="Expand pages rail"
        >
          <CaretDown className={styles.caretStrip} weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.rail} aria-label="Pages rail">
      <div className={styles.header}>
        <span className={styles.title}>Pages</span>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={onToggleCollapsed}
          aria-label="Collapse pages rail"
          title="Collapse pages rail"
        >
          <CaretDown className={styles.caret} weight="bold" />
        </button>
      </div>

      <div className={styles.pageList} role="list" aria-label="Document pages">
        {pageCount === 0 ? (
          <p className={styles.emptyState}>No pages yet</p>
        ) : (
          Array.from({ length: pageCount }, (_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                type="button"
                role="listitem"
                className={styles.pageBtn}
                onClick={() => onJump(pageNum)}
                aria-label={`Go to page ${pageNum}`}
              >
                <span className={styles.pageNumber}>{pageNum}</span>
                <span className={styles.pageLabel}>Page {pageNum}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
