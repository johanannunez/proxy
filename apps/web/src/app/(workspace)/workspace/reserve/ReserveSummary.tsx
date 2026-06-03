"use client";

import { Broom, House, Lock, MapPin, Moon, User } from "@phosphor-icons/react";
import type { ReserveProperty } from "./types";

/**
 * Live summary of the reserve form state. Mirrors every field as it
 * fills, like a boarding pass being printed in real time. Rendered as
 * a sticky right-side card on desktop (>=lg) and as an inline stacked
 * card just above the submit button on mobile (the `compact` variant).
 */

function fmtShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ReserveSummary({
  property,
  startDate,
  endDate,
  nights,
  reason,
  reasonDetail,
  adults,
  childrenCount,
  pets,
  isOwnerStaying,
  guestName,
  ownerName,
  wantsCleaning,
  baseCleaningFee,
  petFee,
  total,
  needsLockCode,
  checkInTime,
  checkOutTime,
  compact = false,
}: {
  property: ReserveProperty | null;
  startDate: string | null;
  endDate: string | null;
  nights: number;
  reason: string;
  reasonDetail: string;
  adults: number;
  childrenCount: number;
  pets: number;
  isOwnerStaying: boolean;
  guestName: string;
  ownerName: string;
  wantsCleaning: boolean;
  baseCleaningFee: number;
  petFee: number;
  total: number;
  needsLockCode: boolean;
  checkInTime: string;
  checkOutTime: string;
  compact?: boolean;
}) {
  const stayingName = isOwnerStaying ? ownerName : guestName.trim() || "Guest";
  const guestParts = [
    adults > 0 ? `${adults} adult${adults !== 1 ? "s" : ""}` : null,
    childrenCount > 0
      ? `${childrenCount} child${childrenCount !== 1 ? "ren" : ""}`
      : null,
    pets > 0 ? `${pets} pet${pets !== 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  const datesReady = !!startDate && !!endDate;
  const reasonDisplay = reasonDetail.trim()
    ? `${reason}: ${reasonDetail.trim()}`
    : reason;

  return (
    <aside
      className="flex flex-col overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
      aria-label="Reservation summary"
    >
      {/* Header with property */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{
          borderBottom: "1px solid var(--color-warm-gray-200)",
          background:
            "linear-gradient(135deg, rgba(2,170,235,0.06) 0%, rgba(2,170,235,0) 100%)",
        }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "rgba(2, 170, 235, 0.10)",
            color: "var(--color-brand)",
          }}
        >
          <House size={18} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Reserving
          </p>
          <p className="flex items-baseline gap-1.5 truncate text-[14px] font-semibold leading-tight">
            <span style={{ color: "var(--color-text-primary)" }}>
              {property?.name ?? "Select a home"}
            </span>
            {property?.unit ? (
              <span className="shrink-0 text-[12px] font-semibold" style={{ color: "var(--color-brand)" }}>
                {property.unit}
              </span>
            ) : null}
          </p>
          {property?.address ? (
            <p
              className="mt-0.5 truncate text-[11px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {property.address}
            </p>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 px-5 py-4">
        <SummaryRow
          icon={<Moon size={15} weight="duotone" />}
          primary={
            datesReady
              ? `${fmtShortDate(startDate!)} → ${fmtShortDate(endDate!)}`
              : "Dates not picked yet"
          }
          secondary={
            datesReady
              ? `${nights} ${nights === 1 ? "night" : "nights"} · ${checkInTime} to ${checkOutTime}`
              : "Click days in the calendar"
          }
          muted={!datesReady}
        />

        <SummaryRow
          icon={<MapPin size={15} weight="duotone" />}
          primary={reasonDisplay || "Reason not picked"}
          secondary={
            guestParts.length > 0 ? guestParts.join(", ") : "No guests yet"
          }
          muted={!reason}
        />

        <SummaryRow
          icon={<User size={15} weight="duotone" />}
          primary={stayingName}
          secondary={
            isOwnerStaying ? "Owner staying" : "Someone else staying"
          }
          muted={!isOwnerStaying && !guestName.trim()}
        />

        <SummaryRow
          icon={<Broom size={15} weight="duotone" />}
          primary={wantsCleaning ? "Cleaning scheduled" : "No cleaning"}
          secondary={
            wantsCleaning
              ? petFee > 0
                ? `$${baseCleaningFee} cleaning + $${petFee} pet`
                : `${property?.bedrooms ?? 1}-bedroom · $${baseCleaningFee}`
              : "I will clean myself"
          }
          muted={false}
        />

        {needsLockCode ? (
          <SummaryRow
            icon={<Lock size={15} weight="duotone" />}
            primary="New lock code requested"
            secondary="We will set one for you"
            muted={false}
          />
        ) : null}
      </div>

      {/* Totals strip */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{
          borderTop: "1px solid var(--color-warm-gray-200)",
          backgroundColor: "var(--color-warm-gray-50)",
        }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Total
        </span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: "var(--color-text-primary)" }}
        >
          ${total}
        </span>
      </div>

      {!compact ? (
        <p
          className="px-5 pb-4 pt-2 text-[11px] leading-relaxed"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Stays in your own home are free. Cleaning is the only charge.
        </p>
      ) : null}
    </aside>
  );
}

function SummaryRow({
  icon,
  primary,
  secondary,
  muted,
}: {
  icon: React.ReactNode;
  primary: string;
  secondary: string;
  muted: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: "var(--color-warm-gray-50)",
          color: muted
            ? "var(--color-text-tertiary)"
            : "var(--color-text-secondary)",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] font-semibold leading-tight"
          style={{
            color: muted
              ? "var(--color-text-tertiary)"
              : "var(--color-text-primary)",
          }}
        >
          {primary}
        </p>
        <p
          className="mt-0.5 truncate text-[11px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {secondary}
        </p>
      </div>
    </div>
  );
}
