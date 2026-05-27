import {
  CurrencyDollar,
  CalendarBlank,
  CreditCard,
  Bank,
  Warning,
  ArrowSquareOut,
  Buildings,
  Repeat,
  FileText,
  UploadSimple,
  Sparkle,
  ShieldCheck,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";
import type { WorkspaceBilling } from "@/lib/admin/workspace-billing";
import type { WorkspaceContactProperty } from "@/lib/admin/workspace-contact-detail";
import type { WorkspaceDocument } from "@/lib/admin/workspace-documents";
import { BillingOperations } from "./BillingOperations";
import { FinanceReceiptDashboard } from "./FinanceReceiptDashboard";
import styles from "./BillingTab.module.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  review_ready: "Review ready",
  approved: "Approved",
  open: "Open",
  paid: "Paid",
  payment_failed: "Payment failed",
  uncollectible: "Uncollectible",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  void: "Void",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
  canceled: "Canceled",
};

const STATUS_CLASS: Record<string, string> = {
  draft: styles.pillDraft,
  review_ready: styles.pillOpen,
  approved: styles.pillOpen,
  open: styles.pillOpen,
  paid: styles.pillPaid,
  payment_failed: styles.pillFailed,
  uncollectible: styles.pillUncollectible,
  refunded: styles.pillVoid,
  partially_refunded: styles.pillVoid,
  void: styles.pillVoid,
  active: styles.pillPaid,
  paused: styles.pillDraft,
  ended: styles.pillVoid,
  canceled: styles.pillVoid,
};

const KIND_LABEL: Record<string, string> = {
  onboarding_fee: "Onboarding",
  tech_fee: "Tech fee",
  adhoc: "Ad hoc",
  recurring: "Recurring",
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

function computeEffectiveRate(
  feePercent: number,
  propertyCount: number,
): { effectiveRate: number; discountApplied: boolean; discountPercent: number } {
  const discountApplied = propertyCount >= 3;
  const discountPercent = discountApplied ? 10 : 0;
  const effectiveRate = feePercent * (1 - discountPercent / 100);
  return { effectiveRate, discountApplied, discountPercent };
}

function scheduleIntervalLabel(interval: string, intervalCount: number): string {
  if (intervalCount === 1) return `Every ${interval}`;
  return `Every ${intervalCount} ${interval}s`;
}

function documentStatusLabel(status: string): string {
  if (status === "completed" || status === "signed") return "Signed";
  if (status === "expired") return "Expired";
  if (status === "declined") return "Declined";
  return "Pending";
}

function documentIsSigned(document: WorkspaceDocument): boolean {
  return ["completed", "signed"].includes(document.status);
}

function receiptNeedsReview(receipt: WorkspaceBilling["receipts"][number]): boolean {
  const category = receipt.category.trim().toLowerCase();
  return (
    !receipt.propertyLabel
    || !receipt.imageUrl
    || !category
    || ["other", "misc", "uncategorized", "receipt"].includes(category)
  );
}

function receiptLooksPayable(receipt: WorkspaceBilling["receipts"][number]): boolean {
  if (receipt.analysisKind === "to_pay") return true;
  const text = [receipt.vendor, receipt.category, receipt.notes].filter(Boolean).join(" ").toLowerCase();
  return /(unpaid|needs payment|to pay|past due|payment due|amount due|balance due|invoice due|bill due)/.test(text);
}

export function BillingTab({
  billing,
  documents,
  ownerId,
  properties,
  workspaceId,
}: {
  billing: WorkspaceBilling;
  documents: WorkspaceDocument[];
  ownerId: string | null;
  properties: WorkspaceContactProperty[];
  workspaceId: string;
}) {
  const {
    totalCollectedCents,
    nextInvoice,
    invoices,
    schedules,
    managementFeePercent,
    propertyCount,
    paymentMethod,
    availableCreditCents,
    stripeCustomerId,
    paymentMethods,
    receipts,
  } = billing;
  const openInvoiceCount = invoices.filter((invoice) =>
    ["draft", "review_ready", "approved", "open", "payment_failed"].includes(invoice.status),
  ).length;
  const achMethods = paymentMethods.filter((method) => method.type === "us_bank_account");
  const cardMethods = paymentMethods.filter((method) => method.type !== "us_bank_account");
  const recurringTotalCents = schedules
    .filter((schedule) => schedule.status === "active")
    .reduce((sum, schedule) => sum + schedule.totalCents, 0);
  const financialDocuments = documents.filter((document) => document.category === "financial");
  const signedFinancialDocuments = financialDocuments.filter(documentIsSigned);
  const financialDocChecklist = [
    {
      label: "ACH",
      title: "ACH authorization",
      docKey: "ach_authorization",
      documents: financialDocuments.filter((document) => /ach|bank/i.test(document.templateName)),
    },
    {
      label: "Card",
      title: "Card authorization",
      docKey: "card_authorization",
      documents: financialDocuments.filter((document) => /card|payment/i.test(document.templateName)),
    },
    {
      label: "Tax",
      title: "W9 or tax form",
      docKey: "w9",
      documents: financialDocuments.filter((document) => /w-?9|tax/i.test(document.templateName)),
    },
  ].map((item) => {
    const signedCount = item.documents.filter(documentIsSigned).length;
    const pendingCount = item.documents.length - signedCount;
    return {
      ...item,
      signedCount,
      pendingCount,
      status: signedCount > 0 ? "ready" : pendingCount > 0 ? "pending" : "missing",
    };
  });
  const paymentDueInvoices = invoices.filter((invoice) =>
    ["approved", "open", "payment_failed"].includes(invoice.status),
  );
  const reviewReadyInvoices = invoices.filter((invoice) =>
    ["draft", "review_ready"].includes(invoice.status),
  );
  const receiptsNeedingReview = receipts.filter(receiptNeedsReview);
  const payableReceipts = receipts.filter(receiptLooksPayable);
  const financeActionCount = openInvoiceCount + payableReceipts.length + receiptsNeedingReview.length;
  const paymentDueCents = paymentDueInvoices.reduce((sum, invoice) => sum + invoice.amount_cents, 0);
  const payableReceiptCents = payableReceipts.reduce((sum, receipt) => sum + receipt.amountCents, 0);
  const attentionItems = [
    ...(paymentDueInvoices.length > 0
      ? [{
          label: "Payment",
          title: `${formatCents(paymentDueCents)} needs payment`,
          detail: `${paymentDueInvoices.length} invoice${paymentDueInvoices.length === 1 ? "" : "s"} open or failed`,
          href: "#invoice-history",
          tone: "urgent" as const,
        }]
      : []),
    ...(payableReceipts.length > 0
      ? [{
          label: "Bills",
          title: `${formatCents(payableReceiptCents)} may need payment`,
          detail: `${payableReceipts.length} uploaded document${payableReceipts.length === 1 ? "" : "s"} flagged by receipt analysis`,
          href: "#finance-receipt-dashboard",
          tone: "urgent" as const,
        }]
      : []),
    ...(reviewReadyInvoices.length > 0
      ? [{
          label: "Review",
          title: `${reviewReadyInvoices.length} invoice${reviewReadyInvoices.length === 1 ? "" : "s"} to approve`,
          detail: "Draft invoices are waiting for admin review",
          href: "#invoice-history",
          tone: "watch" as const,
        }]
      : []),
    ...(!paymentMethod
      ? [{
          label: "Setup",
          title: "Payment method missing",
          detail: "Add card, ACH, Apple Pay, Google Pay, or Link through Stripe",
          href: "#finance-payment-setup",
          tone: "watch" as const,
        }]
      : []),
    ...(receiptsNeedingReview.length > 0
      ? [{
          label: "Receipts",
          title: `${receiptsNeedingReview.length} receipt${receiptsNeedingReview.length === 1 ? "" : "s"} need review`,
          detail: "Confirm category, property, file, visibility, and notification",
          href: "#finance-receipt-dashboard",
          tone: "watch" as const,
        }]
      : []),
    ...(schedules.length === 0
      ? [{
          label: "Recurring",
          title: "No recurring schedule",
          detail: "Create the monthly service lines for repeat billing",
          href: "#finance-recurring-builder",
          tone: "calm" as const,
        }]
      : []),
    ...(financialDocuments.length === 0
      ? [{
          label: "Docs",
          title: "No financial documents",
          detail: "Attach ACH, tax, or payment paperwork from Documents",
          href: "#finance-documents",
          tone: "calm" as const,
        }]
      : []),
  ];

  return (
    <div className={styles.root}>
      <section className={styles.financeHero}>
        <div className={styles.financeHeroCopy}>
          <span className={styles.eyebrow}>Workspace finances</span>
          <h2>Finances</h2>
          <p>
            Receipts, invoices, recurring charges, and payment methods for this owner relationship.
          </p>
        </div>
        <div className={styles.financeHeroActions}>
          <div className={styles.financeAction}>
            <FileText size={18} weight="duotone" />
            <span>{receipts.length} receipt{receipts.length === 1 ? "" : "s"}</span>
          </div>
          <div className={styles.financeAction}>
            <Sparkle size={18} weight="duotone" />
            <span>Analysis intake ready</span>
          </div>
          <div className={styles.financeAction}>
            <CreditCard size={18} weight="duotone" />
            <span>{paymentMethod ? "Payment method saved" : "Payment setup needed"}</span>
          </div>
        </div>
      </section>

      <div className={styles.summaryBar}>
        <div className={styles.summaryItem}>
          <CurrencyDollar size={18} weight="duotone" className={styles.summaryIcon} />
          <div>
            <div className={styles.summaryValue}>{formatCents(totalCollectedCents)}</div>
            <div className={styles.summaryLabel}>Total collected</div>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <Repeat size={18} weight="duotone" className={styles.summaryIcon} />
          <div>
            <div className={styles.summaryValue}>{schedules.length}</div>
            <div className={styles.summaryLabel}>
              Recurring schedule{schedules.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <FileText size={18} weight="duotone" className={styles.summaryIcon} />
          <div>
            <div className={styles.summaryValue}>{financeActionCount}</div>
            <div className={styles.summaryLabel}>
              Needs review or payment
            </div>
          </div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <CalendarBlank size={18} weight="duotone" className={styles.summaryIcon} />
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

      <section className={styles.attentionPanel} aria-label="Finance attention queue">
        <div className={styles.attentionHeader}>
          <div>
            <span className={styles.eyebrow}>Attention</span>
            <h3>What needs action</h3>
          </div>
          <strong>{attentionItems.length}</strong>
        </div>
        {attentionItems.length === 0 ? (
          <div className={styles.attentionClear}>
            <ShieldCheck size={16} weight="duotone" />
            <span>No financial action needed right now.</span>
          </div>
        ) : (
          <div className={styles.attentionList}>
            {attentionItems.map((item) => (
              <a
                key={`${item.label}-${item.title}`}
                href={item.href}
                className={`${styles.attentionItem} ${
                  item.tone === "urgent"
                    ? styles.attentionItemUrgent
                    : item.tone === "watch"
                      ? styles.attentionItemWatch
                      : ""
                }`}
              >
                <span>{item.label}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className={styles.vaultGrid} aria-label="Workspace financial vault">
        <div className={styles.vaultCard}>
          <div className={styles.vaultIcon}>
            <Bank size={18} weight="duotone" />
          </div>
          <div className={styles.vaultBody}>
            <span className={styles.vaultLabel}>ACH information</span>
            <strong>{achMethods.length > 0 ? "ACH on file" : "No ACH on file"}</strong>
            <p>
              {achMethods[0]
                ? `${achMethods[0].label}. Account and routing details stay in the payment processor vault.`
                : "Add ACH to keep bank payment details available without exposing raw routing numbers."}
            </p>
          </div>
          <span className={`${styles.vaultStatus} ${achMethods.length > 0 ? styles.vaultStatusReady : ""}`}>
            {achMethods.length > 0 ? "Ready" : "Missing"}
          </span>
        </div>

        <div className={styles.vaultCard}>
          <div className={styles.vaultIcon}>
            <CreditCard size={18} weight="duotone" />
          </div>
          <div className={styles.vaultBody}>
            <span className={styles.vaultLabel}>Card information</span>
            <strong>{cardMethods.length > 0 ? "Card on file" : "No card on file"}</strong>
            <p>
              {cardMethods[0]
                ? `${cardMethods[0].label}. ${cardMethods[0].status}${cardMethods[0].isExpiringSoon ? ", expiring soon" : ""}.`
                : "Add a debit or credit card for backup collection and owner-paid invoices."}
            </p>
          </div>
          <span className={`${styles.vaultStatus} ${cardMethods.length > 0 ? styles.vaultStatusReady : ""}`}>
            {cardMethods.length > 0 ? "Ready" : "Missing"}
          </span>
        </div>

        <div className={styles.vaultCard}>
          <div className={styles.vaultIcon}>
            <Repeat size={18} weight="duotone" />
          </div>
          <div className={styles.vaultBody}>
            <span className={styles.vaultLabel}>Recurring</span>
            <strong>{formatCents(recurringTotalCents)}</strong>
            <p>
              {schedules.length > 0
                ? `${schedules.length} schedule${schedules.length === 1 ? "" : "s"} configured.`
                : "No recurring invoices are configured yet."}
            </p>
          </div>
          <span className={`${styles.vaultStatus} ${schedules.length > 0 ? styles.vaultStatusReady : ""}`}>
            {schedules.length > 0 ? "Active" : "Empty"}
          </span>
        </div>
      </section>

      <section id="finance-documents" className={styles.financialDocsPanel} aria-label="Financial documents">
        <div className={styles.financialDocsHeader}>
          <div>
            <span className={styles.eyebrow}>At hand</span>
            <h3>Financial documents</h3>
            <p>Fast access to signed tax, ACH, and payment paperwork from Documents.</p>
          </div>
          <div className={styles.financialDocsActions}>
            <div className={styles.financialDocsMeter}>
              <strong>{signedFinancialDocuments.length}/{financialDocuments.length}</strong>
              <span>signed</span>
            </div>
            <a href="?tab=documents" className={styles.secondaryButton}>
              Workspace docs
            </a>
            <a href="/admin/documents" className={styles.secondaryButton}>
              Documents hub
            </a>
          </div>
        </div>
        <div className={styles.financialDocChecklist}>
          {financialDocChecklist.map((item) => (
            <div
              key={item.label}
              className={`${styles.financialDocCheck} ${
                item.status === "ready"
                  ? styles.financialDocCheckReady
                  : item.status === "pending"
                    ? styles.financialDocCheckPending
                    : ""
              }`}
            >
              <span>{item.label}</span>
              <div>
                <strong>{item.title}</strong>
                <p>
                  {item.status === "ready"
                    ? `${item.signedCount} signed`
                    : item.status === "pending"
                      ? `${item.pendingCount} pending`
                      : "Missing"}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.financialDocActionGrid}>
          {financialDocChecklist.map((item) => {
            const latestSigned = item.documents.find(documentIsSigned);
            const latestPending = item.documents.find((document) => !documentIsSigned(document));
            const actionHref = latestSigned?.signedPdfUrl
              ?? (ownerId ? `/admin/documents?owner=${ownerId}&doc=${item.docKey}` : "/admin/documents");
            const actionLabel = latestSigned?.signedPdfUrl
              ? "Open signed PDF"
              : latestPending
                ? "View pending"
                : "Send from hub";

            return (
              <a
                key={`${item.label}-action`}
                href={actionHref}
                target={latestSigned?.signedPdfUrl ? "_blank" : undefined}
                rel={latestSigned?.signedPdfUrl ? "noopener noreferrer" : undefined}
                className={styles.financialDocAction}
              >
                <span>{item.title}</span>
                <strong>{actionLabel}</strong>
              </a>
            );
          })}
        </div>
        {financialDocuments.length === 0 ? (
          <div className={styles.financialDocsEmpty}>
            <FileText size={18} weight="duotone" />
            <span>No financial documents are attached yet. Send ACH, card authorization, and W9 documents from Documents Hub.</span>
          </div>
        ) : (
          <div className={styles.financialDocList}>
            {financialDocuments.slice(0, 4).map((document) => (
              <div key={document.id} className={styles.financialDocRow}>
                <div className={styles.financialDocIcon}>
                  <FileText size={16} weight="duotone" />
                </div>
                <div className={styles.financialDocMain}>
                  <strong>{document.templateName}</strong>
                  <span>
                    {document.propertyLabel ? `${document.propertyLabel}. ` : ""}
                    {document.signedAt ? `Signed ${formatDate(document.signedAt)}` : `Sent ${formatDate(document.createdAt)}`}
                  </span>
                </div>
                <span className={`${styles.pill} ${["completed", "signed"].includes(document.status) ? styles.pillPaid : styles.pillDraft}`}>
                  {documentStatusLabel(document.status)}
                </span>
                {document.signedPdfUrl ? (
                  <a
                    href={document.signedPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.invoiceLink}
                    aria-label={`Open ${document.templateName}`}
                  >
                    <DownloadSimple size={14} />
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <BillingOperations workspaceId={workspaceId} billing={billing} />

      <div className={styles.aiPanel}>
        <div>
          <h3>
            <Sparkle size={16} weight="duotone" />
            AI finance intake
          </h3>
          <p>
            First-pass analysis now flags receipts, invoices, recurring bills, and items that may need payment. Use receipt review to confirm category, property, owner visibility, and notifications.
          </p>
        </div>
        <a href="#finance-receipt-dashboard" className={styles.secondaryButton}>
          <UploadSimple size={15} weight="bold" />
          Add receipt
        </a>
        <div className={styles.aiChips} aria-label="AI finance intake categories">
          <span>Receipts</span>
          <span>Invoices</span>
          <span>Recurring</span>
          <span>To pay</span>
        </div>
      </div>

      <div className={styles.securityNote}>
        <ShieldCheck size={16} weight="duotone" />
        <span>
          Sensitive account and routing numbers should stay tokenized with the payment processor. Parcel shows availability, status, and last four only.
        </span>
      </div>

      <FinanceReceiptDashboard
        receipts={receipts}
        ownerId={ownerId}
        properties={properties.map((property) => ({
          id: property.id,
          label: property.label,
        }))}
        workspaceId={workspaceId}
      />

      <div id="invoice-history" className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Repeat size={16} weight="duotone" className={styles.cardTitleIcon} />
          Recurring schedules
        </h3>
        {schedules.length === 0 ? (
          <p className={styles.emptyText}>No recurring schedules yet.</p>
        ) : (
          <div className={styles.scheduleList}>
            {schedules.map((schedule) => (
              <div key={schedule.id} className={styles.scheduleRow}>
                <div>
                  <div className={styles.scheduleName}>{schedule.name}</div>
                  <div className={styles.scheduleMeta}>
                    {schedule.lineCount} line item{schedule.lineCount === 1 ? "" : "s"}.{" "}
                    {scheduleIntervalLabel(schedule.interval, schedule.intervalCount)}.{" "}
                    {formatCents(schedule.totalCents)}
                  </div>
                </div>
                <div className={styles.scheduleRight}>
                  <span className={`${styles.pill} ${STATUS_CLASS[schedule.status] ?? styles.pillDraft}`}>
                    {STATUS_LABEL[schedule.status] ?? schedule.status}
                  </span>
                  <span className={styles.scheduleDate}>
                    {schedule.nextInvoiceDate ? formatDate(schedule.nextInvoiceDate) : "No next date"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <Buildings size={16} weight="duotone" className={styles.cardTitleIcon} />
          Fee structure
        </h3>
        {managementFeePercent == null ? (
          <p className={styles.noFee}>No management fee rate set. Edit the workspace to add one.</p>
        ) : (() => {
          const { effectiveRate, discountApplied, discountPercent } = computeEffectiveRate(
            managementFeePercent,
            propertyCount,
          );
          return (
            <div className={styles.feeRows}>
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Base rate</span>
                <span className={styles.feeValue}>{managementFeePercent}%</span>
              </div>
              {discountApplied ? (
                <div className={styles.feeRow}>
                  <span className={styles.feeLabel}>
                    Multi-property discount ({propertyCount} properties)
                  </span>
                  <span className={styles.feeDiscount}>-{discountPercent}%</span>
                </div>
              ) : null}
              <div className={`${styles.feeRow} ${styles.feeTotal}`}>
                <span className={styles.feeLabel}>Effective blended rate</span>
                <span className={styles.feeValue}>{effectiveRate.toFixed(2)}%</span>
              </div>
            </div>
          );
        })()}
        {availableCreditCents > 0 ? (
          <div className={styles.creditNote}>
            {formatCents(availableCreditCents)} available credit
          </div>
        ) : null}
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <CurrencyDollar size={16} weight="duotone" className={styles.cardTitleIcon} />
          Invoice history
        </h3>
        {invoices.length === 0 ? (
          <p className={styles.emptyText}>No invoices yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{KIND_LABEL[inv.kind] ?? inv.kind}</td>
                  <td>
                    <span className={`${styles.pill} ${STATUS_CLASS[inv.status] ?? ""}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td>{formatCents(inv.amount_cents)}</td>
                  <td>
                    {inv.paid_at
                      ? formatDate(inv.paid_at)
                      : inv.due_at
                        ? formatDate(inv.due_at)
                        : "No date"}
                  </td>
                  <td>
                    {inv.hosted_invoice_url ? (
                      <a
                        href={inv.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.invoiceLink}
                        aria-label="Open invoice"
                      >
                        <ArrowSquareOut size={14} />
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <CreditCard size={16} weight="duotone" className={styles.cardTitleIcon} />
          Payment method
        </h3>
        {!paymentMethod ? (
          <p className={styles.emptyText}>
            No payment method on file{stripeCustomerId ? "." : ", and no Stripe customer has been created yet."}
          </p>
        ) : paymentMethod.type === "us_bank_account" ? (
          <div className={styles.paymentRow}>
            <Bank size={18} weight="duotone" className={styles.paymentIcon} />
            <div>
              <div className={styles.paymentMain}>{paymentMethod.label}</div>
              <div className={styles.paymentSub}>ACH bank debit</div>
            </div>
          </div>
        ) : (
          <div className={styles.paymentRow}>
            <CreditCard size={18} weight="duotone" className={styles.paymentIcon} />
            <div>
              <div className={styles.paymentMain}>{paymentMethod.label}</div>
              <div className={`${styles.paymentSub} ${paymentMethod.isExpiringSoon ? styles.paymentExpiring : ""}`}>
                {paymentMethod.isExpiringSoon ? <Warning size={13} weight="fill" /> : null}
                {paymentMethod.status}
                {paymentMethod.isExpiringSoon ? " (expiring soon)" : ""}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
