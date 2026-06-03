"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, WarningCircle } from "@phosphor-icons/react";

/**
 * Route-level error boundary for /portal/properties/[id].
 *
 * When the detail page throws during render (bad data, slow Hospitable
 * fetch that throws, malformed row, client-side crash), Next.js catches
 * it at this boundary and renders the fallback below instead of
 * crashing the entire portal layout. The sidebar, the AppBar, and
 * everything else outside this segment stays functional so the user
 * can click away to another page and recover.
 *
 * `reset` is provided by Next and re-attempts the segment render. Click
 * handler wires it up so the user can retry without a full page reload.
 */
export default function PropertyDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in the dev console and in prod logs. We don't
    // have a telemetry layer plugged in yet; once we do, this is where
    // we'd forward to it.
    console.error("[property-detail] render error", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/workspace/properties"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} weight="bold" />
        Back to properties
      </Link>

      <div
        className="flex flex-col gap-5 rounded-2xl border p-8"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "rgba(220, 38, 38, 0.10)",
            color: "#b91c1c",
          }}
        >
          <WarningCircle size={22} weight="duotone" />
        </span>

        <div className="flex flex-col gap-2">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Something went sideways
          </p>
          <h2
            className="text-[22px] font-semibold leading-tight tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            We couldn&apos;t render this property right now.
          </h2>
          <p
            className="max-w-xl text-[13.5px] leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            The rest of the portal is still working. Try again in a second,
            or head back to your properties list and open a different one
            while we sort this out. If it keeps happening, send the error
            digest below to support.
          </p>
          {error.digest ? (
            <p
              className="mt-1 rounded-md border px-3 py-1.5 text-[11px] font-medium tabular-nums"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                backgroundColor: "var(--color-warm-gray-50)",
                color: "var(--color-text-tertiary)",
              }}
            >
              digest: {error.digest}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            Try again
          </button>
          <Link
            href="/workspace/properties"
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-warm-gray-50)]"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-primary)",
            }}
          >
            Back to properties
          </Link>
        </div>
      </div>
    </div>
  );
}
