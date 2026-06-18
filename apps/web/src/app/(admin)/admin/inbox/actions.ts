"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildMessageEmail, buildBroadcastEmail } from "@/lib/email-template";
import { sendPushToOwner, sendPushToAllOwners } from "@/lib/push";
import { createNotification, createNotificationForAllOwners } from "@/lib/notifications";
import { logTimelineEvent } from "@/lib/timeline";
import { sendOpenPhoneSms, smsTextFromHtml } from "@/lib/admin/sms-delivery";
import { untypedDatabase } from "@/lib/supabase/untyped";
import {
  resolveEmailReplyContext,
  resolveEmailReplyRecipients,
  resolveSendMessageConversationTarget,
  shouldNotifyOwnerForAdminMessage,
  type EmailReplyMessage,
  type EmailReplyContext,
  type InboxConversationForSend,
} from "./send-target";

/* ─── Helpers ─── */

async function sendViaResend(args: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}): Promise<{ ok: boolean; resendId?: string; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[Messages] RESEND_API_KEY not set, skipping email");
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Proxy <hello@myproxyhost.com>",
        to: args.to,
        cc: args.cc && args.cc.length > 0 ? args.cc : undefined,
        subject: args.subject,
        html: args.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[Messages] Resend error:", text);
      return { ok: false, error: text };
    }

    const data = await res.json();
    return { ok: true, resendId: data.id };
  } catch (err) {
    console.error("[Messages] Resend send failed:", err);
    return { ok: false, error: String(err) };
  }
}

async function fetchEmailReplyMessages(conversationId: string): Promise<EmailReplyMessage[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("messages")
    .select("delivery_method, metadata, created_at")
    .eq("conversation_id", conversationId)
    .eq("delivery_method", "email")
    .order("created_at", { ascending: true });

  return (data ?? []).map((message) => ({
    deliveryMethod: message.delivery_method,
    metadata: message.metadata,
  }));
}

/* ─── Actions ─── */

/**
 * Send a message from admin to an owner.
 * Supports portal-only or email delivery.
 */
export async function sendMessage(args: {
  ownerId: string;
  body: string;
  deliveryMethod?: "workspace" | "email" | "sms";
  subject?: string;
  conversationId?: string;
  emailHtml?: string;
  emailTo?: string[];
  emailCc?: string[];
  smsBody?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const svc = createServiceClient();
  const deliveryMethod = args.deliveryMethod ?? "workspace";

  let selectedConversation: InboxConversationForSend | null = null;
  if (args.conversationId) {
    const { data: conversation, error: conversationError } = await svc
      .from("conversations")
      .select("id, owner_id, type")
      .eq("id", args.conversationId)
      .maybeSingle();

    if (conversationError) return { error: conversationError.message };
    if (!conversation) return { error: "Conversation not found." };
    if (conversation.owner_id !== args.ownerId) {
      return { error: "Conversation does not belong to this owner." };
    }

    selectedConversation = {
      id: conversation.id,
      ownerId: conversation.owner_id,
      type: conversation.type as InboxConversationForSend["type"],
    };
  }

  // Find or create a direct conversation with this owner
  const { data: existing } = await svc
    .from("conversations")
    .select("id")
    .eq("owner_id", args.ownerId)
    .eq("type", "direct")
    .maybeSingle();

  const target = resolveSendMessageConversationTarget({
    deliveryMethod,
    selectedConversation,
    existingDirectConversationId: existing?.id ?? null,
  });

  if (!target.ok) return { error: target.error };

  let conversationId = target.conversationId;

  if (target.createDirect) {
    const { data: conv, error: convErr } = await svc
      .from("conversations")
      .insert({
        owner_id: args.ownerId,
        type: "direct",
        subject: args.subject ?? null,
      })
      .select("id")
      .single();

    if (convErr || !conv) return { error: convErr?.message ?? "Failed to create conversation" };
    conversationId = conv.id;
  }

  if (!conversationId) return { error: "Could not resolve conversation." };

  // If email delivery, send via Resend first
  let resendId: string | undefined;
  let emailRecipients: string[] = [];
  let emailReplyContext: EmailReplyContext = {};
  let ownerEmailForDelivery: string | null = null;
  let smsTo: string | undefined;
  let smsProviderMessageId: string | undefined;
  if (deliveryMethod === "email") {
    const { data: ownerProfile } = await svc
      .from("profiles")
      .select("email, full_name")
      .eq("id", args.ownerId)
      .single();

    ownerEmailForDelivery = ownerProfile?.email ?? null;
    const priorEmailMessages = selectedConversation?.type === "email_log"
      ? await fetchEmailReplyMessages(conversationId)
      : [];
    emailReplyContext = resolveEmailReplyContext(priorEmailMessages);
    const recipients = resolveEmailReplyRecipients({
      conversationType: selectedConversation?.type ?? "direct",
      ownerEmail: ownerProfile?.email,
      messages: priorEmailMessages,
    });

    if (!recipients.ok) return { error: recipients.error };
    emailRecipients = args.emailTo && args.emailTo.length > 0 ? args.emailTo : recipients.to;

    const subject = args.subject || "New message from Proxy";
    const html = args.emailHtml ?? buildMessageEmail({
      subject,
      body: args.body,
      conversationId,
      ownerName: ownerProfile?.full_name?.split(" ")[0] ?? undefined,
    });

    const result = await sendViaResend({
      to: emailRecipients,
      cc: args.emailCc,
      subject,
      html,
    });
    if (!result.ok) {
      return { error: result.error ?? "Email could not be sent." };
    }

    resendId = result.resendId;
  }

  if (deliveryMethod === "sms") {
    const { data: ownerProfile } = await svc
      .from("profiles")
      .select("phone")
      .eq("id", args.ownerId)
      .single();

    if (!ownerProfile?.phone) {
      return { error: "This owner does not have a phone number for SMS." };
    }

    const smsResult = await sendOpenPhoneSms({
      to: ownerProfile.phone,
      bodyHtml: args.smsBody ?? args.body,
    });

    if (!smsResult.ok) {
      return { error: smsResult.error };
    }

    smsTo = smsResult.normalizedTo;
    smsProviderMessageId = smsResult.providerMessageId;
  }

  // Insert the message
  const metadata: Record<string, string | string[]> = {};
  if (args.subject) metadata.subject = args.subject;
  if (deliveryMethod === "email") {
    metadata.direction = "outbound";
    metadata.from = "hello@myproxyhost.com";
    metadata.to = emailRecipients;
    if (args.emailCc && args.emailCc.length > 0) metadata.cc = args.emailCc;
    metadata.source = "admin_inbox";
    if (emailReplyContext.relatedContactId) metadata.related_contact_id = emailReplyContext.relatedContactId;
    if (emailReplyContext.relatedContactName) metadata.related_contact_name = emailReplyContext.relatedContactName;
    if (emailReplyContext.workspaceId) metadata.workspace_id = emailReplyContext.workspaceId;
  }
  if (resendId) {
    metadata.resend_id = resendId;
    metadata.resend_email_id = resendId;
  }
  if (smsTo) metadata.sms_to = smsTo;
  if (smsProviderMessageId) metadata.quo_id = smsProviderMessageId;

  const { data: msg, error: msgErr } = await svc
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: args.body,
      delivery_method: deliveryMethod,
      metadata: metadata as unknown as import("@/types/supabase").Json,
    })
    .select("id, created_at")
    .single();

  if (msgErr || !msg) return { error: msgErr?.message ?? "Failed to send message" };

  const shouldNotifyOwner = shouldNotifyOwnerForAdminMessage({
    deliveryMethod,
    conversationType: selectedConversation?.type ?? "direct",
    ownerEmail: ownerEmailForDelivery,
    recipients: emailRecipients,
  });

  if (deliveryMethod === "sms" && smsTo) {
    const adminPhone = process.env.OPENPHONE_PHONE_NUMBER ?? "";
    void untypedDatabase(svc)
      .from("communication_events")
      .insert({
        profile_id: user.id,
        quo_id: smsProviderMessageId ?? `admin-sms:${msg.id}`,
        channel: "sms",
        direction: "outbound",
        phone_from: adminPhone,
        phone_to: smsTo,
        raw_transcript: smsTextFromHtml(args.body),
        entity_type: "owner",
        entity_id: args.ownerId,
        processed_at: new Date().toISOString(),
        tier: "fyi",
      })
      .then(() => {}, () => {});
  }

  // In-app notification (only if there's actual content)
  if (shouldNotifyOwner && args.body.trim()) {
    createNotification({
      ownerId: args.ownerId,
      type: "message_received",
      title: "New message from Proxy",
      body: args.body.replace(/<[^>]*>/g, "").slice(0, 120),
      link: "/workspace/inbox",
    }).catch(() => {});
  }

  // Push notification (fire-and-forget)
  if (shouldNotifyOwner) {
    sendPushToOwner({
      ownerId: args.ownerId,
      title: "Proxy",
      body: args.body,
      url: "/workspace/inbox",
    }).catch(() => {});
  }

  // Log activity (fire-and-forget)
  svc.from("activity_log").insert({
    action: "message_sent",
    entity_type: "message",
    entity_id: msg.id,
    actor_id: user.id,
    metadata: {
      recipient_id: args.ownerId,
      recipients: emailRecipients,
      notified_owner: shouldNotifyOwner,
      delivery_method: deliveryMethod,
      subject: args.subject ?? null,
      description: shouldNotifyOwner
        ? `Message sent to owner via ${deliveryMethod}`
        : `Message sent via ${deliveryMethod}`,
    },
  }).then(() => {}, () => {});

  if (shouldNotifyOwner) {
    void logTimelineEvent({
      ownerId: args.ownerId,
      eventType: "message_received",
      category: "communication",
      title: "New message from Proxy",
      body: args.body.replace(/<[^>]*>/g, "").slice(0, 120),
      visibility: "admin_only",
    });
  }

  revalidatePath("/admin/inbox");
  return { success: true, messageId: msg.id, conversationId };
}

/**
 * Send a broadcast announcement to all owners.
 * Can deliver portal-only or portal + email to every owner.
 */
export async function sendBroadcast(args: {
  subject: string;
  body: string;
  deliveryMethod: "workspace" | "workspace_email";
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const svc = createServiceClient();

  // Create announcement conversation (owner_id = null)
  const { data: conv, error: convErr } = await svc
    .from("conversations")
    .insert({
      owner_id: null,
      type: "announcement",
      subject: args.subject,
    })
    .select("id")
    .single();

  if (convErr || !conv) return { error: convErr?.message ?? "Failed to create announcement" };

  // Insert the message
  const { data: msg, error: msgErr } = await svc
    .from("messages")
    .insert({
      conversation_id: conv.id,
      sender_id: user.id,
      body: args.body,
      is_system: true,
      delivery_method: args.deliveryMethod === "workspace_email" ? "email" : "workspace",
      metadata: { subject: args.subject } as unknown as import("@/types/supabase").Json,
    })
    .select("id")
    .single();

  if (msgErr || !msg) return { error: msgErr?.message ?? "Failed to send announcement" };

  // If email delivery, send to all owners
  if (args.deliveryMethod === "workspace_email") {
    const { data: owners, error: ownersErr } = await svc
      .from("profiles")
      .select("email, full_name")
      .eq("role", "owner");

    if (ownersErr) return { error: `Failed to fetch owners: ${ownersErr.message}` };

    if (owners?.length) {
      const emailPromises = owners.map((owner) => {
        const html = buildBroadcastEmail({
          subject: args.subject,
          body: args.body,
          ownerName: owner.full_name?.split(" ")[0] ?? undefined,
        });
        return sendViaResend({
          to: [owner.email],
          subject: args.subject,
          html,
        });
      });

      // Send in parallel, don't block on failures
      await Promise.allSettled(emailPromises);
    }
  }

  // In-app notifications for all owners
  createNotificationForAllOwners({
    type: "announcement",
    title: args.subject,
    body: args.body.replace(/<[^>]*>/g, "").slice(0, 120),
    link: "/workspace/inbox",
  }).catch(() => {});

  // Push notification to all owners (fire-and-forget)
  sendPushToAllOwners({
    title: "Proxy Announcement",
    body: args.body,
    url: "/workspace/inbox",
  }).catch(() => {});

  // Log activity (fire-and-forget)
  svc.from("activity_log").insert({
    action: "broadcast_sent",
    entity_type: "message",
    entity_id: conv.id,
    actor_id: user.id,
    metadata: {
      subject: args.subject,
      delivery_method: args.deliveryMethod,
      description: `Broadcast announcement sent: ${args.subject}`,
    },
  }).then(() => {}, () => {});

  revalidatePath("/admin/inbox");
  return { success: true, conversationId: conv.id, ownerCount: 0 };
}

/**
 * Get the count of owners (for broadcast preview).
 */
export async function getOwnerCount(): Promise<number | null> {
  const svc = createServiceClient();
  const { count, error } = await svc
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner");
  if (error) return null;
  return count ?? 0;
}

export async function getOrCreateDirectConversation(ownerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", conversationId: null };

  const svc = createServiceClient();
  const { data: existing, error: existingError } = await svc
    .from("conversations")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("type", "direct")
    .maybeSingle();

  if (existingError) return { error: existingError.message, conversationId: null };
  if (existing?.id) return { conversationId: existing.id, error: null };

  const { data: conversation, error } = await svc
    .from("conversations")
    .insert({
      owner_id: ownerId,
      type: "direct",
      subject: null,
    })
    .select("id")
    .single();

  if (error || !conversation) {
    return { error: error?.message ?? "Failed to create conversation", conversationId: null };
  }

  revalidatePath("/admin/inbox");
  return { conversationId: conversation.id, error: null };
}

/**
 * Fetch all conversations for the admin inbox.
 */
export async function getAdminConversations(filter?: string) {
  const svc = createServiceClient();

  let query = svc
    .from("conversations")
    .select("id, owner_id, subject, type, last_message_at, created_at")
    .order("last_message_at", { ascending: false })
    .limit(100);

  if (filter === "announcements") {
    query = query.eq("type", "announcement");
  } else if (filter === "email_logs") {
    query = query.eq("type", "email_log");
  }

  const { data, error } = await query;
  if (error) return { error: error.message, conversations: [] };

  const ownerIds = [...new Set((data ?? []).map((c) => c.owner_id).filter(Boolean))] as string[];
  const conversationIds = (data ?? []).map((c) => c.id);

  const [ownersRes, messagesRes] = await Promise.all([
    ownerIds.length
      ? svc.from("profiles").select("id, full_name, email, phone").in("id", ownerIds)
      : { data: [] },
    conversationIds.length
      ? svc
          .from("messages")
          .select("id, conversation_id, sender_id, body, delivery_method, metadata, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : { data: [] },
  ]);

  const ownerMap = new Map(
    (ownersRes.data ?? []).map((o) => [
      o.id,
      { name: o.full_name?.trim() || o.email, email: o.email, phone: o.phone },
    ]),
  );

  const lastSenderIds = [
    ...new Set((messagesRes.data ?? []).map((m) => m.sender_id).filter(Boolean)),
  ] as string[];
  const { data: lastSenders } = lastSenderIds.length
    ? await svc.from("profiles").select("id, role").in("id", lastSenderIds)
    : { data: [] };
  const lastSenderRoleMap = new Map((lastSenders ?? []).map((sender) => [sender.id, sender.role]));

  const lastMessageMap = new Map<
    string,
    {
      body: string;
      senderId: string;
      senderRole: string | null;
      createdAt: string;
      deliveryMethod: string;
      metadata: Record<string, unknown>;
    }
  >();
  for (const m of messagesRes.data ?? []) {
    if (!lastMessageMap.has(m.conversation_id)) {
      lastMessageMap.set(m.conversation_id, {
        body: m.body,
        senderId: m.sender_id,
        senderRole: lastSenderRoleMap.get(m.sender_id) ?? null,
        createdAt: m.created_at,
        deliveryMethod: m.delivery_method,
        metadata: isRecord(m.metadata) ? m.metadata : {},
      });
    }
  }

  const conversations = (data ?? []).map((c) => ({
    ...c,
    ownerName: c.owner_id ? ownerMap.get(c.owner_id)?.name ?? "Unknown" : null,
    ownerEmail: c.owner_id ? ownerMap.get(c.owner_id)?.email ?? "" : null,
    ownerPhone: c.owner_id ? ownerMap.get(c.owner_id)?.phone ?? null : null,
    lastMessage: lastMessageMap.get(c.id) ?? null,
  }));

  return { conversations, error: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Fetch messages for a specific conversation.
 */
export async function getConversationMessages(conversationId: string) {
  const svc = createServiceClient();

  const [convRes, msgsRes] = await Promise.all([
    svc.from("conversations").select("id, owner_id, subject, type").eq("id", conversationId).single(),
    svc
      .from("messages")
      .select("id, conversation_id, sender_id, body, is_system, delivery_method, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  if (convRes.error || !convRes.data) return { error: "Conversation not found", conversation: null, messages: [] };

  const messageIds = (msgsRes.data ?? []).map((m) => m.id);
  const { data: reads } = messageIds.length
    ? await svc.from("message_reads").select("message_id, reader_id, first_read_at, read_count, last_read_at, device_info").in("message_id", messageIds)
    : { data: [] };

  const readMap = new Map<string, Array<{ readerId: string; firstReadAt: string; readCount: number; lastReadAt: string; deviceInfo: string | null }>>();
  for (const r of reads ?? []) {
    const existing = readMap.get(r.message_id) ?? [];
    existing.push({
      readerId: r.reader_id,
      firstReadAt: r.first_read_at,
      readCount: r.read_count,
      lastReadAt: r.last_read_at,
      deviceInfo: r.device_info,
    });
    readMap.set(r.message_id, existing);
  }

  const senderIds = [...new Set((msgsRes.data ?? []).map((m) => m.sender_id))];
  const { data: senders } = senderIds.length
    ? await svc.from("profiles").select("id, full_name, email, role, avatar_url").in("id", senderIds)
    : { data: [] };
  const senderMap = new Map((senders ?? []).map((s) => [s.id, { name: s.full_name?.trim() || s.email, role: s.role, avatarUrl: s.avatar_url }]));

  const messages = (msgsRes.data ?? []).map((m) => ({
    ...m,
    senderName: senderMap.get(m.sender_id)?.name ?? "Unknown",
    senderRole: senderMap.get(m.sender_id)?.role ?? "owner",
    senderAvatarUrl: senderMap.get(m.sender_id)?.avatarUrl ?? null,
    reads: readMap.get(m.id) ?? [],
  }));

  let ownerProfile = null;
  if (convRes.data.owner_id) {
    const { data: profile } = await svc
      .from("profiles")
      .select("id, full_name, email, phone, workspace_id")
      .eq("id", convRes.data.owner_id)
      .single();
    ownerProfile = profile
      ? {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          workspaceId: profile.workspace_id,
        }
      : null;
  }

  return {
    conversation: { ...convRes.data, ownerProfile },
    messages,
    error: null,
  };
}
