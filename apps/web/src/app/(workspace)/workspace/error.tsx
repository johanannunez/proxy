"use client";

import { useEffect } from "react";
import { WarningCircle, ArrowClockwise } from "@phosphor-icons/react";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface so it shows up in browser devtools and any future error
    // tracker (Sentry, Vercel logs).
    console.error("[portal] error boundary caught:", error);
  }, [error]);

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border px-8 py-16 text-center"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-warm-gray-200)",
      }}
    >
      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: "rgba(220, 38, 38, 0.10)",
          color: "#b91c1c",
        }}
      >
        <WarningCircle size={26} weight="duotone" />
      </span>
      <h2
        className="mt-5 text-lg font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Something went sideways.
      </h2>
      <p
        className="mt-2 max-w-md text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        We could not load this page. The issue has been logged. Try again, or
        head back to the dashboard.
      </p>
      {error.digest ? (
        <p
          className="mt-2 font-mono text-[11px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Reference: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        <ArrowClockwise size={14} weight="bold" />
        Try again
      </button>
    </div>
  );
}
