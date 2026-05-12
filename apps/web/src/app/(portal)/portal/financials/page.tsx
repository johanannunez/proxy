import type { Metadata } from "next";
import {
  Receipt,
  ChartLineUp,
  ArrowSquareOut,
  DownloadSimple,
  Buildings,
} from "@phosphor-icons/react/dist/ssr";
import { getPortalContext } from "@/lib/portal-context";
import {
  getOwnerFinancials,
  INVOICE_KIND_LABEL,
  INVOICE_STATUS_STYLE,
} from "@/lib/portal/financials";
import { currency2, formatMedium } from "@/lib/format";
import { EmptyState } from "@/components/portal/EmptyState";

export const metadata: Metadata = { title: "Financials" };
export const dynamic = "force-dynamic";

export default async function FinancialsPage() {
  const { userId, client } = await getPortalContext();
  const financials = await getOwnerFinancials(client, userId);

  const hasInvoices = financials.monthlyGroups.length > 0;
  const currentYear = new Date().getUTCFullYear();

  return (
    <div className="flex flex-col gap-10">
      {/* Invoices section */}
      <section className="flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.10)",
                color: "var(--color-brand)",
              }}
            >
              <Receipt size={18} weight="duotone" />
            </span>
            <div>
              <h2
                className="text-base font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Invoices
              </h2>
              <p
                className="mt-0.5 text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Monthly fees, onboarding fees, and reimbursements. PDFs come straight from Stripe.
              </p>
            </div>
          </div>
          {hasInvoices ? (
            <a
              href={`/api/financials/export?year=${currentYear}`}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-warm-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-primary)",
              }}
            >
              <DownloadSimple size={14} weight="bold" />
              Download {currentYear} (CSV)
            </a>
          ) : null}
        </header>

        {/* Totals strip (only when there is at least one invoice). */}
        {hasInvoices ? (
          <div className="flex flex-wrap items-stretch gap-3">
            <TotalsCard
              label={`Paid in ${currentYear}`}
              value={currency2.format(financials.paidYearToDateCents / 100)}
              accent="paid"
            />
            <TotalsCard
              label="Outstanding"
              value={currency2.format(financials.outstandingCents / 100)}
              accent={financials.outstandingCents > 0 ? "open" : "neutral"}
            />
          </div>
        ) : null}

        {!hasInvoices ? (
          <EmptyState
            icon={<Receipt size={26} weight="duotone" />}
            title="No invoices yet"
            body="Your first invoice will appear after your first payout cycle. Until then, there is nothing to pay."
            action={
              <a
                href="/portal/help/financials-payouts/how-payouts-work"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.10)",
                  color: "var(--color-brand)",
                }}
              >
                How payouts work
                <ArrowSquareOut size={12} weight="bold" />
              </a>
            }
          />
        ) : (
          <div className="flex flex-col gap-8">
            {financials.monthlyGroups.map((group) => (
              <div key={group.monthKey} className="flex flex-col gap-3">
                <h3
                  className="text-sm font-semibold uppercase tracking-[0.12em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {group.monthLabel}
                </h3>

                <div className="flex flex-col gap-3">
                  {group.invoices.map((invoice) => {
                    const statusStyle = INVOICE_STATUS_STYLE[invoice.status];
                    return (
                      <article
                        key={invoice.id}
                        className="flex items-center gap-4 rounded-2xl border p-5 transition-colors"
                        style={{
                          backgroundColor: "var(--color-white)",
                          borderColor: "var(--color-warm-gray-200)",
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="truncate text-sm font-semibold"
                              style={{ color: "var(--color-text-primary)" }}
                            >
                              {invoice.description ?? INVOICE_KIND_LABEL[invoice.kind]}
                            </span>
                            <span
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{
                                backgroundColor: "var(--color-warm-gray-100)",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              {INVOICE_KIND_LABEL[invoice.kind]}
                            </span>
                          </div>
                          <div
                            className="mt-1 flex flex-wrap items-center gap-2 text-xs"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            <span>{formatMedium(invoice.createdAt)}</span>
                            {invoice.propertyLabel ? (
                              <>
                                <span style={{ color: "var(--color-warm-gray-200)" }}>|</span>
                                <span className="inline-flex items-center gap-1">
                                  <Buildings size={12} weight="duotone" />
                                  {invoice.propertyLabel}
                                </span>
                              </>
                            ) : null}
                            {invoice.paidAt ? (
                              <>
                                <span style={{ color: "var(--color-warm-gray-200)" }}>|</span>
                                <span>Paid {formatMedium(invoice.paidAt)}</span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <span
                          className="shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {currency2.format(invoice.amountCents / 100)}
                        </span>

                        <span
                          className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: statusStyle.background,
                            color: statusStyle.foreground,
                          }}
                        >
                          {statusStyle.label}
                        </span>

                        {invoice.hostedInvoiceUrl ? (
                          <a
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-warm-gray-50)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
                            style={{
                              borderColor: "var(--color-warm-gray-200)",
                              color: "var(--color-text-secondary)",
                            }}
                            aria-label={`Open ${INVOICE_KIND_LABEL[invoice.kind]} invoice in Stripe`}
                          >
                            <ArrowSquareOut size={16} weight="bold" />
                          </a>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Booking revenue card (unchanged from prior version). */}
      <section
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <div className="flex items-start gap-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "rgba(22, 163, 74, 0.10)",
              color: "#15803d",
            }}
          >
            <ChartLineUp size={18} weight="duotone" />
          </span>
          <div className="flex-1">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Booking Revenue
            </h2>
            <p
              className="mt-1 text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Track your booking performance, occupancy, and revenue directly in Hospitable, where
              all booking data lives.
            </p>
            <a
              href="https://app.hospitable.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-brand)]"
              style={{
                backgroundColor: "rgba(22, 163, 74, 0.10)",
                color: "#15803d",
                border: "1px solid rgba(22, 163, 74, 0.20)",
              }}
            >
              View in Hospitable <ArrowSquareOut size={14} weight="bold" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function TotalsCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "paid" | "open" | "neutral";
}) {
  const valueColor =
    accent === "paid"
      ? "#15803d"
      : accent === "open"
        ? "#b45309"
        : "var(--color-text-primary)";

  return (
    <div
      className="flex-1 min-w-[180px] rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-[0.10em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-2xl font-semibold tracking-tight tabular-nums"
        style={{ color: valueColor }}
      >
        {value}
      </div>
    </div>
  );
}
