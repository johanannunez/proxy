import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import type { Json } from "@/types/supabase";
import type { EmailAttachmentMetadata } from "@/app/api/webhooks/resend/attachments";

type EmailDirection = "inbound" | "outbound";

type EmailLogMetadata = {
  subject: string;
  direction: EmailDirection;
  from: string;
  to: string[];
  message_id?: string;
  resend_id?: string;
  resend_email_id?: string;
  source?: string;
  related_contact_id?: string;
  related_contact_name?: string;
  workspace_id?: string;
  attachments?: EmailAttachmentMetadata[];
  attachment_count?: number;
};

type EmailLogResult =
  | { ok: true; conversationId: string; messageId: string }
  | { ok: true; conversationId: string; duplicate: true }
  | { ok: false; error: string };

/**
 * Log an outbound email to an owner's conversation history.
 * Creates an email_log conversation (or appends to existing) so the
 * owner can see the email record in their portal Messages page.
 *
 * Call this from anywhere that sends an email to an owner
 * (block request approvals, payout notifications, etc.).
 */
export async function logEmailToOwner(args: {
  ownerId: string;
  senderId: string;
  subject: string;
  bodyHtml: string;
  resendId?: string;
}) {
  await appendEmailToOwner({
    ownerId: args.ownerId,
    senderId: args.senderId,
    subject: args.subject,
    bodyHtml: args.bodyHtml,
    direction: "outbound",
    from: "hello@myproxyhost.com",
    to: [],
    resendId: args.resendId,
    source: "app",
  });
}

export async function appendEmailToOwner(args: {
  ownerId: string;
  senderId: string;
  subject: string;
  bodyHtml: string;
  direction: EmailDirection;
  from: string;
  to: string[];
  messageId?: string;
  resendId?: string;
  resendEmailId?: string;
  source?: string;
  attachments?: EmailAttachmentMetadata[];
  relatedContact?: {
    id: string;
    name: string | null;
    workspaceId: string | null;
  };
}): Promise<EmailLogResult> {
  const svc = createServiceClient();

  // Find or create an email_log conversation for this owner
  const { data: existing } = await svc
    .from("conversations")
    .select("id")
    .eq("owner_id", args.ownerId)
    .eq("type", "email_log")
    .maybeSingle();

  let conversationId = existing?.id;

  if (!conversationId) {
    const { data: conv } = await svc
      .from("conversations")
      .insert({
        owner_id: args.ownerId,
        type: "email_log",
        subject: "Email history",
      })
      .select("id")
      .single();

    conversationId = conv?.id;
  }

  if (!conversationId) return { ok: false, error: "Could not create email conversation." };

  const untyped = untypedDatabase(svc);
  if (args.resendEmailId) {
    const { data: duplicate } = await untyped
      .from<{ id: string }>("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("metadata->>resend_email_id", args.resendEmailId)
      .maybeSingle();

    if (duplicate?.id) return { ok: true, conversationId, duplicate: true };
  }

  if (args.messageId) {
    const { data: duplicate } = await untyped
      .from<{ id: string }>("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("metadata->>message_id", args.messageId)
      .maybeSingle();

    if (duplicate?.id) return { ok: true, conversationId, duplicate: true };
  }

  const metadata: EmailLogMetadata = {
    subject: args.subject,
    direction: args.direction,
    from: args.from,
    to: args.to,
  };
  if (args.messageId) metadata.message_id = args.messageId;
  if (args.resendId) metadata.resend_id = args.resendId;
  if (args.resendEmailId) metadata.resend_email_id = args.resendEmailId;
  if (args.source) metadata.source = args.source;
  if (args.attachments?.length) {
    metadata.attachments = args.attachments;
    metadata.attachment_count = args.attachments.length;
  }
  if (args.relatedContact) {
    metadata.related_contact_id = args.relatedContact.id;
    if (args.relatedContact.name) metadata.related_contact_name = args.relatedContact.name;
    if (args.relatedContact.workspaceId) metadata.workspace_id = args.relatedContact.workspaceId;
  }

  const { data: message, error } = await svc
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: args.senderId,
      body: args.bodyHtml,
      is_system: true,
      delivery_method: "email",
      metadata: metadata as unknown as Json,
    })
    .select("id")
    .single();

  if (error || !message) {
    return { ok: false, error: error?.message ?? "Could not append email." };
  }

  return { ok: true, conversationId, messageId: message.id };
}
