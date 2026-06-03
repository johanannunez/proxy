"use client";

import { CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  ReceiptReimbursementStatus,
  WorkspaceFinancialReceipt,
} from "@/lib/admin/workspace-finance";
import { updateReceipt } from "./financials-actions";
import { PAYMENT_SOURCE_LABELS, REIMBURSEMENT_STATUS_LABELS } from "./PropertyBillsSection";
import styles from "./FinanceTab.module.css";

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function actionForStatus(
  status: ReceiptReimbursementStatus,
): { label: string; nextStatus: ReceiptReimbursementStatus; reimbursedAt?: string } | null {
  if (status === "claim_needed") {
    return { label: "Mark submitted", nextStatus: "claim_submitted" };
  }
  if (status === "claim_submitted" || status === "reimbursement_needed") {
    return {
      label: "Mark reimbursed",
      nextStatus: "reimbursed",
      reimbursedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function MoneyMovementSection({
  receipts,
  ownerId,
  workspaceId,
}: {
  receipts: WorkspaceFinancialReceipt[];
  ownerId: string | null;
  workspaceId: string;
}) {
  const router = useRouter();
  const [pendingReceiptId, setPendingReceiptId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openReceipts = receipts.filter((receipt) =>
    ["reimbursement_needed", "claim_needed", "claim_submitted"].includes(
      receipt.reimbursementStatus,
    ),
  );

  const totalOpenCents = openReceipts.reduce((sum, receipt) => sum + receipt.amountCents, 0);

  const handleAdvance = async (receipt: WorkspaceFinancialReceipt) => {
    if (!ownerId) return;
    const action = actionForStatus(receipt.reimbursementStatus);
    if (!action) return;

    setPendingReceiptId(receipt.id);
    setMessage(null);
    const result = await updateReceipt(receipt.id, ownerId, {
      workspaceId,
      reimbursementStatus: action.nextStatus,
      reimbursedAt: action.reimbursedAt ?? null,
    });
    setPendingReceiptId(null);
    setMessage(result.ok ? result.message : result.message || "Update failed.");
    if (result.ok) router.refresh();
  };

  return (
    <section aria-label="Reimbursements and claims">
      <div className={styles.moneyMovementHeader}>
        <div>
          <div className={styles.sectionEyebrow}>Reimbursements &amp; claims</div>
          <p className={styles.moneyMovementIntro}>
            Company-card purchases, owner reimbursements, and claim work that still needs
            movement.
          </p>
        </div>
        <div className={styles.moneyMovementTotal}>
          <strong>{formatCents(totalOpenCents)}</strong>
          <span>
            {openReceipts.length} open item{openReceipts.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {message ? (
        <div className={styles.batchFlash}>
          <CheckCircle size={14} weight="fill" />
          {message}
        </div>
      ) : null}

      {openReceipts.length === 0 ? (
        <div className={styles.moneyMovementEmpty}>
          No reimbursements or claims need attention right now.
        </div>
      ) : (
        <div className={styles.moneyMovementList}>
          {openReceipts.map((receipt) => {
            const action = actionForStatus(receipt.reimbursementStatus);
            return (
              <div key={receipt.id} className={styles.moneyMovementRow}>
                <div className={styles.moneyMovementMain}>
                  <span className={styles.moneyMovementVendor}>{receipt.vendor}</span>
                  <span className={styles.moneyMovementMeta}>
                    {receipt.propertyLabel ?? "Workspace-wide"} · {formatDate(receipt.purchaseDate)}
                  </span>
                  <span className={styles.moneyMovementPill}>
                    {PAYMENT_SOURCE_LABELS[receipt.paymentSource]} ·{" "}
                    {REIMBURSEMENT_STATUS_LABELS[receipt.reimbursementStatus]}
                  </span>
                  {receipt.claimProvider ? (
                    <span className={styles.moneyMovementMeta}>
                      Claim: {receipt.claimProvider}
                      {receipt.claimReference ? ` ${receipt.claimReference}` : ""}
                    </span>
                  ) : null}
                </div>
                <div className={styles.moneyMovementRight}>
                  <strong>{formatCents(receipt.amountCents, receipt.currency)}</strong>
                  {action ? (
                    <button
                      type="button"
                      className={styles.moneyMovementAction}
                      onClick={() => void handleAdvance(receipt)}
                      disabled={pendingReceiptId === receipt.id || !ownerId}
                    >
                      <PaperPlaneTilt size={13} weight="bold" />
                      {pendingReceiptId === receipt.id ? "Updating..." : action.label}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
