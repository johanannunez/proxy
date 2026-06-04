import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { logEmailToOwner } from "@/lib/log-email";
import {
  buildMeetingCreatedEmail,
  buildMeetingCancelledEmail,
  buildMeetingRescheduledEmail,
  buildMeetingRecapEmail,
  type MeetingCreatedData,
  type MeetingCancelledData,
  type MeetingRescheduledData,
  type MeetingRecapData,
} from "./meeting-emails";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BRAND_FROM = '"Proxy" <hello@myproxyhost.com>';

// ---------------------------------------------------------------------------
// Owner contact lookup
// ---------------------------------------------------------------------------

interface OwnerContact {
  email: string | null;
  phone: string | null;
  firstName: string;
}

async function getOwnerContact(ownerId: string): Promise<OwnerContact> {
  const svc = createServiceClient();
  const db = untypedDatabase(svc);

  type ProfileRow = { email: string | null };
  type ContactRow = { phone: string | null; email: string | null; first_name: string | null };

  const [{ data: profile }, { data: contact }] = await Promise.all([
    db.from<ProfileRow>("profiles").select("email").eq("id", ownerId).maybeSingle(),
    db.from<ContactRow>("contacts").select("phone, email, first_name").eq("profile_id", ownerId).maybeSingle(),
  ]);

  const firstName =
    contact?.first_name ??
    contact?.email?.split("@")[0] ??
    profile?.email?.split("@")[0] ??
    "there";

  return {
    email: contact?.email ?? profile?.email ?? null,
    phone: contact?.phone ?? null,
    firstName,
  };
}

// ---------------------------------------------------------------------------
// Email sender (Resend)
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<string | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return null;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: BRAND_FROM, to, subject, html }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { id?: string };
    return json.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SMS sender (OpenPhone / Quo)
// ---------------------------------------------------------------------------

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

// Trim to 155 chars to leave room for " - Proxy" suffix without exceeding segment
function smsText(body: string): string {
  const suffix = " - Proxy";
  const max = 155 - suffix.length;
  const trimmed = body.length > max ? body.slice(0, max - 1) + "…" : body;
  return trimmed + suffix;
}

async function sendSMS(rawPhone: string, message: string): Promise<void> {
  const key = process.env.OPENPHONE_API_KEY;
  const from = process.env.OPENPHONE_PHONE_NUMBER; // E.164 or PN* id
  if (!key || !from || !rawPhone) return;

  const to = normalizePhone(rawPhone);
  if (!to) return;

  try {
    await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], content: message }),
    });
  } catch {
    // SMS is best-effort; never throw
  }
}

// ---------------------------------------------------------------------------
// Log email into owner conversation history
// ---------------------------------------------------------------------------

async function logEmail(
  ownerId: string,
  adminId: string,
  subject: string,
  html: string,
  resendId: string | null,
): Promise<void> {
  if (!resendId) return;
  await logEmailToOwner({
    ownerId,
    senderId: adminId,
    subject,
    bodyHtml: html,
    resendId,
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Public notification API
// ---------------------------------------------------------------------------

export async function notifyMeetingCreated(
  ownerId: string,
  adminId: string,
  data: Omit<MeetingCreatedData, "ownerFirstName">,
): Promise<void> {
  const { email, phone, firstName } = await getOwnerContact(ownerId);
  if (!email) return;

  const { subject, html } = buildMeetingCreatedEmail({ ...data, ownerFirstName: firstName });

  const dateStr = data.scheduledAt
    ? new Date(data.scheduledAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const smsBody = smsText(
    `Hi ${firstName}! "${data.title}" confirmed${dateStr ? ` for ${dateStr}` : ""}${data.meetLink ? `. Join: ${data.meetLink}` : ""}`,
  );

  const [resendId] = await Promise.all([
    sendEmail(email, subject, html),
    phone ? sendSMS(phone, smsBody) : Promise.resolve(),
  ]);

  await logEmail(ownerId, adminId, subject, html, resendId);
}

export async function notifyMeetingCancelled(
  ownerId: string,
  adminId: string,
  data: Omit<MeetingCancelledData, "ownerFirstName">,
): Promise<void> {
  const { email, phone, firstName } = await getOwnerContact(ownerId);
  if (!email) return;

  const { subject, html } = buildMeetingCancelledEmail({ ...data, ownerFirstName: firstName });

  const dateStr = data.scheduledAt
    ? new Date(data.scheduledAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  const smsBody = smsText(
    `Hi ${firstName}, your meeting "${data.title}"${dateStr ? ` on ${dateStr}` : ""} has been cancelled. Reply with any questions.`,
  );

  const [resendId] = await Promise.all([
    sendEmail(email, subject, html),
    phone ? sendSMS(phone, smsBody) : Promise.resolve(),
  ]);

  await logEmail(ownerId, adminId, subject, html, resendId);
}

export async function notifyMeetingRescheduled(
  ownerId: string,
  adminId: string,
  data: Omit<MeetingRescheduledData, "ownerFirstName">,
): Promise<void> {
  const { email, phone, firstName } = await getOwnerContact(ownerId);
  if (!email) return;

  const { subject, html } = buildMeetingRescheduledEmail({ ...data, ownerFirstName: firstName });

  const newDateStr = data.newScheduledAt
    ? new Date(data.newScheduledAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "a new time";

  const smsBody = smsText(
    `Hi ${firstName}, "${data.title}" has been moved to ${newDateStr}.`,
  );

  const [resendId] = await Promise.all([
    sendEmail(email, subject, html),
    phone ? sendSMS(phone, smsBody) : Promise.resolve(),
  ]);

  await logEmail(ownerId, adminId, subject, html, resendId);
}

export async function notifyMeetingRecapShared(
  ownerId: string,
  adminId: string,
  data: Omit<MeetingRecapData, "ownerFirstName">,
): Promise<void> {
  const { email, firstName } = await getOwnerContact(ownerId);
  if (!email) return;

  const { subject, html } = buildMeetingRecapEmail({ ...data, ownerFirstName: firstName });

  const resendId = await sendEmail(email, subject, html);
  await logEmail(ownerId, adminId, subject, html, resendId);
  // No SMS for recap — email is sufficient for a longer-form summary
}
