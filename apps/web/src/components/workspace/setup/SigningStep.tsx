"use client";

import { Lock, FileText } from "@phosphor-icons/react";

/**
 * Embedded BoldSign signing chrome.
 * If signUrl is provided, renders an iframe. Otherwise shows "Coming soon".
 */
export function SigningStep({
  signUrl,
  summaryTitle,
  summaryPoints,
}: {
  signUrl: string | null;
  summaryTitle: string;
  summaryPoints: string[];
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* Left: summary */}
      <div
        className="rounded-2xl border p-6"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="flex items-center gap-2">
          <FileText
            size={20}
            weight="duotone"
            style={{ color: "var(--color-brand)" }}
          />
          <h2
            className="text-base font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            {summaryTitle}
          </h2>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5">
          {summaryPoints.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <span
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--color-brand)" }}
              />
              {point}
            </li>
          ))}
        </ul>
      </div>

      {/* Right: iframe or coming soon */}
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        {/* Trust line */}
        <div
          className="flex items-center gap-2 border-b px-4 py-2.5"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <Lock
            size={14}
            weight="fill"
            style={{ color: "var(--color-success)" }}
          />
          <span
            className="text-xs font-medium"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Your document is secured and auditable
          </span>
        </div>

        {signUrl ? (
          <iframe
            src={signUrl}
            title="BoldSign document signing"
            className="h-[600px] w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div
            className="flex h-[400px] flex-col items-center justify-center gap-3"
            style={{ backgroundColor: "var(--color-warm-gray-50)" }}
          >
            <FileText
              size={40}
              weight="duotone"
              style={{ color: "var(--color-text-tertiary)" }}
            />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Document signing coming soon
            </p>
            <p
              className="max-w-xs text-center text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Once your account is fully set up, you will be able to sign
              documents directly in this panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
