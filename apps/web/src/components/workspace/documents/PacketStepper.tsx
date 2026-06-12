"use client";

/**
 * PacketStepper — full-viewport guided flow through one packet. One document
 * per step, animated progress bar, back/next navigation. Completed steps show
 * a checkmark in the step rail and can be skipped past freely.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  CaretLeft,
  CheckCircle,
  Clock,
  Lock,
  PencilSimple,
  Signature,
  UploadSimple,
  Warning,
  X,
} from "@phosphor-icons/react";
import {
  STATUS_LABELS_OWNER,
  type DocumentDisplayStatus,
} from "@/lib/documents/status";
import { isPacketItemComplete, type PacketItem, type PacketItemAction } from "./packet-types";
import { DocumentTimeline } from "./DocumentTimeline";

export interface PacketStepperProps {
  packetTitle: string;
  items: PacketItem[];
  currentIndex: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onAction: (item: PacketItem) => void;
  onJumpTo?: (index: number) => void;
}

const BADGE_TONE: Record<
  DocumentDisplayStatus,
  { bg: string; fg: string; border: string }
> = {
  needed: {
    bg: "rgba(245, 158, 11, 0.12)",
    fg: "var(--status-warning-fg)",
    border: "rgba(245, 158, 11, 0.28)",
  },
  action_required: {
    bg: "rgba(220, 38, 38, 0.1)",
    fg: "var(--status-danger-fg)",
    border: "rgba(220, 38, 38, 0.26)",
  },
  expired: {
    bg: "rgba(220, 38, 38, 0.1)",
    fg: "var(--status-danger-fg)",
    border: "rgba(220, 38, 38, 0.26)",
  },
  locked: {
    bg: "var(--color-warm-gray-100)",
    fg: "var(--color-text-tertiary)",
    border: "var(--color-warm-gray-200)",
  },
  sent: {
    bg: "rgba(2, 170, 235, 0.1)",
    fg: "var(--status-info-fg)",
    border: "rgba(2, 170, 235, 0.28)",
  },
  signed: {
    bg: "rgba(2, 170, 235, 0.1)",
    fg: "var(--status-info-fg)",
    border: "rgba(2, 170, 235, 0.28)",
  },
  awaiting_countersignature: {
    bg: "rgba(2, 170, 235, 0.1)",
    fg: "var(--status-info-fg)",
    border: "rgba(2, 170, 235, 0.28)",
  },
  submitted: {
    bg: "rgba(2, 170, 235, 0.08)",
    fg: "var(--status-info-fg)",
    border: "rgba(2, 170, 235, 0.24)",
  },
  under_review: {
    bg: "rgba(2, 170, 235, 0.08)",
    fg: "var(--status-info-fg)",
    border: "rgba(2, 170, 235, 0.24)",
  },
  on_file: {
    bg: "rgba(22, 163, 74, 0.1)",
    fg: "var(--status-success-fg)",
    border: "rgba(22, 163, 74, 0.26)",
  },
};

const ACTION_META: Record<PacketItemAction, { label: string; icon: typeof UploadSimple }> = {
  upload: { label: "Upload", icon: UploadSimple },
  fill: { label: "Complete form", icon: PencilSimple },
  sign: { label: "Review & sign", icon: Signature },
  view: { label: "View document", icon: ArrowRight },
  waiting: { label: "With Proxy", icon: Clock },
};

function StatusBadge({ status, label }: { status: DocumentDisplayStatus; label?: string }) {
  const tone = BADGE_TONE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
    >
      {status === "on_file" && <CheckCircle size={12} weight="fill" />}
      {status === "locked" && <Lock size={11} weight="bold" />}
      {(status === "action_required" || status === "expired") && (
        <Warning size={12} weight="fill" />
      )}
      {label ?? STATUS_LABELS_OWNER[status]}
    </span>
  );
}

export function PacketStepper({
  packetTitle,
  items,
  currentIndex,
  onNext,
  onBack,
  onClose,
  onAction,
  onJumpTo,
}: PacketStepperProps) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const total = items.length;
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(total - 1, 0));
  const item = items[safeIndex];
  const completeCount = useMemo(() => items.filter(isPacketItemComplete).length, [items]);
  const progressPct = total > 0 ? (completeCount / total) * 100 : 0;
  const isLast = safeIndex === total - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && !isLast) onNext();
      if (e.key === "ArrowLeft" && safeIndex > 0) onBack();
    },
    [onClose, onNext, onBack, isLast, safeIndex],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [handleKeyDown]);

  if (!item) return null;

  const done = isPacketItemComplete(item);
  const locked = item.status === "locked";
  const action = item.action ?? "view";
  const meta = ACTION_META[action];
  const ActionIcon = meta.icon;
  const showAction = !locked && !done && action !== "view";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        height: "100dvh",
        backgroundColor: "var(--color-warm-gray-50)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${packetTitle} steps`}
    >
      {/* Fixed header */}
      <header
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <h2
            className="truncate text-sm font-semibold tracking-tight sm:text-base"
            style={{
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-sora)",
            }}
          >
            {packetTitle}
          </h2>
          <span
            className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums"
            style={{
              backgroundColor: "var(--color-warm-gray-100)",
              color: "var(--color-text-secondary)",
            }}
          >
            {safeIndex + 1} of {total}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--color-warm-gray-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:bg-[var(--color-warm-gray-200)]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <X size={18} weight="bold" />
        </button>
      </header>

      {/* Progress bar — fills as steps complete */}
      <div
        className="h-1 shrink-0"
        style={{ backgroundColor: "var(--color-warm-gray-100)" }}
        role="progressbar"
        aria-valuenow={completeCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completeCount} of ${total} complete`}
      >
        <motion.div
          className="h-full"
          style={{ background: "var(--color-brand-gradient)", originX: 0 }}
          initial={reduceMotion ? { scaleX: progressPct / 100 } : { scaleX: 0 }}
          animate={{ scaleX: progressPct / 100 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Step rail */}
      <nav
        className="flex shrink-0 items-center justify-center gap-2 px-4 py-3"
        aria-label="Steps"
      >
        {items.map((step, i) => {
          const stepDone = isPacketItemComplete(step);
          const active = i === safeIndex;
          return (
            <button
              key={`${step.document_key ?? "doc"}-${i}`}
              type="button"
              onClick={() => onJumpTo?.(i)}
              disabled={!onJumpTo}
              aria-label={`Step ${i + 1}: ${step.title}${stepDone ? " (complete)" : ""}`}
              aria-current={active ? "step" : undefined}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:scale-95 disabled:cursor-default"
            >
              {stepDone ? (
                <CheckCircle
                  size={18}
                  weight="fill"
                  style={{ color: "var(--color-success)" }}
                />
              ) : (
                <span
                  className="block rounded-full"
                  style={{
                    width: active ? 10 : 7,
                    height: active ? 10 : 7,
                    backgroundColor: active
                      ? "var(--color-brand)"
                      : "var(--color-warm-gray-200)",
                    transition: "transform 150ms var(--ease-spring)",
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-4 pb-6 sm:items-center sm:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={safeIndex}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl rounded-2xl border p-6 sm:p-8"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              boxShadow:
                "0 1px 2px rgba(15, 23, 42, 0.04), 0 16px 40px rgba(27, 119, 190, 0.08)",
            }}
          >
            <div className="flex flex-wrap items-center gap-3">
              <h3
                className="text-lg font-semibold tracking-tight"
                style={{
                  color: "var(--color-text-primary)",
                  fontFamily: "var(--font-sora)",
                }}
              >
                {item.title}
              </h3>
              <StatusBadge status={item.status} label={item.statusLabel} />
            </div>

            {item.propertyLabel && (
              <p
                className="mt-1 text-xs font-medium"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {item.propertyLabel}
              </p>
            )}

            {item.description && (
              <div className="mt-4">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  What this is and why it matters
                </p>
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {item.description}
                </p>
              </div>
            )}

            {locked && (
              <div
                className="mt-5 flex items-start gap-3 rounded-xl border p-4"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-warm-gray-50)",
                }}
              >
                <Lock
                  size={16}
                  weight="duotone"
                  style={{ color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 2 }}
                />
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {item.lockedReason ?? "Complete the earlier steps to unlock this document."}
                </p>
              </div>
            )}

            {done && (
              <div
                className="mt-5 flex items-center gap-2.5 rounded-xl border p-4"
                style={{
                  borderColor: "rgba(22, 163, 74, 0.25)",
                  backgroundColor: "rgba(22, 163, 74, 0.05)",
                }}
              >
                <CheckCircle
                  size={17}
                  weight="fill"
                  style={{ color: "var(--color-success)", flexShrink: 0 }}
                />
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Complete and on file.
                </p>
              </div>
            )}

            {action === "waiting" && !done && !locked && (
              <div
                className="mt-5 flex items-center gap-2.5 rounded-xl border p-4"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  backgroundColor: "var(--color-warm-gray-50)",
                }}
              >
                <Clock
                  size={17}
                  weight="duotone"
                  style={{ color: "var(--color-text-tertiary)", flexShrink: 0 }}
                />
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  This is being handled on our end. Nothing needed from you right now.
                </p>
              </div>
            )}

            {showAction && (
              <button
                type="button"
                onClick={() => onAction(item)}
                className="mt-6 inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:translate-y-0 active:scale-[0.98]"
                style={{
                  background: "var(--color-brand-gradient)",
                  boxShadow: "0 6px 18px rgba(27, 119, 190, 0.28)",
                }}
              >
                <ActionIcon size={16} weight="bold" />
                {meta.label}
              </button>
            )}

            {done && item.fileUrl && (
              <button
                type="button"
                onClick={() => onAction(item)}
                className="mt-6 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors duration-150 hover:bg-[var(--color-warm-gray-50)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:bg-[var(--color-warm-gray-100)]"
                style={{
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <ArrowRight size={15} weight="bold" />
                Preview document
              </button>
            )}

            {item.events && item.events.length > 0 && (
              <div
                className="mt-6 border-t pt-4"
                style={{ borderColor: "var(--color-warm-gray-100)" }}
              >
                <DocumentTimeline events={item.events} collapsed />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <footer
        className="flex shrink-0 items-center justify-between border-t px-4 py-3 sm:px-6"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={safeIndex === 0}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors duration-150 hover:bg-[var(--color-warm-gray-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:bg-[var(--color-warm-gray-200)] disabled:cursor-default disabled:opacity-40"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <CaretLeft size={15} weight="bold" />
          Back
        </button>
        <button
          type="button"
          onClick={isLast ? onClose : onNext}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] active:translate-y-0 active:scale-[0.98]"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {isLast ? "Done" : "Next"}
          {!isLast && <ArrowRight size={15} weight="bold" />}
        </button>
      </footer>
    </motion.div>
  );
}
