"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { createServiceClient } from "@/lib/supabase/service";
import { createDocumentFromTemplate, resendDocumentLink } from "@/lib/signing/boldsign";
import { SECURE_DOC_TYPES } from "@/lib/admin/documents-hub";
import type { SecureDocKey } from "@/lib/admin/documents-hub";

export type ActionResult = { ok: boolean; error?: string };

/**
 * These are "use server" actions imported by client components, so they are
 * callable by any authenticated user. Gate them to admins — without this an
 * owner could send BoldSign documents or reset documents-spine rows.
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
    const db = untypedDatabase(supabase);
    const now = new Date().toISOString();

    // The documents spine holds one catalog row per (owner, document key).
    // Sending marks that row sent and records the provider id in source_ref.
    const { data: existing } = await db
      .from<{ id: string }>("documents")
      .select("id")
      .eq("owner_id", profileId)
      .eq("document_key", docKey)
      .is("form_key", null)
      .is("property_id", null)
      .maybeSingle();

    const sentFields = {
      status: "sent",
      source: "signed_document",
      source_ref: result.documentId,
      sent_by: sentBy,
      sent_at: now,
    };

    const { error: writeErr } = existing
      ? await db.from("documents").update(sentFields).eq("id", existing.id)
      : await db.from("documents").insert({
          owner_id: profileId,
          document_key: docKey,
          doc_type: docKey,
          title: def.templateNames[0],
          scope_kind: "owner",
          visibility: "client",
          ...sentFields,
        });

    if (writeErr) {
      console.error("[document-actions] spine write error:", writeErr.message);
      return { ok: false, error: "Document sent but failed to record. Please refresh." };
    }

    revalidatePath("/admin/paperwork");
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
    const db = untypedDatabase(supabase);
    const now = new Date().toISOString();

    const { data: doc } = await db
      .from<{ reminder_count: number | null }>("documents")
      .select("reminder_count")
      .eq("id", documentId)
      .maybeSingle();

    await db
      .from("documents")
      .update({
        sent_at: now,
        reminder_sent_at: now,
        reminder_count: (doc?.reminder_count ?? 0) + 1,
      })
      .eq("id", documentId);

    revalidatePath("/admin/paperwork");
    return { ok: true };
  } catch (err) {
    console.error("[document-actions] sendDocumentReminder error:", err);
    return { ok: false, error: "Unexpected error sending reminder." };
  }
}

export type DocumentAuditEvent = {
  event_type: string;
  signer_email: string | null;
  occurred_at: string;
};

export type DocumentAuditSigner = {
  signer_email: string | null;
  role: string;
  status: string;
  signed_at: string | null;
};

export type DocumentAuditLog = {
  ok: boolean;
  error?: string;
  events: DocumentAuditEvent[];
  signers: DocumentAuditSigner[];
};

/**
 * Full audit trail for a signature document: every DocuSeal visibility and
 * completion event plus the signer roster. Powers the drawer's certificate
 * panel (premium upgrade 6). Signer IP addresses live in the downloadable
 * DocuSeal certificate (see /api/admin/documents/[id]/certificate).
 */
export async function getDocumentAuditLog(documentId: string): Promise<DocumentAuditLog> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError, events: [], signers: [] };

  const supabase = await createClient();
  const db = untypedDatabase(supabase);

  const [{ data: events }, { data: signers }] = await Promise.all([
    db
      .from<DocumentAuditEvent[]>("document_events")
      .select("event_type, signer_email, occurred_at")
      .eq("document_id", documentId)
      .order("occurred_at", { ascending: true }),
    db
      .from<DocumentAuditSigner[]>("document_signers")
      .select("signer_email, role, status, signed_at")
      .eq("document_id", documentId)
      .order("order_index", { ascending: true }),
  ]);

  return {
    ok: true,
    events: events ?? [],
    signers: signers ?? [],
  };
}

/**
 * Per-document auto-reminder mute. No schema change: muting inserts a marker
 * row in document_reminders (channel 'message', round 3, delivered false) so
 * find_reminder_candidates() sees all rounds consumed and skips the document.
 * Real reminders always use channel 'email', so unmuting deletes only markers.
 * Writes go through the service client (document_reminders RLS is
 * service-role-write by design); the admin gate above is the authorization.
 */
export async function setDocumentReminderMute(
  documentId: string,
  muted: boolean,
): Promise<ActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = createServiceClient() as any;

    if (muted) {
      const { error } = await service.from("document_reminders").insert({
        document_id: documentId,
        channel: "message",
        round: 3,
        delivered: false,
      });
      if (error) {
        console.error("[document-actions] mute insert error:", error.message);
        return { ok: false, error: "Could not mute reminders for this document." };
      }
    } else {
      const { error } = await service
        .from("document_reminders")
        .delete()
        .eq("document_id", documentId)
        .eq("channel", "message")
        .eq("round", 3)
        .eq("delivered", false);
      if (error) {
        console.error("[document-actions] unmute delete error:", error.message);
        return { ok: false, error: "Could not turn reminders back on." };
      }
    }

    revalidatePath("/admin/paperwork");
    return { ok: true };
  } catch (err) {
    console.error("[document-actions] setDocumentReminderMute error:", err);
    return { ok: false, error: "Unexpected error updating reminders." };
  }
}

export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  try {
    const supabase = await createClient();
    // The spine keeps one catalog row per (owner, document key), so "deleting"
    // a sent signature document resets that row to its unsent state rather than
    // removing it from the checklist.
    const { error } = await untypedDatabase(supabase)
      .from("documents")
      .update({
        status: "needed",
        source: "manual",
        source_ref: null,
        file_url: null,
        sent_at: null,
        sent_by: null,
        completed_at: null,
        reminder_sent_at: null,
        reminder_count: 0,
      })
      .eq("id", documentId)
      .eq("source", "signed_document");

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/paperwork");
    return { ok: true };
  } catch (err) {
    console.error("[document-actions] deleteDocument error:", err);
    return { ok: false, error: "Unexpected error deleting document." };
  }
}
