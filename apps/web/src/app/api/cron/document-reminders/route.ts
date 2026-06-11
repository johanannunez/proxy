import { NextResponse, type NextRequest } from "next/server";
import { findReminderCandidates, sendDocumentReminder } from "@/lib/documents/reminders";

/**
 * Daily cron: dispatches due document reminders (rounds 1-3).
 *
 * Triggered by Vercel Cron at 0 9 * * * (9 AM UTC). Schedule lives in
 * apps/web/vercel.json.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Feature gate: set ENABLE_DOCUMENT_REMINDER_CRON=true to activate sends.
 * Leaving it unset returns an early 200 so the cron runs silently — this
 * prevents a first-deploy flood to every owner with a backlog of incomplete
 * documents. Same pattern as /api/cron/follow-up-reminders.
 *
 * Missing RESEND_API_KEY is tolerated: each send skips with a logged warning
 * instead of failing the run.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[document-reminders] CRON_SECRET is not configured; refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.ENABLE_DOCUMENT_REMINDER_CRON !== "true") {
    return NextResponse.json({ ok: true, skipped: true, reason: "Feature gate disabled" });
  }

  const candidates = await findReminderCandidates();
  const results = { sent: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (const candidate of candidates) {
    try {
      const outcome = await sendDocumentReminder(candidate);
      if (outcome.sent) {
        results.sent++;
      } else {
        results.skipped++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${candidate.document_id}: ${String(err)}`);
    }
  }

  console.log(
    `[document-reminders] Done. candidates=${candidates.length} sent=${results.sent} skipped=${results.skipped} failed=${results.failed}`,
  );
  return NextResponse.json(results);
}
