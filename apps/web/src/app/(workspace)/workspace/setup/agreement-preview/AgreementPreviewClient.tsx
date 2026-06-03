"use client";

import { useActionState } from "react";
import {
  ArrowRight,
  CheckCircle,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react";
import { acknowledgeAgreement, type AcknowledgeState } from "./actions";

const initialState: AcknowledgeState = {};

export function AgreementPreviewClient({
  propertyId,
  acknowledgedAt,
}: {
  propertyId: string;
  acknowledgedAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    acknowledgeAgreement,
    initialState,
  );

  return (
    <>
      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{
            borderColor: "#f1c4c4",
            backgroundColor: "#fdf4f4",
            color: "#8a1f1f",
          }}
        >
          <WarningCircle size={18} weight="fill" style={{ color: "#c0372a" }} />
          <span>{state.error}</span>
        </div>
      ) : null}

      {acknowledgedAt ? (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{
            borderColor: "rgba(22, 163, 74, 0.3)",
            backgroundColor: "rgba(22, 163, 74, 0.04)",
            color: "#15803d",
          }}
        >
          <CheckCircle size={18} weight="fill" />
          <span>
            Acknowledged on{" "}
            {new Date(acknowledgedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="property_id" value={propertyId} />
        <div
          className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
            boxShadow: "0 14px 40px -18px rgba(15, 40, 75, 0.28)",
          }}
        >
          <a
            href="/legal/host-rental-agreement-v3.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <FileText size={16} weight="duotone" />
            Read the full agreement
          </a>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {pending
              ? "Saving..."
              : acknowledgedAt
                ? "Re-acknowledge"
                : "This looks good, keep going"}
            <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </form>
    </>
  );
}
