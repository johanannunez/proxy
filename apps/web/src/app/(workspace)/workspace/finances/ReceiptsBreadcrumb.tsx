"use client";

import type { Breadcrumb } from "./receipts-types";

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: "PDF",
  jpg: "IMG",
  jpeg: "IMG",
  png: "IMG",
  webp: "IMG",
  gif: "IMG",
  heic: "IMG",
};

function getFileTypeBadge(ext: string | null): string | null {
  if (!ext) return null;
  return FILE_TYPE_LABELS[ext.toLowerCase()] ?? "FILE";
}

export function ReceiptsBreadcrumb({
  segments,
  fileExtension,
}: {
  segments: Breadcrumb[];
  fileExtension?: string | null;
}) {
  return (
    <nav
      aria-label="File location"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "0 0 12px 0",
        flexWrap: "wrap",
      }}
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const isFile = isLast && fileExtension !== undefined;
        const badge = isFile ? getFileTypeBadge(fileExtension) : null;

        return (
          <span key={seg.key ?? seg.label} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            {i > 0 && (
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-warm-gray-400)",
                  padding: "0 2px",
                  userSelect: "none",
                }}
              >
                ›
              </span>
            )}
            {isLast ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  backgroundColor: "var(--color-warm-gray-100)",
                }}
              >
                {seg.label}
                {badge && (
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      color: "var(--color-brand)",
                      backgroundColor: "rgba(27, 119, 190, 0.10)",
                      padding: "1px 5px",
                      borderRadius: "4px",
                    }}
                  >
                    {badge}
                  </span>
                )}
              </span>
            ) : (
              <button
                type="button"
                onClick={seg.onClick}
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: seg.onClick ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: "none",
                  border: "none",
                  cursor: seg.onClick ? "pointer" : "default",
                  transition: "background-color 120ms ease, color 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (seg.onClick) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-warm-gray-100)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-primary)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = seg.onClick
                    ? "var(--color-text-secondary)"
                    : "var(--color-text-tertiary)";
                }}
              >
                {seg.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
