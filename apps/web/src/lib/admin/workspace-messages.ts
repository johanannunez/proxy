import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

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

// ---------------------------------------------------------------------------
// Unified thread — merges legacy/prospect client_messages with the owner's
// portal conversation (messages + per-channel delivery status), so every
// message sent from the Communication tab appears in one chronological view.
// ---------------------------------------------------------------------------

export type ThreadDelivery = { channel: string; status: string };

export type ThreadChannel = "in_app" | "portal" | "email" | "sms" | "call";

export type WorkspaceThreadItem = {
  id: string;
  source: "client_message" | "message" | "comm_event";
  contactId: string;
  channel: ThreadChannel;
  direction: "outbound" | "inbound";
  senderType: "admin" | "person";
  senderName: string;
  subject: string | null;
  body: string;
  isHtml: boolean;
  pinned: boolean;
  readAt: string | null;
  deliveries: ThreadDelivery[];
  recordingUrl?: string | null;
  transcript?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
};

const KNOWN_CHANNELS = new Set(["portal", "email", "sms"]);

export async function fetchWorkspaceThread(
  contactIds: string[],
): Promise<WorkspaceThreadItem[]> {
  if (contactIds.length === 0) return [];
  const svc = createServiceClient();
  // Loose handle for tables/columns not yet in the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = svc as any;

  // 1. Legacy / prospect messages (admin notes, email/SMS to non-owners).
  const { data: legacy } = await db
    .from("client_messages")
    .select(
      `id, contact_id, sender_type, sender_id, body, channel, pinned, read_at, created_at,
       sender:profiles(full_name)`,
    )
    .in("contact_id", contactIds);

  const items: WorkspaceThreadItem[] = (legacy ?? []).map(
    (row: Record<string, unknown>): WorkspaceThreadItem => {
      const sender = row.sender as { full_name: string } | null;
      const isAdmin = row.sender_type === "admin";
      const channel = (row.channel as string) === "email"
        ? "email"
        : (row.channel as string) === "sms"
          ? "sms"
          : "in_app";
      return {
        id: row.id as string,
        source: "client_message",
        contactId: row.contact_id as string,
        channel,
        direction: isAdmin ? "outbound" : "inbound",
        senderType: isAdmin ? "admin" : "person",
        senderName: sender?.full_name ?? (isAdmin ? "Parcel" : "Contact"),
        subject: null,
        body: row.body as string,
        isHtml: false,
        pinned: (row.pinned as boolean) ?? false,
        readAt: (row.read_at as string | null) ?? null,
        deliveries: [{ channel, status: "sent" }],
        createdAt: row.created_at as string,
      };
    },
  );

  // 2. Map owner contacts → their direct conversation.
  const { data: contacts } = await db
    .from("contacts")
    .select("id, profile_id")
    .in("id", contactIds);

  const profileToContact = new Map<string, string>();
  for (const c of (contacts ?? []) as { id: string; profile_id: string | null }[]) {
    if (c.profile_id) profileToContact.set(c.profile_id, c.id);
  }

  if (profileToContact.size > 0) {
    const ownerIds = [...profileToContact.keys()];
    const { data: convs } = await svc
      .from("conversations")
      .select("id, owner_id")
      .eq("type", "direct")
      .in("owner_id", ownerIds);

    const convToOwner = new Map<string, string>();
    for (const c of (convs ?? []) as { id: string; owner_id: string }[]) {
      convToOwner.set(c.id, c.owner_id);
    }
    const convIds = [...convToOwner.keys()];

    if (convIds.length > 0) {
      const { data: msgs } = await db
        .from("messages")
        .select(
          "id, conversation_id, sender_id, body, subject, delivery_method, metadata, created_at",
        )
        .in("conversation_id", convIds);

      const msgRows = (msgs ?? []) as Array<{
        id: string;
        conversation_id: string;
        sender_id: string;
        body: string;
        subject: string | null;
        delivery_method: string;
        metadata: Record<string, unknown> | null;
        created_at: string;
      }>;

      // Per-channel delivery status.
      const msgIds = msgRows.map((m) => m.id);
      const { data: dels } = msgIds.length
        ? await db
            .from("message_deliveries")
            .select("message_id, channel, status")
            .in("message_id", msgIds)
        : { data: [] };
      const delByMsg = new Map<string, ThreadDelivery[]>();
      for (const d of (dels ?? []) as Array<{
        message_id: string;
        channel: string;
        status: string;
      }>) {
        const arr = delByMsg.get(d.message_id) ?? [];
        arr.push({ channel: d.channel, status: d.status });
        delByMsg.set(d.message_id, arr);
      }

      // Sender display names.
      const senderIds = [...new Set(msgRows.map((m) => m.sender_id))];
      const { data: senders } = senderIds.length
        ? await svc.from("profiles").select("id, full_name, email").in("id", senderIds)
        : { data: [] };
      const senderName = new Map(
        ((senders ?? []) as Array<{ id: string; full_name: string | null; email: string }>).map(
          (s) => [s.id, s.full_name?.trim() || s.email],
        ),
      );

      for (const m of msgRows) {
        const ownerId = convToOwner.get(m.conversation_id);
        const contactId = ownerId ? profileToContact.get(ownerId) : undefined;
        if (!contactId) continue;
        const isInbound = m.sender_id === ownerId;
        const channel = KNOWN_CHANNELS.has(m.delivery_method)
          ? (m.delivery_method as "portal" | "email" | "sms")
          : "portal";
        items.push({
          id: m.id,
          source: "message",
          contactId,
          channel,
          direction: isInbound ? "inbound" : "outbound",
          senderType: isInbound ? "person" : "admin",
          senderName: senderName.get(m.sender_id) ?? (isInbound ? "Owner" : "Parcel"),
          subject: m.subject ?? ((m.metadata?.subject as string | undefined) ?? null),
          body: m.body,
          isHtml: true,
          pinned: false,
          readAt: null,
          deliveries: delByMsg.get(m.id) ?? [{ channel, status: "sent" }],
          createdAt: m.created_at,
        });
      }
    }
  }

  // 3. Captured calls + inbound SMS replies (Quo / OpenPhone webhook).
  //    Outbound SMS is skipped to avoid duplicating our own sent texts,
  //    which already appear as message / client_message items above.
  const ownerProfileIds = [...profileToContact.keys()];
  const orParts = [`and(entity_type.eq.contact,entity_id.in.(${contactIds.join(",")}))`];
  if (ownerProfileIds.length > 0) {
    orParts.push(`and(entity_type.eq.owner,entity_id.in.(${ownerProfileIds.join(",")}))`);
  }

  const { data: events } = await db
    .from("communication_events")
    .select(
      "id, channel, direction, raw_transcript, duration_seconds, recording_url, quo_summary, claude_summary, entity_type, entity_id, created_at",
    )
    .or(orParts.join(","))
    .order("created_at", { ascending: false })
    .limit(100);

  for (const e of (events ?? []) as Array<Record<string, unknown>>) {
    const channel = e.channel as string;
    const direction = e.direction as string;
    const isCall = channel === "call";
    // Calls always; SMS only inbound (our outbound SMS is shown elsewhere).
    if (!isCall && !(channel === "sms" && direction === "inbound")) continue;

    const contactId =
      e.entity_type === "contact"
        ? (e.entity_id as string)
        : profileToContact.get(e.entity_id as string);
    if (!contactId || !contactIds.includes(contactId)) continue;

    const inbound = direction === "inbound";
    items.push({
      id: e.id as string,
      source: "comm_event",
      contactId,
      channel: isCall ? "call" : "sms",
      direction: inbound ? "inbound" : "outbound",
      senderType: inbound ? "person" : "admin",
      senderName: inbound ? "Contact" : "Parcel",
      subject: null,
      body: isCall
        ? ((e.claude_summary as string) || (e.quo_summary as string) || "Phone call")
        : ((e.raw_transcript as string) || (e.quo_summary as string) || ""),
      isHtml: false,
      pinned: false,
      readAt: null,
      deliveries: [{ channel: isCall ? "call" : "sms", status: "delivered" }],
      recordingUrl: (e.recording_url as string | null) ?? null,
      transcript: isCall ? ((e.raw_transcript as string | null) ?? null) : null,
      durationSeconds: (e.duration_seconds as number | null) ?? null,
      createdAt: e.created_at as string,
    });
  }

  // 4. Pinned first, then chronological.
  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return items;
}
