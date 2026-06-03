"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  start: string;
  end: string;
  onChange: (next: { start: string; end: string }) => void;
};

/**
 * Unified range date picker themed for the Proxy portal.
 *
 * Usage: click once to set the start, click again to set the end.
 * Clicking a date earlier than the current start swaps them. Future
 * dates are disabled (exports only include historical data). The
 * prev/next caret navigates month-by-month; for jumps beyond a few
 * months, the By-year preset is a better fit.
 */
export function RangeCalendar({ start, end, onChange }: Props) {
  const today = useMemo(() => isoDate(new Date()), []);

  // Seed the calendar view from the current start date, or fall back to
  // today's month/year if nothing is picked yet.
  const [viewYear, setViewYear] = useState(() => {
    if (start) return Number(start.slice(0, 4));
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (start) return Number(start.slice(5, 7)) - 1;
    return new Date().getMonth();
  });
  const [hovered, setHovered] = useState<string | null>(null);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = new Date(viewYear, viewMonth, 1).getDay();
  const calDays: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calDays.push(isoDate(new Date(viewYear, viewMonth, d)));
  }
  // Pad to a fixed 6-row grid (42 cells) so the calendar height never
  // jumps between months with 4, 5, or 6 rows.
  while (calDays.length < 42) calDays.push(null);

  const onDayClick = useCallback(
    (iso: string) => {
      if (iso > today) return;
      if (!start || (start && end)) {
        // Fresh selection: new start, clear end.
        onChange({ start: iso, end: "" });
      } else if (iso < start) {
        // Picked earlier than the current start: swap them.
        onChange({ start: iso, end: start });
      } else {
        onChange({ start, end: iso });
      }
    },
    [start, end, today, onChange],
  );

  // While the user has a start but no end, use the hovered cell as a
  // virtual end so the range highlight previews in real time.
  const effectiveEnd = end || hovered || "";
  const selStart =
    start && effectiveEnd && effectiveEnd < start ? effectiveEnd : start;
  const selEnd =
    start && effectiveEnd && effectiveEnd < start ? start : effectiveEnd;

  const isInRange = (iso: string) => {
    if (!selStart) return false;
    if (!selEnd) return iso === selStart;
    return iso >= selStart && iso <= selEnd;
  };
  const isStart = (iso: string) => iso === selStart;
  const isEnd = (iso: string) => iso === (selEnd || selStart);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function prevYear() {
    setViewYear((y) => y - 1);
  }

  function nextYear() {
    setViewYear((y) => y + 1);
  }

  const now = new Date();
  const atCurrentMonth =
    viewYear === now.getFullYear() && viewMonth === now.getMonth();
  // Only clamp the year jump if jumping forward would land us past the
  // current month. Otherwise we just show that year's view and rely on
  // the per-day disabled check to block future dates.
  const nextYearIsFuture =
    viewYear + 1 > now.getFullYear() ||
    (viewYear + 1 === now.getFullYear() && viewMonth > now.getMonth());

  // Count of selected days, inclusive of both endpoints.
  const dayCount = useMemo(() => {
    if (!start || !end) return 0;
    const [ys, ms, ds] = start.split("-").map(Number);
    const [ye, me, de] = end.split("-").map(Number);
    const msPerDay = 24 * 60 * 60 * 1000;
    return (
      Math.round(
        (Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / msPerDay,
      ) + 1
    );
  }, [start, end]);

  // Header summary line that tells the user what they're doing.
  let summary: string;
  if (!start) summary = "Pick a start date";
  else if (!end) summary = `${prettyDate(start)}  . . .  pick end date`;
  else
    summary = `${prettyDate(start)} to ${prettyDate(end)}  ·  ${dayCount} ${dayCount === 1 ? "day" : "days"}`;

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={prevYear}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-secondary)" }}
            aria-label="Previous year"
            title="Previous year"
          >
            <CaretDoubleLeft size={12} weight="bold" />
          </button>
          <button
            type="button"
            onClick={prevMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-secondary)" }}
            aria-label="Previous month"
            title="Previous month"
          >
            <CaretLeft size={13} weight="bold" />
          </button>
        </div>
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: "var(--color-text-primary)" }}
        >
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={nextMonth}
            disabled={atCurrentMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)] disabled:opacity-30 disabled:hover:bg-transparent"
            style={{ color: "var(--color-text-secondary)" }}
            aria-label="Next month"
            title="Next month"
          >
            <CaretRight size={13} weight="bold" />
          </button>
          <button
            type="button"
            onClick={nextYear}
            disabled={nextYearIsFuture}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)] disabled:opacity-30 disabled:hover:bg-transparent"
            style={{ color: "var(--color-text-secondary)" }}
            aria-label="Next year"
            title="Next year"
          >
            <CaretDoubleRight size={12} weight="bold" />
          </button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div
        className="mt-2 grid grid-cols-7 text-center text-[9px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {DOW_LABELS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7"
        onMouseLeave={() => setHovered(null)}
      >
        {calDays.map((iso, i) => {
          if (!iso) return <div key={`e-${i}`} className="h-8" />;
          const isFuture = iso > today;
          const inRange = isInRange(iso);
          const isS = isStart(iso);
          const isE = isEnd(iso);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              disabled={isFuture}
              onClick={() => onDayClick(iso)}
              onMouseEnter={() => {
                if (start && !end) setHovered(iso);
              }}
              className="relative flex h-8 items-center justify-center text-[12px] tabular-nums transition-colors"
              style={{
                color: isFuture
                  ? "var(--color-text-tertiary)"
                  : isS || isE
                    ? "#ffffff"
                    : inRange
                      ? "var(--color-brand)"
                      : "var(--color-text-primary)",
                backgroundColor:
                  isS || isE
                    ? "var(--color-brand)"
                    : inRange
                      ? "rgba(2, 170, 235, 0.14)"
                      : "transparent",
                borderRadius:
                  isS && isE
                    ? "8px"
                    : isS
                      ? "8px 0 0 8px"
                      : isE
                        ? "0 8px 8px 0"
                        : "0",
                cursor: isFuture ? "default" : "pointer",
                opacity: isFuture ? 0.35 : 1,
                fontWeight: isToday || isS || isE ? 700 : 500,
              }}
            >
              {Number(iso.slice(8, 10))}
            </button>
          );
        })}
      </div>

      {/* Selection summary */}
      <div
        className="mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-[11px]"
        style={{
          borderColor: start
            ? "rgba(2, 170, 235, 0.25)"
            : "var(--color-warm-gray-200)",
          backgroundColor: start
            ? "rgba(2, 170, 235, 0.04)"
            : "var(--color-warm-gray-50)",
          color: start ? "var(--color-brand)" : "var(--color-text-tertiary)",
        }}
      >
        <span className="font-medium">{summary}</span>
        {start || end ? (
          <button
            type="button"
            onClick={() => onChange({ start: "", end: "" })}
            className="text-[11px] font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
