"use client";

import {
  ChartDonut,
  DownloadSimple,
  FileArrowUp,
  CheckCircle,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Sparkle,
  Stack,
  Trash,
  Tray,
} from "@phosphor-icons/react";
import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceFinancialReceipt } from "@/lib/admin/workspace-billing";
import {
  analyzeReceiptDraft,
  createReceipt,
  deleteReceipt,
  exportReceiptsCSV,
  updateReceipt,
} from "./financials-actions";
import type { ReceiptAnalysisSource, ReceiptDraftAnalysis } from "./financials-actions";
import styles from "./BillingTab.module.css";

type ReceiptView = "review" | "library" | "insights";

type ReceiptBucket = {
  year: string;
  months: Array<{
    month: string;
    totalCents: number;
    receipts: WorkspaceFinancialReceipt[];
  }>;
};

type ReceiptSummary = {
  label: string;
  count: number;
  totalCents: number;
  currency: string;
};

type IntakeStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type ExportStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type IntakeFields = {
  vendor: string;
  amount: string;
  category: string;
  purchaseDate: string;
  notes: string;
  ownerVisible: boolean;
  notifyOwner: boolean;
  propertyId: string | null;
};

type ReviewStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type FinanceReceiptProperty = {
  id: string;
  label: string;
};

type ReceiptAnalysisKind = ReceiptDraftAnalysis["kind"];
type ReceiptAnalysis = ReceiptDraftAnalysis;

type RankedReceipt = {
  receipt: WorkspaceFinancialReceipt;
  score: number;
};

const VIEW_LABELS: Record<ReceiptView, string> = {
  review: "Review",
  library: "Library",
  insights: "Insights",
};

const VIEW_ICONS: Record<ReceiptView, typeof Tray> = {
  review: Tray,
  library: Stack,
  insights: ChartDonut,
};

const ANALYSIS_KIND_LABELS: Record<ReceiptAnalysisKind, string> = {
  receipt: "Receipt",
  invoice: "Invoice",
  recurring: "Recurring",
  to_pay: "To pay",
};

const ANALYSIS_SOURCE_LABELS: Record<ReceiptAnalysisSource, string> = {
  document: "Document",
  ai: "AI",
  rules: "Rules",
  manual: "Manual",
};

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function monthLabel(iso: string): { year: string; month: string } {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { year: "Unsorted", month: "Needs date" };
  return {
    year: String(date.getFullYear()),
    month: date.toLocaleDateString("en-US", { month: "long" }),
  };
}

function receiptHaystack(receipt: WorkspaceFinancialReceipt): string {
  const analysis = analyzeReceipt(receipt);
  const { month, year } = monthLabel(receipt.purchaseDate);
  return [
    receipt.vendor,
    receipt.category,
    receipt.propertyLabel,
    receipt.notes,
    receipt.analysisSummary,
    receipt.analysisSource,
    receipt.purchaseDate,
    month,
    year,
    ANALYSIS_KIND_LABELS[analysis.kind],
    analysis.reasons.join(" "),
    String(receipt.amountCents / 100),
    formatCents(receipt.amountCents, receipt.currency),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function tokenizeSearch(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function parseQueryAmount(query: string): number | null {
  const cleaned = query.replace(/[$,]/g, " ");
  const match = cleaned.match(/\b\d+(?:\.\d{1,2})?\b/);
  if (!match) return null;
  const amount = Number(match[0]);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function scoreReceiptSearch(receipt: WorkspaceFinancialReceipt, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;

  const haystack = receiptHaystack(receipt);
  const tokens = tokenizeSearch(normalizedQuery);
  let score = haystack.includes(normalizedQuery) ? 80 : 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += token.length >= 4 ? 18 : 10;
      continue;
    }

    const closeWord = haystack
      .split(" ")
      .some((word) => token.length >= 4 && (word.startsWith(token) || token.startsWith(word)));
    if (closeWord) score += 6;
  }

  const amountCents = parseQueryAmount(normalizedQuery);
  if (amountCents !== null) {
    const difference = Math.abs(receipt.amountCents - amountCents);
    if (difference === 0) score += 55;
    else if (difference <= 100) score += 35;
    else if (difference <= 500) score += 18;
  }

  return score;
}

function searchReceipts(receipts: WorkspaceFinancialReceipt[], query: string): WorkspaceFinancialReceipt[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return receipts;

  const ranked: RankedReceipt[] = receipts
    .map((receipt) => ({
      receipt,
      score: scoreReceiptSearch(receipt, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return new Date(second.receipt.purchaseDate).getTime() - new Date(first.receipt.purchaseDate).getTime();
    });

  return ranked.map((entry) => entry.receipt);
}

function cleanLabel(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentYear(): string {
  return String(new Date().getFullYear());
}

function bucketReceipts(receipts: WorkspaceFinancialReceipt[]): ReceiptBucket[] {
  const years = new Map<string, Map<string, WorkspaceFinancialReceipt[]>>();

  for (const receipt of receipts) {
    const { year, month } = monthLabel(receipt.purchaseDate);
    const months = years.get(year) ?? new Map<string, WorkspaceFinancialReceipt[]>();
    const monthReceipts = months.get(month) ?? [];
    monthReceipts.push(receipt);
    months.set(month, monthReceipts);
    years.set(year, months);
  }

  return Array.from(years.entries()).map(([year, months]) => ({
    year,
    months: Array.from(months.entries()).map(([month, monthReceipts]) => ({
      month,
      totalCents: monthReceipts.reduce((sum, receipt) => sum + receipt.amountCents, 0),
      receipts: monthReceipts,
    })),
  }));
}

function groupReceipts(
  receipts: WorkspaceFinancialReceipt[],
  getLabel: (receipt: WorkspaceFinancialReceipt) => string,
): ReceiptSummary[] {
  const summaries = new Map<string, ReceiptSummary>();

  for (const receipt of receipts) {
    const label = getLabel(receipt);
    const summary = summaries.get(label) ?? {
      label,
      count: 0,
      totalCents: 0,
      currency: receipt.currency,
    };
    summary.count += 1;
    summary.totalCents += receipt.amountCents;
    summaries.set(label, summary);
  }

  return Array.from(summaries.values()).sort((first, second) => second.totalCents - first.totalCents);
}

function needsReceiptReview(receipt: WorkspaceFinancialReceipt): boolean {
  const category = receipt.category.trim().toLowerCase();
  return !receipt.propertyLabel || !receipt.imageUrl || !category || ["other", "misc", "uncategorized", "receipt"].includes(category);
}

function receiptReviewReason(receipt: WorkspaceFinancialReceipt): string {
  if (!receipt.propertyLabel) return "Needs property";
  if (!receipt.imageUrl) return "Needs file";
  const category = receipt.category.trim().toLowerCase();
  if (!category || ["other", "misc", "uncategorized", "receipt"].includes(category)) return "Needs category";
  return "Ready";
}

function suggestedCategory(receipt: WorkspaceFinancialReceipt): string {
  const text = [receipt.vendor, receipt.notes, receipt.category].filter(Boolean).join(" ").toLowerCase();
  if (/(home depot|lowe|hardware|repair|plumb|electric|hvac|maintenance)/.test(text)) return "Repairs";
  if (/(clean|laundry|linen|turnover|housekeep)/.test(text)) return "Cleaning";
  if (/(utility|power|electric|water|gas|internet|wifi)/.test(text)) return "Utilities";
  if (/(supply|costco|amazon|target|walmart)/.test(text)) return "Supplies";
  if (/(insurance|premium|policy)/.test(text)) return "Insurance";
  if (/(tax|county|permit|license)/.test(text)) return "Taxes";
  return "Owner expense";
}

function analyzeText({
  vendor,
  category,
  notes,
}: {
  vendor: string;
  category: string;
  notes: string | null | undefined;
}): ReceiptAnalysis {
  const text = [vendor, category, notes].filter(Boolean).join(" ").toLowerCase();
  const reasons: string[] = [];
  let nextCategory = category.trim();
  let kind: ReceiptAnalysisKind = "receipt";
  let confidence: ReceiptAnalysis["confidence"] = "low";

  if (/(invoice|statement|bill|net\s?\d+|amount due|due on|balance due|payment due)/.test(text)) {
    kind = "invoice";
    reasons.push("invoice language");
    confidence = "medium";
  }

  if (/(recurring|monthly|subscription|autopay|auto pay|every month|service plan)/.test(text)) {
    kind = "recurring";
    reasons.push("recurring wording");
    confidence = "medium";
  }

  if (/(unpaid|needs payment|to pay|past due|payment due|amount due|balance due)/.test(text)) {
    kind = "to_pay";
    reasons.push("payment due wording");
    confidence = "high";
  }

  const categorySignals: Array<{ category: string; pattern: RegExp; reason: string }> = [
    { category: "Repairs", pattern: /(home depot|lowe|hardware|repair|plumb|electric|hvac|maintenance)/, reason: "repair vendor or wording" },
    { category: "Cleaning", pattern: /(clean|laundry|linen|turnover|housekeep)/, reason: "cleaning wording" },
    { category: "Utilities", pattern: /(utility|power|electric|water|gas|internet|wifi)/, reason: "utility wording" },
    { category: "Supplies", pattern: /(supply|costco|amazon|target|walmart)/, reason: "supply vendor" },
    { category: "Insurance", pattern: /(insurance|premium|policy)/, reason: "insurance wording" },
    { category: "Taxes", pattern: /(tax|county|permit|license)/, reason: "tax or permit wording" },
  ];

  const genericCategory = !nextCategory || ["other", "misc", "uncategorized", "receipt"].includes(nextCategory.toLowerCase());
  for (const signal of categorySignals) {
    if (signal.pattern.test(text)) {
      if (genericCategory) nextCategory = signal.category;
      reasons.push(signal.reason);
      confidence = confidence === "low" ? "medium" : confidence;
      break;
    }
  }

  if (!nextCategory) nextCategory = "Owner expense";
  if (reasons.length === 0) reasons.push("manual review recommended");

  return {
    category: nextCategory,
    kind,
    confidence,
    summary: reasons.includes("manual review recommended")
      ? "Review the uploaded document and confirm what this expense was for."
      : `Likely ${nextCategory.toLowerCase()} ${kind.replace("_", " ")} based on the available receipt context.`,
    reasons,
  };
}

function analyzeReceipt(receipt: WorkspaceFinancialReceipt): ReceiptAnalysis {
  if (receipt.analysisKind && receipt.analysisConfidence && receipt.analysisSummary) {
    return {
      category: receipt.category,
      kind: receipt.analysisKind,
      confidence: receipt.analysisConfidence,
      summary: receipt.analysisSummary,
      reasons: receipt.analysisReasons.length > 0 ? receipt.analysisReasons : ["saved analysis"],
    };
  }

  return analyzeText({
    vendor: receipt.vendor,
    category: receipt.category,
    notes: receipt.notes,
  });
}

export function FinanceReceiptDashboard({
  receipts,
  ownerId,
  properties,
  workspaceId,
}: {
  receipts: WorkspaceFinancialReceipt[];
  ownerId: string | null;
  properties: FinanceReceiptProperty[];
  workspaceId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState<ReceiptView>("library");
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [exportYear, setExportYear] = useState(currentYear());
  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    type: "idle",
    message: "Export receipts by calendar year for bookkeeping or owner packets.",
  });
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>({
    type: "idle",
    message: "Review uploaded receipts before they become owner-facing finance records.",
  });
  const [reviewCategoryEdits, setReviewCategoryEdits] = useState<Record<string, string>>({});
  const [reviewPropertyEdits, setReviewPropertyEdits] = useState<Record<string, string | null>>({});
  const [reviewVisibilityEdits, setReviewVisibilityEdits] = useState<Record<string, "visible" | "private">>({});
  const [reviewNotifyEdits, setReviewNotifyEdits] = useState<Record<string, boolean>>({});
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [intakeStatus, setIntakeStatus] = useState<IntakeStatus>({
    type: "idle",
    message: "Add a receipt manually now. Upload a file to analyze what it was for before saving.",
  });
  const [intakeFields, setIntakeFields] = useState<IntakeFields>({
    vendor: "",
    amount: "",
    category: "Receipt",
    purchaseDate: todayDate(),
    notes: "",
    ownerVisible: true,
    notifyOwner: false,
    propertyId: properties.length === 1 ? properties[0].id : null,
  });
  const [intakeAnalysis, setIntakeAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [intakeAnalysisSource, setIntakeAnalysisSource] = useState<ReceiptAnalysisSource | null>(null);
  const [intakeFileName, setIntakeFileName] = useState<string | null>(null);
  const [intakeFile, setIntakeFile] = useState<File | null>(null);
  const receiptYears = useMemo(() => {
    const years = Array.from(
      new Set(
        receipts
          .map((receipt) => monthLabel(receipt.purchaseDate).year)
          .filter((year) => year !== "Unsorted"),
      ),
    ).sort((first, second) => Number(second) - Number(first));

    return years.length > 0 ? years : [currentYear()];
  }, [receipts]);
  const filteredReceipts = useMemo(() => {
    return searchReceipts(receipts, query);
  }, [query, receipts]);
  const receiptBuckets = useMemo(() => bucketReceipts(filteredReceipts), [filteredReceipts]);
  const reviewReceipts = useMemo(
    () => filteredReceipts.filter((receipt) => needsReceiptReview(receipt)),
    [filteredReceipts],
  );
  const paymentQueueReceipts = useMemo(
    () => filteredReceipts.filter((receipt) => analyzeReceipt(receipt).kind === "to_pay"),
    [filteredReceipts],
  );
  const vendorInsights = useMemo(
    () => groupReceipts(filteredReceipts, (receipt) => cleanLabel(receipt.vendor, "Unknown vendor")).slice(0, 5),
    [filteredReceipts],
  );
  const categoryInsights = useMemo(
    () => groupReceipts(filteredReceipts, (receipt) => cleanLabel(receipt.category, "Uncategorized")).slice(0, 5),
    [filteredReceipts],
  );
  const recurringSignals = vendorInsights.filter((vendor) => vendor.count >= 2);
  const totalCents = filteredReceipts.reduce((sum, receipt) => sum + receipt.amountCents, 0);

  const handleExportReceipts = () => {
    if (!ownerId) {
      setExportStatus({
        type: "error",
        message: "This workspace needs an owner profile before receipts can be exported.",
      });
      return;
    }

    const year = Number(exportYear);
    if (!Number.isInteger(year)) {
      setExportStatus({ type: "error", message: "Choose a valid receipt year." });
      return;
    }

    startTransition(async () => {
      const result = await exportReceiptsCSV(ownerId, year);
      if (!result.ok || !result.csv) {
        setExportStatus({ type: "error", message: result.message ?? "Receipt export failed." });
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `workspace-receipts-${year}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setExportStatus({ type: "success", message: `Exported ${exportYear} receipts.` });
    });
  };

  const handleDeleteReceipt = (receipt: WorkspaceFinancialReceipt) => {
    if (!ownerId) {
      setReviewStatus({
        type: "error",
        message: "This workspace needs an owner profile before receipts can be deleted.",
      });
      return;
    }

    if (deleteCandidateId !== receipt.id) {
      setDeleteCandidateId(receipt.id);
      setReviewStatus({
        type: "idle",
        message: `Select Confirm delete to remove ${receipt.vendor}.`,
      });
      return;
    }

    startTransition(async () => {
      const result = await deleteReceipt(receipt.id, ownerId, workspaceId);
      if (!result.ok) {
        setReviewStatus({ type: "error", message: result.message });
        return;
      }

      setDeleteCandidateId(null);
      setReviewStatus({ type: "success", message: result.message });
      router.refresh();
    });
  };

  const renderReceiptRow = (receipt: WorkspaceFinancialReceipt) => (
    <div key={receipt.id} className={styles.receiptRow}>
      <div>
        <span className={styles.receiptName}>{receipt.vendor}</span>
        <span className={styles.receiptMeta}>
          {receipt.category}
          {receipt.propertyLabel ? <span>{receipt.propertyLabel}</span> : null}
        </span>
        {analyzeReceipt(receipt).summary ? (
          <span className={styles.receiptAnalysisSummary}>{analyzeReceipt(receipt).summary}</span>
        ) : null}
      </div>
      <div className={styles.receiptRight}>
        <span>{formatCents(receipt.amountCents, receipt.currency)}</span>
        <span className={styles.receiptSignal}>{ANALYSIS_KIND_LABELS[analyzeReceipt(receipt).kind]}</span>
        {receipt.analysisSource ? (
          <span className={styles.receiptSource}>{ANALYSIS_SOURCE_LABELS[receipt.analysisSource]}</span>
        ) : null}
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
        <span className={styles.receiptVisibility}>
          {receipt.visibility === "private" ? (
            <EyeSlash size={12} weight="bold" />
          ) : (
            <Eye size={12} weight="bold" />
          )}
          {receipt.visibility === "private" ? "Admin only" : "Owner visible"}
        </span>
        <button
          type="button"
          className={`${styles.receiptDeleteButton} ${
            deleteCandidateId === receipt.id ? styles.receiptDeleteButtonConfirm : ""
          }`}
          disabled={isPending}
          onClick={() => handleDeleteReceipt(receipt)}
          aria-label={deleteCandidateId === receipt.id ? `Confirm delete ${receipt.vendor}` : `Delete ${receipt.vendor}`}
        >
          <Trash size={12} weight="bold" />
          {deleteCandidateId === receipt.id ? "Confirm delete" : "Delete"}
        </button>
      </div>
    </div>
  );

  const updateIntakeField = <Field extends keyof IntakeFields>(
    field: Field,
    value: IntakeFields[Field],
  ) => {
    setIntakeFields((current) => ({ ...current, [field]: value }));
  };

  const resetIntake = () => {
    setIntakeFields({
      vendor: "",
      amount: "",
      category: "Receipt",
      purchaseDate: todayDate(),
      notes: "",
      ownerVisible: true,
      notifyOwner: false,
      propertyId: properties.length === 1 ? properties[0].id : null,
    });
    setIntakeAnalysis(null);
    setIntakeAnalysisSource(null);
    setIntakeFileName(null);
    setIntakeFile(null);
  };

  const handleAnalyzeDraft = () => {
    setIntakeStatus({
      type: "idle",
      message: "Analyzing the receipt context.",
    });

    startTransition(async () => {
      const result = await analyzeReceiptDraft({
        vendor: intakeFields.vendor,
        amount: intakeFields.amount,
        category: intakeFields.category,
        purchaseDate: intakeFields.purchaseDate,
        notes: intakeFields.notes,
        fileName: intakeFileName,
        file: intakeFile,
      });

      const analysis = result.ok
        ? result.analysis
        : analyzeText({
            vendor: intakeFields.vendor,
            category: intakeFields.category,
            notes: intakeFields.notes,
          });

      setIntakeAnalysis(analysis);
      setIntakeAnalysisSource(result.ok ? result.source : "rules");
      setIntakeFields((current) => ({
        ...current,
        vendor: !current.vendor.trim() && analysis.vendor ? analysis.vendor : current.vendor,
        amount: !current.amount.trim() && analysis.amount ? analysis.amount.replace(/[$,]/g, "") : current.amount,
        purchaseDate: !current.purchaseDate.trim() && analysis.purchaseDate ? analysis.purchaseDate : current.purchaseDate,
        category: analysis.category,
      }));
      setIntakeStatus({
        type: result.ok ? "success" : "error",
        message: result.ok
          ? `${result.source === "document" ? "Document" : result.source === "ai" ? "AI" : "Rules"} analysis applied. Review category, visibility, and property before saving.`
          : "Analysis fallback applied. Review category, visibility, and property before saving.",
      });
    });
  };

  const handleReceiptSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const receiptFile = formData.get("receiptFile");

    if (!ownerId) {
      setIntakeStatus({
        type: "error",
        message: "This workspace needs an owner profile before receipts can be saved.",
      });
      return;
    }

    const amount = Number(intakeFields.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setIntakeStatus({ type: "error", message: "Enter a receipt amount greater than zero." });
      return;
    }

    startTransition(async () => {
      let analysis = intakeAnalysis;
      let analysisSource = intakeAnalysisSource;

      if (!analysis) {
        const draftResult = await analyzeReceiptDraft({
          vendor: intakeFields.vendor,
          amount: intakeFields.amount,
          category: intakeFields.category,
          purchaseDate: intakeFields.purchaseDate,
          notes: intakeFields.notes,
          fileName: receiptFile instanceof File && receiptFile.size > 0 ? receiptFile.name : intakeFileName,
          file: receiptFile instanceof File && receiptFile.size > 0 ? receiptFile : intakeFile,
        });

        if (draftResult.ok) {
          analysis = draftResult.analysis;
          analysisSource = draftResult.source;
        } else {
          analysis = analyzeText({
            vendor: intakeFields.vendor,
            category: intakeFields.category,
            notes: intakeFields.notes,
          });
          analysisSource = "rules";
        }
      }

      const result = await createReceipt(ownerId, {
        workspaceId,
        vendor: intakeFields.vendor.trim() || analysis.vendor?.trim() || "Unknown vendor",
        amount,
        category: analysis.category || intakeFields.category.trim() || "Receipt",
        purchaseDate: intakeFields.purchaseDate,
        notes: intakeFields.notes.trim() || analysis.summary || undefined,
        propertyId: intakeFields.propertyId ?? undefined,
        visibility: intakeFields.ownerVisible ? "visible" : "private",
        notifyOwner: intakeFields.ownerVisible && intakeFields.notifyOwner,
        file: receiptFile instanceof File && receiptFile.size > 0 ? receiptFile : null,
        analysis,
        analysisSource,
      });

      if (!result.ok) {
        setIntakeStatus({ type: "error", message: result.message });
        return;
      }

      setIntakeStatus({ type: "success", message: result.message });
      resetIntake();
      form.reset();
      setActiveView("library");
      router.refresh();
    });
  };

  const handleReceiptReviewSave = (receipt: WorkspaceFinancialReceipt) => {
    if (!ownerId) {
      setReviewStatus({
        type: "error",
        message: "This workspace needs an owner profile before receipts can be reviewed.",
      });
      return;
    }

    const category = (reviewCategoryEdits[receipt.id] ?? receipt.category).trim();
    const propertyChanged = Object.prototype.hasOwnProperty.call(reviewPropertyEdits, receipt.id);
    const propertyId = propertyChanged ? reviewPropertyEdits[receipt.id] ?? null : undefined;
    const visibility = reviewVisibilityEdits[receipt.id] ?? (receipt.visibility === "private" ? "private" : "visible");
    const notifyOwner = Boolean(reviewNotifyEdits[receipt.id]) && visibility === "visible";
    const analysis = analyzeReceipt(receipt);

    startTransition(async () => {
      const result = await updateReceipt(receipt.id, ownerId, {
        workspaceId,
        category: category || suggestedCategory(receipt),
        ...(propertyChanged ? { propertyId } : {}),
        visibility,
        notifyOwner,
        analysis: {
          ...analysis,
          category: category || analysis.category,
        },
        analysisSource: receipt.analysisSource ?? "manual",
      });

      if (!result.ok) {
        setReviewStatus({ type: "error", message: result.message });
        return;
      }

      setReviewStatus({ type: "success", message: result.message });
      setReviewCategoryEdits((current) => {
        const next = { ...current };
        delete next[receipt.id];
        return next;
      });
      setReviewPropertyEdits((current) => {
        const next = { ...current };
        delete next[receipt.id];
        return next;
      });
      setReviewVisibilityEdits((current) => {
        const next = { ...current };
        delete next[receipt.id];
        return next;
      });
      setReviewNotifyEdits((current) => {
        const next = { ...current };
        delete next[receipt.id];
        return next;
      });
      router.refresh();
    });
  };

  return (
    <div id="finance-receipt-dashboard" className={styles.receiptConsole}>
      <div className={styles.receiptHeader}>
        <div>
          <h3 className={styles.cardTitle}>Receipt dashboard</h3>
          <p className={styles.receiptSubtitle}>
            Review incoming financial documents, search the archive, and spot vendor patterns.
          </p>
        </div>
        <div className={styles.receiptTotals}>
          <strong>{formatCents(totalCents)}</strong>
          <span>{filteredReceipts.length} receipt{filteredReceipts.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div
        className={`${styles.receiptExportPanel} ${
          exportStatus.type === "error" ? styles.receiptExportPanelError : ""
        } ${exportStatus.type === "success" ? styles.receiptExportPanelSuccess : ""}`}
      >
        <div>
          <span>Export</span>
          <strong>Receipt archive</strong>
          <p>{exportStatus.message}</p>
        </div>
        <div className={styles.receiptExportActions}>
          <div className={styles.receiptYearPicker} aria-label="Receipt export year">
            {receiptYears.map((year) => (
              <button
                key={year}
                type="button"
                className={exportYear === year ? styles.receiptYearPickerActive : ""}
                onClick={() => setExportYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={isPending || !ownerId || receipts.length === 0}
            onClick={handleExportReceipts}
          >
            <DownloadSimple size={14} weight="bold" />
            Export CSV
          </button>
        </div>
      </div>

      <div
        className={`${styles.receiptIntakePanel} ${
          intakeStatus.type === "error" ? styles.receiptIntakePanelError : ""
        } ${intakeStatus.type === "success" ? styles.receiptIntakePanelSuccess : ""}`}
      >
        <div>
          <span className={styles.receiptReviewBadge}>Intake</span>
          <strong>Collect a financial document</strong>
          <p>{intakeStatus.message}</p>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setIsIntakeOpen((current) => !current)}
        >
          {isIntakeOpen ? "Close intake" : "Add receipt"}
        </button>
      </div>

      {isIntakeOpen ? (
        <form className={styles.receiptIntakeForm} onSubmit={handleReceiptSubmit}>
          <label className={styles.field}>
            <span>Vendor</span>
            <input
              className={styles.textInput}
              value={intakeFields.vendor}
              onChange={(event) => updateIntakeField("vendor", event.target.value)}
              placeholder="Home Depot"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Amount</span>
            <input
              className={styles.textInput}
              value={intakeFields.amount}
              onChange={(event) => updateIntakeField("amount", event.target.value)}
              inputMode="decimal"
              placeholder="127.43"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Category</span>
            <input
              className={styles.textInput}
              value={intakeFields.category}
              onChange={(event) => updateIntakeField("category", event.target.value)}
              placeholder="Repairs"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Purchase date</span>
            <input
              className={styles.textInput}
              value={intakeFields.purchaseDate}
              onChange={(event) => updateIntakeField("purchaseDate", event.target.value)}
              pattern="\d{4}-\d{2}-\d{2}"
              placeholder="2026-05-27"
              required
            />
          </label>
          <label className={`${styles.field} ${styles.receiptNotesField}`}>
            <span>Notes</span>
            <textarea
              className={styles.textArea}
              value={intakeFields.notes}
              onChange={(event) => updateIntakeField("notes", event.target.value)}
              placeholder="What this receipt is for"
            />
          </label>
          <label className={`${styles.field} ${styles.receiptUploadField}`}>
            <span>Receipt file</span>
            <input
              className={styles.receiptFileInput}
              type="file"
              name="receiptFile"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setIntakeFile(file);
                setIntakeFileName(file?.name ?? null);
              }}
            />
            {intakeFileName ? <small>{intakeFileName}</small> : null}
          </label>
          {properties.length > 0 ? (
            <div className={styles.receiptIntakeProperty}>
              <span>Property</span>
              <div>
                {properties.map((property) => (
                  <button
                    key={property.id}
                    type="button"
                    className={intakeFields.propertyId === property.id ? styles.receiptPropertyButtonActive : ""}
                    onClick={() => updateIntakeField("propertyId", property.id)}
                  >
                    {property.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={intakeFields.propertyId === null ? styles.receiptPropertyButtonActive : ""}
                  onClick={() => updateIntakeField("propertyId", null)}
                >
                  No property
                </button>
              </div>
            </div>
          ) : null}
          {intakeAnalysis ? (
            <div className={styles.receiptAnalysisPreview}>
              <div>
                <span>Detected</span>
                <strong>{ANALYSIS_KIND_LABELS[intakeAnalysis.kind]}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{intakeAnalysis.category}</strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>{intakeAnalysis.confidence}</strong>
              </div>
              <div>
                <span>Source</span>
                <strong>
                  {intakeAnalysisSource === "document"
                    ? "Document"
                    : intakeAnalysisSource === "ai"
                      ? "AI"
                      : "Rules"}
                </strong>
              </div>
              <p>{intakeAnalysis.summary}</p>
              <p>{intakeAnalysis.reasons.join(", ")}</p>
            </div>
          ) : null}
          <label className={styles.receiptOwnerToggle}>
            <input
              type="checkbox"
              checked={intakeFields.ownerVisible}
              onChange={(event) => updateIntakeField("ownerVisible", event.target.checked)}
            />
            <span>
              Visible to owner
              <small>Shows in the owner portal financials view.</small>
            </span>
          </label>
          <label className={styles.receiptOwnerToggle} aria-disabled={!intakeFields.ownerVisible}>
            <input
              type="checkbox"
              checked={intakeFields.ownerVisible && intakeFields.notifyOwner}
              disabled={!intakeFields.ownerVisible}
              onChange={(event) => updateIntakeField("notifyOwner", event.target.checked)}
            />
            <span>
              Notify owner
              <small>Sends a portal notification when this visible receipt is saved.</small>
            </span>
          </label>
          <div className={styles.receiptIntakeActions}>
            <button type="button" className={styles.secondaryButton} onClick={resetIntake}>
              Reset
            </button>
            <button type="button" className={styles.secondaryButton} onClick={handleAnalyzeDraft} disabled={isPending}>
              <Sparkle size={14} weight="duotone" />
              {isPending ? "Analyzing" : "Analyze"}
            </button>
            <button type="submit" className={styles.primaryButton} disabled={isPending || !ownerId}>
              {isPending ? "Saving" : "Save receipt"}
            </button>
          </div>
        </form>
      ) : null}

      <div className={styles.receiptModeBar} aria-label="Receipt dashboard views">
        {(Object.keys(VIEW_LABELS) as ReceiptView[]).map((view) => {
          const Icon = VIEW_ICONS[view];
          return (
            <button
              key={view}
              type="button"
              className={`${styles.receiptModeButton} ${activeView === view ? styles.receiptModeButtonActive : ""}`}
              onClick={() => setActiveView(view)}
              aria-pressed={activeView === view}
            >
              <Icon size={15} weight="bold" />
              {VIEW_LABELS[view]}
              {view === "review" && reviewReceipts.length > 0 ? (
                <span>{reviewReceipts.length}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <label className={styles.receiptSearch}>
        <MagnifyingGlass size={16} weight="bold" />
        <span className={styles.srOnly}>Search receipts</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search vendor, amount, month, category, property, or signal"
        />
      </label>

      {query.trim() ? (
        <div className={styles.receiptSearchSummary}>
          <span>{filteredReceipts.length} closest match{filteredReceipts.length === 1 ? "" : "es"}</span>
          <button type="button" onClick={() => setQuery("")}>
            Clear
          </button>
        </div>
      ) : null}

      {activeView !== "review" && reviewStatus.message ? (
        <div
          className={`${styles.receiptReviewStatus} ${
            reviewStatus.type === "error" ? styles.receiptReviewStatusError : ""
          } ${reviewStatus.type === "success" ? styles.receiptReviewStatusSuccess : ""}`}
        >
          <Sparkle size={15} weight="duotone" />
          <span>{reviewStatus.message}</span>
        </div>
      ) : null}

      {paymentQueueReceipts.length > 0 ? (
        <section className={styles.receiptPaymentPanel} aria-label="Receipts that may need payment">
          <div className={styles.receiptPaymentHeader}>
            <div>
              <span className={styles.receiptReviewBadge}>To pay</span>
              <strong>{paymentQueueReceipts.length} document{paymentQueueReceipts.length === 1 ? "" : "s"} flagged</strong>
              <p>These uploads mention unpaid, past due, amount due, or balance due language.</p>
            </div>
            <span>{formatCents(paymentQueueReceipts.reduce((sum, receipt) => sum + receipt.amountCents, 0))}</span>
          </div>
          <div className={styles.receiptPaymentList}>
            {paymentQueueReceipts.slice(0, 4).map((receipt) => {
              const analysis = analyzeReceipt(receipt);
              return (
                <div key={receipt.id} className={styles.receiptPaymentCard}>
                  <div>
                    <strong>{receipt.vendor}</strong>
                    <span>
                      {formatCents(receipt.amountCents, receipt.currency)}. {receipt.propertyLabel ?? "No property"}.
                    </span>
                    <p>{analysis.summary}</p>
                  </div>
                  <span className={styles.receiptSource}>
                    {receipt.analysisSource ? ANALYSIS_SOURCE_LABELS[receipt.analysisSource] : analysis.confidence}
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
              );
            })}
          </div>
        </section>
      ) : null}

      {activeView === "review" ? (
        reviewReceipts.length === 0 ? (
          <div className={styles.receiptEmptyState}>
            <Sparkle size={18} weight="duotone" />
            <div>
              <strong>No receipts need review</strong>
              <span>When a receipt is missing a category or property, it will land here first.</span>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`${styles.receiptReviewStatus} ${
                reviewStatus.type === "error" ? styles.receiptReviewStatusError : ""
              } ${reviewStatus.type === "success" ? styles.receiptReviewStatusSuccess : ""}`}
            >
              <Sparkle size={15} weight="duotone" />
              <span>{reviewStatus.message}</span>
            </div>
            <div className={styles.receiptReviewList}>
              {reviewReceipts.map((receipt) => {
                const currentVisibility =
                  reviewVisibilityEdits[receipt.id] ?? (receipt.visibility === "private" ? "private" : "visible");
                const suggestion = suggestedCategory(receipt);
                const analysis = analyzeReceipt(receipt);
                return (
                  <article key={receipt.id} className={styles.receiptReviewCard}>
                    <div>
                      <span className={styles.receiptReviewBadge}>{receiptReviewReason(receipt)}</span>
                      <strong>{receipt.vendor}</strong>
                      <p>
                        {formatCents(receipt.amountCents, receipt.currency)}.{" "}
                        {cleanLabel(receipt.category, "Uncategorized")}.{" "}
                        {receipt.propertyLabel ?? "No property assigned"}.
                        {receipt.imageUrl ? " File attached." : " No file attached."}
                      </p>
                      <div className={styles.receiptAnalysisHint}>
                        <Sparkle size={13} weight="duotone" />
                        <span>
                          {ANALYSIS_KIND_LABELS[analysis.kind]}. {analysis.summary}
                        </span>
                      </div>
                      <div className={styles.receiptAnalysisReasons}>
                        {analysis.reasons.slice(0, 3).map((reason) => (
                          <span key={reason}>{reason}</span>
                        ))}
                      </div>
                      <div className={styles.receiptReviewControls}>
                        <label className={styles.field}>
                          <span>Category</span>
                          <input
                            className={styles.textInput}
                            value={reviewCategoryEdits[receipt.id] ?? receipt.category}
                            onChange={(event) =>
                              setReviewCategoryEdits((current) => ({
                                ...current,
                                [receipt.id]: event.target.value,
                              }))
                            }
                            placeholder={suggestion}
                          />
                        </label>
                        {properties.length > 0 ? (
                          <div className={styles.receiptPropertyChooser}>
                            <span>Property</span>
                            <div>
                              {properties.map((property) => {
                                const active =
                                  reviewPropertyEdits[receipt.id] === property.id
                                  || (!Object.prototype.hasOwnProperty.call(reviewPropertyEdits, receipt.id)
                                    && receipt.propertyLabel === property.label);
                                return (
                                  <button
                                    key={property.id}
                                    type="button"
                                    className={active ? styles.receiptPropertyButtonActive : ""}
                                    onClick={() =>
                                      setReviewPropertyEdits((current) => ({
                                        ...current,
                                        [receipt.id]: property.id,
                                      }))
                                    }
                                  >
                                    {property.label}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                className={
                                  reviewPropertyEdits[receipt.id] === null
                                  || (!Object.prototype.hasOwnProperty.call(reviewPropertyEdits, receipt.id)
                                    && !receipt.propertyLabel)
                                    ? styles.receiptPropertyButtonActive
                                    : ""
                                }
                                onClick={() =>
                                  setReviewPropertyEdits((current) => ({
                                    ...current,
                                    [receipt.id]: null,
                                  }))
                                }
                              >
                                No property
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className={styles.receiptVisibilityButtons} aria-label="Receipt owner visibility">
                          <button
                            type="button"
                            className={currentVisibility === "private" ? styles.receiptVisibilityButtonActive : ""}
                            onClick={() =>
                              setReviewVisibilityEdits((current) => ({
                                ...current,
                                [receipt.id]: "private",
                              }))
                            }
                          >
                            Admin only
                          </button>
                          <button
                            type="button"
                            className={currentVisibility === "visible" ? styles.receiptVisibilityButtonActive : ""}
                            onClick={() =>
                              setReviewVisibilityEdits((current) => ({
                                ...current,
                                [receipt.id]: "visible",
                              }))
                            }
                          >
                            Owner visible
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className={styles.receiptReviewRight}>
                      <span className={styles.receiptReviewDate}>{formatReceiptDate(receipt.purchaseDate)}</span>
                      {receipt.imageUrl ? (
                        <a
                          href={receipt.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.receiptFileLink}
                        >
                          <FileArrowUp size={12} weight="bold" />
                          File
                        </a>
                      ) : null}
                      <label
                        className={styles.receiptReviewNotify}
                        aria-disabled={currentVisibility !== "visible"}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(reviewNotifyEdits[receipt.id]) && currentVisibility === "visible"}
                          disabled={currentVisibility !== "visible"}
                          onChange={(event) =>
                            setReviewNotifyEdits((current) => ({
                              ...current,
                              [receipt.id]: event.target.checked,
                            }))
                          }
                        />
                        <span>Notify owner</span>
                      </label>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => handleReceiptReviewSave(receipt)}
                        disabled={isPending || !ownerId}
                      >
                        <CheckCircle size={14} weight="bold" />
                        Apply
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )
      ) : null}

      {activeView === "library" ? (
        receiptBuckets.length === 0 ? (
          <div className={styles.receiptEmptyState}>
            <Sparkle size={18} weight="duotone" />
            <div>
              <strong>No receipts match yet</strong>
              <span>Uploaded receipts will appear here in the same year and month structure you use in Drive.</span>
            </div>
          </div>
        ) : (
          <div className={styles.receiptYearList}>
            {receiptBuckets.map((bucket) => (
              <section key={bucket.year} className={styles.receiptYear}>
                <div className={styles.receiptYearHeader}>
                  <span>{bucket.year}</span>
                  <strong>
                    {formatCents(bucket.months.reduce((sum, month) => sum + month.totalCents, 0))}
                  </strong>
                </div>
                <div className={styles.receiptMonthList}>
                  {bucket.months.map((month) => (
                    <div key={`${bucket.year}-${month.month}`} className={styles.receiptMonthCard}>
                      <div className={styles.receiptMonth}>
                        <span>{month.month}</span>
                        <strong>{formatCents(month.totalCents)}</strong>
                      </div>
                      <div className={styles.receiptRows}>
                        {month.receipts.map((receipt) => renderReceiptRow(receipt))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )
      ) : null}

      {activeView === "insights" ? (
        filteredReceipts.length === 0 ? (
          <div className={styles.receiptEmptyState}>
            <Sparkle size={18} weight="duotone" />
            <div>
              <strong>No insights yet</strong>
              <span>Insights appear once receipts are uploaded or match the current search.</span>
            </div>
          </div>
        ) : (
          <div className={styles.receiptInsightGrid}>
            <ReceiptInsightCard title="Top vendors" summaries={vendorInsights} />
            <ReceiptInsightCard title="Categories" summaries={categoryInsights} />
            <div className={styles.receiptInsightCard}>
              <div className={styles.receiptInsightHeader}>
                <span>Possible recurring</span>
                <strong>{recurringSignals.length}</strong>
              </div>
              {recurringSignals.length === 0 ? (
                <p className={styles.receiptInsightEmpty}>No repeated vendors in this receipt set.</p>
              ) : (
                <div className={styles.receiptInsightRows}>
                  {recurringSignals.map((vendor) => (
                    <div key={vendor.label} className={styles.receiptInsightRow}>
                      <span>{vendor.label}</span>
                      <strong>
                        {vendor.count} receipts. {formatCents(vendor.totalCents, vendor.currency)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}

function formatReceiptDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "Needs date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ReceiptInsightCard({
  title,
  summaries,
}: {
  title: string;
  summaries: ReceiptSummary[];
}) {
  return (
    <div className={styles.receiptInsightCard}>
      <div className={styles.receiptInsightHeader}>
        <span>{title}</span>
        <strong>{summaries.length}</strong>
      </div>
      {summaries.length === 0 ? (
        <p className={styles.receiptInsightEmpty}>No matching receipts.</p>
      ) : (
        <div className={styles.receiptInsightRows}>
          {summaries.map((summary) => (
            <div key={summary.label} className={styles.receiptInsightRow}>
              <span>{summary.label}</span>
              <strong>
                {summary.count} receipts. {formatCents(summary.totalCents, summary.currency)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
