"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createTemplateFromHtml } from "@/lib/signing/docuseal";
import {
  createDocumentTemplateRecord,
  updateDocumentTemplateRecord,
  getDocumentTemplate,
} from "@/lib/admin/document-templates";
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
 * here; that happens when the admin saves content from the Plate editor via
 * saveTemplateHtmlAction. The record starts is_active=false; activation is gated
 * on field coverage after the document is authored and fields are placed.
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

/**
 * Legal-document shell. Matches the typographic system used by
 * `buildAuthorityAddendumHtml` (Georgia body, Arial headings) so every authored
 * template renders consistently when DocuSeal turns it into a signable PDF. The
 * `valueToHtml` fragment from the editor is dropped into the body verbatim.
 */
function wrapInDocumentShell(html: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
    padding: 56px 72px;
    max-width: 800px;
    margin: 0 auto;
  }
  h1, h2, h3 {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  h1 { font-size: 17pt; text-transform: uppercase; letter-spacing: -0.3px; }
  h2 { font-size: 13pt; }
  h3 { font-size: 11pt; }
  p { margin-bottom: 12px; }
  ul { margin: 0 0 12px 24px; list-style: disc outside; }
  ol { margin: 0 0 12px 24px; list-style: decimal outside; }
  li { display: list-item; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 20px; font-size: 10.5pt; }
  th { background: #1a1a1a; color: #fff; text-align: left; padding: 8px 12px;
       font-family: Arial, sans-serif; font-size: 9pt; font-weight: 700;
       text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }
</style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Called by TemplateEditor when the admin clicks "Save Document." Wraps the
 * Plate-serialized HTML fragment in the document shell, creates a fresh DocuSeal
 * template, and updates docuseal_template_id + source_html in the DB.
 *
 * Re-create on every save: DocuSeal's PUT /templates/:id renames but does not
 * replace the HTML document in place, so each save mints a new template. That
 * resets field positions, so we also force is_active=false — an active template
 * must never point at a DocuSeal document with no fields. The admin re-places
 * fields in the Fields tab, which re-activates via the coverage gate. The client
 * shows a warning banner before saving over an existing DocuSeal template.
 */
export async function saveTemplateHtmlAction(
  templateId: string,
  htmlFragment: string,
): Promise<{ ok: true; newDocusealId: number } | { ok: false; error: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  if (!templateId?.trim()) return { ok: false, error: "Invalid template ID." };

  const template = await getDocumentTemplate(templateId);
  if (!template) return { ok: false, error: "Template not found." };
  if (template.source_html === null) {
    return { ok: false, error: "This template is not an HTML document." };
  }

  const fullHtml = wrapInDocumentShell(htmlFragment);
  const result = await createTemplateFromHtml(template.display_name, fullHtml);
  if (!result) {
    return {
      ok: false,
      error: "Could not create the DocuSeal template. Check DOCUSEAL_API_TOKEN in Doppler.",
    };
  }

  const ok = await updateDocumentTemplateRecord(templateId, {
    source_html: htmlFragment,
    docuseal_template_id: result.templateId,
    is_active: false,
  });

  if (!ok) {
    return {
      ok: false,
      error: "DocuSeal template created but the DB update failed. Try saving again.",
    };
  }

  revalidatePath("/admin/paperwork/templates");
  revalidatePath(`/admin/paperwork/templates/${templateId}`);
  return { ok: true, newDocusealId: result.templateId };
}
