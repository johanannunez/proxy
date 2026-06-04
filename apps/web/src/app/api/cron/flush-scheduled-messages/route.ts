import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildMessageEmail } from "@/lib/email-template";
import { createNotification } from "@/lib/notifications";
import { sendPushToOwner } from "@/lib/push";
import { sendEmailChannel, sendSmsChannel, smsText, normalizePhoneE164 } from "@/lib/channels/send";

/**
 * Cron: delivers due scheduled messages.
 *
 * Finds message_deliveries rows with status='scheduled' and
 * scheduled_at <= now(), claims them (status -> 'queued', which is
 * atomic per row so concurrent runs never double-send), then delivers
 * each channel and records the final status.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 * Schedule lives in apps/web/vercel.json.
 */

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const db = svc as DB;
  const nowIso = new Date().toISOString();

  // 1. Atomically claim due rows.
  const { data: claimed, error: claimErr } = await db
    .from("message_deliveries")
    .update({ status: "queued" })
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .select("id, message_id, channel");

  if (claimErr) {
    return NextResponse.json({ error: claimErr.message }, { status: 500 });
  }
  const rows = (claimed ?? []) as Array<{ id: string; message_id: string; channel: string }>;
  if (rows.length === 0) {
    return NextResponse.json({ delivered: 0, failed: 0 });
  }

  // 2. Load the messages + owner contact info.
  const messageIds = [...new Set(rows.map((r) => r.message_id))];
  const { data: msgs } = await db
    .from("messages")
    .select("id, conversation_id, body, subject")
    .in("id", messageIds);
  const msgById = new Map(
    ((msgs ?? []) as Array<{ id: string; conversation_id: string; body: string; subject: string | null }>).map(
      (m) => [m.id, m],
    ),
  );

  const convIds = [...new Set([...msgById.values()].map((m) => m.conversation_id))];
  const { data: convs } = await db
    .from("conversations")
    .select("id, owner_id")
    .in("id", convIds);
  const ownerByConv = new Map(
    ((convs ?? []) as Array<{ id: string; owner_id: string | null }>).map((c) => [c.id, c.owner_id]),
  );

  const ownerIds = [...new Set([...ownerByConv.values()].filter(Boolean))] as string[];
  const { data: contacts } = ownerIds.length
    ? await db
        .from("contacts")
        .select("profile_id, email, phone, first_name, full_name")
        .in("profile_id", ownerIds)
    : { data: [] };
  const contactByOwner = new Map(
    ((contacts ?? []) as Array<Record<string, unknown>>).map((c) => [c.profile_id as string, c]),
  );

  let delivered = 0;
  let failed = 0;

  // 3. Deliver each claimed row.
  for (const row of rows) {
    const msg = msgById.get(row.message_id);
    const ownerId = msg ? ownerByConv.get(msg.conversation_id) : null;
    if (!msg || !ownerId) {
      await db.from("message_deliveries").update({ status: "failed", error: "message/owner missing" }).eq("id", row.id);
      failed++;
      continue;
    }
    const contact = contactByOwner.get(ownerId) as Record<string, unknown> | undefined;
    const firstName =
      (contact?.first_name as string) ||
      (contact?.full_name as string)?.split(" ")[0] ||
      "there";
    const subject = msg.subject || "Message from The Parcel Company";

    let status: "delivered" | "sent" | "failed" = "failed";
    let externalId: string | undefined;
    let error: string | undefined;

    if (row.channel === "portal") {
      await Promise.all([
        createNotification({
          ownerId,
          type: "message_received",
          title: "New message from The Parcel Company",
          body: msg.body.replace(/<[^>]*>/g, "").slice(0, 120),
          link: "/portal/messages",
        }),
        sendPushToOwner({
          ownerId,
          title: "The Parcel Company",
          body: msg.body.replace(/<[^>]*>/g, "").slice(0, 120),
          url: "/portal/messages",
          tag: "message",
        }),
      ]).catch(() => {});
      status = "delivered";
    } else if (row.channel === "email") {
      const to = contact?.email as string | undefined;
      if (!to) {
        error = "no email on file";
      } else {
        const res = await sendEmailChannel({
          to,
          subject,
          html: buildMessageEmail({ subject, body: msg.body, ownerName: firstName }),
        });
        status = res.ok ? "sent" : "failed";
        externalId = res.externalId;
        error = res.error;
      }
    } else if (row.channel === "sms") {
      const phone = normalizePhoneE164(contact?.phone as string | undefined);
      if (!phone) {
        error = "no phone on file";
      } else {
        const res = await sendSmsChannel({ to: phone, content: smsText(msg.body) });
        status = res.ok ? "sent" : "failed";
        externalId = res.externalId;
        error = res.error;
      }
    }

    const stamp = new Date().toISOString();
    await db
      .from("message_deliveries")
      .update({
        status,
        external_id: externalId ?? null,
        error: error ?? null,
        sent_at: status === "failed" ? null : stamp,
        delivered_at: status === "delivered" ? stamp : null,
      })
      .eq("id", row.id);

    if (status === "failed") failed++;
    else delivered++;
  }

  return NextResponse.json({ delivered, failed });
}
