import {
  CurrencyDollar,
  CalendarBlank,
  Repeat,
} from "@phosphor-icons/react/dist/ssr";
import type { WorkspaceBilling, WorkspaceFinancialReceipt } from "@/lib/admin/workspace-billing";
import type { WorkspaceContactProperty } from "@/lib/admin/workspace-contact-detail";
import { PropertyBillsSection } from "./PropertyBillsSection";
import { AchPaymentCard, CardPaymentCard } from "./PaymentMethodCard";
import styles from "./BillingTab.module.css";

export type PropertyReceiptGroup = {
  id: string | null;
  label: string;
  receipts: WorkspaceFinancialReceipt[];
  totalCents: number;
};

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupReceiptsByProperty(
  receipts: WorkspaceFinancialReceipt[],
  properties: WorkspaceContactProperty[],
): PropertyReceiptGroup[] {
  const assigned = new Map<string, PropertyReceiptGroup>();
  const unassigned: WorkspaceFinancialReceipt[] = [];

  for (const receipt of receipts) {
    if (!receipt.propertyLabel) {
      unassigned.push(receipt);
      continue;
    }
    const match = properties.find(
      (p) => p.label.trim().toLowerCase() === receipt.propertyLabel?.trim().toLowerCase(),
    );
    const key = match ? match.id : receipt.propertyLabel;
    const existing = assigned.get(key);
    if (existing) {
      existing.receipts.push(receipt);
      existing.totalCents += receipt.amountCents;
    } else {
      assigned.set(key, {
        id: match?.id ?? null,
        label: receipt.propertyLabel,
        receipts: [receipt],
        totalCents: receipt.amountCents,
      });
    }
  }

  const groups = Array.from(assigned.values()).sort((a, b) => b.totalCents - a.totalCents);

  if (unassigned.length > 0) {
    groups.push({
      id: null,
      label: "Workspace-wide",
      receipts: unassigned,
      totalCents: unassigned.reduce((sum, r) => sum + r.amountCents, 0),
    });
  }

  return groups;
}

export function BillingTab({
  billing,
  ownerId,
  properties,
  workspaceId,
}: {
  billing: WorkspaceBilling;
  ownerId: string | null;
  properties: WorkspaceContactProperty[];
  workspaceId: string;
}) {
  const {
    totalCollectedCents,
    nextInvoice,
    invoices,
    schedules,
    paymentMethods,
    receipts,
  } = billing;

  const openInvoiceCount = invoices.filter((inv) =>
    ["draft", "review_ready", "approved", "open", "payment_failed"].includes(inv.status),
  ).length;

  const achMethods = paymentMethods.filter((m) => m.type === "us_bank_account");
  const cardMethods = paymentMethods.filter((m) => m.type !== "us_bank_account");
  const primaryAch = achMethods[0] ?? null;
  const primaryCard = cardMethods[0] ?? null;

  const achFormHref = ownerId
    ? `/admin/documents?owner=${ownerId}&doc=ach_authorization`
    : "/admin/documents";
  const cardFormHref = ownerId
    ? `/admin/documents?owner=${ownerId}&doc=card_authorization`
    : "/admin/documents";

  const receiptGroups = groupReceiptsByProperty(receipts, properties);
  const totalReceiptCents = receipts.reduce((sum, r) => sum + r.amountCents, 0);

  return (
    <div className={styles.root}>
      {/* Summary bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>
            <CurrencyDollar size={17} weight="duotone" />
          </div>
          <div>
            <div className={styles.summaryValue}>{formatCents(totalCollectedCents)}</div>
            <div className={styles.summaryLabel}>Total collected</div>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>
            <Repeat size={17} weight="duotone" />
          </div>
          <div>
            <div className={styles.summaryValue}>{schedules.length}</div>
            <div className={styles.summaryLabel}>
              Recurring schedule{schedules.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>
            <CurrencyDollar size={17} weight="duotone" />
          </div>
          <div>
            <div className={styles.summaryValue}>{openInvoiceCount}</div>
            <div className={styles.summaryLabel}>Needs review or payment</div>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <div className={styles.summaryIcon}>
            <CalendarBlank size={17} weight="duotone" />
          </div>
          <div>
            <div className={styles.summaryValue}>
              {nextInvoice ? formatDate(nextInvoice.dueAt) : "No upcoming invoice"}
            </div>
            <div className={styles.summaryLabel}>
              {nextInvoice ? `${formatCents(nextInvoice.amountCents)} due` : "Next invoice date"}
            </div>
          </div>
        </div>
      </div>

      {/* Payment methods */}
      <section aria-label="Payment methods">
        <div className={styles.sectionEyebrow}>Payment methods</div>
        <div className={styles.paymentGrid}>
          <AchPaymentCard method={primaryAch} formHref={achFormHref} />
          <CardPaymentCard method={primaryCard} formHref={cardFormHref} />
        </div>
      </section>

      {/* Bills by property */}
      <PropertyBillsSection
        groups={receiptGroups}
        totalReceiptCents={totalReceiptCents}
        totalReceiptCount={receipts.length}
        properties={properties.map((p) => ({ id: p.id, label: p.label }))}
        ownerId={ownerId}
        workspaceId={workspaceId}
      />
    </div>
  );
}
