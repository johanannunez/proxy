/* eslint-disable @typescript-eslint/no-explicit-any */
// owner_timeline, block_requests, and related tables are not yet in the
// generated Supabase types. Remove this disable once types are regenerated.
"use server";

import "server-only";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";
import { logTimelineEvent } from "@/lib/timeline";
import { createNotification } from "@/lib/notifications";
import { sendMessage } from "@/app/(admin)/admin/inbox/actions";

const RECEIPT_BUCKET = "property-documents";
const RECEIPT_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;
const FINANCE_ANALYSIS_MODEL = "anthropic/claude-haiku-4-5";

export type ReceiptDraftAnalysisKind = "receipt" | "invoice" | "recurring" | "to_pay";
export type ReceiptPaymentSource =
  | "owner_card"
  | "company_card"
  | "owner_paid"
  | "vendor_invoice"
  | "airbnb_claim"
  | "insurance_claim"
  | "other";
export type ReceiptReimbursementStatus =
  | "none"
  | "reimbursement_needed"
  | "claim_needed"
  | "claim_submitted"
  | "reimbursed"
  | "denied_writeoff";
export type ReceiptClaimProvider = "airbnb" | "insurance" | "other";

export type ReceiptDraftLineItem = {
  label: string;
  amount?: string;
};

export type ReceiptDraftAnalysis = {
  category: string;
  kind: ReceiptDraftAnalysisKind;
  confidence: "high" | "medium" | "low";
  summary: string;
  reasons: string[];
  lineItems?: ReceiptDraftLineItem[];
  vendor?: string;
  amount?: string;
  purchaseDate?: string;
  paymentSource?: ReceiptPaymentSource;
  reimbursementStatus?: ReceiptReimbursementStatus;
  claimProvider?: ReceiptClaimProvider | null;
  claimReference?: string;
  reimbursedAt?: string;
};

export type ReceiptDraftAnalysisInput = {
  vendor: string;
  category: string;
  notes?: string | null;
  amount?: string | null;
  purchaseDate?: string | null;
  fileName?: string | null;
  file?: File | null;
};

export type ReceiptAnalysisSource = "document" | "ai" | "rules" | "manual";
export type FinanceRequestType =
  | "ach_authorization"
  | "card_authorization"
  | "receipt_upload"
  | "reimbursement_details"
  | "claim_evidence";
export type FinanceRequestStatus = "draft" | "sent" | "viewed" | "completed" | "cancelled";
export type FinanceRequestDeliveryMethod = "email" | "sms";

const FINANCE_REQUEST_TYPES: FinanceRequestType[] = [
  "ach_authorization",
  "card_authorization",
  "receipt_upload",
  "reimbursement_details",
  "claim_evidence",
];

const FINANCE_REQUEST_STATUSES: FinanceRequestStatus[] = [
  "draft",
  "sent",
  "viewed",
  "completed",
  "cancelled",
];

// Helpers

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase: null as never,
      userId: null as never,
      error: "You must be signed in.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return {
      supabase: null as never,
      userId: null as never,
      error: "Admin access required.",
    };
  }

  return { supabase, userId: user.id, error: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function insertTimelineEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  data: {
    eventType: string;
    title: string;
    body?: string;
    propertyId?: string;
  },
) {
  const { error } = await (supabase as any).from("owner_timeline").insert({
    owner_id: ownerId,
    event_type: data.eventType,
    title: data.title,
    body: data.body ?? null,
    property_id: data.propertyId ?? null,
  });

  return error;
}

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function messageToHtml(value: string): string {
  return escapeHtml(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function isFinanceRequestType(value: string): value is FinanceRequestType {
  return FINANCE_REQUEST_TYPES.includes(value as FinanceRequestType);
}

function isFinanceRequestStatus(value: string): value is FinanceRequestStatus {
  return FINANCE_REQUEST_STATUSES.includes(value as FinanceRequestStatus);
}

function safeStorageName(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60) || "receipt";
}

function parseAiJson(raw: string): unknown | null {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  const jsonText = match?.[0] ?? cleaned;

  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    return null;
  }
}

function isReceiptDraftAnalysis(value: unknown): value is ReceiptDraftAnalysis {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind;
  const confidence = candidate.confidence;
  const paymentSource = candidate.paymentSource;
  const reimbursementStatus = candidate.reimbursementStatus;
  const claimProvider = candidate.claimProvider;
  return (
    typeof candidate.category === "string"
    && (kind === "receipt" || kind === "invoice" || kind === "recurring" || kind === "to_pay")
    && (confidence === "high" || confidence === "medium" || confidence === "low")
    && typeof candidate.summary === "string"
    && Array.isArray(candidate.reasons)
    && candidate.reasons.every((reason) => typeof reason === "string")
    && (
      candidate.lineItems === undefined
      || (
        Array.isArray(candidate.lineItems)
        && candidate.lineItems.every((item) => {
          if (!item || typeof item !== "object") return false;
          const lineItem = item as Record<string, unknown>;
          return typeof lineItem.label === "string"
            && (lineItem.amount === undefined || typeof lineItem.amount === "string");
        })
      )
    )
    && (
      paymentSource === undefined
      || paymentSource === "owner_card"
      || paymentSource === "company_card"
      || paymentSource === "owner_paid"
      || paymentSource === "vendor_invoice"
      || paymentSource === "airbnb_claim"
      || paymentSource === "insurance_claim"
      || paymentSource === "other"
    )
    && (
      reimbursementStatus === undefined
      || reimbursementStatus === "none"
      || reimbursementStatus === "reimbursement_needed"
      || reimbursementStatus === "claim_needed"
      || reimbursementStatus === "claim_submitted"
      || reimbursementStatus === "reimbursed"
      || reimbursementStatus === "denied_writeoff"
    )
    && (
      claimProvider === undefined
      || claimProvider === null
      || claimProvider === "airbnb"
      || claimProvider === "insurance"
      || claimProvider === "other"
    )
  );
}

function analyzeReceiptDraftLocally(input: ReceiptDraftAnalysisInput): ReceiptDraftAnalysis {
  const text = [
    input.vendor,
    input.category,
    input.notes,
    input.amount,
    input.purchaseDate,
    input.fileName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const reasons: string[] = [];
  let category = input.category.trim();
  let kind: ReceiptDraftAnalysisKind = "receipt";
  let confidence: ReceiptDraftAnalysis["confidence"] = "low";
  let paymentSource: ReceiptPaymentSource = "owner_card";
  let reimbursementStatus: ReceiptReimbursementStatus = "none";
  let claimProvider: ReceiptClaimProvider | null = null;

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

  if (/(company card|parcel card|business card|company paid|parcel paid|reimburse parcel)/.test(text)) {
    paymentSource = "company_card";
    reimbursementStatus = "reimbursement_needed";
    reasons.push("company card reimbursement signal");
    confidence = "high";
  } else if (/(owner paid|paid directly|owner reimbursement|reimburse owner|owner invoice)/.test(text)) {
    paymentSource = "owner_paid";
    reimbursementStatus = "reimbursement_needed";
    reasons.push("owner reimbursement signal");
    confidence = "high";
  }

  if (/(airbnb|resolution center|claim|damage reimbursement|host guarantee)/.test(text)) {
    paymentSource = paymentSource === "owner_card" ? "airbnb_claim" : paymentSource;
    reimbursementStatus = /(submitted|filed|opened claim|claim number)/.test(text)
      ? "claim_submitted"
      : "claim_needed";
    claimProvider = "airbnb";
    reasons.push("Airbnb claim signal");
    confidence = "high";
  } else if (/(insurance claim|adjuster|deductible|policy claim)/.test(text)) {
    paymentSource = paymentSource === "owner_card" ? "insurance_claim" : paymentSource;
    reimbursementStatus = /(submitted|filed|claim number)/.test(text)
      ? "claim_submitted"
      : "claim_needed";
    claimProvider = "insurance";
    reasons.push("insurance claim signal");
    confidence = "high";
  } else if (
    /(vendor invoice|service invoice|cleaning invoice|carpet cleaning invoice|contractor invoice)/.test(text)
    && reimbursementStatus === "none"
  ) {
    paymentSource = "vendor_invoice";
    reimbursementStatus = "claim_needed";
    claimProvider = "airbnb";
    reasons.push("service invoice may need claim review");
    confidence = confidence === "low" ? "medium" : confidence;
  }

  const categorySignals: Array<{ category: string; pattern: RegExp; reason: string }> = [
    { category: "Repairs", pattern: /(home depot|lowe|hardware|repair|plumb|electric|hvac|maintenance)/, reason: "repair vendor or wording" },
    { category: "Cleaning", pattern: /(clean|laundry|linen|turnover|housekeep)/, reason: "cleaning wording" },
    { category: "Utilities", pattern: /(utility|power|electric|water|gas|internet|wifi)/, reason: "utility wording" },
    { category: "Supplies", pattern: /(supply|costco|amazon|target|walmart)/, reason: "supply vendor" },
    { category: "Insurance", pattern: /(insurance|premium|policy)/, reason: "insurance wording" },
    { category: "Taxes", pattern: /(tax|county|permit|license)/, reason: "tax or permit wording" },
  ];

  const genericCategory = !category || ["other", "misc", "uncategorized", "receipt"].includes(category.toLowerCase());
  for (const signal of categorySignals) {
    if (signal.pattern.test(text)) {
      if (genericCategory) category = signal.category;
      reasons.push(signal.reason);
      confidence = confidence === "low" ? "medium" : confidence;
      break;
    }
  }

  if (!category) category = "Owner expense";
  if (reasons.length === 0) reasons.push("manual review recommended");

  return {
    category,
    kind,
    confidence,
    summary: reasons.includes("manual review recommended")
      ? "Review the uploaded document and confirm what this expense was for."
      : `Likely ${category.toLowerCase()} ${kind.replace("_", " ")} based on the available receipt context.`,
    reasons,
    lineItems: input.amount ? [{ label: category, amount: input.amount }] : undefined,
    paymentSource,
    reimbursementStatus,
    claimProvider,
  };
}

function buildFinanceAnalysisPrompt(input: ReceiptDraftAnalysisInput): string {
  return [
    "Classify this financial upload for a short term rental property management workspace.",
    "Return only JSON matching this schema:",
    '{"category":"string","kind":"receipt|invoice|recurring|to_pay","confidence":"high|medium|low","summary":"one plain sentence explaining what this was for","reasons":["short reason"],"lineItems":[{"label":"item or fee","amount":"optional"}],"vendor":"optional","amount":"optional","purchaseDate":"optional ISO date if clear","paymentSource":"owner_card|company_card|owner_paid|vendor_invoice|airbnb_claim|insurance_claim|other","reimbursementStatus":"none|reimbursement_needed|claim_needed|claim_submitted|reimbursed|denied_writeoff","claimProvider":"airbnb|insurance|other|null","claimReference":"optional","reimbursedAt":"optional ISO date"}',
    "Use kind to_pay when the document likely still needs payment.",
    "Use kind recurring when the document appears to repeat monthly, annually, or by subscription.",
    "Default to paymentSource owner_card and reimbursementStatus none unless the document clearly says otherwise.",
    "Use company_card with reimbursement_needed when Proxy or a company card paid and money should move back.",
    "Use owner_paid with reimbursement_needed when the owner paid directly and needs to be reimbursed.",
    "Use vendor_invoice with claim_needed when a service invoice likely needs Airbnb or insurance claim processing.",
    "Use airbnb_claim or insurance_claim with claim_needed or claim_submitted when claim language is present.",
    "Use category names like Repairs, Cleaning, Utilities, Supplies, Insurance, Taxes, Software, Professional services, Mortgage, Owner expense.",
    `Vendor: ${input.vendor || "unknown"}`,
    `Current category: ${input.category || "unknown"}`,
    `Amount: ${input.amount || "unknown"}`,
    `Purchase date: ${input.purchaseDate || "unknown"}`,
    `File name: ${input.fileName || "none"}`,
    `Notes: ${input.notes || "none"}`,
  ].join("\n");
}

function buildFinanceDocumentPrompt(input: ReceiptDraftAnalysisInput): string {
  return [
    "Analyze this uploaded finance document for a short term rental property management workspace.",
    "Extract what the document was for, whether it is already paid or needs payment, and whether it looks recurring.",
    "Return only JSON matching this schema:",
    '{"category":"string","kind":"receipt|invoice|recurring|to_pay","confidence":"high|medium|low","summary":"one plain sentence explaining what this was for","reasons":["short reason"],"lineItems":[{"label":"item or fee","amount":"optional"}],"vendor":"optional","amount":"optional","purchaseDate":"optional ISO date if clear","paymentSource":"owner_card|company_card|owner_paid|vendor_invoice|airbnb_claim|insurance_claim|other","reimbursementStatus":"none|reimbursement_needed|claim_needed|claim_submitted|reimbursed|denied_writeoff","claimProvider":"airbnb|insurance|other|null","claimReference":"optional","reimbursedAt":"optional ISO date"}',
    "Use kind to_pay when the document likely still needs payment.",
    "Use kind recurring when the document appears to repeat monthly, annually, or by subscription.",
    "Default to paymentSource owner_card and reimbursementStatus none unless the document clearly says otherwise.",
    "Use company_card with reimbursement_needed when Proxy or a company card paid and money should move back.",
    "Use owner_paid with reimbursement_needed when the owner paid directly and needs to be reimbursed.",
    "Use vendor_invoice with claim_needed when a service invoice likely needs Airbnb or insurance claim processing.",
    "Use airbnb_claim or insurance_claim with claim_needed or claim_submitted when claim language is present.",
    "Prefer category names like Repairs, Cleaning, Utilities, Supplies, Insurance, Taxes, Software, Professional services, Mortgage, Owner expense.",
    `Admin-entered vendor: ${input.vendor || "unknown"}`,
    `Admin-entered category: ${input.category || "unknown"}`,
    `Admin-entered amount: ${input.amount || "unknown"}`,
    `Admin-entered purchase date: ${input.purchaseDate || "unknown"}`,
    `Admin notes: ${input.notes || "none"}`,
    `File name: ${input.fileName || "none"}`,
  ].join("\n");
}

function normalizeReceiptDraftAnalysis(parsed: ReceiptDraftAnalysis): ReceiptDraftAnalysis {
  return {
    category: parsed.category.trim() || "Owner expense",
    kind: parsed.kind,
    confidence: parsed.confidence,
    summary: parsed.summary.trim() || "Review the uploaded document and confirm what this expense was for.",
    reasons: parsed.reasons.map((reason) => reason.trim()).filter(Boolean).slice(0, 4),
    lineItems: parsed.lineItems
      ?.map((item) => ({
        label: item.label.trim(),
        amount: item.amount?.trim() || undefined,
      }))
      .filter((item) => item.label.length > 0)
      .slice(0, 8),
    vendor: parsed.vendor?.trim() || undefined,
    amount: parsed.amount?.trim() || undefined,
    purchaseDate: parsed.purchaseDate?.trim() || undefined,
    paymentSource: parsed.paymentSource ?? "owner_card",
    reimbursementStatus: parsed.reimbursementStatus ?? "none",
    claimProvider: parsed.claimProvider ?? null,
    claimReference: parsed.claimReference?.trim() || undefined,
    reimbursedAt: parsed.reimbursedAt?.trim() || undefined,
  };
}

function normalizeReceiptLineItems(
  lineItems: ReceiptDraftLineItem[] | null | undefined,
): ReceiptDraftLineItem[] {
  return (lineItems ?? [])
    .map((item) => ({
      label: item.label.trim(),
      amount: item.amount?.replace(/[$,]/g, "").trim() || undefined,
    }))
    .filter((item) => item.label.length > 0)
    .slice(0, 20);
}

async function analyzeReceiptDraftWithAi(input: ReceiptDraftAnalysisInput): Promise<ReceiptDraftAnalysis | null> {
  const apiKey = process.env.OPENROUTER_API_PROXY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FINANCE_ANALYSIS_MODEL,
        max_tokens: 500,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You classify property management finance uploads. Always return valid JSON only.",
          },
          { role: "user", content: buildFinanceAnalysisPrompt(input) },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[finance-analysis] OpenRouter error:", await response.text());
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = parseAiJson(data.choices?.[0]?.message?.content ?? "");
    if (!isReceiptDraftAnalysis(parsed)) return null;

    return normalizeReceiptDraftAnalysis(parsed);
  } catch (error) {
    console.error("[finance-analysis] analysis failed:", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function analyzeFinanceImageWithOpenRouter(input: ReceiptDraftAnalysisInput): Promise<ReceiptDraftAnalysis | null> {
  const file = input.file;
  const apiKey = process.env.OPENROUTER_API_PROXY ?? process.env.OPENROUTER_API_KEY;
  if (!apiKey || !file || file.size === 0) return null;
  if (!file.type.startsWith("image/") || !RECEIPT_ALLOWED_TYPES.includes(file.type) || file.size > RECEIPT_MAX_SIZE) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FINANCE_ANALYSIS_MODEL,
        max_tokens: 700,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You classify property management finance uploads. Always return valid JSON only.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: buildFinanceDocumentPrompt(input) },
              {
                type: "image_url",
                image_url: { url: `data:${file.type};base64,${base64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[finance-analysis] OpenRouter image error:", await response.text());
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const parsed = parseAiJson(data.choices?.[0]?.message?.content ?? "");
    if (!isReceiptDraftAnalysis(parsed)) return null;
    return normalizeReceiptDraftAnalysis(parsed);
  } catch (error) {
    console.error("[finance-analysis] image analysis failed:", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function analyzeFinanceDocumentWithClaude(input: ReceiptDraftAnalysisInput): Promise<ReceiptDraftAnalysis | null> {
  const file = input.file;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !file || file.size === 0) return null;
  if (!RECEIPT_ALLOWED_TYPES.includes(file.type) || file.size > RECEIPT_MAX_SIZE) return null;

  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) return null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");
    const content: Array<Record<string, unknown>> = [];

    if (isImage) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: file.type === "image/heic" ? "image/jpeg" : file.type,
          data: base64,
        },
      });
    }

    if (isPdf) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
    }

    content.push({
      type: "text",
      text: buildFinanceDocumentPrompt(input),
    });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system: "You classify property management finance uploads. Always return valid JSON only.",
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      console.error("[finance-analysis] Anthropic error:", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const parsed = parseAiJson(data.content?.[0]?.text ?? "");
    if (!isReceiptDraftAnalysis(parsed)) return null;
    return normalizeReceiptDraftAnalysis(parsed);
  } catch (error) {
    console.error("[finance-analysis] document analysis failed:", error);
    return null;
  }
}

async function uploadReceiptFile(
  ownerId: string,
  file: File | null | undefined,
): Promise<{ ok: true; url: string | null } | { ok: false; message: string }> {
  if (!file || file.size === 0) return { ok: true, url: null };

  if (!RECEIPT_ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, message: "Only PDF, JPG, PNG, and WebP receipts are allowed." };
  }

  if (file.size > RECEIPT_MAX_SIZE) {
    return { ok: false, message: "Receipt files must be under 10 MB." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const entropy = randomBytes(4).toString("hex");
  const path = `${ownerId}/receipts/${Date.now()}-${entropy}-${safeStorageName(file.name)}.${extension}`;
  const bytes = await file.arrayBuffer();
  const service = createServiceClient();
  const { error } = await service.storage
    .from(RECEIPT_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: file.type, upsert: false });

  if (error) {
    return { ok: false, message: "Receipt upload failed. Please try again." };
  }

  const { data } = service.storage.from(RECEIPT_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

// Receipts

export async function analyzeReceiptDraft(
  input: ReceiptDraftAnalysisInput,
): Promise<{ ok: true; analysis: ReceiptDraftAnalysis; source: ReceiptAnalysisSource } | { ok: false; message: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const normalizedInput: ReceiptDraftAnalysisInput = {
    vendor: input.vendor.trim().slice(0, 120),
    category: input.category.trim().slice(0, 80),
    notes: input.notes?.trim().slice(0, 1000) ?? null,
    amount: input.amount?.trim().slice(0, 40) ?? null,
    purchaseDate: input.purchaseDate?.trim().slice(0, 40) ?? null,
    fileName: input.fileName?.trim().slice(0, 180) ?? null,
    file: input.file ?? null,
  };

  const documentAnalysis = await analyzeFinanceDocumentWithClaude(normalizedInput);
  if (documentAnalysis) return { ok: true, analysis: documentAnalysis, source: "document" };

  const imageAnalysis = await analyzeFinanceImageWithOpenRouter(normalizedInput);
  if (imageAnalysis) return { ok: true, analysis: imageAnalysis, source: "document" };

  const aiAnalysis = await analyzeReceiptDraftWithAi(normalizedInput);
  if (aiAnalysis) return { ok: true, analysis: aiAnalysis, source: "ai" };

  return {
    ok: true,
    analysis: analyzeReceiptDraftLocally(normalizedInput),
    source: "rules",
  };
}

export async function createReceipt(
  ownerId: string,
  data: {
    workspaceId: string;
    vendor: string;
    amount: number;
    category: string;
    purchaseDate: string;
    propertyId?: string;
    notes?: string;
    visibility?: "visible" | "private";
    imageUrl?: string;
    file?: File | null;
    notifyOwner?: boolean;
    analysis?: ReceiptDraftAnalysis | null;
    analysisSource?: ReceiptAnalysisSource | null;
    paymentSource?: ReceiptPaymentSource;
    reimbursementStatus?: ReceiptReimbursementStatus;
    claimProvider?: ReceiptClaimProvider | null;
    claimReference?: string | null;
    reimbursedAt?: string | null;
    lineItems?: ReceiptDraftLineItem[] | null;
  },
): Promise<{ ok: boolean; message: string }> {
  const { supabase, userId, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const uploadResult = await uploadReceiptFile(ownerId, data.file);
  if (!uploadResult.ok) return { ok: false, message: uploadResult.message };
  const imageUrl = uploadResult.url ?? data.imageUrl ?? null;

  const { error } = await (supabase as any).from("owner_receipts").insert({
    owner_id: ownerId,
    property_id: data.propertyId ?? null,
    vendor: data.vendor,
    amount: data.amount,
    currency: "USD",
    category: data.category,
    purchase_date: data.purchaseDate,
    image_url: imageUrl,
    analysis_kind: data.analysis?.kind ?? null,
    analysis_confidence: data.analysis?.confidence ?? null,
    analysis_summary: data.analysis?.summary ?? null,
    analysis_reasons: data.analysis?.reasons ?? [],
    analysis_source: data.analysisSource ?? (data.analysis ? "manual" : null),
    payment_source: data.paymentSource ?? data.analysis?.paymentSource ?? "owner_card",
    reimbursement_status:
      data.reimbursementStatus ?? data.analysis?.reimbursementStatus ?? "none",
    claim_provider: data.claimProvider ?? data.analysis?.claimProvider ?? null,
    claim_reference: data.claimReference ?? data.analysis?.claimReference ?? null,
    reimbursed_at: data.reimbursedAt ?? data.analysis?.reimbursedAt ?? null,
    line_items: normalizeReceiptLineItems(data.lineItems ?? data.analysis?.lineItems ?? []),
    notes: data.notes ?? null,
    visibility: data.visibility ?? "visible",
    created_by: userId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (data.notifyOwner && (data.visibility ?? "visible") === "visible") {
    await createNotification({
      ownerId,
      type: "receipt_available",
      title: `Receipt available: ${data.vendor}`,
      body: `${formatCurrency(data.amount)} categorized as ${data.category}.`,
      link: "/workspace/finances",
    });
  }

  void logTimelineEvent({
    ownerId,
    eventType: "receipt_added",
    category: "financial",
    title: `Receipt added: ${formatCurrency(data.amount)} at ${data.vendor} (${data.category})`,
    propertyId: data.propertyId,
    visibility: "owner",
    metadata: {
      vendor: data.vendor,
      amount: data.amount,
      category: data.category,
      analysis_kind: data.analysis?.kind ?? null,
      analysis_source: data.analysisSource ?? null,
      payment_source: data.paymentSource ?? data.analysis?.paymentSource ?? "owner_card",
      reimbursement_status:
        data.reimbursementStatus ?? data.analysis?.reimbursementStatus ?? "none",
      claim_provider: data.claimProvider ?? data.analysis?.claimProvider ?? null,
      has_file: Boolean(imageUrl),
    },
  });

  revalidatePath(`/admin/workspaces/${data.workspaceId}`);
  revalidatePath("/workspace/notifications");
  revalidatePath("/workspace/finances");
  return { ok: true, message: "Receipt added." };
}

export async function createFinanceRequest(input: {
  workspaceId: string;
  contactId: string | null;
  ownerId: string | null;
  requestType: FinanceRequestType;
  deliveryMethod: FinanceRequestDeliveryMethod;
  message: string;
  requestUrl: string;
}): Promise<{ ok: boolean; message: string; requestId?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };
  if (!input.ownerId) {
    return { ok: false, message: "This workspace needs an owner profile before requests can be sent." };
  }
  if (!isFinanceRequestType(input.requestType)) {
    return { ok: false, message: "Choose a valid finance request type." };
  }
  if (input.deliveryMethod !== "email" && input.deliveryMethod !== "sms") {
    return { ok: false, message: "Choose email or SMS delivery." };
  }

  const trimmedMessage = input.message.trim();
  if (!trimmedMessage) return { ok: false, message: "Add a request message before sending." };

  const delivery = await sendMessage({
    ownerId: input.ownerId,
    deliveryMethod: input.deliveryMethod,
    subject: "Finance request from Proxy",
    body: messageToHtml(trimmedMessage),
  });

  if ("error" in delivery && delivery.error) {
    return { ok: false, message: delivery.error };
  }

  const sentAt = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from("finance_requests")
    .insert({
      workspace_id: input.workspaceId,
      contact_id: input.contactId,
      request_type: input.requestType,
      status: "sent",
      delivery_method: input.deliveryMethod,
      message: trimmedMessage,
      request_url: input.requestUrl,
      last_sent_at: sentAt,
    })
    .select("id")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true, message: "Finance request sent.", requestId: data?.id };
}

export async function resendFinanceRequest(input: {
  workspaceId: string;
  ownerId: string | null;
  requestId: string;
}): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };
  if (!input.ownerId) {
    return { ok: false, message: "This workspace needs an owner profile before requests can be resent." };
  }

  const { data: request, error: requestError } = await (supabase as any)
    .from("finance_requests")
    .select("request_type, status, delivery_method, message")
    .eq("id", input.requestId)
    .eq("workspace_id", input.workspaceId)
    .single();

  if (requestError || !request) {
    return { ok: false, message: requestError?.message ?? "Finance request not found." };
  }
  if (!isFinanceRequestStatus(request.status) || request.status === "completed") {
    return { ok: false, message: "Completed requests cannot be resent." };
  }

  const body = typeof request.message === "string" ? request.message : "";
  const deliveryMethod = request.delivery_method === "sms" ? "sms" : "email";
  const delivery = await sendMessage({
    ownerId: input.ownerId,
    deliveryMethod,
    subject: "Finance request from Proxy",
    body: messageToHtml(body),
  });

  if ("error" in delivery && delivery.error) {
    return { ok: false, message: delivery.error };
  }

  const { error } = await (supabase as any)
    .from("finance_requests")
    .update({
      status: "sent",
      last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("workspace_id", input.workspaceId);

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true, message: "Finance request resent." };
}

export async function completeFinanceRequest(input: {
  workspaceId: string;
  requestId: string;
}): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const { error } = await (supabase as any)
    .from("finance_requests")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("workspace_id", input.workspaceId);

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true, message: "Finance request marked received." };
}

export async function cancelFinanceRequest(input: {
  workspaceId: string;
  requestId: string;
}): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const { error } = await (supabase as any)
    .from("finance_requests")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .eq("workspace_id", input.workspaceId);

  if (error) return { ok: false, message: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true, message: "Finance request cancelled." };
}

export async function updateReceipt(
  receiptId: string,
  ownerId: string,
  data: Partial<{
    workspaceId: string;
    vendor: string;
    amount: number;
    category: string;
    purchaseDate: string;
    propertyId: string | null;
    notes: string | null;
    visibility: "visible" | "private";
    imageUrl: string | null;
    notifyOwner: boolean;
    analysis: ReceiptDraftAnalysis | null;
    analysisSource: ReceiptAnalysisSource | null;
    paymentSource: ReceiptPaymentSource;
    reimbursementStatus: ReceiptReimbursementStatus;
    claimProvider: ReceiptClaimProvider | null;
    claimReference: string | null;
    reimbursedAt: string | null;
    lineItems: ReceiptDraftLineItem[] | null;
  }>,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.vendor !== undefined) updatePayload.vendor = data.vendor;
  if (data.amount !== undefined) updatePayload.amount = data.amount;
  if (data.category !== undefined) updatePayload.category = data.category;
  if (data.purchaseDate !== undefined)
    updatePayload.purchase_date = data.purchaseDate;
  if (data.propertyId !== undefined)
    updatePayload.property_id = data.propertyId;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.visibility !== undefined) updatePayload.visibility = data.visibility;
  if (data.imageUrl !== undefined) updatePayload.image_url = data.imageUrl;
  if (data.analysis !== undefined) {
    updatePayload.analysis_kind = data.analysis?.kind ?? null;
    updatePayload.analysis_confidence = data.analysis?.confidence ?? null;
    updatePayload.analysis_summary = data.analysis?.summary ?? null;
    updatePayload.analysis_reasons = data.analysis?.reasons ?? [];
  }
  if (data.analysisSource !== undefined) {
    updatePayload.analysis_source = data.analysisSource;
  }
  if (data.paymentSource !== undefined) updatePayload.payment_source = data.paymentSource;
  if (data.reimbursementStatus !== undefined)
    updatePayload.reimbursement_status = data.reimbursementStatus;
  if (data.claimProvider !== undefined) updatePayload.claim_provider = data.claimProvider;
  if (data.claimReference !== undefined) updatePayload.claim_reference = data.claimReference;
  if (data.reimbursedAt !== undefined) updatePayload.reimbursed_at = data.reimbursedAt;
  if (data.lineItems !== undefined)
    updatePayload.line_items = normalizeReceiptLineItems(data.lineItems);

  const { error } = await (supabase as any)
    .from("owner_receipts")
    .update(updatePayload)
    .eq("id", receiptId)
    .eq("owner_id", ownerId);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (data.notifyOwner && data.visibility === "visible") {
    const { data: receipt } = await (supabase as any)
      .from("owner_receipts")
      .select("vendor, amount, currency, category")
      .eq("id", receiptId)
      .eq("owner_id", ownerId)
      .single();

    if (receipt) {
      await createNotification({
        ownerId,
        type: "receipt_available",
        title: `Receipt available: ${receipt.vendor}`,
        body: `${formatCurrency(Number(receipt.amount), receipt.currency ?? "USD")} categorized as ${receipt.category}.`,
        link: "/workspace/finances",
      });
    }
  }

  revalidatePath(`/admin/workspaces/${data.workspaceId ?? ownerId}`);
  revalidatePath("/workspace/notifications");
  revalidatePath("/workspace/finances");
  return { ok: true, message: "Receipt updated." };
}

export async function deleteReceipt(
  receiptId: string,
  ownerId: string,
  workspaceId?: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const { data: receipt } = await (supabase as any)
    .from("owner_receipts")
    .select("vendor, amount, currency, category")
    .eq("id", receiptId)
    .eq("owner_id", ownerId)
    .single();

  const { error } = await (supabase as any)
    .from("owner_receipts")
    .delete()
    .eq("id", receiptId)
    .eq("owner_id", ownerId);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (receipt) {
    void logTimelineEvent({
      ownerId,
      eventType: "receipt_deleted",
      category: "financial",
      title: `Receipt deleted: ${formatCurrency(
        Number(receipt.amount),
        receipt.currency ?? "USD",
      )} at ${receipt.vendor} (${receipt.category})`,
      visibility: "admin_only",
    });
  }

  revalidatePath(`/admin/workspaces/${workspaceId ?? ownerId}`);
  revalidatePath("/workspace/finances");
  return { ok: true, message: "Receipt deleted." };
}

export async function toggleReceiptVisibility(
  receiptId: string,
  ownerId: string,
  workspaceId?: string,
): Promise<{ ok: boolean; message: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const { data: receipt, error: fetchError } = await (supabase as any)
    .from("owner_receipts")
    .select("visibility")
    .eq("id", receiptId)
    .eq("owner_id", ownerId)
    .single();

  if (fetchError || !receipt) {
    return { ok: false, message: "Receipt not found." };
  }

  const newVisibility = receipt.visibility === "private" ? "visible" : "private";

  const { error } = await (supabase as any)
    .from("owner_receipts")
    .update({
      visibility: newVisibility,
      updated_at: new Date().toISOString(),
    })
    .eq("id", receiptId)
    .eq("owner_id", ownerId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath(`/admin/workspaces/${workspaceId ?? ownerId}`);
  return {
    ok: true,
    message: `Receipt is now ${
      newVisibility === "visible" ? "visible to owner" : "private"
    }.`,
  };
}

// CSV export

export async function exportReceiptsCSV(
  ownerId: string,
  year: number,
): Promise<{ ok: boolean; csv?: string; message?: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { ok: false, message: authError };

  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data: receipts, error } = await (supabase as any)
    .from("owner_receipts")
    .select(
      `
      purchase_date,
      vendor,
      amount,
      currency,
      category,
      payment_source,
      reimbursement_status,
      claim_provider,
      claim_reference,
      reimbursed_at,
      line_items,
      visibility,
      notes,
      property:properties(name, address_line1, city, state, postal_code)
    `,
    )
    .eq("owner_id", ownerId)
    .gte("purchase_date", startDate)
    .lte("purchase_date", endDate)
    .order("purchase_date", { ascending: true });

  if (error) {
    return { ok: false, message: error.message };
  }

  const headers = [
    "Date",
    "Vendor",
    "Amount",
    "Currency",
    "Category",
    "Payment Source",
    "Reimbursement Status",
    "Claim Provider",
    "Claim Reference",
    "Reimbursed At",
    "Line Items",
    "Property",
    "Visibility",
    "Notes",
  ];

  const rows: string[] = [headers.join(",")];

  for (const receipt of receipts ?? []) {
    const propertyAddress = receipt.property
      ? [
          receipt.property.address_line1,
          receipt.property.city,
          receipt.property.state,
          receipt.property.postal_code,
        ]
          .filter(Boolean)
          .join(", ")
      : "";
    const propertyLabel = receipt.property
      ? receipt.property.name ?? propertyAddress
      : "";

    const amountNumber = Number(receipt.amount);
    const amountFormatted = Number.isFinite(amountNumber)
      ? amountNumber.toFixed(2)
      : "";

    const row = [
      escapeCsvField(receipt.purchase_date),
      escapeCsvField(receipt.vendor),
      escapeCsvField(amountFormatted),
      escapeCsvField(receipt.currency ?? "USD"),
      escapeCsvField(receipt.category),
      escapeCsvField(receipt.payment_source),
      escapeCsvField(receipt.reimbursement_status),
      escapeCsvField(receipt.claim_provider),
      escapeCsvField(receipt.claim_reference),
      escapeCsvField(receipt.reimbursed_at),
      escapeCsvField(JSON.stringify(receipt.line_items ?? [])),
      escapeCsvField(propertyLabel),
      escapeCsvField(receipt.visibility),
      escapeCsvField(receipt.notes),
    ];

    rows.push(row.join(","));
  }

  return { ok: true, csv: rows.join("\n") };
}
