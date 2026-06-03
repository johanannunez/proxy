"use client";

import {
  Buildings,
  Plus,
  CaretDown,
  CaretRight,
  Eye,
  EyeSlash,
  CheckCircle,
  UploadSimple,
  X,
  File as FileIcon,
  FilePdf,
  FolderOpen,
  Warning,
  PaperPlaneTilt,
  Receipt,
  MagnifyingGlass,
  ArrowDown,
  ArrowUp,
} from "@phosphor-icons/react";
import { useState, useRef, useCallback, useEffect } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  ReceiptClaimProvider,
  ReceiptPaymentSource,
  ReceiptReimbursementStatus,
  WorkspaceFinancialReceipt,
} from "@/lib/admin/workspace-finance";
import { analyzeReceiptDraft, createReceipt, updateReceipt } from "./financials-actions";
import type { ReceiptDraftAnalysis } from "./financials-actions";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import styles from "./FinanceTab.module.css";

export type PropertyReceiptGroup = {
  id: string | null;
  label: string;
  receipts: WorkspaceFinancialReceipt[];
  totalCents: number;
};

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

const PAYMENT_SOURCE_OPTIONS: SelectOption[] = [
  { value: "owner_card", label: "Owner card" },
  { value: "company_card", label: "Company card" },
  { value: "owner_paid", label: "Owner paid directly" },
  { value: "vendor_invoice", label: "Vendor invoice" },
  { value: "airbnb_claim", label: "Airbnb claim" },
  { value: "insurance_claim", label: "Insurance claim" },
  { value: "other", label: "Other" },
];

const REIMBURSEMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: "none", label: "No reimbursement" },
  { value: "reimbursement_needed", label: "Reimbursement needed" },
  { value: "claim_needed", label: "Claim needed" },
  { value: "claim_submitted", label: "Claim submitted" },
  { value: "reimbursed", label: "Reimbursed" },
  { value: "denied_writeoff", label: "Denied / write-off" },
];

const CLAIM_PROVIDER_OPTIONS: SelectOption[] = [
  { value: "airbnb", label: "Airbnb" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

export const PAYMENT_SOURCE_LABELS: Record<ReceiptPaymentSource, string> = {
  owner_card: "Owner card",
  company_card: "Company card",
  owner_paid: "Owner paid",
  vendor_invoice: "Vendor invoice",
  airbnb_claim: "Airbnb claim",
  insurance_claim: "Insurance claim",
  other: "Other",
};

export const REIMBURSEMENT_STATUS_LABELS: Record<ReceiptReimbursementStatus, string> = {
  none: "No reimbursement",
  reimbursement_needed: "Reimbursement needed",
  claim_needed: "Claim needed",
  claim_submitted: "Claim submitted",
  reimbursed: "Reimbursed",
  denied_writeoff: "Denied / write-off",
};

type FilterBy =
  | "all"
  | "owner_card"
  | "company_card"
  | "reimbursement_needed"
  | "claim_needed"
  | "claim_submitted"
  | "reimbursed";

type GroupBy = "time" | "property" | "vendor" | "category";

const FILTER_OPTIONS: SelectOption[] = [
  { value: "all", label: "All receipts" },
  { value: "owner_card", label: "Owner card" },
  { value: "company_card", label: "Company card" },
  { value: "reimbursement_needed", label: "Reimbursement needed" },
  { value: "claim_needed", label: "Claim needed" },
  { value: "claim_submitted", label: "Claims submitted" },
  { value: "reimbursed", label: "Reimbursed" },
];

const GROUP_OPTIONS: SelectOption[] = [
  { value: "time", label: "By date" },
  { value: "property", label: "By property" },
  { value: "vendor", label: "By vendor" },
  { value: "category", label: "By category" },
];

type ReceiptSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const RECEIPT_SORT_CYCLE: ReceiptSort[] = ["date_desc", "date_asc", "amount_desc", "amount_asc"];

const RECEIPT_SORT_LABELS: Record<ReceiptSort, string> = {
  date_desc: "Date ↓",
  date_asc: "Date ↑",
  amount_desc: "$ ↓",
  amount_asc: "$ ↑",
};

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;

type FileFields = {
  vendor: string;
  amount: string;
  category: string;
  purchaseDate: string;
  propertyId: string | null;
  ownerVisible: boolean;
  notes: string;
  lineItems: ReceiptLineItem[];
  paymentSource: ReceiptPaymentSource;
  reimbursementStatus: ReceiptReimbursementStatus;
  claimProvider: ReceiptClaimProvider | null;
  claimReference: string;
  reimbursedAt: string;
};

type ReceiptLineItem = {
  id: string;
  label: string;
  amount: string;
};

type ProcessingFile = {
  id: string;
  file: File;
  previewUrl: string;
  status: "processing" | "extracted" | "error";
  errorMessage?: string;
  analysis?: ReceiptDraftAnalysis;
  fields: FileFields;
};

type MonthGroup = {
  key: string;
  label: string;
  receipts: WorkspaceFinancialReceipt[];
  totalCents: number;
};

type YearGroup = {
  year: number;
  months: MonthGroup[];
  totalCents: number;
};

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDateShort(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function lineItemId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLineItemAmount(value: string | undefined): string {
  return value?.replace(/[$,]/g, "").trim() ?? "";
}

function formatLineItemAmount(amount: string | null, currency: string): string | null {
  if (!amount) return null;
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return formatCents(Math.round(value * 100), currency);
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
    lineItems: [],
    paymentSource: "owner_card",
    reimbursementStatus: "none",
    claimProvider: null,
    claimReference: "",
    reimbursedAt: "",
  };
}

function buildTimeGroups(receipts: WorkspaceFinancialReceipt[]): YearGroup[] {
  const yearMap = new Map<number, Map<string, MonthGroup>>();

  for (const receipt of receipts) {
    const date = new Date(`${receipt.purchaseDate}T12:00:00`);
    const valid = !Number.isNaN(date.getTime());
    const year = valid ? date.getFullYear() : 0;
    const monthKey = valid
      ? `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : "0000-00";
    const monthLabel = valid
      ? date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "Unknown date";

    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const monthMap = yearMap.get(year)!;
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { key: monthKey, label: monthLabel, receipts: [], totalCents: 0 });
    }
    const group = monthMap.get(monthKey)!;
    group.receipts.push(receipt);
    group.totalCents += receipt.amountCents;
  }

  return Array.from(yearMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([year, monthMap]) => {
      const months = Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));
      return { year, months, totalCents: months.reduce((sum, m) => sum + m.totalCents, 0) };
    });
}

function groupFlatReceipts(
  receipts: WorkspaceFinancialReceipt[],
  getLabel: (r: WorkspaceFinancialReceipt) => string,
): PropertyReceiptGroup[] {
  const map = new Map<string, PropertyReceiptGroup>();
  for (const receipt of receipts) {
    const label = getLabel(receipt);
    const existing = map.get(label);
    if (existing) {
      existing.receipts.push(receipt);
      existing.totalCents += receipt.amountCents;
    } else {
      map.set(label, { id: null, label, receipts: [receipt], totalCents: receipt.amountCents });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}

function actionForStatus(
  status: ReceiptReimbursementStatus,
): { label: string; nextStatus: ReceiptReimbursementStatus; reimbursedAt?: string } | null {
  if (status === "claim_needed") return { label: "Mark submitted", nextStatus: "claim_submitted" };
  if (status === "claim_submitted" || status === "reimbursement_needed") {
    return { label: "Mark reimbursed", nextStatus: "reimbursed", reimbursedAt: new Date().toISOString() };
  }
  return null;
}

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
  const dragDepthRef = useRef(0);
  const processingFilesRef = useRef<ProcessingFile[]>([]);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const first = groups[0]?.label ?? null;
    return first ? new Set([first]) : new Set();
  });

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [batchFlash, setBatchFlash] = useState<string | null>(null);
  const [intakeNotice, setIntakeNotice] = useState<string | null>(null);
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("time");
  const [searchQuery, setSearchQuery] = useState("");
  const [monthSortDir, setMonthSortDir] = useState<"desc" | "asc">("desc");
  const [receiptSort, setReceiptSort] = useState<ReceiptSort>("date_desc");

  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);
  const [movementMessage, setMovementMessage] = useState<string | null>(null);

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<{
    url: string;
    bottom: number;
    right: number;
  } | null>(null);

  const showReceiptPreview = useCallback((url: string, rect: DOMRect) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setReceiptPreview({ url, bottom: window.innerHeight - rect.top + 6, right: window.innerWidth - rect.right + 10 });
    }, 200);
  }, []);

  const hideReceiptPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setReceiptPreview(null);
  }, []);

  useEffect(() => {
    processingFilesRef.current = processingFiles;
  }, [processingFiles]);

  useEffect(() => {
    return () => {
      processingFilesRef.current.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
    };
  }, []);

  const handleFileDrop = useCallback(
    (rawFiles: File[]) => {
      const rejected = rawFiles.filter((f) => !ALLOWED_TYPES.includes(f.type) || f.size > MAX_SIZE);
      const allowed = rawFiles.filter((f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE);

      if (rejected.length > 0) {
        setIntakeNotice(`${rejected.length} file${rejected.length === 1 ? "" : "s"} skipped. Use PDF, JPG, PNG, or WebP under 10 MB.`);
      } else if (allowed.length > 0) {
        setIntakeNotice(null);
      }

      if (allowed.length === 0) return;

      const newEntries: ProcessingFile[] = allowed.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "processing" as const,
        fields: defaultFields(properties),
      }));

      setProcessingFiles((prev) => [...prev, ...newEntries]);
      setSelectedFileId((current) => current ?? newEntries[0]?.id ?? null);

      for (const entry of newEntries) {
        void analyzeReceiptDraft({ vendor: "", category: "Owner expense", file: entry.file, fileName: entry.file.name })
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
                      amount: result.analysis.amount?.replace(/[$,]/g, "") || pf.fields.amount,
                      purchaseDate: result.analysis.purchaseDate || pf.fields.purchaseDate,
                      category: result.analysis.category || pf.fields.category,
                      notes: result.analysis.summary || pf.fields.notes,
                      lineItems: result.analysis.lineItems?.map((item) => ({
                        id: lineItemId(),
                        label: item.label,
                        amount: normalizeLineItemAmount(item.amount),
                      })) ?? pf.fields.lineItems,
                      paymentSource: result.analysis.paymentSource ?? pf.fields.paymentSource,
                      reimbursementStatus: result.analysis.reimbursementStatus ?? pf.fields.reimbursementStatus,
                      claimProvider: result.analysis.claimProvider ?? pf.fields.claimProvider,
                      claimReference: result.analysis.claimReference ?? pf.fields.claimReference,
                      reimbursedAt: result.analysis.reimbursedAt ?? pf.fields.reimbursedAt,
                    },
                  };
                }
                return { ...pf, status: "error" as const, errorMessage: "Extraction failed. Fill fields manually." };
              }),
            );
          })
          .catch(() => {
            setProcessingFiles((prev) =>
              prev.map((pf) =>
                pf.id === entry.id ? { ...pf, status: "error" as const, errorMessage: "Extraction failed." } : pf,
              ),
            );
          });
      }
    },
    [properties],
  );

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); };
  const handleDragLeave = () => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragOver(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    handleFileDrop(Array.from(e.dataTransfer.files));
  };
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileDrop(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const updateFileField = useCallback(
    <K extends keyof FileFields>(id: string, key: K, value: FileFields[K]) => {
      setProcessingFiles((prev) =>
        prev.map((pf) => pf.id === id ? { ...pf, fields: { ...pf.fields, [key]: value } } : pf),
      );
    },
    [],
  );

  const discardFile = useCallback((id: string) => {
    setProcessingFiles((prev) => {
      const entry = prev.find((pf) => pf.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((pf) => pf.id !== id);
    });
    setSelectedFileId((current) => {
      if (current !== id) return current;
      const remaining = processingFiles.filter((pf) => pf.id !== id);
      return remaining[0]?.id ?? null;
    });
  }, [processingFiles]);

  const discardAll = useCallback(() => {
    setProcessingFiles((prev) => {
      prev.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
      return [];
    });
    setSelectedFileId(null);
  }, []);

  const addLineItem = useCallback((id: string) => {
    setProcessingFiles((prev) =>
      prev.map((pf) =>
        pf.id === id
          ? {
              ...pf,
              fields: {
                ...pf.fields,
                lineItems: [...pf.fields.lineItems, { id: lineItemId(), label: "", amount: "" }],
              },
            }
          : pf,
      ),
    );
  }, []);

  const updateLineItem = useCallback(
    (fileId: string, itemId: string, key: "label" | "amount", value: string) => {
      setProcessingFiles((prev) =>
        prev.map((pf) =>
          pf.id === fileId
            ? {
                ...pf,
                fields: {
                  ...pf.fields,
                  lineItems: pf.fields.lineItems.map((item) =>
                    item.id === itemId ? { ...item, [key]: value } : item,
                  ),
                },
              }
            : pf,
        ),
      );
    },
    [],
  );

  const removeLineItem = useCallback((fileId: string, itemId: string) => {
    setProcessingFiles((prev) =>
      prev.map((pf) =>
        pf.id === fileId
          ? {
              ...pf,
              fields: {
                ...pf.fields,
                lineItems: pf.fields.lineItems.filter((item) => item.id !== itemId),
              },
            }
          : pf,
      ),
    );
  }, []);

  const handleSaveAll = async () => {
    if (!ownerId || isSaving) return;
    const savable = processingFiles.filter((pf) => {
      const amount = Number(pf.fields.amount);
      return Number.isFinite(amount) && amount > 0 && pf.fields.vendor.trim().length > 0;
    });
    if (savable.length === 0) return;
    setIsSaving(true);

    const savedIds = new Set<string>();
    let totalCents = 0;

    const results = await Promise.all(
      savable.map(async (pf) => {
        const amount = Number(pf.fields.amount);
        const lineItems = pf.fields.lineItems
          .map((item) => ({
            label: item.label.trim(),
            amount: item.amount.trim() || undefined,
          }))
          .filter((item) => item.label.length > 0);
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
          paymentSource: pf.fields.paymentSource,
          reimbursementStatus: pf.fields.reimbursementStatus,
          claimProvider: pf.fields.claimProvider,
          claimReference: pf.fields.claimReference.trim() || null,
          reimbursedAt: pf.fields.reimbursedAt || null,
          lineItems,
        });
        if (result.ok) {
          savedIds.add(pf.id);
          totalCents += Math.round(amount * 100);
        }
        return result;
      }),
    );

    const failedCount = results.filter((result) => !result.ok).length;
    const savedCount = savedIds.size;
    const remainingFiles = processingFiles.filter((pf) => !savedIds.has(pf.id));
    processingFiles
      .filter((pf) => savedIds.has(pf.id))
      .forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
    setProcessingFiles(remainingFiles);
    setIsSaving(false);
    if (remainingFiles.length === 0) {
      setIsIntakeOpen(false);
      setSelectedFileId(null);
    } else {
      setSelectedFileId((current) =>
        current && remainingFiles.some((pf) => pf.id === current)
          ? current
          : remainingFiles[0]?.id ?? null,
      );
    }

    if (savedCount > 0) {
      const totalFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalCents / 100);
      setBatchFlash(`${savedCount} receipt${savedCount === 1 ? "" : "s"} saved · ${totalFormatted} total`);
      setTimeout(() => setBatchFlash(null), 3000);
    }
    if (failedCount > 0) {
      setIntakeNotice(`${failedCount} receipt${failedCount === 1 ? "" : "s"} could not be saved. Review the remaining files and try again.`);
    } else {
      setIntakeNotice(null);
    }
    router.refresh();
  };

  const handleAdvance = async (receipt: WorkspaceFinancialReceipt) => {
    if (!ownerId) return;
    const action = actionForStatus(receipt.reimbursementStatus);
    if (!action) return;
    setPendingReceiptId(receipt.id);
    setMovementMessage(null);
    const result = await updateReceipt(receipt.id, ownerId, {
      workspaceId,
      reimbursementStatus: action.nextStatus,
      reimbursedAt: action.reimbursedAt ?? null,
    });
    setPendingReceiptId(null);
    setMovementMessage(result.ok ? result.message : result.message || "Update failed.");
    if (result.ok) router.refresh();
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const allReceipts = groups.flatMap((g) => g.receipts);

  const filteredReceipts = (() => {
    switch (filterBy) {
      case "owner_card": return allReceipts.filter((r) => r.paymentSource === "owner_card");
      case "company_card": return allReceipts.filter((r) => r.paymentSource === "company_card");
      case "reimbursement_needed": return allReceipts.filter((r) => r.reimbursementStatus === "reimbursement_needed");
      case "claim_needed": return allReceipts.filter((r) => r.reimbursementStatus === "claim_needed");
      case "claim_submitted": return allReceipts.filter((r) => r.reimbursementStatus === "claim_submitted");
      case "reimbursed": return allReceipts.filter((r) => r.reimbursementStatus === "reimbursed");
      default: return allReceipts;
    }
  })();

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const searchResults = isSearching
    ? filteredReceipts.filter((r) =>
        r.vendor.toLowerCase().includes(normalizedQuery) ||
        (r.category ?? "").toLowerCase().includes(normalizedQuery) ||
        (r.propertyLabel ?? "").toLowerCase().includes(normalizedQuery) ||
        (r.notes ?? "").toLowerCase().includes(normalizedQuery),
      )
    : [];

  const sortedSearchResults = (() => {
    const base = [...searchResults];
    switch (receiptSort) {
      case "date_asc": return base.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
      case "amount_desc": return base.sort((a, b) => b.amountCents - a.amountCents);
      case "amount_asc": return base.sort((a, b) => a.amountCents - b.amountCents);
      default: return base.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
    }
  })();

  const timeGroups: YearGroup[] = groupBy === "time" ? buildTimeGroups(filteredReceipts) : [];
  const flatGroups: PropertyReceiptGroup[] = groupBy !== "time" ? (() => {
    switch (groupBy) {
      case "property": return groupFlatReceipts(filteredReceipts, (r) => r.propertyLabel ?? "Workspace-wide");
      case "vendor": return groupFlatReceipts(filteredReceipts, (r) => r.vendor || "Unknown vendor");
      case "category": return groupFlatReceipts(filteredReceipts, (r) => r.category || "Uncategorized");
      default: return groups;
    }
  })() : [];

  const openMovementReceipts = allReceipts.filter((r) =>
    ["reimbursement_needed", "claim_needed", "claim_submitted"].includes(r.reimbursementStatus),
  );

  const readyToSave = processingFiles.filter((pf) => {
    const amount = Number(pf.fields.amount);
    return Number.isFinite(amount) && amount > 0 && pf.fields.vendor.trim().length > 0;
  }).length;

  const hasReceipts = totalReceiptCount > 0;
  const selectedFile = processingFiles.find((pf) => pf.id === selectedFileId) ?? processingFiles[0] ?? null;

  return (
    <section aria-label="Receipts depository">
      {receiptPreview ? (
        <div
          className={styles.receiptPreviewPopover}
          style={{ bottom: receiptPreview.bottom, right: receiptPreview.right }}
        >
          <img src={receiptPreview.url} className={styles.receiptPreviewImage} alt="Receipt preview" />
        </div>
      ) : null}

      <div className={styles.billsTopBar}>
        <div className={styles.billsTopBarLeft}>
          <div className={styles.sectionEyebrow}>Receipts depository</div>
          {hasReceipts ? (
            <div className={styles.billsMeta}>
              {totalReceiptCount} receipt{totalReceiptCount === 1 ? "" : "s"} · {formatCents(totalReceiptCents)} total
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.addReceiptButton}
          onClick={() => setIsIntakeOpen((prev) => !prev)}
        >
          <Plus size={14} weight="bold" />
          {isIntakeOpen ? "Close" : "Upload receipt"}
        </button>
      </div>

      {batchFlash ? (
        <div className={styles.batchFlash}>
          <CheckCircle size={14} weight="fill" />
          {batchFlash}
        </div>
      ) : null}

      {isIntakeOpen ? (
        <div className={styles.intakePanel}>
          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload receipts"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          >
            <input ref={fileInputRef} type="file" accept={ALLOWED_TYPES.join(",")} multiple hidden onChange={handleFileInput} />
            <div className={styles.dropFolderStack} aria-hidden="true">
              <span className={styles.dropFolderBack} />
              <span className={styles.dropFolderFront}>
                <FolderOpen size={30} weight="duotone" />
              </span>
              <span className={styles.dropFolderSheet} />
            </div>
            <div className={styles.dropZoneCopy}>
              <span className={styles.dropZoneLabel}>Drop receipts into the depository</span>
              <span className={styles.dropZoneHint}>PDF, JPG, PNG, WebP. Max 10 MB each. Multiple files supported.</span>
            </div>
            <span className={styles.dropZoneAction}>
              <UploadSimple size={13} weight="bold" />
              Select files
            </span>
          </div>

          {intakeNotice ? (
            <div className={styles.intakeNotice}>
              <Warning size={13} weight="fill" />
              {intakeNotice}
            </div>
          ) : null}

          {processingFiles.length > 0 ? (
            <>
              <div className={styles.intakeWorkbench}>
                <div className={styles.receiptFileTree} aria-label="Staged receipt files">
                  <div className={styles.receiptFileTreeHeader}>
                    <FolderOpen size={14} weight="duotone" />
                    <span>Incoming receipts</span>
                  </div>
                  <div className={styles.receiptFileTreeList}>
                    {processingFiles.map((pf) => {
                      const amount = Number(pf.fields.amount);
                      const isReady = Number.isFinite(amount) && amount > 0 && pf.fields.vendor.trim().length > 0;
                      return (
                        <button
                          key={pf.id}
                          type="button"
                          className={`${styles.receiptFileTreeRow} ${
                            selectedFile?.id === pf.id ? styles.receiptFileTreeRowActive : ""
                          }`}
                          onClick={() => setSelectedFileId(pf.id)}
                        >
                          <span
                            className={`${styles.receiptFileTreeStatus} ${
                              pf.status === "error"
                                ? styles.receiptFileTreeStatusError
                                : isReady
                                  ? styles.receiptFileTreeStatusReady
                                  : ""
                            }`}
                          />
                          <FileIcon size={13} weight="duotone" className={styles.receiptFileTreeIcon} />
                          <span className={styles.receiptFileTreeName}>{pf.file.name}</span>
                          <span className={styles.receiptFileTreeMeta}>
                            {pf.status === "processing" ? "Reading" : isReady ? "Ready" : "Needs fields"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedFile ? (
                  <ReceiptFilePreview file={selectedFile} />
                ) : null}

                {selectedFile ? (
                  <ReceiptAiInspector
                    file={selectedFile}
                    properties={properties}
                    onFieldChange={updateFileField}
                    onAddLineItem={addLineItem}
                    onUpdateLineItem={updateLineItem}
                    onRemoveLineItem={removeLineItem}
                    onDiscard={discardFile}
                  />
                ) : null}
              </div>
              <div className={styles.batchSaveBar}>
                <span className={styles.batchSaveCount}>
                  {processingFiles.length} file{processingFiles.length === 1 ? "" : "s"} · {readyToSave} ready to save
                </span>
                <div className={styles.batchSaveButtons}>
                  <button type="button" className={styles.secondaryButton} onClick={discardAll} disabled={isSaving}>
                    Clear all
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleSaveAll()}
                    disabled={isSaving || readyToSave === 0 || !ownerId}
                  >
                    {isSaving ? "Saving..." : `Save ${readyToSave} receipt${readyToSave === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {openMovementReceipts.length > 0 ? (
        <div className={styles.inlineMovement}>
          <div className={styles.inlineMovementTitle}>
            <Warning size={12} weight="fill" className={styles.inlineMovementIcon} />
            {openMovementReceipts.length} item{openMovementReceipts.length === 1 ? "" : "s"} need{openMovementReceipts.length === 1 ? "s" : ""} attention
          </div>
          {movementMessage ? (
            <div className={styles.inlineMovementFlash}>
              <CheckCircle size={11} weight="fill" />
              {movementMessage}
            </div>
          ) : null}
          {openMovementReceipts.map((receipt) => {
            const action = actionForStatus(receipt.reimbursementStatus);
            return (
              <div key={receipt.id} className={styles.inlineMovementRow}>
                <div className={styles.inlineMovementLeft}>
                  <span className={styles.inlineMovementVendor}>{receipt.vendor}</span>
                  <span className={styles.inlineMovementMeta}>
                    {receipt.propertyLabel ?? "Workspace-wide"} · {formatDateShort(receipt.purchaseDate)}
                  </span>
                  <span className={styles.inlineMovementPill}>
                    {REIMBURSEMENT_STATUS_LABELS[receipt.reimbursementStatus]}
                  </span>
                </div>
                <div className={styles.inlineMovementRight}>
                  <span className={styles.inlineMovementAmount}>{formatCents(receipt.amountCents, receipt.currency)}</span>
                  {action ? (
                    <button
                      type="button"
                      className={styles.inlineMovementAction}
                      onClick={() => void handleAdvance(receipt)}
                      disabled={pendingReceiptId === receipt.id || !ownerId}
                    >
                      <PaperPlaneTilt size={11} weight="bold" />
                      {pendingReceiptId === receipt.id ? "..." : action.label}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {hasReceipts ? (
        <div className={styles.receiptFilterBar}>
          <div className={styles.receiptFilterDropdowns}>
            <CustomSelect
              value={filterBy}
              onChange={(v) => setFilterBy(v as FilterBy)}
              options={FILTER_OPTIONS}
            />
            <CustomSelect
              value={groupBy}
              onChange={(v) => setGroupBy(v as GroupBy)}
              options={GROUP_OPTIONS}
            />
          </div>
          <span className={styles.receiptFilterCount}>
            {isSearching
              ? `${searchResults.length} result${searchResults.length === 1 ? "" : "s"}`
              : `${filteredReceipts.length} receipt${filteredReceipts.length === 1 ? "" : "s"}`}
          </span>
        </div>
      ) : null}

      {hasReceipts ? (
        <div className={styles.receiptSearchRow}>
          <div className={styles.receiptSearchWrapper}>
            <MagnifyingGlass size={13} weight="bold" className={styles.receiptSearchIcon} />
            <input
              className={styles.receiptSearchInput}
              type="text"
              placeholder="Search vendor, category, property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className={styles.receiptSearchClear}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X size={11} weight="bold" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!hasReceipts ? (
        <div className={styles.billsEmptyState}>
          <Buildings size={20} weight="duotone" className={styles.billsEmptyIcon} />
          <div>
            <strong>No receipts in the depository yet</strong>
            <span>Upload receipt files on the owner's behalf when they are ready.</span>
          </div>
        </div>
      ) : isSearching ? (
        <div className={styles.billsList}>
          {searchResults.length === 0 ? (
            <div className={styles.billsEmptyState}>
              <MagnifyingGlass size={20} weight="duotone" className={styles.billsEmptyIcon} />
              <div>
                <strong>No matching receipts</strong>
                <span>Try a different search term.</span>
              </div>
            </div>
          ) : (
            <div className={styles.receiptList}>
              {sortedSearchResults.map((receipt) => (
                <ReceiptCard
                  key={receipt.id}
                  receipt={receipt}
                  onShowPreview={showReceiptPreview}
                  onHidePreview={hideReceiptPreview}
                />
              ))}
            </div>
          )}
        </div>
      ) : filteredReceipts.length === 0 ? (
        <div className={styles.billsEmptyState}>
          <Receipt size={20} weight="duotone" className={styles.billsEmptyIcon} />
          <div>
            <strong>No matching receipts</strong>
            <span>Try changing the filter above.</span>
          </div>
        </div>
      ) : groupBy === "time" ? (
        <div className={styles.billsList}>
          {timeGroups.length === 0 ? null : (() => {
            const selectedYearGroup =
              timeGroups.find((yg) => yg.year === selectedYear) ?? timeGroups[0] ?? null;
            const selectedMonthGroup =
              selectedYearGroup?.months.find((mg) => mg.key === selectedMonth) ??
              (monthSortDir === "asc"
                ? selectedYearGroup?.months[selectedYearGroup.months.length - 1]
                : selectedYearGroup?.months[0]) ?? null;
            const displayMonths = monthSortDir === "asc"
              ? [...(selectedYearGroup?.months ?? [])].reverse()
              : (selectedYearGroup?.months ?? []);
            const sortedMonthReceipts = (() => {
              if (!selectedMonthGroup) return [];
              const base = [...selectedMonthGroup.receipts];
              switch (receiptSort) {
                case "date_asc": return base.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
                case "amount_desc": return base.sort((a, b) => b.amountCents - a.amountCents);
                case "amount_asc": return base.sort((a, b) => a.amountCents - b.amountCents);
                default: return base.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
              }
            })();
            return (
              <div className={styles.receiptColumnBrowser}>

                <div className={styles.receiptColumnPanel}>
                  <div className={styles.receiptColumnPanelHeader}>Year</div>
                  {timeGroups.map((yg) => {
                    const isSelected = yg === selectedYearGroup;
                    return (
                      <button
                        key={yg.year}
                        type="button"
                        className={`${styles.receiptColumnItem} ${isSelected ? styles.receiptColumnItemSelected : ""}`}
                        onClick={() => { setSelectedYear(yg.year); setSelectedMonth(null); }}
                      >
                        <div className={styles.receiptColumnItemBody}>
                          <div className={styles.receiptColumnItemLabel}>{yg.year || "Unknown"}</div>
                          <div className={styles.receiptColumnItemMeta}>{formatCents(yg.totalCents)}</div>
                        </div>
                        <CaretRight
                          size={11}
                          weight="bold"
                          className={`${styles.receiptColumnItemArrow} ${isSelected ? styles.receiptColumnItemArrowSelected : ""}`}
                        />
                      </button>
                    );
                  })}
                </div>

                <div className={styles.receiptColumnPanel}>
                  <div className={styles.receiptColumnPanelHeader}>
                    <span>Month</span>
                    <button
                      type="button"
                      className={styles.receiptColumnSortBtn}
                      onClick={() => { setMonthSortDir((d) => d === "desc" ? "asc" : "desc"); setSelectedMonth(null); }}
                      title={monthSortDir === "desc" ? "Newest first. Click for oldest first" : "Oldest first. Click for newest first"}
                    >
                      {monthSortDir === "desc"
                        ? <ArrowDown size={10} weight="bold" />
                        : <ArrowUp size={10} weight="bold" />}
                    </button>
                  </div>
                  {selectedYearGroup ? displayMonths.map((mg) => {
                    const isSelected = mg === selectedMonthGroup;
                    return (
                      <button
                        key={mg.key}
                        type="button"
                        className={`${styles.receiptColumnItem} ${isSelected ? styles.receiptColumnItemSelected : ""}`}
                        onClick={() => setSelectedMonth(mg.key)}
                      >
                        <div className={styles.receiptColumnItemBody}>
                          <div className={styles.receiptColumnItemLabel}>{mg.label.split(" ")[0]}</div>
                          <div className={styles.receiptColumnItemMeta}>
                            {mg.receipts.length} receipt{mg.receipts.length === 1 ? "" : "s"} · {formatCents(mg.totalCents)}
                          </div>
                        </div>
                        <CaretRight
                          size={11}
                          weight="bold"
                          className={`${styles.receiptColumnItemArrow} ${isSelected ? styles.receiptColumnItemArrowSelected : ""}`}
                        />
                      </button>
                    );
                  }) : <div className={styles.receiptColumnEmpty}>No data</div>}
                </div>

                <div className={styles.receiptColumnPanel}>
                  <div className={styles.receiptColumnPanelHeader}>
                    <span>
                      {selectedMonthGroup
                        ? `${selectedMonthGroup.receipts.length} receipt${selectedMonthGroup.receipts.length === 1 ? "" : "s"}`
                        : "Evidence"}
                    </span>
                    {selectedMonthGroup ? (
                      <button
                        type="button"
                        className={styles.receiptColumnSortBtn}
                        onClick={() => setReceiptSort((s) => RECEIPT_SORT_CYCLE[(RECEIPT_SORT_CYCLE.indexOf(s) + 1) % RECEIPT_SORT_CYCLE.length])}
                        title="Cycle sort order"
                      >
                        <span className={styles.receiptColumnSortLabel}>{RECEIPT_SORT_LABELS[receiptSort]}</span>
                      </button>
                    ) : null}
                  </div>
                  {selectedMonthGroup ? (
                    <div className={styles.receiptList}>
                      {sortedMonthReceipts.map((receipt) => (
                        <ReceiptCard
                          key={receipt.id}
                          receipt={receipt}
                          onShowPreview={showReceiptPreview}
                          onHidePreview={hideReceiptPreview}
                        />
                      ))}
                    </div>
                  ) : <div className={styles.receiptColumnEmpty}>Select a month</div>}
                </div>

              </div>
            );
          })()}
        </div>
      ) : (
        <div className={styles.billsList}>
          {flatGroups.map((group) => {
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
                    <span className={`${styles.propertyDot} ${group.id === null ? styles.propertyDotUnassigned : ""}`} />
                    <span className={`${styles.propertyName} ${group.id === null ? styles.propertyNameUnassigned : ""}`}>
                      {group.label}
                    </span>
                    <span className={styles.propertyCount}>
                      {group.receipts.length} receipt{group.receipts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className={styles.propertyGroupRight}>
                    <span className={styles.propertyTotal}>{formatCents(group.totalCents)}</span>
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
                      <ReceiptCard
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

function ReceiptFilePreview({ file }: { file: ProcessingFile }) {
  return (
    <div className={styles.receiptPreviewPanel}>
      <div className={styles.receiptPreviewHeader}>
        <div>
          <span className={styles.receiptPreviewKicker}>Preview</span>
          <strong>{file.file.name}</strong>
        </div>
        <span className={styles.receiptPreviewMeta}>{formatBytes(file.file.size)}</span>
      </div>
      <div className={styles.receiptPreviewFrame}>
        {file.file.type.startsWith("image/") ? (
          <img src={file.previewUrl} className={styles.receiptPreviewFrameImage} alt={file.file.name} />
        ) : file.file.type === "application/pdf" ? (
          <iframe src={file.previewUrl} className={styles.receiptPreviewFramePdf} title={`Preview ${file.file.name}`} />
        ) : (
          <div className={styles.receiptPreviewPdf}>
            <FilePdf size={42} weight="duotone" />
            <span>Preview unavailable for this file</span>
          </div>
        )}
      </div>
      {file.analysis ? (
        <div className={styles.receiptPreviewSummary}>
          <SparkLine confidence={file.analysis.confidence} />
          <span>{file.analysis.summary}</span>
        </div>
      ) : (
        <div className={styles.receiptPreviewSummary}>
          <SparkLine confidence="low" />
          <span>{file.status === "processing" ? "AI is reading this document." : "Add details before saving."}</span>
        </div>
      )}
    </div>
  );
}

function SparkLine({ confidence }: { confidence: ReceiptDraftAnalysis["confidence"] }) {
  const toneClass =
    confidence === "high"
      ? styles.aiSparkLineHigh
      : confidence === "medium"
        ? styles.aiSparkLineMedium
        : styles.aiSparkLineLow;
  return <span className={`${styles.aiSparkLine} ${toneClass}`} />;
}

function ReceiptAiInspector({
  file,
  properties,
  onFieldChange,
  onAddLineItem,
  onUpdateLineItem,
  onRemoveLineItem,
  onDiscard,
}: {
  file: ProcessingFile;
  properties: { id: string; label: string }[];
  onFieldChange: <K extends keyof FileFields>(id: string, key: K, value: FileFields[K]) => void;
  onAddLineItem: (id: string) => void;
  onUpdateLineItem: (fileId: string, itemId: string, key: "label" | "amount", value: string) => void;
  onRemoveLineItem: (fileId: string, itemId: string) => void;
  onDiscard: (id: string) => void;
}) {
  const amount = Number(file.fields.amount);
  const isReady = Number.isFinite(amount) && amount > 0 && file.fields.vendor.trim().length > 0;
  const itemTotal = file.fields.lineItems.reduce((sum, item) => {
    const lineAmount = Number(item.amount);
    return Number.isFinite(lineAmount) ? sum + lineAmount : sum;
  }, 0);

  return (
    <div className={styles.aiInspector}>
      <div className={styles.aiInspectorHeader}>
        <div>
          <span className={styles.receiptPreviewKicker}>AI breakdown</span>
          <strong>{file.status === "processing" ? "Reading document" : isReady ? "Ready to save" : "Needs review"}</strong>
        </div>
        <button type="button" className={styles.batchCardDiscard} onClick={() => onDiscard(file.id)} title="Discard this receipt">
          <X size={13} weight="bold" />
        </button>
      </div>

      <div className={styles.aiInspectorGrid}>
        <label className={styles.field}>
          <span>Vendor</span>
          <input className={styles.textInput} value={file.fields.vendor} onChange={(e) => onFieldChange(file.id, "vendor", e.target.value)} placeholder="Home Depot" />
        </label>

        <label className={styles.field}>
          <span>Total</span>
          <input className={styles.textInput} value={file.fields.amount} onChange={(e) => onFieldChange(file.id, "amount", e.target.value)} inputMode="decimal" placeholder="0.00" />
        </label>

        <div className={styles.field}>
          <span>Category</span>
          <CustomSelect value={file.fields.category} onChange={(v) => onFieldChange(file.id, "category", v)} options={RECEIPT_CATEGORIES} />
        </div>

        <div className={styles.field}>
          <span>Date</span>
          <DatePickerInput value={file.fields.purchaseDate} onChange={(v) => onFieldChange(file.id, "purchaseDate", v)} />
        </div>
      </div>

      <div className={styles.aiInspectorRows}>
        <div className={styles.field}>
          <span>Paid with</span>
          <CustomSelect value={file.fields.paymentSource} onChange={(v) => onFieldChange(file.id, "paymentSource", v as ReceiptPaymentSource)} options={PAYMENT_SOURCE_OPTIONS} />
        </div>

        <div className={styles.field}>
          <span>Status</span>
          <CustomSelect value={file.fields.reimbursementStatus} onChange={(v) => onFieldChange(file.id, "reimbursementStatus", v as ReceiptReimbursementStatus)} options={REIMBURSEMENT_STATUS_OPTIONS} />
        </div>

        {(file.fields.reimbursementStatus === "claim_needed"
          || file.fields.reimbursementStatus === "claim_submitted"
          || file.fields.reimbursementStatus === "reimbursed"
          || file.fields.reimbursementStatus === "denied_writeoff") ? (
          <>
            <div className={styles.field}>
              <span>Claim through</span>
              <CustomSelect value={file.fields.claimProvider ?? "airbnb"} onChange={(v) => onFieldChange(file.id, "claimProvider", v as ReceiptClaimProvider)} options={CLAIM_PROVIDER_OPTIONS} />
            </div>
            <label className={styles.field}>
              <span>Claim ref</span>
              <input className={styles.textInput} value={file.fields.claimReference} onChange={(e) => onFieldChange(file.id, "claimReference", e.target.value)} placeholder="Airbnb case ID" />
            </label>
          </>
        ) : null}

        {file.fields.reimbursementStatus === "reimbursed" ? (
          <div className={styles.field}>
            <span>Reimbursed</span>
            <DatePickerInput value={file.fields.reimbursedAt} onChange={(v) => onFieldChange(file.id, "reimbursedAt", v)} />
          </div>
        ) : null}
      </div>

      <div className={styles.aiLineItems}>
        <div className={styles.aiLineItemsHeader}>
          <span>Items</span>
          <button type="button" onClick={() => onAddLineItem(file.id)}>
            <Plus size={12} weight="bold" />
            Add item
          </button>
        </div>
        {file.fields.lineItems.length === 0 ? (
          <div className={styles.aiLineItemsEmpty}>No item rows detected yet. Add one manually if the receipt needs detail.</div>
        ) : (
          file.fields.lineItems.map((item) => (
            <div key={item.id} className={styles.aiLineItemRow}>
              <input value={item.label} onChange={(e) => onUpdateLineItem(file.id, item.id, "label", e.target.value)} placeholder="Line item" />
              <input value={item.amount} onChange={(e) => onUpdateLineItem(file.id, item.id, "amount", e.target.value)} inputMode="decimal" placeholder="0.00" />
              <button type="button" onClick={() => onRemoveLineItem(file.id, item.id)} aria-label="Remove item">
                <X size={11} weight="bold" />
              </button>
            </div>
          ))
        )}
        {file.fields.lineItems.length > 0 ? (
          <div className={styles.aiLineItemsTotal}>
            <span>Item subtotal</span>
            <strong>{formatCents(Math.round(itemTotal * 100))}</strong>
          </div>
        ) : null}
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

      <label className={styles.field}>
        <span>Notes</span>
        <textarea className={styles.textArea} value={file.fields.notes} onChange={(e) => onFieldChange(file.id, "notes", e.target.value)} placeholder="Internal note or owner-facing context" />
      </label>

      <label className={styles.intakeVisibilityToggle}>
        <input type="checkbox" checked={file.fields.ownerVisible} onChange={(e) => onFieldChange(file.id, "ownerVisible", e.target.checked)} />
        <span>
          {file.fields.ownerVisible ? <Eye size={13} weight="bold" /> : <EyeSlash size={13} weight="bold" />}
          {file.fields.ownerVisible ? "Visible to owner" : "Admin only"}
        </span>
      </label>
    </div>
  );
}

function ReceiptCard({
  receipt,
  onShowPreview,
  onHidePreview,
}: {
  receipt: WorkspaceFinancialReceipt;
  onShowPreview: (url: string, rect: DOMRect) => void;
  onHidePreview: () => void;
}) {
  const needsWork = receipt.reimbursementStatus !== "none" && receipt.reimbursementStatus !== "reimbursed" && receipt.reimbursementStatus !== "denied_writeoff";
  const visibleLineItems = receipt.lineItems.slice(0, 3);

  return (
    <div
      className={styles.receiptCard}
      onMouseEnter={receipt.imageUrl ? (e) => onShowPreview(receipt.imageUrl!, e.currentTarget.getBoundingClientRect()) : undefined}
      onMouseLeave={receipt.imageUrl ? onHidePreview : undefined}
    >
      <div className={styles.receiptCardAccent} />

      <div className={styles.receiptCardContent}>
        <div className={styles.receiptCardTop}>
          <span className={styles.receiptCardVendor}>{receipt.vendor}</span>
          <span className={styles.receiptCardAmount}>{formatCents(receipt.amountCents, receipt.currency)}</span>
        </div>
        <div className={styles.receiptCardBottom}>
          <div className={styles.receiptCardBottomLeft}>
            {receipt.category ? <span className={styles.receiptCardCategory}>{receipt.category}</span> : null}
            {receipt.propertyLabel ? (
              <span className={styles.receiptCardProperty}>{receipt.propertyLabel}</span>
            ) : null}
            <span className={`${styles.receiptCardPill} ${needsWork ? styles.receiptCardPillNeedsWork : ""}`}>
              {PAYMENT_SOURCE_LABELS[receipt.paymentSource]}
              {needsWork ? ` · ${REIMBURSEMENT_STATUS_LABELS[receipt.reimbursementStatus]}` : ""}
            </span>
          </div>
          <div className={styles.receiptCardBottomRight}>
            {receipt.purchaseDate ? <span className={styles.receiptCardDate}>{formatDateShort(receipt.purchaseDate)}</span> : null}
            {receipt.visibility === "private" ? <EyeSlash size={10} weight="bold" className={styles.receiptCardEye} /> : null}
            {receipt.imageUrl ? (
              <a href={receipt.imageUrl} target="_blank" rel="noopener noreferrer" className={styles.receiptFileLink}>
                File
              </a>
            ) : null}
          </div>
        </div>
        {visibleLineItems.length > 0 ? (
          <div className={styles.receiptCardLineItems}>
            {visibleLineItems.map((item, index) => (
              <span key={`${receipt.id}-${item.label}-${index}`} className={styles.receiptCardLineItem}>
                {item.label}
                {formatLineItemAmount(item.amount, receipt.currency) ? (
                  <b>{formatLineItemAmount(item.amount, receipt.currency)}</b>
                ) : null}
              </span>
            ))}
            {receipt.lineItems.length > visibleLineItems.length ? (
              <span className={styles.receiptCardLineItemMore}>
                +{receipt.lineItems.length - visibleLineItems.length} more
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
