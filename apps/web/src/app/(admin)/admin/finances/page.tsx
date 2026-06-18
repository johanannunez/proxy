import Link from "next/link";
import type { Metadata } from "next";
import {
  CreditCard,
  FileText,
  Repeat,
  Receipt,
  Tag,
} from "@phosphor-icons/react/dist/ssr";
import { fetchFinancesDashboard } from "@/lib/admin/finances-dashboard";
import styles from "./FinancePage.module.css";

export const metadata: Metadata = {
  title: "Finances | Admin",
};

const FINANCE_AREAS = [
  {
    title: "Recurring invoices",
    eyebrow: "Repeat",
    detail: "Flexible Workspace schedules, review windows, auto-charge, and service lines.",
    icon: Repeat,
  },
  {
    title: "Invoices",
    eyebrow: "Collect",
    detail: "Drafts, payment status, owner-facing records, credits, and refunds.",
    icon: FileText,
  },
  {
    title: "Catalog",
    eyebrow: "Price",
    detail: "Reusable services, fees, packages, costs, margins, and tax rules.",
    icon: Tag,
  },
  {
    title: "Proposals",
    eyebrow: "Offer",
    detail: "Premium owner proposals that convert into finance setup.",
    icon: Receipt,
  },
] as const;

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function FinancesPage() {
  const data = await fetchFinancesDashboard();

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Finances</p>
          <h1 className={styles.title}>Revenue operations</h1>
          <p className={styles.subtitle}>
            Workspace finances, Stripe collection, recurring services, credits, refunds, and proposal conversion.
          </p>
        </div>
        <div className={styles.summary}>
          <span className={styles.summaryLabel}>Processor</span>
          <strong>Stripe</strong>
          <span className={styles.summarySub}>Card, ACH, Apple Pay, Google Pay, and Link when eligible.</span>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Finance metrics">
        <Metric label="Finance profiles" value={data.financeProfileCount.toLocaleString("en-US")} />
        <Metric label="Payment methods" value={data.paymentMethodCount.toLocaleString("en-US")} />
        <Metric label="Open invoices" value={data.openInvoiceCount.toLocaleString("en-US")} />
        <Metric label="Failed payments" value={data.failedPaymentCount.toLocaleString("en-US")} tone="danger" />
        <Metric label="Active schedules" value={data.activeScheduleCount.toLocaleString("en-US")} />
        <Metric label="Open balance" value={formatCents(data.totalOpenCents)} />
      </section>

      <section className={styles.workbench} aria-label="Finance workbench">
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.panelEyebrow}>Next charge queue</p>
              <h2 className={styles.panelTitle}>Recurring schedules</h2>
            </div>
            <CreditCard size={20} weight="duotone" />
          </div>

          {data.schedules.length === 0 ? (
            <div className={styles.emptyState}>
              No recurring schedules yet. The next build creates them from Workspace, property, and catalog lines.
            </div>
          ) : (
            <div className={styles.scheduleList}>
              {data.schedules.map((schedule) => (
                <Link
                  key={schedule.id}
                  href={`/admin/workspaces/${schedule.workspaceId}?tab=finance`}
                  className={styles.scheduleRow}
                >
                  <div>
                    <strong>{schedule.workspaceName}</strong>
                    <span>{schedule.name}</span>
                  </div>
                  <div className={styles.scheduleMeta}>
                    <span>{schedule.lineCount} line item{schedule.lineCount === 1 ? "" : "s"}</span>
                    <b>{schedule.nextInvoiceDate ? formatDate(schedule.nextInvoiceDate) : "No next date"}</b>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className={styles.rail}>
          <p className={styles.panelEyebrow}>Build order</p>
          <ol>
            <li>Workspace finance profile and payment method setup</li>
            <li>Recurring schedule creation</li>
            <li>Draft review and Stripe collection</li>
            <li>Credits, refunds, catalog, and proposals</li>
          </ol>
        </div>
      </section>

      <section className={styles.grid} aria-label="Finance areas">
        {FINANCE_AREAS.map((area) => {
          const Icon = area.icon;
          return (
            <article key={area.title} className={styles.card}>
              <div className={styles.iconWrap}>
                <Icon size={22} weight="duotone" />
              </div>
              <div className={styles.cardText}>
                <span>{area.eyebrow}</span>
                <h2>{area.title}</h2>
                <p>{area.detail}</p>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className={`${styles.metric} ${tone === "danger" ? styles.metricDanger : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
