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

const RECEIPT_BUCKET = "property-documents";
const RECEIPT_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const RECEIPT_MAX_SIZE = 10 * 1024 * 1024;
const FINANCE_ANALYSIS_MODEL = "anthropic/claude-haiku-4-5";

export type ReceiptDraftAnalysisKind = "receipt" | "invoice" | "recurring" | "to_pay";

export type ReceiptDraftAnalysis = {
  category: string;
  kind: ReceiptDraftAnalysisKind;
  confidence: "high" | "medium" | "low";
  summary: string;
  reasons: string[];
  vendor?: string;
  amount?: string;
  purchaseDate?: string;
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  return (
    typeof candidate.category === "string"
    && (kind === "receipt" || kind === "invoice" || kind === "recurring" || kind === "to_pay")
    && (confidence === "high" || confidence === "medium" || confidence === "low")
    && typeof candidate.summary === "string"
    && Array.isArray(candidate.reasons)
    && candidate.reasons.every((reason) => typeof reason === "string")
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
  };
}

function buildFinanceAnalysisPrompt(input: ReceiptDraftAnalysisInput): string {
  return [
    "Classify this financial upload for a short term rental property management workspace.",
    "Return only JSON matching this schema:",
    '{"category":"string","kind":"receipt|invoice|recurring|to_pay","confidence":"high|medium|low","summary":"one plain sentence explaining what this was for","reasons":["short reason"],"vendor":"optional","amount":"optional","purchaseDate":"optional ISO date if clear"}',
    "Use kind to_pay when the document likely still needs payment.",
    "Use kind recurring when the document appears to repeat monthly, annually, or by subscription.",
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
    '{"category":"string","kind":"receipt|invoice|recurring|to_pay","confidence":"high|medium|low","summary":"one plain sentence explaining what this was for","reasons":["short reason"],"vendor":"optional","amount":"optional","purchaseDate":"optional ISO date if clear"}',
    "Use kind to_pay when the document likely still needs payment.",
    "Use kind recurring when the document appears to repeat monthly, annually, or by subscription.",
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
    vendor: parsed.vendor?.trim() || undefined,
    amount: parsed.amount?.trim() || undefined,
    purchaseDate: parsed.purchaseDate?.trim() || undefined,
  };
}

async function analyzeReceiptDraftWithAi(input: ReceiptDraftAnalysisInput): Promise<ReceiptDraftAnalysis | null> {
  const apiKey = process.env.OPENROUTER_API_PARCEL ?? process.env.OPENROUTER_API_KEY;
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
  const apiKey = process.env.OPENROUTER_API_PARCEL ?? process.env.OPENROUTER_API_KEY;
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

// ---------------------------------------------------------------------------
// RECEIPTS
// ---------------------------------------------------------------------------

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
      link: "/portal/financials",
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
      has_file: Boolean(imageUrl),
    },
  });

  revalidatePath(`/admin/workspaces/${data.workspaceId}`);
  revalidatePath("/portal/notifications");
  revalidatePath("/portal/financials");
  return { ok: true, message: "Receipt added." };
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
        link: "/portal/financials",
      });
    }
  }

  revalidatePath(`/admin/workspaces/${data.workspaceId ?? ownerId}`);
  revalidatePath("/portal/notifications");
  revalidatePath("/portal/financials");
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
  revalidatePath("/portal/financials");
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

// ---------------------------------------------------------------------------
// CSV EXPORT
// ---------------------------------------------------------------------------

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
      escapeCsvField(propertyLabel),
      escapeCsvField(receipt.visibility),
      escapeCsvField(receipt.notes),
    ];

    rows.push(row.join(","));
  }

  return { ok: true, csv: rows.join("\n") };
}
