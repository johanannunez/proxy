import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { resolveSystemActor } from "@/lib/admin/system-actor";
import { generateDraftInvoiceForSchedule } from "@/lib/billing/generate-draft-invoice";

/**
 * Daily cron: generate draft invoices for every recurring management-fee
 * schedule that is due (status='active' and next_invoice_date on or before
 * today).
 *
 * Until now this only ran when an admin clicked "Generate draft" on a single
 * workspace's finance tab. Recurring billing that only fires on a human click
 * is a launch blocker, so the same generation logic now sweeps all due
 * schedules nightly.
 *
 * Safe to run unattended: it produces `review_ready` DRAFTS, never charges.
 * Money only moves when an admin approves a draft. Generation is idempotent per
 * (schedule, invoice_date) and advances next_invoice_date on success, so a
 * schedule is not regenerated for the same period.
 *
 * Schedule lives in apps/web/vercel.json. Auth: Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await resolveSystemActor();
  if (!actor) {
    return NextResponse.json(
      { error: "No system admin profile to attribute generated invoices to" },
      { status: 500 },
    );
  }

  // next_invoice_date is stored/advanced in UTC (toDateOnly uses toISOString),
  // so compare against the UTC date for consistency.
  const today = new Date().toISOString().slice(0, 10);

  const { data: due, error } = await untypedDatabase(createServiceClient())
    .from<{ id: string; workspace_id: string }[]>("billing_schedules")
    .select("id, workspace_id")
    .eq("status", "active")
    .lte("next_invoice_date", today)
    .order("next_invoice_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let generated = 0;
  let skipped = 0;
  const failures: Array<{ scheduleId: string; error: string }> = [];

  for (const schedule of due ?? []) {
    const outcome = await generateDraftInvoiceForSchedule({
      workspaceId: schedule.workspace_id,
      scheduleId: schedule.id,
      createdBy: actor.id,
    });
    if (outcome.ok) {
      generated += 1;
    } else if (outcome.code === "error") {
      failures.push({ scheduleId: schedule.id, error: outcome.message });
    } else {
      // not_found / no_date / no_lines / already_exists: benign, nothing to do.
      skipped += 1;
    }
  }

  const summary = {
    ok: true,
    due: due?.length ?? 0,
    generated,
    skipped,
    failed: failures.length,
    failures: failures.length > 0 ? failures : undefined,
  };
  console.log("[cron/billing-schedules]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
