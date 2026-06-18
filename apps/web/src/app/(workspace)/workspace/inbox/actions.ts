"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logTimelineEvent } from "@/lib/timeline";
import type { Json } from "@/types/supabase";

/**
 * Reply to a conversation as an owner.
 * Verifies the user owns the conversation before inserting.
 */
export async function replyToConversation(args: {
  conversationId: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify ownership: RLS on conversations scopes to the authenticated user,
  // so if the row comes back, the user owns it.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", args.conversationId)
    .single();

  if (!conv) return { error: "Conversation not found" };

  // Insert message. Try to get the ID back for AI analysis, but don't
  // block on it if RLS prevents the select-back.
  const insertPayload = {
    conversation_id: args.conversationId,
    sender_id: user.id,
    body: args.body,
    delivery_method: "workspace",
    ...(args.metadata ? { metadata: args.metadata as Json } : {}),
  };

  const { data: msg, error } = await supabase
    .from("messages")
    .insert(insertPayload)
    .select("id")
    .single();

  // If select-back failed but insert succeeded, still treat as success
  if (error && error.code !== "PGRST116") {
    return { error: error.message };
  }

  // Log activity (fire-and-forget)
  const svc = createServiceClient();
  svc.from("activity_log").insert({
    action: "message_sent",
    entity_type: "message",
    entity_id: args.conversationId,
    actor_id: user.id,
    metadata: {
      conversation_id: args.conversationId,
      description: "Owner sent a message",
    },
  }).then(() => {}, () => {});

  void logTimelineEvent({
    ownerId: user.id,
    eventType: "message_sent",
    category: "communication",
    title: "New message sent",
    visibility: "admin_only",
  });

  revalidatePath("/workspace/inbox");
  return { success: true, messageId: msg?.id ?? null };
}

/**
 * Fetch messages for a conversation (owner side).
 */
export async function getConversationMessagesForOwner(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", conversation: null, messages: [] };

  const [convRes, msgsRes] = await Promise.all([
    supabase.from("conversations").select("id, owner_id, subject, type").eq("id", conversationId).single(),
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, body, is_system, delivery_method, metadata, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  if (convRes.error || !convRes.data) return { error: "Conversation not found", conversation: null, messages: [] };

  // Enrich messages with sender profile (name + avatar)
  const senderIds = [...new Set((msgsRes.data ?? []).map((m) => m.sender_id))];
  const { data: senders } = senderIds.length
    ? await supabase.from("profiles").select("id, full_name, email, role, avatar_url").in("id", senderIds)
    : { data: [] };
  const senderMap = new Map(
    (senders ?? []).map((s) => [s.id, { name: s.full_name?.trim() || s.email, role: s.role, avatarUrl: s.avatar_url }]),
  );

  const messages = (msgsRes.data ?? []).map((m) => ({
    ...m,
    senderName: senderMap.get(m.sender_id)?.name ?? "Proxy",
    senderRole: senderMap.get(m.sender_id)?.role ?? "admin",
    senderAvatarUrl: senderMap.get(m.sender_id)?.avatarUrl ?? null,
  }));

  return {
    conversation: convRes.data,
    messages,
    error: null,
  };
}

/**
 * Record read receipts for multiple messages in one call.
 * Replaces the old per-message recordMessageRead to avoid N+1 round-trips.
 */
export async function recordMessagesRead(args: {
  messageIds: string[];
  deviceInfo?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !args.messageIds.length) return;

  const rows = args.messageIds.map((id) => ({
    message_id: id,
    reader_id: user.id,
    device_info: args.deviceInfo ?? null,
  }));

  // Bulk insert, ignore duplicates (unique constraint on message_id + reader_id)
  await supabase.from("message_reads").upsert(rows, {
    onConflict: "message_id,reader_id",
    ignoreDuplicates: true,
  });
}

/**
 * Record a single read receipt (kept for backward compatibility).
 */
export async function recordMessageRead(args: {
  messageId: string;
  deviceInfo?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error: insertErr } = await supabase.from("message_reads").insert({
    message_id: args.messageId,
    reader_id: user.id,
    device_info: args.deviceInfo ?? null,
  });

  if (insertErr?.code === "23505") {
    await supabase.rpc("increment_message_read", {
      p_message_id: args.messageId,
      p_reader_id: user.id,
      p_device_info: args.deviceInfo ?? undefined,
    });
  }
}

/**
 * Create a direct conversation with Proxy for the current owner.
 * If one already exists, returns its ID.
 */
export async function createDirectConversation() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", conversationId: null };

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("type", "direct")
    .eq("owner_id", user.id)
    .limit(1)
    .single();

  if (existing) {
    return { conversationId: existing.id, error: null };
  }

  const { data: newConv, error } = await supabase
    .from("conversations")
    .insert({
      owner_id: user.id,
      type: "direct",
      subject: null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message, conversationId: null };

  revalidatePath("/workspace/inbox");
  return { conversationId: newConv.id, error: null };
}
