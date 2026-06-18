"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  CloudArrowUp,
  FileText,
  DownloadSimple,
  Trash,
  PencilSimple,
  Receipt,
  Eye,
  Copy,
  Check,
  ClockCounterClockwise,
  CalendarBlank,
} from "@phosphor-icons/react";
import { STATUS_CONFIG, type ChecklistStatus, type ChecklistItemKind } from "@/lib/checklist";
import css from "./DocumentModal.module.css";

/* ─── Types ─── */

type DocumentRecord = {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: string; // ISO
  uploadedBy: string;
};

type ViewHistory = {
  viewedBy: string;
  viewedAt: string; // ISO
  count?: number;
};

export function DocumentModal({
  open,
  onClose,
  itemLabel,
  itemKey,
  kind,
  propertyLabel,
  ownerNames,
  status,
  documents = [],
}: {
  open: boolean;
  onClose: () => void;
  itemLabel: string;
  itemKey: string;
  kind: ChecklistItemKind;
  propertyLabel: string;
  ownerNames?: string[];
  status: ChecklistStatus;
  documents?: DocumentRecord[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    function handleClick(e: MouseEvent) {
      if (e.target === d) onClose();
    }
    d.addEventListener("click", handleClick);
    return () => d.removeEventListener("click", handleClick);
  }, [onClose]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    function handleClose() { onClose(); }
    d.addEventListener("close", handleClose);
    return () => d.removeEventListener("close", handleClose);
  }, [onClose]);

  const cfg = STATUS_CONFIG[status];

  const kicker =
    kind === "form" ? "Form"
    : kind === "summary" ? "Summary"
    : "Document";

  // Placeholder view history (wire real data later)
  const lastView = getPlaceholderLastView(status, ownerNames);

  // Mock prior versions for upload items
  const priorVersions = kind === "upload" ? getPlaceholderPriorVersions(itemKey, status) : [];

  return (
    <dialog
      ref={dialogRef}
      aria-label={`${itemLabel} for ${propertyLabel}`}
      className={css.dialog}
      style={{
        padding: 0,
        border: "none",
        borderRadius: "16px",
        maxWidth: "640px",
        width: "92vw",
        maxHeight: "88vh",
        backgroundColor: "var(--color-white)",
        color: "var(--color-text-primary)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.28), 0 10px 24px rgba(0,0,0,0.14)",
        overflow: "hidden",
      }}
    >
      {/* ── Header: brand gradient ── */}
      <div
        style={{
          padding: "20px 22px 18px",
          background: "linear-gradient(180deg, #02AAEB 0%, #1B77BE 100%)",
          color: "#ffffff",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.75)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            marginBottom: "6px",
          }}
        >
          {kicker}
        </div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            margin: 0,
            lineHeight: 1.2,
            color: "#ffffff",
            paddingRight: "32px",
          }}
        >
          {itemLabel}
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginTop: "6px",
            fontSize: "12.5px",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          <span style={{ fontWeight: 500 }}>{propertyLabel}</span>
          {ownerNames && ownerNames.length > 0 && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <span style={{ fontWeight: 500, opacity: 0.85 }}>
                {ownerNames.join(", ")}
              </span>
            </>
          )}
        </div>

        {/* Status chip + Last-viewed row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              borderRadius: "999px",
              backgroundColor: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.25)",
              fontSize: "11px",
              fontWeight: 700,
              color: "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              backdropFilter: "blur(6px)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "2px",
                backgroundColor: cfg.bg,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.18)",
              }}
            />
            {cfg.label}
          </span>

          {lastView && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "3px 10px",
                borderRadius: "999px",
                backgroundColor: "rgba(0,0,0,0.18)",
                border: "1px solid rgba(255,255,255,0.15)",
                fontSize: "11px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.88)",
              }}
              title={`Viewed ${lastView.count ?? 1}×`}
            >
              <Eye size={11} weight="bold" />
              Last viewed by {lastView.viewedBy} · {formatRelativeShort(lastView.viewedAt)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            width: "30px",
            height: "30px",
            border: "none",
            borderRadius: "8px",
            backgroundColor: "rgba(255,255,255,0.16)",
            color: "#ffffff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "background-color 120ms ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.28)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.16)"; }}
        >
          <X size={15} weight="bold" />
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "20px 22px", maxHeight: "58vh", overflowY: "auto" }}>
        {kind === "upload" && (
          <UploadBody docs={documents} priorVersions={priorVersions} />
        )}
        {kind === "form" && <FormBody itemKey={itemKey} />}
        {kind === "summary" && <SummaryBody itemKey={itemKey} />}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: "12px 22px 18px",
          borderTop: "1px solid var(--color-warm-gray-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          backgroundColor: "var(--color-warm-gray-50)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "var(--color-text-tertiary)",
            fontStyle: "italic",
          }}
        >
          {kind === "summary" ? "Live data wiring coming soon" : "Storage wiring coming soon"}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid var(--color-warm-gray-200)",
              backgroundColor: "var(--color-white)",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          {kind !== "summary" && (
            <button
              type="button"
              disabled
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(180deg, #02AAEB 0%, #1B77BE 100%)",
                fontSize: "13px",
                fontWeight: 700,
                color: "#ffffff",
                cursor: "not-allowed",
                opacity: 0.55,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 1px 2px rgba(2, 170, 235, 0.2)",
              }}
            >
              {kind === "form" ? <PencilSimple size={14} weight="bold" /> : <CloudArrowUp size={14} weight="bold" />}
              {kind === "form" ? "Save form" : documents.length > 0 ? "Upload new version" : "Upload"}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

/* ─── Upload body (dropzone + current + prior versions) ─── */

function UploadBody({
  docs,
  priorVersions,
}: {
  docs: DocumentRecord[];
  priorVersions: DocumentRecord[];
}) {
  const hasCurrent = docs.length > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {hasCurrent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SectionLabel>Current</SectionLabel>
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} highlight />
          ))}
        </div>
      ) : (
        <EmptyDropzone />
      )}

      {priorVersions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <SectionLabel>
            <ClockCounterClockwise size={12} weight="bold" style={{ opacity: 0.7 }} />
            Previous versions
          </SectionLabel>
          {priorVersions.map((d) => (
            <DocumentRow key={d.id} doc={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyDropzone() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "34px 20px",
        borderRadius: "14px",
        border: "2px dashed var(--color-warm-gray-200)",
        backgroundColor: "var(--color-warm-gray-50)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "999px",
          background: "linear-gradient(180deg, rgba(2,170,235,0.14), rgba(27,119,190,0.12))",
          border: "1px solid rgba(2,170,235,0.25)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#02AAEB",
        }}
      >
        <CloudArrowUp size={22} weight="duotone" />
      </div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.01em",
        }}
      >
        No document uploaded yet
      </div>
      <div
        style={{
          fontSize: "12px",
          color: "var(--color-text-tertiary)",
          lineHeight: 1.5,
          maxWidth: "340px",
        }}
      >
        Drag a file here or click Upload. PDF, JPG, PNG up to 10 MB.
      </div>
    </div>
  );
}

function DocumentRow({ doc, highlight = false }: { doc: DocumentRecord; highlight?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        borderRadius: "10px",
        border: `1px solid ${highlight ? "rgba(2,170,235,0.35)" : "var(--color-warm-gray-200)"}`,
        backgroundColor: highlight ? "rgba(2,170,235,0.04)" : "var(--color-white)",
      }}
    >
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "8px",
          backgroundColor: "rgba(2,170,235,0.1)",
          color: "#02AAEB",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FileText size={16} weight="duotone" />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {doc.name}
        </div>
        <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)", marginTop: "1px" }}>
          {formatBytes(doc.sizeBytes)} · Uploaded by {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString()}
        </div>
      </div>
      <button type="button" aria-label="Download" style={iconButtonStyle}>
        <DownloadSimple size={14} weight="bold" />
      </button>
      <button type="button" aria-label="Remove" style={{ ...iconButtonStyle, color: "#dc2626" }}>
        <Trash size={14} weight="bold" />
      </button>
    </div>
  );
}

/* ─── Form body ─── */

function FormBody({ itemKey }: { itemKey: string }) {
  const fields = getFormFields(itemKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: "linear-gradient(180deg, rgba(2,170,235,0.14), rgba(27,119,190,0.12))",
            border: "1px solid rgba(2,170,235,0.25)",
            color: "#02AAEB",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <PencilSimple size={16} weight="duotone" />
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
          This form is filled out here, not uploaded. Changes save directly on this property.
        </div>
      </div>

      {/* Wi-Fi gets a combined "Copy both" button */}
      {itemKey === "wifi_info" && (
        <CopyFormattedBlockButton
          idleLabel="Copy Wi-Fi name + password (formatted)"
          doneLabel="Copied — paste into guidebook or message"
          text={buildWifiCopyBlock(fields)}
        />
      )}

      {/* ACH gets a combined "Copy payout details" button */}
      {itemKey === "ach_authorization" && (
        <CopyFormattedBlockButton
          idleLabel="Copy ACH payout details (formatted)"
          doneLabel="Copied — paste into the payout form"
          text={buildAchCopyBlock(fields)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {fields.map((f) => (
          <FieldRow
            key={f.label}
            label={f.label}
            value={f.value}
            hint={f.hint}
            copyable={f.copyable}
          />
        ))}
      </div>
    </div>
  );
}

/* Generic "copy this formatted block" CTA — used by Wi-Fi and ACH forms */

function CopyFormattedBlockButton({
  idleLabel,
  doneLabel,
  text,
}: {
  idleLabel: string;
  doneLabel: string;
  text: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "10px 14px",
        borderRadius: "10px",
        border: "1px solid rgba(2,170,235,0.3)",
        background: copied
          ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)"
          : "linear-gradient(180deg, rgba(2,170,235,0.08) 0%, rgba(27,119,190,0.06) 100%)",
        color: copied ? "#ffffff" : "#02AAEB",
        fontSize: "13px",
        fontWeight: 700,
        cursor: "pointer",
        transition: "background 140ms ease, color 140ms ease, transform 140ms ease",
      }}
    >
      {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
      {copied ? doneLabel : idleLabel}
    </button>
  );
}

function buildWifiCopyBlock(fields: FormField[]): string {
  const ssid = fields.find((f) => f.label === "Network Name (SSID)")?.value ?? "—";
  const password = fields.find((f) => f.label === "Password")?.value ?? "—";
  return `Wi-Fi Network: ${ssid}\nPassword: ${password}`;
}

function buildAchCopyBlock(fields: FormField[]): string {
  function val(label: string): string {
    return fields.find((f) => f.label === label)?.value ?? "";
  }
  const lines: string[] = [];
  const holder = val("Account Holder Name");
  const entity = val("Business Entity / DBA");
  if (holder) lines.push(`Account Holder: ${holder}`);
  if (entity) lines.push(`Business Entity: ${entity}`);
  const bank = val("Bank Name");
  const acctType = val("Account Type");
  if (bank) lines.push(`Bank: ${bank}`);
  if (acctType) lines.push(`Account Type: ${acctType}`);
  const routing = val("Routing Number");
  const acct = val("Account Number");
  if (routing) lines.push(`Routing Number: ${routing}`);
  if (acct) lines.push(`Account Number: ${acct}`);
  const addr = val("Mailing Address");
  if (addr) lines.push(`Mailing Address: ${addr}`);
  const phone = val("Phone");
  const email = val("Email");
  if (phone) lines.push(`Phone: ${phone}`);
  if (email) lines.push(`Email: ${email}`);
  const taxId = val("Tax ID (EIN or SSN)");
  if (taxId) lines.push(`Tax ID: ${taxId}`);
  return lines.join("\n");
}

type FormField = {
  label: string;
  value?: string;
  hint?: string;
  copyable?: boolean;
};

function FieldRow({ label, value, hint, copyable }: FormField) {
  const [copied, setCopied] = useState(false);
  const hasValue = !!value;

  async function handleCopy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: "6px",
        }}
      >
        <div
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: "8px",
            border: "1px solid var(--color-warm-gray-200)",
            backgroundColor: hasValue ? "var(--color-white)" : "var(--color-warm-gray-50)",
            fontSize: "13px",
            color: hasValue ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
            fontStyle: hasValue ? "normal" : "italic",
            fontWeight: hasValue ? 500 : 400,
            minHeight: "20px",
            fontFamily: copyable
              ? "ui-monospace, SFMono-Regular, Menlo, monospace"
              : "inherit",
            letterSpacing: copyable ? "0.01em" : "normal",
          }}
        >
          {hasValue ? value : hint ?? "—"}
        </div>
        {copyable && hasValue && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${label}`}
            className={css.copyButton}
            style={{
              width: "38px",
              border: "1px solid var(--color-warm-gray-200)",
              borderRadius: "8px",
              backgroundColor: copied ? "#16a34a" : "var(--color-white)",
              color: copied ? "#ffffff" : "var(--color-text-secondary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background-color 140ms ease, color 140ms ease, border-color 140ms ease",
            }}
          >
            {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Summary body ─── */

function SummaryBody({ itemKey }: { itemKey: string }) {
  if (itemKey === "block_dates_calendar") {
    return <BlockDatesSummary />;
  }
  return <GenericSummary itemKey={itemKey} />;
}

function GenericSummary({ itemKey }: { itemKey: string }) {
  const rows = getSummaryRows(itemKey);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: "linear-gradient(180deg, rgba(22,163,74,0.12), rgba(16,133,62,0.10))",
            border: "1px solid rgba(22,163,74,0.25)",
            color: "#16a34a",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Receipt size={16} weight="duotone" />
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
          Read-only summary. Pulled live from our source of truth once wired up.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          border: "1px solid var(--color-warm-gray-200)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--color-warm-gray-100)",
              backgroundColor: i % 2 === 0 ? "var(--color-white)" : "var(--color-warm-gray-50)",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "var(--color-text-tertiary)", fontWeight: 500 }}>
              {r.label}
            </span>
            <span style={{ color: "var(--color-text-primary)", fontWeight: 600, fontStyle: "italic" }}>
              {r.sample}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockDatesSummary() {
  // Placeholder data — split into "Initial" (captured during onboarding) and "Upcoming".
  const initial = [
    { range: "Apr 20 → Apr 24, 2026", reason: "Owner stay", nights: 4 },
    { range: "Jul 10 → Jul 17, 2026", reason: "Family reunion", nights: 7 },
  ];
  const upcoming = [
    { range: "May 10 → May 14, 2026", reason: "Maintenance", nights: 4 },
    { range: "Dec 20 → Jan 3, 2027", reason: "Holiday (owner)", nights: 14 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "8px",
            background: "linear-gradient(180deg, rgba(139,92,246,0.14), rgba(124,58,237,0.10))",
            border: "1px solid rgba(139,92,246,0.28)",
            color: "#8b5cf6",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <CalendarBlank size={16} weight="duotone" />
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--color-text-secondary)", lineHeight: 1.4 }}>
          Blocks captured during onboarding plus any upcoming requests synced from the calendar.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <SectionLabel>Initial block dates (onboarding)</SectionLabel>
        <BlockList items={initial} color="#8b5cf6" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <SectionLabel>
          <ClockCounterClockwise size={12} weight="bold" style={{ opacity: 0.7 }} />
          Upcoming blocks
        </SectionLabel>
        <BlockList items={upcoming} color="#02AAEB" />
      </div>
    </div>
  );
}

function BlockList({
  items,
  color,
}: {
  items: Array<{ range: string; reason: string; nights: number }>;
  color: string;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          padding: "18px 16px",
          borderRadius: "10px",
          border: "1px dashed var(--color-warm-gray-200)",
          textAlign: "center",
          fontSize: "12.5px",
          color: "var(--color-text-tertiary)",
          fontStyle: "italic",
        }}
      >
        No blocks
      </div>
    );
  }
  return (
    <div
      style={{
        border: "1px solid var(--color-warm-gray-200)",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      {items.map((b, i) => (
        <div
          key={b.range}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 14px",
            borderBottom: i === items.length - 1 ? "none" : "1px solid var(--color-warm-gray-100)",
            backgroundColor: i % 2 === 0 ? "var(--color-white)" : "var(--color-warm-gray-50)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "38px",
              borderRadius: "2px",
              background: `linear-gradient(180deg, ${color}ee, ${color}bb)`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-text-primary)" }}>
              {b.range}
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--color-text-tertiary)", marginTop: "1px" }}>
              {b.reason}
            </div>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--color-text-secondary)",
              backgroundColor: "var(--color-warm-gray-100)",
              borderRadius: "999px",
              padding: "3px 9px",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {b.nights}n
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Small shared pieces ─── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "10px",
        fontWeight: 700,
        color: "var(--color-text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </div>
  );
}

/* ─── Per-item definitions (placeholders for real data hooks) ─── */

function getFormFields(itemKey: string): FormField[] {
  switch (itemKey) {
    case "ach_authorization":
      return [
        { label: "Account Holder Name", value: "Cassandra Cyprien", hint: "Legal name on the account", copyable: true },
        { label: "Business Entity / DBA", value: "Cyprien Holdings LLC", hint: "Leave empty if personal account", copyable: true },
        { label: "Bank Name", value: "Relay Financial", hint: "e.g. Chase, Ally, Relay", copyable: true },
        { label: "Account Type", value: "Checking" },
        { label: "Routing Number", value: "084106768", hint: "9-digit ABA routing", copyable: true },
        { label: "Account Number", value: "1234567890", hint: "Encrypted at rest", copyable: true },
        { label: "Mailing Address", value: "524 Sycamore Ave, Unit B, Pasco, WA 99301", copyable: true },
        { label: "Phone", value: "(509) 555-0142", copyable: true },
        { label: "Email", value: "cassy@cyprien.co", copyable: true },
        { label: "Tax ID (EIN or SSN)", value: "12-3456789", hint: "EIN for business, SSN for personal", copyable: true },
        { label: "Signed Date", value: "Mar 18, 2026" },
      ];
    case "card_authorization":
      return [
        { label: "Cardholder Name", value: "Cassandra Cyprien", copyable: true },
        { label: "Card Brand", value: "Visa" },
        { label: "Card Number", value: "4242 4242 4242 4242", copyable: true },
        { label: "Expiration Date", value: "08/28", copyable: true },
        { label: "Security Code (CVV)", value: "424", hint: "Last 3 digits on the back", copyable: true },
        { label: "Billing ZIP", value: "99301", copyable: true },
        { label: "Billing Address", value: "524 Sycamore Ave, Unit B, Pasco, WA 99301", copyable: true },
      ];
    case "host_rental_agreement":
      return [
        { label: "Agreement Version", value: "v2026-01" },
        { label: "Effective Date", value: "Mar 18, 2026" },
        { label: "Term Length", value: "Month-to-month", hint: "Months or 'month-to-month'" },
        { label: "Revenue Split", value: "80% owner / 20% Proxy" },
      ];
    case "property_setup_form":
      return [
        { label: "Beds / Baths / Sleeps", value: "3 bed · 2 bath · sleeps 6" },
        { label: "Parking Details", value: "Driveway for 2 cars + street parking (no permit required)" },
        { label: "Access Method", value: "Keypad at front door (Schlage Encode)" },
        { label: "Keypad / Lockbox Code", value: "4271", copyable: true },
        { label: "Backup Lockbox Location", value: "Side gate, mounted on the fence post (code same as keypad)" },
        { label: "Garage / Smart Lock Notes", value: "Garage via MyQ — not for guest use" },
        { label: "Garbage / Recycle Day", value: "Tuesdays (wheel bins back by Wed)" },
        { label: "HVAC Filter Size", value: "16 × 25 × 1 — replace quarterly" },
        { label: "Water Shutoff", value: "Utility closet next to laundry" },
        { label: "Breaker Panel Location", value: "Garage — east wall" },
        { label: "HOA Rules", value: "Quiet hours 10 PM–7 AM · No pets over 40 lbs · No street parking 2–5 AM" },
      ];
    case "wifi_info":
      return [
        { label: "Network Name (SSID)", value: "ProxyHouse-524", copyable: true },
        { label: "Password", value: "SycamoreSun2026!", hint: "Shared with guests via guidebook", copyable: true },
        { label: "Router Location", value: "Utility closet, top shelf" },
      ];
    case "guidebook_recommendations":
      return [
        { label: "Local Coffee Spots", value: "Frost Me Sweet Bistro, Barracuda Coffee, The Local Scoop" },
        { label: "Dinner Picks", value: "Tagaris Winery, Fieldstone, Magill's Catering" },
        { label: "Parks / Outdoors", value: "Columbia Park Trail · Chamna Natural Preserve · Sacagawea State Park" },
        { label: "Grocery", value: "Albertsons (8 min) · Yoke's Fresh Market (6 min)" },
        { label: "Owner-Specific Rules", value: "Please keep noise down after 10 PM. No shoes on the white rug upstairs." },
      ];
    default:
      return [{ label: "Details" }];
  }
}

function getSummaryRows(itemKey: string): Array<{ label: string; sample: string }> {
  switch (itemKey) {
    case "paid_onboarding_fee":
      return [
        { label: "Amount Paid", sample: "$500.00" },
        { label: "Payment Method", sample: "Card ending in 4242" },
        { label: "Brand", sample: "Visa" },
        { label: "Paid On", sample: "Mar 18, 2026" },
        { label: "Invoice #", sample: "INV-00123" },
        { label: "Stripe Charge", sample: "ch_3NxY4F2eZvKYlo2C..." },
      ];
    default:
      return [{ label: "Summary", sample: "—" }];
  }
}

function getPlaceholderLastView(status: ChecklistStatus, ownerNames?: string[]): ViewHistory | null {
  // Fake placeholder: only show a "last viewed" if status implies someone engaged with it
  if (status === "not_started") return null;
  const who = ownerNames?.[0] ?? "Owner";
  // Pretend the newer the status, the more recently viewed
  const daysAgo = status === "completed" ? 1 : status === "stuck" ? 9 : 3;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    viewedBy: who,
    viewedAt: d.toISOString(),
    count: status === "completed" ? 4 : 2,
  };
}

function getPlaceholderPriorVersions(itemKey: string, status: ChecklistStatus): DocumentRecord[] {
  if (status !== "completed" && status !== "in_progress") return [];
  // Only show prior versions on items where "new versions" are realistic.
  if (itemKey !== "w9_form" && itemKey !== "identity_verification") return [];
  const d = new Date();
  d.setMonth(d.getMonth() - 7);
  return [
    {
      id: "v1",
      name: itemKey === "w9_form" ? "W9-2025.pdf" : "DL-expired-2025.jpg",
      sizeBytes: 184_320,
      uploadedAt: d.toISOString(),
      uploadedBy: "Cassandra C.",
    },
  ];
}

/* ─── Utilities ─── */

const iconButtonStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  border: "1px solid var(--color-warm-gray-200)",
  borderRadius: "6px",
  backgroundColor: "var(--color-white)",
  color: "var(--color-text-secondary)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeShort(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 14) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
