/**
 * PaperworkSkeleton — the loading.tsx fallback for the three Paperwork routes.
 *
 * Each route renders its own PaperworkShell, so a tab switch is a full server
 * navigation. To avoid a blank flash we reproduce the tab row exactly (reusing
 * PaperworkShell.module.css) so the clicked tab reads active instantly, then
 * shimmer the actions + content while the page resolves.
 */

import shell from "./PaperworkShell.module.css";
import styles from "./PaperworkSkeleton.module.css";

type Tab = "status" | "signatures" | "forms";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "status", label: "Status Board" },
  { key: "signatures", label: "Signatures" },
  { key: "forms", label: "Forms" },
];

function sk(...classes: string[]) {
  return [styles.sk, ...classes].join(" ");
}

function CardsSkeleton() {
  return (
    <>
      <div className={styles.subTabs} aria-hidden>
        <span className={sk(styles.subTab)} />
        <span className={sk(styles.subTab)} />
      </div>
      <div className={styles.toolbar} aria-hidden>
        <span className={sk(styles.toolbarCount)} />
        <span className={sk(styles.toolbarFilters)} />
      </div>
      <div className={styles.grid} aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles.card}>
            <span className={sk(styles.cardPreview)} />
            <div className={styles.cardBody}>
              <span className={sk(styles.lineName)} />
              <span className={sk(styles.lineMeta)} />
            </div>
            <div className={styles.cardFooter}>
              <span className={sk(styles.footIcon)} />
              <span className={sk(styles.footBtn)} />
              <span className={sk(styles.footBtn)} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function BoardSkeleton() {
  return (
    <>
      <span className={sk(styles.boardToolbar)} aria-hidden />
      <div className={styles.board} aria-hidden>
        <div className={styles.boardRow}>
          <span className={sk(styles.boardLabel)} />
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className={sk(styles.boardHeadCell)} />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, r) => (
          <div key={r} className={styles.boardRow}>
            <span className={sk(styles.boardLabel)} />
            {Array.from({ length: 5 }).map((_, c) => (
              <span key={c} className={sk(styles.boardCell)} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function PaperworkSkeleton({
  active,
  variant,
}: {
  active: Tab;
  variant: "board" | "cards";
}) {
  return (
    <div className={shell.shell} aria-busy="true">
      <div className={shell.header}>
        <div className={shell.headerLeft}>
          <nav className={shell.tabs} aria-label="Paperwork sections">
            {TABS.map((tab) => {
              const isActive = tab.key === active;
              return (
                <span
                  key={tab.key}
                  className={`${shell.tab} ${isActive ? shell.tabActive : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className={shell.tabLabel}>{tab.label}</span>
                  {isActive && <span className={shell.tabIndicator} aria-hidden />}
                </span>
              );
            })}
          </nav>
        </div>
        <div className={shell.headerActions} aria-hidden>
          <span className={sk(styles.pill, styles.pillWide)} />
          <span className={sk(styles.pill, styles.pillBrand)} />
        </div>
      </div>
      <div className={shell.tabRule} aria-hidden />
      <div className={shell.content}>
        {variant === "cards" ? <CardsSkeleton /> : <BoardSkeleton />}
      </div>
    </div>
  );
}
