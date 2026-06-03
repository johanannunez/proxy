import Link from "next/link";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import {
  PERIOD_LABELS,
  QUICK_KEYS,
  MONTH_LABELS,
  type DashboardParams,
} from "@/lib/periods";

const BASE = "/workspace/home";

function pill(active: boolean) {
  return {
    backgroundColor: active
      ? "var(--color-brand)"
      : "var(--color-warm-gray-100)",
    color: active ? "var(--color-white)" : "var(--color-text-secondary)",
  };
}

function outlinePill(active: boolean) {
  return {
    backgroundColor: active ? "var(--color-brand)" : "transparent",
    color: active ? "var(--color-white)" : "var(--color-text-secondary)",
    border: active ? "none" : "1px solid var(--color-warm-gray-200)",
  };
}

export function PeriodSwitcher({
  params,
  availableYears,
}: {
  params: DashboardParams;
  availableYears: number[];
}) {
  const isCompare = params.mode === "compare";
  const isYear = params.mode === "year";
  const activeStandard =
    params.mode === "standard" ? params.period : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Quick periods + year pills + compare */}
      <nav aria-label="Time period" className="flex flex-wrap gap-1.5">
        {/* Standard period pills */}
        {QUICK_KEYS.map((key) => {
          const isActive = activeStandard === key;
          return (
            <Link
              key={key}
              href={key === "month" ? BASE : `${BASE}?period=${key}`}
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors duration-200"
              style={pill(isActive)}
              aria-current={isActive ? "true" : undefined}
            >
              {PERIOD_LABELS[key]}
            </Link>
          );
        })}

        {/* Divider */}
        <span
          className="mx-1 self-center text-xs"
          style={{ color: "var(--color-warm-gray-200)" }}
          aria-hidden="true"
        >
          |
        </span>

        {/* Year pills */}
        {availableYears.map((y) => {
          const isActive = isYear && params.year === y;
          return (
            <Link
              key={y}
              href={`${BASE}?period=year&y=${y}`}
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors duration-200"
              style={pill(isActive)}
              aria-current={isActive ? "true" : undefined}
            >
              {y}
            </Link>
          );
        })}

        {/* Compare pill */}
        {availableYears.length >= 2 && (
          <Link
            href={buildCompareHref(availableYears)}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors duration-200"
            style={outlinePill(isCompare)}
            aria-current={isCompare ? "true" : undefined}
          >
            <ArrowsLeftRight size={14} weight="bold" />
            Compare
          </Link>
        )}
      </nav>

      {/* Row 2: Month selector when viewing a year */}
      {isYear && (
        <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
          <Link
            href={`${BASE}?period=year&y=${params.year}`}
            className="shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors duration-200"
            style={pill(params.month === null)}
          >
            All months
          </Link>
          {MONTH_LABELS.map((label, i) => {
            const m = i + 1;
            const isActiveMonth = params.month === m;
            return (
              <Link
                key={m}
                href={`${BASE}?period=year&y=${params.year}&month=${m}`}
                className="shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors duration-200"
                style={pill(isActiveMonth)}
                aria-current={isActiveMonth ? "true" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Row 2: Comparison controls (only in compare mode) */}
      {isCompare && (
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          {/* Month selector */}
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {MONTH_LABELS.map((label, i) => {
              const m = i + 1;
              const isActive = params.month === m;
              return (
                <Link
                  key={m}
                  href={`${BASE}?period=compare&month=${m}&years=${params.years.join(",")}`}
                  className="shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors duration-200"
                  style={pill(isActive)}
                  aria-current={isActive ? "true" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Year toggles */}
          <div className="flex items-center gap-1.5">
            <span
              className="mr-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Years
            </span>
            {availableYears.map((y) => {
              const selected = params.years.includes(y);
              const nextYears = selected
                ? params.years.filter((v) => v !== y)
                : [...params.years, y].sort((a, b) => a - b).slice(0, 3);

              // Do not allow deselecting below 2 years
              const canToggle = !selected || params.years.length > 2;
              const href = canToggle
                ? `${BASE}?period=compare&month=${params.month}&years=${nextYears.join(",")}`
                : "#";

              return (
                <Link
                  key={y}
                  href={href}
                  className="rounded-full px-3 py-1 text-[12px] font-semibold transition-colors duration-200"
                  style={{
                    backgroundColor: selected
                      ? "var(--color-brand)"
                      : "var(--color-warm-gray-100)",
                    color: selected ? "var(--color-white)" : "var(--color-text-secondary)",
                    opacity: canToggle ? 1 : 0.5,
                  }}
                  aria-pressed={selected}
                  onClick={canToggle ? undefined : (e) => e.preventDefault()}
                >
                  {y}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function buildCompareHref(availableYears: number[]): string {
  const currentMonth = new Date().getMonth() + 1;
  const years = availableYears.slice(0, 3).join(",");
  return `${BASE}?period=compare&month=${currentMonth}&years=${years}`;
}
