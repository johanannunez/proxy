"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReservationRow = {
  id: string;
  status: string; // "pending" | "approved" | "declined" | "cancelled"
  propertyName: string;
  propertyUnit: string | null;
  cityLine: string;
  checkInDate: string;   // formatted, e.g. "Apr 15"
  checkInTime: string | null;
  checkOutDate: string;
  checkOutTime: string | null;
  guestLine: string;     // e.g. "2 adults · 1 pet"
  cleaning: boolean;
  isOwnerStaying: boolean;
  daysAway: number | null; // null for past rows
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function accentColor(status: string): string {
  if (status === "approved") return "#16a34a";
  if (status === "declined" || status === "cancelled") return "#dc2626";
  return "#f59e0b"; // pending
}

function statusBadge(status: string): { color: string; label: string } {
  switch (status) {
    case "approved":  return { color: "#16a34a", label: "Approved" };
    case "declined":  return { color: "#dc2626", label: "Declined" };
    case "cancelled": return { color: "#6b7280", label: "Cancelled" };
    default:          return { color: "#f59e0b", label: "Under review" };
  }
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function Row({ row, muted = false }: { row: ReservationRow; muted?: boolean }) {
  const accent = accentColor(row.status);
  const badge  = statusBadge(row.status);

  return (
    <tr
      className="border-b"
      style={{
        borderColor: "var(--color-warm-gray-100)",
        opacity: muted ? 0.55 : 1,
      }}
    >
      {/* 4 px status stripe */}
      <td className="p-0 w-[4px]" style={{ backgroundColor: accent }} />

      {/* Property */}
      <td className="px-4 py-2 min-w-[140px]">
        <p
          className="text-[13px] font-semibold leading-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {row.propertyName}
          {row.propertyUnit && (
            <span className="ml-1" style={{ color: "var(--color-brand)" }}>
              {row.propertyUnit}
            </span>
          )}
        </p>
        {row.cityLine && (
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
            {row.cityLine}
          </p>
        )}
      </td>

      {/* Status badge */}
      <td className="px-4 py-2 whitespace-nowrap">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            backgroundColor: `${badge.color}18`,
            color: badge.color,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: badge.color }}
          />
          {badge.label}
        </span>
      </td>

      {/* Check-in — date + time on one line, days-away badge below */}
      <td className="px-4 py-2 whitespace-nowrap">
        <p className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
          {row.checkInDate}
          {row.checkInTime && (
            <span className="ml-1.5 font-normal text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              {row.checkInTime}
            </span>
          )}
        </p>
        {row.daysAway !== null && (
          <span
            className="mt-1 inline-block rounded-full px-1.5 py-px text-[10px] font-semibold"
            style={{
              backgroundColor:
                row.daysAway === 0
                  ? "rgba(22,163,74,0.12)"
                  : row.daysAway <= 7
                    ? "rgba(245,158,11,0.12)"
                    : "rgba(2,170,235,0.10)",
              color:
                row.daysAway === 0
                  ? "#15803d"
                  : row.daysAway <= 7
                    ? "#92400e"
                    : "var(--color-brand)",
            }}
          >
            {row.daysAway === 0
              ? "Today"
              : row.daysAway === 1
                ? "Tomorrow"
                : `${row.daysAway} days`}
          </span>
        )}
      </td>

      {/* Check-out — date + time on one line */}
      <td className="px-4 py-2 whitespace-nowrap">
        <p className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
          {row.checkOutDate}
          {row.checkOutTime && (
            <span className="ml-1.5 font-normal text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              {row.checkOutTime}
            </span>
          )}
        </p>
      </td>

      {/* Guests */}
      <td className="hidden sm:table-cell px-4 py-2 whitespace-nowrap">
        <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
          {row.guestLine || "—"}
        </p>
      </td>

      {/* Cleaning */}
      <td className="hidden sm:table-cell px-4 py-2 whitespace-nowrap">
        <p
          className="text-[12px] font-medium"
          style={{ color: row.cleaning ? "#15803d" : "#64748b" }}
        >
          {row.cleaning ? "Proxy cleans" : "Owner cleans"}
        </p>
      </td>

      {/* Stay type */}
      <td className="hidden md:table-cell px-4 py-2 whitespace-nowrap">
        <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
          {row.isOwnerStaying ? "Owner" : "Guest"}
        </p>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function ReservationsTable({
  upcoming,
  past,
  underReviewCount = 0,
  completedCount = 0,
}: {
  upcoming: ReservationRow[];
  past: ReservationRow[];
  underReviewCount?: number;
  completedCount?: number;
}) {
  const [pastOpen, setPastOpen] = useState(false);

  const totalCount = upcoming.length + past.length;
  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div
        className="flex items-center justify-between gap-3 border-b pb-3"
        style={{ borderColor: "var(--color-warm-gray-200)" }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2
            className="text-[13px] font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            All Reservations
          </h2>
          {underReviewCount > 0 && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#b45309" }}
            >
              {underReviewCount} under review
            </span>
          )}
          {completedCount > 0 && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: "rgba(22,163,74,0.10)", color: "#15803d" }}
            >
              {completedCount} completed
            </span>
          )}
        </div>
        <Link
          href="/workspace/reserve/new"
          className="shrink-0 text-[12px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: "var(--color-brand)" }}
        >
          + New reservation
        </Link>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "var(--color-warm-gray-200)" }}
      >
        <table className="w-full border-collapse">
          {/* Column headers */}
          <thead>
            <tr style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
              <th className="p-0 w-[4px]" />
              {(["Property", "Status", "Check-in", "Check-out"] as const).map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {h}
                </th>
              ))}
              <th
                className="hidden sm:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Guests
              </th>
              <th
                className="hidden sm:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Cleaning
              </th>
              <th
                className="hidden md:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Type
              </th>
            </tr>
          </thead>

          {/* Upcoming / active rows */}
          <tbody>
            {upcoming.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-7 text-center text-[13px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  No upcoming reservations.
                </td>
              </tr>
            ) : (
              upcoming.map((r) => <Row key={r.id} row={r} />)
            )}
          </tbody>

          {/* Past toggle + past rows */}
          {past.length > 0 && (
            <>
              <tbody>
                <tr
                  className="cursor-pointer select-none"
                  style={{ backgroundColor: "var(--color-warm-gray-50)" }}
                  onClick={() => setPastOpen((o) => !o)}
                >
                  <td className="p-0 w-[4px]" />
                  <td
                    colSpan={7}
                    className="px-4 py-2.5"
                  >
                    <div className="flex items-center gap-1.5">
                      {pastOpen ? (
                        <CaretUp
                          size={10}
                          weight="bold"
                          style={{ color: "var(--color-text-tertiary)" }}
                        />
                      ) : (
                        <CaretDown
                          size={10}
                          weight="bold"
                          style={{ color: "var(--color-text-tertiary)" }}
                        />
                      )}
                      <span
                        className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        Past ({past.length})
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
              {pastOpen && (
                <tbody>
                  {past.map((r) => <Row key={r.id} row={r} muted />)}
                </tbody>
              )}
            </>
          )}
        </table>
      </div>
    </div>
  );
}
