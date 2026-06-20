import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";

/**
 * Daily cron: snapshot agency-operating MRR.
 *
 * platform_agency_operating_mrr is point-in-time only, so the Platform Console's
 * hero "MRR vs last period" delta and the MRR trend have no history to read. This
 * job appends one row per agency per UTC day from the view into
 * platform_mrr_snapshots. Idempotent: re-running on the same day updates that
 * day's rows rather than duplicating, so the series stays one-point-per-day.
 *
 * Read-only against live billing — it copies the reconciliation view, never
 * touches money. Service-role only (the snapshot table is walled to service_role).
 *
 * Schedule lives in apps/web/vercel.json. Auth: Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type MrrRow = {
  agency_id: string;
  plan_tier: string | null;
  reconciled_mrr_cents: number;
  schedule_mrr_cents: number;
  legacy_mrr_cents: number;
  legacy_mrr_agency_total_cents: number;
  billing_workspace_count: number;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = untypedDatabase(createServiceClient());
  const capturedDate = new Date().toISOString().slice(0, 10); // UTC date

  const { data: rows, error } = await db
    .from<MrrRow[]>("platform_agency_operating_mrr")
    .select(
      "agency_id, plan_tier, reconciled_mrr_cents, schedule_mrr_cents, legacy_mrr_cents, legacy_mrr_agency_total_cents, billing_workspace_count",
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const snapshots = (rows ?? []).map((r) => ({
    captured_date: capturedDate,
    agency_id: r.agency_id,
    plan_tier: r.plan_tier,
    reconciled_mrr_cents: r.reconciled_mrr_cents,
    schedule_mrr_cents: r.schedule_mrr_cents,
    legacy_mrr_cents: r.legacy_mrr_cents,
    legacy_mrr_agency_total_cents: r.legacy_mrr_agency_total_cents,
    billing_workspace_count: r.billing_workspace_count,
  }));

  if (snapshots.length > 0) {
    const { error: upsertError } = await db
      .from("platform_mrr_snapshots")
      .upsert(snapshots, { onConflict: "captured_date,agency_id" });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  const summary = { ok: true, capturedDate, agencies: snapshots.length };
  console.log("[cron/platform-mrr-snapshot]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
