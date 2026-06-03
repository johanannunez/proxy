import { format } from "date-fns";

import type { ExportDataset, ExportOptions } from "../actions";

/**
 * Shared CSV builder used by both the quick-download path and the Customize
 * Export modal. Takes the parsed JSON response from `exportUserData` plus the
 * options used to produce it, and returns `{ csv, filename }` ready to feed
 * into a Blob download.
 */

export type ExportResult = {
  csv: string;
  filename: string;
};

type ParsedExport = {
  exported_at: string;
  range_label: string;
  range_start: string | null;
  range_end: string | null;
  datasets: ExportDataset[];
  profile: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  properties: Array<Record<string, unknown>> | null;
  calendar_blocks: {
    total_count: number;
    approved: number;
    pending: number;
    denied: number;
    entries: Array<{
      start_date: string;
      end_date: string;
      status: string;
      created_at: string;
    }>;
  } | null;
};

function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(","),
    ),
  ];
  return lines.join("\n");
}

function slugifyRange(options: ExportOptions, today: string): string {
  // "By year" is its own self-describing filename: `proxy-2024.csv`.
  // The year already tells you what window it covers, and no suffix is
  // needed because the data inside is already scoped.
  const yearMatch = options.range.label.match(/^Year (\d{4})$/);
  if (yearMatch) return `proxy-${yearMatch[1]}`;

  // Every other case is keyed off today's date so repeated exports on
  // the same day with the same scope group together when sorted.
  // All time → no suffix.
  if (!options.range.start && !options.range.end) return `proxy-${today}`;

  // Short preset codes keep filenames tight.
  const named: Record<string, string> = {
    "Last 12 months": "12m",
    "Year to date": "ytd",
    "Custom range": "custom",
  };
  const slug = named[options.range.label];
  if (slug) return `proxy-${today}-${slug}`;

  return `proxy-${today}`;
}

export function buildExportCsv(
  rawJson: string,
  options: ExportOptions,
): ExportResult {
  const parsed = JSON.parse(rawJson) as ParsedExport;
  const today = format(new Date(), "yyyy-MM-dd");

  const wantsProperties = options.datasets.includes("properties");
  const wantsBlocks = options.datasets.includes("blocks");

  // Properties section.
  const propertiesCsv = wantsProperties
    ? jsonToCsv(
        (parsed.properties ?? []).map((p) => ({
          Name: p.name ?? "",
          Type: p.property_type ?? "",
          Address: p.address_line1 ?? "",
          "Address 2": p.address_line2 ?? "",
          City: p.city ?? "",
          State: p.state ?? "",
          "Postal Code": p.postal_code ?? "",
          Bedrooms: p.bedrooms ?? "",
          Bathrooms: p.bathrooms ?? "",
          "Guest Capacity": p.guest_capacity ?? "",
          Active: p.active ? "Yes" : "No",
          "Added On": p.created_at ?? "",
        })),
      )
    : "";

  // Calendar blocks section.
  const blockEntries = wantsBlocks ? parsed.calendar_blocks?.entries ?? [] : [];
  const blocksCsv = wantsBlocks
    ? jsonToCsv(
        blockEntries.map((b) => ({
          "Start Date": b.start_date ?? "",
          "End Date": b.end_date ?? "",
          Status: b.status ?? "",
          "Requested On": b.created_at ?? "",
        })),
      )
    : "";

  // Summary header.
  const rangeLine =
    options.range.start && options.range.end
      ? `Date range: ${options.range.label} (${options.range.start} to ${options.range.end})`
      : `Date range: ${options.range.label}`;

  const summaryLines = [
    `Proxy Data Export`,
    `Exported: ${today}`,
    `Owner: ${parsed.profile?.full_name ?? ""}`,
    `Email: ${parsed.profile?.email ?? ""}`,
    rangeLine,
    ``,
  ];

  if (wantsProperties) {
    summaryLines.push(
      `Properties: ${(parsed.properties ?? []).length} (not affected by date range)`,
    );
  }
  if (wantsBlocks) {
    const blocksBucket = parsed.calendar_blocks;
    summaryLines.push(
      `Calendar Blocks: ${blocksBucket?.total_count ?? 0} total (${blocksBucket?.approved ?? 0} approved, ${blocksBucket?.pending ?? 0} pending, ${blocksBucket?.denied ?? 0} denied)`,
    );
  }

  // Assemble full CSV.
  const parts: string[] = ["SUMMARY", summaryLines.join("\n")];

  if (wantsProperties) {
    parts.push("", "", "PROPERTIES", propertiesCsv || "No properties found");
  }
  if (wantsBlocks) {
    parts.push("", "", "CALENDAR BLOCKS", blocksCsv || "No calendar blocks found");
  }

  return {
    csv: parts.join("\n"),
    filename: `${slugifyRange(options, today)}.csv`,
  };
}

/**
 * Triggers a browser download of a CSV string. Used by both quick download
 * and the modal. Safe to call from any client component.
 */
export function triggerCsvDownload(result: ExportResult) {
  const blob = new Blob([result.csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
