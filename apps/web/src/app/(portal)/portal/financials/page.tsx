import type { Metadata } from "next";
import {
  ArrowSquareOut,
  ChartLineUp,
  CurrencyDollar,
  FileText,
  Receipt,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/portal/EmptyState";
import { formatMedium } from "@/lib/format";
import { getPortalContext } from "@/lib/portal-context";
import { untypedDatabase } from "@/lib/supabase/untyped";

export const metadata: Metadata = { title: "Financials" };
export const dynamic = "force-dynamic";

type ReceiptPropertyRow = {
  name: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
};

type OwnerReceiptRow = {
  id: string;
  vendor: string;
  amount: number;
  currency: string | null;
  category: string;
  purchase_date: string;
  notes: string | null;
  image_url: string | null;
  analysis_kind: "receipt" | "invoice" | "recurring" | "to_pay" | null;
  analysis_summary: string | null;
  analysis_source: "document" | "ai" | "rules" | "manual" | null;
  property: ReceiptPropertyRow | null;
};

type ReceiptBucket = {
  year: string;
  months: Array<{
    month: string;
    total: number;
    receipts: OwnerReceiptRow[];
  }>;
};

const ANALYSIS_LABELS: Record<NonNullable<OwnerReceiptRow["analysis_kind"]>, string> = {
  receipt: "Receipt",
  invoice: "Invoice",
  recurring: "Recurring",
  to_pay: "Needs payment",
};

const SOURCE_LABELS: Record<NonNullable<OwnerReceiptRow["analysis_source"]>, string> = {
  document: "Document",
  ai: "AI",
  rules: "Rules",
  manual: "Manual",
};

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function monthLabel(iso: string): { year: string; month: string } {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { year: "Unsorted", month: "Needs date" };
  return {
    year: String(date.getFullYear()),
    month: date.toLocaleDateString("en-US", { month: "long" }),
  };
}

function propertyLabel(property: ReceiptPropertyRow | null): string {
  if (!property) return "No property assigned";
  return property.name
    ?? [property.address_line1, property.city, property.state].filter(Boolean).join(", ")
    ?? "Property";
}

function bucketReceipts(receipts: OwnerReceiptRow[]): ReceiptBucket[] {
  const years = new Map<string, Map<string, OwnerReceiptRow[]>>();

  for (const receipt of receipts) {
    const { year, month } = monthLabel(receipt.purchase_date);
    const months = years.get(year) ?? new Map<string, OwnerReceiptRow[]>();
    const monthReceipts = months.get(month) ?? [];
    monthReceipts.push(receipt);
    months.set(month, monthReceipts);
    years.set(year, months);
  }

  return Array.from(years.entries()).map(([year, months]) => ({
    year,
    months: Array.from(months.entries()).map(([month, monthReceipts]) => ({
      month,
      total: monthReceipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0),
      receipts: monthReceipts,
    })),
  }));
}

export default async function FinancialsPage() {
  const { userId, client } = await getPortalContext();
  const db = untypedDatabase(client);

  const { data, error } = await db
    .from<OwnerReceiptRow[]>("owner_receipts")
    .select(
      "id, vendor, amount, currency, category, purchase_date, notes, image_url, analysis_kind, analysis_summary, analysis_source, property:properties(name, address_line1, city, state)",
    )
    .eq("owner_id", userId)
    .eq("visibility", "visible")
    .order("purchase_date", { ascending: false })
    .limit(250);

  const receipts = error ? [] : data ?? [];
  const receiptBuckets = bucketReceipts(receipts);
  const total = receipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0);
  const reviewReady = receipts.filter((receipt) => receipt.analysis_summary).length;
  const needsPayment = receipts.filter((receipt) => receipt.analysis_kind === "to_pay");

  return (
    <div className="flex flex-col gap-6">
      <section
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.10)",
                color: "var(--color-brand)",
              }}
            >
              <Receipt size={20} weight="duotone" />
            </div>
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Receipts
              </h2>
              <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Visible receipts and financial documents shared by Parcel, organized by year and month.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-right">
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {receipts.length}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                Receipts
              </div>
            </div>
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {formatCurrency(total)}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                Shared
              </div>
            </div>
            <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {reviewReady}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                Analyzed
              </div>
            </div>
          </div>
        </div>
      </section>

      {needsPayment.length > 0 ? (
        <section
          className="rounded-2xl border p-5"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            borderColor: "rgba(245, 158, 11, 0.22)",
          }}
        >
          <div className="flex items-start gap-3">
            <CurrencyDollar size={19} weight="duotone" color="#b45309" />
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Items marked for payment review
              </h3>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Parcel flagged {needsPayment.length} visible document{needsPayment.length === 1 ? "" : "s"} as possibly needing payment.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {receipts.length === 0 ? (
        <EmptyState
          icon={<Receipt size={26} weight="duotone" />}
          title="No receipts shared yet"
          body="When Parcel shares receipt records or financial documents with you, they will appear here by year and month."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {receiptBuckets.map((bucket) => (
            <section key={bucket.year} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-text-tertiary)" }}>
                  {bucket.year}
                </h2>
                <span className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                  {bucket.months.reduce((sum, month) => sum + month.receipts.length, 0)} item{bucket.months.reduce((sum, month) => sum + month.receipts.length, 0) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="grid gap-4">
                {bucket.months.map((month) => (
                  <div
                    key={`${bucket.year}-${month.month}`}
                    className="overflow-hidden rounded-2xl border"
                    style={{
                      backgroundColor: "var(--color-white)",
                      borderColor: "var(--color-warm-gray-200)",
                    }}
                  >
                    <div
                      className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom: "1px solid var(--color-warm-gray-200)" }}
                    >
                      <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        {month.month}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "var(--color-brand)" }}>
                        {formatCurrency(month.total)}
                      </span>
                    </div>

                    <div className="divide-y" style={{ borderColor: "var(--color-warm-gray-200)" }}>
                      {month.receipts.map((receipt) => (
                        <div key={receipt.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                {receipt.vendor}
                              </span>
                              {receipt.analysis_kind ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                  style={{
                                    backgroundColor: receipt.analysis_kind === "to_pay" ? "rgba(245, 158, 11, 0.14)" : "rgba(2, 170, 235, 0.10)",
                                    color: receipt.analysis_kind === "to_pay" ? "#b45309" : "var(--color-brand)",
                                  }}
                                >
                                  {ANALYSIS_LABELS[receipt.analysis_kind]}
                                </span>
                              ) : null}
                              {receipt.analysis_source ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                  style={{
                                    backgroundColor: "var(--color-warm-gray-100)",
                                    color: "var(--color-text-tertiary)",
                                  }}
                                >
                                  {SOURCE_LABELS[receipt.analysis_source]}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                              <span>{receipt.category}</span>
                              <span style={{ color: "var(--color-warm-gray-300)" }}>|</span>
                              <span>{formatMedium(receipt.purchase_date)}</span>
                              <span style={{ color: "var(--color-warm-gray-300)" }}>|</span>
                              <span>{propertyLabel(receipt.property)}</span>
                            </div>
                            {receipt.analysis_summary || receipt.notes ? (
                              <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                                {receipt.analysis_summary ?? receipt.notes}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-3 md:justify-end">
                            <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                              {formatCurrency(Number(receipt.amount), receipt.currency ?? "USD")}
                            </span>
                            {receipt.image_url ? (
                              <a
                                href={receipt.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                                style={{
                                  backgroundColor: "rgba(2, 170, 235, 0.10)",
                                  color: "var(--color-brand)",
                                }}
                              >
                                <FileText size={13} weight="duotone" />
                                File
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section
        className="rounded-2xl border p-6"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "rgba(22, 163, 74, 0.10)",
              color: "#15803d",
            }}
          >
            <ChartLineUp size={18} weight="duotone" />
          </div>
          <div className="flex-1">
            <h2
              className="text-base font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Booking Revenue
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Track your booking performance, occupancy, and revenue directly in Hospitable, where all booking data lives.
            </p>
            <a
              href="https://app.hospitable.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-80"
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

      <section
        className="rounded-2xl border p-5"
        style={{
          backgroundColor: "rgba(2, 170, 235, 0.06)",
          borderColor: "rgba(2, 170, 235, 0.16)",
        }}
      >
        <div className="flex items-start gap-3">
          <Sparkle size={18} weight="duotone" color="var(--color-brand)" />
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Receipt notifications follow your account notification preferences. You can turn financial document notifications on or off from Account settings.
          </p>
        </div>
      </section>
    </div>
  );
}
