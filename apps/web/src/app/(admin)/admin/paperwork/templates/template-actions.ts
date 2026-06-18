"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createTemplate,
  createTemplateFromHtml,
  cloneTemplate,
  getTemplateFields,
  renameDocuSealTemplate,
  getDocuSealTemplateName,
  archiveDocuSealTemplate,
  docuSealTemplateHasSubmissions,
} from "@/lib/signing/docuseal";
import { textToHtml } from "./text-to-html";
import {
  createDocumentTemplateRecord,
  updateDocumentTemplateRecord,
  getDocumentTemplate,
  documentKeyExists,
  templateHasBeenSent,
  countTemplateSendEvidence,
  deleteDocumentTemplateRecord,
  deleteReminderConfigForKey,
} from "@/lib/admin/document-templates";
import { evaluateDeletability } from "@/lib/admin/template-deletability";
import type {
  DocumentTemplate,
  TemplateSettings,
  UpdateDocumentTemplateInput,
} from "@/lib/admin/document-templates-types";
import { computeCoverage } from "@/lib/signing/field-coverage";
import { signerRolesLabel } from "./signer-roles";
import { metaEditLocked, isValidDocumentKey, type MetaEditInput } from "./template-meta";

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
 * Activation is gated on readiness: every signer role must have at least one
 * field in the DocuSeal layout, otherwise that signer has nothing to sign and
 * the document is unsendable. If a role is uncovered we block and name it.
 */
export async function activateTemplate(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const template = await getDocumentTemplate(id);
  if (!template) return { ok: false, error: "Template not found." };

  // A template with a DocuSeal layout must cover every signer before it can be
  // sent. (Templates with no docuseal_template_id can't reach here from the
  // builder; activating them is a no-op gate-wise.)
  if (template.docuseal_template_id) {
    const fields = await getTemplateFields(template.docuseal_template_id);
    const { ready, missingRoles } = computeCoverage(fields, template.signer_roles);
    if (!ready) {
      return { ok: false, error: `Add a field for: ${signerRolesLabel(missingRoles)}` };
    }
  }

  const ok = await updateDocumentTemplateRecord(id, { is_active: true });
  return ok ? { ok: true } : { ok: false, error: "Could not activate the template." };
}

/**
 * Edit the "About this template" meta. Cosmetic fields (title, display name,
 * description) are always editable. The document key and signer roles lock once
 * any document has been sent under the key: changing them would orphan
 * documents already out for signature. When the title changes we also rename
 * the DocuSeal document so the builder header matches; that sync is best-effort
 * and never fails the save (the DB title is the source of truth).
 */
/**
 * The document name lives in two places that must stay identical: our
 * display_name and the DocuSeal document name (shown/edited inside the
 * builder). These keep them one.
 */

/** Push our display_name into DocuSeal so the builder shows our name. Called
 *  when the builder opens, reconciling any prior drift in our favor. */
export async function pushTemplateNameToDocuSeal(
  id: string,
): Promise<{ ok: boolean }> {
  const { error } = await requireAdmin();
  if (error) return { ok: false };
  const template = await getDocumentTemplate(id);
  if (!template?.docuseal_template_id) return { ok: false };
  await renameDocuSealTemplate(template.docuseal_template_id, template.display_name);
  return { ok: true };
}

/** Pull the DocuSeal document name back into our display_name, so renaming the
 *  document inside the builder updates our name too. Returns the synced name. */
export async function pullTemplateNameFromDocuSeal(
  id: string,
): Promise<{ name: string | null }> {
  const { error } = await requireAdmin();
  if (error) return { name: null };
  const template = await getDocumentTemplate(id);
  if (!template?.docuseal_template_id) return { name: null };
  const docuSealName = await getDocuSealTemplateName(template.docuseal_template_id);
  const trimmed = docuSealName?.trim();
  if (!trimmed || trimmed === template.display_name) {
    return { name: template.display_name };
  }
  await updateDocumentTemplateRecord(id, { display_name: trimmed });
  revalidatePath("/admin/paperwork/signatures");
  revalidatePath(`/admin/paperwork/templates/${id}`);
  return { name: trimmed };
}

export async function updateTemplateMeta(
  id: string,
  input: MetaEditInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const template = await getDocumentTemplate(id);
  if (!template) return { ok: false, error: "Template not found." };

  const hasBeenSent = await templateHasBeenSent(template.document_key);
  if (metaEditLocked(hasBeenSent, input)) {
    return {
      ok: false,
      error: "This template has already been sent, so its key and signers are locked.",
    };
  }

  // Build only the fields actually being changed.
  const update: UpdateDocumentTemplateInput = {};

  if (input.title !== undefined) {
    const title = input.title?.trim() ?? "";
    update.title = title === "" ? null : title;
  }
  if (input.display_name !== undefined) {
    const name = input.display_name.trim();
    if (!name) return { ok: false, error: "Name cannot be empty." };
    update.display_name = name;
  }
  if (input.description !== undefined) {
    const desc = input.description?.trim() ?? "";
    update.description = desc === "" ? null : desc;
  }
  if (input.document_key !== undefined) {
    const key = input.document_key.trim();
    if (!isValidDocumentKey(key)) {
      return {
        ok: false,
        error: "Document key must be lowercase letters, numbers, and underscores only.",
      };
    }
    // Only enforce uniqueness when the key actually changed: a match then always
    // means a different template owns it (this row is excluded by the change).
    if (key !== template.document_key && (await documentKeyExists(key))) {
      return { ok: false, error: "That document key is already in use." };
    }
    update.document_key = key;
  }
  if (input.signer_roles !== undefined) {
    if (input.signer_roles.length === 0) {
      return { ok: false, error: "At least one signer role is required." };
    }
    update.signer_roles = input.signer_roles;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const ok = await updateDocumentTemplateRecord(id, update);
  if (!ok) return { ok: false, error: "Could not save your changes. Try again." };

  // The Name is the single source of the document's title, so keep the DocuSeal
  // document name in sync with it. Best-effort: a DocuSeal outage must not block
  // the DB save.
  if (update.display_name && template.docuseal_template_id) {
    await renameDocuSealTemplate(template.docuseal_template_id, update.display_name);
  }

  revalidatePath("/admin/paperwork/signatures");
  revalidatePath(`/admin/paperwork/templates/${id}`);
  return { ok: true };
}

/**
 * Status Board tracking (2026-06-14 redesign): tracked templates become
 * Status Board columns, grouped by category.
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
  revalidatePath("/admin/paperwork/signatures");
  return { ok: true };
}

/**
 * Persist per-template send settings (subject/message copy, auto-reminders,
 * expiration, after-sign behavior). Stored in a single jsonb bag so new options
 * ship without a migration. Shallow merge over the existing settings, with a
 * one-level merge for the nested email/afterSign objects so a partial patch to
 * one nested field does not wipe the others.
 */
export async function updateTemplateSettings(
  id: string,
  patch: Partial<TemplateSettings>,
): Promise<{ ok: boolean; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const template = await getDocumentTemplate(id);
  if (!template) return { ok: false, error: "Template not found." };

  const current = template.settings;
  const next: TemplateSettings = { ...current, ...patch };
  if (patch.email !== undefined) {
    next.email = { ...current.email, ...patch.email };
  }
  if (patch.afterSign !== undefined) {
    next.afterSign = { ...current.afterSign, ...patch.afterSign };
  }

  const ok = await updateDocumentTemplateRecord(id, { settings: next });
  if (!ok) return { ok: false, error: "Could not save these settings. Try again." };

  revalidatePath("/admin/paperwork/signatures");
  revalidatePath(`/admin/paperwork/templates/${id}`);
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

/** Soft-delete (archive) a tenant template. System templates cannot be deleted.
    The key/slug stays reserved; use deleteTemplate to free a never-sent key. */
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

/**
 * Hard-delete a never-sent tenant signature template, freeing its document_key.
 * Gate (see evaluateDeletability + countTemplateSendEvidence):
 *   is_system            → refused (shared infrastructure)
 *   local send evidence  → refused (archive via deactivateTemplate instead)
 *   looks never-sent but DocuSeal has a submission → refused; the DocuSeal check
 *     is FAIL-CLOSED (a verification error blocks the delete) so a live remote
 *     signature with no local trace can never be deleted.
 * On success also clears the orphaned reminder cadence and best-effort archives
 * the remote DocuSeal template (a DocuSeal outage never fails the local delete).
 *
 *   requireAdmin → load → is_system? → countTemplateSendEvidence
 *      → (clean & has remote id?) DocuSeal submissions check [fail-closed]
 *      → evaluateDeletability → reminder-config cleanup → DELETE row
 *      → best-effort DocuSeal archive → revalidate
 */
export async function deleteTemplate(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const template = await getDocumentTemplate(id);
  if (!template) return { ok: false, error: "Template not found." };
  if (template.is_system) {
    return { ok: false, error: "System templates cannot be deleted." };
  }

  const sendEvidenceCount = await countTemplateSendEvidence(template.document_key);

  // Only pay the DocuSeal round-trip when local state looks clean; it closes the
  // no-local-evidence hole. Fail closed: a verification error blocks the delete.
  let hasRemoteSubmissions = false;
  if (sendEvidenceCount === 0 && template.docuseal_template_id) {
    try {
      hasRemoteSubmissions = await docuSealTemplateHasSubmissions(template.docuseal_template_id);
    } catch {
      return {
        ok: false,
        error: "Couldn't verify with the signing provider. Try again in a moment.",
      };
    }
  }

  const verdict = evaluateDeletability({
    isSystem: template.is_system,
    sendEvidenceCount,
    hasRemoteSubmissions,
  });
  if (!verdict.canDelete) {
    return { ok: false, error: verdict.reason ?? "This template cannot be deleted." };
  }

  const ok = await deleteDocumentTemplateRecord(id);
  if (!ok) return { ok: false, error: "Could not delete the template." };

  // Clean up dependent state only AFTER the row is actually gone, so a failed
  // row delete never orphans the reminder cadence. Both are best-effort; a
  // DocuSeal outage must not fail an already-committed local delete.
  await deleteReminderConfigForKey(template.org_id, template.document_key);
  if (template.docuseal_template_id) {
    await archiveDocuSealTemplate(template.docuseal_template_id);
  }

  revalidatePath("/admin/paperwork/signatures");
  revalidatePath("/admin/paperwork");
  return { ok: true };
}
