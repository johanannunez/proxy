"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTemplateFromHtml } from "@/lib/signing/docuseal";
import {
  getDocumentTemplate,
  updateDocumentTemplateRecord,
} from "@/lib/admin/document-templates";
import { wrapInDocumentShell } from "./document-shell";

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

/** Cheap, DocuSeal-free draft persistence. Called by autosave + tab switch. */
export async function saveTemplateDraftAction(
  templateId: string,
  html: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };
  if (!templateId?.trim()) return { ok: false, error: "Invalid template ID." };
  const template = await getDocumentTemplate(templateId);
  if (!template) return { ok: false, error: "Template not found." };
  if (template.source_html === null)
    return { ok: false, error: "This template is not an HTML document." };
  const ok = await updateDocumentTemplateRecord(templateId, { source_html: html });
  if (!ok) return { ok: false, error: "Could not save your draft. Try again." };
  revalidatePath(`/admin/paperwork/templates/${templateId}`);
  return { ok: true };
}

/**
 * Deliberate: (re)build the DocuSeal template from the current draft, passing
 * signer roles as parties so the Fields builder shows every party (e.g. Owner
 * AND the admin), and snapshot what was published. This resets field positions.
 */
export async function publishTemplateAction(
  templateId: string,
): Promise<{ ok: true; newDocusealId: number } | { ok: false; error: string }> {
  const { error } = await requireAdmin();
  if (error) return { ok: false, error };
  const template = await getDocumentTemplate(templateId);
  if (!template) return { ok: false, error: "Template not found." };
  if (template.source_html === null)
    return { ok: false, error: "This template is not an HTML document." };

  const fullHtml = wrapInDocumentShell(template.source_html);
  const result = await createTemplateFromHtml(template.display_name, fullHtml, {
    submitters: template.signer_roles.map((name) => ({ name })),
  });
  if (!result)
    return {
      ok: false,
      error: "Could not publish to DocuSeal. Check DOCUSEAL_API_TOKEN in Doppler.",
    };

  const ok = await updateDocumentTemplateRecord(templateId, {
    docuseal_template_id: result.templateId,
    published_html: template.source_html,
    is_active: false,
  });
  if (!ok)
    return { ok: false, error: "Published but the DB update failed. Try again." };

  revalidatePath("/admin/paperwork/templates");
  revalidatePath(`/admin/paperwork/templates/${templateId}`);
  return { ok: true, newDocusealId: result.templateId };
}
