"use server";

import { revalidatePath } from "next/cache";
import { sendMessage } from "@/app/(admin)/admin/inbox/actions";
import { sendDocumentToOwner, sendDocumentReminder } from "@/app/(admin)/admin/documents/document-actions";
import { buildWorkspaceRequestEmail } from "@/lib/email-template";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import {
  SECURE_DOC_TYPES,
  WORKSPACE_DOCUMENT_DEFINITIONS,
  type SecureDocKey,
  type WorkspaceDocumentKey,
} from "@/lib/admin/documents-hub-shared";
import {
  buildWorkspaceRequestUrl,
  splitEmailRecipients,
  splitSmsRecipients,
  type ComposerRecipient,
  type WorkspaceRequestAssignmentScope,
  type WorkspaceRequestCompletionRule,
} from "@/lib/admin/workspace-requests";

export type WorkspaceDocumentActionResult = {
  ok: boolean;
  error?: string;
  sent?: number;
  failed?: number;
};

export type WorkspaceDocumentRequestDelivery = "email" | "sms" | "email_sms";

export type WorkspaceDocumentRequestRecipientInput = ComposerRecipient;

function isSecureDocKey(key: WorkspaceDocumentKey): key is SecureDocKey {
  return key in SECURE_DOC_TYPES;
}

/**
 * Gate every document action to admins. These actions use the RLS-bypassing
 * service client, so without this an authenticated owner could create requests,
 * send messages, and inject notifications for any workspace (privilege escalation).
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

function textFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendWorkspaceDocumentAction(input: {
  workspaceId: string;
  profileId: string;
  email: string;
  fullName: string;
  documentKey: WorkspaceDocumentKey;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const definition = WORKSPACE_DOCUMENT_DEFINITIONS[input.documentKey];
  if (!definition.sendable || !isSecureDocKey(input.documentKey)) {
    return {
      ok: false,
      error: `${definition.label} is requested from the owner rather than sent through BoldSign.`,
    };
  }

  const result = await sendDocumentToOwner(
    input.profileId,
    input.email,
    input.fullName,
    input.documentKey,
  );

  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return result.ok ? { ok: true, sent: 1 } : { ok: false, error: result.error };
}

export async function sendWorkspaceDocumentReminderAction(input: {
  workspaceId: string;
  documentId: string;
  boldsignDocumentId: string;
  email: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const result = await sendDocumentReminder(
    input.documentId,
    input.boldsignDocumentId,
    input.email,
  );

  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function sendNeededWorkspaceDocumentsAction(input: {
  workspaceId: string;
  profileId: string;
  email: string;
  fullName: string;
  documentKeys: WorkspaceDocumentKey[];
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const documentKey of input.documentKeys) {
    const result = await sendWorkspaceDocumentAction({
      workspaceId: input.workspaceId,
      profileId: input.profileId,
      email: input.email,
      fullName: input.fullName,
      documentKey,
    });

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (result.error) errors.push(result.error);
    }
  }

  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return {
    ok: failed === 0,
    sent,
    failed,
    error: errors[0],
  };
}

export async function sendWorkspaceDocumentRequestAction(input: {
  workspaceId: string;
  profileId: string;
  assignmentScope: WorkspaceRequestAssignmentScope;
  completionRule: WorkspaceRequestCompletionRule;
  recipients: WorkspaceDocumentRequestRecipientInput[];
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrlOrigin: string;
  trustNote: string;
  documentKeys: WorkspaceDocumentKey[];
}): Promise<WorkspaceDocumentActionResult> {
  const { userId, error: authError } = await requireAdmin();
  if (authError || !userId) return { ok: false, error: authError ?? "Admin access required." };

  const eligibleKeys = input.documentKeys.filter((key) => {
    const definition = WORKSPACE_DOCUMENT_DEFINITIONS[key];
    return Boolean(definition?.requestable || definition?.sendable);
  });

  if (eligibleKeys.length === 0) {
    return {
      ok: false,
      error: "No documents were selected for request delivery.",
    };
  }

  const service = createServiceClient();
  const db = untypedDatabase(service);

  // Defense-in-depth: ensure the target owner and recipients are not from a
  // different workspace (no cross-workspace data injection, even by an admin).
  const profileIdsToCheck = Array.from(
    new Set([
      input.profileId,
      ...input.recipients.map((r) => r.profileId).filter((id): id is string => Boolean(id)),
    ]),
  );
  if (profileIdsToCheck.length > 0) {
    const { data: profileRows } = await db
      .from("profiles")
      .select("id, workspace_id")
      .in("id", profileIdsToCheck);
    const rows = (profileRows ?? []) as Array<{ id: string; workspace_id: string | null }>;
    const foreign = rows.filter(
      (p) => p.workspace_id !== null && p.workspace_id !== input.workspaceId,
    );
    if (foreign.length > 0) {
      return { ok: false, error: "One or more recipients belong to a different workspace." };
    }
  }

  const sentAt = new Date().toISOString();
  const { data: request, error: requestError } = await db
    .from<{ id: string }>("workspace_requests")
    .insert({
      workspace_id: input.workspaceId,
      assignment_scope: input.assignmentScope,
      completion_rule: input.completionRule,
      status: "sent",
      subject: input.subject,
      message_html: input.body,
      message_text: textFromHtml(input.body),
      cta_label: input.ctaLabel,
      trust_note: input.trustNote,
      created_by: userId,
      sent_at: sentAt,
    })
    .select("id")
    .single();

  if (requestError || !request) {
    return { ok: false, error: requestError?.message ?? "Request could not be created." };
  }

  const requestUrl = buildWorkspaceRequestUrl(input.ctaUrlOrigin, input.workspaceId, request.id);
  const requestedItems = eligibleKeys.map((key) => WORKSPACE_DOCUMENT_DEFINITIONS[key].label);
  const itemRows = eligibleKeys.map((key) => ({
    request_id: request.id,
    document_key: key,
    label: WORKSPACE_DOCUMENT_DEFINITIONS[key].label,
    status: "open",
  }));
  const recipientRows = input.recipients.map((recipient) => ({
    request_id: request.id,
    contact_id: recipient.contactId,
    profile_id: recipient.profileId,
    role: recipient.role,
    delivery_channels: recipient.channels,
    email: recipient.email,
    phone: recipient.phone,
    last_email_sent_at: recipient.channels.includes("email") ? sentAt : null,
    last_sms_sent_at: recipient.channels.includes("sms") ? sentAt : null,
  }));

  const [{ error: itemError }, { error: recipientError }] = await Promise.all([
    db.from("workspace_request_items").insert(itemRows),
    db.from("workspace_request_recipients").insert(recipientRows),
  ]);

  if (itemError) return { ok: false, error: itemError.message };
  if (recipientError) return { ok: false, error: recipientError.message };

  // In-app notifications so the request lands in the owner's portal (bell +
  // Documents badge), not only via email. Deep-links to the scoped Needed lane.
  const notificationRows = input.recipients
    .filter((recipient) => recipient.profileId)
    .map((recipient) => ({
      owner_id: recipient.profileId,
      type: "document_request",
      title: input.subject,
      body: `Proxy requested ${requestedItems.length} ${requestedItems.length === 1 ? "document" : "documents"}.`,
      link: `/workspace/documents?request=${request.id}`,
      data: { request_id: request.id, items: requestedItems },
    }));
  if (notificationRows.length > 0) {
    await db.from("notifications").insert(notificationRows);
  }

  const emailRecipients = splitEmailRecipients(input.recipients);
  if (emailRecipients.to.length > 0) {
    const result = await sendMessage({
      ownerId: input.profileId,
      deliveryMethod: "email",
      subject: input.subject,
      body: input.body,
      emailTo: emailRecipients.to,
      emailCc: emailRecipients.cc,
      emailHtml: buildWorkspaceRequestEmail({
        subject: input.subject,
        body: input.body,
        ctaLabel: input.ctaLabel,
        ctaUrl: requestUrl,
        trustNote: input.trustNote,
        requestedItems,
      }),
    });

    if ("error" in result && result.error) {
      return { ok: false, error: result.error };
    }
  }

  for (const recipient of splitSmsRecipients(input.recipients)) {
    if (!recipient.profileId) {
      return {
        ok: false,
        error: `${recipient.fullName} needs portal access before SMS requests can be sent.`,
      };
    }

    const result = await sendMessage({
      ownerId: recipient.profileId,
      deliveryMethod: "sms",
      subject: input.subject,
      body: input.body,
      smsBody: `${input.body}<p>${input.ctaLabel}: ${requestUrl}</p>`,
    });

    if ("error" in result && result.error) {
      return { ok: false, error: result.error };
    }
  }

  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return {
    ok: true,
    sent: input.recipients.filter((recipient) => recipient.channels.length > 0).length,
  };
}

export async function toggleGateOverrideAction(input: {
  documentId: string;
  override: boolean;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ admin_gate_override: input.override })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function swapDocumentSortOrderAction(input: {
  documentIdA: string;
  documentIdB: string;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());

  const [{ data: rawA }, { data: rawB }] = await Promise.all([
    db.from("documents").select("id, display_sort_order").eq("id", input.documentIdA).maybeSingle(),
    db.from("documents").select("id, display_sort_order").eq("id", input.documentIdB).maybeSingle(),
  ]);

  const docA = rawA as { id: string; display_sort_order: number } | null;
  const docB = rawB as { id: string; display_sort_order: number } | null;

  if (!docA || !docB) return { ok: false, error: "Document not found." };

  await Promise.all([
    db.from("documents").update({ display_sort_order: docB.display_sort_order }).eq("id", docA.id),
    db.from("documents").update({ display_sort_order: docA.display_sort_order }).eq("id", docB.id),
  ]);

  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

const DEFAULT_GROUP_ORDER = [
  "owner_package",
  "payment_setup",
  "house_information",
  "compliance_and_policy",
  "access_and_operations",
] as const;

export async function moveDocumentToGroupAction(input: {
  documentId: string;
  groupKey: string;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ display_group: input.groupKey })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function swapGroupSortOrderAction(input: {
  profileId: string;
  groupKeyA: string;
  groupKeyB: string;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());

  // Load existing rows for this profile.
  const { data: existing } = await db
    .from("document_group_settings")
    .select("group_key, sort_order")
    .eq("profile_id", input.profileId);

  const rows = (existing ?? []) as Array<{ group_key: string; sort_order: number }>;
  const orderMap = new Map(rows.map((r) => [r.group_key, r.sort_order]));

  // Backfill all groups on first call if no rows exist yet.
  if (orderMap.size === 0) {
    DEFAULT_GROUP_ORDER.forEach((key, idx) => orderMap.set(key, idx));
  }

  const orderA = orderMap.get(input.groupKeyA) ?? DEFAULT_GROUP_ORDER.indexOf(input.groupKeyA as (typeof DEFAULT_GROUP_ORDER)[number]);
  const orderB = orderMap.get(input.groupKeyB) ?? DEFAULT_GROUP_ORDER.indexOf(input.groupKeyB as (typeof DEFAULT_GROUP_ORDER)[number]);

  const upsertRows = [
    { profile_id: input.profileId, group_key: input.groupKeyA, sort_order: orderB },
    { profile_id: input.profileId, group_key: input.groupKeyB, sort_order: orderA },
  ];

  const { error } = await db
    .from("document_group_settings")
    .upsert(upsertRows, { onConflict: "profile_id,group_key" });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function waiveDocumentAction(input: {
  documentId: string;
  waived: boolean;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ waived: input.waived })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function setUrgentFlagAction(input: {
  documentId: string;
  urgent: boolean;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ is_urgent: input.urgent })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function setDocumentDeadlineAction(input: {
  documentId: string;
  dueDate: string | null;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ custom_due_date: input.dueDate })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function updateAdminNoteAction(input: {
  documentId: string;
  note: string;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ admin_note: input.note.trim() || null })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function updateOwnerNoteAction(input: {
  documentId: string;
  note: string;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ owner_note: input.note.trim() || null })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function markDocumentCompleteAction(input: {
  documentId: string;
  note: string;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const trimmedNote = input.note.trim();
  if (trimmedNote.length < 10) return { ok: false, error: "Note must be at least 10 characters." };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({
      manually_completed_at: new Date().toISOString(),
      manually_completed_note: trimmedNote,
    })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}

export async function unmarkDocumentCompleteAction(input: {
  documentId: string;
  workspaceId: string;
}): Promise<WorkspaceDocumentActionResult> {
  const { error: authError } = await requireAdmin();
  if (authError) return { ok: false, error: authError };

  const db = untypedDatabase(createServiceClient());
  const { error } = await db
    .from("documents")
    .update({ manually_completed_at: null, manually_completed_note: null })
    .eq("id", input.documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/workspaces/${input.workspaceId}`);
  return { ok: true };
}
