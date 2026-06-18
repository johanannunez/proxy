"use client";

import { useState } from "react";
import { Bank, CreditCard } from "@phosphor-icons/react";
import { SigningStep } from "@/components/workspace/setup/SigningStep";

type PayoutMethod = "ach" | "card";

/* eslint-disable @typescript-eslint/no-unused-vars */
export function PayoutForm({
  userEmail,
  userName,
  hasBoldSignKey,
}: {
  userEmail: string;
  userName: string;
  hasBoldSignKey: boolean;
}) { /* eslint-enable @typescript-eslint/no-unused-vars */
  const [method, setMethod] = useState<PayoutMethod>("ach");

  // BoldSign signing URLs will be generated server-side once
  // BOLDSIGN_API_KEY is configured and the documents spine row exists.
  // For now, always show the placeholder.
  const signUrl: string | null = null;

  const summaryPoints =
    method === "ach"
      ? [
          "Direct deposit to your bank account",
          "Payouts arrive in 2 to 3 business days",
          "Requires routing and account numbers",
          "Most popular option for owners",
        ]
      : [
          "Authorize charges on a card",
          "Used for initial setup fees if applicable",
          "Card details stored securely",
          "Can be updated anytime",
        ];

  return (
    <div className="flex flex-col gap-6">
      {/* Method picker */}
      <div
        className="rounded-2xl border p-6"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <h2
          className="mb-4 text-base font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Choose your payout method
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MethodCard
            active={method === "ach"}
            onClick={() => setMethod("ach")}
            icon={<Bank size={20} weight="duotone" />}
            title="ACH Direct Deposit"
            description="Funds go straight to your bank."
          />
          <MethodCard
            active={method === "card"}
            onClick={() => setMethod("card")}
            icon={<CreditCard size={20} weight="duotone" />}
            title="Card Authorization"
            description="Authorize a card on file."
          />
        </div>
      </div>

      {/* Signing step */}
      <SigningStep
        signUrl={signUrl}
        summaryTitle={
          method === "ach" ? "ACH Authorization" : "Card Authorization"
        }
        summaryPoints={summaryPoints}
      />
    </div>
  );
}

function MethodCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors"
      style={{
        borderColor: active ? "var(--color-brand)" : "var(--color-warm-gray-200)",
        backgroundColor: active ? "rgba(2, 170, 235, 0.04)" : "var(--color-white)",
        boxShadow: active ? "0 0 0 1px var(--color-brand) inset" : "none",
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: active ? "rgba(2, 170, 235, 0.12)" : "var(--color-warm-gray-50)",
          color: active ? "var(--color-brand)" : "var(--color-text-tertiary)",
        }}
      >
        {icon}
      </span>
      <div>
        <span
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block text-[13px]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {description}
        </span>
      </div>
    </button>
  );
}
