"use client";

/**
 * Shared chrome for the Signatures + Forms hubs (Round 2): the Library | Activity
 * sub-tab row, a cross-link to the sibling library, and a Cards/List view
 * toggle. Both hubs compose these so the two never drift.
 */

import type { ReactNode } from "react";
import { SquaresFour, ListBullets } from "@phosphor-icons/react";
import styles from "./HubChrome.module.css";

export type HubTab = "library" | "activity" | "archive";
export type HubView = "cards" | "list";

export function HubSubTabs({
  tab,
  onTab,
  libraryLabel,
  libraryTabLabel = "Library",
  libraryCount,
  activityLabel,
  activityCount,
  archiveLabel,
  archiveCount,
  right,
}: {
  tab: HubTab;
  onTab: (next: HubTab) => void;
  /** Singular hub noun for a11y, e.g. "signatures" / "forms". */
  libraryLabel: string;
  /** First tab name — "Documents" for signatures, "Forms" for forms. */
  libraryTabLabel?: string;
  libraryCount?: number;
  /** Second tab name — "History" for signatures, "Responses" for forms. */
  activityLabel: string;
  activityCount?: number;
  /** Optional third tab for archived items in hubs that support it. */
  archiveLabel?: string;
  archiveCount?: number;
  right?: ReactNode;
}) {
  return (
    <div className={styles.subRow}>
      <div className={styles.subTabs} role="tablist" aria-label={`${libraryLabel} sections`}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "library"}
          aria-label={`Your ${libraryTabLabel.toLowerCase()}`}
          className={`${styles.subTab} ${tab === "library" ? styles.subTabActive : ""}`}
          onClick={() => onTab("library")}
        >
          <span>{libraryTabLabel}</span>
          {typeof libraryCount === "number" ? (
            <span className={styles.tabBadge}>{libraryCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "activity"}
          aria-label={`${libraryLabel} ${activityLabel.toLowerCase()}`}
          className={`${styles.subTab} ${tab === "activity" ? styles.subTabActive : ""}`}
          onClick={() => onTab("activity")}
        >
          <span>{activityLabel}</span>
          {typeof activityCount === "number" ? (
            <span className={styles.tabBadge}>{activityCount}</span>
          ) : null}
        </button>
        {archiveLabel ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "archive"}
            aria-label={`${libraryLabel} ${archiveLabel.toLowerCase()}`}
            className={`${styles.subTab} ${tab === "archive" ? styles.subTabActive : ""}`}
            onClick={() => onTab("archive")}
          >
            <span>{archiveLabel}</span>
            {typeof archiveCount === "number" ? (
              <span className={styles.tabBadge}>{archiveCount}</span>
            ) : null}
          </button>
        ) : null}
      </div>

      {right ? <div className={styles.subRight}>{right}</div> : null}
    </div>
  );
}

export function ViewToggle({
  view,
  onView,
}: {
  view: HubView;
  onView: (next: HubView) => void;
}) {
  return (
    <div className={styles.viewToggle} role="group" aria-label="View">
      <button
        type="button"
        className={view === "cards" ? styles.viewActive : ""}
        onClick={() => onView("cards")}
        aria-pressed={view === "cards"}
      >
        <SquaresFour size={14} weight="duotone" /> Cards
      </button>
      <button
        type="button"
        className={view === "list" ? styles.viewActive : ""}
        onClick={() => onView("list")}
        aria-pressed={view === "list"}
      >
        <ListBullets size={14} weight="duotone" /> List
      </button>
    </div>
  );
}

export function HubGroupLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <p className={styles.groupLabel}>
      {children}
      {hint ? <span className={styles.groupHint}>{hint}</span> : null}
    </p>
  );
}
