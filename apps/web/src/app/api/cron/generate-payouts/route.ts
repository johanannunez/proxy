import { NextResponse, type NextRequest } from "next/server";
import { runPayoutGeneration } from "@/lib/admin/generate-payouts";

/**
 * Cron: recompute owner payouts from bookings.
 *
 * The computation core is ready and this route authenticates like every other
 * cron (Bearer CRON_SECRET), BUT it is deliberately NOT registered in
 * apps/web/vercel.json yet.
 *
 * Why hold it: payout fees are hard-coded to 0, so net_payout == gross_revenue
 * (no fee-configuration model exists in the schema). The /admin/payouts page
 * and the CSV export read this table directly, so an unattended monthly cron
 * would silently publish economically wrong net figures. A human clicking the
 * admin button today knows it is a placeholder; a cron has no such judgment.
 *
 * Activate by adding { "path": "/api/cron/generate-payouts", "schedule":
 * "0 6 1 * *" } to vercel.json ONCE the fee model lands (Johan's call). The
 * route itself is finished and safe to deploy unregistered (it is simply never
 * invoked until scheduled or called manually with the secret).
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runPayoutGeneration();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  console.log("[cron/generate-payouts]", JSON.stringify(result));
  return NextResponse.json({ ok: true, upserted: result.upserted });
}
