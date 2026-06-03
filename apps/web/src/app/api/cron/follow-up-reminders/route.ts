import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildFollowUpDigestEmail } from "@/lib/email-template";

/**
 * Daily cron: sends an admin digest of contacts with due or overdue follow-ups.
 *
 * Triggered by Vercel Cron at 0 12 * * * (noon UTC = 7 AM CT).
 * Schedule lives in apps/web/vercel.json.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Feature gate: set ENABLE_FOLLOW_UP_CRON=true in Vercel env to activate.
 * Leaving the env var unset (or set to anything other than "true") returns
 * an early 200 so the cron runs silently without sending anything.
 *
 * Deduplication: contacts with follow_up_notified_at on today's date are
 * skipped — they won't appear in the digest again until tomorrow.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIGEST_TO = process.env.FOLLOW_UP_DIGEST_TO_EMAIL ?? "jo@johanannunez.com";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.ENABLE_FOLLOW_UP_CRON !== "true") {
    return NextResponse.json({ ok: true, skipped: true, reason: "Feature gate disabled" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const svc = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: contacts, error } = await (svc as any)
    .from("contacts")
    .select("id, full_name, email, next_follow_up_at, follow_up_notified_at")
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", now.toISOString())
    .or(`follow_up_notified_at.is.null,follow_up_notified_at.lt.${todayStart}`);

  if (error) {
    console.error("[follow-up-reminders] Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No follow-ups due today" });
  }

  const payload = (contacts as Array<{
    id: string;
    full_name: string;
    email: string | null;
    next_follow_up_at: string;
    follow_up_notified_at: string | null;
  }>).map((c) => {
    const dueDate = new Date(c.next_follow_up_at);
    const msOverdue = now.getTime() - dueDate.getTime();
    const daysOverdue = Math.floor(msOverdue / (1000 * 60 * 60 * 24));
    return {
      id: c.id,
      fullName: c.full_name,
      email: c.email,
      followUpAt: c.next_follow_up_at,
      daysOverdue,
    };
  });

  const { subject, html } = buildFollowUpDigestEmail({ contacts: payload });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "Proxy <hello@myproxyhost.com>",
      to: DIGEST_TO,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[follow-up-reminders] Resend error:", res.status, body);
    return NextResponse.json({ error: `Resend ${res.status}` }, { status: 500 });
  }

  // Mark all notified contacts so they don't appear again today.
  const ids = payload.map((c) => c.id);
  await (svc as any)
    .from("contacts")
    .update({ follow_up_notified_at: now.toISOString() })
    .in("id", ids);

  console.log(`[follow-up-reminders] Sent digest for ${payload.length} contacts.`);
  return NextResponse.json({ ok: true, sent: payload.length });
}
