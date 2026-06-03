import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bathtub,
  Bed,
  Broom,
  Camera,
  CheckCircle,
  Couch,
  ForkKnife,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkle,
  Sun,
  TShirt,
  Thermometer,
  WarningOctagon,
} from "@phosphor-icons/react/dist/ssr";
import { DownloadButton } from "./DownloadButton";
import { MODULES, TOTAL_ITEMS, type ChecklistModuleSlug } from "./modules";

export const metadata: Metadata = { title: "Cleaning checklist" };

/**
 * Master cleaning checklist owners use if they are turning over the
 * home themselves (owner stay flow, they opt out of Proxy cleaning).
 *
 * Content lives in `./modules.ts` as pure data so it's also consumed
 * by `scripts/build-checklist-pdf.tsx` to generate the downloadable
 * PDF. Single source of truth: when the checklist changes, edit the
 * data file, re-run `pnpm --filter web gen:checklist-pdf`, and both
 * the page and the PDF stay in sync.
 */

/** Icon per module slug, rendered on the on-screen page. */
const MODULE_ICONS: Record<ChecklistModuleSlug, ReactNode> = {
  "pre-clean": <Camera size={16} weight="duotone" />,
  "full-clean-misses": <Sparkle size={16} weight="duotone" />,
  "damaged-items": <WarningOctagon size={16} weight="duotone" />,
  laundry: <TShirt size={16} weight="duotone" />,
  restock: <CheckCircle size={16} weight="duotone" />,
  interior: <Broom size={16} weight="duotone" />,
  kitchen: <ForkKnife size={16} weight="duotone" />,
  bathrooms: <Bathtub size={16} weight="duotone" />,
  bedrooms: <Bed size={16} weight="duotone" />,
  living: <Couch size={16} weight="duotone" />,
  entry: <MapPin size={16} weight="duotone" />,
  outdoor: <Sun size={16} weight="duotone" />,
  photos: <Camera size={16} weight="duotone" />,
  final: <ShieldCheck size={16} weight="duotone" />,
};

export default function CleaningChecklistPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-16">
      {/* Top row: back link + download button */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/workspace/reserve"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <ArrowLeft size={14} weight="bold" />
          Back to Reserve
        </Link>
        <DownloadButton />
      </div>

      {/* Intro card */}
      <div
        className="flex flex-col gap-4 rounded-2xl border p-6"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <div className="flex items-start gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: "rgba(2, 170, 235, 0.10)",
              color: "var(--color-brand)",
            }}
          >
            <Sparkle size={20} weight="duotone" />
          </span>
          <div className="flex flex-col gap-1.5">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Turnover standards
            </p>
            <h2
              className="text-[20px] font-semibold leading-tight tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              The same standards our cleaning team follows.
            </h2>
            <p
              className="text-[13.5px] leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              If you&apos;re turning the home over yourself between guests,
              this is every step we expect a Proxy property to pass before
              the next check-in. {TOTAL_ITEMS} items across {MODULES.length}{" "}
              modules. Some only apply to certain homes — those are marked
              with an &quot;only if&quot; pill. For a clean printable copy,
              tap <strong>Download PDF</strong> at the top.
            </p>
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-3 border-t pt-4"
          style={{ borderColor: "var(--color-warm-gray-200)" }}
        >
          <span
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <CheckCircle size={13} weight="duotone" />
            {TOTAL_ITEMS} items
          </span>
          <span
            className="text-[12px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            •
          </span>
          <span
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <Lock size={13} weight="duotone" />
            Last step is always a locked-door photo
          </span>
          <span
            className="text-[12px]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            •
          </span>
          <span
            className="flex items-center gap-1.5 text-[12px] font-medium"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            <Thermometer size={13} weight="duotone" />
            Thermostat reset to 70°F
          </span>
        </div>
      </div>

      {/* Modules */}
      {MODULES.map((module, i) => (
        <section
          key={module.id}
          className="flex flex-col gap-3 rounded-2xl border p-5"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
          }}
        >
          <header className="flex items-start gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.08)",
                color: "var(--color-brand)",
              }}
            >
              {MODULE_ICONS[module.id]}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.12em] tabular-nums"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  className="text-[16px] font-semibold leading-tight tracking-tight"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {module.title}
                </h3>
              </div>
              <p
                className="text-[12.5px]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {module.subtitle}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-tertiary)",
                backgroundColor: "var(--color-warm-gray-50)",
              }}
            >
              {module.items.length}
            </span>
          </header>
          <ul className="flex flex-col gap-2 pl-[48px]">
            {module.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-lg border px-3 py-2.5"
                style={{
                  backgroundColor: "var(--color-warm-gray-50)",
                  borderColor: "var(--color-warm-gray-200)",
                }}
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border"
                  style={{
                    borderColor: "var(--color-warm-gray-300)",
                    backgroundColor: "var(--color-white)",
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className="text-[13.5px] leading-snug"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {item.text}
                  </span>
                  {item.onlyIf ? (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        borderColor: "rgba(2, 170, 235, 0.28)",
                        backgroundColor: "rgba(2, 170, 235, 0.06)",
                        color: "var(--color-brand)",
                      }}
                    >
                      only if {item.onlyIf}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
