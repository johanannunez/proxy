import "server-only";
import { createClient } from "@/lib/supabase/server";

export type WorkspaceMessage = {
  id: string;
  contactId: string;
  senderType: "admin" | "person";
  senderId: string;
  senderName: string;
  body: string;
  channel: "in_app" | "email";
  pinned: boolean;
  readAt: string | null;
  createdAt: string;
};

export type WorkspaceInboxConversation = {
  id: string;
  type: "direct" | "announcement" | "email_log";
  subject: string | null;
  contextLabel: string | null;
  lastMessageAt: string;
  lastMessageBody: string | null;
  lastDeliveryMethod: string | null;
};

function mapWorkspaceMessage(row: Record<string, unknown>): WorkspaceMessage {
  const sender = row.sender as { full_name: string } | null;
  const rawSenderType = row.sender_type === "admin" ? "admin" : "person";

  return {
    id: row.id as string,
    contactId: row.contact_id as string,
    senderType: rawSenderType,
    senderId: row.sender_id as string,
    senderName: sender?.full_name ?? "Unknown",
    body: row.body as string,
    channel: row.channel as "in_app" | "email",
    pinned: row.pinned as boolean,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchWorkspacePersonMessages(contactId: string): Promise<WorkspaceMessage[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("client_messages")
    .select(`
      id, contact_id, sender_type, sender_id, body, channel, pinned, read_at, created_at,
      sender:profiles(full_name)
    `)
    .eq("contact_id", contactId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[workspace-messages] fetch person messages error:", error.message);
    return [];
  }

  return (data ?? []).map(mapWorkspaceMessage);
}

export async function fetchWorkspaceMessages(contactIds: string[]): Promise<WorkspaceMessage[]> {
  if (contactIds.length === 0) return [];
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("client_messages")
    .select(`
      id, contact_id, sender_type, sender_id, body, channel, pinned, read_at, created_at,
      sender:profiles(full_name)
    `)
    .in("contact_id", contactIds)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[workspace-messages] fetch workspace messages error:", error.message);
    return [];
  }

  return (data ?? []).map(mapWorkspaceMessage);
}

export async function fetchWorkspaceInboxConversations(ownerId: string | null): Promise<WorkspaceInboxConversation[]> {
  if (!ownerId) return [];

  const supabase = await createClient();
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, subject, type, last_message_at")
    .eq("owner_id", ownerId)
    .order("last_message_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("[workspace-messages] fetch workspace inbox conversations error:", error.message);
    return [];
  }

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  const { data: messages } = conversationIds.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, delivery_method, metadata, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const lastMessageMap = new Map<
    string,
    { body: string; delivery_method: string; metadata: Record<string, unknown> }
  >();
  for (const message of messages ?? []) {
    if (!lastMessageMap.has(message.conversation_id)) {
      lastMessageMap.set(message.conversation_id, {
        body: message.body,
        delivery_method: message.delivery_method,
        metadata: isRecord(message.metadata) ? message.metadata : {},
      });
    }
  }

  return (conversations ?? []).map((conversation) => {
    const lastMessage = lastMessageMap.get(conversation.id);
    return {
      id: conversation.id,
      type: conversation.type as WorkspaceInboxConversation["type"],
      subject: conversation.subject,
      contextLabel: getWorkspaceInboxContextLabel(
        conversation.type as WorkspaceInboxConversation["type"],
        lastMessage?.delivery_method ?? null,
        lastMessage?.metadata ?? {},
      ),
      lastMessageAt: conversation.last_message_at,
      lastMessageBody: lastMessage?.body ?? null,
      lastDeliveryMethod: lastMessage?.delivery_method ?? null,
    };
  });
}

function getWorkspaceInboxContextLabel(
  conversationType: WorkspaceInboxConversation["type"],
  deliveryMethod: string | null,
  metadata: Record<string, unknown>,
): string | null {
  if (conversationType === "email_log" || deliveryMethod === "email") {
    const contactName = metadataString(metadata, "related_contact_name");
    if (contactName) return `Contact: ${contactName}`;

    const from = metadataString(metadata, "from");
    if (from && !from.toLowerCase().endsWith("@theparcelco.com")) return `From: ${from}`;

    const to = metadataStringArray(metadata, "to").find((email) => !email.toLowerCase().endsWith("@theparcelco.com"));
    if (to) return `To: ${to}`;
  }

  if (deliveryMethod === "sms") {
    const phone =
      metadataString(metadata, "phone_from") ??
      metadataString(metadata, "phone_to") ??
      metadataString(metadata, "sms_to");
    return phone ? `SMS: ${phone}` : "SMS";
  }

  return null;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataStringArray(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  const single = metadataString(metadata, key);
  return single ? [single] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
