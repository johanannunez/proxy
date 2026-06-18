"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Broom,
  CaretDown,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  EnvelopeSimple,
  FileArrowDown,
  House,
  Lock,
  Moon,
  PawPrint,
  Phone,
  ShieldCheck,
  Sparkle,
  User,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import { submitBlockRequest } from "./actions";
import type { ReserveProperty } from "./types";
import { ReserveSummary } from "./ReserveSummary";
import { CustomSelect } from "@/components/workspace/CustomSelect";

/**
 * Single-page reservation form. This is the unrolled version of the
 * old 5-step BlockRequestWizard modal, reshaped for a dedicated page.
 * Users scroll through sections (Home, Dates, Stay details, Guests,
 * Logistics, Acknowledgment) and submit. A sticky live summary on the
 * right mirrors the state in real time; on mobile it collapses to a
 * stacked card above the submit button.
 */

type FormData = {
  propertyId: string;
  startDate: string | null;
  endDate: string | null;
  checkInTime: string;
  checkOutTime: string;
  reason: string;
  reasonDetail: string;
  adults: number;
  children: number;
  pets: number;
  notes: string;
  isOwnerStaying: boolean;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  needsLockCode: boolean;
  requestedLockCode: string;
  wantsCleaning: boolean;
  damageAcknowledged: boolean;
  propertyStandardsAcknowledged: boolean;
};

/**
 * Auto-formats a US phone number as (555) 000-0000 while typing.
 * International numbers (starting with +) are passed through as-is.
 */
function formatPhoneInput(raw: string): string {
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Reasons that require a follow-up detail field. When the owner picks
 * one of these, a required text input appears asking "what?".
 */
const REASONS_NEED_DETAIL = new Set([
  "Renovation",
  "Maintenance",
  "Other",
]);

/** Placeholder text per reason when the detail field is required. */
const REASON_DETAIL_PLACEHOLDER: Record<string, string> = {
  Renovation: "What's being renovated? (e.g., kitchen backsplash)",
  Maintenance: "What's being maintained? (e.g., HVAC service)",
  Other: "Describe the reason",
};

/**
 * Quick-add note presets. Clicking appends to the notes textarea so
 * owners don't have to type common special requests from scratch.
 * Check-in/out times are handled by the time picker, not these chips.
 */
const NOTE_SUGGESTIONS = [
  "Extra towels and linens needed",
  "Firewood stocked for the stay",
  "Grocery delivery scheduled",
  "Pool/hot tub heated on arrival",
  "Baby or toddler items needed",
  "Special occasion — note in welcome message",
];

/** Default pet surcharge when owner has not configured one on the property. */
const DEFAULT_PET_FEE = 25;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accept formatted US numbers like "(509) 579-9685" (10 digits) or international (+...)
function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return /^\+\d[\d\s()+\-.]{6,}$/.test(trimmed);
  return trimmed.replace(/\D/g, "").length === 10;
}

type TimeGroup = { label: string; times: string[] };

/** Friendly display labels for times that benefit from disambiguation. */
const TIME_DISPLAY_LABELS: Record<string, string> = {
  "12:00 AM": "12:00 AM (Midnight)",
  "12:00 PM": "12:00 PM (Noon)",
};

/** Convert TimeGroup[] into the SelectGroup[] format expected by CustomSelect. */
function timeGroupsToSelectGroups(
  groups: TimeGroup[],
): import("@/components/workspace/CustomSelect").SelectGroup[] {
  return groups.map((g) => ({
    label: g.label,
    options: g.times.map((t) => ({
      value: t,
      label: TIME_DISPLAY_LABELS[t] ?? t,
    })),
  }));
}

/**
 * Full 24-hour check-in coverage, grouped by convention:
 * standard (4 PM–11 PM), midnight, early morning through noon.
 */
const CHECK_IN_TIME_GROUPS: TimeGroup[] = [
  {
    label: "Standard (4 PM or later)",
    times: ["4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"],
  },
  {
    label: "Late check-in",
    times: ["9:00 PM", "10:00 PM", "11:00 PM"],
  },
  {
    label: "Midnight",
    times: ["12:00 AM"],
  },
  {
    label: "Early check-in",
    times: ["1:00 AM", "2:00 AM", "3:00 AM", "4:00 AM", "5:00 AM", "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM"],
  },
  {
    label: "Afternoon",
    times: ["1:00 PM", "2:00 PM", "3:00 PM"],
  },
];

/**
 * Full 24-hour check-out coverage, grouped by convention:
 * standard (up through noon), afternoon/evening, midnight.
 */
const CHECK_OUT_TIME_GROUPS: TimeGroup[] = [
  {
    label: "Standard (before noon)",
    times: ["6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM"],
  },
  {
    label: "Afternoon / late check-out",
    times: ["12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM"],
  },
  {
    label: "Midnight / next day",
    times: ["12:00 AM"],
  },
];
const REASONS = [
  "Personal stay",
  "Family visiting",
  "Renovation",
  "Maintenance",
  "Other",
];

const CLEANING_FEES: Record<number, number> = {
  1: 100,
  2: 125,
  3: 150,
  4: 175,
};

function cleaningFee(bedrooms: number | null): number {
  if (!bedrooms || bedrooms < 1) return 100;
  if (bedrooms > 4) return 175;
  return CLEANING_FEES[bedrooms] ?? 100;
}

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

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nightCount(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.max(
    0,
    Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function fmtLongDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Custom property selector. Replaces the native <select> with a premium
 * dropdown that matches the Proxy brand palette and portal design language.
 */
function PropertyDropdown({
  properties,
  value,
  onChange,
  hasError,
}: {
  properties: ReserveProperty[];
  value: string;
  onChange: (id: string) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = properties.find((p) => p.id === value) ?? properties[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{
          backgroundColor: open
            ? "rgba(2, 170, 235, 0.04)"
            : "var(--color-white)",
          borderColor: hasError
            ? "#ef4444"
            : open
              ? "var(--color-brand)"
              : "var(--color-warm-gray-200)",
          boxShadow: open
            ? "0 0 0 3px rgba(2, 170, 235, 0.12)"
            : "none",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-baseline gap-1.5 truncate text-sm font-medium leading-tight">
            <span style={{ color: "var(--color-text-primary)" }}>
              {selected?.name ?? "Select a property"}
            </span>
            {selected?.unit ? (
              <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: "var(--color-brand)" }}>
                {selected.unit}
              </span>
            ) : null}
          </span>
          {selected?.address ? (
            <span
              className="truncate text-[11.5px] leading-tight"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {selected.address}
            </span>
          ) : null}
        </div>
        <CaretDown
          size={14}
          weight="bold"
          className="shrink-0 transition-transform duration-150"
          style={{
            color: "var(--color-text-tertiary)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown panel */}
      {open ? (
        <div
          className="scrollbar-hide absolute left-0 right-0 z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border py-1"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 32px -4px rgba(0,0,0,0.10)",
          }}
          role="listbox"
        >
          {properties.map((p) => {
            const isSelected = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75"
                style={{
                  backgroundColor: isSelected
                    ? "rgba(2, 170, 235, 0.06)"
                    : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "var(--color-warm-gray-50, #fafaf9)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "";
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-baseline gap-1.5 truncate text-sm font-medium leading-tight">
                    <span
                      style={{
                        color: isSelected
                          ? "var(--color-brand)"
                          : "var(--color-text-primary)",
                      }}
                    >
                      {p.name}
                    </span>
                    {p.unit ? (
                      <span
                        className="shrink-0 text-[11.5px] font-semibold"
                        style={{ color: "var(--color-brand)" }}
                      >
                        {p.unit}
                      </span>
                    ) : null}
                  </span>
                  {p.address ? (
                    <span
                      className="truncate text-[11.5px] leading-tight"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {p.address}
                    </span>
                  ) : null}
                </div>
                {isSelected ? (
                  <Check
                    size={14}
                    weight="bold"
                    style={{ color: "var(--color-brand)", flexShrink: 0 }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function ReserveForm({
  properties,
  ownerName,
  ownerEmail,
  ownerPhone,
  ownerAvatarUrl,
}: {
  properties: ReserveProperty[];
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerAvatarUrl?: string | null;
}) {
  const [data, setData] = useState<FormData>(() => ({
    propertyId: properties[0]?.id ?? "",
    startDate: null,
    endDate: null,
    checkInTime: "4:00 PM",
    checkOutTime: "10:00 AM",
    reason: "",
    reasonDetail: "",
    adults: 1,
    children: 0,
    pets: 0,
    notes: "",
    isOwnerStaying: true,
    guestFirstName: "",
    guestLastName: "",
    guestEmail: "",
    guestPhone: "",
    needsLockCode: false,
    requestedLockCode: "",
    wantsCleaning: true,
    damageAcknowledged: false,
    propertyStandardsAcknowledged: false,
  }));
  const [submitted, setSubmitted] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Partial<FormData>) => setData((d) => ({ ...d, ...patch })),
    [],
  );

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === data.propertyId) ?? properties[0],
    [properties, data.propertyId],
  );

  const isSingleProperty = properties.length === 1;

  const baseCleaningFee = selectedProperty
    ? (selectedProperty.cleaningFee ?? cleaningFee(selectedProperty.bedrooms))
    : 100;

  const hasPets = data.pets > 0;
  const propertyPetFee = selectedProperty?.petFee ?? DEFAULT_PET_FEE;
  const petFeeCharged = hasPets && data.wantsCleaning ? propertyPetFee : 0;
  const totalDueAtCheckout = data.wantsCleaning
    ? baseCleaningFee + petFeeCharged
    : 0;

  const petsNotAllowed =
    hasPets && selectedProperty?.petsAllowed === false;

  const nights =
    data.startDate && data.endDate
      ? nightCount(data.startDate, data.endDate)
      : 0;

  // ─── Guest validation (only matters when someone else is staying) ───
  const guestFullName = data.isOwnerStaying
    ? ownerName
    : [data.guestFirstName, data.guestLastName].filter(Boolean).join(" ").trim();

  const guestEmailValid =
    data.isOwnerStaying || data.guestEmail.trim() === ""
      ? true
      : EMAIL_REGEX.test(data.guestEmail.trim());
  const guestPhoneValid =
    data.isOwnerStaying || data.guestPhone.trim() === ""
      ? true
      : isValidPhone(data.guestPhone);

  const reasonDetailNeeded = REASONS_NEED_DETAIL.has(data.reason);
  const reasonDetailComplete =
    !reasonDetailNeeded || data.reasonDetail.trim().length > 0;

  const guestComplete = data.isOwnerStaying
    ? true
    : data.guestFirstName.trim().length > 0 &&
      data.guestLastName.trim().length > 0 &&
      data.guestEmail.trim().length > 0 &&
      guestEmailValid &&
      data.guestPhone.trim().length > 0 &&
      guestPhoneValid;

  const canSubmit =
    !!data.propertyId &&
    !!data.startDate &&
    !!data.endDate &&
    !!data.reason &&
    reasonDetailComplete &&
    guestComplete &&
    data.damageAcknowledged &&
    data.propertyStandardsAcknowledged &&
    !pending;

  const missingFields: string[] = [];
  if (!data.propertyId) missingFields.push("property");
  if (!data.startDate || !data.endDate) missingFields.push("dates");
  if (!data.reason) missingFields.push("reason");
  if (!reasonDetailComplete) missingFields.push("reason details");
  if (!data.isOwnerStaying) {
    if (!data.guestFirstName.trim()) missingFields.push("first name");
    if (!data.guestLastName.trim()) missingFields.push("last name");
    if (!data.guestEmail.trim()) missingFields.push("email");
    else if (!guestEmailValid) missingFields.push("valid email");
    if (!data.guestPhone.trim()) missingFields.push("phone");
    else if (!guestPhoneValid) missingFields.push("valid phone");
  }
  if (!data.damageAcknowledged) missingFields.push("damage acknowledgment");
  if (!data.propertyStandardsAcknowledged) missingFields.push("property standards");

  // ─── Auto-populate lock code suggestion from guest phone last 4 digits ───
  const phoneDigits = data.guestPhone.replace(/\D/g, "");
  const lockCodeSuggestion =
    !data.isOwnerStaying && phoneDigits.length >= 4
      ? phoneDigits.slice(-4)
      : null;

  const onSubmit = () => {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    setError(null);
    // Concat the reason detail into the reason field so admins see
    // "Maintenance: HVAC filter replacement" in one place. Keeps us
    // out of a schema migration for the detail sub-field.
    const reasonWithDetail =
      reasonDetailNeeded && data.reasonDetail.trim()
        ? `${data.reason}: ${data.reasonDetail.trim()}`.slice(0, 120)
        : data.reason;
    startTransition(async () => {
      const result = await submitBlockRequest({
        propertyId: data.propertyId,
        startDate: data.startDate!,
        endDate: data.endDate!,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        reason: reasonWithDetail,
        adults: data.adults,
        children: data.children,
        pets: data.pets,
        notes: data.notes.trim() || undefined,
        isOwnerStaying: data.isOwnerStaying,
        guestName: data.isOwnerStaying
          ? undefined
          : guestFullName || undefined,
        guestEmail: data.isOwnerStaying ? undefined : data.guestEmail.trim(),
        guestPhone: data.isOwnerStaying ? undefined : data.guestPhone.trim(),
        needsLockCode: data.needsLockCode,
        requestedLockCode: data.needsLockCode
          ? data.requestedLockCode.trim() || undefined
          : undefined,
        wantsCleaning: data.wantsCleaning,
        cleaningFee: data.wantsCleaning ? totalDueAtCheckout : undefined,
        damageAcknowledged: data.damageAcknowledged,
      });
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    });
  };

  if (submitted) {
    return (
      <ReserveSuccess
        property={selectedProperty ?? null}
        ownerEmail={ownerEmail}
        data={data}
        nights={nights}
        total={totalDueAtCheckout}
        onReset={() => {
          setSubmitted(false);
          setData((d) => ({
            ...d,
            startDate: null,
            endDate: null,
            reason: "",
            reasonDetail: "",
            notes: "",
            damageAcknowledged: false,
          }));
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Left: form */}
      <div className="flex flex-col gap-8">
        {/* Section 1 — Which home */}
        <Section
          number="01"
          title={isSingleProperty ? "Your home" : "Which home?"}
          description={
            isSingleProperty
              ? "We have one home on file for you."
              : "Pick the property you want to reserve."
          }
        >
          {isSingleProperty && selectedProperty ? (
            <div className="flex items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.10)",
                  color: "var(--color-brand)",
                }}
              >
                <House size={18} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2 text-[15px] font-semibold leading-tight">
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {selectedProperty.name}
                  </span>
                  {selectedProperty.unit ? (
                    <span className="text-[13px] font-semibold" style={{ color: "var(--color-brand)" }}>
                      {selectedProperty.unit}
                    </span>
                  ) : null}
                </p>
                {selectedProperty.address ? (
                  <p
                    className="mt-0.5 text-[12.5px]"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {selectedProperty.address}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <PropertyDropdown
              properties={properties}
              value={data.propertyId}
              onChange={(id) => update({ propertyId: id })}
              hasError={submitAttempted && !data.propertyId}
            />
          )}
        </Section>

        {/* Section 2 — Dates */}
        <Section
          number="02"
          title="When?"
          description="Pick a start date, then an end date. We will check these against existing bookings."
        >
          <InlineCalendar
            startDate={data.startDate}
            endDate={data.endDate}
            onChange={(start, end) =>
              update({ startDate: start, endDate: end })
            }
          />
          {data.startDate && data.endDate ? (
            <div
              className="mt-4 flex items-center justify-between rounded-xl border px-4 py-3"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.04)",
                borderColor: "rgba(2, 170, 235, 0.25)",
              }}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Moon
                  size={15}
                  weight="duotone"
                  style={{ color: "var(--color-brand)" }}
                />
                <span style={{ color: "var(--color-brand)" }}>
                  {fmtLongDate(data.startDate)} to {fmtLongDate(data.endDate)}
                </span>
              </div>
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--color-brand)" }}
              >
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
            </div>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <MicroLabel>Check-in time</MicroLabel>
              <CustomSelect
                value={data.checkInTime}
                onChange={(v) => update({ checkInTime: v })}
                groups={timeGroupsToSelectGroups(CHECK_IN_TIME_GROUPS)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <MicroLabel>Check-out time</MicroLabel>
              <CustomSelect
                value={data.checkOutTime}
                onChange={(v) => update({ checkOutTime: v })}
                groups={timeGroupsToSelectGroups(CHECK_OUT_TIME_GROUPS)}
              />
            </div>
          </div>
        </Section>

        {/* Section 3 — Stay details */}
        <Section
          number="03"
          title="Stay details"
          description="What is the reason for the block and who will be there?"
        >
          <div className="flex flex-col gap-2">
            <MicroLabel>Reason (required)</MicroLabel>
            <div
              className="flex flex-wrap gap-2 rounded-lg p-1 transition-colors"
              style={{
                outline: submitAttempted && !data.reason
                  ? "2px solid rgba(220, 38, 38, 0.5)"
                  : "2px solid transparent",
              }}
            >
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    update({
                      reason: r,
                      // Clear the detail when the reason flips away
                      // from a detail-requiring option, so we don't
                      // smuggle stale text.
                      reasonDetail: REASONS_NEED_DETAIL.has(r)
                        ? data.reasonDetail
                        : "",
                    })
                  }
                  className="rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor:
                      data.reason === r
                        ? "rgba(2, 170, 235, 0.08)"
                        : "var(--color-white)",
                    borderColor:
                      data.reason === r
                        ? "var(--color-brand)"
                        : "var(--color-warm-gray-200)",
                    color:
                      data.reason === r
                        ? "var(--color-brand)"
                        : "var(--color-text-primary)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            {reasonDetailNeeded ? (
              <input
                type="text"
                value={data.reasonDetail}
                onChange={(e) => update({ reasonDetail: e.target.value })}
                placeholder={
                  REASON_DETAIL_PLACEHOLDER[data.reason] ??
                  "Tell us more"
                }
                maxLength={100}
                className="mt-1 h-10 w-full rounded-lg border px-3.5 text-sm outline-none focus:ring-2"
                style={{
                  backgroundColor: "var(--color-white)",
                  borderColor: "var(--color-warm-gray-200)",
                  color: "var(--color-text-primary)",
                }}
              />
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <MicroLabel>Guests</MicroLabel>
            <div className="flex flex-col gap-2">
              <NumberRow
                icon={<User size={16} weight="duotone" />}
                label="Adults"
                sublabel="Aged 13 or above"
                value={data.adults}
                min={0}
                max={30}
                onChange={(v) => update({ adults: v })}
              />
              <NumberRow
                icon={<Users size={16} weight="duotone" />}
                label="Children"
                sublabel="Aged 2 to 12"
                value={data.children}
                min={0}
                max={20}
                onChange={(v) => update({ children: v })}
              />
              <NumberRow
                icon={<PawPrint size={16} weight="duotone" />}
                label="Pets"
                sublabel={
                  data.wantsCleaning && hasPets
                    ? `+$${propertyPetFee} pet fee when we clean`
                    : ""
                }
                value={data.pets}
                min={0}
                max={10}
                onChange={(v) => update({ pets: v })}
              />
            </div>
            {petsNotAllowed ? (
              <div
                className="flex items-start gap-3 rounded-lg border px-4 py-3"
                style={{
                  backgroundColor: "rgba(220, 38, 38, 0.06)",
                  borderColor: "rgba(220, 38, 38, 0.28)",
                }}
              >
                <WarningCircle
                  size={16}
                  weight="fill"
                  className="mt-0.5 shrink-0"
                  style={{ color: "#b91c1c" }}
                />
                <div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: "#b91c1c" }}
                  >
                    This home is pet-free
                  </p>
                  <p
                    className="mt-0.5 text-xs leading-relaxed"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Are you sure you want to reserve with a pet? If yes, note
                    it here and we&apos;ll confirm before approving.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <MicroLabel>Additional notes (optional)</MicroLabel>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_SUGGESTIONS.map((suggestion) => {
                const alreadyIncluded = data.notes
                  .toLowerCase()
                  .includes(suggestion.toLowerCase());
                return (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      if (alreadyIncluded) return;
                      const next = data.notes.trim()
                        ? `${data.notes.trim()}. ${suggestion}`
                        : suggestion;
                      update({ notes: next });
                    }}
                    disabled={alreadyIncluded}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40"
                    style={{
                      borderColor: alreadyIncluded
                        ? "var(--color-brand)"
                        : "var(--color-warm-gray-200)",
                      backgroundColor: alreadyIncluded
                        ? "rgba(2, 170, 235, 0.06)"
                        : "var(--color-white)",
                      color: alreadyIncluded
                        ? "var(--color-brand)"
                        : "var(--color-text-secondary)",
                    }}
                  >
                    <Sparkle size={10} weight="duotone" />
                    {suggestion}
                  </button>
                );
              })}
            </div>
            <textarea
              value={data.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={3}
              maxLength={500}
              placeholder="Tap a suggestion above or type your own..."
              className="w-full resize-none rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--color-white)",
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
              }}
            />
          </div>
        </Section>

        {/* Section 4 — Who's staying */}
        <Section
          number="04"
          title="Who's staying?"
          description="Let us know if you're staying or if someone else will be at the property."
        >
          <div className="flex gap-3">
            {(
              [
                { val: true, label: "I'm staying", sub: ownerName },
                {
                  val: false,
                  label: "Someone else",
                  sub: "Enter their details",
                },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={() => update({ isOwnerStaying: opt.val })}
                className="flex flex-1 flex-col gap-1 rounded-xl border p-4 text-left transition-colors"
                style={{
                  backgroundColor:
                    data.isOwnerStaying === opt.val
                      ? "rgba(2, 170, 235, 0.04)"
                      : "var(--color-white)",
                  borderColor:
                    data.isOwnerStaying === opt.val
                      ? "var(--color-brand)"
                      : "var(--color-warm-gray-200)",
                }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {opt.label}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {opt.sub}
                </span>
              </button>
            ))}
          </div>

          {data.isOwnerStaying ? (
            <div
              className="mt-4 flex flex-col gap-3 rounded-xl border p-4"
              style={{
                backgroundColor: "var(--color-warm-gray-50)",
                borderColor: "var(--color-warm-gray-200)",
              }}
            >
              <div className="flex items-center gap-3">
                {ownerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ownerAvatarUrl}
                    alt={ownerName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: "rgba(2, 170, 235, 0.1)",
                      color: "var(--color-brand)",
                    }}
                  >
                    <User size={18} weight="duotone" />
                  </span>
                )}
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {ownerName}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 pl-[52px]">
                <div
                  className="flex items-center gap-2 text-[12.5px]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <EnvelopeSimple size={13} weight="duotone" />
                  <span>{ownerEmail}</span>
                </div>
                <div
                  className="flex items-center gap-2 text-[12.5px]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <Phone size={13} weight="duotone" />
                  <span>
                    {ownerPhone || (
                      <span
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        No phone on file
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="First name"
                  value={data.guestFirstName}
                  onChange={(v) => update({ guestFirstName: v })}
                  placeholder="First"
                  required
                  forceError={submitAttempted && !data.guestFirstName.trim()}
                />
                <TextInput
                  label="Last name"
                  value={data.guestLastName}
                  onChange={(v) => update({ guestLastName: v })}
                  placeholder="Last"
                  required
                  forceError={submitAttempted && !data.guestLastName.trim()}
                />
              </div>
              <TextInput
                label="Email"
                value={data.guestEmail}
                onChange={(v) => update({ guestEmail: v })}
                placeholder="guest@example.com"
                type="email"
                required
                error={
                  data.guestEmail.trim() && !guestEmailValid
                    ? "Enter a valid email address"
                    : null
                }
                forceError={submitAttempted && !data.guestEmail.trim()}
              />
              <TextInput
                label="Phone"
                value={data.guestPhone}
                onChange={(v) => update({ guestPhone: formatPhoneInput(v) })}
                placeholder="(555) 000-0000"
                type="tel"
                required
                error={
                  data.guestPhone.trim() && !guestPhoneValid
                    ? "Enter a valid phone number"
                    : null
                }
                forceError={submitAttempted && !data.guestPhone.trim()}
              />
            </div>
          )}
        </Section>

        {/* Section 5 — Logistics */}
        <Section
          number="05"
          title="Logistics"
          description="Smart lock code and cleaning after the stay."
        >
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <div className="flex items-center gap-3">
              <Lock
                size={18}
                weight="duotone"
                style={{ color: "var(--color-text-secondary)", flexShrink: 0 }}
              />
              <div className="flex-1">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {data.isOwnerStaying
                    ? "Your personal code"
                    : "Need a new smart lock code for your guest?"}
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {data.isOwnerStaying
                    ? "Use your own code. If you don't have one yet, pick Yes and we'll set one for you."
                    : "Create a fresh code for them. Never share your personal code."}
                </p>
              </div>
            </div>

            {/* Owner case: gentle reminder about not sharing */}
            {data.isOwnerStaying ? (
              <div
                className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.04)",
                  borderColor: "rgba(2, 170, 235, 0.22)",
                }}
              >
                <Lock
                  size={13}
                  weight="fill"
                  className="mt-0.5 shrink-0"
                  style={{ color: "var(--color-brand)" }}
                />
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    This code is just for you.
                  </span>{" "}
                  Don&apos;t share it with anyone. If you need to let someone
                  else in, switch to &quot;Someone else&quot; above and we will
                  create a fresh code for them.
                </p>
              </div>
            ) : (
              <div
                className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2"
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.04)",
                  borderColor: "rgba(245, 158, 11, 0.28)",
                }}
              >
                <ShieldCheck
                  size={13}
                  weight="fill"
                  className="mt-0.5 shrink-0"
                  style={{ color: "#b45309" }}
                />
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: "#b45309" }}
                  >
                    Use a different code for your guest.
                  </span>{" "}
                  Reusing your personal code is a security risk. If they end
                  up using yours, we will rotate your code after their stay
                  to keep things safe.
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5">
                {[false, true].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => update({ needsLockCode: val })}
                    className="rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor:
                        data.needsLockCode === val
                          ? "rgba(2, 170, 235, 0.08)"
                          : "var(--color-white)",
                      borderColor:
                        data.needsLockCode === val
                          ? "var(--color-brand)"
                          : "var(--color-warm-gray-200)",
                      color:
                        data.needsLockCode === val
                          ? "var(--color-brand)"
                          : "var(--color-text-primary)",
                    }}
                  >
                    {val ? "Yes, give me a new code." : "No, I will use my current code."}
                  </button>
                ))}
              </div>
              {/* Pin field — more vibrant when active */}
              <PinField
                value={data.requestedLockCode}
                onChange={(v) => update({ requestedLockCode: v })}
                disabled={!data.needsLockCode}
              />
              {/* Inline suggestion: appears right of pin when available */}
              {data.needsLockCode &&
              !data.isOwnerStaying &&
              lockCodeSuggestion ? (
                <div className="flex items-center gap-2">
                  <Sparkle
                    size={12}
                    weight="duotone"
                    style={{ color: "var(--color-brand)" }}
                  />
                  <span
                    className="text-[11.5px]"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Suggest last 4:
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      update({ requestedLockCode: lockCodeSuggestion })
                    }
                    disabled={data.requestedLockCode === lockCodeSuggestion}
                    className="rounded-md px-2 py-0.5 text-[12px] font-bold tabular-nums tracking-widest transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{
                      backgroundColor: "rgba(2, 170, 235, 0.12)",
                      color: "var(--color-brand)",
                      border: "1px solid rgba(2, 170, 235, 0.35)",
                    }}
                  >
                    {lockCodeSuggestion}
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <MicroLabel>Post-stay cleaning</MicroLabel>
            {/* Yes — green */}
            <button
              type="button"
              onClick={() => update({ wantsCleaning: true })}
              className="flex items-center gap-3 rounded-xl border p-4 text-left transition-colors"
              style={{
                backgroundColor: data.wantsCleaning
                  ? "rgba(22, 163, 74, 0.07)"
                  : "var(--color-white)",
                borderColor: data.wantsCleaning
                  ? "rgba(22, 163, 74, 0.7)"
                  : "var(--color-warm-gray-200)",
              }}
            >
              <span style={{ color: data.wantsCleaning ? "#15803d" : "var(--color-text-tertiary)" }}>
                <CheckCircle size={18} weight={data.wantsCleaning ? "fill" : "duotone"} />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: data.wantsCleaning ? "#15803d" : "var(--color-text-primary)" }}>
                  Yes, schedule our cleaning team
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                  We will coordinate the cleaning. Fee added below.
                </p>
              </div>
            </button>
            {/* No — amber */}
            <button
              type="button"
              onClick={() => update({ wantsCleaning: false })}
              className="flex items-center gap-3 rounded-xl border p-4 text-left transition-colors"
              style={{
                backgroundColor: !data.wantsCleaning
                  ? "rgba(234, 88, 12, 0.06)"
                  : "var(--color-white)",
                borderColor: !data.wantsCleaning
                  ? "rgba(234, 88, 12, 0.55)"
                  : "var(--color-warm-gray-200)",
              }}
            >
              <span style={{ color: !data.wantsCleaning ? "#c2410c" : "var(--color-text-tertiary)" }}>
                <Broom size={18} weight={!data.wantsCleaning ? "fill" : "duotone"} />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: !data.wantsCleaning ? "#c2410c" : "var(--color-text-primary)" }}>
                  No, I will clean it myself
                </p>
                <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
                  Follow the checklist and approve the cleaning standards.
                </p>
              </div>
            </button>
            {data.wantsCleaning ? (
              <div
                className="flex flex-col gap-2 rounded-lg border px-4 py-3"
                style={{
                  backgroundColor: "var(--color-warm-gray-50)",
                  borderColor: "var(--color-warm-gray-200)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Cleaning fee ({selectedProperty?.bedrooms ?? 1}-bedroom)
                  </span>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    ${baseCleaningFee}
                  </span>
                </div>
                {petFeeCharged > 0 ? (
                  <div
                    className="flex items-center justify-between border-t pt-2"
                    style={{ borderColor: "var(--color-warm-gray-200)" }}
                  >
                    <span
                      className="flex items-center gap-1.5 text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      <PawPrint size={13} weight="duotone" />
                      Pet fee ({data.pets} {data.pets === 1 ? "pet" : "pets"})
                    </span>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      ${petFeeCharged}
                    </span>
                  </div>
                ) : null}
                <div
                  className="flex items-center justify-between border-t pt-2"
                  style={{ borderColor: "var(--color-warm-gray-200)" }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Total after stay
                  </span>
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: "var(--color-brand)" }}
                  >
                    ${totalDueAtCheckout}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="flex items-start gap-3 rounded-lg border px-4 py-3"
                style={{
                  backgroundColor: "rgba(245, 158, 11, 0.04)",
                  borderColor: "rgba(245, 158, 11, 0.25)",
                }}
              >
                <FileArrowDown
                  size={16}
                  weight="duotone"
                  className="mt-0.5 shrink-0"
                  style={{ color: "#b45309" }}
                />
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    Cleaning checklist required
                  </p>
                  <p
                    className="mt-0.5 text-xs"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    If you choose to clean yourself, you must follow our
                    cleaning standards.{" "}
                    <a
                      href="/workspace/cleaning-checklist"
                      className="font-semibold underline"
                      style={{ color: "#b45309" }}
                    >
                      Open the checklist
                    </a>
                  </p>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Section 6 — Acknowledgments */}
        <Section
          number="06"
          title="Acknowledgments"
          description="Two quick confirmations before we send this over."
        >
          <div className="flex flex-col gap-3">
            {/* Damage liability */}
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors"
              style={{
                borderColor: submitAttempted && !data.damageAcknowledged
                  ? "rgba(220, 38, 38, 0.65)"
                  : data.damageAcknowledged
                    ? "var(--color-brand)"
                    : "var(--color-warm-gray-200)",
                backgroundColor: data.damageAcknowledged
                  ? "rgba(2, 170, 235, 0.04)"
                  : "var(--color-white)",
              }}
            >
              <input
                type="checkbox"
                checked={data.damageAcknowledged}
                onChange={(e) => update({ damageAcknowledged: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded accent-[var(--color-brand)]"
              />
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <ShieldCheck
                    size={14}
                    weight="duotone"
                    className="mr-1 inline-block"
                    style={{ color: "var(--color-brand)" }}
                  />
                  Damage and replacement liability
                </p>
                <p
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  I acknowledge that any damage or necessary replacements during
                  my or my guests&apos; stay will be my responsibility. I agree
                  to address any issues promptly.
                </p>
              </div>
            </label>

            {/* Property standards */}
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors"
              style={{
                borderColor: submitAttempted && !data.propertyStandardsAcknowledged
                  ? "rgba(220, 38, 38, 0.65)"
                  : data.propertyStandardsAcknowledged
                    ? "var(--color-brand)"
                    : "var(--color-warm-gray-200)",
                backgroundColor: data.propertyStandardsAcknowledged
                  ? "rgba(2, 170, 235, 0.04)"
                  : "var(--color-white)",
              }}
            >
              <input
                type="checkbox"
                checked={data.propertyStandardsAcknowledged}
                onChange={(e) => update({ propertyStandardsAcknowledged: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded accent-[var(--color-brand)]"
              />
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  <CheckCircle
                    size={14}
                    weight="duotone"
                    className="mr-1 inline-block"
                    style={{ color: "var(--color-brand)" }}
                  />
                  Property standards and condition
                </p>
                <p
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  I commit to leaving the home in the same condition as found:
                  furniture in place, trash removed, and no damage. If I am
                  cleaning myself, I will follow the Proxy cleaning checklist
                  and take checkout photos before departure.
                </p>
              </div>
            </label>
          </div>
        </Section>

        {error ? (
          <div
            className="rounded-lg border px-4 py-3 text-sm"
            style={{
              backgroundColor: "rgba(220, 38, 38, 0.06)",
              borderColor: "rgba(220, 38, 38, 0.28)",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 lg:hidden">
          {/* Mobile: stacked summary above submit */}
          <ReserveSummary
            property={selectedProperty ?? null}
            startDate={data.startDate}
            endDate={data.endDate}
            nights={nights}
            reason={data.reason}
            reasonDetail={data.reasonDetail}
            adults={data.adults}
            childrenCount={data.children}
            pets={data.pets}
            isOwnerStaying={data.isOwnerStaying}
            guestName={guestFullName}
            ownerName={ownerName}
            wantsCleaning={data.wantsCleaning}
            baseCleaningFee={baseCleaningFee}
            petFee={petFeeCharged}
            total={totalDueAtCheckout}
            needsLockCode={data.needsLockCode}
            checkInTime={data.checkInTime}
            checkOutTime={data.checkOutTime}
            compact
          />
        </div>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 lg:w-fit lg:self-end"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {pending ? "Sending..." : "Send reservation"}
        </button>

        {!canSubmit && missingFields.length > 0 && !pending ? (
          <p
            className="text-xs lg:text-right"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Still needed: {missingFields.join(", ")}
          </p>
        ) : null}
      </div>

      {/* Right: sticky live summary (desktop only) */}
      <div className="hidden lg:block">
        <div className="sticky top-24">
          <ReserveSummary
            property={selectedProperty ?? null}
            startDate={data.startDate}
            endDate={data.endDate}
            nights={nights}
            reason={data.reason}
            reasonDetail={data.reasonDetail}
            adults={data.adults}
            childrenCount={data.children}
            pets={data.pets}
            isOwnerStaying={data.isOwnerStaying}
            guestName={guestFullName}
            ownerName={ownerName}
            wantsCleaning={data.wantsCleaning}
            baseCleaningFee={baseCleaningFee}
            petFee={petFeeCharged}
            total={totalDueAtCheckout}
            needsLockCode={data.needsLockCode}
            checkInTime={data.checkInTime}
            checkOutTime={data.checkOutTime}
          />
        </div>
      </div>
    </div>
  );
}

/* ───── Section wrapper ───── */

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums"
          style={{
            backgroundColor: "rgba(2, 170, 235, 0.08)",
            color: "var(--color-brand)",
          }}
        >
          {number}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2
            className="text-[17px] font-semibold leading-tight tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </h2>
          <p
            className="text-[13px]"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        </div>
      </div>
      <div
        className="rounded-2xl border p-5"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* ───── Inline calendar ───── */

function InlineCalendar({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string | null;
  endDate: string | null;
  onChange: (start: string | null, end: string | null) => void;
}) {
  const today = useMemo(() => isoDate(new Date()), []);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [hovered, setHovered] = useState<string | null>(null);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startDow = new Date(viewYear, viewMonth, 1).getDay();
  const calDays: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calDays.push(isoDate(new Date(viewYear, viewMonth, d)));
  }

  const onDayClick = useCallback(
    (iso: string) => {
      if (iso < today) return;
      if (!startDate || (startDate && endDate)) {
        onChange(iso, null);
      } else {
        if (iso < startDate) onChange(iso, startDate);
        else onChange(startDate, iso);
      }
    },
    [startDate, endDate, today, onChange],
  );

  const effectiveEnd = endDate ?? hovered;
  const selStart =
    startDate && effectiveEnd && effectiveEnd < startDate
      ? effectiveEnd
      : startDate;
  const selEnd =
    startDate && effectiveEnd && effectiveEnd < startDate
      ? startDate
      : effectiveEnd;
  const isInRange = (iso: string) => {
    if (!selStart) return false;
    if (!selEnd) return iso === selStart;
    return iso >= selStart && iso <= selEnd;
  };
  const isStart = (iso: string) => iso === selStart;
  const isEnd = (iso: string) => iso === (selEnd ?? selStart);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 0) {
              setViewMonth(11);
              setViewYear((y) => y - 1);
            } else {
              setViewMonth((m) => m - 1);
            }
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-warm-gray-50)]"
          style={{ color: "var(--color-text-secondary)" }}
          aria-label="Previous month"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={() => {
            if (viewMonth === 11) {
              setViewMonth(0);
              setViewYear((y) => y + 1);
            } else {
              setViewMonth((m) => m + 1);
            }
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-[var(--color-warm-gray-50)]"
          style={{ color: "var(--color-text-secondary)" }}
          aria-label="Next month"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
      <div
        className="mt-2 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calDays.map((iso, i) => {
          if (!iso) return <div key={`e-${i}`} className="h-10" />;
          const isPast = iso < today;
          const inRange = isInRange(iso);
          const start = isStart(iso);
          const end = isEnd(iso);
          const isToday = iso === today;
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onDayClick(iso)}
              onMouseEnter={() => {
                if (startDate && !endDate) setHovered(iso);
              }}
              onMouseLeave={() => setHovered(null)}
              className="relative flex h-10 items-center justify-center text-[13px] font-medium tabular-nums transition-colors"
              style={{
                color: isPast
                  ? "var(--color-text-tertiary)"
                  : start || end
                    ? "var(--color-white)"
                    : inRange
                      ? "var(--color-brand)"
                      : "var(--color-text-primary)",
                backgroundColor:
                  start || end
                    ? "var(--color-brand)"
                    : inRange
                      ? "rgba(2, 170, 235, 0.14)"
                      : "transparent",
                borderRadius:
                  start && end
                    ? "8px"
                    : start
                      ? "8px 0 0 8px"
                      : end
                        ? "0 8px 8px 0"
                        : "0",
                cursor: isPast ? "default" : "pointer",
                opacity: isPast ? 0.4 : 1,
                fontWeight: isToday || start || end ? 700 : 500,
              }}
            >
              {new Date(`${iso}T00:00:00`).getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ───── Field helpers ───── */

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      {children}
    </span>
  );
}

function NumberRow({
  icon,
  label,
  sublabel,
  value,
  min,
  max,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--color-warm-gray-200)" }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: "var(--color-text-secondary)" }}>{icon}</span>
        <div>
          <p
            className="text-sm font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {label}
          </p>
          {sublabel && (
            <p
              className="text-[11px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {sublabel}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-30"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-primary)",
          }}
        >
          -
        </button>
        <span
          className="w-6 text-center text-sm font-semibold tabular-nums"
          style={{ color: "var(--color-text-primary)" }}
        >
          {value}
        </span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)] disabled:opacity-30"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-primary)",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  error,
  forceError,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  error?: string | null;
  /** Shows a red border even without a message (e.g. after submit attempt on empty required field) */
  forceError?: boolean;
}) {
  const hasError = Boolean(error) || Boolean(forceError);
  return (
    <label className="flex flex-col gap-1.5">
      <MicroLabel>{label}</MicroLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border px-3.5 text-sm outline-none focus:ring-2"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: hasError
            ? "rgba(220, 38, 38, 0.65)"
            : "var(--color-warm-gray-200)",
          color: "var(--color-text-primary)",
        }}
      />
      {error ? (
        <span className="text-[11px]" style={{ color: "#b91c1c" }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function PinField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value.padEnd(4, "–").slice(0, 4).split("").join(" ");

  return (
    <div
      className="relative flex items-center rounded-lg border px-3 transition-all duration-150"
      style={{
        height: 40,
        width: 112,
        backgroundColor: disabled
          ? "var(--color-warm-gray-50)"
          : value.length === 4
            ? "rgba(2, 170, 235, 0.07)"
            : "var(--color-white)",
        borderColor: disabled
          ? "var(--color-warm-gray-200)"
          : value.length === 4
            ? "var(--color-brand)"
            : "rgba(2, 170, 235, 0.55)",
        boxShadow: !disabled && value.length > 0
          ? "0 0 0 3px rgba(2, 170, 235, 0.12), inset 0 1px 4px rgba(2, 170, 235, 0.08)"
          : "none",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "default" : "text",
      }}
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      <span
        className="text-sm font-semibold tabular-nums tracking-[0.25em]"
        style={{
          color: disabled
            ? "var(--color-text-tertiary)"
            : value
              ? "var(--color-text-primary)"
              : "var(--color-text-tertiary)",
        }}
      >
        {display}
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const filtered = e.target.value.replace(/\D/g, "").slice(0, 4);
          onChange(filtered);
        }}
        className="absolute inset-0 h-full w-full cursor-text rounded-lg opacity-0"
        aria-label="4-digit lock code"
      />
    </div>
  );
}

/* ───── Success state ───── */

function ReserveSuccess({
  property,
  ownerEmail,
  data,
  nights,
  total,
  onReset,
}: {
  property: ReserveProperty | null;
  ownerEmail: string;
  data: FormData;
  nights: number;
  total: number;
  onReset: () => void;
}) {
  const recipientEmail = data.isOwnerStaying
    ? ownerEmail
    : data.guestEmail || ownerEmail;
  return (
    <div
      className="mx-auto flex max-w-xl flex-col items-center gap-6 rounded-2xl border p-10 text-center"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          backgroundColor: "rgba(22, 163, 74, 0.12)",
          color: "#15803d",
        }}
      >
        <CheckCircle size={28} weight="fill" />
      </span>
      <div>
        <h2
          className="text-[22px] font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Reservation sent
        </h2>
        <p
          className="mt-2 max-w-sm text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          We will check these dates against existing bookings and confirm by
          email at{" "}
          <span
            className="font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {recipientEmail}
          </span>
          .
        </p>
      </div>
      <div
        className="flex w-full max-w-sm items-center gap-3 rounded-xl border p-4 text-left"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-warm-gray-50)",
        }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "rgba(2, 170, 235, 0.10)",
            color: "var(--color-brand)",
          }}
        >
          <House size={16} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {property?.name ?? "Property"}
          </p>
          <p
            className="mt-0.5 text-xs"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {data.startDate ? fmtLongDate(data.startDate) : ""} to{" "}
            {data.endDate ? fmtLongDate(data.endDate) : ""} · {nights}{" "}
            {nights === 1 ? "night" : "nights"}
            {total > 0 ? ` · total $${total}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        Reserve another
      </button>
    </div>
  );
}
