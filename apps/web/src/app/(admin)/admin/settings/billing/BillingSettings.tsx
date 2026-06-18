"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowSquareOut,
  ArrowUpRight,
  Check,
  CircleNotch,
  CreditCard,
  Receipt,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  formatCents,
  PLAN_TIER_LABELS,
  type OrgBillingSummary,
} from "@/lib/billing/org-billing-types";
import {
  PLAN_CARDS,
} from "@/app/(public)/signup/signup-types";
import {
  createBillingPortalSession,
  startUpgradeCheckout,
} from "./billing-actions";
import styles from "./BillingSettings.module.css";

const TIER_BADGE_CLASS: Record<OrgBillingSummary["planTier"], string> = {
  starter: styles.tierStarter,
  pro: styles.tierPro,
  white_label: styles.tierWhiteLabel,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingSettings({ summary }: { summary: OrgBillingSummary }) {
  const [error, setError] = useState<string | null>(null);
  const [portalPending, setPortalPending] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const openPortal = async () => {
    setPortalPending(true);
    setError(null);
    const result = await createBillingPortalSession();
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    setError(result.error ?? "Something went wrong.");
    setPortalPending(false);
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.kicker}>Settings</p>
      <h1 className={styles.title}>Billing</h1>
      <p className={styles.sub}>
        Your plan, payment method, and invoice history for {summary.orgName}.
      </p>

      {error && (
        <div className={styles.alertError} role="alert">
          <WarningCircle size={17} weight="fill" />
          {error}
        </div>
      )}

      <section className={styles.planCard} aria-label="Current plan">
        <div className={styles.planMeta}>
          <span className={styles.planLabel}>Current plan</span>
          <div className={styles.planNameRow}>
            <span className={styles.planName}>
              {PLAN_TIER_LABELS[summary.planTier]}
            </span>
            <span
              className={`${styles.tierBadge} ${TIER_BADGE_CLASS[summary.planTier]}`}
            >
              {summary.planTier === "starter" ? "Free" : "Paid"}
            </span>
          </div>
          <span className={styles.nextInvoice}>
            {summary.nextInvoice
              ? `Next invoice: ${formatCents(summary.nextInvoice.amountCents, summary.nextInvoice.currency)}${
                  summary.nextInvoice.date
                    ? ` on ${formatDate(summary.nextInvoice.date)}`
                    : ""
                }`
              : summary.planTier === "starter"
                ? "Free forever. Upgrade when you need more."
                : "No upcoming invoice."}
          </span>
        </div>

        <div className={styles.planActions}>
          {summary.planTier === "starter" && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setUpgradeOpen(true)}
            >
              Upgrade
              <ArrowUpRight size={15} weight="bold" />
            </button>
          )}
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => void openPortal()}
            disabled={portalPending || !summary.hasStripeCustomer}
            title={
              summary.hasStripeCustomer
                ? undefined
                : "Available once you are on a paid plan"
            }
          >
            {portalPending ? (
              <CircleNotch size={15} className={styles.spin} />
            ) : (
              <CreditCard size={15} weight="bold" />
            )}
            Manage payment method
          </button>
        </div>
      </section>

      {!summary.stripeConfigured && (
        <div className={styles.notice}>
          <WarningCircle size={17} weight="duotone" />
          Billing is not fully configured for this environment yet. Plan
          changes and payment methods will be available once Stripe is
          connected.
        </div>
      )}

      <h2 className={styles.sectionTitle}>Invoice history</h2>
      <div className={styles.tableCard}>
        {summary.invoices.length === 0 ? (
          <div className={styles.emptyState}>
            <Receipt size={36} weight="duotone" className={styles.emptyIcon} />
            <span>No invoices yet.</span>
            <span>
              {summary.planTier === "starter"
                ? "Invoices appear here once you move to a paid plan."
                : "Your first invoice will appear here after your billing date."}
            </span>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Invoice</th>
                <th scope="col">Date</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Link</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.number ?? inv.id}</td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>{formatCents(inv.amountCents, inv.currency)}</td>
                  <td>
                    <span
                      className={`${styles.statusPill} ${
                        inv.status === "paid"
                          ? styles.statusPaid
                          : inv.status === "open"
                            ? styles.statusOpen
                            : styles.statusOther
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td>
                    {inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.invoiceLink}
                      >
                        View
                        <ArrowSquareOut size={13} weight="bold" />
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onError={(message) => {
          setUpgradeOpen(false);
          setError(message);
        }}
      />
    </div>
  );
}

function UpgradeModal({
  open,
  onClose,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [pendingTier, setPendingTier] = useState<"pro" | "white_label" | null>(
    null,
  );

  const upgrade = async (tier: "pro" | "white_label") => {
    setPendingTier(tier);
    const result = await startUpgradeCheckout(tier);
    if (result.url) {
      window.location.assign(result.url);
      return;
    }
    setPendingTier(null);
    onError(result.error ?? "Something went wrong.");
  };

  const paidPlans = PLAN_CARDS.filter((p) => p.tier !== "starter");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.modalBackdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pendingTier) onClose();
          }}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Upgrade your plan"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className={styles.modalTitle}>Upgrade your plan</h2>
            <p className={styles.modalSub}>
              Checkout is handled securely by Stripe. Your workspace stays
              exactly as it is; new features unlock immediately.
            </p>
            <div className={styles.modalGrid}>
              {paidPlans.map((plan) => (
                <div key={plan.tier} className={styles.modalPlan}>
                  <span className={styles.modalPlanName}>
                    {plan.name}
                    <span className={styles.modalPlanPrice}>
                      ${plan.priceMonthly}/mo
                    </span>
                  </span>
                  <ul className={styles.modalPlanFeatures}>
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className={styles.modalPlanFeature}>
                        <Check
                          size={12}
                          weight="bold"
                          className={styles.modalPlanFeatureIcon}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    disabled={pendingTier !== null}
                    onClick={() =>
                      void upgrade(plan.tier as "pro" | "white_label")
                    }
                  >
                    {pendingTier === plan.tier ? (
                      <>
                        <CircleNotch size={15} className={styles.spin} />
                        Opening checkout...
                      </>
                    ) : (
                      <>Upgrade to {plan.name}</>
                    )}
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={onClose}
                disabled={pendingTier !== null}
              >
                <X size={14} weight="bold" />
                Not now
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
