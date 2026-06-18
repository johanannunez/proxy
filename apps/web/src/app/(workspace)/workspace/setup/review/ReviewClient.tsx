"use client";

import { useActionState } from "react";
import { Rocket, WarningCircle, Confetti } from "@phosphor-icons/react";
import { submitForReview, type SubmitReviewState } from "./actions";

const initialState: SubmitReviewState = {};

export function ReviewSubmitBar({
  propertyId,
  allComplete,
  completedCount,
  totalCount,
  isSubmitted,
}: {
  propertyId: string;
  allComplete: boolean;
  completedCount: number;
  totalCount: number;
  isSubmitted: boolean;
}) {
  const [state, formAction, pending] = useActionState(submitForReview, initialState);

  if (isSubmitted) {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border p-10"
        style={{
          borderColor: "rgba(22, 163, 74, 0.3)",
          backgroundColor: "rgba(22, 163, 74, 0.04)",
        }}
      >
        <Confetti size={40} weight="duotone" style={{ color: "#16a34a" }} />
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Submitted for review!
        </h2>
        <p
          className="max-w-md text-center text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Your property is in our review queue. We will reach out within 1 to 2
          business days to schedule your kickoff call.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="property_id" value={propertyId} />

      {state.error ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
          style={{ borderColor: "#f1c4c4", backgroundColor: "#fdf4f4", color: "#8a1f1f" }}
        >
          <WarningCircle size={18} weight="fill" style={{ color: "#c0372a" }} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div
        className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border px-5 py-4"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          boxShadow: "0 14px 40px -18px rgba(15, 40, 75, 0.28)",
        }}
      >
        <p
          className="text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {allComplete
            ? "Everything looks good. Ready to submit!"
            : `${completedCount} of ${totalCount} sections complete. Fill in the rest to submit.`}
        </p>
        <button
          type="submit"
          disabled={!allComplete || pending}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <Rocket size={16} weight="fill" />
          {pending ? "Submitting..." : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
