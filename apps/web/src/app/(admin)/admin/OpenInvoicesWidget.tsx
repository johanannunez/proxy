// apps/web/src/app/(admin)/admin/OpenInvoicesWidget.tsx
import Link from 'next/link';
import { WidgetShell } from './WidgetShell';
import type { OpenInvoicesData, OpenInvoiceRow } from '@/lib/admin/dashboard-v2';
import styles from './OpenInvoicesWidget.module.css';

function formatCents(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars >= 1000) {
    return `$${dollars.toLocaleString('en-US')}`;
  }
  return `$${dollars}`;
}

function formatAmount(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  return `$${parseFloat(dollars).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

function KindBadge({ kind }: { kind: string }) {
  if (kind === 'onboarding') {
    return <span className={`${styles.kindBadge} ${styles.kindOnboarding}`}>onboarding</span>;
  }
  if (kind === 'tech_fee' || kind === 'tech fee') {
    return <span className={`${styles.kindBadge} ${styles.kindTech}`}>tech fee</span>;
  }
  return <span className={`${styles.kindBadge} ${styles.kindAdhoc}`}>{kind}</span>;
}

function InvoiceRow({ invoice }: { invoice: OpenInvoiceRow }) {
  return (
    <Link href="/admin/workspaces?view=active-owners" className={styles.invoiceRow}>
      <div className={styles.rowMain}>
        <span className={styles.ownerName}>{invoice.ownerName}</span>
        <KindBadge kind={invoice.kind} />
      </div>
      <div className={styles.rowMeta}>
        <span className={styles.amount}>{formatAmount(invoice.amountCents)}</span>
        {invoice.daysOverdue > 0 && (
          <span className={styles.overdueBadge}>{invoice.daysOverdue}d overdue</span>
        )}
        <span
          className={`${styles.statusPill} ${invoice.status === 'open' ? styles.pillOpen : styles.pillDraft}`}
        >
          {invoice.status}
        </span>
      </div>
    </Link>
  );
}

export function OpenInvoicesWidget({ data }: { data: OpenInvoicesData }) {
  const isEmpty = data.invoices.length === 0;

  return (
    <WidgetShell
      label="Invoices"
      count={data.total > 0 ? data.total : undefined}
      href="/admin/finances"
      hrefLabel="View finances"
    >
      {!isEmpty && (
        <div className={styles.totalOwed}>
          {formatCents(data.totalCents)}
          <span className={styles.totalLabel}> outstanding</span>
        </div>
      )}

      {isEmpty ? (
        <div className={`${styles.empty} ${styles.emptyGood}`}>
          <span className={styles.emptyCheck}>✓</span>
          No outstanding invoices.
        </div>
      ) : (
        <div className={styles.list}>
          {data.invoices.slice(0, 5).map((invoice) => (
            <InvoiceRow key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
