import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bed,
  Bathtub,
  Users as UsersIcon,
  Ruler,
  CalendarBlank,
  FileText,
  House,
  CalendarX,
  Sun,
  Cloud,
  CloudSun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Drop,
} from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { OccupancyCalendar } from "@/components/workspace/OccupancyCalendar";
import { SetWorkspaceHeader } from "@/components/workspace/WorkspaceHeaderContext";
import { HospitableSyncStatus } from "@/components/workspace/HospitableSyncStatus";
import { reconcilePropertyWithHospitable } from "@/lib/hospitable-reconcile";
import { homeTypeLabels } from "@/lib/labels";
import { currency0, formatMedium } from "@/lib/format";

export const metadata: Metadata = { title: "Property" };
export const dynamic = "force-dynamic";
// External fetches (weather, Hospitable) are cached individually below.
// force-dynamic stays so auth cookies are always read fresh.

/* ─── Weather ─── */

type WeatherSnapshot = {
  temp: number;
  feelsLike: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
};

/**
 * Fetches current weather for a property via Open-Meteo (free, no API key).
 * Two calls: geocoding (city → lat/lon) then current conditions.
 * Returns null on any failure so the page renders cleanly without weather.
 */
async function fetchPropertyWeather(
  city: string | null,
  state: string | null,
): Promise<WeatherSnapshot | null> {
  if (!city) return null;
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=3&format=json&language=en`,
      { next: { revalidate: 86400 } }, // geocoding result is stable — cache 24h
    );
    if (!geoRes.ok) return null;

    const geoData = (await geoRes.json()) as {
      results?: Array<{
        latitude: number;
        longitude: number;
        admin1?: string;
      }>;
    };
    const results = geoData.results ?? [];
    if (results.length === 0) return null;

    // Prefer the result whose admin1 (full state name) matches the state code.
    const loc =
      state
        ? (results.find((r) =>
            r.admin1?.toLowerCase().includes(state.toLowerCase()),
          ) ?? results[0])
        : results[0];

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph`,
      { next: { revalidate: 1800 } }, // weather — cache 30 min
    );
    if (!wxRes.ok) return null;

    const wxData = (await wxRes.json()) as {
      current?: {
        temperature_2m: number;
        apparent_temperature: number;
        weather_code: number;
        wind_speed_10m: number;
        relative_humidity_2m: number;
      };
    };
    const current = wxData.current;
    if (!current) return null;

    return {
      temp: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      weatherCode: current.weather_code,
      humidity: Math.round(current.relative_humidity_2m),
      windSpeed: Math.round(current.wind_speed_10m),
    };
  } catch {
    return null;
  }
}

function getWeatherLabel(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rainy";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Clear";
}

function getWeatherIcon(code: number, size = 26): ReactNode {
  const props = { size, weight: "duotone" as const };
  if (code === 0 || code === 1) return <Sun {...props} />;
  if (code === 2) return <CloudSun {...props} />;
  if (code === 3) return <Cloud {...props} />;
  if (code === 45 || code === 48) return <Cloud {...props} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return <CloudRain {...props} />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return <CloudSnow {...props} />;
  if (code >= 95) return <CloudLightning {...props} />;
  return <Sun {...props} />;
}

type Params = Promise<{ id: string }>;

export default async function PropertyDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const yearStart = `${now.getFullYear()}-01-01`;
  const calMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const calMonthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

  const [
    { data: property },
    { data: recentBookings },
    { data: nextStay },
    { data: ytdBookings },
    { data: calendarBookings },
  ] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("bookings")
      .select(
        "id, guest_name, check_in, check_out, source, status, total_amount",
      )
      .eq("property_id", id)
      .order("check_in", { ascending: false })
      .limit(10),
    supabase
      .from("bookings")
      .select("id, guest_name, check_in")
      .eq("property_id", id)
      .gte("check_in", todayIso)
      .neq("status", "cancelled")
      .order("check_in", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("total_amount")
      .eq("property_id", id)
      .gte("check_in", yearStart)
      .neq("status", "cancelled"),
    supabase
      .from("bookings")
      .select("check_in, check_out")
      .eq("property_id", id)
      .gte("check_out", calMonthStart)
      .lte("check_in", calMonthEnd)
      .neq("status", "cancelled"),
  ]);

  // Documents table may not exist yet (pending migration)
  let documents: Array<{ id: string; title: string; doc_type: string; status: string; file_url: string | null; created_at: string }> = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("documents")
      .select("id, title, doc_type, status, file_url, created_at")
      .is("form_key", null) // catalog documents only, not raw form storage rows
      .order("created_at", { ascending: false })
      .limit(6);
    documents = data ?? [];
  } catch {
    // table doesn't exist yet
  }

  if (!property) notFound();

  // App bar owns the page title + subtitle for this route. Title is the
  // full formatted address built defensively (skip empty fragments so
  // partially filled or malformed rows still render cleanly). Subtitle
  // is a single-line spec row with a Phosphor icon per item
  // (home type, bed, bath, sqft, sleeps); null fields drop out so
  // half-onboarded rows still render cleanly. property_type is
  // intentionally NOT surfaced here because it represents the rental
  // business model, not the building type.
  const headerTitle = buildAddressLine(property) || "Property details";

  type SpecItem = {
    key: string;
    icon: ReactNode;
    text: string;
  };

  const specs: SpecItem[] = [];
  if (property.home_type) {
    specs.push({
      key: "home",
      icon: <House size={13} weight="duotone" />,
      text: homeTypeLabels[property.home_type] ?? property.home_type,
    });
  }
  if (property.bedrooms != null) {
    specs.push({
      key: "bd",
      icon: <Bed size={13} weight="duotone" />,
      text: `${property.bedrooms} bd`,
    });
  }
  if (property.bathrooms != null) {
    specs.push({
      key: "ba",
      icon: <Bathtub size={13} weight="duotone" />,
      text: `${property.bathrooms} ba`,
    });
  }
  if (property.square_feet != null) {
    specs.push({
      key: "sqft",
      icon: <Ruler size={13} weight="duotone" />,
      text: `${property.square_feet.toLocaleString()} sqft`,
    });
  }
  if (property.guest_capacity != null) {
    specs.push({
      key: "sleeps",
      icon: <UsersIcon size={13} weight="duotone" />,
      text: `Sleeps ${property.guest_capacity}`,
    });
  }

  const headerSubtitle = (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
      {specs.map((spec) => (
        <span
          key={spec.key}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <span
            className="inline-flex shrink-0 items-center justify-center"
            style={{ color: "rgba(255, 255, 255, 0.72)" }}
            aria-hidden
          >
            {spec.icon}
          </span>
          {spec.text}
        </span>
      ))}
    </div>
  );

  const ytdBookingsCount = (ytdBookings ?? []).length;

  return (
    <div className="flex flex-col gap-10">
      <SetWorkspaceHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        copyable
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          href="/workspace/properties"
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} weight="bold" />
          Back to properties
        </Link>
        <div className="flex flex-wrap items-start gap-2">
          <Suspense fallback={null}>
            <HospitableSyncSection
              hospitablePropertyId={property.hospitable_property_id ?? null}
              homeType={property.home_type ?? null}
              bedrooms={property.bedrooms ?? null}
              bathrooms={property.bathrooms ?? null}
              guestCapacity={property.guest_capacity ?? null}
            />
          </Suspense>
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: property.active
                ? "rgba(22, 163, 74, 0.12)"
                : "rgba(118, 113, 112, 0.12)",
              color: property.active ? "#15803d" : "#4b4948",
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: property.active
                  ? "#16a34a"
                  : "var(--color-text-tertiary)",
              }}
            />
            {property.active ? "Active" : "Paused"}
          </span>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          icon={<Bed size={18} weight="duotone" />}
          label="Bedrooms"
          value={property.bedrooms?.toString() ?? "\u2014"}
        />
        <StatTile
          icon={<Bathtub size={18} weight="duotone" />}
          label="Bathrooms"
          value={property.bathrooms?.toString() ?? "\u2014"}
        />
        <StatTile
          icon={<UsersIcon size={18} weight="duotone" />}
          label="Guests"
          value={property.guest_capacity?.toString() ?? "\u2014"}
        />
        <StatTile
          icon={<Ruler size={18} weight="duotone" />}
          label="Square feet"
          value={property.square_feet?.toLocaleString() ?? "\u2014"}
        />
      </section>

      {/* Summary row */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <InfoCard
          icon={<House size={18} weight="duotone" />}
          label="Next stay"
          value={
            nextStay
              ? `${nextStay.guest_name ?? "Guest"} on ${formatMedium(nextStay.check_in)}`
              : "Nothing booked"
          }
        />
        <InfoCard
          icon={<CalendarBlank size={18} weight="duotone" />}
          label="Bookings YTD"
          value={String(ytdBookingsCount)}
        />
        <InfoCard
          icon={<FileText size={18} weight="duotone" />}
          label="Documents"
          value={`${(documents ?? []).length} on file`}
        />
      </section>

      {property.city ? (
        <Suspense fallback={<WeatherSkeleton />}>
          <WeatherSection city={property.city} state={property.state ?? ""} />
        </Suspense>
      ) : null}

      {/* Occupancy calendar */}
      <OccupancyCalendar
        bookings={calendarBookings ?? []}
        year={now.getFullYear()}
        month={now.getMonth()}
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          title="Recent bookings"
          href="/workspace/reserve"
          linkLabel="View reserve"
        >
          {(recentBookings ?? []).length === 0 ? (
            <PanelEmpty
              icon={<CalendarBlank size={22} weight="duotone" />}
              text="No bookings yet for this property."
            />
          ) : (
            <ul className="flex flex-col">
              {(recentBookings ?? []).slice(0, 5).map((b, i) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between py-3"
                  style={{
                    borderTop:
                      i === 0
                        ? undefined
                        : "1px solid var(--color-warm-gray-100)",
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {b.guest_name ?? "Guest"}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {formatMedium(b.check_in)} to{" "}
                      {formatMedium(b.check_out)}
                    </div>
                  </div>
                  <div
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {b.total_amount
                      ? currency0.format(Number(b.total_amount))
                      : "\u2014"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Documents"
          href="/workspace/documents"
          linkLabel="View all"
        >
          {(documents ?? []).length === 0 ? (
            <PanelEmpty
              icon={<FileText size={22} weight="duotone" />}
              text="No documents on file for this property yet."
            />
          ) : (
            <ul className="flex flex-col">
              {(documents ?? []).slice(0, 5).map((d, i) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between py-3"
                  style={{
                    borderTop:
                      i === 0
                        ? undefined
                        : "1px solid var(--color-warm-gray-100)",
                  }}
                >
                  <div className="min-w-0">
                    <div
                      className="truncate text-sm font-semibold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {d.title}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {formatMedium(d.created_at)}
                    </div>
                  </div>
                  <DocStatusChip status={d.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* Block request link */}
      <Link
        href={`/workspace/reserve`}
        className="flex items-center gap-4 rounded-2xl border p-5 transition-colors hover:opacity-95"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            color: "#b45309",
          }}
        >
          <CalendarX size={18} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Need to block dates?
          </div>
          <div
            className="text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Request a date block and we will update your calendar across all platforms.
          </div>
        </div>
        <ArrowRight
          size={14}
          weight="bold"
          style={{ color: "var(--color-text-tertiary)" }}
        />
      </Link>
    </div>
  );
}

/* ─── Suspense-deferred async components ─── */

async function WeatherSection({ city, state }: { city: string; state: string }) {
  const weather = await fetchPropertyWeather(city, state);
  if (!weather) return null;
  return <PropertyWeatherCard weather={weather} city={city} state={state} />;
}

function WeatherSkeleton() {
  return (
    <div
      className="flex items-center gap-5 rounded-2xl border px-6 py-5"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl" style={{ backgroundColor: "var(--color-warm-gray-100)" }} />
      <div className="flex flex-col gap-2">
        <div className="h-9 w-16 animate-pulse rounded" style={{ backgroundColor: "var(--color-warm-gray-100)" }} />
        <div className="h-3 w-24 animate-pulse rounded" style={{ backgroundColor: "var(--color-warm-gray-100)" }} />
      </div>
    </div>
  );
}

async function HospitableSyncSection({
  hospitablePropertyId,
  homeType,
  bedrooms,
  bathrooms,
  guestCapacity,
}: {
  hospitablePropertyId: string | null;
  homeType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  guestCapacity: number | null;
}) {
  const syncStatus = await reconcilePropertyWithHospitable({
    hospitable_property_id: hospitablePropertyId,
    home_type: homeType,
    bedrooms,
    bathrooms,
    guest_capacity: guestCapacity,
  });
  return (
    <HospitableSyncStatus
      linked={syncStatus.linked}
      diffs={syncStatus.diffs}
      error={syncStatus.error}
    />
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          backgroundColor: "var(--color-warm-gray-100)",
          color: "var(--color-text-primary)",
        }}
      >
        {icon}
      </span>
      <div
        className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={{ color: "var(--color-text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-2xl border p-5"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          backgroundColor: "rgba(2, 170, 235, 0.10)",
          color: "#0c6fae",
        }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {label}
        </div>
        <div
          className="truncate text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-6"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <header className="mb-2 flex items-center justify-between">
        <h2
          className="text-base font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </h2>
        {href && linkLabel ? (
          <Link
            href={href}
            className="text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--color-brand)" }}
          >
            {linkLabel}
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function PanelEmpty({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-8 text-center text-sm"
      style={{ color: "var(--color-text-secondary)" }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          backgroundColor: "var(--color-warm-gray-100)",
          color: "var(--color-text-primary)",
        }}
      >
        {icon}
      </span>
      <p className="max-w-sm">{text}</p>
    </div>
  );
}

function DocStatusChip({ status }: { status: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "rgba(245, 158, 11, 0.14)", fg: "#b45309" },
    signed: { bg: "rgba(22, 163, 74, 0.12)", fg: "#15803d" },
    uploaded: { bg: "rgba(2, 170, 235, 0.12)", fg: "#0c6fae" },
    expired: { bg: "rgba(220, 38, 38, 0.12)", fg: "#b91c1c" },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {status}
    </span>
  );
}

function PropertyWeatherCard({
  weather,
  city,
  state,
}: {
  weather: WeatherSnapshot;
  city: string;
  state: string;
}) {
  return (
    <section
      className="flex flex-wrap items-center gap-5 rounded-2xl border px-6 py-5"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
      aria-label={`Current weather in ${city}, ${state}`}
    >
      {/* Icon + temperature */}
      <div className="flex items-center gap-4">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "rgba(2, 170, 235, 0.10)",
            color: "#0c6fae",
          }}
          aria-hidden
        >
          {getWeatherIcon(weather.weatherCode, 26)}
        </span>
        <div>
          <div
            className="text-[36px] font-bold leading-none tabular-nums tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {weather.temp}°
          </div>
          <div
            className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {getWeatherLabel(weather.weatherCode)}
          </div>
        </div>
      </div>

      {/* Vertical divider (sm+) */}
      <div
        className="hidden h-12 w-px shrink-0 sm:block"
        style={{ backgroundColor: "var(--color-warm-gray-100)" }}
        aria-hidden
      />

      {/* Location + feels like */}
      <div className="min-w-0 flex-1">
        <div
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {city}{state ? `, ${state}` : ""}
        </div>
        <div
          className="mt-0.5 text-xs"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Feels like {weather.feelsLike}°F
        </div>
      </div>

      {/* Secondary stats pill */}
      <div
        className="flex shrink-0 items-center gap-4 rounded-xl px-4 py-3"
        style={{ backgroundColor: "var(--color-warm-gray-50)" }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="flex items-center justify-center"
            style={{ color: "var(--color-text-tertiary)" }}
            aria-hidden
          >
            <Drop size={13} weight="duotone" />
          </span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {weather.humidity}%
          </span>
          <span
            className="text-[9.5px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Humidity
          </span>
        </div>
        <div
          className="h-8 w-px shrink-0"
          style={{ backgroundColor: "var(--color-warm-gray-200)" }}
          aria-hidden
        />
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="flex items-center justify-center"
            style={{ color: "var(--color-text-tertiary)" }}
            aria-hidden
          >
            <Wind size={13} weight="duotone" />
          </span>
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: "var(--color-text-primary)" }}
          >
            {weather.windSpeed} mph
          </span>
          <span
            className="text-[9.5px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Wind
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Build a human-readable single-line address from a property row. Skips
 * empty / null fragments so partially filled rows still render cleanly.
 * Handles the three common shapes:
 *
 *   line1, city, state zip
 *   line1, line2, city, state zip
 *   line1, city, state           (no zip yet)
 *
 * Returns empty string if nothing meaningful is present so callers can
 * fall back to a default title.
 */
function buildAddressLine(p: {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}): string {
  const line1 = p.address_line1?.trim() ?? "";
  const line2 = p.address_line2?.trim() ?? "";
  const city = p.city?.trim() ?? "";
  const state = p.state?.trim() ?? "";
  const postal = p.postal_code?.trim() ?? "";

  const parts: string[] = [];
  if (line1) parts.push(line1);
  if (line2) parts.push(line2);

  // "State Zip" is one visual unit, separated by a space. "City, State Zip"
  // joins them with a comma. Drop any fragment that's empty so we don't
  // emit stray whitespace or dangling commas.
  const stateZip = [state, postal].filter(Boolean).join(" ");
  const cityStateZip = [city, stateZip].filter(Boolean).join(", ");
  if (cityStateZip) parts.push(cityStateZip);

  return parts.join(", ");
}
