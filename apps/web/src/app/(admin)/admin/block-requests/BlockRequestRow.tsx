"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowCounterClockwise,
  Check,
  CheckCircle,
  Timer,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  decideBlockRequest,
  reopenBlockRequest,
} from "@/app/(workspace)/workspace/reserve/actions";
import { labelForBlockStatus } from "@/lib/labels";

type Row = {
  id: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  startDate: string;
  endDate: string;
  note: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string;
  propertyLabel: string;
};

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRange(start: string, end: string) {
  if (start === end) return fmtDate(start);
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

function fmtCreated(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "rgba(245, 158, 11, 0.16)", fg: "#fbbf24" },
  approved: { bg: "rgba(22, 163, 74, 0.16)", fg: "#4ade80" },
  declined: { bg: "rgba(220, 38, 38, 0.16)", fg: "#f87171" },
  cancelled: { bg: "rgba(161, 161, 170, 0.16)", fg: "#a1a1aa" },
};

const UNDO_SECONDS = 7;

export function BlockRequestRow({ row }: { row: Row }) {
  const [status, setStatus] = useState(row.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Undo timer state
  const [undoCountdown, setUndoCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const commitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (commitRef.current) clearTimeout(commitRef.current);
    timerRef.current = null;
    commitRef.current = null;
  }, []);

  // Clean up on unmount
  useEffect(() => clearTimers, [clearTimers]);

  const commitDecline = useCallback(() => {
    clearTimers();
    setUndoCountdown(null);
    startTransition(async () => {
      const result = await decideBlockRequest({
        id: row.id,
        decision: "declined",
      });
      if (result.ok) {
        setStatus("declined");
      } else {
        setError(result.error);
      }
    });
  }, [row.id, clearTimers, startTransition]);

  const startDeclineTimer = () => {
    setError(null);
    setUndoCountdown(UNDO_SECONDS);

    timerRef.current = setInterval(() => {
      setUndoCountdown((prev) => {
        if (prev === null || prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    commitRef.current = setTimeout(commitDecline, UNDO_SECONDS * 1000);
  };

  const undoDecline = () => {
    clearTimers();
    setUndoCountdown(null);
  };

  const approve = () => {
    // If there's a pending decline timer, cancel it first
    clearTimers();
    setUndoCountdown(null);
    setError(null);
    startTransition(async () => {
      const result = await decideBlockRequest({
        id: row.id,
        decision: "approved",
      });
      if (result.ok) {
        setStatus("approved");
      } else {
        setError(result.error);
      }
    });
  };

  const reopen = () => {
    setError(null);
    startTransition(async () => {
      const result = await reopenBlockRequest({ id: row.id });
      if (result.ok) {
        setStatus("pending");
      } else {
        setError(result.error);
      }
    });
  };

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const isUndoing = undoCountdown !== null;
  const canReopen = status === "declined" || status === "cancelled";

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {fmtRange(row.startDate, row.endDate)}
            </h3>
            {!isUndoing && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: style.bg, color: style.fg }}
              >
                {labelForBlockStatus(status)}
              </span>
            )}
          </div>
          <div
            className="mt-1 text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {row.propertyLabel}
          </div>
          <div
            className="mt-0.5 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {row.ownerName ?? row.ownerEmail}
            {row.ownerName ? ` • ${row.ownerEmail}` : null} • submitted{" "}
            {fmtCreated(row.createdAt)}
          </div>
          {row.note ? (
            <p
              className="mt-3 rounded-lg border px-3 py-2 text-sm"
              style={{
                backgroundColor: "var(--color-warm-gray-50)",
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
              }}
            >
              {row.note}
            </p>
          ) : null}
        </div>

        {/* Pending: show approve/decline (or undo countdown) */}
        {status === "pending" && !isUndoing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={startDeclineTimer}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                borderColor: "rgba(248, 113, 113, 0.4)",
                color: "#f87171",
                backgroundColor: "transparent",
              }}
            >
              <X size={14} weight="bold" /> Flag conflict
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={approve}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{
                backgroundColor: "#16a34a",
                color: "#ffffff",
              }}
            >
              <Check size={14} weight="bold" /> Confirm clear
            </button>
          </div>
        ) : null}

        {/* Undo countdown */}
        {status === "pending" && isUndoing ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Timer
                size={14}
                weight="bold"
                style={{ color: "#f87171" }}
              />
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "#f87171" }}
              >
                Flagging conflict in {undoCountdown}s
              </span>
            </div>
            <button
              type="button"
              onClick={undoDecline}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
                backgroundColor: "transparent",
              }}
            >
              <ArrowCounterClockwise size={14} weight="bold" /> Undo
            </button>
          </div>
        ) : null}

        {/* Reopen button for declined/cancelled */}
        {canReopen && !pending ? (
          <button
            type="button"
            onClick={reopen}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-secondary)",
              backgroundColor: "transparent",
            }}
          >
            <ArrowCounterClockwise size={14} weight="bold" /> Reopen for review
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
          style={{
            backgroundColor: "rgba(248, 113, 113, 0.08)",
            color: "#fecaca",
          }}
        >
          <WarningCircle size={14} weight="fill" /> {error}
        </div>
      ) : null}

      {status !== "pending" && status !== row.status ? (
        <div
          className="mt-3 flex items-center gap-2 text-xs"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          <CheckCircle size={12} weight="fill" /> Updated. Remember to{" "}
          {status === "approved"
            ? "block these dates"
            : "let the owner know about the conflict"}{" "}
          in Hospitable.
        </div>
      ) : null}
    </div>
  );
}
