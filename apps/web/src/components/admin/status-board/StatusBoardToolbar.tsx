"use client";

/**
 * StatusBoardToolbar — the Status Board filter bar as one grouped, elevated
 * toolbar. Presentational: all state is owned by the host (StatusBoardView);
 * the Columns popover is passed in as `columnsSlot` so its pinning logic stays
 * with the board.
 *
 * `layout`:
 *   "anchored" — search + kind cluster left, status + columns cluster right.
 *   "fill"     — kind leads, search grows to fill the middle, status + columns
 *                anchor right (the shipped layout). Hairline dividers articulate
 *                the three groups.
 *
 * Honest a11y: the kind control is a real radiogroup with roving tabindex and
 * arrow/Home/End operability; when columns are pinned the segments are truly
 * disabled (not aria-only). The Status menu is keyboard-operable and returns
 * focus to its trigger on close; Clear returns focus to search. The active kind
 * pill glides between segments via a shared layout id (transform-only, gated on
 * reduced-motion). Per-status counts surface where the blockers are.
 */

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { MagnifyingGlass, CaretDown, Check, X } from "@phosphor-icons/react";
import type { KindFilter, StatusFilter } from "@/lib/admin/status-board-types";
import styles from "./StatusBoard.module.css";

const KIND_SEGMENTS: { key: KindFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "signature", label: "Signatures" },
  { key: "form", label: "Forms" },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string; tone?: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "outstanding", label: "Outstanding", tone: "var(--status-warning, #d97706)" },
  { key: "complete", label: "Complete", tone: "var(--color-success, #16a34a)" },
  { key: "declined", label: "Declined", tone: "var(--color-error, #dc2626)" },
  { key: "not_needed", label: "Waived", tone: "var(--text-tertiary, #9ca3af)" },
];

export function StatusBoardToolbar({
  search,
  onSearchChange,
  kindFilter,
  onKindChange,
  kindCounts,
  kindDisabled = false,
  statusFilter,
  onStatusChange,
  statusCounts,
  columnsSlot,
  layout = "fill",
}: {
  search: string;
  onSearchChange: (value: string) => void;
  kindFilter: KindFilter;
  onKindChange: (kind: KindFilter) => void;
  kindCounts: Record<KindFilter, number>;
  kindDisabled?: boolean;
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  /** Live count per status (and total under "all"); omit to hide counts. */
  statusCounts?: Partial<Record<StatusFilter, number>>;
  columnsSlot?: ReactNode;
  layout?: "anchored" | "fill";
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const statusWrapRef = useRef<HTMLDivElement>(null);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const kindGroupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const prefersReduced = useReducedMotion();

  // Close on outside click; Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!statusOpen) return;
    function onDown(e: MouseEvent) {
      if (!statusWrapRef.current?.contains(e.target as Node)) setStatusOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setStatusOpen(false);
        statusTriggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [statusOpen]);

  // On open, move focus into the menu (selected item, else first).
  useEffect(() => {
    if (!statusOpen) return;
    const btns = statusMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    if (!btns?.length) return;
    const selIdx = STATUS_OPTIONS.findIndex((o) => o.key === statusFilter);
    (btns[selIdx >= 0 ? selIdx : 0]).focus();
  }, [statusOpen, statusFilter]);

  const activeStatus = STATUS_OPTIONS.find((o) => o.key === statusFilter) ?? STATUS_OPTIONS[0];
  const hasActiveFilters = kindFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  function clearAll() {
    onKindChange("all");
    onStatusChange("all");
    onSearchChange("");
    searchRef.current?.focus();
  }

  function selectStatus(next: StatusFilter) {
    onStatusChange(next);
    setStatusOpen(false);
    statusTriggerRef.current?.focus();
  }

  // Radiogroup keyboard model for the kind segments.
  function onKindKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (kindDisabled) return;
    const keys = KIND_SEGMENTS.map((s) => s.key);
    const idx = keys.indexOf(kindFilter);
    let next = idx;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": next = (idx + 1) % keys.length; break;
      case "ArrowLeft":
      case "ArrowUp": next = (idx - 1 + keys.length) % keys.length; break;
      case "Home": next = 0; break;
      case "End": next = keys.length - 1; break;
      default: return;
    }
    e.preventDefault();
    onKindChange(keys[next]);
    kindGroupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]
      ?.focus();
  }

  // Arrow/Home/End move focus among the open menu items.
  function onMenuKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    const btns = Array.from(
      statusMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
    );
    if (!btns.length) return;
    const cur = btns.indexOf(document.activeElement as HTMLButtonElement);
    let next = cur;
    switch (e.key) {
      case "ArrowDown": next = (cur + 1) % btns.length; break;
      case "ArrowUp": next = (cur - 1 + btns.length) % btns.length; break;
      case "Home": next = 0; break;
      case "End": next = btns.length - 1; break;
      default: return;
    }
    e.preventDefault();
    btns[next]?.focus();
  }

  const pillTransition = prefersReduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 520, damping: 40 };

  const search$ = (grow: boolean) => (
    <div className={`${styles.sbSearch} ${grow ? styles.sbSearchGrow : ""}`}>
      <MagnifyingGlass size={14} weight="bold" aria-hidden />
      <input
        ref={searchRef}
        type="text"
        className={styles.sbSearchField}
        placeholder="Search workspaces, owners, properties"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search workspaces"
      />
    </div>
  );

  const kindSeg$ = (
    <div
      ref={kindGroupRef}
      className={`${styles.sbSeg} ${kindDisabled ? styles.sbSegDisabled : ""}`}
      role="radiogroup"
      aria-label="Filter by kind"
      aria-disabled={kindDisabled || undefined}
      onKeyDown={onKindKeyDown}
    >
      {KIND_SEGMENTS.map((seg) => {
        const active = kindFilter === seg.key;
        return (
          <motion.button
            key={seg.key}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={kindDisabled ? -1 : active ? 0 : -1}
            disabled={kindDisabled}
            whileTap={prefersReduced || kindDisabled ? undefined : { scale: 0.97 }}
            className={`${styles.sbSegBtn} ${active ? styles.sbSegBtnActive : ""}`}
            onClick={() => { if (!kindDisabled) onKindChange(seg.key); }}
          >
            {active && (
              <motion.span
                layoutId="sbKindActivePill"
                className={styles.sbSegActivePill}
                transition={pillTransition}
                aria-hidden
              />
            )}
            <span className={styles.sbSegInner}>
              {seg.key !== "all" && (
                <span
                  className={`${styles.sbKindDot} ${styles[`sbKindDot_${seg.key}` as keyof typeof styles]}`}
                  aria-hidden
                />
              )}
              {seg.label}
              <span className={styles.sbSegCount}>{kindCounts[seg.key]}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );

  const status$ = (
    <div className={styles.sbStatusWrap} ref={statusWrapRef}>
      <button
        ref={statusTriggerRef}
        type="button"
        className={`${styles.sbCtrlBtn} ${statusFilter !== "all" ? styles.sbCtrlBtnActive : ""}`}
        onClick={() => setStatusOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={statusOpen}
      >
        <span className={styles.sbCtrlBtnLabel}>Status</span>
        <span className={styles.sbCtrlBtnValue}>{activeStatus.label.replace(/ statuses$/, "")}</span>
        <CaretDown size={12} weight="bold" aria-hidden className={statusOpen ? styles.sbCaretOpen : ""} />
      </button>

      {statusOpen && (
        <div className={styles.sbStatusMenu} role="menu" ref={statusMenuRef} onKeyDown={onMenuKeyDown}>
          <p className={styles.sbStatusMenuHeader}>Workspaces by status</p>
          {STATUS_OPTIONS.map((opt) => {
            const selected = statusFilter === opt.key;
            const count = statusCounts?.[opt.key];
            return (
              <button
                key={opt.key}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={-1}
                className={`${styles.sbStatusItem} ${selected ? styles.sbStatusItemActive : ""}`}
                onClick={() => selectStatus(opt.key)}
              >
                <span className={styles.sbStatusItemLabel}>
                  <span
                    className={styles.sbStatusDot}
                    style={{ background: opt.tone ?? "transparent", outline: opt.tone ? undefined : "1px solid var(--border-card, #d8d7d4)" }}
                    aria-hidden
                  />
                  {opt.label}
                </span>
                <span className={styles.sbStatusItemMeta}>
                  {typeof count === "number" && (
                    <span
                      className={styles.sbStatusItemCount}
                      aria-label={`${count} ${count === 1 ? "workspace" : "workspaces"}`}
                    >
                      {count}
                    </span>
                  )}
                  {selected && <Check size={13} weight="bold" aria-hidden />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const clear$ = hasActiveFilters ? (
    <button type="button" className={styles.sbClearBtn} onClick={clearAll}>
      <X size={12} weight="bold" aria-hidden />
      Clear
    </button>
  ) : null;

  const divider$ = <span className={styles.sbBarDivider} aria-hidden />;

  if (layout === "fill") {
    return (
      <div className={`${styles.sbBar} ${styles.sbBarFill}`} role="group" aria-label="Status board filters">
        {kindSeg$}
        {divider$}
        {search$(true)}
        {divider$}
        {status$}
        {columnsSlot}
        {clear$}
      </div>
    );
  }

  return (
    <div className={styles.sbBar} role="group" aria-label="Status board filters">
      <div className={styles.sbBarLeft}>
        {search$(false)}
        {divider$}
        {kindSeg$}
      </div>
      <div className={styles.sbBarRight}>
        {status$}
        {columnsSlot}
        {clear$}
      </div>
    </div>
  );
}
