"use client";

import { useState, useRef, useEffect } from "react";
import {
  DownloadSimple,
  Trash,
  Check,
  WarningCircle,
  Receipt,
  UploadSimple,
  ArrowsOut,
  X,
  CaretDown,
  CaretUp,
  CaretLeft,
  CaretRight,
  Sparkle,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import type { OwnerReceiptRow } from "./receipts-types";
import { getReceiptAuditLog, type AuditLogEntry } from "./receipts-actions";

// Self-hosted worker copied into public/ by scripts/copy-pdf-worker.mjs
// (predev/prebuild). Loading it from a same-origin path avoids Turbopack's
// failure to resolve `new URL("pdfjs-dist/build/...", import.meta.url)`.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function getExtension(path: string | null): string | null {
  if (!path) return null;
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : null;
}

function isImageExt(ext: string | null): boolean {
  return ["jpg", "jpeg", "png", "webp", "gif", "heic", "bmp", "tiff", "heif"].includes(ext ?? "");
}

function isPdfExt(ext: string | null): boolean {
  return ext === "pdf";
}

function ActionBar({
  signedUrl,
  onDelete,
  onAttach,
  hasFile,
}: {
  signedUrl: string | null;
  onDelete: () => void;
  onAttach: () => void;
  hasFile: boolean;
}) {
  const [deleteHovered, setDeleteHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 12px",
        borderBottom: "1px solid var(--color-warm-gray-200)",
        justifyContent: "flex-end",
        backgroundColor: "var(--color-white)",
      }}
    >
      {!hasFile && (
        <button
          type="button"
          onClick={onAttach}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            padding: "5px 10px",
            borderRadius: "7px",
            border: "1px solid var(--color-warm-gray-200)",
            backgroundColor: "var(--color-warm-gray-50)",
            color: "var(--color-text-secondary)",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <UploadSimple size={13} weight="bold" />
          Attach file
        </button>
      )}
      {signedUrl && (
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Download"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            borderRadius: "7px",
            border: "1px solid var(--color-warm-gray-200)",
            backgroundColor: "var(--color-warm-gray-50)",
            color: "var(--color-text-secondary)",
            textDecoration: "none",
          }}
        >
          <DownloadSimple size={14} weight="bold" />
        </a>
      )}
      <button
        type="button"
        onClick={onDelete}
        onMouseEnter={() => setDeleteHovered(true)}
        onMouseLeave={() => setDeleteHovered(false)}
        title="Delete receipt"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "30px",
          height: "30px",
          borderRadius: "7px",
          border: `1px solid ${deleteHovered ? "rgba(220, 38, 38, 0.3)" : "var(--color-warm-gray-200)"}`,
          backgroundColor: deleteHovered ? "rgba(220, 38, 38, 0.06)" : "var(--color-warm-gray-50)",
          color: deleteHovered ? "var(--color-error)" : "var(--color-text-secondary)",
          cursor: "pointer",
          transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
        }}
      >
        <Trash size={14} weight="bold" />
      </button>
    </div>
  );
}

function ImageViewer({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        setScale(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-warm-gray-50)",
          position: "relative",
          overflow: "hidden",
          cursor: scale > 1 ? "grab" : "zoom-in",
        }}
        onClick={() => { if (scale === 1) setExpanded(true); }}
        onWheel={(e) => {
          e.preventDefault();
          setScale((s) => Math.min(4, Math.max(0.5, s - e.deltaY * 0.001)));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase signed URL for receipt photo; dimensions are unknown and vary per image */}
        <img
          src={url}
          alt="Receipt"
          draggable={false}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            boxShadow: "var(--shadow-md)",
            borderRadius: "4px",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            userSelect: "none",
            transition: "transform 80ms ease",
          }}
        />
        <button
          type="button"
          title="Expand"
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "28px",
            height: "28px",
            borderRadius: "7px",
            border: "1px solid var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
            cursor: "pointer",
            color: "var(--color-text-secondary)",
          }}
        >
          <ArrowsOut size={13} weight="bold" />
        </button>
        {scale !== 1 && (
          <button
            type="button"
            title="Reset zoom (Cmd+0)"
            onClick={(e) => { e.stopPropagation(); setScale(1); }}
            style={{
              position: "absolute",
              bottom: "10px",
              right: "10px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 9px",
              borderRadius: "6px",
              border: "1px solid var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            {Math.round(scale * 100)}% &middot; Reset
          </button>
        )}
      </div>

      {expanded && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setExpanded(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase signed URL for receipt photo; dimensions are unknown and vary per image */}
          <img
            src={url}
            alt="Receipt full view"
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "8px" }}
          />
          <button
            type="button"
            onClick={() => setExpanded(false)}
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "rgba(255,255,255,0.15)",
              border: "none",
              cursor: "pointer",
              color: "white",
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      )}
    </>
  );
}

function PdfPaginatedViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "auto",
        backgroundColor: "var(--color-warm-gray-100)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ padding: "16px 0 0", width: "100%" }}>
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={null}
          error={null}
        >
          <Page
            pageNumber={currentPage}
            width={containerRef.current?.clientWidth ?? 600}
            renderAnnotationLayer={false}
            renderTextLayer={false}
          />
        </Document>
      </div>

      {numPages !== null && numPages > 1 && (
        <div
          style={{
            flexShrink: 0,
            height: "36px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "0 14px",
            backgroundColor: "var(--color-white)",
            borderTop: "1px solid var(--color-warm-gray-200)",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              borderRadius: "5px",
              border: "1px solid var(--color-warm-gray-200)",
              backgroundColor: "var(--color-warm-gray-50)",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              color: currentPage === 1 ? "var(--color-text-tertiary)" : "var(--color-brand)",
            }}
          >
            <CaretLeft size={12} weight="bold" />
          </button>
          <span style={{ fontSize: "12px", color: "var(--color-text-secondary)", fontWeight: 500, flex: 1, textAlign: "center" }}>
            Page {currentPage} of {numPages}
          </span>
          <button
            type="button"
            disabled={currentPage === numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              borderRadius: "5px",
              border: "1px solid var(--color-warm-gray-200)",
              backgroundColor: "var(--color-warm-gray-50)",
              cursor: currentPage === numPages ? "not-allowed" : "pointer",
              color: currentPage === numPages ? "var(--color-text-tertiary)" : "var(--color-brand)",
            }}
          >
            <CaretRight size={12} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyPreview({ onAttach }: { onAttach: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--color-warm-gray-50)",
      }}
    >
      <button
        type="button"
        onClick={onAttach}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          padding: "40px",
          borderRadius: "16px",
          border: `2px dashed ${hovered ? "rgba(27, 119, 190, 0.4)" : "var(--color-warm-gray-200)"}`,
          backgroundColor: hovered ? "rgba(27, 119, 190, 0.03)" : "transparent",
          cursor: "pointer",
          transition: "border-color 150ms ease, background-color 150ms ease",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "12px",
            backgroundColor: "var(--color-warm-gray-100)",
          }}
        >
          <UploadSimple size={22} weight="duotone" color="var(--color-text-tertiary)" />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
            No file attached
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-tertiary)", marginTop: "2px" }}>
            Click to attach a file to this receipt
          </div>
        </div>
      </button>
    </div>
  );
}

function MetadataField({
  label,
  value,
  onSave,
  type = "text",
}: {
  label: string;
  value: string | number | null;
  onSave: (val: string) => void;
  type?: "text" | "number";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  const handleBlur = () => {
    setEditing(false);
    if (draft !== String(value ?? "")) {
      onSave(draft);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "0",
        minHeight: "32px",
        borderBottom: "1px solid var(--color-warm-gray-100)",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          width: "96px",
          flexShrink: 0,
          paddingTop: "9px",
          paddingBottom: "8px",
        }}
      >
        {label}
      </span>
      {editing ? (
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            backgroundColor: "rgba(27, 119, 190, 0.05)",
            fontSize: "12.5px",
            color: "var(--color-text-primary)",
            padding: "8px 8px",
            fontFamily: "inherit",
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(String(value ?? "")); setEditing(true); }}
          style={{
            flex: 1,
            border: "none",
            background: "none",
            cursor: "text",
            textAlign: "left",
            fontSize: "12.5px",
            color: value ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            padding: "8px 8px",
            fontFamily: "inherit",
          }}
        >
          {value || "—"}
        </button>
      )}
    </div>
  );
}

const DOC_TYPE_OPTIONS: Array<{ value: string; label: string; color: string; bg: string; border: string }> = [
  { value: "receipt",   label: "Receipt",   color: "#0369a1", bg: "rgba(14,165,233,0.08)",   border: "rgba(14,165,233,0.20)" },
  { value: "invoice",   label: "Invoice",   color: "#7c3aed", bg: "rgba(139,92,246,0.08)",   border: "rgba(139,92,246,0.20)" },
  { value: "recurring", label: "Recurring", color: "#0f766e", bg: "rgba(20,184,166,0.08)",   border: "rgba(20,184,166,0.20)" },
  { value: "to_pay",    label: "To Pay",    color: "#b45309", bg: "rgba(245,158,11,0.08)",   border: "rgba(245,158,11,0.20)" },
];

function DocumentTypeField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = DOC_TYPE_OPTIONS.find((o) => o.value === (value ?? "receipt")) ?? DOC_TYPE_OPTIONS[0];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        minHeight: "32px",
        borderBottom: "1px solid var(--color-warm-gray-100)",
        position: "relative",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          width: "96px",
          flexShrink: 0,
          paddingTop: "9px",
          paddingBottom: "8px",
        }}
      >
        Type
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          flex: 1,
          border: "none",
          background: "none",
          cursor: "pointer",
          textAlign: "left",
          padding: "8px 8px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            fontSize: "11.5px",
            fontWeight: 600,
            color: current.color,
            backgroundColor: current.bg,
            border: `1px solid ${current.border}`,
            padding: "2px 9px",
            borderRadius: "6px",
          }}
        >
          {current.label}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "96px",
            zIndex: 100,
            backgroundColor: "var(--color-white)",
            border: "1px solid var(--color-warm-gray-200)",
            borderRadius: "10px",
            boxShadow: "var(--shadow-lg)",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            minWidth: "150px",
          }}
        >
          {DOC_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onSave(opt.value); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: opt.value === (value ?? "receipt") ? opt.bg : "transparent",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                if (opt.value !== (value ?? "receipt"))
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-warm-gray-50)";
              }}
              onMouseLeave={(e) => {
                if (opt.value !== (value ?? "receipt"))
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: opt.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "12.5px", color: "var(--color-text-primary)", fontWeight: opt.value === (value ?? "receipt") ? 600 : 400 }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Maintenance:              { bg: "rgba(245,158,11,0.10)",  text: "#b45309", border: "rgba(245,158,11,0.25)" },
  Cleaning:                 { bg: "rgba(20,184,166,0.10)",  text: "#0f766e", border: "rgba(20,184,166,0.25)" },
  Supplies:                 { bg: "rgba(27,119,190,0.10)",  text: "#1b77be", border: "rgba(27,119,190,0.25)" },
  Utilities:                { bg: "rgba(234,179,8,0.10)",   text: "#854d0e", border: "rgba(234,179,8,0.25)"  },
  Insurance:                { bg: "rgba(139,92,246,0.10)",  text: "#7c3aed", border: "rgba(139,92,246,0.25)" },
  Taxes:                    { bg: "rgba(239,68,68,0.10)",   text: "#b91c1c", border: "rgba(239,68,68,0.25)"  },
  Furnishings:              { bg: "rgba(34,197,94,0.10)",   text: "#15803d", border: "rgba(34,197,94,0.25)"  },
  Marketing:                { bg: "rgba(236,72,153,0.10)",  text: "#be185d", border: "rgba(236,72,153,0.25)" },
  Travel:                   { bg: "rgba(14,165,233,0.10)",  text: "#0369a1", border: "rgba(14,165,233,0.25)" },
  "Professional Services":  { bg: "rgba(99,102,241,0.10)",  text: "#4338ca", border: "rgba(99,102,241,0.25)" },
  Other:                    { bg: "rgba(107,114,128,0.10)", text: "#4b5563", border: "rgba(107,114,128,0.20)" },
};

const CATEGORIES = [
  "Maintenance", "Cleaning", "Supplies", "Utilities", "Insurance",
  "Taxes", "Furnishings", "Marketing", "Travel", "Professional Services", "Other",
];

function CategoryField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const colors = CATEGORY_COLORS[value ?? "Other"] ?? CATEGORY_COLORS["Other"]!;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        minHeight: "32px",
        borderBottom: "1px solid var(--color-warm-gray-100)",
        position: "relative",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--color-text-tertiary)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          width: "96px",
          flexShrink: 0,
          paddingTop: "9px",
          paddingBottom: "8px",
        }}
      >
        Category
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          flex: 1,
          border: "none",
          background: "none",
          cursor: "pointer",
          textAlign: "left",
          padding: "8px 8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        {value ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "11.5px",
              fontWeight: 600,
              color: colors.text,
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              padding: "2px 9px",
              borderRadius: "6px",
            }}
          >
            {value}
          </span>
        ) : (
          <span style={{ fontSize: "12.5px", color: "var(--color-text-tertiary)" }}>{"—"}</span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: "96px",
            zIndex: 100,
            backgroundColor: "var(--color-white)",
            border: "1px solid var(--color-warm-gray-200)",
            borderRadius: "10px",
            boxShadow: "var(--shadow-lg)",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            minWidth: "180px",
          }}
        >
          {CATEGORIES.map((cat) => {
            const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["Other"]!;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { onSave(cat); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: cat === value ? c.bg : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: "8px",
                }}
                onMouseEnter={(e) => { if (cat !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-warm-gray-50)"; }}
                onMouseLeave={(e) => { if (cat !== value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: c.text,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "12.5px", color: "var(--color-text-primary)", fontWeight: cat === value ? 600 : 400 }}>
                  {cat}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type LineItem = {
  description?: string;
  amount?: number;
  [key: string]: unknown;
};

function LineItemsSection({ lineItems }: { lineItems: unknown }) {
  const [open, setOpen] = useState(false);
  const items: LineItem[] | null = Array.isArray(lineItems) && lineItems.length > 0
    ? (lineItems as LineItem[])
    : null;

  if (!items) return null;

  return (
    <div style={{ borderBottom: "1px solid var(--color-warm-gray-100)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: "8px 0",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--color-text-tertiary)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Line items
          <span
            style={{
              marginLeft: "6px",
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--color-brand)",
              backgroundColor: "rgba(27, 119, 190, 0.10)",
              border: "1px solid rgba(27, 119, 190, 0.20)",
              borderRadius: "4px",
              padding: "1px 6px",
            }}
          >
            {items.length}
          </span>
        </span>
        {open ? (
          <CaretUp size={12} color="var(--color-text-tertiary)" />
        ) : (
          <CaretDown size={12} color="var(--color-text-tertiary)" />
        )}
      </button>
      {open && (
        <div style={{ paddingBottom: "8px" }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                padding: "5px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--color-warm-gray-100)",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                  flex: 1,
                  fontFamily: "var(--font-ibm-plex-mono, monospace)",
                  letterSpacing: "-0.01em",
                }}
              >
                {item.description ?? `Item ${i + 1}`}
              </span>
              {typeof item.amount === "number" && (
                <span
                  style={{
                    fontSize: "11.5px",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    backgroundColor: "var(--color-warm-gray-100)",
                    border: "1px solid var(--color-warm-gray-200)",
                    borderRadius: "5px",
                    padding: "2px 7px",
                    fontFamily: "var(--font-ibm-plex-mono, monospace)",
                    flexShrink: 0,
                  }}
                >
                  {formatCurrency(item.amount)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function MetadataStrip({
  receipt,
  receiptId,
  onFieldUpdate,
  onMarkReviewed,
  collapsed,
  onToggleCollapsed,
}: {
  receipt: OwnerReceiptRow;
  receiptId: string;
  onFieldUpdate: (field: string, value: unknown) => void;
  onMarkReviewed: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const needsReview = !receipt.reviewed_at;

  // Audit trail state
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (!auditOpen) return;
    setAuditLoading(true);
    getReceiptAuditLog(receiptId)
      .then((entries) => setAuditLog(entries))
      .catch(() => setAuditLog([]))
      .finally(() => setAuditLoading(false));
  }, [auditOpen, receiptId]);

  // Review notes state
  const [reviewNoteDraft, setReviewNoteDraft] = useState(receipt.review_notes ?? "");
  useEffect(() => {
    setReviewNoteDraft(receipt.review_notes ?? "");
  }, [receipt.review_notes]);

  // Tags state
  const [tagInput, setTagInput] = useState("");
  const tags: string[] = Array.isArray(receipt.tags) ? receipt.tags : [];

  const commitTag = (raw?: string) => {
    const trimmed = (raw ?? tagInput).trim().replace(/,/g, "").slice(0, 20);
    if (!trimmed || tags.length >= 10 || tags.includes(trimmed)) {
      setTagInput("");
      return;
    }
    onFieldUpdate("tags", [...tags, trimmed]);
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    onFieldUpdate("tags", tags.filter((t) => t !== tag));
  };

  return (
    <div
      style={{
        borderBottom: "1px solid var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: collapsed ? "none" : "1px solid var(--color-warm-gray-100)",
          cursor: "pointer",
          position: "relative",
        }}
        onClick={onToggleCollapsed}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Document details
          </span>
          {needsReview && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "10px",
                fontWeight: 700,
                color: "#b45309",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                padding: "2px 7px",
                borderRadius: "4px",
              }}
            >
              <WarningCircle size={10} weight="bold" />
              Needs review
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {needsReview && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMarkReviewed(); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(245, 158, 11, 0.25)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(245, 158, 11, 0.15)"; }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "#b45309",
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "6px",
                padding: "4px 10px",
                cursor: "pointer",
                transition: "background-color 120ms ease",
              }}
            >
              <Check size={12} weight="bold" />
              Mark reviewed
            </button>
          )}
          {/* Audit trail button */}
          <div style={{ position: "relative" }}>
            <button
              type="button"
              title="View history"
              onClick={(e) => { e.stopPropagation(); setAuditOpen((v) => !v); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "24px",
                height: "24px",
                borderRadius: "6px",
                border: `1px solid ${auditOpen ? "rgba(27,119,190,0.3)" : "var(--color-warm-gray-200)"}`,
                backgroundColor: auditOpen ? "rgba(27,119,190,0.08)" : "transparent",
                color: auditOpen ? "var(--color-brand)" : "var(--color-text-tertiary)",
                cursor: "pointer",
                transition: "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
              }}
            >
              <ClockCounterClockwise size={13} weight="bold" />
            </button>
            {auditOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: "280px",
                  backgroundColor: "var(--color-white)",
                  border: "1px solid var(--color-warm-gray-200)",
                  borderRadius: "10px",
                  boxShadow: "var(--shadow-lg)",
                  padding: "10px",
                  zIndex: 200,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontSize: "10.5px",
                    fontWeight: 700,
                    color: "var(--color-text-tertiary)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  History
                </div>
                {auditLoading ? (
                  <div style={{ fontSize: "12px", color: "var(--color-text-tertiary)", padding: "8px 0" }}>
                    Loading...
                  </div>
                ) : auditLog.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--color-text-tertiary)", padding: "8px 0" }}>
                    No history yet
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                    {auditLog.map((entry, i) => (
                      <div
                        key={entry.id}
                        style={{
                          padding: "7px 0",
                          borderTop: i === 0 ? "none" : "1px solid var(--color-warm-gray-100)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "var(--color-text-primary)",
                              textTransform: "capitalize",
                            }}
                          >
                            {entry.action}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)", flexShrink: 0 }}>
                            {formatAuditTime(entry.changed_at)}
                          </span>
                        </div>
                        {entry.field && (
                          <div
                            style={{
                              marginTop: "2px",
                              fontSize: "11px",
                              color: "var(--color-text-secondary)",
                              fontFamily: "var(--font-ibm-plex-mono, monospace)",
                            }}
                          >
                            {entry.field}
                            {entry.old_value !== null || entry.new_value !== null ? (
                              <span>
                                {": "}
                                <span style={{ color: "var(--color-text-tertiary)" }}>
                                  {entry.old_value ?? "—"}
                                </span>
                                {" → "}
                                <span style={{ color: "var(--color-brand)" }}>
                                  {entry.new_value ?? "—"}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {collapsed ? (
            <CaretDown size={13} color="var(--color-text-tertiary)" />
          ) : (
            <CaretUp size={13} color="var(--color-text-tertiary)" />
          )}
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: "0 14px 4px" }}>
          {receipt.analysis_summary && (
            <div
              style={{
                margin: "10px 0 6px",
                padding: "10px 12px",
                borderRadius: "10px",
                backgroundColor: "rgba(27, 119, 190, 0.06)",
                border: "1px solid rgba(27, 119, 190, 0.14)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                <Sparkle size={13} weight="duotone" color="var(--color-brand)" style={{ marginTop: "1px", flexShrink: 0 }} />
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "var(--color-text-secondary)",
                    lineHeight: 1.55,
                    fontStyle: "italic",
                  }}
                >
                  {receipt.analysis_summary}
                </p>
              </div>
            </div>
          )}
          <DocumentTypeField
            value={receipt.analysis_kind}
            onSave={(v) => onFieldUpdate("analysis_kind", v)}
          />
          <MetadataField
            label="Vendor"
            value={receipt.vendor}
            onSave={(v) => onFieldUpdate("vendor", v)}
          />
          <MetadataField
            label="Amount"
            value={receipt.amount}
            type="number"
            onSave={(v) => onFieldUpdate("amount", parseFloat(v) || 0)}
          />
          <MetadataField
            label="Date"
            value={receipt.purchase_date}
            onSave={(v) => onFieldUpdate("purchase_date", v)}
          />
          <CategoryField
            value={receipt.category}
            onSave={(v) => onFieldUpdate("category", v)}
          />
          <MetadataField
            label="Notes"
            value={receipt.notes}
            onSave={(v) => onFieldUpdate("notes", v || null)}
          />

          {/* Internal note field */}
          <div
            style={{
              borderBottom: "1px solid var(--color-warm-gray-100)",
              paddingTop: "6px",
              paddingBottom: "6px",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Internal note
            </span>
            <textarea
              value={reviewNoteDraft}
              onChange={(e) => setReviewNoteDraft(e.target.value)}
              onBlur={() => onFieldUpdate("review_notes", reviewNoteDraft.trim() || null)}
              placeholder="Add an internal note..."
              rows={2}
              style={{
                width: "100%",
                resize: "none",
                maxHeight: "80px",
                overflowY: "auto",
                border: "1px solid rgba(245,158,11,0.15)",
                borderRadius: "6px",
                backgroundColor: "rgba(245,158,11,0.04)",
                fontSize: "12px",
                color: "var(--color-text-primary)",
                padding: "7px 8px",
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Tags section */}
          <div
            style={{
              borderBottom: "1px solid var(--color-warm-gray-100)",
              paddingTop: "6px",
              paddingBottom: "8px",
            }}
          >
            <span
              style={{
                display: "block",
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--color-text-tertiary)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: "6px",
              }}
            >
              Tags
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: tags.length > 0 ? "6px" : "0" }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backgroundColor: "rgba(27,119,190,0.08)",
                    border: "1px solid rgba(27,119,190,0.18)",
                    borderRadius: "5px",
                    fontSize: "11.5px",
                    color: "var(--color-brand)",
                    fontWeight: 600,
                    padding: "2px 8px",
                  }}
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "none",
                      border: "none",
                      padding: "0",
                      cursor: "pointer",
                      color: "var(--color-brand)",
                      opacity: 0.65,
                      lineHeight: 1,
                    }}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X size={10} weight="bold" />
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 10 && (
              <input
                type="text"
                value={tagInput}
                maxLength={20}
                placeholder="Add a tag..."
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.endsWith(",")) {
                    commitTag(raw.slice(0, -1));
                  } else {
                    setTagInput(raw);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTag();
                  }
                }}
                style={{
                  width: "100%",
                  border: "1px solid var(--color-warm-gray-200)",
                  borderRadius: "5px",
                  backgroundColor: "var(--color-warm-gray-50)",
                  fontSize: "12px",
                  color: "var(--color-text-primary)",
                  padding: "5px 8px",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>

          <LineItemsSection lineItems={receipt.line_items} />
        </div>
      )}
    </div>
  );
}

function AnalyzingOverlay({ absolute }: { absolute?: boolean }) {
  return (
    <>
      <style>{`
        @keyframes analysis-ring-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        @keyframes analysis-sparkle-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.92); }
        }
      `}</style>
      <div
        style={{
          position: absolute ? "absolute" : "relative",
          inset: absolute ? 0 : undefined,
          flex: absolute ? undefined : 1,
          zIndex: absolute ? 10 : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: absolute ? "rgba(255,255,255,0.97)" : "var(--color-warm-gray-50)",
        }}
      >
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              width: "180px",
              height: "180px",
              borderRadius: "50%",
              border: "1.5px dashed rgba(27,119,190,0.12)",
              animation: "analysis-ring-pulse 2s ease-in-out infinite",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              border: "1.5px dashed rgba(27,119,190,0.20)",
              animation: "analysis-ring-pulse 2s ease-in-out infinite 0.4s",
            }}
          />
          <div
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              border: "1.5px dashed rgba(27,119,190,0.30)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              animation: "analysis-ring-pulse 2s ease-in-out infinite 0.8s",
            }}
          >
            <div style={{ animation: "analysis-sparkle-pulse 1.6s ease-in-out infinite" }}>
              <Sparkle size={22} weight="duotone" color="var(--color-brand)" />
            </div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "calc(50% - 72px)",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontSize: "12.5px",
              fontWeight: 600,
              color: "var(--color-brand)",
              letterSpacing: "0.01em",
            }}
          >
            Analyzing document...
          </span>
        </div>
      </div>
    </>
  );
}

export function ReceiptsPreviewPanel({
  receipt,
  signedUrl,
  onFieldUpdate,
  onMarkReviewed,
  onDelete,
  onAttachFile,
  uploading = false,
}: {
  receipt: OwnerReceiptRow | null;
  signedUrl: string | null;
  onFieldUpdate: (field: string, value: unknown) => void;
  onMarkReviewed: () => void;
  onDelete: () => void;
  onAttachFile: () => void;
  uploading?: boolean;
}) {
  const [metaCollapsed, setMetaCollapsed] = useState(false);
  const [dropHovered, setDropHovered] = useState(false);

  if (!receipt) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--color-warm-gray-50)",
        }}
        onDragEnter={() => setDropHovered(true)}
        onDragLeave={() => setDropHovered(false)}
      >
        {uploading ? (
          <AnalyzingOverlay />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              padding: "48px",
              borderRadius: "20px",
              border: `2px dashed ${dropHovered ? "rgba(27, 119, 190, 0.5)" : "var(--color-warm-gray-200)"}`,
              backgroundColor: dropHovered ? "rgba(27, 119, 190, 0.04)" : "transparent",
              transition: "border-color 150ms ease, background-color 150ms ease",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "14px",
                backgroundColor: "rgba(2, 170, 235, 0.08)",
              }}
            >
              <Receipt size={26} weight="duotone" color="var(--color-brand)" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                Drop a document here
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text-tertiary)", marginTop: "4px" }}>
                or select a file from the sidebar
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const ext = getExtension(receipt.storage_path);
  const hasFile = !!receipt.storage_path;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%", backgroundColor: "var(--color-white)" }}>
      {uploading && <AnalyzingOverlay absolute />}
      <ActionBar
        signedUrl={signedUrl}
        onDelete={onDelete}
        onAttach={onAttachFile}
        hasFile={hasFile}
      />

      {hasFile && signedUrl ? (
        <>
          <MetadataStrip
            receipt={receipt}
            receiptId={receipt.id}
            onFieldUpdate={onFieldUpdate}
            onMarkReviewed={onMarkReviewed}
            collapsed={metaCollapsed}
            onToggleCollapsed={() => setMetaCollapsed((v) => !v)}
          />
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {isPdfExt(ext) ? (
              <PdfPaginatedViewer url={signedUrl} />
            ) : isImageExt(ext) ? (
              <ImageViewer url={signedUrl} />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "var(--color-warm-gray-50)",
                }}
              >
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                    padding: "32px",
                    borderRadius: "14px",
                    border: "1px solid var(--color-warm-gray-200)",
                    backgroundColor: "var(--color-white)",
                    color: "var(--color-brand)",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  <DownloadSimple size={24} weight="duotone" />
                  Download to view
                </a>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <MetadataStrip
            receipt={receipt}
            receiptId={receipt.id}
            onFieldUpdate={onFieldUpdate}
            onMarkReviewed={onMarkReviewed}
            collapsed={false}
            onToggleCollapsed={() => {}}
          />
          <EmptyPreview onAttach={onAttachFile} />
        </>
      )}
    </div>
  );
}
