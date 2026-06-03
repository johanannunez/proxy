"use client";

import { useState, useTransition } from "react";
import {
  DownloadSimple,
  Buildings,
  CalendarX,
  CheckCircle,
  FileText,
  Sliders,
} from "@phosphor-icons/react";
import { exportUserData, type ExportOptions } from "../actions";
import { buildExportCsv, triggerCsvDownload } from "./buildExportCsv";
import { CustomizeExportModal } from "./CustomizeExportModal";

type PreviewTab = "properties" | "blocks";

const QUICK_DOWNLOAD_OPTIONS: ExportOptions = {
  datasets: ["properties", "blocks"],
  range: { start: null, end: null, label: "All time" },
};

export function DataExportSection() {
  const [pending, startTransition] = useTransition();
  const [downloaded, setDownloaded] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("properties");
  const [modalOpen, setModalOpen] = useState(false);

  function handleQuickDownload() {
    setDownloaded(false);
    startTransition(async () => {
      const result = await exportUserData(QUICK_DOWNLOAD_OPTIONS);
      if (!result.ok || !result.data) return;
      const built = buildExportCsv(result.data, QUICK_DOWNLOAD_OPTIONS);
      triggerCsvDownload(built);
      setDownloaded(true);
    });
  }

  return (
    <section id="data-export" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Data Export
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Download a copy of your property data. Pick what to include and optionally filter by date range.
      </p>

      <div
        className="rounded-2xl border p-7"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* Clickable data cards */}
        <p
          className="mb-3 text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Click to preview what&apos;s included
        </p>

        <div className="mb-5 flex gap-3">
          <button
            type="button"
            onClick={() => setPreviewTab("properties")}
            className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all"
            style={{
              borderColor: previewTab === "properties" ? "var(--color-brand)" : "var(--color-warm-gray-200)",
              backgroundColor: previewTab === "properties" ? "rgba(2, 170, 235, 0.04)" : "var(--color-warm-gray-50)",
              boxShadow: previewTab === "properties" ? "0 0 0 1px var(--color-brand)" : "none",
            }}
          >
            <Buildings
              size={20}
              weight="duotone"
              style={{ color: previewTab === "properties" ? "var(--color-brand)" : "var(--color-text-tertiary)" }}
            />
            <div>
              <span
                className="text-sm font-semibold"
                style={{ color: previewTab === "properties" ? "var(--color-brand)" : "var(--color-text-primary)" }}
              >
                Properties
              </span>
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                Addresses, type, bedrooms, capacity, status
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPreviewTab("blocks")}
            className="flex flex-1 items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all"
            style={{
              borderColor: previewTab === "blocks" ? "var(--color-brand)" : "var(--color-warm-gray-200)",
              backgroundColor: previewTab === "blocks" ? "rgba(2, 170, 235, 0.04)" : "var(--color-warm-gray-50)",
              boxShadow: previewTab === "blocks" ? "0 0 0 1px var(--color-brand)" : "none",
            }}
          >
            <CalendarX
              size={20}
              weight="duotone"
              style={{ color: previewTab === "blocks" ? "var(--color-brand)" : "var(--color-text-tertiary)" }}
            />
            <div>
              <span
                className="text-sm font-semibold"
                style={{ color: previewTab === "blocks" ? "var(--color-brand)" : "var(--color-text-primary)" }}
              >
                Calendar Blocks
              </span>
              <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                Date ranges, status, approval counts
              </p>
            </div>
          </button>
        </div>

        {/* Preview Table */}
        <div
          className="mb-6 overflow-hidden rounded-lg border"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          {previewTab === "properties" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
                    <Th>Address</Th>
                    <Th>City</Th>
                    <Th>State</Th>
                    <Th>Beds</Th>
                    <Th>Baths</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t" style={{ borderColor: "var(--color-warm-gray-100)" }}>
                    <Td bold>1600 Pennsylvania Ave NW</Td>
                    <Td>Washington</Td>
                    <Td>DC</Td>
                    <Td>16</Td>
                    <Td>35</Td>
                    <Td><ActiveBadge active /></Td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: "var(--color-warm-gray-100)" }}>
                    <Td bold>14222 Camp David Rd</Td>
                    <Td>Thurmont</Td>
                    <Td>MD</Td>
                    <Td>6</Td>
                    <Td>8</Td>
                    <Td><ActiveBadge active /></Td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: "var(--color-warm-gray-100)" }}>
                    <Td bold>1651 Pennsylvania Ave NW</Td>
                    <Td>Washington</Td>
                    <Td>DC</Td>
                    <Td>14</Td>
                    <Td>18</Td>
                    <Td><ActiveBadge active={false} /></Td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
                    <Th>Start Date</Th>
                    <Th>Duration</Th>
                    <Th>Reason</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t" style={{ borderColor: "var(--color-warm-gray-100)" }}>
                    <Td>Apr 15, 2026</Td>
                    <Td>5 nights</Td>
                    <Td>Owner stay</Td>
                    <Td><StatusBadge status="approved" /></Td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: "var(--color-warm-gray-100)" }}>
                    <Td>May 1, 2026</Td>
                    <Td>2 nights</Td>
                    <Td>Family visiting</Td>
                    <Td><StatusBadge status="pending" /></Td>
                  </tr>
                  <tr className="border-t" style={{ borderColor: "var(--color-warm-gray-100)" }}>
                    <Td>Jun 10, 2026</Td>
                    <Td>4 nights</Td>
                    <Td>Maintenance</Td>
                    <Td><StatusBadge status="denied" /></Td>
                  </tr>
                </tbody>
              </table>
              {/* Block summary */}
              <div
                className="flex items-center gap-4 border-t px-3 py-2.5"
                style={{ borderColor: "var(--color-warm-gray-100)", backgroundColor: "var(--color-warm-gray-50)" }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
                  Summary
                </span>
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  3 total &middot; 1 approved &middot; 1 pending &middot; 1 denied
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Export actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--color-brand)" }}
            >
              <Sliders size={16} weight="bold" />
              Customize export
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleQuickDownload}
              className="inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 transition-colors hover:underline disabled:opacity-50"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <DownloadSimple size={12} weight="bold" />
              {pending ? "Exporting..." : "Quick download (all data, all time)"}
            </button>
          </div>
          <span
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <FileText size={12} />
            Opens in Excel, Google Sheets, or any spreadsheet app
          </span>
        </div>

        {/* Success message */}
        {downloaded && (
          <div
            className="mt-4 flex items-center gap-2.5 rounded-lg border px-4 py-3"
            style={{
              backgroundColor: "rgba(22, 163, 74, 0.08)",
              borderColor: "rgba(22, 163, 74, 0.25)",
            }}
          >
            <CheckCircle size={18} weight="duotone" style={{ color: "var(--color-success)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--color-success)" }}>
              Your data has been downloaded as a CSV file.
            </span>
          </div>
        )}
      </div>

      <CustomizeExportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDownloaded={() => setDownloaded(true)}
      />
    </section>
  );
}

/* ─── Table Helpers ─── */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
      {children}
    </th>
  );
}

function Td({ children, bold = false }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <td
      className={`px-3 py-2.5 text-xs ${bold ? "font-medium" : ""}`}
      style={{ color: bold ? "var(--color-text-primary)" : "var(--color-text-secondary)" }}
    >
      {children}
    </td>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        backgroundColor: active ? "rgba(22, 163, 74, 0.08)" : "var(--color-warm-gray-100)",
        color: active ? "var(--color-success)" : "var(--color-text-tertiary)",
      }}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    approved: { bg: "rgba(22, 163, 74, 0.08)", text: "var(--color-success)" },
    pending: { bg: "rgba(245, 158, 11, 0.08)", text: "#d97706" },
    denied: { bg: "rgba(220, 38, 38, 0.08)", text: "var(--color-error)" },
  };
  const c = colors[status] ?? { bg: "var(--color-warm-gray-100)", text: "var(--color-text-tertiary)" };
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}
