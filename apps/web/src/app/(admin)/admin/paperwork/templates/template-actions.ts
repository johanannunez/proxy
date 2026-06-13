"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTemplate, createTemplateFromHtml, cloneTemplate } from "@/lib/signing/docuseal";
import {
  createDocumentTemplateRecord,
  updateDocumentTemplateRecord,
  getDocumentTemplate,
  documentKeyExists,
} from "@/lib/admin/document-templates";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";

export type TemplateActionResult =
  | { ok: true; template: DocumentTemplate }
  | { ok: false; error: string };

/** Live availability check for the document key field as the admin types. */
export async function checkDocumentKeyAvailable(
  documentKey: string,
): Promise<{ available: boolean }> {
  const key = documentKey.trim();
  if (!key || !/^[a-z0-9_]+$/.test(key)) return { available: false };
  const exists = await documentKeyExists(key);
  return { available: !exists };
}

async function requireAdmin(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") return { error: "Admin access required." };
  return { error: null };
}

/**
 * Phase 1: upload PDF + metadata -> create DocuSeal template (auto-detects fields)
 * -> persist DB record with is_active=false. Phase 2 activates it after builder save.
 */
export async function uploadAndCreateTemplate(
  formData: FormData,
): Promise<TemplateActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const documentKey = (formData.get("document_key") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || undefined;
  const signerRolesRaw = formData.get("signer_roles") as string | null;
  const requiresCounter = formData.get("requires_countersignature") === "true";
  const gateStepRaw = formData.get("gate_step") as string | null;
  const pdfFile = formData.get("pdf") as File | null;

  if (!displayName || !documentKey) {
    return { ok: false, error: "Display name and document key are required." };
  }
  if (!pdfFile || pdfFile.size === 0) {
    return { ok: false, error: "A PDF file is required." };
  }
  if (!pdfFile.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Only PDF files are supported." };
  }
  if (!/^[a-z0-9_]+$/.test(documentKey)) {
    return { ok: false, error: "Document key must be lowercase letters, numbers, and underscores only." };
  }

  const signerRoles: string[] = signerRolesRaw
    ? (JSON.parse(signerRolesRaw) as string[])
    : ["Owner"];
  if (signerRoles.length === 0) {
    return { ok: false, error: "At least one signer role is required." };
  }
  const gateStep = gateStepRaw && gateStepRaw !== "" ? parseInt(gateStepRaw, 10) : undefined;

  const buffer = Buffer.from(await pdfFile.arrayBuffer());
  const docuSealResult = await createTemplate(displayName, buffer, pdfFile.name);
  if (!docuSealResult) {
    return { ok: false, error: "Could not create the DocuSeal template. Verify DOCUSEAL_API_TOKEN is set in Doppler." };
  }

  const record = await createDocumentTemplateRecord({
    document_key: documentKey,
    display_name: displayName,
    description,
    signer_roles: signerRoles,
    requires_countersignature: requiresCounter,
    gate_step: gateStep,
    docuseal_template_id: docuSealResult.templateId,
  });

  if (!record) {
    return { ok: false, error: "Could not save the template record. The document key may already exist." };
  }

  return { ok: true, template: record };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Turn pasted plain text into simple, safe document HTML: blank lines become
 *  paragraph breaks, single newlines become line breaks. */
function textToHtml(title: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<h1>${escapeHtml(title)}</h1>${paragraphs}`;
}

/**
 * Create a signature template from written/pasted text instead of a PDF.
 * DocuSeal renders the HTML into a signable document; fields are placed
 * afterward in the builder, same as the upload path.
 */
export async function createWrittenTemplate(
  formData: FormData,
): Promise<TemplateActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const documentKey = (formData.get("document_key") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || undefined;
  const signerRolesRaw = formData.get("signer_roles") as string | null;
  const requiresCounter = formData.get("requires_countersignature") === "true";
  const gateStepRaw = formData.get("gate_step") as string | null;
  const bodyText = (formData.get("body_text") as string | null)?.trim() ?? "";

  if (!displayName || !documentKey) {
    return { ok: false, error: "Display name and document key are required." };
  }
  if (!bodyText) {
    return { ok: false, error: "Write or paste the document text first." };
  }
  if (!/^[a-z0-9_]+$/.test(documentKey)) {
    return { ok: false, error: "Document key must be lowercase letters, numbers, and underscores only." };
  }

  const signerRoles: string[] = signerRolesRaw
    ? (JSON.parse(signerRolesRaw) as string[])
    : ["Owner"];
  if (signerRoles.length === 0) {
    return { ok: false, error: "At least one signer role is required." };
  }
  const gateStep = gateStepRaw && gateStepRaw !== "" ? parseInt(gateStepRaw, 10) : undefined;

  const html = textToHtml(displayName, bodyText);
  const docuSealResult = await createTemplateFromHtml(displayName, html);
  if (!docuSealResult) {
    return { ok: false, error: "Could not create the document. Verify DOCUSEAL_API_TOKEN is set in Doppler." };
  }

  const record = await createDocumentTemplateRecord({
    document_key: documentKey,
    display_name: displayName,
    description,
    signer_roles: signerRoles,
    requires_countersignature: requiresCounter,
    gate_step: gateStep,
    docuseal_template_id: docuSealResult.templateId,
  });

  if (!record) {
    return { ok: false, error: "Could not save the template record. The document key may already exist." };
  }

  return { ok: true, template: record };
}

/**
 * Phase 2: called after admin saves the builder layout.
 * Marks the template active so the signing flow can resolve it.
 */
export async function activateTemplate(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const ok = await updateDocumentTemplateRecord(id, { is_active: true });
  return ok ? { ok: true } : { ok: false, error: "Could not activate the template." };
}

/**
 * Coverage tracking (2026-06-12 IA amendment): tracked templates become
 * Coverage matrix columns, grouped by category.
 */
export async function updateTemplateTracking(
  id: string,
  updates: { tracked?: boolean; category?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const ok = await updateDocumentTemplateRecord(id, updates);
  if (!ok) {
    return { ok: false, error: "Could not update coverage tracking. Try again." };
  }
  revalidatePath("/admin/paperwork");
  revalidatePath("/admin/paperwork/templates");
  return { ok: true };
}

/**
 * Fork a system template for a specific org (future multi-tenant use).
 * Clones the DocuSeal template and creates a new org-scoped DB record.
 */
export async function forkSystemTemplate(
  sourceId: string,
  orgId: string,
): Promise<TemplateActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (!orgId) {
    return { ok: false, error: "Organization context required to customize a template." };
  }

  const source = await getDocumentTemplate(sourceId);
  if (!source || !source.is_system) {
    return { ok: false, error: "Source template not found or is not a system template." };
  }
  if (!source.docuseal_template_id) {
    return { ok: false, error: "System template has no DocuSeal template built yet. Build it first." };
  }

  const cloned = await cloneTemplate(
    source.docuseal_template_id,
    `${source.display_name} (Custom)`,
  );
  if (!cloned) {
    return { ok: false, error: "Could not clone the DocuSeal template." };
  }

  const record = await createDocumentTemplateRecord({
    org_id: orgId,
    document_key: source.document_key,
    display_name: source.display_name,
    description: source.description ?? undefined,
    signer_roles: source.signer_roles,
    requires_countersignature: source.requires_countersignature,
    gate_step: source.gate_step ?? undefined,
    docuseal_template_id: cloned.templateId,
  });

  if (!record) {
    return { ok: false, error: "Could not save the forked template record." };
  }

  return { ok: true, template: record };
}

/** Soft-delete a tenant template. System templates cannot be deleted. */
export async function deactivateTemplate(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const template = await getDocumentTemplate(id);
  if (!template) return { ok: false, error: "Template not found." };
  if (template.is_system) return { ok: false, error: "System templates cannot be deleted." };
  const ok = await updateDocumentTemplateRecord(id, { is_active: false });
  return ok ? { ok: true } : { ok: false, error: "Could not deactivate the template." };
}
