/**
 * Pure helpers for the unified form-responses view: cross-form filtering and
 * CSV export. Client-safe (no server imports) so the hub, the export server
 * action, and tests all share the exact same logic.
 */

export type UnifiedFormResponse = {
  id: string;
  form_id: string;
  form_name: string;
  respondent_name: string | null;
  respondent_email: string | null;
  property_id: string | null;
  property_name: string | null;
  workspace_id: string | null;
  workspace_name: string | null;
  submitted_at: string;
  completed_at: string | null;
  data: Record<string, unknown>;
};

export type ResponseFilters = {
  formId?: string;
  propertyId?: string;
  workspaceId?: string;
  /** Inclusive, YYYY-MM-DD. */
  dateFrom?: string;
  /** Inclusive, YYYY-MM-DD. */
  dateTo?: string;
};

const FIXED_COLUMNS = [
  "respondent_name",
  "respondent_email",
  "form_name",
  "property",
  "submitted_at",
  "status",
] as const;

export function filterResponses(
  rows: UnifiedFormResponse[],
  filters: ResponseFilters,
): UnifiedFormResponse[] {
  return rows.filter((row) => {
    if (filters.formId && row.form_id !== filters.formId) return false;
    if (filters.propertyId && row.property_id !== filters.propertyId) return false;
    if (filters.workspaceId && row.workspace_id !== filters.workspaceId) return false;
    if (filters.dateFrom || filters.dateTo) {
      const day = row.submitted_at.slice(0, 10);
      if (filters.dateFrom && day < filters.dateFrom) return false;
      if (filters.dateTo && day > filters.dateTo) return false;
    }
    return true;
  });
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/**
 * Builds an RFC 4180 CSV. Columns: the fixed identity/meta columns followed by
 * every field key present in the exported responses (first-appearance order).
 */
export function buildResponsesCSV(rows: UnifiedFormResponse[]): string {
  const fieldColumns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row.data)) {
      if (!seen.has(key)) {
        seen.add(key);
        fieldColumns.push(key);
      }
    }
  }

  const header = [...FIXED_COLUMNS, ...fieldColumns];
  const lines = [header.map(escapeCell).join(",")];

  for (const row of rows) {
    const fixed = [
      row.respondent_name ?? "",
      row.respondent_email ?? "",
      row.form_name,
      row.property_name ?? "",
      row.submitted_at,
      row.completed_at ? "Complete" : "Partial",
    ];
    const fields = fieldColumns.map((key) => cellValue(row.data[key]));
    lines.push([...fixed, ...fields].map(escapeCell).join(","));
  }

  return lines.join("\r\n");
}
