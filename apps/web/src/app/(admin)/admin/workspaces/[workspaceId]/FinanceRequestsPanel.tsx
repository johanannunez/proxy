"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  PaperPlaneTilt,
  X,
} from "@phosphor-icons/react";
import { CustomSelect } from "@/components/admin/CustomSelect";
import type { SelectOption } from "@/components/admin/CustomSelect";
import type {
  FinanceRequestDeliveryMethod,
  FinanceRequestType,
  WorkspaceFinance,
  WorkspaceFinancePaymentMethod,
  WorkspaceFinanceRequest,
} from "@/lib/admin/workspace-finance";
import {
  createFinanceRequest,
  resendFinanceRequest,
} from "./financials-actions";
import { AchPaymentCard, CardPaymentCard } from "./PaymentMethodCard";
import styles from "./FinanceTab.module.css";

type FinanceRequestsPanelProps = {
  finance: WorkspaceFinance;
  contactId: string;
  ownerId: string | null;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerAddress: { line1: string; line2: string } | null;
  workspaceId: string;
};

const REQUEST_TYPE_OPTIONS: SelectOption[] = [
  { value: "ach_authorization", label: "ACH authorization" },
  { value: "card_authorization", label: "Card authorization" },
];

const DELIVERY_OPTIONS: SelectOption[] = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

const REQUEST_LABELS: Record<"ach_authorization" | "card_authorization", string> = {
  ach_authorization: "ACH authorization",
  card_authorization: "Card authorization",
};

function latestRequest(
  requests: WorkspaceFinanceRequest[],
  type: FinanceRequestType,
): WorkspaceFinanceRequest | null {
  return requests.find((request) => request.requestType === type) ?? null;
}

function defaultMessage(args: {
  ownerName: string;
  requestType: "ach_authorization" | "card_authorization";
  requestUrl: string;
}): string {
  const firstName = args.ownerName.split(" ")[0] || "there";
  if (args.requestType === "ach_authorization") {
    return `Hi ${firstName}, we need your ACH authorization so Proxy can finish finance setup for your workspace.\n\nPlease use this secure link when you have a moment:\n${args.requestUrl}`;
  }
  return `Hi ${firstName}, we need a card authorization on file for owner approved charges and finance setup.\n\nPlease use this secure link when you have a moment:\n${args.requestUrl}`;
}

function buildRequestUrl(type: FinanceRequestType): string {
  if (typeof window === "undefined") return "/workspace/finances";
  return `${window.location.origin}/workspace/finances?request=${type}`;
}

function isCardMethod(method: WorkspaceFinancePaymentMethod): boolean {
  return method.type === "card"
    || method.type === "apple_pay"
    || method.type === "google_pay"
    || method.type === "link";
}

export function FinanceRequestsPanel({
  finance,
  contactId,
  ownerId,
  ownerName,
  ownerEmail,
  ownerPhone,
  ownerAddress,
  workspaceId,
}: FinanceRequestsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [composerType, setComposerType] = useState<"ach_authorization" | "card_authorization" | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<FinanceRequestDeliveryMethod>("email");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPaymentSectionOpen, setIsPaymentSectionOpen] = useState(true);

  const achMethods = finance.paymentMethods.filter((method) => method.type === "us_bank_account");
  const cardMethods = finance.paymentMethods.filter(isCardMethod);
  const hasAch = achMethods.length > 0;
  const hasCard = cardMethods.length > 0;
  const requests = finance.financeRequests;
  const achRequest = latestRequest(requests, "ach_authorization");
  const cardRequest = latestRequest(requests, "card_authorization");

  useEffect(() => {
    if (!statusMessage) return undefined;
    const timeout = window.setTimeout(() => setStatusMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  function openComposer(type: "ach_authorization" | "card_authorization") {
    const requestUrl = buildRequestUrl(type);
    setComposerType(type);
    setDeliveryMethod(ownerEmail ? "email" : "sms");
    setMessage(defaultMessage({ ownerName, requestType: type, requestUrl }));
    setStatusMessage(null);
  }

  function submitRequest() {
    if (!composerType) return;
    const requestUrl = buildRequestUrl(composerType);
    startTransition(async () => {
      const result = await createFinanceRequest({
        workspaceId,
        contactId,
        ownerId,
        requestType: composerType,
        deliveryMethod,
        message,
        requestUrl,
      });
      setStatusMessage(result.message);
      if (result.ok) {
        setComposerType(null);
        router.refresh();
      }
    });
  }

  function resendRequest(request: WorkspaceFinanceRequest) {
    startTransition(async () => {
      const result = await resendFinanceRequest({ workspaceId, ownerId, requestId: request.id });
      setStatusMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  async function copyRequest(request: WorkspaceFinanceRequest) {
    if (!request.requestUrl) return;
    await navigator.clipboard.writeText(request.requestUrl);
    setCopiedId(request.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <section className={styles.financeCommandCenter} aria-label="Payment readiness">
      {statusMessage ? (
        <div className={styles.financeToast} role="status" aria-live="polite">
          <CheckCircle size={15} weight="fill" />
          {statusMessage}
        </div>
      ) : null}

      <div className={styles.paymentSection}>
        <button
          type="button"
          className={styles.paymentSectionToggle}
          aria-expanded={isPaymentSectionOpen}
          aria-controls="workspace-payment-methods"
          onClick={() => setIsPaymentSectionOpen((current) => !current)}
        >
          <span className={styles.paymentSectionToggleIcon}>
            {isPaymentSectionOpen ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}
          </span>
          <span className={styles.paymentSectionToggleBody}>
            <strong>Payment details</strong>
            <span>ACH accounts, debit cards, credit cards, and wallet cards</span>
          </span>
          <span className={hasAch && hasCard ? styles.paymentSectionToggleReady : styles.paymentSectionToggleMeta}>
            {hasAch && hasCard ? "Ready" : "Needs setup"}
          </span>
        </button>

        {isPaymentSectionOpen ? (
          <div className={styles.paymentGrid} id="workspace-payment-methods">
            <AchPaymentCard
              methods={achMethods}
              request={achRequest}
              ownerContact={{ name: ownerName, phone: ownerPhone ?? null, address: ownerAddress }}
              onOpenRequest={() => openComposer("ach_authorization")}
              onResend={resendRequest}
              onCopy={copyRequest}
              copiedRequestId={copiedId}
            />
            <CardPaymentCard
              methods={cardMethods}
              request={cardRequest}
              ownerContact={{ name: ownerName, phone: ownerPhone ?? null, address: ownerAddress }}
              onOpenRequest={() => openComposer("card_authorization")}
              onResend={resendRequest}
              onCopy={copyRequest}
              copiedRequestId={copiedId}
            />
          </div>
        ) : null}
      </div>

      {composerType ? (
        <div className={styles.financeDrawerLayer} role="presentation">
          <button
            type="button"
            className={styles.financeDrawerBackdrop}
            aria-label="Close request composer"
            onClick={() => setComposerType(null)}
          />
          <section className={styles.financeDrawer} role="dialog" aria-modal="true" aria-label="Finance request composer">
            <div className={styles.financeDrawerHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Request composer</span>
                <h3>{REQUEST_LABELS[composerType]}</h3>
              </div>
              <button type="button" className={styles.iconOnlyButton} onClick={() => setComposerType(null)} aria-label="Close composer">
                <X size={14} weight="bold" />
              </button>
            </div>
            <div className={styles.financeDrawerFields}>
              <div className={styles.field}>
                <span>Request type</span>
                <CustomSelect
                  value={composerType}
                  onChange={(value) => openComposer(value as "ach_authorization" | "card_authorization")}
                  options={REQUEST_TYPE_OPTIONS}
                />
              </div>
              <div className={styles.field}>
                <span>Delivery</span>
                <CustomSelect
                  value={deliveryMethod}
                  onChange={(value) => setDeliveryMethod(value as FinanceRequestDeliveryMethod)}
                  options={DELIVERY_OPTIONS}
                />
              </div>
              <label className={styles.field}>
                <span>Message preview</span>
                <textarea
                  className={styles.textArea}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={9}
                />
              </label>
              <div className={styles.financeDrawerPreview}>
                <strong>Request link</strong>
                <span>{buildRequestUrl(composerType)}</span>
              </div>
            </div>
            <div className={styles.financeDrawerActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setComposerType(null)}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} onClick={submitRequest} disabled={isPending}>
                <PaperPlaneTilt size={14} weight="bold" />
                {isPending ? "Sending..." : "Send request"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
