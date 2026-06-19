// apps/web/src/lib/admin/document-templates.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  DocumentTemplate,
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
} from "./document-templates-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
function db(): DB {
  return createServiceClient() as DB;
}

/**
 * List all active templates visible to an agency: system templates + agency-specific ones.
 * For v1 (no agencies table), orgId is unused — all templates are system-level.
 */
export async function listDocumentTemplates(orgId?: string): Promise<DocumentTemplate[]> {
  let query = db()
    .from("document_templates")
    .select("*")
    .eq("is_active", true)
    .order("is_system", { ascending: false })
    .order("gate_step", { ascending: true, nullsFirst: false })
    .order("display_name");

  if (orgId) {
    query = query.or(`agency_id.is.null,agency_id.eq.${orgId}`);
  } else {
    query = query.is("agency_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[document-templates] list:", error.message);
    return [];
  }
  return ((data ?? []) as DocumentTemplate[]).map(normalizeTemplate);
}

/** Tracking columns ship in migration 20260612090000 and title/settings in
    20260613090000; rows read before either is applied lack them, so default
    rather than leave them undefined. */
function normalizeTemplate(row: DocumentTemplate): DocumentTemplate {
  return {
    ...row,
    tracked: row.tracked ?? true,
    category: row.category ?? null,
    title: row.title ?? null,
    settings: row.settings ?? {},
    source_html: row.source_html ?? null,
    published_html: row.published_html ?? null,
  };
}

/**
 * Resolve the DocuSeal template ID for a document key.
 * Tenant-specific template wins over system template.
 */
export async function resolveTemplateId(
  documentKey: string,
  orgId?: string,
): Promise<number | null> {
  let query = db()
    .from("document_templates")
    .select("docuseal_template_id, agency_id")
    .eq("document_key", documentKey)
    .eq("is_active", true);

  if (orgId) {
    query = query.or(`agency_id.is.null,agency_id.eq.${orgId}`);
  } else {
    query = query.is("agency_id", null);
  }

  // Prefer tenant row (agency_id not null) over system row.
  query = query.order("agency_id", { ascending: false, nullsFirst: false }).limit(1);

  const { data } = await query.maybeSingle();
  const row = data as { docuseal_template_id: number | null } | null;
  return row?.docuseal_template_id ?? null;
}

/**
 * Returns true if any active template exists for this document key.
 * Used to decide whether a document is an e-signature document.
 */
export async function isSignatureDocumentKey(
  documentKey: string,
  orgId?: string,
): Promise<boolean> {
  let query = db()
    .from("document_templates")
    .select("id")
    .eq("document_key", documentKey)
    .eq("is_active", true)
    .limit(1);

  if (orgId) {
    query = query.or(`agency_id.is.null,agency_id.eq.${orgId}`);
  } else {
    query = query.is("agency_id", null);
  }

  const { data } = await query.maybeSingle();
  return data !== null;
}

/**
 * How many signature document instances have been sent per document key.
 * Powers the "Sent N times" meta on unified template cards.
 */
export async function listTemplateSendCounts(): Promise<Record<string, number>> {
  const { data, error } = await db()
    .from("documents")
    .select("document_key")
    .eq("source", "signed_document")
    .not("document_key", "is", null);
  if (error) {
    console.error("[document-templates] send counts:", error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ document_key: string }>) {
    counts[row.document_key] = (counts[row.document_key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Whether any send EVIDENCE exists for a document key. Returned as 0 or 1 — the
 * only consumers check `> 0` — via two BOUNDED existence checks (each .limit(1)),
 * so a popular key never materializes its rows. This runs on every template
 * detail render through templateHasBeenSent, so it must stay an existence probe,
 * not a full fetch. Two MONOTONIC signals (each only moves forward, so a future
 * status can never make this under-count, the dangerous direction):
 *   (A) a documents row under this key with source='signed_document' OR sent_at set
 *   (B) a document_signers row whose parent document carries this key — catches a
 *       live signature whose documents row was never updated (the partial
 *       persistSubmission hole; see TODOS.md)
 * A bare spine stub (source='manual', sent_at null, no signers) matches neither,
 * so a never-sent template stays deletable. Reads fail SAFE: a DB error returns 1
 * (blocks the delete) rather than 0.
 *
 *   documents(key=K) where signed|sent ──limit 1──► COUNTED
 *   document_signers ⋈ documents(key=K) ──limit 1──► COUNTED (partial-failure)
 *   else ─► 0 (deletable)
 */
export async function countTemplateSendEvidence(documentKey: string): Promise<number> {
  if (!documentKey) return 0;
  const client = db();

  // (A) any document under this key already signed or sent.
  const { data: sentDocs, error: aErr } = await client
    .from("documents")
    .select("id")
    .eq("document_key", documentKey)
    .or("source.eq.signed_document,sent_at.not.is.null")
    .limit(1);
  if (aErr) {
    console.error("[document-templates] send evidence (documents):", aErr.message);
    return 1; // fail safe: never hard-delete on a read error
  }
  if ((sentDocs ?? []).length > 0) return 1;

  // (B) any signer attached to a document under this key (inner join on the FK).
  const { data: signers, error: bErr } = await client
    .from("document_signers")
    .select("id, documents!inner(document_key)")
    .eq("documents.document_key", documentKey)
    .limit(1);
  if (bErr) {
    console.error("[document-templates] send evidence (signers):", bErr.message);
    return 1; // fail safe
  }
  return (signers ?? []).length > 0 ? 1 : 0;
}

/**
 * True if at least one signature document has been sent under this document key.
 * Derived from countTemplateSendEvidence so the edit-lock and the hard-delete
 * gate share ONE definition of "used"; the lock thereby inherits the stronger
 * guard (it previously checked only source='signed_document' and could miss a
 * live signature left by a partial persistSubmission failure — see TODOS.md).
 * Once true, the key and signer roles are locked: changing them would orphan
 * documents already out for signature.
 */
export async function templateHasBeenSent(documentKey: string): Promise<boolean> {
  if (!documentKey) return false;
  return (await countTemplateSendEvidence(documentKey)) > 0;
}

export async function getDocumentTemplate(id: string): Promise<DocumentTemplate | null> {
  const { data } = await db()
    .from("document_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  const row = data as DocumentTemplate | null;
  return row ? normalizeTemplate(row) : null;
}

/** True when a document_key is already in use (keys must be unique). */
export async function documentKeyExists(documentKey: string): Promise<boolean> {
  const { data } = await db()
    .from("document_templates")
    .select("id")
    .eq("document_key", documentKey)
    .maybeSingle();
  return data !== null;
}

export async function createDocumentTemplateRecord(
  input: CreateDocumentTemplateInput,
): Promise<DocumentTemplate | null> {
  const { data, error } = await db()
    .from("document_templates")
    .insert({
      agency_id: input.agency_id ?? null,
      document_key: input.document_key,
      display_name: input.display_name,
      description: input.description ?? null,
      docuseal_template_id: input.docuseal_template_id ?? null,
      signer_roles: input.signer_roles,
      requires_countersignature: input.requires_countersignature,
      gate_step: input.gate_step ?? null,
      is_system: false,
      is_active: false,
      tracked: true,
      source_html: input.source_html ?? null,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[document-templates] create:", error.message);
    return null;
  }
  return data ? normalizeTemplate(data as DocumentTemplate) : null;
}

export async function updateDocumentTemplateRecord(
  id: string,
  input: UpdateDocumentTemplateInput,
): Promise<boolean> {
  const { error } = await db().from("document_templates").update(input).eq("id", id);
  if (error) {
    console.error("[document-templates] update:", error.message);
    return false;
  }
  return true;
}

/**
 * Hard-delete a template row, freeing its document_key. Service-role only (RLS).
 * The deletability gate lives in the caller (deleteTemplate); this just executes.
 * No incoming FKs reference document_templates, so the DELETE never cascades.
 */
export async function deleteDocumentTemplateRecord(id: string): Promise<boolean> {
  const { error } = await db().from("document_templates").delete().eq("id", id);
  if (error) {
    console.error("[document-templates] delete:", error.message);
    return false;
  }
  return true;
}

/**
 * Remove the reminder cadence keyed to this (agency, document_key) so a later
 * template reusing the key does not inherit stale cadence. No-op for system
 * templates: document_reminder_config.agency_id is NOT NULL, so agency_id=null rows
 * have no config to clear.
 */
export async function deleteReminderConfigForKey(
  orgId: string | null,
  documentKey: string,
): Promise<void> {
  if (!orgId || !documentKey) return;
  const { error } = await db()
    .from("document_reminder_config")
    .delete()
    .eq("agency_id", orgId)
    .eq("document_key", documentKey);
  if (error) {
    console.error("[document-templates] delete reminder config:", error.message);
  }
}
