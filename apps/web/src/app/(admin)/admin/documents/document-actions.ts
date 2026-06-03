"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createDocumentFromTemplate, resendDocumentLink } from "@/lib/signing/boldsign";
import { SECURE_DOC_TYPES } from "@/lib/admin/documents-hub";
import type { SecureDocKey } from "@/lib/admin/documents-hub";

export type ActionResult = { ok: boolean; error?: string };

/**
 * These are "use server" actions imported by client components, so they are
 * callable by any authenticated user. Gate them to admins — without this an
 * owner could send BoldSign documents or delete signed_documents rows.
 */
async function requireAdmin(): Promise<{ userId: string | null; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, error: "You must be signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return { userId: null, error: "Admin access required." };
  return { userId: user.id, error: null };
}

export async function sendDocumentToOwner(
  profileId: string,
  ownerEmail: string,
  ownerName: string,
  docKey: SecureDocKey,
): Promise<ActionResult> {
  const { userId: adminId, error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const def = SECURE_DOC_TYPES[docKey];

  if (!def.templateId) {
    return { ok: false, error: `No BoldSign template configured for "${def.label}". Contact your administrator.` };
  }

  try {
    const result = await createDocumentFromTemplate({
      templateId: def.templateId,
      signerEmail: ownerEmail,
      signerName: ownerName,
      sendEmail: true,
    });

    if (!result) {
      return { ok: false, error: "BoldSign document creation failed. Check BOLDSIGN_API_KEY." };
    }

    const sentBy = adminId;
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { error: insertErr } = await (supabase as any)
      .from("signed_documents")
      .insert({
        user_id: profileId,
        boldsign_document_id: result.documentId,
        template_name: def.templateNames[0],
        status: "pending",
        sent_by: sentBy,
        sent_at: now,
        created_at: now,
        updated_at: now,
      });

    if (insertErr) {
      console.error("[document-actions] insert error:", insertErr.message);
      return { ok: false, error: "Document sent but failed to record. Please refresh." };
    }

    revalidatePath("/admin/documents");
    return { ok: true };
  } catch (err) {
    console.error("[document-actions] sendDocumentToOwner error:", err);
    return { ok: false, error: "Unexpected error sending document." };
  }
}

export async function sendDocumentReminder(
  documentId: string,
  boldsignDocumentId: string,
  ownerEmail: string,
): Promise<ActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  try {
    const signLink = await resendDocumentLink(boldsignDocumentId, ownerEmail);

    if (!signLink) {
      return { ok: false, error: "Could not retrieve signing link. The document may have expired." };
    }

    const supabase = await createClient();
    const now = new Date().toISOString();

    await (supabase as any)
      .from("signed_documents")
      .update({ sent_at: now, updated_at: now })
      .eq("id", documentId);

    revalidatePath("/admin/documents");
    return { ok: true };
  } catch (err) {
    console.error("[document-actions] sendDocumentReminder error:", err);
    return { ok: false, error: "Unexpected error sending reminder." };
  }
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  try {
    const supabase = await createClient();
    const { error } = await (supabase as any)
      .from("signed_documents")
      .delete()
      .eq("id", documentId);

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/documents");
    return { ok: true };
  } catch (err) {
    console.error("[document-actions] deleteDocument error:", err);
    return { ok: false, error: "Unexpected error deleting document." };
  }
}
