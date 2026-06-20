import { createClient } from "@/lib/supabase/server";
import { runPayoutGeneration } from "@/lib/admin/generate-payouts";

/**
 * POST /api/admin/generate-payouts
 *
 * Aggregates non-cancelled bookings into monthly payout records per property.
 * Idempotent (upserts). Admin-only — checks the caller's profile role, then
 * delegates the computation to the shared, session-free core in
 * @/lib/admin/generate-payouts so the cron route can reuse it.
 */
export async function POST() {
  // --- Auth check: must be admin ---
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await runPayoutGeneration();
  if (!result.ok) {
    return Response.json(
      { error: "Payout generation failed", detail: result.error },
      { status: 500 },
    );
  }

  return Response.json({
    message:
      result.upserted === 0
        ? "No bookings found"
        : "Payouts generated successfully",
    upserted: result.upserted,
  });
}
