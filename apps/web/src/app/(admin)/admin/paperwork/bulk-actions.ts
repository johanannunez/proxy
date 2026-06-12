"use server";

/**
 * Bulk operations for the paperwork matrix. Every action is admin-gated:
 * these are importable by any authenticated client, so each one re-checks
 * the caller's role before touching the documents spine.
 *
 * Reminder sending reuses the signing provider's resend-link flow (the same
 * mechanism as the single-document reminder in document-actions.ts). When the
 * dedicated reminders engine lands it can be swapped in behind this action
 * without changing the client.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { resendDocumentLink } from "@/lib/signing/boldsign";
import { SECURE_DOC_TYPES } from "@/lib/admin/documents-hub";
import type { SecureDocKey } from "@/lib/admin/documents-hub";
import { sendDocumentToOwner } from "./document-actions";

export type BulkRemindResult = { ok: boolean; sent: number; error?: string };
export type BulkActionResult = { ok: boolean; affected: number; error?: string };

async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "You must be signed in.";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return "Admin access required.";
  return null;
}

/* documents.owner_id references auth.users (not profiles), so the owner email
   resolves through a separate profiles query rather than an embed. */
type PendingDocRow = {
  id: string;
  owner_id: string;
  source_ref: string | null;
  reminder_count: number | null;
};

/**
 * Sends the next reminder round to every selected owner's awaiting-signature
 * documents. Returns the number of reminders actually sent.
 */
export async function bulkRemindOwners(ownerIds: string[]): Promise<BulkRemindResult> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, sent: 0, error: authError };
  if (ownerIds.length === 0) return { ok: true, sent: 0 };

  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  const { data: documents, error } = await db
    .from<PendingDocRow[]>("documents")
    .select("id, owner_id, source_ref, reminder_count")
    .in("owner_id", ownerIds)
    .eq("source", "signed_document")
    .eq("status", "sent")
    .is("form_key", null)
    .not("source_ref", "is", null);

  if (error) {
    console.error("[bulk-actions] bulkRemindOwners fetch error:", error.message);
    return { ok: false, sent: 0, error: "Could not load pending documents." };
  }

  const emailByOwnerId = new Map<string, string>();
  {
    const { data: ownerProfiles } = await db
      .from<Array<{ id: string; email: string | null }>>("profiles")
      .select("id, email")
      .in("id", ownerIds);
    for (const p of ownerProfiles ?? []) {
      if (p.email) emailByOwnerId.set(p.id, p.email);
    }
  }

  const now = new Date().toISOString();
  let sent = 0;

  for (const doc of documents ?? []) {
    const email = emailByOwnerId.get(doc.owner_id);
    if (!doc.source_ref || !email) continue;
    try {
      const link = await resendDocumentLink(doc.source_ref, email);
      if (!link) continue;
      await db
        .from("documents")
        .update({
          reminder_sent_at: now,
          reminder_count: (doc.reminder_count ?? 0) + 1,
        })
        .eq("id", doc.id);
      sent++;
    } catch (err) {
      console.error("[bulk-actions] reminder failed for document", doc.id, err);
    }
  }

  revalidatePath("/admin/paperwork");
  return { ok: true, sent };
}

/** Waives every given document so it stops counting against owners. */
export async function bulkWaiveDocuments(documentIds: string[]): Promise<BulkActionResult> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, affected: 0, error: authError };
  if (documentIds.length === 0) {
    return { ok: false, affected: 0, error: "No sent documents to waive for this selection." };
  }

  const supabase = await createClient();
  const { error } = await untypedDatabase(supabase)
    .from("documents")
    .update({ waived: true })
    .in("id", documentIds);

  if (error) {
    console.error("[bulk-actions] bulkWaiveDocuments error:", error.message);
    return { ok: false, affected: 0, error: "Could not waive the selected documents." };
  }

  revalidatePath("/admin/paperwork");
  return { ok: true, affected: documentIds.length };
}

type CatalogRow = { id: string; owner_id: string };

/**
 * Requests one document type from every selected owner: ensures each owner has
 * a catalog row for the type, marked `needed`, so it appears in their portal
 * checklist. Owners who already have the document (any status) are skipped.
 */
export async function bulkRequestDocuments(
  ownerProfileIds: string[],
  docKey: SecureDocKey,
): Promise<BulkActionResult> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, affected: 0, error: authError };
  if (ownerProfileIds.length === 0) return { ok: true, affected: 0 };

  const def = SECURE_DOC_TYPES[docKey];
  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  const { data: existing, error: fetchErr } = await db
    .from<CatalogRow[]>("documents")
    .select("id, owner_id")
    .in("owner_id", ownerProfileIds)
    .eq("document_key", docKey)
    .is("form_key", null)
    .is("property_id", null);

  if (fetchErr) {
    console.error("[bulk-actions] bulkRequestDocuments fetch error:", fetchErr.message);
    return { ok: false, affected: 0, error: "Could not check existing documents." };
  }

  const haveRow = new Set((existing ?? []).map((r) => r.owner_id));
  const toInsert = ownerProfileIds
    .filter((ownerId) => !haveRow.has(ownerId))
    .map((ownerId) => ({
      owner_id: ownerId,
      document_key: docKey,
      doc_type: docKey,
      title: def.templateNames[0],
      scope_kind: "owner",
      visibility: "client",
      source: "manual",
      status: "needed",
    }));

  if (toInsert.length === 0) {
    return { ok: false, affected: 0, error: `Every selected owner already has ${def.label}.` };
  }

  const { error: insertErr } = await db.from("documents").insert(toInsert);
  if (insertErr) {
    console.error("[bulk-actions] bulkRequestDocuments insert error:", insertErr.message);
    return { ok: false, affected: 0, error: "Could not create the document requests." };
  }

  revalidatePath("/admin/paperwork");
  return { ok: true, affected: toInsert.length };
}

export type BulkSendTarget = { profileId: string; email: string; fullName: string };

/**
 * Sends one document type for signature to every selected owner who has not
 * received it yet. Owners with an existing sent/completed copy are skipped.
 */
export async function bulkSendDocuments(
  targets: BulkSendTarget[],
  docKey: SecureDocKey,
): Promise<BulkActionResult> {
  const authError = await requireAdmin();
  if (authError) return { ok: false, affected: 0, error: authError };
  if (targets.length === 0) return { ok: true, affected: 0 };

  let sent = 0;
  let firstError: string | null = null;

  for (const target of targets) {
    const res = await sendDocumentToOwner(
      target.profileId,
      target.email,
      target.fullName,
      docKey,
    );
    if (res.ok) sent++;
    else if (!firstError) firstError = res.error ?? "Send failed.";
  }

  revalidatePath("/admin/paperwork");
  if (sent === 0 && firstError) return { ok: false, affected: 0, error: firstError };
  return { ok: true, affected: sent };
}
