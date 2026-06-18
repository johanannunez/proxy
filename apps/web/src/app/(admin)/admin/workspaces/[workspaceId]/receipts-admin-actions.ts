"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { OwnerReceiptRow } from "@/app/(workspace)/workspace/finances/receipts-types";

const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/heic", "image/heif", "image/bmp", "image/tiff",
  "application/pdf",
]);

const EDITABLE_FIELDS = new Set([
  "vendor", "amount", "currency", "category", "purchase_date", "notes",
  "visibility", "reimbursement_status", "payment_source",
  "claim_provider", "claim_reference", "reimbursed_at",
]);

async function requireAdmin(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return { error: "Admin access required." };
  }
  return { error: null };
}

const AI_SYSTEM_PROMPT = `You analyze receipts and financial documents for a short-term rental property management company.

You will receive receipts, invoices, bank statements, property management notifications (TurboTenant, Hospitable, Airbnb, VRBO, etc.), deposit confirmations, utility bills, and other financial documents.

Respond ONLY with JSON in this exact format:
{
  "documentType": "receipt",
  "summary": "One or two sentence description of what this document shows.",
  "vendor": "Vendor or company name",
  "amount": 127.43,
  "date": "2026-03-15",
  "category": "Maintenance"
}

Rules:
- vendor: Extract the name of the company, service, or payee. For TurboTenant documents use "TurboTenant". For Airbnb use "Airbnb". For utility bills use the utility company name.
- amount: The primary dollar amount. Must be a number with no currency symbol or commas.
- date: Transaction or document date in YYYY-MM-DD format. Only fall back to today if truly absent.
- category: One of: Maintenance, Cleaning, Supplies, Utilities, Insurance, Taxes, Furnishings, Marketing, Travel, Professional Services, Other.
- documentType: "receipt" for most documents. Use "invoice" for unpaid bills.
- summary: A concise factual sentence describing the document.`;

type AiResult = {
  summary: string;
  vendor: string;
  amount: number;
  date: string;
  category: string;
  documentType: string;
};

async function analyzeFile(buffer: Buffer, mimeType: string, fileName: string): Promise<AiResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[receipts-admin AI] ANTHROPIC_API_KEY not set — skipping AI analysis");
    return null;
  }

  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  if (!isImage && !isPdf) return null;

  const base64 = buffer.toString("base64");
  const content: Array<Record<string, unknown>> = [];

  if (isImage) {
    const mediaType = mimeType === "image/heic" || mimeType === "image/heif" ? "image/jpeg" : mimeType;
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
      console.error("[receipts-admin AI] Anthropic API error:", res.status, errText);
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
      amount: typeof parsed.amount === "number" ? parsed.amount : parseFloat(String(parsed.amount).replace(/[^0-9.]/g, "")) || 0,
      date: parsed.date ?? new Date().toISOString().split("T")[0],
      category: parsed.category ?? "Other",
      documentType: parsed.documentType ?? "receipt",
    };
  } catch {
    return null;
  }
}

const RECEIPT_SELECT =
  "id, vendor, amount, currency, category, purchase_date, notes, image_url, storage_path, reviewed_at, analysis_kind, analysis_summary, analysis_source, payment_source, reimbursement_status, line_items, file_hash, property:properties(name, address_line1, city, state)";

function mapDocumentKind(type: string | undefined): "receipt" | "invoice" | "recurring" | "to_pay" {
  if (type === "invoice") return "invoice";
  if (type === "recurring") return "recurring";
  return "receipt";
}

export async function uploadReceiptForOwner(
  formData: FormData,
  ownerId: string,
  workspaceId: string,
): Promise<
  | { receiptId: string; storagePath: string; signedUrl: string; receipt: OwnerReceiptRow }
  | { duplicate: true; existingReceipt: OwnerReceiptRow; signedUrl: string | null }
  | { error: string }
> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided" };
  if (file.size > MAX_SIZE_BYTES) return { error: "File too large (max 50 MB)" };
  if (!ALLOWED_MIME.has(file.type)) return { error: `File type not allowed: ${file.type}` };

  const svc = createServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileHash = createHash("sha256").update(buffer).digest("hex");

  const db = untypedDatabase(svc);
  const { data: existing } = await db
    .from("owner_receipts")
    .select(RECEIPT_SELECT)
    .eq("owner_id", ownerId)
    .eq("file_hash", fileHash)
    .maybeSingle();

  if (existing) {
    const existingReceipt = existing as unknown as OwnerReceiptRow;
    const { data: urlData } = existingReceipt.storage_path
      ? await svc.storage.from("receipts").createSignedUrl(existingReceipt.storage_path, 3600)
      : { data: null };
    return { duplicate: true as const, existingReceipt, signedUrl: urlData?.signedUrl ?? null };
  }

  const now = new Date();
  const year = now.getFullYear().toString();
  const month = now.toLocaleString("en-US", { month: "long" });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${ownerId}/${year}/${month}/${now.getTime()}_${safeName}`;

  const { error: uploadError } = await svc.storage
    .from("receipts")
    .upload(storagePath, buffer, { contentType: file.type, cacheControl: "3600" });
  if (uploadError) return { error: uploadError.message };

  const { data: urlData } = await svc.storage.from("receipts").createSignedUrl(storagePath, 3600);
  const signedUrl = urlData?.signedUrl ?? "";

  const aiResult = await analyzeFile(buffer, file.type, file.name);
  const purchaseDate = aiResult?.date ?? now.toISOString().split("T")[0];
  const vendor = aiResult?.vendor ?? file.name.replace(/\.[^.]+$/, "");

  const { data: receipt, error: insertError } = await db
    .from<OwnerReceiptRow>("owner_receipts")
    .insert({
      owner_id: ownerId,
      created_by: ownerId,
      vendor,
      amount: aiResult?.amount ?? 0,
      currency: "USD",
      category: aiResult?.category ?? "Other",
      purchase_date: purchaseDate,
      notes: null,
      image_url: null,
      storage_path: storagePath,
      reviewed_at: null,
      analysis_kind: mapDocumentKind(aiResult?.documentType),
      analysis_source: aiResult ? "document" : "manual",
      analysis_summary: aiResult?.summary ?? null,
      payment_source: "owner_paid",
      reimbursement_status: "none",
      visibility: "visible",
      file_hash: fileHash,
    } as unknown)
    .select(RECEIPT_SELECT)
    .single();

  if (insertError || !receipt) return { error: insertError?.message ?? "Failed to create receipt" };

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { receiptId: receipt.id, storagePath, signedUrl, receipt };
}

export async function updateReceiptFieldAdmin(id: string, field: string, value: unknown, workspaceId: string): Promise<void> {
  const { error: authError } = await requireAdmin();
  if (authError) throw new Error(authError);

  if (!EDITABLE_FIELDS.has(field)) throw new Error(`Field '${field}' is not editable.`);

  const svc = createServiceClient();
  const db = untypedDatabase(svc);
  await db.from("owner_receipts").update({ [field]: value } as unknown).eq("id", id);
  revalidatePath(`/admin/workspaces/${workspaceId}`);
}

export async function markReceiptReviewedAdmin(id: string, workspaceId: string): Promise<void> {
  const { error: authError } = await requireAdmin();
  if (authError) throw new Error(authError);

  const svc = createServiceClient();
  const db = untypedDatabase(svc);
  await db.from("owner_receipts").update({ reviewed_at: new Date().toISOString() } as unknown).eq("id", id);
  revalidatePath(`/admin/workspaces/${workspaceId}`);
}

export async function deleteReceiptAdmin(id: string, storagePath: string | null, workspaceId: string): Promise<void> {
  const { error: authError } = await requireAdmin();
  if (authError) throw new Error(authError);

  const svc = createServiceClient();
  if (storagePath) {
    await svc.storage.from("receipts").remove([storagePath]);
  }
  const db = untypedDatabase(svc);
  await db.from("owner_receipts").delete().eq("id", id);
  revalidatePath(`/admin/workspaces/${workspaceId}`);
}

export async function getReceiptSignedUrlAdmin(storagePath: string): Promise<string | null> {
  const { error: authError } = await requireAdmin();
  if (authError) return null;

  const svc = createServiceClient();
  const db = untypedDatabase(svc);
  // Verify the path belongs to an actual receipt row before issuing a URL.
  const { data: receipt } = await db
    .from("owner_receipts")
    .select("id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (!receipt) return null;

  const { data } = await svc.storage.from("receipts").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

export async function toggleReceiptVisibility(id: string, visible: boolean, workspaceId: string): Promise<void> {
  const { error: authError } = await requireAdmin();
  if (authError) throw new Error(authError);

  const svc = createServiceClient();
  const db = untypedDatabase(svc);
  await db.from("owner_receipts").update({ visibility: visible ? "visible" : "hidden" } as unknown).eq("id", id);
  revalidatePath(`/admin/workspaces/${workspaceId}`);
}
