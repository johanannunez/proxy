"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ArrowSquareOut,
  CheckCircle,
  CreditCard,
  FilePlus,
  Plus,
  Trash,
} from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import type { WorkspaceFinance } from "@/lib/admin/workspace-finance";
import {
  approveWorkspaceFinanceInvoiceAction,
  createWorkspaceFinanceScheduleAction,
  createWorkspacePaymentSetupSessionAction,
  generateWorkspaceDraftInvoiceAction,
  voidWorkspaceFinanceInvoiceAction,
} from "@/lib/admin/workspace-finance-actions";
import styles from "./FinanceTab.module.css";

type FinanceOperationsProps = {
  workspaceId: string;
  finance: WorkspaceFinance;
};

type DraftLine = {
  localId: string;
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
  unitCost: string;
};

const COLLECTION_OPTIONS = [
  { value: "auto_charge", label: "Auto charge saved payment method" },
  { value: "send_invoice", label: "Send invoice for owner payment" },
  { value: "manual", label: "Manual review only" },
];

const INTERVAL_OPTIONS = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "week", label: "Weekly" },
  { value: "year", label: "Yearly" },
];

function nextMonthDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function createBlankLine(): DraftLine {
  return {
    localId: crypto.randomUUID(),
    title: "Management fee",
    description: "",
    quantity: "1",
    unitPrice: "",
    unitCost: "",
  };
}

function toCents(value: string): number {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function toPositiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function FinanceOperations({ workspaceId, finance }: FinanceOperationsProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Monthly owner finance");
  const [collectionMethod, setCollectionMethod] = useState("auto_charge");
  const [interval, setInterval] = useState("month");
  const [intervalCount, setIntervalCount] = useState("1");
  const [firstInvoiceDate, setFirstInvoiceDate] = useState(nextMonthDate());
  const [paymentTermsDays, setPaymentTermsDays] = useState("0");
  const [reviewDays, setReviewDays] = useState("3");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([createBlankLine()]);

  const schedulePreviewCents = useMemo(
    () => lines.reduce((sum, line) => {
      const quantity = toPositiveNumber(line.quantity, 1);
      return sum + Math.round(quantity * toCents(line.unitPrice));
    }, 0),
    [lines],
  );

  function runAction(action: () => Promise<{ ok: true; message?: string; url?: string } | { ok: false; error: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if ("url" in result && result.url) {
        window.location.href = result.url;
        return;
      }
      setMessage(result.message ?? "Done.");
    });
  }

  function updateLine(localId: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (
      line.localId === localId ? { ...line, ...patch } : line
    )));
  }

  function submitSchedule() {
    runAction(() => createWorkspaceFinanceScheduleAction({
      workspaceId,
      name,
      collectionMethod,
      interval,
      intervalCount: Number(intervalCount),
      firstInvoiceDate,
      paymentTermsDays: Number(paymentTermsDays),
      reviewDaysBeforeCharge: Number(reviewDays),
      memo,
      lines: lines.map((line) => ({
        title: line.title,
        description: line.description,
        quantity: toPositiveNumber(line.quantity, 1),
        unitPriceCents: toCents(line.unitPrice),
        unitCostCents: toCents(line.unitCost),
      })),
    }));
  }

  return (
    <div className={styles.operations}>
      <div className={styles.actionGrid}>
        <section id="finance-payment-setup" className={styles.actionPanel}>
          <div className={styles.actionHeader}>
            <div>
              <h3>Payment setup</h3>
              <p>Stripe collects card, ACH, Apple Pay, Google Pay, and Link when eligible.</p>
            </div>
            <CreditCard size={22} weight="duotone" />
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={pending}
            onClick={() => runAction(() => createWorkspacePaymentSetupSessionAction({
              workspaceId,
              returnBaseUrl: window.location.origin,
            }))}
          >
            <ArrowSquareOut size={15} weight="bold" />
            {finance.paymentMethod ? "Update payment method" : "Add payment method"}
          </button>
        </section>

        <section className={styles.actionPanel}>
          <div className={styles.actionHeader}>
            <div>
              <h3>Invoice controls</h3>
              <p>Generate draft invoices from active schedules, then approve after review.</p>
            </div>
            <FilePlus size={22} weight="duotone" />
          </div>
          <div className={styles.quickActions}>
            {finance.schedules.map((schedule) => (
              <button
                key={schedule.id}
                type="button"
                className={styles.secondaryButton}
                disabled={pending || schedule.status !== "active"}
                onClick={() => runAction(() => generateWorkspaceDraftInvoiceAction({
                  workspaceId,
                  scheduleId: schedule.id,
                }))}
              >
                Generate {schedule.name}
              </button>
            ))}
            {finance.schedules.length === 0 ? (
              <p className={styles.inlineHint}>Create a schedule to unlock draft generation.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section id="finance-recurring-builder" className={styles.builderPanel}>
        <div className={styles.builderHeader}>
          <div>
            <h3>Recurring schedule builder</h3>
            <p>Create the recurring service lines Proxy will turn into review-ready invoices.</p>
          </div>
          <strong>{formatCents(schedulePreviewCents)}</strong>
        </div>

        <div className={styles.builderGrid}>
          <label className={styles.field}>
            <span>Schedule name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={styles.textInput}
            />
          </label>

          <label className={styles.field}>
            <span>Collection</span>
            <CustomSelect
              value={collectionMethod}
              onChange={setCollectionMethod}
              options={COLLECTION_OPTIONS}
            />
          </label>

          <label className={styles.field}>
            <span>Frequency</span>
            <CustomSelect
              value={interval}
              onChange={setInterval}
              options={INTERVAL_OPTIONS}
            />
          </label>

          <label className={styles.field}>
            <span>Every</span>
            <input
              value={intervalCount}
              onChange={(event) => setIntervalCount(event.target.value)}
              className={styles.textInput}
              inputMode="numeric"
            />
          </label>

          <div className={styles.field}>
            <span>First invoice</span>
            <DatePickerInput
              value={firstInvoiceDate}
              onChange={setFirstInvoiceDate}
              className={styles.dateButton}
            />
          </div>

          <label className={styles.field}>
            <span>Payment terms</span>
            <input
              value={paymentTermsDays}
              onChange={(event) => setPaymentTermsDays(event.target.value)}
              className={styles.textInput}
              inputMode="numeric"
            />
          </label>

          <label className={styles.field}>
            <span>Review days</span>
            <input
              value={reviewDays}
              onChange={(event) => setReviewDays(event.target.value)}
              className={styles.textInput}
              inputMode="numeric"
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>Memo</span>
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            className={styles.textArea}
            rows={3}
          />
        </label>

        <div className={styles.lineEditor}>
          <div className={styles.lineEditorHeader}>
            <span>Service lines</span>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setLines((current) => [...current, createBlankLine()])}
              aria-label="Add service line"
            >
              <Plus size={15} weight="bold" />
            </button>
          </div>

          {lines.map((line, index) => (
            <div key={line.localId} className={styles.lineRow}>
              <input
                value={line.title}
                onChange={(event) => updateLine(line.localId, { title: event.target.value })}
                className={styles.textInput}
                aria-label={`Line ${index + 1} title`}
              />
              <input
                value={line.description}
                onChange={(event) => updateLine(line.localId, { description: event.target.value })}
                className={styles.textInput}
                aria-label={`Line ${index + 1} description`}
                placeholder="Description"
              />
              <input
                value={line.quantity}
                onChange={(event) => updateLine(line.localId, { quantity: event.target.value })}
                className={styles.textInput}
                inputMode="decimal"
                aria-label={`Line ${index + 1} quantity`}
              />
              <input
                value={line.unitPrice}
                onChange={(event) => updateLine(line.localId, { unitPrice: event.target.value })}
                className={styles.textInput}
                inputMode="decimal"
                aria-label={`Line ${index + 1} price`}
                placeholder="Price"
              />
              <input
                value={line.unitCost}
                onChange={(event) => updateLine(line.localId, { unitCost: event.target.value })}
                className={styles.textInput}
                inputMode="decimal"
                aria-label={`Line ${index + 1} cost`}
                placeholder="Cost"
              />
              <button
                type="button"
                className={styles.iconButton}
                disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((item) => item.localId !== line.localId))}
                aria-label={`Remove line ${index + 1}`}
              >
                <Trash size={15} weight="bold" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          disabled={pending}
          onClick={submitSchedule}
        >
          <CheckCircle size={15} weight="bold" />
          Create recurring schedule
        </button>
      </section>

      {finance.invoices.some((invoice) => ["review_ready", "approved"].includes(invoice.status)) ? (
        <section className={styles.reviewPanel}>
          <h3>Ready for review</h3>
          {finance.invoices
            .filter((invoice) => ["review_ready", "approved"].includes(invoice.status))
            .map((invoice) => (
              <div key={invoice.id} className={styles.reviewRow}>
                <div>
                  <strong>{formatCents(invoice.amount_cents)}</strong>
                  <span>{invoice.collection_method.replaceAll("_", " ")}</span>
                </div>
                <div className={styles.reviewActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={pending}
                    onClick={() => runAction(() => voidWorkspaceFinanceInvoiceAction({
                      workspaceId,
                      invoiceId: invoice.id,
                    }))}
                  >
                    Void
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={pending}
                    onClick={() => runAction(() => approveWorkspaceFinanceInvoiceAction({
                      workspaceId,
                      invoiceId: invoice.id,
                    }))}
                  >
                    Approve and collect
                  </button>
                </div>
              </div>
            ))}
        </section>
      ) : null}

      {message ? <div className={styles.successBlock}>{message}</div> : null}
      {error ? <div className={styles.errorBlock}>{error}</div> : null}
    </div>
  );
}
