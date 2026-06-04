"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { buildMessageEmail } from "@/lib/email-template";
import { createNotification } from "@/lib/notifications";
import { sendPushToOwner } from "@/lib/push";
import { logTimelineEvent } from "@/lib/timeline";
import {
  sendEmailChannel,
  sendSmsChannel,
  smsText,
  normalizePhoneE164,
} from "@/lib/channels/send";

export type MessageChannel = "portal" | "email" | "sms";

export type ChannelDelivery = {
  channel: MessageChannel;
  status: "sent" | "delivered" | "failed" | "scheduled";
  error?: string;
};

function parseFutureDate(s?: string): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t) || t <= Date.now() + 30_000) return null;
  return new Date(t).toISOString();
}

export type SendWorkspaceMessageResult =
  | { ok: true; message: string; deliveries: ChannelDelivery[] }
  | { ok: false; message: string };

type ContactRow = {
  id: string;
  workspace_id: string | null;
  profile_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  full_name: string | null;
};

function firstNameOf(contact: ContactRow): string {
  return (
    contact.first_name?.trim() ||
    contact.full_name?.trim().split(" ")[0] ||
    contact.email?.split("@")[0] ||
    "there"
  );
}

function plainPreview(body: string): string {
  return body.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Send a message from a workspace to a contact across one or more
 * channels (owner portal, email, SMS).
 *
 * Owners (contacts with a linked profile) get a real portal message
 * thread entry plus push + in-app notification, so they can read and
 * reply from their portal. Email/SMS are delivered for real via Resend
 * and OpenPhone. Each channel's outcome is tracked in message_deliveries.
 *
 * Prospects (no linked profile) cannot receive portal messages, so the
 * send falls back to email/SMS only, logged in client_messages.
 */
export async function sendWorkspaceMessage(
  contactId: string,
  input: { channels: MessageChannel[]; subject?: string; body: string; scheduledAt?: string },
): Promise<SendWorkspaceMessageResult> {
  const body = input.body?.trim() ?? "";
  if (!body) return { ok: false, message: "Message cannot be empty." };

  const requested = [...new Set(input.channels ?? [])];
  if (requested.length === 0) {
    return { ok: false, message: "Select at least one channel." };
  }

  let adminId: string;
  try {
    const auth = await requireAdminUser();
    adminId = auth.user.id;
  } catch {
    return { ok: false, message: "Not authorized." };
  }

  const svc = createServiceClient();
  // Loose handle for tables/columns not yet in the generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = svc as any;

  const { data: contactData, error: contactErr } = await db
    .from("contacts")
    .select("id, workspace_id, profile_id, email, phone, first_name, full_name")
    .eq("id", contactId)
    .maybeSingle();

  if (contactErr || !contactData) {
    return { ok: false, message: "Contact not found." };
  }
  const contact = contactData as ContactRow;

  // Determine which requested channels are actually reachable.
  const phoneE164 = normalizePhoneE164(contact.phone);
  const reachable = (c: MessageChannel): boolean =>
    c === "portal"
      ? !!contact.profile_id
      : c === "email"
        ? !!contact.email
        : !!phoneE164;

  const channels = requested.filter(reachable);
  if (channels.length === 0) {
    return {
      ok: false,
      message: "This contact has no reachable address for the selected channels.",
    };
  }

  const subject = input.subject?.trim() || "Message from The Parcel Company";
  const firstName = firstNameOf(contact);
  const revalidate = () => {
    if (contact.workspace_id) revalidatePath(`/admin/workspaces/${contact.workspace_id}`);
  };

  // --- Delivery primitives shared by both paths -----------------------------
  const deliverEmail = async (): Promise<ChannelDelivery> => {
    const html = buildMessageEmail({ subject, body, ownerName: firstName });
    const res = await sendEmailChannel({ to: contact.email!, subject, html });
    return res.ok
      ? { channel: "email", status: "sent" }
      : { channel: "email", status: "failed", error: res.error };
  };
  const deliverSms = async (): Promise<ChannelDelivery> => {
    const res = await sendSmsChannel({ to: phoneE164!, content: smsText(body) });
    return res.ok
      ? { channel: "sms", status: "sent" }
      : { channel: "sms", status: "failed", error: res.error };
  };

  // =========================================================================
  // Owner path — portal-backed message + multi-channel fan-out
  // =========================================================================
  if (contact.profile_id) {
    const ownerId = contact.profile_id;

    // Find or create the 1:1 direct conversation with this owner.
    const { data: existing } = await svc
      .from("conversations")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("type", "direct")
      .maybeSingle();

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data: conv, error: convErr } = await svc
        .from("conversations")
        .insert({ owner_id: ownerId, type: "direct", subject })
        .select("id")
        .single();
      if (convErr || !conv) {
        return { ok: false, message: "Failed to open conversation." };
      }
      conversationId = conv.id;
    }

    const metadata = { subject, channels };

    const { data: msg, error: msgErr } = await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: adminId,
        body,
        subject,
        delivery_method: channels.includes("portal") ? "portal" : channels[0],
        metadata,
      })
      .select("id")
      .single();

    if (msgErr || !msg) {
      return { ok: false, message: "Failed to record message." };
    }

    // Scheduled send: persist 'scheduled' deliveries and stop. The cron
    // (api/cron/flush-scheduled-messages) delivers them when due.
    const scheduledAt = parseFutureDate(input.scheduledAt);
    if (scheduledAt) {
      await db.from("message_deliveries").insert(
        channels.map((channel) => ({
          message_id: msg.id,
          channel,
          status: "scheduled",
          scheduled_at: scheduledAt,
        })),
      );
      void db.from("activity_log").insert({
        action: "message_scheduled",
        entity_type: "message",
        entity_id: msg.id,
        actor_id: adminId,
        metadata: { recipient_id: ownerId, channels, scheduled_at: scheduledAt },
      });
      revalidate();
      return {
        ok: true,
        message: `Scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
        deliveries: channels.map((c) => ({ channel: c, status: "scheduled" as const })),
      };
    }

    // Fan out to each channel in parallel.
    const deliveries: ChannelDelivery[] = await Promise.all(
      channels.map(async (channel): Promise<ChannelDelivery> => {
        if (channel === "portal") {
          await Promise.all([
            createNotification({
              ownerId,
              type: "message_received",
              title: "New message from The Parcel Company",
              body: plainPreview(body),
              link: "/portal/messages",
            }),
            sendPushToOwner({
              ownerId,
              title: "The Parcel Company",
              body: plainPreview(body),
              url: "/portal/messages",
              tag: "message",
            }),
          ]).catch(() => {});
          return { channel: "portal", status: "delivered" };
        }
        if (channel === "email") return deliverEmail();
        return deliverSms();
      }),
    );

    // Persist per-channel delivery rows.
    const now = new Date().toISOString();
    await db.from("message_deliveries").insert(
      deliveries.map((d) => ({
        message_id: msg.id,
        channel: d.channel,
        status: d.status,
        error: d.error ?? null,
        sent_at: d.status === "failed" ? null : now,
        delivered_at: d.status === "delivered" ? now : null,
      })),
    );

    void logTimelineEvent({
      ownerId,
      eventType: "message_received",
      category: "communication",
      title: "Message from Parcel",
      body: plainPreview(body),
      visibility: "admin_only",
    });

    void db.from("activity_log").insert({
      action: "message_sent",
      entity_type: "message",
      entity_id: msg.id,
      actor_id: adminId,
      metadata: {
        recipient_id: ownerId,
        channels,
        subject,
        description: `Message sent to owner via ${channels.join(", ")}`,
      },
    });

    revalidate();
    return { ok: true, message: summarize(deliveries), deliveries };
  }

  // =========================================================================
  // Prospect path — no portal; email/SMS only, logged in client_messages
  // =========================================================================
  const deliveries: ChannelDelivery[] = await Promise.all(
    channels
      .filter((c) => c !== "portal")
      .map((channel) => (channel === "email" ? deliverEmail() : deliverSms())),
  );

  if (deliveries.length === 0) {
    return { ok: false, message: "Portal messaging requires a linked owner account." };
  }

  await db.from("client_messages").insert(
    deliveries.map((d) => ({
      contact_id: contactId,
      sender_type: "admin",
      sender_id: adminId,
      body,
      channel: d.channel === "email" ? "email" : "sms",
    })),
  );

  revalidate();
  return { ok: true, message: summarize(deliveries), deliveries };
}

function summarize(deliveries: ChannelDelivery[]): string {
  const failed = deliveries.filter((d) => d.status === "failed");
  if (failed.length === 0) return "Sent.";
  if (failed.length === deliveries.length) return "Failed to send.";
  return `Sent, but ${failed.map((d) => d.channel).join(" & ")} failed.`;
}

export async function togglePinMessage(
  messageId: string,
  workspaceId: string,
  pinned: boolean,
): Promise<{ ok: boolean }> {
  try {
    await requireAdminUser();
  } catch {
    return { ok: false };
  }

  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = svc as any;
  const { error } = await db
    .from("client_messages")
    .update({ pinned: !pinned })
    .eq("id", messageId);

  if (error) return { ok: false };
  if (workspaceId) revalidatePath(`/admin/workspaces/${workspaceId}`);
  return { ok: true };
}
