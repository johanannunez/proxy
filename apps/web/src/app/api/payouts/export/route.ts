import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/payouts/export?year=2026
 *
 * Returns a CSV statement of the authenticated owner's payouts for
 * the requested year. RLS on public.payouts ensures the caller only
 * sees their own rows.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [{ data: payouts }, { data: properties }] = await Promise.all([
    supabase
      .from("payouts")
      .select(
        "id, property_id, period_start, period_end, gross_revenue, fees, net_payout, paid_at",
      )
      .gte("period_start", start)
      .lte("period_end", end)
      .order("period_start", { ascending: true }),
    supabase.from("properties").select("id, name, address_line1"),
  ]);

  const propName = new Map<string, string>(
    (properties ?? []).map((p) => [p.id, p.name?.trim() || p.address_line1]),
  );

  const header = [
    "Period start",
    "Period end",
    "Property",
    "Gross revenue",
    "Fees",
    "Net payout",
    "Status",
    "Paid at",
  ];

  const rows = (payouts ?? []).map((r) => [
    r.period_start,
    r.period_end,
    propName.get(r.property_id) ?? "",
    String(r.gross_revenue),
    String(r.fees),
    String(r.net_payout),
    r.paid_at ? "paid" : "pending",
    r.paid_at ?? "",
  ]);

  const csv = [header, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    )
    .join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="proxy-payouts-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
