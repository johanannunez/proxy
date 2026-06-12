"use client";

/**
 * ResponsesHub — unified view of every form response across all forms.
 * Filter by form, property, and date range; expand rows for the full
 * response; export the filtered view as CSV.
 */
import { useMemo, useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CaretDown,
  CaretRight,
  ClipboardText,
  DownloadSimple,
  XCircle,
} from "@phosphor-icons/react";
import { CustomSelect, type SelectOption } from "@/components/admin/CustomSelect";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import {
  filterResponses,
  type ResponseFilters,
  type UnifiedFormResponse,
} from "@/lib/admin/responses-csv";
import { exportResponsesCSV } from "./export-actions";
import styles from "./ResponsesHub.module.css";

interface ResponsesHubProps {
  responses: UnifiedFormResponse[];
}

const ALL = "__all__";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fieldText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function ResponseRow({
  response,
  expanded,
  onToggle,
}: {
  response: UnifiedFormResponse;
  expanded: boolean;
  onToggle: () => void;
}) {
  const fields = Object.entries(response.data);
  return (
    <>
      <button
        type="button"
        className={`${styles.row} ${expanded ? styles.rowExpanded : ""}`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={styles.caretCell}>
          {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
        </span>
        <span className={styles.respondentCell}>
          <span className={styles.respondentName}>
            {response.respondent_name ?? "Anonymous"}
          </span>
          {response.respondent_email && (
            <span className={styles.respondentEmail}>{response.respondent_email}</span>
          )}
        </span>
        <span className={styles.formCell}>{response.form_name}</span>
        <span className={styles.dateCell}>{fmtDateTime(response.submitted_at)}</span>
        <span className={styles.propertyCell}>{response.property_name ?? "—"}</span>
        <span className={styles.statusCell}>
          <span
            className={`${styles.statusBadge} ${
              response.completed_at ? styles.statusComplete : styles.statusPartial
            }`}
          >
            {response.completed_at ? "Complete" : "Partial"}
          </span>
        </span>
      </button>

      {expanded && (
        <div className={styles.detailPanel}>
          {fields.length === 0 ? (
            <p className={styles.detailEmpty}>No fields recorded for this response.</p>
          ) : (
            <div className={styles.detailGrid}>
              {fields.map(([key, value]) => (
                <div key={key} className={styles.detailField}>
                  <div className={styles.detailLabel}>{key.replace(/_/g, " ")}</div>
                  <div className={styles.detailValue}>{fieldText(value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function ResponsesHub({ responses }: ResponsesHubProps) {
  const [formId, setFormId] = useState(ALL);
  const [propertyId, setPropertyId] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exporting, startExport] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  const formOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of responses) {
      if (!seen.has(r.form_id)) seen.set(r.form_id, r.form_name);
    }
    return [
      { value: ALL, label: "All forms" },
      ...[...seen.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [responses]);

  const propertyOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of responses) {
      if (r.property_id && !seen.has(r.property_id)) {
        seen.set(r.property_id, r.property_name ?? r.property_id);
      }
    }
    return [
      { value: ALL, label: "All properties" },
      ...[...seen.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [responses]);

  const filters: ResponseFilters = {
    formId: formId === ALL ? undefined : formId,
    propertyId: propertyId === ALL ? undefined : propertyId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const visible = useMemo(() => {
    const filtered = filterResponses(responses, filters);
    return [...filtered].sort((a, b) => {
      const diff = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      return sortAsc ? diff : -diff;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, formId, propertyId, dateFrom, dateTo, sortAsc]);

  const hasFilters = formId !== ALL || propertyId !== ALL || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setFormId(ALL);
    setPropertyId(ALL);
    setDateFrom("");
    setDateTo("");
  }

  function handleExport() {
    setExportError(null);
    startExport(async () => {
      const result = await exportResponsesCSV(filters);
      if (!result.ok) {
        setExportError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `form-responses-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Responses</h1>
          <p className={styles.pageSub}>
            {visible.length} {visible.length === 1 ? "response" : "responses"}
            {hasFilters ? " matching filters" : " across all forms"}
          </p>
        </div>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={handleExport}
          disabled={exporting || visible.length === 0}
        >
          <DownloadSimple size={14} weight="bold" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      {exportError && (
        <div className={styles.errorBanner} role="alert">
          {exportError}
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.filterControl}>
          <label className={styles.filterLabel} htmlFor="responses-filter-form">
            Form
          </label>
          <CustomSelect
            id="responses-filter-form"
            value={formId}
            onChange={setFormId}
            options={formOptions}
          />
        </div>
        <div className={styles.filterControl}>
          <label className={styles.filterLabel} htmlFor="responses-filter-property">
            Property
          </label>
          <CustomSelect
            id="responses-filter-property"
            value={propertyId}
            onChange={setPropertyId}
            options={propertyOptions}
          />
        </div>
        <div className={styles.filterControl}>
          <label className={styles.filterLabel} htmlFor="responses-filter-from">
            From
          </label>
          <DatePickerInput
            id="responses-filter-from"
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="Any date"
            aria-label="Submitted from date"
          />
        </div>
        <div className={styles.filterControl}>
          <label className={styles.filterLabel} htmlFor="responses-filter-to">
            To
          </label>
          <DatePickerInput
            id="responses-filter-to"
            value={dateTo}
            onChange={setDateTo}
            placeholder="Any date"
            aria-label="Submitted to date"
          />
        </div>
        {hasFilters && (
          <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
            <XCircle size={13} weight="duotone" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableSection}>
        {visible.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <ClipboardText size={22} weight="duotone" />
            </div>
            <p className={styles.emptyTitle}>
              {hasFilters ? "No responses match these filters" : "No responses yet"}
            </p>
            <p className={styles.emptyBody}>
              {hasFilters
                ? "Try widening the date range or clearing a filter."
                : "Responses appear here as soon as someone submits one of your forms."}
            </p>
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span className={styles.caretCell} />
              <span className={styles.headerCell}>Respondent</span>
              <span className={styles.headerCell}>Form</span>
              <button
                type="button"
                className={`${styles.headerCell} ${styles.headerSortBtn}`}
                onClick={() => setSortAsc((v) => !v)}
                aria-label={`Sort by submitted date, currently ${sortAsc ? "oldest" : "newest"} first`}
              >
                Submitted
                {sortAsc ? <ArrowUp size={11} weight="bold" /> : <ArrowDown size={11} weight="bold" />}
              </button>
              <span className={styles.headerCell}>Property</span>
              <span className={styles.headerCell}>Status</span>
            </div>
            {visible.map((response) => (
              <ResponseRow
                key={response.id}
                response={response}
                expanded={expandedId === response.id}
                onToggle={() =>
                  setExpandedId((prev) => (prev === response.id ? null : response.id))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
