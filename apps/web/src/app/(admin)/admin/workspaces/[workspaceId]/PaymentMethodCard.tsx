"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bank,
  CreditCard,
  Copy,
  Check,
  Eye,
  EyeSlash,
  PaperPlaneTilt,
  Warning,
} from "@phosphor-icons/react";
import type { WorkspaceFinancePaymentMethod, WorkspaceFinanceRequest } from "@/lib/admin/workspace-finance";
import styles from "./FinanceTab.module.css";

type OwnerContact = {
  name: string;
  phone: string | null;
  address: { line1: string; line2: string } | null;
};

type PaymentRequestControls = {
  request: WorkspaceFinanceRequest | null;
  onOpenRequest: () => void;
  onResend: (request: WorkspaceFinanceRequest) => void;
  onCopy: (request: WorkspaceFinanceRequest) => void;
  copiedRequestId: string | null;
};

function CopyRequestButton({
  request,
  onCopy,
  copiedRequestId,
}: {
  request: WorkspaceFinanceRequest;
  onCopy: (request: WorkspaceFinanceRequest) => void;
  copiedRequestId: string | null;
}) {
  return (
    <button type="button" className={styles.paymentSecondaryAction} onClick={() => onCopy(request)}>
      <Copy size={12} weight="bold" />
      {copiedRequestId === request.id ? "Copied" : "Copy link"}
    </button>
  );
}

function PaymentRequestActions({
  request,
  requestLabel,
  onOpenRequest,
  onResend,
  onCopy,
  copiedRequestId,
}: {
  request: WorkspaceFinanceRequest | null;
  requestLabel: string;
  onOpenRequest: () => void;
  onResend: (request: WorkspaceFinanceRequest) => void;
  onCopy: (request: WorkspaceFinanceRequest) => void;
  copiedRequestId: string | null;
}) {
  return (
    <div className={styles.paymentRequestActions}>
      <button type="button" className={styles.sendFormLink} onClick={onOpenRequest}>
        <PaperPlaneTilt size={13} weight="bold" />
        {requestLabel}
      </button>
      {request?.requestUrl ? (
        <CopyRequestButton request={request} onCopy={onCopy} copiedRequestId={copiedRequestId} />
      ) : null}
      {request && request.status !== "cancelled" ? (
        <button type="button" className={styles.paymentSecondaryAction} onClick={() => onResend(request)}>
          Resend
        </button>
      ) : null}
    </div>
  );
}

function methodDisplayName(method: WorkspaceFinancePaymentMethod): string {
  return method.label.replace(/\s+ending\s+\w+$/i, "").trim() || "Payment method";
}

function cardFundingLabel(method: WorkspaceFinancePaymentMethod): string {
  if (method.type === "apple_pay" || method.type === "google_pay" || method.type === "link") {
    return "Wallet";
  }
  if (method.funding === "debit") return "Debit";
  if (method.funding === "credit") return "Credit";
  if (method.funding === "prepaid") return "Prepaid";
  return "Card";
}

function methodStatusLabel(method: WorkspaceFinancePaymentMethod): string {
  return method.isExpiringSoon ? `${method.status}, expiring soon` : method.status;
}

function formatExpiry(expMonth: number | null, expYear: number | null): string {
  if (!expMonth || !expYear) return "•• / ••";
  return `${String(expMonth).padStart(2, "0")} / ${String(expYear).slice(-2)}`;
}

function InlineCopyButton({
  value,
  label,
  dark = false,
  onCopied,
}: {
  value: string | null;
  label: string;
  dark?: boolean;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value as string);
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      return;
    }
  }

  return (
    <button
      type="button"
      className={dark ? styles.paymentFaceInlineCopy : styles.paymentSlipInlineCopy}
      data-copied={copied ? "true" : undefined}
      onClick={handleCopy}
      aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
      title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
    >
      {copied ? <Check size={10} weight="bold" /> : <Copy size={10} weight="bold" />}
    </button>
  );
}

function RevealButton({
  isRevealed,
  onToggle,
  dark = true,
}: {
  isRevealed: boolean;
  onToggle: () => void;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      className={dark ? styles.paymentFaceToggle : styles.paymentFaceToggleLight}
      onClick={onToggle}
      aria-label={isRevealed ? "Hide details" : "Show details"}
      title={isRevealed ? "Hide details" : "Show details"}
    >
      {isRevealed ? <EyeSlash size={14} weight="bold" /> : <Eye size={14} weight="bold" />}
    </button>
  );
}

function CardPaymentFace({
  isRevealed,
  method,
  ownerContact,
  onToggle,
}: {
  isRevealed: boolean;
  method: WorkspaceFinancePaymentMethod;
  ownerContact?: OwnerContact;
  onToggle: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const name = methodDisplayName(method);
  const numberDisplay = isRevealed
    ? (method.displayNumber ?? (method.last4 ? `Card ending ${method.last4}` : "Card details secured"))
    : (method.last4 ? `•••• •••• •••• ${method.last4}` : "•••• •••• •••• ••••");
  const expiryDisplay = isRevealed ? formatExpiry(method.expMonth, method.expYear) : "•• / ••";
  const holderName = ownerContact?.name.toUpperCase() ?? "";

  function markCopied(field: string) {
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1500);
  }

  const numberCopyValue = isRevealed ? (method.displayNumber ?? null) : null;
  const expiryCopyValue =
    isRevealed && method.expMonth && method.expYear
      ? `${String(method.expMonth).padStart(2, "0")}/${String(method.expYear).slice(-2)}`
      : null;

  return (
    <div className={styles.paymentFaceCard}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/card-front.svg" alt="" aria-hidden="true" className={styles.paymentFaceBg} />

      <div className={styles.paymentFaceTop}>
        <div className={styles.paymentFaceTopLeft}>
          <span>{name}</span>
          <b>{cardFundingLabel(method)}</b>
        </div>
        <RevealButton isRevealed={isRevealed} onToggle={onToggle} />
      </div>

      <div className={styles.paymentFaceChipNameRow}>
        <div className={styles.paymentFaceChip} aria-hidden="true" />
        {holderName ? (
          <span className={styles.paymentFaceHolderLarge}>{holderName}</span>
        ) : null}
      </div>

      <div
        className={`${styles.paymentFaceNumberRow}${copiedField === "number" ? ` ${styles.cardFieldCopied}` : ""}`}
      >
        <span className={styles.paymentFaceNumber}>{numberDisplay}</span>
        <InlineCopyButton
          value={numberCopyValue}
          label="Card number"
          dark
          onCopied={() => markCopied("number")}
        />
      </div>

      <div className={styles.paymentFaceExpiry}>
        <div
          className={`${styles.paymentFaceExpiryField}${copiedField === "expiry" ? ` ${styles.cardFieldCopied}` : ""}`}
        >
          <span className={styles.paymentFaceExpiryLabel}>Good thru</span>
          <div className={styles.paymentFaceExpiryValueRow}>
            <span className={styles.paymentFaceExpiryValue}>{expiryDisplay}</span>
            <InlineCopyButton
              value={expiryCopyValue}
              label="Expiry"
              dark
              onCopied={() => markCopied("expiry")}
            />
          </div>
        </div>
        <div className={`${styles.paymentFaceExpiryField} ${styles.paymentFaceExpiryCvv}`}>
          <span className={styles.paymentFaceExpiryLabel} title="CVV not available after card is saved">CVV</span>
          <div className={styles.paymentFaceExpiryValueRow}>
            <span className={styles.paymentFaceExpiryValue}>•••</span>
            <button
              type="button"
              className={styles.paymentFaceInlineCopyDisabled}
              disabled
              title="CVV not available after card is saved"
              aria-label="CVV not available"
            >
              <Copy size={10} weight="bold" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AchBankSlipFace({
  isRevealed,
  method,
  ownerContact,
  onToggle,
}: {
  isRevealed: boolean;
  method: WorkspaceFinancePaymentMethod;
  ownerContact: OwnerContact;
  onToggle: () => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const bankName = methodDisplayName(method);

  const routingDisplay = method.routingNumber
    ? isRevealed
      ? method.routingNumber
      : `•••••${method.routingNumber.slice(-4)}`
    : isRevealed
      ? "Secured"
      : "•••••••••";

  const accountDisplay = isRevealed
    ? (method.displayAccount ?? (method.last4 ? `Ending ${method.last4}` : "Secured"))
    : (method.last4 ? `••••••${method.last4}` : "•••••••••");

  function markCopied(field: string) {
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1500);
  }

  const routingCopyValue = isRevealed ? (method.routingNumber ?? null) : null;
  const accountCopyValue = isRevealed
    ? (method.displayAccount ?? (method.last4 ?? null))
    : null;

  return (
    <div className={styles.paymentBankSlip}>
      <div className={styles.paymentBankSlipHead}>
        <div className={styles.paymentBankSlipHeadLeft}>
          <span className={styles.paymentBankSlipDocType}>Bank debit authorization</span>
          <strong className={styles.paymentBankSlipBankName}>{bankName}</strong>
        </div>
        <div className={styles.paymentBankSlipHeaderRight}>
          {method.isDefault && <b className={styles.paymentBankSlipBadge}>Default</b>}
          <b className={styles.paymentBankSlipBadge}>ACH</b>
          <RevealButton isRevealed={isRevealed} onToggle={onToggle} dark={false} />
        </div>
      </div>

      <div className={styles.paymentBankSlipNumbers}>
        <div
          className={`${styles.paymentBankSlipNumberField}${copiedField === "routing" ? ` ${styles.slipFieldCopied}` : ""}`}
        >
          <span className={styles.paymentBankSlipFieldLabel}>Routing number</span>
          <div className={styles.slipFieldValueRow}>
            <strong className={styles.paymentBankSlipFieldValue}>{routingDisplay}</strong>
            <InlineCopyButton
              value={routingCopyValue}
              label="Routing number"
              onCopied={() => markCopied("routing")}
            />
          </div>
        </div>
        <div
          className={`${styles.paymentBankSlipNumberField}${copiedField === "account" ? ` ${styles.slipFieldCopied}` : ""}`}
        >
          <span className={styles.paymentBankSlipFieldLabel}>Account number</span>
          <div className={styles.slipFieldValueRow}>
            <strong className={styles.paymentBankSlipFieldValue}>{accountDisplay}</strong>
            <InlineCopyButton
              value={accountCopyValue}
              label="Account number"
              onCopied={() => markCopied("account")}
            />
          </div>
        </div>
      </div>

      <div className={styles.paymentBankSlipDivider} />

      <div className={styles.paymentBankSlipContact}>
        <span className={styles.paymentBankSlipContactLabel}>Authorized by</span>
        <div
          className={`${styles.slipContactRow}${copiedField === "name" ? ` ${styles.slipFieldCopied}` : ""}`}
        >
          <strong className={styles.paymentBankSlipContactName}>{ownerContact.name}</strong>
          <InlineCopyButton
            value={ownerContact.name}
            label="Name"
            onCopied={() => markCopied("name")}
          />
        </div>
        {ownerContact.address ? (
          <>
            <div
              className={`${styles.slipContactRow}${copiedField === "address1" ? ` ${styles.slipFieldCopied}` : ""}`}
            >
              <span className={styles.paymentBankSlipContactDetail}>{ownerContact.address.line1}</span>
              <InlineCopyButton
                value={ownerContact.address.line1}
                label="Address"
                onCopied={() => markCopied("address1")}
              />
            </div>
            <div
              className={`${styles.slipContactRow}${copiedField === "address2" ? ` ${styles.slipFieldCopied}` : ""}`}
            >
              <span className={styles.paymentBankSlipContactDetail}>{ownerContact.address.line2}</span>
              <InlineCopyButton
                value={ownerContact.address.line2}
                label="City, state, zip"
                onCopied={() => markCopied("address2")}
              />
            </div>
          </>
        ) : null}
        {ownerContact.phone ? (
          <div
            className={`${styles.slipContactRow}${copiedField === "phone" ? ` ${styles.slipFieldCopied}` : ""}`}
          >
            <span className={styles.paymentBankSlipContactDetail}>{ownerContact.phone}</span>
            <InlineCopyButton
              value={ownerContact.phone}
              label="Phone"
              onCopied={() => markCopied("phone")}
            />
          </div>
        ) : null}
      </div>

      <div className={styles.paymentBankSlipFooter}>
        <span className={styles.paymentBankSlipStatus} data-active={method.status === "active"}>
          {methodStatusLabel(method).toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function EmptyPaymentFace({ kind }: { kind: "ach" | "card" }) {
  if (kind === "ach") {
    return (
      <div className={styles.paymentBankSlipEmpty}>
        <div className={styles.paymentBankSlipHead}>
          <div className={styles.paymentBankSlipHeadLeft}>
            <span className={styles.paymentBankSlipDocType}>Bank debit authorization</span>
            <strong className={styles.paymentBankSlipBankName}>Bank account</strong>
          </div>
          <div className={styles.paymentBankSlipHeaderRight}>
            <b className={styles.paymentBankSlipBadge}>Missing</b>
            <b className={styles.paymentBankSlipBadge}>ACH</b>
          </div>
        </div>
        <div className={styles.paymentBankSlipNumbers}>
          <div className={styles.paymentBankSlipNumberField}>
            <span className={styles.paymentBankSlipFieldLabel}>Routing number</span>
            <div className={styles.slipFieldValueRow}>
              <strong className={styles.paymentBankSlipFieldValue}>•••••••••</strong>
            </div>
          </div>
          <div className={styles.paymentBankSlipNumberField}>
            <span className={styles.paymentBankSlipFieldLabel}>Account number</span>
            <div className={styles.slipFieldValueRow}>
              <strong className={styles.paymentBankSlipFieldValue}>••••••____</strong>
            </div>
          </div>
        </div>
        <div className={styles.paymentBankSlipFooter}>
          <span className={styles.paymentBankSlipStatus}>ACH NEEDED</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.paymentFaceEmptyCard}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/card-front.svg" alt="" aria-hidden="true" className={styles.paymentFaceBg} />
      <div className={styles.paymentFaceTop}>
        <div className={styles.paymentFaceTopLeft}>
          <span>Owner card</span>
          <b>Missing</b>
        </div>
      </div>
      <div className={styles.paymentFaceChipNameRow}>
        <div className={styles.paymentFaceChip} aria-hidden="true" />
      </div>
      <div className={styles.paymentFaceNumberRow}>
        <span className={styles.paymentFaceNumber}>•••• •••• •••• ____</span>
      </div>
      <div className={styles.paymentFaceExpiry}>
        <div className={styles.paymentFaceExpiryField}>
          <span className={styles.paymentFaceExpiryLabel}>Good thru</span>
          <div className={styles.paymentFaceExpiryValueRow}>
            <span className={styles.paymentFaceExpiryValue}>•• / ••</span>
          </div>
        </div>
        <div className={`${styles.paymentFaceExpiryField} ${styles.paymentFaceExpiryCvv}`}>
          <span className={styles.paymentFaceExpiryLabel}>CVV</span>
          <div className={styles.paymentFaceExpiryValueRow}>
            <span className={styles.paymentFaceExpiryValue}>•••</span>
          </div>
        </div>
      </div>
      <div className={styles.paymentFaceFooter}>
        <span>Card needed</span>
      </div>
    </div>
  );
}

function PaymentGroupHeader({
  count,
  icon,
  subtitle,
  title,
}: {
  count: number;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <div className={styles.paymentGroupHeader}>
      <div className={styles.paymentIcon}>{icon}</div>
      <div className={styles.paymentHeaderBody}>
        <div className={styles.paymentLabel}>{title}</div>
        <div className={styles.paymentGroupSubtitle}>{subtitle}</div>
      </div>
      <span className={styles.paymentGroupCount}>{count} on file</span>
    </div>
  );
}

function EmptyPaymentGroup({
  icon,
  requestLabel,
  subtitle,
  title,
  request,
  onOpenRequest,
  onResend,
  onCopy,
  copiedRequestId,
}: {
  icon: ReactNode;
  requestLabel: string;
  subtitle: string;
  title: string;
} & PaymentRequestControls) {
  return (
    <div className={`${styles.paymentCard} ${styles.paymentCardMissing}`}>
      <div className={styles.paymentBody}>
        <PaymentGroupHeader count={0} icon={icon} subtitle={subtitle} title={title} />
        <EmptyPaymentFace kind={title.toLowerCase().includes("ach") ? "ach" : "card"} />
        <div className={styles.paymentCardNotice}>
          <Warning size={12} weight="fill" />
          Required payment method missing
        </div>
        <PaymentRequestActions
          request={request}
          requestLabel={requestLabel}
          onOpenRequest={onOpenRequest}
          onResend={onResend}
          onCopy={onCopy}
          copiedRequestId={copiedRequestId}
        />
      </div>
    </div>
  );
}

function PaymentMethodTile({
  kind,
  method,
  ownerContact,
}: {
  kind: "ach" | "card";
  method: WorkspaceFinancePaymentMethod;
  ownerContact?: OwnerContact;
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const toggle = () => setIsRevealed((v) => !v);

  return (
    <div className={styles.paymentMethodTile} data-kind={kind}>
      {kind === "ach" ? (
        <AchBankSlipFace
          isRevealed={isRevealed}
          method={method}
          ownerContact={ownerContact ?? { name: "Account holder", phone: null, address: null }}
          onToggle={toggle}
        />
      ) : (
        <CardPaymentFace
          isRevealed={isRevealed}
          method={method}
          ownerContact={ownerContact}
          onToggle={toggle}
        />
      )}
    </div>
  );
}

export function AchPaymentCard({
  methods,
  request,
  ownerContact,
  onOpenRequest,
  onResend,
  onCopy,
  copiedRequestId,
}: {
  methods: WorkspaceFinancePaymentMethod[];
  ownerContact: OwnerContact;
} & PaymentRequestControls) {
  if (methods.length === 0) {
    return (
      <EmptyPaymentGroup
        icon={<Bank size={18} weight="duotone" />}
        request={request}
        requestLabel="Request ACH"
        subtitle="Required for owner payouts and bank pulls"
        title="ACH bank accounts"
        onOpenRequest={onOpenRequest}
        onResend={onResend}
        onCopy={onCopy}
        copiedRequestId={copiedRequestId}
      />
    );
  }

  return (
    <div className={`${styles.paymentCard} ${styles.paymentCardReady}`}>
      <div className={styles.paymentBody}>
        <PaymentGroupHeader
          count={methods.length}
          icon={<Bank size={18} weight="duotone" />}
          subtitle="At least one ACH bank account is required"
          title="ACH bank accounts"
        />
        <div className={styles.paymentMethodList}>
          {methods.map((method) => (
            <PaymentMethodTile key={method.id} kind="ach" method={method} ownerContact={ownerContact} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardPaymentCard({
  methods,
  request,
  ownerContact,
  onOpenRequest,
  onResend,
  onCopy,
  copiedRequestId,
}: {
  methods: WorkspaceFinancePaymentMethod[];
  ownerContact?: OwnerContact;
} & PaymentRequestControls) {
  if (methods.length === 0) {
    return (
      <EmptyPaymentGroup
        icon={<CreditCard size={18} weight="duotone" />}
        request={request}
        requestLabel="Request card"
        subtitle="One debit or credit card is required"
        title="Debit and credit cards"
        onOpenRequest={onOpenRequest}
        onResend={onResend}
        onCopy={onCopy}
        copiedRequestId={copiedRequestId}
      />
    );
  }

  return (
    <div className={`${styles.paymentCard} ${styles.paymentCardReady}`}>
      <div className={styles.paymentBody}>
        <PaymentGroupHeader
          count={methods.length}
          icon={<CreditCard size={18} weight="duotone" />}
          subtitle="Debit, credit, and wallet cards are clearly labeled"
          title="Debit and credit cards"
        />
        <div className={styles.paymentMethodList}>
          {methods.map((method) => (
            <PaymentMethodTile key={method.id} kind="card" method={method} ownerContact={ownerContact} />
          ))}
        </div>
      </div>
    </div>
  );
}
