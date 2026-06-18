"use server";

import "server-only";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { OwnerReceiptRow } from "./receipts-types";

const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif", "image/bmp", "image/tiff",
  "application/pdf",
]);

const AI_SYSTEM_PROMPT = `You analyze receipts and financial documents for a short-term rental property management company.

You will receive receipts, invoices, bank statements, property management notifications (TurboTenant, Hospitable, Airbnb, VRBO, etc.), deposit confirmations, utility bills, and other financial documents.

Respond ONLY with JSON in this exact format:
{
  "documentType": "receipt",
  "summary": "One or two sentence description of what this document shows.",
  "vendor": "Vendor or company name",
  "vendorConfidence": "high",
  "amount": 127.43,
  "amountConfidence": "medium",
  "date": "2026-03-15",
  "dateConfidence": "high",
  "category": "Maintenance",
  "categoryConfidence": "high"
}

Rules:
- vendor: Extract the name of the company, service, or payee. For TurboTenant documents use "TurboTenant". For Airbnb use "Airbnb". For utility bills use the utility company name. For bank transfers use the bank name.
- amount: The primary dollar amount on the document. Must be a number (no currency symbol, no commas). For deposit returns or refunds, still use the positive amount.
- date: The transaction date, document date, or statement date in YYYY-MM-DD format. Look carefully — it is almost always present. Only fall back to today if truly absent.
- category: One of: Maintenance, Cleaning, Supplies, Utilities, Insurance, Taxes, Furnishings, Marketing, Travel, Professional Services, Other.
- documentType: "receipt" for most documents. Use "invoice" for unpaid bills. Use "other" if not a financial document at all.
- summary: A concise factual sentence describing what this document shows (e.g. "Amazon receipt for cleaning supplies totaling $45.99 on March 3, 2026").
- For each extracted field, also output a confidence level: "high" (clearly visible), "medium" (reasonable inference), or "low" (uncertain guess). Include vendorConfidence, amountConfidence, dateConfidence, categoryConfidence.`;

type AiResult = {
  summary: string;
  vendor: string;
  vendorConfidence: "high" | "medium" | "low";
  amount: number;
  amountConfidence: "high" | "medium" | "low";
  date: string;
  dateConfidence: "high" | "medium" | "low";
  category: string;
  categoryConfidence: "high" | "medium" | "low";
  documentType: string;
};

function parseConfidence(val: unknown): "high" | "medium" | "low" {
  if (val === "medium" || val === "low") return val;
  return "high";
}

async function analyzeFile(buffer: Buffer, mimeType: string, fileName: string): Promise<AiResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[receipts AI] ANTHROPIC_API_KEY not set — skipping AI analysis");
    return null;
  }

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  if (!isImage && !isPdf) return null;

  const base64 = buffer.toString("base64");
  const content: Array<Record<string, unknown>> = [];

  if (isImage) {
    const mediaType = mimeType === "image/heic" ? "image/jpeg" : mimeType;
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
    content.push({ type: "text", text: `Analyze this receipt/document (filename: ${fileName}). Respond with JSON only.` });
  } else {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } });
    content.push({ type: "text", text: `Analyze this PDF document (filename: ${fileName}). Respond with JSON only.` });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: AI_SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      console.error("[receipts AI] Anthropic API error:", res.status, errText);
      return null;
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (!text) return null;

    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    return {
      summary: parsed.summary ?? "",
      vendor: parsed.vendor ?? "Unknown vendor",
      vendorConfidence: parseConfidence(parsed.vendorConfidence),
      amount: typeof parsed.amount === "number" ? parsed.amount : parseFloat(String(parsed.amount).replace(/[^0-9.]/g, "")) || 0,
      amountConfidence: parseConfidence(parsed.amountConfidence),
      date: parsed.date ?? new Date().toISOString().split("T")[0],
      dateConfidence: parseConfidence(parsed.dateConfidence),
      category: parsed.category ?? "Other",
      categoryConfidence: parseConfidence(parsed.categoryConfidence),
      documentType: parsed.documentType ?? "receipt",
    };
  } catch {
    return null;
  }
}

function buildAnalysisSummary(aiResult: AiResult): string {
  const confJson = JSON.stringify({
    v: aiResult.vendorConfidence,
    a: aiResult.amountConfidence,
    d: aiResult.dateConfidence,
    c: aiResult.categoryConfidence,
  });
  return `${aiResult.summary}|CONF:${confJson}`;
}

const RECEIPT_SELECT =
  "id, vendor, amount, currency, category, purchase_date, notes, image_url, storage_path, reviewed_at, analysis_kind, analysis_summary, analysis_source, payment_source, reimbursement_status, line_items, file_hash, starred_at, archived_at, review_notes, tags, property:properties(name, address_line1, city, state)";

const EDITABLE_FIELDS = new Set([
  "vendor",
  "amount",
  "currency",
  "category",
  "purchase_date",
  "notes",
  "review_notes",
  "tags",
]);

function mapDocumentKind(type: string | undefined): "receipt" | "invoice" | "recurring" | "to_pay" {
  if (type === "invoice") return "invoice";
  if (type === "recurring") return "recurring";
  return "receipt";
}

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  return { userId: user.id };
}

async function writeAuditLog(
  db: ReturnType<typeof untypedDatabase>,
  receiptId: string,
  userId: string,
  action: string,
  field?: string | null,
  oldValue?: string | null,
  newValue?: string | null,
): Promise<void> {
  try {
    await db.from("receipt_audit_log").insert({
      receipt_id: receiptId,
      changed_by: userId,
      action,
      field: field ?? null,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    } as unknown);
  } catch {
    // Audit log failures are non-blocking
  }
}

export async function uploadReceipt(formData: FormData): Promise<
  | { receiptId: string; storagePath: string; signedUrl: string; receipt: OwnerReceiptRow }
  | { duplicate: true; existingReceipt: OwnerReceiptRow; signedUrl: string | null }
  | { error: string }
> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided" };
  if (file.size > MAX_SIZE_BYTES) return { error: "File too large (max 50 MB)" };
  if (!ALLOWED_MIME.has(file.type)) return { error: `File type not allowed: ${file.type}` };

  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const db = untypedDatabase(client);
  const { data: existing } = await db
    .from("owner_receipts")
    .select(RECEIPT_SELECT)
    .eq("owner_id", user.id)
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existing) {
    const existingReceipt = existing as unknown as OwnerReceiptRow;
    const { data: urlData } = existingReceipt.storage_path
      ? await client.storage.from("receipts").createSignedUrl(existingReceipt.storage_path, 3600)
      : { data: null };
    return { duplicate: true as const, existingReceipt, signedUrl: urlData?.signedUrl ?? null };
  }

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = now.toLocaleString("en-US", { month: "long" });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${year}/${month}/${now.getTime()}_${safeName}`;

  // Run storage upload and AI analysis in parallel — they are independent
  const [uploadResult, aiResult] = await Promise.all([
    client.storage.from("receipts").upload(storagePath, buffer, { contentType: file.type, cacheControl: "3600" }),
    analyzeFile(buffer, file.type, file.name),
  ]);
  const { error: uploadError } = uploadResult;
  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = await client.storage
    .from("receipts")
    .createSignedUrl(storagePath, 3600);
  const signedUrl = urlData?.signedUrl ?? "";

  const purchaseDate = aiResult?.date ?? now.toISOString().split("T")[0];
  const vendor = aiResult?.vendor ?? file.name.replace(/\.[^.]+$/, "");

  // Check for recurring: same vendor (case-insensitive) + amount within 10% + date within 32 days
  let resolvedKind = mapDocumentKind(aiResult?.documentType);
  if (aiResult && resolvedKind === "receipt") {
    const amount = aiResult.amount;
    const dateStr = aiResult.date;
    const thirtyTwoDaysAgo = new Date(dateStr);
    thirtyTwoDaysAgo.setDate(thirtyTwoDaysAgo.getDate() - 32);
    const thirtyTwoDaysLater = new Date(dateStr);
    thirtyTwoDaysLater.setDate(thirtyTwoDaysLater.getDate() + 32);

    const { data: recurringMatch } = await db
      .from("owner_receipts")
      .select("id")
      .eq("owner_id", user.id)
      .filter("vendor", "ilike", aiResult.vendor)
      .filter("amount", "gte", String(amount * 0.9))
      .filter("amount", "lte", String(amount * 1.1))
      .filter("purchase_date", "gte", thirtyTwoDaysAgo.toISOString().split("T")[0])
      .filter("purchase_date", "lte", thirtyTwoDaysLater.toISOString().split("T")[0])
      .limit(1);

    if (Array.isArray(recurringMatch) && recurringMatch.length > 0) {
      resolvedKind = "recurring";
    }
  }

  const analysisSummary = aiResult ? buildAnalysisSummary(aiResult) : null;

  const { data: receipt, error: insertError } = await db
    .from<OwnerReceiptRow>("owner_receipts")
    .insert({
      owner_id: user.id,
      created_by: user.id,
      vendor,
      amount: aiResult?.amount ?? 0,
      currency: "USD",
      category: aiResult?.category ?? "Other",
      purchase_date: purchaseDate,
      notes: null,
      image_url: null,
      storage_path: storagePath,
      reviewed_at: null,
      analysis_kind: resolvedKind,
      analysis_source: aiResult ? "document" : "manual",
      analysis_summary: analysisSummary,
      payment_source: "owner_paid",
      reimbursement_status: "none",
      visibility: "visible",
      file_hash: fileHash,
    } as unknown)
    .select(RECEIPT_SELECT)
    .single();

  if (insertError || !receipt) return { error: insertError?.message ?? "Failed to create receipt" };

  await writeAuditLog(db, receipt.id, user.id, "upload");

  revalidatePath("/workspace/finances");
  return { receiptId: receipt.id, storagePath, signedUrl, receipt };
}

export async function updateReceiptField(
  id: string,
  field: string,
  value: unknown,
): Promise<void> {
  if (!EDITABLE_FIELDS.has(field)) throw new Error(`Field '${field}' is not editable.`);

  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);

  const client = await createClient();
  const db = untypedDatabase(client);
  await db
    .from("owner_receipts")
    .update({ [field]: value } as unknown)
    .eq("id", id)
    .eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function markReceiptReviewed(id: string): Promise<void> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);

  const client = await createClient();
  const db = untypedDatabase(client);
  await db
    .from("owner_receipts")
    .update({ reviewed_at: new Date().toISOString() } as unknown)
    .eq("id", id)
    .eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function deleteReceipt(id: string, storagePath: string | null): Promise<void> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);

  const svc = createServiceClient();
  const db = untypedDatabase(svc);
  const { data: receipt } = await db
    .from("owner_receipts")
    .select("id, storage_path")
    .eq("id", id)
    .eq("owner_id", auth.userId)
    .maybeSingle();

  if (!receipt) throw new Error("Receipt not found.");

  const receiptRow = receipt as { storage_path?: unknown };
  const ownedStoragePath =
    typeof receiptRow.storage_path === "string" ? receiptRow.storage_path : null;
  if (storagePath && storagePath !== ownedStoragePath) {
    throw new Error("Receipt file does not match.");
  }

  await writeAuditLog(db, id, auth.userId, "delete");

  if (ownedStoragePath) {
    await svc.storage.from("receipts").remove([ownedStoragePath]);
  }

  await db.from("owner_receipts").delete().eq("id", id).eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function getReceiptSignedUrl(storagePath: string): Promise<string | null> {
  const auth = await requireUserId();
  if ("error" in auth) return null;

  const client = await createClient();
  const db = untypedDatabase(client);
  const { data: receipt } = await db
    .from("owner_receipts")
    .select("id")
    .eq("storage_path", storagePath)
    .eq("owner_id", auth.userId)
    .maybeSingle();
  if (!receipt) return null;

  const { data } = await client.storage
    .from("receipts")
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export async function starReceipt(id: string): Promise<void> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);
  const client = await createClient();
  const db = untypedDatabase(client);
  await db.from("owner_receipts").update({ starred_at: new Date().toISOString() } as unknown).eq("id", id).eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function unstarReceipt(id: string): Promise<void> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);
  const client = await createClient();
  const db = untypedDatabase(client);
  await db.from("owner_receipts").update({ starred_at: null } as unknown).eq("id", id).eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function archiveReceipt(id: string): Promise<void> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);
  const client = await createClient();
  const db = untypedDatabase(client);
  await db.from("owner_receipts").update({ archived_at: new Date().toISOString() } as unknown).eq("id", id).eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function unarchiveReceipt(id: string): Promise<void> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);
  const client = await createClient();
  const db = untypedDatabase(client);
  await db.from("owner_receipts").update({ archived_at: null } as unknown).eq("id", id).eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function updateReceiptTags(id: string, tags: string[]): Promise<void> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);
  const client = await createClient();
  const db = untypedDatabase(client);
  await db.from("owner_receipts").update({ tags } as unknown).eq("id", id).eq("owner_id", auth.userId);
  revalidatePath("/workspace/finances");
}

export async function exportReceiptsAsCsv(): Promise<string> {
  const auth = await requireUserId();
  if ("error" in auth) throw new Error(auth.error);
  const client = await createClient();
  const db = untypedDatabase(client);

  const { data, error } = await db
    .from("owner_receipts")
    .select(RECEIPT_SELECT)
    .eq("owner_id", auth.userId)
    .eq("visibility", "visible")
    .order("purchase_date", { ascending: false });

  if (error || !data) return "";

  const rows = data as unknown as OwnerReceiptRow[];

  const headers = ["Vendor", "Amount", "Currency", "Category", "Date", "Type", "Reviewed", "Tags", "Notes", "Summary"];
  const escape = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  const csvRows = rows.map((r) => [
    escape(r.vendor),
    escape(r.amount),
    escape(r.currency ?? "USD"),
    escape(r.category),
    escape(r.purchase_date),
    escape(r.analysis_kind ?? "receipt"),
    escape(r.reviewed_at ? "Yes" : "No"),
    escape((r.tags ?? []).join(", ")),
    escape(r.notes),
    escape(r.analysis_summary ? r.analysis_summary.split("|CONF:")[0].trim() : ""),
  ].join(","));

  return [headers.join(","), ...csvRows].join("\n");
}

export type AuditLogEntry = {
  id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
};

export async function getReceiptAuditLog(receiptId: string): Promise<AuditLogEntry[]> {
  const auth = await requireUserId();
  if ("error" in auth) return [];
  const client = await createClient();
  const db = untypedDatabase(client);
  const { data } = await db
    .from("receipt_audit_log")
    .select("id, action, field, old_value, new_value, changed_at")
    .eq("receipt_id", receiptId)
    .order("changed_at", { ascending: false })
    .limit(10);
  return (data ?? []) as AuditLogEntry[];
}
