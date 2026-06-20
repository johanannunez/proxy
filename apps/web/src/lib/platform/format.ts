import "server-only";

/**
 * Formatting helpers for the Platform Console. All money is stored in integer
 * cents; the console renders USD. Numbers are shown in IBM Plex Mono with
 * tabular figures, so these helpers never pad — they just shape the digits.
 */

export function dollarsFromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** "$1,995" — whole-dollar USD, no cents (MRR rarely needs sub-dollar precision). */
export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollarsFromCents(cents));
}

/** "$1,994.50" — full precision, for line items where cents matter. */
export function formatUsdPrecise(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollarsFromCents(cents));
}

/** "$12.4K" / "$1.2M" — compact, for axis labels and dense tiles. */
export function formatUsdCompact(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(dollarsFromCents(cents));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

/** Signed delta like "+3" / "-2" / "0". */
export function formatSignedNumber(n: number): string {
  if (n > 0) return `+${formatNumber(n)}`;
  return formatNumber(n);
}

/** UTC ISO-week start (Monday) for a given date. */
export function isoWeekStart(input: Date | string): Date {
  const d = new Date(input);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day),
  );
  return monday;
}

/** "Jun 8" — short month + day, UTC. */
export function shortDate(input: Date | string): string {
  return new Date(input).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "Jun 20, 2026 14:26 UTC" — for audit timestamps. */
export function timestampUtc(input: Date | string): string {
  const d = new Date(input);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${date} ${time} UTC`;
}

/** "just now" / "3h ago" / "5d ago" / "Jun 8" — compact relative time. */
export function relativeTime(input: Date | string | null | undefined): string {
  if (!input) return "never";
  const then = new Date(input).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return shortDate(input);
}

/** "2h 14m" / "8m" / "in progress" — duration between two instants. */
export function formatDuration(ms: number | null): string {
  if (ms == null) return "in progress";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}
