import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Session-free core of owner payout generation.
 *
 * Aggregates non-cancelled bookings into one payout row per property per
 * calendar month of check_out, then upserts into `payouts` (idempotent on the
 * payouts_property_period_unique index over (property_id, period_start)).
 *
 * Extracted from the POST /api/admin/generate-payouts handler so the same logic
 * can run from the admin button (with a session check in the route) and from a
 * cron (with a CRON_SECRET check).
 *
 * KNOWN LIMITATION: fees are hard-coded to 0, so net_payout == gross_revenue.
 * There is no fee-configuration model in the schema yet (no fee_rate /
 * management_fee_percent on properties or workspaces). Until that lands the
 * computed net is NOT economically correct, which is why the cron route exists
 * but is intentionally left UNREGISTERED in vercel.json — see that route's note.
 */

export type PayoutGenerationResult =
  | { ok: true; upserted: number }
  | { ok: false; error: string };

export async function runPayoutGeneration(): Promise<PayoutGenerationResult> {
  const service = createServiceClient();

  const { data: bookings, error: bookingsError } = await service
    .from("bookings")
    .select("property_id, check_out, total_amount")
    .neq("status", "cancelled");

  if (bookingsError) {
    return { ok: false, error: bookingsError.message };
  }
  if (!bookings || bookings.length === 0) {
    return { ok: true, upserted: 0 };
  }

  // Group by property_id + month of check_out.
  const groups = new Map<
    string,
    { propertyId: string; periodStart: string; periodEnd: string; total: number }
  >();

  for (const b of bookings) {
    const co = new Date(b.check_out);
    const y = co.getFullYear();
    const m = co.getMonth();
    const periodStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const periodEnd = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const key = `${b.property_id}::${periodStart}`;

    const existing = groups.get(key);
    if (existing) {
      existing.total += Number(b.total_amount ?? 0);
    } else {
      groups.set(key, {
        propertyId: b.property_id,
        periodStart,
        periodEnd,
        total: Number(b.total_amount ?? 0),
      });
    }
  }

  const rows = Array.from(groups.values()).map((g) => ({
    property_id: g.propertyId,
    period_start: g.periodStart,
    period_end: g.periodEnd,
    gross_revenue: g.total,
    fees: 0,
    net_payout: g.total,
  }));

  const { error: upsertError } = await service.from("payouts").upsert(rows, {
    onConflict: "property_id,period_start",
    ignoreDuplicates: false,
  });

  if (upsertError) {
    return { ok: false, error: upsertError.message };
  }

  return { ok: true, upserted: rows.length };
}
