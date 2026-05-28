"use client";

import {
  Buildings,
  Plus,
  CaretDown,
  Eye,
  EyeSlash,
  CheckCircle,
  UploadSimple,
  X,
  FilePdf,
} from "@phosphor-icons/react";
import { useState, useRef, useCallback } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { PropertyReceiptGroup } from "./BillingTab";
import type { WorkspaceFinancialReceipt } from "@/lib/admin/workspace-billing";
import { analyzeReceiptDraft, createReceipt } from "./financials-actions";
import type { ReceiptDraftAnalysis } from "./financials-actions";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import styles from "./BillingTab.module.css";

// ── Constants ────────────────────────────────────────────────────────────────

const RECEIPT_CATEGORIES: SelectOption[] = [
  { value: "Repairs", label: "Repairs" },
  { value: "Cleaning", label: "Cleaning" },
  { value: "Utilities", label: "Utilities" },
  { value: "Supplies", label: "Supplies" },
  { value: "Insurance", label: "Insurance" },
  { value: "Taxes", label: "Taxes" },
  { value: "Software", label: "Software" },
  { value: "Professional services", label: "Professional services" },
  { value: "Mortgage", label: "Mortgage" },
  { value: "Owner expense", label: "Owner expense" },
];

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_SIZE = 10 * 1024 * 1024;

// ── Types ────────────────────────────────────────────────────────────────────

type FileFields = {
  vendor: string;
  amount: string;
  category: string;
  purchaseDate: string;
  propertyId: string | null;
  ownerVisible: boolean;
  notes: string;
};

type ProcessingFile = {
  id: string;
  file: File;
  previewUrl: string | null;
  status: "processing" | "extracted" | "error";
  errorMessage?: string;
  analysis?: ReceiptDraftAnalysis;
  fields: FileFields;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFields(properties: { id: string }[]): FileFields {
  return {
    vendor: "",
    amount: "",
    category: "Owner expense",
    purchaseDate: todayDate(),
    propertyId: properties.length === 1 ? (properties[0]?.id ?? null) : null,
    ownerVisible: true,
    notes: "",
  };
}

// ── Main component ───────────────────────────────────────────────────────────

export function PropertyBillsSection({
  groups,
  totalReceiptCents,
  totalReceiptCount,
  properties,
  ownerId,
  workspaceId,
}: {
  groups: PropertyReceiptGroup[];
  totalReceiptCents: number;
  totalReceiptCount: number;
  properties: { id: string; label: string }[];
  ownerId: string | null;
  workspaceId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const first = groups[0]?.label ?? null;
    return first ? new Set([first]) : new Set();
  });

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [batchFlash, setBatchFlash] = useState<string | null>(null);

  // Receipt hover preview — position: fixed to escape overflow: hidden on billsList
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<{
    url: string;
    bottom: number;
    right: number;
  } | null>(null);

  const showReceiptPreview = useCallback((url: string, rect: DOMRect) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setReceiptPreview({
        url,
        bottom: window.innerHeight - rect.top + 6,
        right: window.innerWidth - rect.right + 10,
      });
    }, 200);
  }, []);

  const hideReceiptPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setReceiptPreview(null);
  }, []);

  // ── File drop handling ──────────────────────────────────────────────────

  const handleFileDrop = useCallback(
    (rawFiles: File[]) => {
      const allowed = rawFiles.filter(
        (f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE,
      );
      if (allowed.length === 0) return;

      const newEntries: ProcessingFile[] = allowed.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        status: "processing" as const,
        fields: defaultFields(properties),
      }));

      setProcessingFiles((prev) => [...prev, ...newEntries]);

      for (const entry of newEntries) {
        void analyzeReceiptDraft({
          vendor: "",
          category: "Owner expense",
          file: entry.file,
          fileName: entry.file.name,
        })
          .then((result) => {
            setProcessingFiles((prev) =>
              prev.map((pf) => {
                if (pf.id !== entry.id) return pf;
                if (result.ok) {
                  return {
                    ...pf,
                    status: "extracted" as const,
                    analysis: result.analysis,
                    fields: {
                      ...pf.fields,
                      vendor: result.analysis.vendor?.trim() || pf.fields.vendor,
                      amount:
                        result.analysis.amount?.replace(/[$,]/g, "") || pf.fields.amount,
                      purchaseDate:
                        result.analysis.purchaseDate || pf.fields.purchaseDate,
                      category: result.analysis.category || pf.fields.category,
                    },
                  };
                }
                return {
                  ...pf,
                  status: "error" as const,
                  errorMessage: "Extraction failed. Fill fields manually.",
                };
              }),
            );
          })
          .catch(() => {
            setProcessingFiles((prev) =>
              prev.map((pf) =>
                pf.id === entry.id
                  ? { ...pf, status: "error" as const, errorMessage: "Extraction failed." }
                  : pf,
              ),
            );
          });
      }
    },
    [properties],
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileDrop(Array.from(e.dataTransfer.files));
  };
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileDrop(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  // ── Field updates ───────────────────────────────────────────────────────

  const updateFileField = useCallback(
    <K extends keyof FileFields>(id: string, key: K, value: FileFields[K]) => {
      setProcessingFiles((prev) =>
        prev.map((pf) =>
          pf.id === id ? { ...pf, fields: { ...pf.fields, [key]: value } } : pf,
        ),
      );
    },
    [],
  );

  const discardFile = useCallback((id: string) => {
    setProcessingFiles((prev) => {
      const entry = prev.find((pf) => pf.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((pf) => pf.id !== id);
    });
  }, []);

  const discardAll = useCallback(() => {
    setProcessingFiles((prev) => {
      prev.forEach((pf) => {
        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
      });
      return [];
    });
  }, []);

  // ── Save all ────────────────────────────────────────────────────────────

  const handleSaveAll = async () => {
    if (!ownerId || isSaving) return;

    const savable = processingFiles.filter((pf) => {
      const amount = Number(pf.fields.amount);
      return Number.isFinite(amount) && amount > 0 && pf.fields.vendor.trim().length > 0;
    });

    if (savable.length === 0) return;
    setIsSaving(true);

    let savedCount = 0;
    let totalCents = 0;

    await Promise.all(
      savable.map(async (pf) => {
        const amount = Number(pf.fields.amount);
        const result = await createReceipt(ownerId, {
          workspaceId,
          vendor: pf.fields.vendor.trim(),
          amount,
          category: pf.fields.category,
          purchaseDate: pf.fields.purchaseDate,
          propertyId: pf.fields.propertyId ?? undefined,
          visibility: pf.fields.ownerVisible ? "visible" : "private",
          file: pf.file,
          notes: pf.fields.notes.trim() || undefined,
          analysis: pf.analysis ?? undefined,
          analysisSource: pf.status === "extracted" ? "document" : undefined,
        });
        if (result.ok) {
          savedCount++;
          totalCents += Math.round(amount * 100);
        }
      }),
    );

    processingFiles.forEach((pf) => {
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
    });

    setProcessingFiles([]);
    setIsSaving(false);
    setIsIntakeOpen(false);

    if (savedCount > 0) {
      const totalFormatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(totalCents / 100);
      setBatchFlash(
        `${savedCount} receipt${savedCount === 1 ? "" : "s"} saved · ${totalFormatted} total`,
      );
      setTimeout(() => setBatchFlash(null), 3000);
    }

    router.refresh();
  };

  // ── Property group toggle ───────────────────────────────────────────────

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const readyToSave = processingFiles.filter((pf) => {
    const amount = Number(pf.fields.amount);
    return Number.isFinite(amount) && amount > 0 && pf.fields.vendor.trim().length > 0;
  }).length;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section aria-label="Bills by property">
      {/* Hover preview rendered at section root — position: fixed bypasses overflow: hidden */}
      {receiptPreview ? (
        <div
          className={styles.receiptPreviewPopover}
          style={{ bottom: receiptPreview.bottom, right: receiptPreview.right }}
        >
          <img
            src={receiptPreview.url}
            className={styles.receiptPreviewImage}
            alt="Receipt preview"
          />
        </div>
      ) : null}

      {/* Top bar */}
      <div className={styles.billsTopBar}>
        <div className={styles.billsTopBarLeft}>
          <div className={styles.sectionEyebrow}>Bills by property</div>
          {totalReceiptCount > 0 ? (
            <div className={styles.billsMeta}>
              {totalReceiptCount} receipt{totalReceiptCount === 1 ? "" : "s"} ·{" "}
              {formatCents(totalReceiptCents)} total
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.addReceiptButton}
          onClick={() => setIsIntakeOpen((prev) => !prev)}
        >
          <Plus size={14} weight="bold" />
          {isIntakeOpen ? "Close" : "Add receipt"}
        </button>
      </div>

      {/* Batch flash banner */}
      {batchFlash ? (
        <div className={styles.batchFlash}>
          <CheckCircle size={14} weight="fill" />
          {batchFlash}
        </div>
      ) : null}

      {/* Intake panel */}
      {isIntakeOpen ? (
        <div className={styles.intakePanel}>
          {/* Drop zone */}
          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload receipts"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              multiple
              hidden
              onChange={handleFileInput}
            />
            <UploadSimple size={26} weight="duotone" className={styles.dropZoneIcon} />
            <span className={styles.dropZoneLabel}>
              Drop receipts here or click to select
            </span>
            <span className={styles.dropZoneHint}>
              PDF, JPG, PNG, WebP · max 10 MB each · multiple files supported
            </span>
          </div>

          {/* Batch grid */}
          {processingFiles.length > 0 ? (
            <>
              <div className={styles.batchGrid}>
                {processingFiles.map((pf) => (
                  <BatchCard
                    key={pf.id}
                    file={pf}
                    properties={properties}
                    onFieldChange={updateFileField}
                    onDiscard={discardFile}
                  />
                ))}
              </div>
              <div className={styles.batchSaveBar}>
                <span className={styles.batchSaveCount}>
                  {processingFiles.length} file{processingFiles.length === 1 ? "" : "s"} ·{" "}
                  {readyToSave} ready to save
                </span>
                <div className={styles.batchSaveButtons}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={discardAll}
                    disabled={isSaving}
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleSaveAll()}
                    disabled={isSaving || readyToSave === 0 || !ownerId}
                  >
                    {isSaving
                      ? "Saving..."
                      : `Save ${readyToSave} receipt${readyToSave === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Property groups */}
      {groups.length === 0 ? (
        <div className={styles.billsEmptyState}>
          <Buildings size={20} weight="duotone" className={styles.billsEmptyIcon} />
          <div>
            <strong>No receipts yet</strong>
            <span>Upload a receipt above to get started. Receipts are grouped by property.</span>
          </div>
        </div>
      ) : (
        <div className={styles.billsList}>
          {groups.map((group) => {
            const isOpen = openGroups.has(group.label);
            return (
              <div key={group.label} className={styles.propertyGroup}>
                <button
                  type="button"
                  className={styles.propertyGroupHeader}
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                >
                  <div className={styles.propertyGroupLeft}>
                    <span
                      className={`${styles.propertyDot} ${group.id === null ? styles.propertyDotUnassigned : ""}`}
                    />
                    <span
                      className={`${styles.propertyName} ${group.id === null ? styles.propertyNameUnassigned : ""}`}
                    >
                      {group.label}
                    </span>
                    <span className={styles.propertyCount}>
                      {group.receipts.length} receipt{group.receipts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className={styles.propertyGroupRight}>
                    <span className={styles.propertyTotal}>
                      {formatCents(group.totalCents)}
                    </span>
                    <CaretDown
                      size={13}
                      weight="bold"
                      className={`${styles.propertyChevron} ${isOpen ? styles.propertyChevronOpen : ""}`}
                    />
                  </div>
                </button>
                {isOpen ? (
                  <div className={styles.receiptList}>
                    {group.receipts.map((receipt) => (
                      <ReceiptRow
                        key={receipt.id}
                        receipt={receipt}
                        onShowPreview={showReceiptPreview}
                        onHidePreview={hideReceiptPreview}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── BatchCard sub-component ──────────────────────────────────────────────────

function BatchCard({
  file,
  properties,
  onFieldChange,
  onDiscard,
}: {
  file: ProcessingFile;
  properties: { id: string; label: string }[];
  onFieldChange: <K extends keyof FileFields>(id: string, key: K, value: FileFields[K]) => void;
  onDiscard: (id: string) => void;
}) {
  const isProcessing = file.status === "processing";

  return (
    <div className={`${styles.batchCard} ${isProcessing ? styles.batchCardProcessing : ""}`}>
      {/* Thumbnail */}
      <div className={styles.batchCardThumb}>
        {file.previewUrl ? (
          <>
            <img
              src={file.previewUrl}
              className={styles.batchCardThumbImage}
              alt={file.file.name}
            />
            {isProcessing ? (
              <div className={styles.batchCardThumbOverlay}>
                <div className={styles.batchCardSpinner} />
              </div>
            ) : null}
          </>
        ) : isProcessing ? (
          <div className={styles.batchCardSpinner} />
        ) : (
          <FilePdf size={28} weight="duotone" className={styles.batchCardPdfIcon} />
        )}
      </div>

      {/* Fields */}
      <div className={styles.batchCardBody}>
        {file.status === "error" ? (
          <div className={styles.batchCardError}>
            {file.errorMessage ?? "Extraction failed. Fill fields manually."}
          </div>
        ) : null}

        <label className={styles.field}>
          <span>Vendor</span>
          <input
            className={styles.textInput}
            value={file.fields.vendor}
            onChange={(e) => onFieldChange(file.id, "vendor", e.target.value)}
            placeholder="Home Depot"
          />
        </label>

        <label className={styles.field}>
          <span>Amount</span>
          <input
            className={styles.textInput}
            value={file.fields.amount}
            onChange={(e) => onFieldChange(file.id, "amount", e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>

        <div className={styles.field}>
          <span>Category</span>
          <CustomSelect
            value={file.fields.category}
            onChange={(v) => onFieldChange(file.id, "category", v)}
            options={RECEIPT_CATEGORIES}
          />
        </div>

        <div className={styles.field}>
          <span>Date</span>
          <DatePickerInput
            value={file.fields.purchaseDate}
            onChange={(v) => onFieldChange(file.id, "purchaseDate", v)}
          />
        </div>

        {properties.length > 0 ? (
          <div className={styles.intakePropertyRow}>
            <span>Property</span>
            <div className={styles.intakePropertyButtons}>
              <button
                type="button"
                className={`${styles.propertyChip} ${file.fields.propertyId === null ? styles.propertyChipActive : ""}`}
                onClick={() => onFieldChange(file.id, "propertyId", null)}
              >
                Workspace-wide
              </button>
              {properties.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.propertyChip} ${file.fields.propertyId === p.id ? styles.propertyChipActive : ""}`}
                  onClick={() => onFieldChange(file.id, "propertyId", p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className={styles.intakeVisibilityToggle}>
          <input
            type="checkbox"
            checked={file.fields.ownerVisible}
            onChange={(e) => onFieldChange(file.id, "ownerVisible", e.target.checked)}
          />
          <span>
            {file.fields.ownerVisible ? (
              <Eye size={13} weight="bold" />
            ) : (
              <EyeSlash size={13} weight="bold" />
            )}
            {file.fields.ownerVisible ? "Visible to owner" : "Admin only"}
          </span>
        </label>
      </div>

      {/* Discard */}
      <div className={styles.batchCardActions}>
        <button
          type="button"
          className={styles.batchCardDiscard}
          onClick={() => onDiscard(file.id)}
          title="Discard this receipt"
        >
          <X size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
}

// ── ReceiptRow sub-component ─────────────────────────────────────────────────

function ReceiptRow({
  receipt,
  onShowPreview,
  onHidePreview,
}: {
  receipt: WorkspaceFinancialReceipt;
  onShowPreview: (url: string, rect: DOMRect) => void;
  onHidePreview: () => void;
}) {
  return (
    <div
      className={styles.receiptRow}
      onMouseEnter={
        receipt.imageUrl
          ? (e) => onShowPreview(receipt.imageUrl!, e.currentTarget.getBoundingClientRect())
          : undefined
      }
      onMouseLeave={receipt.imageUrl ? onHidePreview : undefined}
    >
      <div className={styles.receiptMain}>
        <span className={styles.receiptVendor}>{receipt.vendor}</span>
        {receipt.category ? (
          <span className={styles.receiptCategory}>{receipt.category}</span>
        ) : null}
      </div>
      <div className={styles.receiptRight}>
        <span className={styles.receiptAmount}>
          {formatCents(receipt.amountCents, receipt.currency)}
        </span>
        {receipt.purchaseDate ? (
          <span className={styles.receiptDate}>{formatDate(receipt.purchaseDate)}</span>
        ) : null}
        <span className={styles.receiptVisibility}>
          {receipt.visibility === "private" ? (
            <EyeSlash size={11} weight="bold" />
          ) : (
            <Eye size={11} weight="bold" />
          )}
        </span>
        {receipt.imageUrl ? (
          <a
            href={receipt.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.receiptFileLink}
          >
            File
          </a>
        ) : null}
      </div>
    </div>
  );
}
