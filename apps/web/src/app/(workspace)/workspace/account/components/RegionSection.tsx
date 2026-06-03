"use client";

import { useCallback, useEffect, useState } from "react";
import { Globe, CalendarBlank, Clock } from "@phosphor-icons/react";
import { CustomSelect } from "@/components/workspace/CustomSelect";

const STORAGE_KEY = "proxy-region-prefs";

type RegionPrefs = {
  timezone: string;
  dateFormat: string;
};

const US_TIMEZONES: { value: string; label: string; short: string }[] = [
  { value: "America/New_York", label: "Eastern", short: "ET" },
  { value: "America/Chicago", label: "Central", short: "CT" },
  { value: "America/Denver", label: "Mountain", short: "MT" },
  { value: "America/Los_Angeles", label: "Pacific", short: "PT" },
  { value: "America/Anchorage", label: "Alaska", short: "AKT" },
  { value: "Pacific/Honolulu", label: "Hawaii", short: "HT" },
];

const DATE_FORMATS: { value: string; label: string }[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "MMM D, YYYY", label: "Apr 10, 2026" },
  { value: "D MMM YYYY", label: "10 Apr 2026" },
  { value: "ddd, MMM D, YYYY", label: "Thu, Apr 10, 2026" },
  { value: "dddd, MMM D, YYYY", label: "Thursday, Apr 10, 2026" },
  { value: "ddd MM/DD/YYYY", label: "Thu 04/10/2026" },
];

function getDefaultTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = US_TIMEZONES.find((tz) => tz.value === detected);
    return match ? detected : "America/New_York";
  } catch {
    return "America/New_York";
  }
}

function formatTimeInZone(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return "";
  }
}

function getUtcOffset(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    return offsetPart?.value ?? "";
  } catch {
    return "";
  }
}

function formatDateExample(format: string): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const y = String(now.getFullYear());
  const monthName = now.toLocaleString("en-US", { month: "short" });
  const dayShort = now.toLocaleString("en-US", { weekday: "short" });
  const dayLong = now.toLocaleString("en-US", { weekday: "long" });

  switch (format) {
    case "MM/DD/YYYY": return `${m}/${d}/${y}`;
    case "DD/MM/YYYY": return `${d}/${m}/${y}`;
    case "YYYY-MM-DD": return `${y}-${m}-${d}`;
    case "MMM D, YYYY": return `${monthName} ${now.getDate()}, ${y}`;
    case "D MMM YYYY": return `${now.getDate()} ${monthName} ${y}`;
    case "ddd, MMM D, YYYY": return `${dayShort}, ${monthName} ${now.getDate()}, ${y}`;
    case "dddd, MMM D, YYYY": return `${dayLong}, ${monthName} ${now.getDate()}, ${y}`;
    case "ddd MM/DD/YYYY": return `${dayShort} ${m}/${d}/${y}`;
    default: return `${m}/${d}/${y}`;
  }
}

export function RegionSection({ timezone }: { timezone: string }) {
  const [prefs, setPrefs] = useState<RegionPrefs>({
    timezone: timezone || getDefaultTimezone(),
    dateFormat: "MM/DD/YYYY",
  });
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<RegionPrefs>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // localStorage unavailable or corrupt
    }
    setLoaded(true);
  }, []);

  // Update the live clock every second
  useEffect(() => {
    if (!loaded) return;
    const update = () => setCurrentTime(formatTimeInZone(prefs.timezone));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [loaded, prefs.timezone]);

  const updatePref = useCallback(
    (key: keyof RegionPrefs, value: string) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // localStorage full or unavailable
        }
        return next;
      });
    },
    [],
  );

  const selectedTz = US_TIMEZONES.find((tz) => tz.value === prefs.timezone);
  const utcOffset = getUtcOffset(prefs.timezone);
  const browserTz = getDefaultTimezone();
  const isSameAsBrowser = prefs.timezone === browserTz;

  return (
    <section id="region" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Region
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Set your timezone and date format preferences.
      </p>

      <div
        className="rounded-2xl border p-7"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Timezone */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--color-warm-gray-100)" }}
          >
            <Globe size={18} weight="duotone" style={{ color: "var(--color-brand)" }} />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="region-timezone"
              className="cursor-pointer text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Timezone
            </label>
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Used for calendar events and payout dates.
            </span>

            {/* Live time display */}
            {currentTime ? (
              <div
                className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1.5"
                style={{ backgroundColor: "var(--color-warm-gray-50)" }}
              >
                <Clock size={14} weight="duotone" style={{ color: "var(--color-brand)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {currentTime}
                </span>
                <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  {selectedTz?.short} ({utcOffset})
                </span>
                {isSameAsBrowser ? (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: "rgba(22, 163, 74, 0.08)", color: "var(--color-success)" }}
                  >
                    Your time
                  </span>
                ) : (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: "rgba(245, 158, 11, 0.08)", color: "#d97706" }}
                  >
                    Different from your device
                  </span>
                )}
              </div>
            ) : null}
          </div>

          <div className="w-52 shrink-0">
            <CustomSelect
              id="region-timezone"
              value={prefs.timezone}
              onChange={(v) => updatePref("timezone", v)}
              options={US_TIMEZONES}
            />
          </div>
        </div>

        <div className="my-5 border-t" style={{ borderColor: "var(--color-warm-gray-200)" }} />

        {/* Date Format */}
        <div className="flex items-start gap-4">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--color-warm-gray-100)" }}
          >
            <CalendarBlank size={18} weight="duotone" style={{ color: "var(--color-brand)" }} />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="region-date-format"
              className="cursor-pointer text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Date format
            </label>
            <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              How dates appear throughout the portal.
            </span>

            {/* Live preview */}
            <div
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1.5"
              style={{ backgroundColor: "var(--color-warm-gray-50)" }}
            >
              <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                Today:
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                {formatDateExample(prefs.dateFormat)}
              </span>
            </div>
          </div>

          <div className="w-52 shrink-0">
            <CustomSelect
              id="region-date-format"
              value={prefs.dateFormat}
              onChange={(v) => updatePref("dateFormat", v)}
              options={DATE_FORMATS}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
