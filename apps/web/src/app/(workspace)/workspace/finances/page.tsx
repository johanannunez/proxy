import type { Metadata } from "next";
import {
  ArrowSquareOut,
  ChartLineUp,
  CurrencyDollar,
  Receipt,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { untypedDatabase } from "@/lib/supabase/untyped";
import { ReceiptsExplorer } from "./ReceiptsExplorer";
import type { OwnerReceiptRow } from "./receipts-types";

export const metadata: Metadata = { title: "Financials" };
export const dynamic = "force-dynamic";

function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export default async function FinancialsPage() {
  const { userId, client } = await getWorkspaceContext();
  const db = untypedDatabase(client);

  const { data, error } = await db
    .from<OwnerReceiptRow[]>("owner_receipts")
    .select(
      "id, vendor, amount, currency, category, purchase_date, notes, image_url, storage_path, reviewed_at, analysis_kind, analysis_summary, analysis_source, payment_source, reimbursement_status, line_items, property:properties(name, address_line1, city, state)",
    )
    .eq("owner_id", userId)
    .eq("visibility", "visible")
    .order("purchase_date", { ascending: false })
    .limit(500);

  const receipts = (error ? [] : (data as unknown as OwnerReceiptRow[])) ?? [];
  const total = receipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const analyzedCount = receipts.filter((r) => r.analysis_summary).length;
  const needsPayment = receipts.filter((r) => r.analysis_kind === "to_pay");

  return (
    <div className="flex flex-col gap-5">
      <section
        className="rounded-2xl border p-5"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.10)",
                color: "var(--color-brand)",
              }}
            >
              <Receipt size={18} weight="duotone" />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Receipts
              </h2>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Financial documents and receipts shared by Proxy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl px-4 py-2 text-center" style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {receipts.length}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                Receipts
              </div>
            </div>
            <div className="rounded-xl px-4 py-2 text-center" style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {formatCurrency(total)}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                Shared
              </div>
            </div>
            <div className="rounded-xl px-4 py-2 text-center" style={{ backgroundColor: "var(--color-warm-gray-50)" }}>
              <div className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {analyzedCount}
              </div>
              <div className="text-[11px] font-medium" style={{ color: "var(--color-text-tertiary)" }}>
                Analyzed
              </div>
            </div>
          </div>
        </div>
      </section>

      {needsPayment.length > 0 && (
        <section
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "rgba(245, 158, 11, 0.08)",
            borderColor: "rgba(245, 158, 11, 0.22)",
          }}
        >
          <div className="flex items-start gap-3">
            <CurrencyDollar size={18} weight="duotone" color="#b45309" />
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {needsPayment.length} item{needsPayment.length === 1 ? "" : "s"}
              </span>{" "}
              marked for payment review by Proxy.
            </p>
          </div>
        </section>
      )}

      <ReceiptsExplorer initialReceipts={receipts} />

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
            style={{ backgroundColor: "rgba(22, 163, 74, 0.10)", color: "#15803d" }}
          >
            <ChartLineUp size={18} weight="duotone" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>
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
