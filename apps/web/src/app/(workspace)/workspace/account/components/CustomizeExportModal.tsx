"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { format, startOfYear, subMonths } from "date-fns";
import {
  Buildings,
  CalendarX,
  Check,
  DownloadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

import { exportUserData, type ExportDataset, type ExportOptions } from "../actions";
import { buildExportCsv, triggerCsvDownload } from "./buildExportCsv";
import { RangeCalendar } from "./RangeCalendar";

type RangePreset = "last12" | "ytd" | "year" | "all" | "custom";

type Props = {
  open: boolean;
  onClose: () => void;
  onDownloaded: () => void;
};

const RANGE_OPTIONS: Array<{ id: RangePreset; label: string }> = [
  { id: "last12", label: "12 months" },
  { id: "ytd", label: "Year to date" },
  { id: "year", label: "By year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

// Current year plus five prior years. Covers multi-year owners without
// cluttering the modal, and any older range is still reachable via Custom.
const YEAR_OPTIONS: number[] = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

function computeRange(
  preset: RangePreset,
  selectedYear: number,
  customStart: string,
  customEnd: string,
): ExportOptions["range"] {
  const now = new Date();
  switch (preset) {
    case "last12":
      return {
        start: format(subMonths(now, 12), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
        label: "Last 12 months",
      };
    case "ytd":
      return {
        start: format(startOfYear(now), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
        label: "Year to date",
      };
    case "year":
      return {
        start: `${selectedYear}-01-01`,
        end: `${selectedYear}-12-31`,
        label: `Year ${selectedYear}`,
      };
    case "all":
      return { start: null, end: null, label: "All time" };
    case "custom":
      return {
        start: customStart,
        end: customEnd,
        label: "Custom range",
      };
  }
}

function prettyDate(iso: string): string {
  // Parse as local time to avoid off-by-one from timezone shifts.
  const [y, m, d] = iso.split("-").map(Number);
  return format(new Date(y, m - 1, d), "MMM d, yyyy");
}

function computedRangeText(range: ExportOptions["range"]): string {
  if (!range.start && !range.end) return "Everything on record";
  if (range.start && range.end) {
    return `${prettyDate(range.start)} to ${prettyDate(range.end)}`;
  }
  return "Pick start and end dates";
}

export function CustomizeExportModal({ open, onClose, onDownloaded }: Props) {
  const titleId = useId();
  const firstCheckboxRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [selectedDatasets, setSelectedDatasets] = useState<Set<ExportDataset>>(
    new Set(["properties", "blocks"]),
  );
  const [preset, setPreset] = useState<RangePreset>("all");
  const [selectedYear, setSelectedYear] = useState<number>(YEAR_OPTIONS[0]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset on open.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedDatasets(new Set(["properties", "blocks"]));
    setPreset("all");
    setSelectedYear(YEAR_OPTIONS[0]);
    setCustomStart("");
    setCustomEnd("");
    setErrorMessage(null);
    requestAnimationFrame(() => firstCheckboxRef.current?.focus());
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const toggleDataset = useCallback((dataset: ExportDataset) => {
    setSelectedDatasets((prev) => {
      const next = new Set(prev);
      if (next.has(dataset)) next.delete(dataset);
      else next.add(dataset);
      return next;
    });
  }, []);

  const customRangeInvalid =
    preset === "custom" &&
    customStart !== "" &&
    customEnd !== "" &&
    customStart > customEnd;

  const customRangeIncomplete =
    preset === "custom" && (customStart === "" || customEnd === "");

  const noDatasets = selectedDatasets.size === 0;

  const disabled = pending || noDatasets || customRangeInvalid || customRangeIncomplete;

  // Footer preview values.
  const datasetCount = selectedDatasets.size;
  const previewRange = useMemo(
    () => computeRange(preset, selectedYear, customStart, customEnd),
    [preset, selectedYear, customStart, customEnd],
  );
  const datasetsArray = useMemo(() => Array.from(selectedDatasets), [selectedDatasets]);
  const computedText = useMemo(() => computedRangeText(previewRange), [previewRange]);

  const previewFilename = useMemo(() => {
    if (noDatasets || customRangeInvalid || customRangeIncomplete) return null;
    return buildExportCsv(
      JSON.stringify({
        exported_at: new Date().toISOString(),
        range_label: previewRange.label,
        range_start: previewRange.start,
        range_end: previewRange.end,
        datasets: datasetsArray,
        profile: null,
        properties: null,
        calendar_blocks: null,
      }),
      { datasets: datasetsArray, range: previewRange },
    ).filename;
  }, [noDatasets, customRangeInvalid, customRangeIncomplete, datasetsArray, previewRange]);

  function handleDownload() {
    setErrorMessage(null);
    const range = computeRange(preset, selectedYear, customStart, customEnd);
    const options: ExportOptions = { datasets: datasetsArray, range };
    startTransition(async () => {
      const result = await exportUserData(options);
      if (!result.ok || !result.data) {
        setErrorMessage(result.message ?? "Export failed. Try again.");
        return;
      }
      const built = buildExportCsv(result.data, options);
      triggerCsvDownload(built);
      onDownloaded();
      onClose();
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.36)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-t-2xl border shadow-[0_30px_80px_-20px_rgba(15,23,42,0.35)] sm:rounded-2xl"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4 border-b px-6 pb-5 pt-6"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Export
            </p>
            <h2
              id={titleId}
              className="mt-1 text-xl font-semibold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              Customize export
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Pick what to include and the date range.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-warm-gray-100)]"
            style={{ color: "var(--color-text-secondary)" }}
            aria-label="Close"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* What to include */}
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            What to include
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <DatasetPill
              inputRef={firstCheckboxRef}
              checked={selectedDatasets.has("properties")}
              onChange={() => toggleDataset("properties")}
              icon={<Buildings size={16} weight="duotone" />}
              label="Properties"
              tag="Snapshot"
            />
            <DatasetPill
              checked={selectedDatasets.has("blocks")}
              onChange={() => toggleDataset("blocks")}
              icon={<CalendarX size={16} weight="duotone" />}
              label="Calendar blocks"
            />
          </div>
          {noDatasets ? (
            <p className="mt-2 text-xs" style={{ color: "var(--color-error)" }}>
              Pick at least one dataset.
            </p>
          ) : null}

          {/* Date range */}
          <p
            className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Date range
          </p>
          <div
            className="mt-2.5 grid grid-cols-5 gap-1 rounded-xl border p-1"
            role="radiogroup"
            aria-label="Date range"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-warm-gray-50)",
            }}
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = preset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreset(opt.id)}
                  className="whitespace-nowrap rounded-lg px-2 py-2 text-[11px] font-semibold transition-all"
                  style={{
                    backgroundColor: active ? "var(--color-brand)" : "transparent",
                    color: active ? "#ffffff" : "var(--color-text-secondary)",
                    boxShadow: active
                      ? "0 1px 3px rgba(2, 170, 235, 0.35)"
                      : "none",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Computed range text (live) */}
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {computedText}
          </p>

          {/* Year chips */}
          {preset === "year" ? (
            <div
              className="mt-2.5 flex flex-wrap gap-1.5"
              role="radiogroup"
              aria-label="Pick a year"
            >
              {YEAR_OPTIONS.map((year) => {
                const active = selectedYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setSelectedYear(year)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
                    style={{
                      borderColor: active ? "var(--color-brand)" : "var(--color-warm-gray-200)",
                      backgroundColor: active ? "var(--color-brand)" : "var(--color-white)",
                      color: active ? "#ffffff" : "var(--color-text-secondary)",
                    }}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Custom range picker */}
          {preset === "custom" ? (
            <div className="mt-2.5">
              <RangeCalendar
                start={customStart}
                end={customEnd}
                onChange={({ start, end }) => {
                  setCustomStart(start);
                  setCustomEnd(end);
                }}
              />
            </div>
          ) : null}

          {errorMessage ? (
            <div
              className="mt-5 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.06)",
                borderColor: "rgba(220, 38, 38, 0.25)",
                color: "var(--color-error)",
              }}
            >
              <WarningCircle size={14} weight="fill" />
              {errorMessage}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <div
            className="flex min-w-0 flex-col text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {previewFilename ? (
              <>
                <span
                  className="truncate font-mono text-[11px]"
                  style={{ color: "var(--color-text-secondary)" }}
                  title={previewFilename}
                >
                  {previewFilename}
                </span>
                <span className="mt-0.5 truncate">
                  {datasetCount} dataset{datasetCount === 1 ? "" : "s"} · {previewRange.label}
                </span>
              </>
            ) : (
              <span>Pick datasets and a range.</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border px-4 text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-100)]"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-secondary)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={handleDownload}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              {pending ? (
                "Exporting..."
              ) : (
                <>
                  <DownloadSimple size={14} weight="bold" />
                  Download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function DatasetPill({
  checked,
  onChange,
  icon,
  label,
  tag,
  inputRef,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  label: string;
  tag?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all"
      style={{
        borderColor: checked ? "var(--color-brand)" : "var(--color-warm-gray-200)",
        backgroundColor: checked ? "rgba(2, 170, 235, 0.04)" : "var(--color-white)",
        boxShadow: checked ? "0 0 0 1px var(--color-brand)" : "none",
      }}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
        style={{
          borderColor: checked ? "var(--color-brand)" : "var(--color-warm-gray-300)",
          backgroundColor: checked ? "var(--color-brand)" : "var(--color-white)",
          color: "#ffffff",
        }}
        aria-hidden
      >
        {checked ? <Check size={10} weight="bold" /> : null}
      </span>
      <span
        className="shrink-0"
        style={{ color: checked ? "var(--color-brand)" : "var(--color-text-tertiary)" }}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className="truncate text-sm font-semibold"
          style={{ color: checked ? "var(--color-brand)" : "var(--color-text-primary)" }}
        >
          {label}
        </span>
        {tag ? (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: "var(--color-warm-gray-100)",
              color: "var(--color-text-tertiary)",
            }}
          >
            {tag}
          </span>
        ) : null}
      </span>
    </label>
  );
}
