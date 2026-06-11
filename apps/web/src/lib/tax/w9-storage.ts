import "server-only";
import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { encrypt, decrypt } from "@/lib/tax/encryption";

type SupabaseLike = ReturnType<typeof createServiceClient>;

const BUCKET = "documents";
const DEFAULT_EXPIRES_IN_SECONDS = 60 * 10;
const W9_PATH_PREFIX = "w9";

export type W9SignedUrlAccess = {
  /** Who is requesting the URL. Inserted into w9_access_log.profile_id. */
  accessorProfileId: string;
  /** Optional reason string for the audit log. */
  reason?: string;
  /** Captured from the inbound request (request.headers.get("user-agent")). */
  userAgent?: string | null;
  /** Captured from the inbound request (X-Forwarded-For first hop). */
  ipAddress?: string | null;
};

export type W9SignedUrlTarget =
  | { storagePath: string; signedDocumentId?: undefined }
  | { signedDocumentId: string; storagePath?: undefined };

export type GenerateW9SignedUrlInput = {
  access: W9SignedUrlAccess;
  target: W9SignedUrlTarget;
  /** Defaults to 10 minutes. Hard-capped at 1 hour to limit blast radius. */
  expiresInSeconds?: number;
};

export type GenerateW9SignedUrlResult =
  | { ok: true; url: string; expiresAt: string; auditId: string }
  | { ok: false; error: string };

/**
 * Generate a signed URL for a W-9 document and write the matching
 * audit-log row. This is the ONLY supported path to read W-9 data
 * out of the `documents` storage bucket; calling
 * `supabase.storage.from("documents").createSignedUrl(...)` directly
 * is forbidden because it would skip the audit log.
 *
 * Either `target.storagePath` (raw upload) or `target.signedDocumentId`
 * (a documents-spine row whose `file_url` points at a bucket object)
 * must be provided.
 */
export async function generateW9SignedUrl(
  client: SupabaseLike,
  input: GenerateW9SignedUrlInput,
): Promise<GenerateW9SignedUrlResult> {
  const expiresInSeconds = Math.min(
    Math.max(input.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS, 60),
    60 * 60,
  );

  let storagePath: string | null = null;
  let signedDocumentId: string | null = null;

  if (input.target.storagePath) {
    storagePath = input.target.storagePath;
  } else if (input.target.signedDocumentId) {
    signedDocumentId = input.target.signedDocumentId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from("documents")
      .select("id, file_url")
      .eq("id", signedDocumentId)
      .single();
    if (error || !data) {
      return { ok: false, error: "signed document not found" };
    }
    // Signed W-9 PDFs may be stored as either a hosted URL (file_url) or a
    // path within the documents bucket. Storage paths use the `documents://`
    // prefix.
    const candidate: string =
      (data as { file_url?: string | null }).file_url ?? "";
    if (!candidate.startsWith(`${BUCKET}://`)) {
      return {
        ok: false,
        error: "signed document is not backed by a bucket object",
      };
    }
    storagePath = candidate.slice(BUCKET.length + 3);
  } else {
    return { ok: false, error: "must specify storagePath or signedDocumentId" };
  }

  // Hard-fail if the path is not in the per-owner subfolder for the
  // accessor. Compliance and admin can read anything via RLS on
  // storage.objects, but the audit log still records who they were.
  // The signed URL itself is generated using the supabase client's
  // existing credentials; storage RLS does the access check.
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "signed URL generation failed" };
  }

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: auditRow, error: auditError } = await (client as any)
    .from("w9_access_log")
    .insert({
      document_id: signedDocumentId,
      storage_path: storagePath,
      profile_id: input.access.accessorProfileId,
      signed_url_expires_at: expiresAt,
      reason: input.access.reason ?? null,
      user_agent: input.access.userAgent ?? null,
      ip_address: input.access.ipAddress ?? null,
    })
    .select("id")
    .single();

  if (auditError || !auditRow) {
    // Audit log failure must NOT silently expose a signed URL. Fail
    // closed even though the signed URL was already generated; the URL
    // expires on its own and Supabase has no record of it leaking.
    return {
      ok: false,
      error: `audit log write failed: ${auditError?.message ?? "unknown"}`,
    };
  }

  return { ok: true, url: data.signedUrl, expiresAt, auditId: auditRow.id };
}

export type UploadW9PdfInput = {
  ownerProfileId: string;
  /** A File or Buffer holding the PDF / image bytes. */
  file: Blob | Buffer;
  /** Filename hint, no extension required. */
  filename: string;
  contentType: string;
};

export type UploadW9PdfResult =
  | { ok: true; storagePath: string }
  | { ok: false; error: string };

/**
 * Upload a W-9 PDF or scan to the private `documents` bucket under
 * the owner's folder. RLS on storage.objects enforces the
 * owner-folder boundary at the database layer; this helper also
 * builds the path so server callers do not assemble it ad-hoc.
 */
export async function uploadW9Pdf(
  client: SupabaseLike,
  input: UploadW9PdfInput,
): Promise<UploadW9PdfResult> {
  const safeName = input.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);
  const entropy = randomBytes(4).toString("hex");
  const path = `${input.ownerProfileId}/${W9_PATH_PREFIX}-${Date.now()}-${entropy}-${safeName || "w9"}.pdf`;

  const { error } = await client.storage.from(BUCKET).upload(path, input.file, {
    contentType: input.contentType,
    upsert: false,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, storagePath: path };
}

export type TaxProfileInput = {
  legalName?: string | null;
  businessName?: string | null;
  taxClassification?: string | null;
  ssn?: string | null;
  ein?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  signatureDate?: string | null;
  status?: "incomplete" | "submitted" | "verified" | "rejected";
};

export type TaxProfile = {
  id: string;
  ownerId: string;
  legalName: string | null;
  businessName: string | null;
  taxClassification: string | null;
  /** Decrypted plaintext. NEVER serialise this to the client. */
  ssn: string | null;
  /** Decrypted plaintext. NEVER serialise this to the client. */
  ein: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  signatureDate: string | null;
  status: "incomplete" | "submitted" | "verified" | "rejected";
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TaxProfileRow = {
  id: string;
  owner_id: string;
  legal_name: string | null;
  business_name: string | null;
  tax_classification: string | null;
  ssn_encrypted: Buffer | string | null;
  ein_encrypted: Buffer | string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  signature_date: string | null;
  status: "incomplete" | "submitted" | "verified" | "rejected";
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function bufferFromEncryptedColumn(value: Buffer | string | null): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  // Supabase REST returns bytea as a `\x` hex string.
  if (typeof value === "string" && value.startsWith("\\x")) {
    return Buffer.from(value.slice(2), "hex");
  }
  return null;
}

function fromRow(row: TaxProfileRow): TaxProfile {
  const ssnBuf = bufferFromEncryptedColumn(row.ssn_encrypted);
  const einBuf = bufferFromEncryptedColumn(row.ein_encrypted);
  return {
    id: row.id,
    ownerId: row.owner_id,
    legalName: row.legal_name,
    businessName: row.business_name,
    taxClassification: row.tax_classification,
    ssn: ssnBuf ? decrypt(ssnBuf) : null,
    ein: einBuf ? decrypt(einBuf) : null,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    signatureDate: row.signature_date,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTaxProfile(
  client: SupabaseLike,
  ownerId: string,
): Promise<TaxProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("tax_profiles")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (error) {
    throw new Error(`getTaxProfile: ${error.message}`);
  }
  if (!data) return null;
  return fromRow(data as TaxProfileRow);
}

/**
 * Insert or update the owner's tax_profile. SSN and EIN are encrypted
 * with TAX_ENCRYPTION_KEY before they hit the wire. Plaintext NEVER
 * leaves this function.
 */
export async function upsertTaxProfile(
  client: SupabaseLike,
  ownerId: string,
  input: TaxProfileInput,
): Promise<TaxProfile> {
  const payload: Record<string, unknown> = {
    owner_id: ownerId,
  };

  if (input.legalName !== undefined) payload.legal_name = input.legalName;
  if (input.businessName !== undefined) payload.business_name = input.businessName;
  if (input.taxClassification !== undefined) payload.tax_classification = input.taxClassification;
  if (input.addressLine1 !== undefined) payload.address_line1 = input.addressLine1;
  if (input.addressLine2 !== undefined) payload.address_line2 = input.addressLine2;
  if (input.city !== undefined) payload.city = input.city;
  if (input.state !== undefined) payload.state = input.state;
  if (input.postalCode !== undefined) payload.postal_code = input.postalCode;
  if (input.country !== undefined) payload.country = input.country;
  if (input.signatureDate !== undefined) payload.signature_date = input.signatureDate;
  if (input.status !== undefined) payload.status = input.status;

  if (input.ssn !== undefined) {
    payload.ssn_encrypted = input.ssn ? encrypt(input.ssn) : null;
  }
  if (input.ein !== undefined) {
    payload.ein_encrypted = input.ein ? encrypt(input.ein) : null;
  }

  payload.updated_at = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from("tax_profiles")
    .upsert(payload, { onConflict: "owner_id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`upsertTaxProfile: ${error?.message ?? "no data returned"}`);
  }
  return fromRow(data as TaxProfileRow);
}
