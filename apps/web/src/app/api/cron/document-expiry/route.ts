import { NextResponse, type NextRequest } from "next/server";
import { processDocumentExpiry } from "@/lib/documents/expiry";

/**
 * Daily cron: rolls document expiry statuses forward.
 * - past expires_at → 'expired'
 * - within 30 days  → 'expiring'
 *
 * Triggered by Vercel Cron at 0 8 * * * (8 AM UTC, one hour before the
 * reminder cron so reminders see fresh statuses). Schedule lives in
 * apps/web/vercel.json.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[document-expiry] CRON_SECRET is not configured; refusing to run.");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDocumentExpiry();
  console.log(
    `[document-expiry] Done. expired=${result.expired} expiring=${result.expiring}`,
  );
  return NextResponse.json(result);
}
