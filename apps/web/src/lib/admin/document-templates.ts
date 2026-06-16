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
 * List all active templates visible to an org: system templates + org-specific ones.
 * For v1 (no orgs table), orgId is unused — all templates are system-level.
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
    query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    query = query.is("org_id", null);
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
    tracked: row.tracked ?? false,
    category: row.category ?? null,
    title: row.title ?? null,
    settings: row.settings ?? {},
    source_html: row.source_html ?? null,
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
    .select("docuseal_template_id, org_id")
    .eq("document_key", documentKey)
    .eq("is_active", true);

  if (orgId) {
    query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    query = query.is("org_id", null);
  }

  // Prefer tenant row (org_id not null) over system row.
  query = query.order("org_id", { ascending: false, nullsFirst: false }).limit(1);

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
    query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    query = query.is("org_id", null);
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
 * True if at least one signature document has already been sent under this
 * document key. Once that happens the key and signer roles are locked: changing
 * them would orphan documents already out for signature.
 */
export async function templateHasBeenSent(documentKey: string): Promise<boolean> {
  if (!documentKey) return false;
  const { data } = await db()
    .from("documents")
    .select("id")
    .eq("source", "signed_document")
    .eq("document_key", documentKey)
    .limit(1)
    .maybeSingle();
  return data !== null;
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
      org_id: input.org_id ?? null,
      document_key: input.document_key,
      display_name: input.display_name,
      description: input.description ?? null,
      docuseal_template_id: input.docuseal_template_id ?? null,
      signer_roles: input.signer_roles,
      requires_countersignature: input.requires_countersignature,
      gate_step: input.gate_step ?? null,
      is_system: false,
      is_active: false,
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
