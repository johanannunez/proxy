# Receipt Capture 2.0 + Payment Method Enhancement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual-entry-first receipt intake with an upload-first AI extraction flow (single and bulk), enhance the missing payment method display with grayed placeholder fields and copy-on-click, and add hover preview to receipt rows.

**Architecture:** `PropertyBillsSection.tsx` is rewritten around a drag-and-drop zone that triggers concurrent `analyzeReceiptDraft` server action calls immediately on file drop, producing a batch grid of editable extraction cards. A new `PaymentMethodCard.tsx` client component renders both ready and missing states with structured field rows. All preview state for receipt hover is `position: fixed` to avoid `overflow: hidden` clipping.

**Tech Stack:** Next.js 15 App Router, React 19, CSS Modules, `@phosphor-icons/react`, `CustomSelect` from `@/components/admin/CustomSelect`, `DatePickerInput` from `@/components/admin/DatePickerInput`, existing `analyzeReceiptDraft` and `createReceipt` server actions from `./financials-actions`.

---

## File Map

| Action | File |
|--------|------|
| Modify | `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/BillingTab.module.css` |
| Create | `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/PaymentMethodCard.tsx` |
| Modify | `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/BillingTab.tsx` |
| Rewrite | `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/PropertyBillsSection.tsx` |

---

## Task 1: CSS — Add all new classes to BillingTab.module.css

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/BillingTab.module.css`

- [ ] **Step 1: Append new CSS classes at the end of the file**

Open `BillingTab.module.css` and append the following block after the last existing rule:

```css
/* ── Drop zone ── */
.dropZone {
  border: 2px dashed var(--color-warm-gray-200);
  border-radius: 12px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  transition: border-color 150ms ease, background 150ms ease;
  background: transparent;
  text-align: center;
  margin-bottom: 16px;
  width: 100%;
}

.dropZone:hover,
.dropZoneActive {
  border-color: var(--color-brand);
  background: color-mix(in srgb, var(--color-brand) 4%, transparent);
}

.dropZoneIcon {
  color: var(--color-text-secondary);
  opacity: 0.55;
}

.dropZoneLabel {
  font-size: 13px;
  font-weight: 560;
  color: var(--color-text-primary);
}

.dropZoneHint {
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* ── Batch grid ── */
.batchGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.batchCard {
  background: var(--color-surface);
  border: 1px solid var(--color-warm-gray-200);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.batchCardProcessing {
  opacity: 0.72;
}

.batchCardThumb {
  height: 116px;
  background: var(--color-warm-gray-50);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.batchCardThumbImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.batchCardSpinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--color-warm-gray-200);
  border-top-color: var(--color-brand);
  border-radius: 50%;
  animation: billsSpinFrame 0.75s linear infinite;
  flex-shrink: 0;
}

@keyframes billsSpinFrame {
  to { transform: rotate(360deg); }
}

.batchCardPdfIcon {
  color: var(--color-text-secondary);
  opacity: 0.5;
}

.batchCardThumbOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
}

.batchCardBody {
  padding: 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  flex: 1;
}

.batchCardError {
  font-size: 11px;
  color: var(--color-error);
  padding: 6px 8px;
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-error) 18%, transparent);
  border-radius: 6px;
}

.batchCardActions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 8px 12px;
  border-top: 1px solid var(--color-warm-gray-50);
}

.batchCardDiscard {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--color-warm-gray-200);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease, border-color 100ms ease;
}

.batchCardDiscard:hover {
  background: color-mix(in srgb, var(--color-error) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-error) 28%, transparent);
  color: var(--color-error);
}

.batchSaveBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-warm-gray-200);
  border-radius: 10px;
  margin-bottom: 12px;
}

.batchSaveCount {
  font-size: 11.5px;
  color: var(--color-text-secondary);
}

.batchSaveButtons {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Batch flash banner ── */
.batchFlash {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--color-success) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success) 24%, transparent);
  color: var(--color-success);
  font-size: 12px;
  font-weight: 560;
  margin-bottom: 12px;
}

/* ── Payment field rows (ready + ghost/missing) ── */
.paymentFields {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-warm-gray-200);
}

.paymentFieldRow {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
}

.paymentFieldLabel {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  width: 58px;
  flex-shrink: 0;
}

.paymentFieldValue {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--color-text-primary);
  font-family: ui-monospace, "SF Mono", monospace;
  cursor: pointer;
  border: none;
  background: transparent;
  border-radius: 4px;
  padding: 2px 5px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: background 100ms ease;
  text-align: left;
}

.paymentFieldValue:hover {
  background: color-mix(in srgb, var(--color-brand) 8%, transparent);
}

.paymentFieldValueMissing {
  font-size: 11.5px;
  color: color-mix(in srgb, var(--color-text-secondary) 42%, transparent);
  font-family: ui-monospace, "SF Mono", monospace;
  font-style: italic;
  padding: 2px 5px;
  letter-spacing: 0.02em;
}

.paymentFieldCopied {
  font-size: 9.5px;
  color: var(--color-success);
  font-family: inherit;
  font-style: normal;
  font-weight: 660;
}

/* ── Receipt hover preview (position: fixed, rendered at section root) ── */
.receiptPreviewPopover {
  position: fixed;
  z-index: 200;
  background: var(--color-surface);
  border: 1px solid var(--color-warm-gray-200);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.20), 0 2px 6px rgba(0, 0, 0, 0.10);
  pointer-events: none;
}

.receiptPreviewImage {
  width: 200px;
  height: 260px;
  object-fit: cover;
  display: block;
}

.receiptPreviewPdfLabel {
  width: 200px;
  height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-warm-gray-50);
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd /Users/johanannunez/workspace/parcel && pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -i "billing\|error" | head -20
```

Expected: no errors related to BillingTab.

- [ ] **Step 3: Commit**

```bash
cd /Users/johanannunez/workspace/parcel && git add apps/web/src/app/\(admin\)/admin/workspaces/\[workspaceId\]/BillingTab.module.css && git commit -m "style: add receipt capture 2.0 and payment field CSS classes"
```

---

## Task 2: PaymentMethodCard.tsx — New client component for payment method display

**Files:**
- Create: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/PaymentMethodCard.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import {
  Bank,
  CreditCard,
  Warning,
  ArrowSquareOut,
  Copy,
  Check,
  FilePdf,
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
      // clipboard API not available; silently ignore
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
  // Strip " ending XXXX" suffix to isolate the bank name
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/johanannunez/workspace/parcel && pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep "PaymentMethodCard\|error TS" | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/johanannunez/workspace/parcel && git add apps/web/src/app/\(admin\)/admin/workspaces/\[workspaceId\]/PaymentMethodCard.tsx && git commit -m "feat: add PaymentMethodCard client component with grayed placeholder fields and copy-on-click"
```

---

## Task 3: BillingTab.tsx — Wire PaymentMethodCard and rename Workspace-wide

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/BillingTab.tsx`

- [ ] **Step 1: Replace the entire file content**

The existing `BillingTab.tsx` renders inline payment card JSX. Replace the full file with the version below. Key changes vs the current file:
1. Imports `AchPaymentCard` and `CardPaymentCard` from `./PaymentMethodCard` instead of rendering inline cards.
2. In `groupReceiptsByProperty`, changes the label for null-property receipts from `"Unassigned"` to `"Workspace-wide"`.
3. Removes the now-redundant imports (`Warning`, `Bank`, `CreditCard` — these move into `PaymentMethodCard.tsx`).

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/johanannunez/workspace/parcel && pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep "BillingTab\|error TS" | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/johanannunez/workspace/parcel && git add apps/web/src/app/\(admin\)/admin/workspaces/\[workspaceId\]/BillingTab.tsx && git commit -m "feat: use PaymentMethodCard in BillingTab, rename Unassigned to Workspace-wide"
```

---

## Task 4: PropertyBillsSection.tsx — Full rewrite with drop zone, batch grid, hover preview

**Files:**
- Rewrite: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/PropertyBillsSection.tsx`

This is the core of the feature. The component replaces form-first intake with a drag-and-drop zone that fires `analyzeReceiptDraft` immediately on file drop (one concurrent call per file). Results land in a batch grid of editable cards. ReceiptRow gains hover preview using `position: fixed` state lifted to the section root.

- [ ] **Step 1: Replace the entire file**

```tsx
"use client";

import {
  Buildings,
  Plus,
  CaretDown,
  Eye,
  EyeSlash,
  CheckCircle,
  UploadSimple,
  X,
  FilePdf,
} from "@phosphor-icons/react";
import { useState, useRef, useCallback } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { PropertyReceiptGroup } from "./BillingTab";
import type { WorkspaceFinancialReceipt } from "@/lib/admin/workspace-billing";
import { analyzeReceiptDraft, createReceipt } from "./financials-actions";
import type { ReceiptDraftAnalysis } from "./financials-actions";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import { DatePickerInput } from "@/components/admin/DatePickerInput";
import styles from "./BillingTab.module.css";

// ── Constants ────────────────────────────────────────────────────────────────

const RECEIPT_CATEGORIES: SelectOption[] = [
  { value: "Repairs", label: "Repairs" },
  { value: "Cleaning", label: "Cleaning" },
  { value: "Utilities", label: "Utilities" },
  { value: "Supplies", label: "Supplies" },
  { value: "Insurance", label: "Insurance" },
  { value: "Taxes", label: "Taxes" },
  { value: "Software", label: "Software" },
  { value: "Professional services", label: "Professional services" },
  { value: "Mortgage", label: "Mortgage" },
  { value: "Owner expense", label: "Owner expense" },
];

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_SIZE = 10 * 1024 * 1024;

// ── Types ────────────────────────────────────────────────────────────────────

type FileFields = {
  vendor: string;
  amount: string;
  category: string;
  purchaseDate: string;
  propertyId: string | null;
  ownerVisible: boolean;
  notes: string;
};

type ProcessingFile = {
  id: string;
  file: File;
  previewUrl: string | null;
  status: "processing" | "extracted" | "error";
  errorMessage?: string;
  analysis?: ReceiptDraftAnalysis;
  fields: FileFields;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultFields(properties: { id: string }[]): FileFields {
  return {
    vendor: "",
    amount: "",
    category: "Owner expense",
    purchaseDate: todayDate(),
    propertyId: properties.length === 1 ? (properties[0]?.id ?? null) : null,
    ownerVisible: true,
    notes: "",
  };
}

// ── Main component ───────────────────────────────────────────────────────────

export function PropertyBillsSection({
  groups,
  totalReceiptCents,
  totalReceiptCount,
  properties,
  ownerId,
  workspaceId,
}: {
  groups: PropertyReceiptGroup[];
  totalReceiptCents: number;
  totalReceiptCount: number;
  properties: { id: string; label: string }[];
  ownerId: string | null;
  workspaceId: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const first = groups[0]?.label ?? null;
    return first ? new Set([first]) : new Set();
  });

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [batchFlash, setBatchFlash] = useState<string | null>(null);

  // Receipt hover preview — position: fixed to escape overflow: hidden
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<{
    url: string;
    bottom: number;
    right: number;
  } | null>(null);

  const showReceiptPreview = useCallback((url: string, rect: DOMRect) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setReceiptPreview({
        url,
        bottom: window.innerHeight - rect.top + 6,
        right: window.innerWidth - rect.right + 10,
      });
    }, 200);
  }, []);

  const hideReceiptPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setReceiptPreview(null);
  }, []);

  // ── File drop handling ──────────────────────────────────────────────────

  const handleFileDrop = useCallback(
    (rawFiles: File[]) => {
      const allowed = rawFiles.filter(
        (f) => ALLOWED_TYPES.includes(f.type) && f.size <= MAX_SIZE,
      );
      if (allowed.length === 0) return;

      const newEntries: ProcessingFile[] = allowed.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        status: "processing" as const,
        fields: defaultFields(properties),
      }));

      setProcessingFiles((prev) => [...prev, ...newEntries]);

      for (const entry of newEntries) {
        void analyzeReceiptDraft({
          vendor: "",
          category: "Owner expense",
          file: entry.file,
          fileName: entry.file.name,
        })
          .then((result) => {
            setProcessingFiles((prev) =>
              prev.map((pf) => {
                if (pf.id !== entry.id) return pf;
                if (result.ok) {
                  return {
                    ...pf,
                    status: "extracted" as const,
                    analysis: result.analysis,
                    fields: {
                      ...pf.fields,
                      vendor: result.analysis.vendor?.trim() || pf.fields.vendor,
                      amount:
                        result.analysis.amount?.replace(/[$,]/g, "") || pf.fields.amount,
                      purchaseDate:
                        result.analysis.purchaseDate || pf.fields.purchaseDate,
                      category: result.analysis.category || pf.fields.category,
                    },
                  };
                }
                return {
                  ...pf,
                  status: "error" as const,
                  errorMessage: "Extraction failed. Fill fields manually.",
                };
              }),
            );
          })
          .catch(() => {
            setProcessingFiles((prev) =>
              prev.map((pf) =>
                pf.id === entry.id
                  ? { ...pf, status: "error" as const, errorMessage: "Extraction failed." }
                  : pf,
              ),
            );
          });
      }
    },
    [properties],
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileDrop(Array.from(e.dataTransfer.files));
  };
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    handleFileDrop(Array.from(e.target.files ?? []));
    // Reset so the same file can be re-dropped
    e.target.value = "";
  };

  // ── Field updates ───────────────────────────────────────────────────────

  const updateFileField = useCallback(
    <K extends keyof FileFields>(id: string, key: K, value: FileFields[K]) => {
      setProcessingFiles((prev) =>
        prev.map((pf) =>
          pf.id === id ? { ...pf, fields: { ...pf.fields, [key]: value } } : pf,
        ),
      );
    },
    [],
  );

  const discardFile = useCallback((id: string) => {
    setProcessingFiles((prev) => {
      const entry = prev.find((pf) => pf.id === id);
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((pf) => pf.id !== id);
    });
  }, []);

  const discardAll = useCallback(() => {
    setProcessingFiles((prev) => {
      prev.forEach((pf) => { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl); });
      return [];
    });
  }, []);

  // ── Save all ────────────────────────────────────────────────────────────

  const handleSaveAll = async () => {
    if (!ownerId || isSaving) return;

    const savable = processingFiles.filter((pf) => {
      const amount = Number(pf.fields.amount);
      return Number.isFinite(amount) && amount > 0 && pf.fields.vendor.trim().length > 0;
    });

    if (savable.length === 0) return;
    setIsSaving(true);

    let savedCount = 0;
    let totalCents = 0;

    await Promise.all(
      savable.map(async (pf) => {
        const amount = Number(pf.fields.amount);
        const result = await createReceipt(ownerId, {
          workspaceId,
          vendor: pf.fields.vendor.trim(),
          amount,
          category: pf.fields.category,
          purchaseDate: pf.fields.purchaseDate,
          propertyId: pf.fields.propertyId ?? undefined,
          visibility: pf.fields.ownerVisible ? "visible" : "private",
          file: pf.file,
          notes: pf.fields.notes.trim() || undefined,
          analysis: pf.analysis ?? undefined,
          analysisSource: pf.status === "extracted" ? "document" : undefined,
        });
        if (result.ok) {
          savedCount++;
          totalCents += Math.round(amount * 100);
        }
      }),
    );

    // Cleanup object URLs
    processingFiles.forEach((pf) => {
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
    });

    setProcessingFiles([]);
    setIsSaving(false);
    setIsIntakeOpen(false);

    if (savedCount > 0) {
      const totalFormatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(totalCents / 100);
      setBatchFlash(
        `${savedCount} receipt${savedCount === 1 ? "" : "s"} saved · ${totalFormatted} total`,
      );
      setTimeout(() => setBatchFlash(null), 3000);
    }

    router.refresh();
  };

  // ── Property group toggle ───────────────────────────────────────────────

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const readyToSave = processingFiles.filter((pf) => {
    const amount = Number(pf.fields.amount);
    return Number.isFinite(amount) && amount > 0 && pf.fields.vendor.trim().length > 0;
  }).length;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section aria-label="Bills by property">
      {/* Hover preview rendered at section root — position: fixed bypasses overflow: hidden */}
      {receiptPreview ? (
        <div
          className={styles.receiptPreviewPopover}
          style={{ bottom: receiptPreview.bottom, right: receiptPreview.right }}
        >
          <img
            src={receiptPreview.url}
            className={styles.receiptPreviewImage}
            alt="Receipt preview"
          />
        </div>
      ) : null}

      {/* Top bar */}
      <div className={styles.billsTopBar}>
        <div className={styles.billsTopBarLeft}>
          <div className={styles.sectionEyebrow}>Bills by property</div>
          {totalReceiptCount > 0 ? (
            <div className={styles.billsMeta}>
              {totalReceiptCount} receipt{totalReceiptCount === 1 ? "" : "s"} ·{" "}
              {formatCents(totalReceiptCents)} total
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.addReceiptButton}
          onClick={() => setIsIntakeOpen((prev) => !prev)}
        >
          <Plus size={14} weight="bold" />
          {isIntakeOpen ? "Close" : "Add receipt"}
        </button>
      </div>

      {/* Batch flash banner */}
      {batchFlash ? (
        <div className={styles.batchFlash}>
          <CheckCircle size={14} weight="fill" />
          {batchFlash}
        </div>
      ) : null}

      {/* Intake panel */}
      {isIntakeOpen ? (
        <div className={styles.intakePanel}>
          {/* Drop zone */}
          <div
            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload receipts"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              multiple
              hidden
              onChange={handleFileInput}
            />
            <UploadSimple size={26} weight="duotone" className={styles.dropZoneIcon} />
            <span className={styles.dropZoneLabel}>
              Drop receipts here or click to select
            </span>
            <span className={styles.dropZoneHint}>
              PDF, JPG, PNG, WebP · max 10 MB each · multiple files supported
            </span>
          </div>

          {/* Batch grid */}
          {processingFiles.length > 0 ? (
            <>
              <div className={styles.batchGrid}>
                {processingFiles.map((pf) => (
                  <BatchCard
                    key={pf.id}
                    file={pf}
                    properties={properties}
                    onFieldChange={updateFileField}
                    onDiscard={discardFile}
                  />
                ))}
              </div>
              <div className={styles.batchSaveBar}>
                <span className={styles.batchSaveCount}>
                  {processingFiles.length} file{processingFiles.length === 1 ? "" : "s"} ·{" "}
                  {readyToSave} ready to save
                </span>
                <div className={styles.batchSaveButtons}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={discardAll}
                    disabled={isSaving}
                  >
                    Clear all
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => void handleSaveAll()}
                    disabled={isSaving || readyToSave === 0 || !ownerId}
                  >
                    {isSaving
                      ? "Saving..."
                      : `Save ${readyToSave} receipt${readyToSave === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Property groups */}
      {groups.length === 0 ? (
        <div className={styles.billsEmptyState}>
          <Buildings size={20} weight="duotone" className={styles.billsEmptyIcon} />
          <div>
            <strong>No receipts yet</strong>
            <span>Upload a receipt above to get started. Receipts are grouped by property.</span>
          </div>
        </div>
      ) : (
        <div className={styles.billsList}>
          {groups.map((group) => {
            const isOpen = openGroups.has(group.label);
            return (
              <div key={group.label} className={styles.propertyGroup}>
                <button
                  type="button"
                  className={styles.propertyGroupHeader}
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={isOpen}
                >
                  <div className={styles.propertyGroupLeft}>
                    <span
                      className={`${styles.propertyDot} ${group.id === null ? styles.propertyDotUnassigned : ""}`}
                    />
                    <span
                      className={`${styles.propertyName} ${group.id === null ? styles.propertyNameUnassigned : ""}`}
                    >
                      {group.label}
                    </span>
                    <span className={styles.propertyCount}>
                      {group.receipts.length} receipt{group.receipts.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className={styles.propertyGroupRight}>
                    <span className={styles.propertyTotal}>
                      {formatCents(group.totalCents)}
                    </span>
                    <CaretDown
                      size={13}
                      weight="bold"
                      className={`${styles.propertyChevron} ${isOpen ? styles.propertyChevronOpen : ""}`}
                    />
                  </div>
                </button>
                {isOpen ? (
                  <div className={styles.receiptList}>
                    {group.receipts.map((receipt) => (
                      <ReceiptRow
                        key={receipt.id}
                        receipt={receipt}
                        onShowPreview={showReceiptPreview}
                        onHidePreview={hideReceiptPreview}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── BatchCard sub-component ──────────────────────────────────────────────────

function BatchCard({
  file,
  properties,
  onFieldChange,
  onDiscard,
}: {
  file: ProcessingFile;
  properties: { id: string; label: string }[];
  onFieldChange: <K extends keyof FileFields>(id: string, key: K, value: FileFields[K]) => void;
  onDiscard: (id: string) => void;
}) {
  const isProcessing = file.status === "processing";

  return (
    <div className={`${styles.batchCard} ${isProcessing ? styles.batchCardProcessing : ""}`}>
      {/* Thumbnail */}
      <div className={styles.batchCardThumb}>
        {file.previewUrl ? (
          <>
            <img
              src={file.previewUrl}
              className={styles.batchCardThumbImage}
              alt={file.file.name}
            />
            {isProcessing ? (
              <div className={styles.batchCardThumbOverlay}>
                <div className={styles.batchCardSpinner} />
              </div>
            ) : null}
          </>
        ) : isProcessing ? (
          <div className={styles.batchCardSpinner} />
        ) : (
          <FilePdf size={28} weight="duotone" className={styles.batchCardPdfIcon} />
        )}
      </div>

      {/* Fields */}
      <div className={styles.batchCardBody}>
        {file.status === "error" ? (
          <div className={styles.batchCardError}>
            {file.errorMessage ?? "Extraction failed. Fill fields manually."}
          </div>
        ) : null}

        <label className={styles.field}>
          <span>Vendor</span>
          <input
            className={styles.textInput}
            value={file.fields.vendor}
            onChange={(e) => onFieldChange(file.id, "vendor", e.target.value)}
            placeholder="Home Depot"
          />
        </label>

        <label className={styles.field}>
          <span>Amount</span>
          <input
            className={styles.textInput}
            value={file.fields.amount}
            onChange={(e) => onFieldChange(file.id, "amount", e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>

        <div className={styles.field}>
          <span>Category</span>
          <CustomSelect
            value={file.fields.category}
            onChange={(v) => onFieldChange(file.id, "category", v)}
            options={RECEIPT_CATEGORIES}
          />
        </div>

        <div className={styles.field}>
          <span>Date</span>
          <DatePickerInput
            value={file.fields.purchaseDate}
            onChange={(v) => onFieldChange(file.id, "purchaseDate", v)}
          />
        </div>

        {properties.length > 0 ? (
          <div className={styles.intakePropertyRow}>
            <span>Property</span>
            <div className={styles.intakePropertyButtons}>
              <button
                type="button"
                className={`${styles.propertyChip} ${file.fields.propertyId === null ? styles.propertyChipActive : ""}`}
                onClick={() => onFieldChange(file.id, "propertyId", null)}
              >
                Workspace-wide
              </button>
              {properties.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.propertyChip} ${file.fields.propertyId === p.id ? styles.propertyChipActive : ""}`}
                  onClick={() => onFieldChange(file.id, "propertyId", p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className={styles.intakeVisibilityToggle}>
          <input
            type="checkbox"
            checked={file.fields.ownerVisible}
            onChange={(e) => onFieldChange(file.id, "ownerVisible", e.target.checked)}
          />
          <span>
            {file.fields.ownerVisible ? (
              <Eye size={13} weight="bold" />
            ) : (
              <EyeSlash size={13} weight="bold" />
            )}
            {file.fields.ownerVisible ? "Visible to owner" : "Admin only"}
          </span>
        </label>
      </div>

      {/* Discard */}
      <div className={styles.batchCardActions}>
        <button
          type="button"
          className={styles.batchCardDiscard}
          onClick={() => onDiscard(file.id)}
          title="Discard this receipt"
        >
          <X size={13} weight="bold" />
        </button>
      </div>
    </div>
  );
}

// ── ReceiptRow sub-component ─────────────────────────────────────────────────

function ReceiptRow({
  receipt,
  onShowPreview,
  onHidePreview,
}: {
  receipt: WorkspaceFinancialReceipt;
  onShowPreview: (url: string, rect: DOMRect) => void;
  onHidePreview: () => void;
}) {
  return (
    <div
      className={styles.receiptRow}
      onMouseEnter={
        receipt.imageUrl
          ? (e) => onShowPreview(receipt.imageUrl!, e.currentTarget.getBoundingClientRect())
          : undefined
      }
      onMouseLeave={receipt.imageUrl ? onHidePreview : undefined}
    >
      <div className={styles.receiptMain}>
        <span className={styles.receiptVendor}>{receipt.vendor}</span>
        {receipt.category ? (
          <span className={styles.receiptCategory}>{receipt.category}</span>
        ) : null}
      </div>
      <div className={styles.receiptRight}>
        <span className={styles.receiptAmount}>
          {formatCents(receipt.amountCents, receipt.currency)}
        </span>
        {receipt.purchaseDate ? (
          <span className={styles.receiptDate}>{formatDate(receipt.purchaseDate)}</span>
        ) : null}
        <span className={styles.receiptVisibility}>
          {receipt.visibility === "private" ? (
            <EyeSlash size={11} weight="bold" />
          ) : (
            <Eye size={11} weight="bold" />
          )}
        </span>
        {receipt.imageUrl ? (
          <a
            href={receipt.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.receiptFileLink}
          >
            File
          </a>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/johanannunez/workspace/parcel && pnpm exec tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep "PropertyBillsSection\|error TS" | head -30
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/johanannunez/workspace/parcel && git add apps/web/src/app/\(admin\)/admin/workspaces/\[workspaceId\]/PropertyBillsSection.tsx && git commit -m "feat: receipt capture 2.0 — upload-first drop zone, AI batch extraction, hover preview"
```

---

## Task 5: Verify end-to-end in browser

**Files:** none changed

- [ ] **Step 1: Confirm dev server is running**

```bash
lsof -i :4000 | grep LISTEN | head -3
```

If no output: `cd /Users/johanannunez/workspace/parcel/apps/web && doppler run -- next dev -p 4000 &`

- [ ] **Step 2: Open the billing tab**

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B goto "http://localhost:4000/api/dev/auth"
```

Then navigate to any workspace and add `?tab=billing` to the URL.

- [ ] **Step 3: Verify payment method cards**

```bash
$B screenshot /tmp/billing-payment-cards.png
```

Read the screenshot. Confirm:
- Missing ACH shows 4 grayed rows (Bank: "Sample Bank", Routing: "•••", Account: "•••", Type: "Checking")
- Missing Card shows 4 grayed rows (Number, Expiry, Name, Address)
- Ready ACH/Card shows real values with a Copy icon

- [ ] **Step 4: Verify drop zone appears**

```bash
$B click "text=Add receipt"
$B screenshot /tmp/billing-drop-zone.png
```

Read the screenshot. Confirm the drop zone (dashed border, upload icon, label, hint) renders inside the intake panel.

- [ ] **Step 5: Test single file upload via file picker**

Use `$B snapshot -i` to get ref for the hidden file input, then:
```bash
# Upload a test image via JS
$B js "document.querySelector('input[type=file][multiple]').dispatchEvent(new Event('change'))"
```

Alternatively, navigate to the page in a real browser tab via gstack's goto and use the file picker manually. Confirm:
1. File appears as a processing card with spinner
2. After ~3-5 seconds, fields populate (vendor, amount, category, date) from AI extraction
3. "Save 1 receipt" button becomes active once vendor and amount are filled

- [ ] **Step 6: Test hover preview**

Navigate to a workspace that has at least one receipt with an image URL. Hover over a receipt row and confirm the preview popover appears after ~200ms, positioned above-right of the row.

```bash
$B screenshot /tmp/billing-hover-preview.png
```

- [ ] **Step 7: Verify "Workspace-wide" label**

Navigate to any workspace. Open the Billing tab. If there are null-property receipts, confirm they appear under "Workspace-wide" (not "Unassigned"). In the batch card property selector, confirm "Workspace-wide" chip appears as the first option.

- [ ] **Step 8: Final screenshot comparison**

```bash
$B screenshot /tmp/billing-final-full.png
```

Read and confirm: summary bar untouched, payment cards with ghost fields, drop zone in intake panel, property groups with "Workspace-wide" label.

---

## Self-Review Checklist

**Spec coverage:**
- [x] Upload-first drop zone — Task 4
- [x] Immediate AI extraction on file drop — Task 4 (`handleFileDrop` fires `analyzeReceiptDraft` per file)
- [x] Bulk parallel processing — Task 4 (concurrent calls, per-file state updates)
- [x] Batch grid review — Task 4 (`BatchCard` component)
- [x] CustomSelect for category — Task 4 (`RECEIPT_CATEGORIES` constant + `<CustomSelect>`)
- [x] DatePickerInput for date — Task 4 (`<DatePickerInput>`)
- [x] Workspace-wide property option — Tasks 3 and 4 (rename + chip)
- [x] ACH grayed placeholder fields — Task 2 (`GhostField` with 4 rows)
- [x] Card grayed placeholder fields — Task 2 (`GhostField` with 4 rows)
- [x] Copy-on-click for ready fields — Task 2 (`CopyableField` with clipboard API)
- [x] Receipt hover preview — Task 4 (`showReceiptPreview`/`hideReceiptPreview` + `position: fixed` popover)
- [x] Inline flash after bulk save — Task 4 (`batchFlash` state, 3s auto-dismiss)
- [x] No new server actions — confirmed, reuses existing `analyzeReceiptDraft` and `createReceipt`
- [x] No DB migrations — confirmed, null `property_id` = Workspace-wide (no schema change)

**Placeholder scan:** No TBDs, TODOs, or vague instructions. Every code block is complete.

**Type consistency:**
- `ProcessingFile.fields` typed as `FileFields` throughout (Tasks 4)
- `onFieldChange` generic signature `<K extends keyof FileFields>(id: string, key: K, value: FileFields[K])` matches usage in `BatchCard`
- `AchPaymentCard` and `CardPaymentCard` import `WorkspaceBillingPaymentMethod` from `@/lib/admin/workspace-billing` — same type used in `BillingTab.tsx`
- `PropertyReceiptGroup` exported from `BillingTab.tsx`, imported in `PropertyBillsSection.tsx` — same as before
