"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createDocumentTemplateRecord } from "@/lib/admin/document-templates";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";

export type HtmlTemplateResult =
  | { ok: true; template: DocumentTemplate }
  | { ok: false; error: string };

async function requireAdmin(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin")
    return { error: "Admin access required." };
  return { error: null };
}

/**
 * Creates a document_templates row with source_html = '' (empty string, not
 * null) so the Write tab appears immediately. No DocuSeal template is created
 * here; that happens when the admin publishes from the Plate editor via
 * publishTemplateAction (draft-actions). The record starts is_active=false.
 */
export async function createHtmlTemplateRecord(
  formData: FormData,
): Promise<HtmlTemplateResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const documentKey = (formData.get("document_key") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || undefined;
  const signerRolesRaw = formData.get("signer_roles") as string | null;
  const requiresCounter = formData.get("requires_countersignature") === "true";
  const gateStepRaw = formData.get("gate_step") as string | null;

  if (!displayName || !documentKey) {
    return { ok: false, error: "Display name and document key are required." };
  }
  if (!/^[a-z0-9_]+$/.test(documentKey)) {
    return {
      ok: false,
      error: "Document key must be lowercase letters, numbers, and underscores only.",
    };
  }

  const signerRoles: string[] = signerRolesRaw
    ? (JSON.parse(signerRolesRaw) as string[])
    : ["Owner"];
  if (signerRoles.length === 0) {
    return { ok: false, error: "At least one signer role is required." };
  }
  const gateStep =
    gateStepRaw && gateStepRaw !== "" ? parseInt(gateStepRaw, 10) : undefined;

  const record = await createDocumentTemplateRecord({
    document_key: documentKey,
    display_name: displayName,
    description,
    signer_roles: signerRoles,
    requires_countersignature: requiresCounter,
    gate_step: gateStep,
    source_html: "",
  });

  if (!record) {
    return {
      ok: false,
      error: "Could not save the template record. The document key may already exist.",
    };
  }

  revalidatePath("/admin/paperwork/templates");
  return { ok: true, template: record };
}
