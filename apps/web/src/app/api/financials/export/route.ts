import { type NextRequest } from "next/server";
import { getPortalContext } from "@/lib/portal-context";
import { getOwnerFinancials, INVOICE_KIND_LABEL } from "@/lib/portal/financials";

export const dynamic = "force-dynamic";

/**
 * GET /api/financials/export?year=2026
 *
 * Returns a CSV statement of the authenticated owner's invoices for
 * the requested year. Mirrors apps/web/src/app/api/payouts/export.
 *
 * Scope: invoices created during the requested calendar year, all
 * statuses except draft. Hosted invoice URL (Stripe-hosted page) is
 * included so the recipient can pull the PDF from the source.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get("year");
  const year = Number.isFinite(Number(yearParam))
    ? Number(yearParam)
    : new Date().getUTCFullYear();

  const { userId, client } = await getPortalContext();

  const financials = await getOwnerFinancials(client, userId);

  const rows = financials.monthlyGroups
    .flatMap((group) => group.invoices)
    .filter((invoice) => new Date(invoice.createdAt).getUTCFullYear() === year);

  const header = [
    "Date",
    "Kind",
    "Description",
    "Property",
    "Amount (USD)",
    "Status",
    "Paid at",
    "Hosted invoice URL",
  ];

  const dataRows = rows.map((invoice) => [
    invoice.createdAt.slice(0, 10),
    INVOICE_KIND_LABEL[invoice.kind] ?? invoice.kind,
    invoice.description ?? "",
    invoice.propertyLabel ?? "",
    (invoice.amountCents / 100).toFixed(2),
    invoice.status,
    invoice.paidAt?.slice(0, 10) ?? "",
    invoice.hostedInvoiceUrl ?? "",
  ]);

  const csv = [header, ...dataRows]
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
      "Content-Disposition": `attachment; filename="parcel-invoices-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
