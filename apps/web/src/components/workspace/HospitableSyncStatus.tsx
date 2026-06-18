"use client";

import { useState } from "react";
import {
  CaretDown,
  CheckCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import type { PropertyFieldDiff } from "@/lib/hospitable-reconcile";

/**
 * Sync status chip for the property detail page.
 *
 * When `linked` is false, renders nothing (the property isn't connected
 * to a Hospitable listing, so there's nothing to reconcile). When linked
 * and all fields match, renders a compact green pill saying "In sync
 * with Hospitable". When fields drift, renders an amber pill with the
 * drift count, clickable to expand a detail panel that shows the Proxy
 * value and the Hospitable value side by side for each drifting field.
 *
 * Proxy is the source of truth. The panel makes it clear the user's
 * next action is either to update Proxy (if Proxy was wrong) or edit
 * the OTA listing in Hospitable (if the listing was wrong). We don't
 * offer a one-click "pull from Hospitable" button because doing that
 * would let the OTA overwrite Proxy's canonical record.
 */
export function HospitableSyncStatus({
  linked,
  diffs,
  error,
}: {
  linked: boolean;
  diffs: PropertyFieldDiff[];
  error: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!linked) return null;

  if (error) {
    return (
      <div
        className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
          color: "var(--color-text-tertiary)",
        }}
        title={error}
      >
        <WarningCircle size={14} weight="duotone" />
        Hospitable unreachable
      </div>
    );
  }

  const hasDrift = diffs.length > 0;

  if (!hasDrift) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold"
        style={{
          borderColor: "rgba(22, 163, 74, 0.25)",
          backgroundColor: "rgba(22, 163, 74, 0.08)",
          color: "#15803d",
        }}
      >
        <CheckCircle size={14} weight="fill" />
        In sync with Hospitable
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors hover:bg-[rgba(245,158,11,0.12)]"
        style={{
          borderColor: "rgba(245, 158, 11, 0.35)",
          backgroundColor: "rgba(245, 158, 11, 0.08)",
          color: "#b45309",
        }}
      >
        <WarningCircle size={14} weight="fill" />
        {diffs.length} {diffs.length === 1 ? "field" : "fields"} drift from Hospitable
        <CaretDown
          size={11}
          weight="bold"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms ease-out",
          }}
        />
      </button>

      {open ? (
        <div
          role="region"
          aria-label="Hospitable sync details"
          className="mt-2 flex min-w-[340px] flex-col gap-3 rounded-xl border p-4 shadow-[0_14px_40px_-18px_rgba(15,40,75,0.22)]"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            backgroundColor: "var(--color-white)",
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Proxy is the source of truth
          </p>
          <p
            className="text-[12.5px] leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Edit Proxy&apos;s record if we captured it wrong, or update the
            listing inside Hospitable if the OTA side is wrong. Fix the one
            that&apos;s actually incorrect.
          </p>

          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--color-warm-gray-200)" }}
          >
            <div
              className="grid grid-cols-[1fr_1fr_1fr] text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                backgroundColor: "var(--color-warm-gray-50)",
                color: "var(--color-text-tertiary)",
              }}
            >
              <div className="px-3 py-2">Field</div>
              <div className="px-3 py-2">Proxy</div>
              <div className="px-3 py-2">Hospitable</div>
            </div>
            {diffs.map((diff) => (
              <div
                key={diff.field}
                className="grid grid-cols-[1fr_1fr_1fr] items-center border-t text-[12.5px]"
                style={{
                  borderColor: "var(--color-warm-gray-100)",
                }}
              >
                <div
                  className="px-3 py-2.5 font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {diff.label}
                </div>
                <div
                  className="px-3 py-2.5"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {diff.proxyValue}
                </div>
                <div
                  className="flex items-center gap-1.5 px-3 py-2.5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {diff.hospitableValue}
                  {diff.kind === "unmappable" ? (
                    <span
                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]"
                      style={{
                        backgroundColor: "rgba(245, 158, 11, 0.12)",
                        color: "#b45309",
                      }}
                      title="Hospitable's taxonomy has no direct equivalent for this Proxy value."
                    >
                      No match
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
