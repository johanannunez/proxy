"use client";

/**
 * StatusBoardView — the real-data-wired Workspace Status Board.
 *
 * Consumes a `StatusBoard` payload (from fetchWorkspaceStatusBoard) and renders:
 *   1. Filter bar: search | kind tabs with counts | status filter | focus dropdown
 *   2. Result summary line
 *   3. Matrix: sticky workspace column, grouped kind bands, completion rings
 *   4. Cursor hover card (dark navy card, motion/react spring)
 *   5. Workspace drawer (slides from right, per-req breakdown, not-needed toggle)
 *
 * CellState mapping:
 *   complete   -> green filled + checkmark ring
 *   in_progress -> blue arc ring (fraction-filled)
 *   sent       -> amber outline ring
 *   needed     -> faint dashed dot (same as not_started in the old mock matrix)
 *   declined   -> red filled + X ring
 *   not_needed -> neutral muted dot (smaller, more faded than "needed")
 */

import {
  Fragment,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";
import {
  X,
  House,
  PushPin,
  Columns,
  Check,
} from "@phosphor-icons/react";
import type {
  StatusBoard,
  WorkspaceRow,
  CellSummary,
  EntityDetail,
} from "@/lib/admin/status-board-types";
import type { RequirementKind } from "@/lib/admin/status-board-config";
import { KIND_LABEL, KIND_ORDER } from "@/lib/admin/status-board-config";
import { setRequirementNotNeeded } from "@/lib/admin/status-board-actions";
import { StatusBoardToolbar } from "./StatusBoardToolbar";
import { FileCardTile } from "./FileCardTile";
import { getReqKeyIconConfig } from "./status-board-icons";
import styles from "./StatusBoard.module.css";

/* ─────────────────────────────────────────────────────────────
   Utility helpers
───────────────────────────────────────────────────────────── */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/**
 * Owner label for a workspace row: one full name for a single owner, both names
 * for a couple, the first two plus a count beyond that. Holds one truncated line.
 */
function ownerNames(owners: { name: string }[]): string {
  if (owners.length === 0) return "";
  if (owners.length === 1) return owners[0].name;
  if (owners.length === 2) return `${firstName(owners[0].name)} & ${firstName(owners[1].name)}`;
  return `${firstName(owners[0].name)}, ${firstName(owners[1].name)} +${owners.length - 2}`;
}

const AVATAR_PALETTE = [
  "#1b77be", "#0d9488", "#7c3aed", "#b27908",
  "#b91c1c", "#15803d", "#c2410c", "#0284c7",
];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Not yet";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "Not yet";
  }
}

/** Corner-cell legend: the six cell states, in reading order. The swatch
 * classes echo the CompletionRing colors so the key matches the matrix. */
const STATUS_LEGEND: { label: string; swatch: string }[] = [
  { label: "Complete", swatch: "legendComplete" },
  { label: "In progress", swatch: "legendProgress" },
  { label: "Sent", swatch: "legendSent" },
  { label: "Declined", swatch: "legendDeclined" },
  { label: "Not sent", swatch: "legendNeeded" },
  { label: "Waived", swatch: "legendWaived" },
];

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */

type StatusFilter = "all" | "outstanding" | "complete" | "declined" | "not_needed";
type KindFilter = "all" | RequirementKind;

interface HoveredCell {
  workspaceId: string;
  workspaceName: string;
  reqKey: string;
  cell: CellSummary;
}

/* ─────────────────────────────────────────────────────────────
   Completion Ring — maps all 6 CellState values
───────────────────────────────────────────────────────────── */

interface RingProps {
  state: CellSummary["status"];
  fraction?: number;
}

function CompletionRing({ state, fraction }: RingProps) {
  if (state === "needed") {
    return <div className={styles.cellNeeded} aria-label="Not started" />;
  }

  if (state === "not_needed") {
    /* Waived / not needed: a short dash inside a faint pill — clearly intentional, readable as N/A */
    return (
      <div className={styles.matrixRingNotNeeded} aria-label="Not needed">
        <span className={styles.matrixRingNotNeededDash} aria-hidden />
      </div>
    );
  }

  if (state === "complete") {
    return (
      <div className={`${styles.cellDisc} ${styles.cellDiscSuccess}`} aria-label="Complete">
        <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden>
          <path
            d="M3 6.3 l2.1 2.1 l3.9 -4.4"
            fill="none"
            stroke="#fff"
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  if (state === "declined") {
    return (
      <div className={`${styles.cellDisc} ${styles.cellDiscError}`} aria-label="Declined">
        <svg width={11} height={11} viewBox="0 0 11 11" aria-hidden>
          <path
            d="M3.2 3.2 l4.6 4.6 M7.8 3.2 l-4.6 4.6"
            fill="none"
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  if (state === "sent") {
    /* Awaiting: a soft amber ring with a faint tinted fill and a small center dot. */
    return (
      <div className={styles.cellSent} aria-label="Sent, awaiting signature">
        <span className={styles.cellSentDot} aria-hidden />
      </div>
    );
  }

  /* in_progress: a premium gradient arc filled to fraction over a faint track */
  const SIZE = 22;
  const R = 8.5;
  const CIRC = 2 * Math.PI * R;
  const pct = fraction ?? 0.5;
  const filled = CIRC * pct;
  const gap = CIRC - filled;
  return (
    <div className={styles.matrixRingWrap} aria-label={`In progress, ${Math.round(pct * 100)}%`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth={2.75}
          opacity={0.13}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--color-brand-light, #02aaeb)"
          strokeWidth={2.75}
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset={CIRC * 0.25}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Column pct badge
───────────────────────────────────────────────────────────── */

function ColPctBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 75
      ? styles.matrixColPctHigh
      : pct >= 40
      ? styles.matrixColPctMid
      : styles.matrixColPctLow;
  return <span className={cls} title={`${pct}% complete across workspaces`}>{pct}%</span>;
}

/* ─────────────────────────────────────────────────────────────
   Cursor Card — dark navy, springs, AnimatePresence
───────────────────────────────────────────────────────────── */

function statusChipClass(state: CellSummary["status"]): string {
  switch (state) {
    case "complete":    return styles.sbCursorChipComplete;
    case "in_progress": return styles.sbCursorChipProgress;
    case "sent":        return styles.sbCursorChipSent;
    case "needed":      return styles.sbCursorChipNeeded;
    case "declined":    return styles.sbCursorChipDeclined;
    case "not_needed":  return styles.sbCursorChipNotNeeded;
  }
}

function statusChipLabel(state: CellSummary["status"]): string {
  switch (state) {
    case "complete":    return "Complete";
    case "in_progress": return "In progress";
    case "sent":        return "Sent";
    case "needed":      return "Not sent";
    case "declined":    return "Declined";
    case "not_needed":  return "Not needed";
  }
}

/** Pick milestone labels based on requirement kind */
function milestoneLabels(kind: RequirementKind): string[] {
  if (kind === "signature") return ["Sent", "Viewed", "Signed"];
  return ["Submitted", "Reviewed"];
}

/** Pick milestone dates from EntityDetail based on kind */
function milestoneDates(
  entity: EntityDetail,
  kind: RequirementKind,
): (string | null)[] {
  if (kind === "signature") {
    return [entity.sentAt, entity.viewedAt, entity.signedAt];
  }
  return [entity.submittedAt, entity.reviewedAt];
}

/** Pick the most "informative" entity to display in the cursor card */
function representativeEntity(cell: CellSummary): EntityDetail | null {
  if (!cell.entities.length) return null;
  const order: CellSummary["status"][] = [
    "declined", "in_progress", "sent", "complete", "needed", "not_needed",
  ];
  for (const s of order) {
    const found = cell.entities.find((e) => e.state === s);
    if (found) return found;
  }
  return cell.entities[0];
}

interface CursorCardProps {
  hovered: HoveredCell | null;
}

function StatusBoardCursorCard({ hovered }: CursorCardProps) {
  const prefersReduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 520, damping: 42 });
  const springY = useSpring(y, { stiffness: 520, damping: 42 });

  const CARD_W = 232;

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const offsetX = e.clientX > vw * 0.6 ? -(CARD_W + 16) : 16;
      const rawY = e.clientY + 16;
      const offsetY = rawY + 220 > vh ? vh - 240 : rawY;
      x.set(e.clientX + offsetX);
      y.set(offsetY);
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [x, y]);

  if (!hovered) return null;

  const { cell } = hovered;
  const config = getReqKeyIconConfig(cell.reqKey);
  const entity = representativeEntity(cell);
  const labels = milestoneLabels(cell.kind);
  const dates = entity ? milestoneDates(entity, cell.kind) : labels.map(() => null);

  const signers =
    cell.kind === "signature"
      ? cell.entities.flatMap((e) => e.signers).slice(0, 4)
      : [];
  const signerOverflow =
    cell.kind === "signature"
      ? Math.max(0, cell.entities.flatMap((e) => e.signers).length - 4)
      : 0;

  return (
    <AnimatePresence>
      {hovered && (
        <motion.div
          key={`cursor-${hovered.reqKey}-${hovered.workspaceId}`}
          className={styles.sbCursorCard}
          style={{ x: springX, y: springY }}
          initial={{ opacity: 0, scale: prefersReduced ? 1 : 0.9, filter: prefersReduced ? "blur(0px)" : "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: prefersReduced ? 1 : 0.9, filter: prefersReduced ? "blur(0px)" : "blur(4px)" }}
          transition={{ duration: prefersReduced ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden
        >
          {/* Header: label + status chip */}
          <div className={styles.sbCursorCardHeader}>
            <span className={styles.sbCursorCardLabel}>{config.label}</span>
            <span className={`${styles.sbCursorChip} ${statusChipClass(cell.status)}`}>
              {statusChipLabel(cell.status)}
            </span>
          </div>

          {/* Property scope: name the property this requirement tracks */}
          {cell.scope === "property" && entity && (
            <div className={styles.sbCursorScope}>
              <House size={11} weight="duotone" aria-hidden />
              <span>
                {entity.entityName}
                {cell.totalCount > 1 ? ` +${cell.totalCount - 1} more` : ""}
              </span>
            </div>
          )}

          {/* Breakdown: N of M complete */}
          <div className={styles.sbCursorBreakdown}>
            {cell.totalCount === 0
              ? "No entities applicable"
              : `${cell.doneCount} of ${cell.totalCount} complete`}
            {cell.notNeededCount > 0 && ` (${cell.notNeededCount} waived)`}
          </div>

          {/* Timeline milestones */}
          {cell.status !== "needed" && cell.status !== "not_needed" && entity && (
            <div className={styles.sbCursorTimeline}>
              {labels.map((lbl, i) => {
                const done = dates[i] !== null;
                return (
                  <Fragment key={lbl}>
                    {i > 0 && (
                      <div
                        className={`${styles.sbCursorConnector} ${done ? styles.sbCursorConnectorDone : ""}`}
                      />
                    )}
                    <div className={styles.sbCursorMilestone}>
                      <span className={styles.sbCursorMilestoneLabel}>{lbl}</span>
                      <span className={styles.sbCursorMilestoneValue}>
                        {fmtDate(dates[i] ?? null)}
                      </span>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          )}

          {/* Signers — signature kind only */}
          {cell.kind === "signature" && (
            <>
              <div className={styles.sbCursorDivider} />
              <div className={styles.sbCursorSigners}>
                {signers.length === 0 ? (
                  <p className={styles.sbCursorNoSigners}>No co-signers yet</p>
                ) : (
                  <>
                    {signers.map((s, i) => {
                      const statusCls =
                        s.status === "signed"
                          ? styles.sbCursorSignerSigned
                          : s.status === "viewed"
                          ? styles.sbCursorSignerViewed
                          : s.status === "declined"
                          ? styles.sbCursorSignerDeclined
                          : styles.sbCursorSignerPending;
                      const statusLbl =
                        s.status === "signed"
                          ? "Signed"
                          : s.status === "viewed"
                          ? "Viewed"
                          : s.status === "declined"
                          ? "Declined"
                          : "Pending";
                      return (
                        <div key={i} className={styles.sbCursorSignerRow}>
                          <div
                            className={styles.sbCursorSignerAvatar}
                            style={{ background: avatarColor(s.name) }}
                          >
                            {initials(s.name)}
                          </div>
                          <span className={styles.sbCursorSignerName}>{s.name}</span>
                          <span className={`${styles.sbCursorSignerStatus} ${statusCls}`}>
                            {statusLbl}
                          </span>
                        </div>
                      );
                    })}
                    {signerOverflow > 0 && (
                      <p className={styles.sbCursorOverflow}>+{signerOverflow} more</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────
   Workspace Drawer
───────────────────────────────────────────────────────────── */

/** Local optimistic not-needed state: reqKey -> boolean */
type NotNeededOverrides = Record<string, boolean>;

interface WorkspaceDrawerProps {
  workspace: WorkspaceRow | null;
  focusedReqKey: string | null;
  onClose: () => void;
}

function WorkspaceDrawer({ workspace, focusedReqKey, onClose }: WorkspaceDrawerProps) {
  const [overrides, setOverrides] = useState<NotNeededOverrides>({});
  const prefersReduced = useReducedMotion();

  /* Reset overrides when workspace changes */
  useEffect(() => {
    setOverrides({});
  }, [workspace?.id]);

  const handleToggleNotNeeded = useCallback(
    async (workspaceId: string, reqKey: string, currentNotNeeded: boolean) => {
      const next = !currentNotNeeded;
      /* Optimistic update */
      setOverrides((prev) => ({ ...prev, [reqKey]: next }));
      /* Fire-and-forget — will fail silently in preview (no auth) */
      try {
        await setRequirementNotNeeded(workspaceId, reqKey, next);
      } catch {
        /* Intentionally silent — preview has no auth session */
      }
    },
    [],
  );

  /* Group cells by kind for drawer display */
  const kindGroups: { kind: RequirementKind; reqKeys: string[] }[] = [
    { kind: "signature", reqKeys: [] },
    { kind: "form",      reqKeys: [] },
  ];
  if (workspace) {
    for (const [rk, cell] of Object.entries(workspace.cells)) {
      const g = kindGroups.find((kg) => kg.kind === cell.kind);
      if (g) g.reqKeys.push(rk);
    }
  }

  function drawerStatusClass(state: CellSummary["status"]): string {
    switch (state) {
      case "complete":    return styles.wdChipComplete;
      case "in_progress": return styles.wdChipProgress;
      case "sent":        return styles.wdChipSent;
      case "needed":      return styles.wdChipNeeded;
      case "declined":    return styles.wdChipDeclined;
      case "not_needed":  return styles.wdChipNotNeeded;
    }
  }

  function drawerStatusLabel(state: CellSummary["status"]): string {
    switch (state) {
      case "complete":    return "Complete";
      case "in_progress": return "In progress";
      case "sent":        return "Sent";
      case "needed":      return "Not sent";
      case "declined":    return "Declined";
      case "not_needed":  return "Not needed";
    }
  }

  const doneCount = workspace
    ? Object.values(workspace.cells).filter((c) => c.status === "complete").length
    : 0;
  const neededCount = workspace
    ? Object.values(workspace.cells).filter((c) => c.status === "needed").length
    : 0;
  const declinedCount = workspace
    ? Object.values(workspace.cells).filter((c) => c.status === "declined").length
    : 0;
  const waivedCount = workspace
    ? Object.values(workspace.cells).filter((c) => c.status === "not_needed").length
    : 0;

  return (
    <AnimatePresence>
      {workspace && (
        <>
          {/* Backdrop */}
          <motion.div
            key="wd-backdrop"
            className={styles.wdBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.18 }}
            onClick={onClose}
            aria-hidden
          />

          {/* Drawer panel */}
          <motion.div
            key="wd-panel"
            role="dialog"
            aria-label={`${workspace.name} document status`}
            aria-modal="true"
            className={styles.wdDrawer}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{
              duration: prefersReduced ? 0 : 0.28,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Header */}
            <div className={styles.wdHeader}>
              <div className={styles.wdHeaderText}>
                <div className={styles.wdTitle}>{workspace.name}</div>
                {workspace.type && (
                  <div className={styles.wdSub}>{workspace.type}</div>
                )}
                <div className={styles.wdPctRow}>
                  <div className={styles.wdPctBar}>
                    <div
                      className={styles.wdPctFill}
                      style={{ width: `${workspace.pct}%` }}
                    />
                  </div>
                  <span className={styles.wdPctLabel}>{workspace.pct}% complete</span>
                </div>
                <div className={styles.wdCountChips}>
                  {doneCount > 0 && (
                    <span className={`${styles.wdCountChip} ${styles.wdCountChipComplete}`}>
                      {doneCount} done
                    </span>
                  )}
                  {neededCount > 0 && (
                    <span className={`${styles.wdCountChip} ${styles.wdCountChipNeeded}`}>
                      {neededCount} pending
                    </span>
                  )}
                  {declinedCount > 0 && (
                    <span className={`${styles.wdCountChip} ${styles.wdCountChipDeclined}`}>
                      {declinedCount} declined
                    </span>
                  )}
                  {waivedCount > 0 && (
                    <span className={`${styles.wdCountChip} ${styles.wdCountChipWaived}`}>
                      {waivedCount} waived
                    </span>
                  )}
                </div>
              </div>
              <button
                className={styles.wdCloseBtn}
                onClick={onClose}
                type="button"
                aria-label="Close workspace drawer"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div className={styles.wdBody}>
              {/* Owners */}
              {workspace.owners.length > 0 && (
                <div className={styles.wdSection}>
                  <p className={styles.wdSectionTitle}>Owners</p>
                  <div className={styles.wdChipRow}>
                    {workspace.owners.map((o) => (
                      <span key={o.id} className={styles.wdPersonChip}>
                        <span
                          className={styles.wdPersonAvatar}
                          style={{ background: avatarColor(o.name) }}
                        >
                          {initials(o.name)}
                        </span>
                        {o.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Properties */}
              {workspace.properties.length > 0 && (
                <div className={styles.wdSection}>
                  <p className={styles.wdSectionTitle}>Properties</p>
                  <div className={styles.wdChipRow}>
                    {workspace.properties.map((p) => (
                      <span key={p.id} className={styles.wdPropertyChip}>
                        <House size={11} weight="duotone" />
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Requirements grouped by kind */}
              {kindGroups.map(({ kind, reqKeys }) => {
                if (!reqKeys.length) return null;
                return (
                  <div key={kind} className={styles.wdSection}>
                    <p className={styles.wdSectionTitle}>{KIND_LABEL[kind]}</p>
                    <div className={styles.wdReqList}>
                      {reqKeys.map((rk) => {
                        const cell = workspace.cells[rk];
                        if (!cell) return null;

                        const config = getReqKeyIconConfig(rk);
                        const isFocused = focusedReqKey === rk;

                        /* Apply optimistic override */
                        const notNeededOverride = overrides[rk];
                        const effectiveStatus: CellSummary["status"] =
                          notNeededOverride !== undefined
                            ? notNeededOverride
                              ? "not_needed"
                              : "needed"
                            : cell.status;
                        const isNotNeeded = effectiveStatus === "not_needed";

                        const labels = milestoneLabels(kind);

                        return (
                          <div
                            key={rk}
                            className={`${styles.wdReqItem} ${isFocused ? styles.wdReqItemFocused : ""}`}
                          >
                            {/* Top row: icon + label + status chip + toggle */}
                            <div className={styles.wdReqTop}>
                              <div
                                className={styles.wdReqIconChip}
                                style={{ background: config.tintBg }}
                              >
                                <config.Icon
                                  size={18}
                                  weight="duotone"
                                  color={config.tintFg}
                                />
                              </div>
                              <div className={styles.wdReqMeta}>
                                <span className={styles.wdReqLabel}>{config.label}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span className={`${styles.wdChip} ${drawerStatusClass(effectiveStatus)}`}>
                                    {drawerStatusLabel(effectiveStatus)}
                                  </span>
                                  {/* Not-needed toggle */}
                                  <button
                                    className={`${styles.wdToggleBtn} ${isNotNeeded ? styles.wdToggleBtnActive : ""}`}
                                    type="button"
                                    onClick={() =>
                                      handleToggleNotNeeded(workspace.id, rk, isNotNeeded)
                                    }
                                    aria-label={
                                      isNotNeeded
                                        ? `Mark ${config.label} as needed`
                                        : `Mark ${config.label} as not needed`
                                    }
                                  >
                                    {isNotNeeded ? "Mark needed" : "Not needed"}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Per-entity breakdown */}
                            {cell.entities.length > 0 && (
                              <div className={styles.wdEntityList}>
                                {cell.entities.map((entity) => {
                                  const dates = milestoneDates(entity, kind);
                                  return (
                                    <div key={entity.entityId} className={styles.wdEntityRow}>
                                      <span className={styles.wdEntityName}>{entity.entityName}</span>

                                      {/* Mini timeline */}
                                      <div className={styles.wdEntityTimeline}>
                                        {labels.map((lbl, i) => {
                                          const done = dates[i] !== null;
                                          const isDeclined =
                                            entity.state === "declined" && i === labels.length - 1;
                                          return (
                                            <Fragment key={lbl}>
                                              {i > 0 && (
                                                <div
                                                  className={`${styles.wdEntityConnector} ${
                                                    done && !isDeclined
                                                      ? styles.wdEntityConnectorDone
                                                      : ""
                                                  }`}
                                                />
                                              )}
                                              <div className={styles.wdEntityMilestone}>
                                                <div
                                                  className={
                                                    isDeclined
                                                      ? styles.wdEntityMilestoneDotDeclined
                                                      : done
                                                      ? styles.wdEntityMilestoneDotDone
                                                      : styles.wdEntityMilestoneDotPending
                                                  }
                                                />
                                                <span
                                                  className={`${styles.wdEntityMilestoneLabel} ${
                                                    isDeclined
                                                      ? styles.wdEntityMilestoneLabelDeclined
                                                      : done
                                                      ? styles.wdEntityMilestoneLabelDone
                                                      : ""
                                                  }`}
                                                >
                                                  {lbl}
                                                </span>
                                                <span className={styles.wdEntityMilestoneDate}>
                                                  {fmtDate(dates[i] ?? null)}
                                                </span>
                                              </div>
                                            </Fragment>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Signers for signature kind */}
                                {kind === "signature" && (() => {
                                  const allSigners = cell.entities.flatMap((e) => e.signers).slice(0, 6);
                                  return (
                                    <div className={styles.wdSignerList}>
                                      {allSigners.length === 0 ? (
                                        <p className={styles.wdSignerPlaceholder}>No co-signers yet</p>
                                      ) : (
                                        allSigners.map((s, i) => {
                                          const statusCls =
                                            s.status === "signed"
                                              ? styles.wdSignerSigned
                                              : s.status === "viewed"
                                              ? styles.wdSignerViewed
                                              : s.status === "declined"
                                              ? styles.wdSignerDeclined
                                              : styles.wdSignerPending;
                                          const statusLbl =
                                            s.status === "signed"
                                              ? "Signed"
                                              : s.status === "viewed"
                                              ? "Viewed"
                                              : s.status === "declined"
                                              ? "Declined"
                                              : "Pending";
                                          return (
                                            <div key={i} className={styles.wdSignerRow}>
                                              <div
                                                className={styles.wdSignerAvatar}
                                                style={{ background: avatarColor(s.name) }}
                                              >
                                                {initials(s.name)}
                                              </div>
                                              <span className={styles.wdSignerName}>
                                                {s.name}
                                                <span
                                                  style={{
                                                    fontWeight: 400,
                                                    color: "var(--text-tertiary, #9ca3af)",
                                                    fontSize: 10,
                                                    marginLeft: 4,
                                                  }}
                                                >
                                                  {s.role}
                                                </span>
                                              </span>
                                              <span className={`${styles.wdSignerStatus} ${statusCls}`}>
                                                {statusLbl}
                                              </span>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────
   Columns Panel — grouped checklist for multi-column focus
───────────────────────────────────────────────────────────── */

interface ColumnsPanelProps {
  columns: StatusBoard["columns"];
  kindGroups: StatusBoard["kindGroups"];
  focusedKeys: Set<string>;
  onToggle: (reqKey: string) => void;
  onClose: () => void;
  /** Ref to the wrapper that contains the trigger button — clicks inside it must not close the panel */
  wrapRef: React.RefObject<HTMLDivElement | null>;
}

function ColumnsPanel({ columns, kindGroups, focusedKeys, onToggle, onClose, wrapRef }: ColumnsPanelProps) {
  const prefersReduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on outside click — check both the panel AND the trigger wrapper */
  useEffect(() => {
    function handleDown(e: MouseEvent) {
      const target = e.target as Node;
      const insidePanel = panelRef.current?.contains(target) ?? false;
      const insideWrap = wrapRef.current?.contains(target) ?? false;
      if (!insidePanel && !insideWrap) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [onClose, wrapRef]);

  /* Close on Escape */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  /* Sort kind groups by KIND_ORDER */
  const orderedGroups = [...kindGroups].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );

  return (
    <motion.div
      ref={panelRef}
      className={styles.sbColsPanel}
      role="dialog"
      aria-label="Show or hide requirement columns"
      initial={{ opacity: 0, y: prefersReduced ? 0 : -6, scale: prefersReduced ? 1 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: prefersReduced ? 0 : -6, scale: prefersReduced ? 1 : 0.96 }}
      transition={{ duration: prefersReduced ? 0 : 0.14, ease: [0.16, 1, 0.3, 1] }}
    >
      {orderedGroups.map((kg) => {
        const groupCols = kg.reqKeys
          .map((rk) => columns.find((c) => c.reqKey === rk))
          .filter(Boolean) as StatusBoard["columns"];
        if (!groupCols.length) return null;
        return (
          <div key={kg.kind} className={styles.sbColsPanelGroup}>
            <p className={styles.sbColsPanelGroupLabel}>{KIND_LABEL[kg.kind]}</p>
            {groupCols.map((col) => {
              const checked = focusedKeys.has(col.reqKey);
              const config = getReqKeyIconConfig(col.reqKey);
              return (
                <button
                  key={col.reqKey}
                  type="button"
                  className={`${styles.sbColsPanelItem} ${checked ? styles.sbColsPanelItemChecked : ""}`}
                  onClick={() => onToggle(col.reqKey)}
                  aria-pressed={checked}
                  aria-label={`${checked ? "Unpin" : "Pin"} ${col.label} column`}
                >
                  <span
                    className={styles.sbColsPanelItemIcon}
                    style={{ background: config.tintBg, color: config.tintFg }}
                    aria-hidden
                  >
                    <config.Icon size={14} weight="duotone" />
                  </span>
                  <span className={styles.sbColsPanelItemLabel}>{col.label}</span>
                  {checked && (
                    <Check
                      size={14}
                      weight="bold"
                      className={styles.sbColsPanelItemCheck}
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */

export interface StatusBoardViewProps {
  board: StatusBoard;
}

export function StatusBoardView({ board }: StatusBoardViewProps) {
  /* ── Filter state ── */
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  /* Multi-column focus: Set of pinned reqKeys */
  const [focusedKeys, setFocusedKeys] = useState<Set<string>>(new Set());
  /* Columns panel open state */
  const [colsPanelOpen, setColsPanelOpen] = useState(false);

  /* Deep-link filters: hydrate from the URL once, then mirror state back into it
     via history.replaceState. No navigation and no server refetch, so the board
     view is shareable and survives a refresh; the back button is intentionally
     left alone (replaceState adds no history entry). */
  const urlHydratedRef = useRef(false);
  useEffect(() => {
    if (!urlHydratedRef.current) {
      urlHydratedRef.current = true;
      const p = new URLSearchParams(window.location.search);
      const q = p.get("q");
      if (q) setSearch(q);
      const k = p.get("kind");
      if (k === "signature" || k === "form") setKindFilter(k);
      const s = p.get("status");
      if (s === "outstanding" || s === "complete" || s === "declined" || s === "not_needed") {
        setStatusFilter(s);
      }
      const cols = p.get("cols");
      if (cols) {
        const valid = new Set(board.columns.map((c) => c.reqKey));
        const keys = cols.split(",").filter((rk) => valid.has(rk));
        if (keys.length) setFocusedKeys(new Set(keys));
      }
      return;
    }
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (kindFilter !== "all") params.set("kind", kindFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (focusedKeys.size > 0) params.set("cols", [...focusedKeys].join(","));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, [search, kindFilter, statusFilter, focusedKeys, board.columns]);

  /* ── Drawer / cursor / hover-row state ── */
  const [openWorkspace, setOpenWorkspace] = useState<WorkspaceRow | null>(null);
  const [focusedReqKey, setFocusedReqKey] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<HoveredCell | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  /* Ref for the Columns button wrapper — prevents panel close when clicking the trigger */
  const colsWrapRef = useRef<HTMLDivElement>(null);

  /* Right-region scroll-state for edge-fade */
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const [scrolledRight, setScrolledRight] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /* Reduced-motion gate for chip row animation */
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    function update() {
      if (!el) return;
      setScrolledRight(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  /* Toggle a single reqKey in/out of the focused set */
  const toggleFocusKey = useCallback((reqKey: string) => {
    setFocusedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(reqKey)) {
        next.delete(reqKey);
      } else {
        next.add(reqKey);
      }
      return next;
    });
  }, []);

  const clearFocusedKeys = useCallback(() => {
    setFocusedKeys(new Set());
  }, []);

  /* ── Filter logic ── */

  /*
   * Columns visible after kind + focus filter.
   * When focusedKeys is non-empty it OVERRIDES kindFilter — only pinned columns show.
   * Kind groups are stable-sorted by KIND_ORDER so the guarantee holds for real data too.
   */
  const visibleColumns = focusedKeys.size > 0
    ? board.columns.filter((col) => focusedKeys.has(col.reqKey))
    : board.columns.filter((col) => kindFilter === "all" || col.kind === kindFilter);

  /* Re-measure edge-fade when the visible column set changes (pin/unpin changes content width
     but not the container element size, so the ResizeObserver alone won't catch it). */
  useEffect(() => {
    const el = rightScrollRef.current;
    if (!el) return;
    setScrolledRight(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, [visibleColumns.length]);

  /* Kind groups after filters, stable-sorted by KIND_ORDER */
  const visibleKindGroups = [...board.kindGroups]
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
    .map((kg) => ({
      ...kg,
      reqKeys: kg.reqKeys.filter((rk) =>
        visibleColumns.some((c) => c.reqKey === rk),
      ),
    }))
    .filter((kg) => kg.reqKeys.length > 0);

  /* Workspaces after search + status filter. Search and status are separate
     predicates so the Status menu can show per-status counts within the current
     search context. */
  const matchesSearch = (ws: WorkspaceRow): boolean => {
    if (!search) return true;
    const q = search.trim().toLowerCase();
    return (
      ws.name.toLowerCase().includes(q) ||
      ws.owners.some((o) => o.name.toLowerCase().includes(q)) ||
      ws.properties.some((p) => p.name.toLowerCase().includes(q))
    );
  };
  const matchesStatus = (ws: WorkspaceRow, sf: StatusFilter): boolean => {
    if (sf === "all") return true;
    if (sf === "complete") return ws.pct === 100;
    /* Outstanding: at least one required non-waived item not complete */
    if (sf === "outstanding") return ws.pct < 100;
    if (sf === "declined") return Object.values(ws.cells).some((c) => c.status === "declined");
    if (sf === "not_needed") return Object.values(ws.cells).some((c) => c.status === "not_needed");
    return true;
  };

  const searchFiltered = board.workspaces.filter(matchesSearch);
  const filteredWorkspaces = searchFiltered.filter((ws) => matchesStatus(ws, statusFilter));

  /* Live per-status counts (within current search) for the Status dropdown */
  const statusCounts: Partial<Record<StatusFilter, number>> = {
    all: searchFiltered.length,
    outstanding: searchFiltered.filter((ws) => matchesStatus(ws, "outstanding")).length,
    complete: searchFiltered.filter((ws) => matchesStatus(ws, "complete")).length,
    declined: searchFiltered.filter((ws) => matchesStatus(ws, "declined")).length,
    not_needed: searchFiltered.filter((ws) => matchesStatus(ws, "not_needed")).length,
  };

  /* Kind counts for the segmented control */
  const kindCounts: Record<KindFilter, number> = {
    all: board.columns.length,
    signature: board.columns.filter((c) => c.kind === "signature").length,
    form: board.columns.filter((c) => c.kind === "form").length,
  };

  const openDrawer = useCallback((ws: WorkspaceRow, reqKey?: string) => {
    setOpenWorkspace(ws);
    setFocusedReqKey(reqKey ?? null);
  }, []);

  const closeDrawer = useCallback(() => {
    setOpenWorkspace(null);
    setFocusedReqKey(null);
  }, []);

  const handleCellEnter = useCallback((
    ws: WorkspaceRow,
    reqKey: string,
    cell: CellSummary,
  ) => {
    setHoveredCell({ workspaceId: ws.id, workspaceName: ws.name, reqKey, cell });
  }, []);

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  const closeColsPanel = useCallback(() => setColsPanelOpen(false), []);

  /* Chips for pinned columns (in stable KIND_ORDER) */
  const focusChips = [...board.columns]
    .filter((col) => focusedKeys.has(col.reqKey))
    .sort((a, b) => {
      const ki = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
      if (ki !== 0) return ki;
      /* Within same kind, keep board order */
      return board.columns.indexOf(a) - board.columns.indexOf(b);
    });

  return (
    <>
      {/* ── Filter bar ── */}
      <StatusBoardToolbar
        search={search}
        onSearchChange={setSearch}
        kindFilter={kindFilter}
        onKindChange={setKindFilter}
        kindCounts={kindCounts}
        kindDisabled={focusedKeys.size > 0}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusCounts={statusCounts}
        columnsSlot={
          <div className={styles.sbColsWrap} ref={colsWrapRef}>
            <button
              type="button"
              className={`${styles.sbCtrlBtn} ${focusedKeys.size > 0 ? styles.sbCtrlBtnActive : ""}`}
              onClick={() => setColsPanelOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={colsPanelOpen}
              aria-label={focusedKeys.size > 0 ? `${focusedKeys.size} columns pinned` : "Pin columns"}
            >
              <Columns size={13} weight="duotone" aria-hidden />
              {focusedKeys.size > 0 ? `${focusedKeys.size} pinned` : "Columns"}
            </button>

            <AnimatePresence>
              {colsPanelOpen && (
                <ColumnsPanel
                  columns={board.columns}
                  kindGroups={board.kindGroups}
                  focusedKeys={focusedKeys}
                  onToggle={toggleFocusKey}
                  onClose={closeColsPanel}
                  wrapRef={colsWrapRef}
                />
              )}
            </AnimatePresence>
          </div>
        }
      />

      {/* ── Focus chips row ── */}
      <AnimatePresence>
        {focusChips.length > 0 && (
          <motion.div
            className={styles.sbFocusChipsRow}
            role="group"
            aria-label="Pinned columns"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {focusChips.map((col) => {
              const config = getReqKeyIconConfig(col.reqKey);
              return (
                <span key={col.reqKey} className={styles.sbFocusChip}>
                  <span className={styles.sbFocusChipIcon} aria-hidden>
                    <config.Icon size={11} weight="duotone" color={config.tintFg} />
                  </span>
                  <span className={styles.sbFocusChipLabel}>{config.shortLabel}</span>
                  <button
                    type="button"
                    className={styles.sbFocusChipX}
                    onClick={() => toggleFocusKey(col.reqKey)}
                    aria-label={`Unpin ${config.label}`}
                  >
                    <X size={9} weight="bold" aria-hidden />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              className={styles.sbFocusChipsClear}
              onClick={clearFocusedKeys}
              aria-label="Clear all pinned columns"
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Unified count line ── (N reflects active filters; M is the stable
           tracked-document set, never the filtered column count, so "tracked"
           stays truthful when a kind filter narrows the visible columns). */}
      <p className={styles.sbResultSummary} aria-live="polite">
        <span className={styles.sbResultSummaryStrong}>{filteredWorkspaces.length}</span>
        {filteredWorkspaces.length !== board.workspaces.length && (
          <>
            {" of "}
            <span className={styles.sbResultSummaryStrong}>{board.workspaces.length}</span>
          </>
        )}{" "}
        {board.workspaces.length === 1 ? "workspace" : "workspaces"}
        {" · "}
        <span className={styles.sbResultSummaryStrong}>{board.columns.length}</span>{" "}
        {board.columns.length === 1 ? "document type" : "document types"}
      </p>

      {/* ── Matrix: two-region layout ── */}
      <div className={styles.matrixShell} role="grid" aria-label="Workspace status matrix">
        {/* LEFT region: fixed workspace column — does NOT scroll horizontally */}
        <div className={styles.matrixLeft} role="presentation">
          {/* Header area: matches right region header height */}
          <div className={styles.matrixLeftHeader} role="presentation">
            <div className={styles.matrixCornerCell}>
              <span className={styles.legendHeading}>Status key</span>
              <div className={styles.legendGrid}>
                {STATUS_LEGEND.map((entry) => (
                  <span key={entry.label} className={styles.legendItem}>
                    <span
                      className={`${styles.legendSwatch} ${styles[entry.swatch as keyof typeof styles]}`}
                      aria-hidden
                    />
                    {entry.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Data rows */}
          {filteredWorkspaces.length === 0 ? (
            <div className={styles.matrixLeftEmptyRow} role="row">
              <div role="gridcell" />
            </div>
          ) : (
            filteredWorkspaces.map((ws) => (
              <div
                key={ws.id}
                role="row"
                className={`${styles.matrixLeftRow} ${hoveredRowId === ws.id ? styles.matrixLeftRowHovered : ""}`}
                onMouseEnter={() => setHoveredRowId(ws.id)}
                onMouseLeave={() => setHoveredRowId(null)}
              >
                <div className={styles.matrixOwnerCellInner} role="rowheader">
                  <div
                    className={styles.avatar}
                    style={{
                      background: avatarColor(ws.name),
                      width: 26,
                      height: 26,
                      fontSize: 9,
                      flexShrink: 0,
                      borderRadius: "50%",
                    }}
                    aria-hidden
                  >
                    {initials(ws.name)}
                  </div>
                  <div className={styles.matrixOwnerInfo}>
                    <button
                      type="button"
                      className={styles.matrixOwnerNameBtn}
                      onClick={() => openDrawer(ws)}
                      aria-label={`View ${ws.name} document status`}
                    >
                      {ws.name}
                    </button>
                    {ws.owners.length > 0 ? (
                      <div
                        className={styles.matrixOwnerPeople}
                        title={ws.owners.map((o) => o.name).join(", ")}
                      >
                        <span className={styles.matrixOwnerStack} aria-hidden>
                          {ws.owners.slice(0, 3).map((o) =>
                            o.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- dynamic Supabase avatar
                              <img
                                key={o.id}
                                src={o.avatarUrl}
                                alt=""
                                className={styles.matrixOwnerPeep}
                                style={{ objectFit: "cover" }}
                              />
                            ) : (
                              <span
                                key={o.id}
                                className={styles.matrixOwnerPeep}
                                style={{ background: avatarColor(o.name) }}
                              >
                                {initials(o.name)}
                              </span>
                            ),
                          )}
                        </span>
                        <span className={styles.matrixOwnerPeopleNames}>
                          {ownerNames(ws.owners)}
                        </span>
                      </div>
                    ) : ws.type ? (
                      <div className={styles.matrixOwnerType}>{ws.type}</div>
                    ) : null}
                    <div className={styles.matrixOwnerBar}>
                      <div
                        className={styles.matrixOwnerBarFill}
                        style={{ width: `${ws.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={styles.matrixOwnerPct}>{ws.pct}%</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* RIGHT region: scrolls horizontally, contains all requirement columns */}
        <div
          ref={rightScrollRef}
          className={`${styles.matrixRight} ${scrolledRight ? styles.matrixRightScrolled : ""} ${canScrollRight ? styles.matrixRightCanScroll : ""}`}
          role="presentation"
        >
          {/* Column headers */}
          <div className={styles.matrixRightHeader} role="presentation">
            {/* Group bands row */}
            <div className={styles.matrixGroupBandRow} role="row">
              {visibleKindGroups.map((kg) => (
                <div
                  key={kg.kind}
                  className={`${styles.matrixGroupBand} ${styles[`matrixGroupBand_${kg.kind}` as keyof typeof styles]}`}
                  role="columnheader"
                  style={{ width: `${kg.reqKeys.length * 64}px`, minWidth: `${kg.reqKeys.length * 64}px` }}
                >
                  {kg.label}
                </div>
              ))}
            </div>

            {/* Column header row — toggle buttons for pinning */}
            <div className={styles.matrixItemHeaderRow} role="row">
              {visibleColumns.map((col) => {
                const config = getReqKeyIconConfig(col.reqKey);
                const isPinned = focusedKeys.has(col.reqKey);
                return (
                  <div
                    key={col.reqKey}
                    role="columnheader"
                    className={`${styles.matrixItemHeader} ${styles[`matrixItemHeader_${col.kind}` as keyof typeof styles]} ${isPinned ? styles.matrixItemHeaderPinned : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.matrixItemHeaderBtn}
                      onClick={() => toggleFocusKey(col.reqKey)}
                      aria-pressed={isPinned}
                      aria-label={`${isPinned ? "Unpin" : "Pin"} ${col.label} column`}
                    >
                      <span
                        className={`${styles.matrixPinIcon} ${isPinned ? styles.matrixPinIconActive : ""}`}
                        aria-hidden
                      >
                        <PushPin size={10} weight={isPinned ? "fill" : "regular"} />
                      </span>
                      <div className={styles.matrixItemHeaderInner}>
                        <FileCardTile config={config} scale={0.5} />
                        <span className={styles.matrixItemLabel} title={col.label}>
                          {config.shortLabel}
                        </span>
                        <ColPctBadge pct={col.pct} />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data rows */}
          {filteredWorkspaces.length === 0 ? (
            <div className={styles.matrixRightEmptyRow} role="row">
              <div
                role="gridcell"
                className={styles.matrixEmptyCell}
              >
                No workspaces match the current filters
              </div>
            </div>
          ) : (
            filteredWorkspaces.map((ws) => (
              <div
                key={ws.id}
                role="row"
                className={`${styles.matrixRightRow} ${hoveredRowId === ws.id ? styles.matrixRightRowHovered : ""}`}
                onMouseEnter={() => setHoveredRowId(ws.id)}
                onMouseLeave={() => setHoveredRowId(null)}
              >
                {visibleColumns.map((col, idx) => {
                  const cell = ws.cells[col.reqKey];
                  const displayStatus: CellSummary["status"] = cell?.status ?? "needed";
                  const displayFraction = cell?.fraction;

                  const thisKgReqKeys =
                    visibleKindGroups.find((kg) => kg.kind === col.kind)?.reqKeys ?? [];
                  const isLastInKind =
                    col.reqKey === thisKgReqKeys[thisKgReqKeys.length - 1];
                  const isNotLastColumn = idx < visibleColumns.length - 1;

                  return (
                    <div
                      key={col.reqKey}
                      role="gridcell"
                      className={`${styles.matrixCell} ${styles[`matrixCell_${col.kind}` as keyof typeof styles]} ${
                        isLastInKind && isNotLastColumn ? styles.matrixCellGroupEnd : ""
                      }`}
                    >
                      {cell ? (
                        <button
                          type="button"
                          className={styles.matrixCellBtn}
                          onClick={() => openDrawer(ws, col.reqKey)}
                          onMouseEnter={() => handleCellEnter(ws, col.reqKey, cell)}
                          onMouseLeave={handleCellLeave}
                          aria-label={`${ws.name}: ${col.label} — ${statusChipLabel(displayStatus)}`}
                        >
                          <CompletionRing state={displayStatus} fraction={displayFraction} />
                        </button>
                      ) : (
                        <div
                          className={styles.matrixCellInner}
                          aria-label={`${ws.name}: ${col.label} — Not applicable`}
                          style={{ padding: 4 }}
                        >
                          <div className={styles.matrixRingNotApplicable} aria-hidden />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Cursor card ── */}
      <StatusBoardCursorCard hovered={hoveredCell} />

      {/* ── Workspace drawer ── */}
      <WorkspaceDrawer
        workspace={openWorkspace}
        focusedReqKey={focusedReqKey}
        onClose={closeDrawer}
      />
    </>
  );
}
