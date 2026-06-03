import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarBlank,
  CalendarCheck,
} from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { normalizeUnit } from "@/lib/address";
import { EmptyState } from "@/components/workspace/EmptyState";
import { MyReservationsList } from "./MyReservationsList";
import type { BlockRequest } from "./types";

export const metadata: Metadata = { title: "Reserve" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_OPTS: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DATE_YEAR_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const _dateFmt     = new Intl.DateTimeFormat("en-US", DATE_OPTS);
const _dateYearFmt = new Intl.DateTimeFormat("en-US", DATE_YEAR_OPTS);

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end   + "T00:00:00");

  const sParts     = _dateFmt.formatToParts(s);
  const eParts     = _dateFmt.formatToParts(e);
  const sYearParts = _dateYearFmt.formatToParts(s);
  const eYearParts = _dateYearFmt.formatToParts(e);

  const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const sMonth = get(sParts,     "month");
  const sDay   = get(sParts,     "day");
  const sYear  = get(sYearParts, "year");
  const eMonth = get(eParts,     "month");
  const eDay   = get(eParts,     "day");
  const eYear  = get(eYearParts, "year");

  if (sYear !== eYear)  return `${sMonth} ${sDay}, ${sYear} – ${eMonth} ${eDay}, ${eYear}`;
  if (sMonth === eMonth) return `${sMonth} ${sDay} – ${eDay}, ${eYear}`;
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${eYear}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ReservePage() {
  const { userId, client } = await getWorkspaceContext();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0]!;

  const [{ data: rawProperties }, requestsResult] = await Promise.all([
    client
      .from("properties")
      .select("id, address_line1, address_line2, city, state, postal_code")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true }),
    client
      .from("block_requests")
      .select(
        "id, property_id, start_date, end_date, status, note, created_at, check_in_time, check_out_time, reason, is_owner_staying, guest_name, guest_email, guest_phone, adults, children, pets, needs_lock_code, requested_lock_code, wants_cleaning, cleaning_fee, damage_acknowledged",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Property map (for banner + list)
  type PropertyRow = {
    id: string;
    name: string;
    unit: string | null;
    cityLine: string;
  };

  const propertyMap = new Map<string, PropertyRow>();
  (rawProperties ?? []).forEach((p) => {
    const rawUnit  = p.address_line2 as string | null | undefined;
    const cityLine = [p.city, p.state, p.postal_code].filter(Boolean).join(", ");
    propertyMap.set(p.id, {
      id:       p.id,
      name:     p.address_line1?.trim() || "Property",
      unit:     rawUnit ? normalizeUnit(rawUnit) : null,
      cityLine,
    });
  });

  if (propertyMap.size === 0) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState
          icon={<CalendarBlank size={26} weight="duotone" />}
          title="Reserve unlocks with your first property"
          body="Add a home and you'll be able to reserve time in it right here."
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Serialise block requests
  // ---------------------------------------------------------------------------

  const rawData = requestsResult.data ?? [];

  const requests: BlockRequest[] = rawData.map((r) => ({
    id:                   r.id,
    property_id:          r.property_id,
    start_date:           r.start_date,
    end_date:             r.end_date,
    status:               r.status as BlockRequest["status"],
    note:                 r.note,
    created_at:           r.created_at,
    check_in_time:        r.check_in_time,
    check_out_time:       r.check_out_time,
    reason:               r.reason,
    is_owner_staying:     r.is_owner_staying ?? true,
    guest_name:           r.guest_name,
    guest_email:          r.guest_email,
    guest_phone:          r.guest_phone,
    adults:               r.adults ?? 1,
    children:             r.children ?? 0,
    pets:                 r.pets ?? 0,
    needs_lock_code:      r.needs_lock_code ?? false,
    requested_lock_code:  r.requested_lock_code,
    wants_cleaning:       r.wants_cleaning ?? false,
    cleaning_fee:         r.cleaning_fee ? Number(r.cleaning_fee) : null,
    damage_acknowledged:  r.damage_acknowledged ?? false,
  }));

  // ---------------------------------------------------------------------------
  // Banner data — next confirmed upcoming stay
  // ---------------------------------------------------------------------------

  const nextStayRaw =
    rawData.find(
      (r) =>
        r.status === "approved" &&
        typeof r.start_date === "string" &&
        r.start_date >= todayStr,
    ) ?? null;

  const nextStayDaysAway =
    nextStayRaw?.start_date
      ? Math.max(
          0,
          Math.round(
            (new Date(nextStayRaw.start_date + "T00:00:00").getTime() -
              today.getTime()) /
              86_400_000,
          ),
        )
      : null;

  const nextStayProp = nextStayRaw ? propertyMap.get(nextStayRaw.property_id) : null;
  const nextStayDateRange =
    nextStayRaw
      ? formatDateRange(nextStayRaw.start_date, nextStayRaw.end_date)
      : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Banner — CTA left, next-stay panel right (when confirmed stay)    */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background:
            "linear-gradient(130deg, #1B77BE 0%, #02AAEB 60%, #38c8ff 100%)",
        }}
      >
        {/* Decorative circles */}
        <span
          className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-14 right-24 h-40 w-40 rounded-full"
          style={{ background: "rgba(255,255,255,0.06)" }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          {nextStayRaw && nextStayDaysAway !== null ? (
            /* ── COUNTDOWN HERO STATE ── */
            <div className="flex flex-col md:flex-row md:items-stretch">
              {/* Countdown (left on desktop, top on mobile) */}
              <div className="flex-1 px-7 py-6">
                {/* Label */}
                <div className="flex items-center gap-1.5">
                  <CalendarCheck
                    size={11}
                    weight="duotone"
                    style={{ color: "rgba(255,255,255,0.60)" }}
                  />
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                    style={{ color: "rgba(255,255,255,0.60)" }}
                  >
                    Next confirmed stay
                  </p>
                </div>

                {/* Big countdown */}
                <div className="mt-3 flex items-end gap-2.5">
                  <span
                    className="font-bold leading-none"
                    style={{
                      color: "#fff",
                      fontSize:
                        nextStayDaysAway === 0 || nextStayDaysAway === 1
                          ? "2.75rem"
                          : "3.75rem",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {nextStayDaysAway === 0
                      ? "Today"
                      : nextStayDaysAway === 1
                        ? "Tomorrow"
                        : nextStayDaysAway}
                  </span>
                  {nextStayDaysAway > 1 && (
                    <span
                      className="mb-1.5 text-sm font-medium leading-tight"
                      style={{ color: "rgba(255,255,255,0.70)" }}
                    >
                      days until<br />you&apos;re home
                    </span>
                  )}
                </div>

                {/* Property + date range */}
                <div className="mt-3">
                  <p
                    className="text-[14px] font-semibold leading-snug"
                    style={{ color: "#fff" }}
                  >
                    {nextStayProp?.name ?? "Property"}
                    {nextStayProp?.unit && (
                      <span style={{ color: "rgba(255,255,255,0.70)" }}>
                        {" "}{nextStayProp.unit}
                      </span>
                    )}
                  </p>
                  <p
                    className="mt-0.5 text-[12px]"
                    style={{ color: "rgba(255,255,255,0.65)" }}
                  >
                    {nextStayDateRange}
                  </p>
                </div>

                {/* Mobile-only bottom CTA row */}
                <div
                  className="mt-5 flex items-center justify-between border-t pt-4 md:hidden"
                  style={{ borderColor: "rgba(255,255,255,0.18)" }}
                >
                  <Link
                    href="/workspace/reserve/new"
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-[13px] font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#fff" }}
                  >
                    + New reservation
                  </Link>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Owner stays &amp; holds
                  </p>
                </div>
              </div>

              {/* Desktop-only right CTA panel */}
              <div
                className="hidden md:flex md:w-[220px] md:shrink-0 md:flex-col md:justify-center md:border-l md:px-7 md:py-6"
                style={{ borderColor: "rgba(255,255,255,0.18)" }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  Owner stays &amp; holds
                </p>
                <h2
                  className="mt-1.5 text-[15px] font-bold leading-snug tracking-tight"
                  style={{ color: "#fff" }}
                >
                  Reserve time in your home
                </h2>
                <p
                  className="mt-1 text-[12px]"
                  style={{ color: "rgba(255,255,255,0.72)" }}
                >
                  Pick your dates and we&apos;ll check for conflicts.
                </p>
                <Link
                  href="/workspace/reserve/new"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#fff", color: "#1B77BE" }}
                >
                  + New reservation
                </Link>
              </div>
            </div>
          ) : (
            /* ── DEFAULT CTA STATE (no confirmed upcoming stay) ── */
            <div className="px-7 py-6">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{ color: "rgba(255,255,255,0.70)" }}
              >
                Owner stays &amp; holds
              </p>
              <h1
                className="mt-1 text-xl font-bold tracking-tight"
                style={{ color: "#fff" }}
              >
                Reserve time in your home
              </h1>
              <p
                className="mt-1 text-[13px]"
                style={{ color: "rgba(255,255,255,0.78)" }}
              >
                Pick your dates and we&apos;ll check for conflicts.
              </p>
              <Link
                href="/workspace/reserve/new"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#fff", color: "#1B77BE" }}
              >
                + New reservation
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Reservations list                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col gap-4">
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <h2
            className="text-[13px] font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Your Reservations
          </h2>
          <Link
            href="/workspace/reserve/new"
            className="shrink-0 text-[12px] font-semibold transition-opacity hover:opacity-70"
            style={{ color: "var(--color-brand)" }}
          >
            + New reservation
          </Link>
        </div>
        <MyReservationsList
          requests={requests}
          properties={(rawProperties ?? []).map((p) => ({
            id:   p.id,
            name: p.address_line1?.trim() || "Property",
          }))}
        />
      </div>
    </div>
  );
}
