"use client";

import { useState } from "react";
import {
  Bank,
  CreditCard,
  Warning,
  ArrowSquareOut,
  Copy,
} from "@phosphor-icons/react";
import type { WorkspaceBillingPaymentMethod } from "@/lib/admin/workspace-billing";
import styles from "./BillingTab.module.css";

// ── Shared sub-components ────────────────────────────────────────────────────

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable; silently ignore
    }
  };

  return (
    <div className={styles.paymentFieldRow}>
      <span className={styles.paymentFieldLabel}>{label}</span>
      <button type="button" className={styles.paymentFieldValue} onClick={handleCopy} title="Click to copy">
        {value}
        {copied ? (
          <span className={styles.paymentFieldCopied}>Copied</span>
        ) : (
          <Copy size={10} weight="bold" />
        )}
      </button>
    </div>
  );
}

function GhostField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className={styles.paymentFieldRow}>
      <span className={styles.paymentFieldLabel}>{label}</span>
      <span className={styles.paymentFieldValueMissing}>{placeholder}</span>
    </div>
  );
}

// ── ACH card ────────────────────────────────────────────────────────────────

export function AchPaymentCard({
  method,
  formHref,
}: {
  method: WorkspaceBillingPaymentMethod | null;
  formHref: string;
}) {
  const hasAch = method !== null;
  const bankName = hasAch
    ? (method.label.replace(/\s+ending\s+\w+$/i, "").trim() || "Bank account")
    : null;

  return (
    <div
      className={`${styles.paymentCard} ${hasAch ? styles.paymentCardReady : styles.paymentCardMissing}`}
    >
      <div
        className={`${styles.paymentIcon} ${hasAch ? styles.paymentIconReady : styles.paymentIconMissing}`}
      >
        <Bank size={18} weight="duotone" />
      </div>
      <div className={styles.paymentBody}>
        <div className={styles.paymentLabel}>ACH bank account</div>
        <div className={styles.paymentMain}>{hasAch ? bankName : "No ACH on file"}</div>

        <div className={styles.paymentFields}>
          {hasAch ? (
            <>
              <CopyableField label="Bank" value={bankName!} />
              {method.last4 ? (
                <CopyableField label="Account" value={`••••••••••••${method.last4}`} />
              ) : null}
            </>
          ) : (
            <>
              <GhostField label="Bank" placeholder="Sample Bank" />
              <GhostField label="Routing" placeholder="• • • • • • • • •" />
              <GhostField label="Account" placeholder="• • • • • • • • • • • •" />
              <GhostField label="Type" placeholder="Checking" />
            </>
          )}
        </div>

        {!hasAch ? (
          <a href={formHref} className={styles.sendFormLink}>
            <ArrowSquareOut size={13} weight="bold" />
            Send ACH auth form
          </a>
        ) : null}
      </div>
      <span
        className={`${styles.paymentBadge} ${hasAch ? styles.paymentBadgeReady : styles.paymentBadgeMissing}`}
      >
        {hasAch ? "Ready" : "Missing"}
      </span>
    </div>
  );
}

// ── Card payment card ────────────────────────────────────────────────────────

export function CardPaymentCard({
  method,
  formHref,
}: {
  method: WorkspaceBillingPaymentMethod | null;
  formHref: string;
}) {
  const hasCard = method !== null;
  const brandName = hasCard
    ? (method.label.replace(/\s+ending\s+\w+$/i, "").trim() || "Card")
    : null;

  return (
    <div
      className={`${styles.paymentCard} ${hasCard ? styles.paymentCardReady : styles.paymentCardMissing}`}
    >
      <div
        className={`${styles.paymentIcon} ${hasCard ? styles.paymentIconReady : styles.paymentIconMissing}`}
      >
        <CreditCard size={18} weight="duotone" />
      </div>
      <div className={styles.paymentBody}>
        <div className={styles.paymentLabel}>Debit or credit card</div>
        <div className={styles.paymentMain}>{hasCard ? brandName : "No card on file"}</div>

        <div className={styles.paymentFields}>
          {hasCard ? (
            <>
              <CopyableField
                label="Number"
                value={`•••• •••• •••• ${method.last4 ?? "____"}`}
              />
              <div className={styles.paymentFieldRow}>
                <span className={styles.paymentFieldLabel}>Status</span>
                <span
                  className={`${styles.paymentSub} ${method.isExpiringSoon ? styles.paymentSubWarning : ""}`}
                >
                  {method.isExpiringSoon ? (
                    <Warning size={11} weight="fill" />
                  ) : null}
                  {method.status}
                  {method.isExpiringSoon ? " — expiring soon" : ""}
                </span>
              </div>
            </>
          ) : (
            <>
              <GhostField label="Number" placeholder="•••• •••• •••• ____" />
              <GhostField label="Expiry" placeholder="__ / __" />
              <GhostField label="Name" placeholder="Cardholder Name" />
              <GhostField label="Address" placeholder="123 Sample St, City, ST" />
            </>
          )}
        </div>

        {!hasCard ? (
          <a href={formHref} className={styles.sendFormLink}>
            <ArrowSquareOut size={13} weight="bold" />
            Send card auth form
          </a>
        ) : null}
      </div>
      <span
        className={`${styles.paymentBadge} ${hasCard ? styles.paymentBadgeReady : styles.paymentBadgeMissing}`}
      >
        {hasCard ? "Ready" : "Missing"}
      </span>
    </div>
  );
}
