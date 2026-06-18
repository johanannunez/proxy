"use client";

import Link from "next/link";
import { ArrowLeft, Clock } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/**
 * Shared wrapper for every setup step page.
 * Provides: back link, eyebrow, title, "why we ask" microcopy,
 * time estimate, and last-updated timestamp.
 */
export function StepShell({
  track,
  stepNumber,
  title,
  whyWeAsk,
  estimateMinutes,
  lastUpdated,
  backHref = "/workspace/setup",
  children,
}: {
  track: "property" | "owner";
  stepNumber: number;
  title: string;
  whyWeAsk: string;
  estimateMinutes: number;
  lastUpdated?: string | null;
  backHref?: string;
  children: ReactNode;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const trackLabel = track === "property" ? "Property setup" : "Owner essentials";
  const trackNum = track === "property" ? "01" : "02";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} weight="bold" />
          Back to setup
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Track {trackNum} · Step {String(stepNumber).padStart(2, "0")}
            </p>
            <span
              className="flex items-center gap-1 text-[11px]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              <Clock size={11} weight="bold" />
              About {estimateMinutes} min
            </span>
          </div>
          <h1
            className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]"
            style={{ color: "var(--color-text-primary)" }}
          >
            {title}
          </h1>
          <p
            className="mt-2 max-w-2xl text-sm"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {whyWeAsk}
          </p>
          {lastUpdated && (
            <p
              className="mt-1.5 text-xs"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Last updated {formatTimestamp(lastUpdated)}
            </p>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
      " at " +
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  } catch {
    return iso;
  }
}

/**
 * Sticky bottom save bar for form steps.
 */
export function StepSaveBar({
  pending,
  onSaveLater,
  isEditing,
}: {
  pending: boolean;
  onSaveLater?: () => void;
  isEditing?: boolean;
}) {
  return (
    <div
      className="sticky bottom-20 z-10 mt-2 flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 lg:bottom-4"
      style={{
        borderColor: "var(--color-warm-gray-200)",
        backgroundColor: "var(--color-white)",
        boxShadow: "0 14px 40px -18px rgba(15, 40, 75, 0.28)",
      }}
    >
      <p
        className="hidden text-[13px] sm:block"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {isEditing ? "Updating saved data." : "Your progress saves automatically."}
      </p>
      <div className="flex items-center gap-3">
        {onSaveLater && (
          <button
            type="button"
            onClick={onSaveLater}
            className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Save and finish later
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {pending ? "Saving..." : "Save and continue"}
        </button>
      </div>
    </div>
  );
}
