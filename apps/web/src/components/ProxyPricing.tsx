"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import NumberFlow from "@number-flow/react";
import { ArrowSquareOut, Check, Phone, Quotes, Star, TrendUp } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type BillingPlan = "monthly" | "annually";
type TierId = "starter" | "operator" | "scale";

type Tier = {
  id: TierId;
  name: string;
  label: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  cta: string;
  href: string;
  highlighted: boolean;
  badge?: string;
  features: string[];
  additionalFeatures?: string[];
};

type ComparisonRow = {
  category: string;
  feature: string;
  starter: string;
  operator: string;
  scale: string;
};

type Review = {
  quote: string;
  name: string;
  detail: string;
  metric: string;
};

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    label: "For focused teams",
    tagline: "For independent operators building a clean operating base.",
    monthlyPrice: 55,
    annualPrice: 495,
    cta: "Get started",
    href: "/signup?plan=starter",
    highlighted: false,
    features: [
      "Includes 1 internal team member",
      "Up to 10 properties",
      "Core workspace for tasks, timeline, calendar",
      "Owner portal and monthly owner reports",
      "5 e-signatures per month",
      "10 GB document storage",
    ],
  },
  {
    id: "operator",
    name: "Operator",
    label: "Most popular",
    tagline: "For growing teams that need owner, document, and finance control.",
    monthlyPrice: 145,
    annualPrice: 1305,
    cta: "Get started",
    href: "/signup?plan=operator",
    highlighted: true,
    badge: "Best fit",
    features: [
      "Includes 3 internal team members",
      "+ $45/mo per additional team member",
      "Up to 50 properties",
      "Advanced financials with treasury and payouts",
      "Unlimited e-signatures",
      "50 GB document storage",
    ],
    additionalFeatures: [
      "Prospect pipeline",
      "Vendor management",
      "Guest Pulse analytics",
      "Document templates",
      "Priority support",
      "Client permission controls",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    label: "For full portfolios",
    tagline: "For established operators standardizing work across every team.",
    monthlyPrice: 295,
    annualPrice: 2655,
    cta: "Get started",
    href: "/signup?plan=scale",
    highlighted: false,
    features: [
      "Includes 6 internal team members",
      "+ $39/mo per additional team member",
      "Unlimited properties",
      "White-label owner portal",
      "Unlimited document templates",
      "250 GB document storage",
    ],
    additionalFeatures: [
      "API and custom integrations",
      "Audit logs",
      "Dedicated success manager",
      "SLA guarantee",
      "Advanced roles",
      "Roadmap input",
    ],
  },
];

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    category: "Portfolio",
    feature: "Properties managed",
    starter: "Up to 10",
    operator: "Up to 50",
    scale: "Unlimited",
  },
  {
    category: "Team",
    feature: "Included team members",
    starter: "1",
    operator: "3",
    scale: "6",
  },
  {
    category: "Team",
    feature: "Additional team members",
    starter: "Not available",
    operator: "$45/mo each",
    scale: "$39/mo each",
  },
  {
    category: "Documents",
    feature: "Document storage",
    starter: "10 GB",
    operator: "50 GB",
    scale: "250 GB",
  },
  {
    category: "Documents",
    feature: "E-signatures",
    starter: "5 per month",
    operator: "Unlimited",
    scale: "Unlimited",
  },
  {
    category: "Financials",
    feature: "Owner reporting",
    starter: "Monthly reports",
    operator: "Advanced reports",
    scale: "Advanced reports",
  },
  {
    category: "Financials",
    feature: "Treasury and payouts",
    starter: "Basic tracking",
    operator: "Included",
    scale: "Included",
  },
  {
    category: "Automation",
    feature: "Prospect pipeline",
    starter: "Basic",
    operator: "Included",
    scale: "Included",
  },
  {
    category: "Automation",
    feature: "API and integrations",
    starter: "Core sync",
    operator: "Marketplace tools",
    scale: "Custom integrations",
  },
  {
    category: "Support",
    feature: "Support level",
    starter: "Email",
    operator: "Priority",
    scale: "Dedicated manager",
  },
  {
    category: "Security",
    feature: "Permissions and audit logs",
    starter: "Basic roles",
    operator: "Client permissions",
    scale: "Advanced roles and logs",
  },
];

const REVIEWS: Review[] = [
  {
    quote:
      "The biggest win is getting owners, payments, documents, and team follow-up into one rhythm instead of chasing updates across five tools.",
    name: "Composite operator theme",
    detail: "Growing short-term rental portfolio",
    metric: "Cleaner owner communication",
  },
  {
    quote:
      "We needed something that felt more operational than a channel manager. The value is knowing what changed, who owns it, and what still needs review.",
    name: "Composite operations theme",
    detail: "Multi-property management team",
    metric: "Fewer dropped tasks",
  },
  {
    quote:
      "The pricing makes sense when it replaces scattered spreadsheets, status calls, document folders, and manual owner reporting in one place.",
    name: "Composite finance theme",
    detail: "Finance and owner reporting workflow",
    metric: "Faster monthly close",
  },
];

const BILLING_OPTIONS: Array<{
  id: BillingPlan;
  label: string;
  badge?: string;
}> = [
  { id: "annually", label: "Annual", badge: "25% off" },
  { id: "monthly", label: "Monthly" },
];

const WAVE_LINES = Array.from({ length: 24 }, (_, index) => index);

function getDisplayPrice(tier: Tier, billing: BillingPlan) {
  if (billing === "monthly") {
    return tier.monthlyPrice;
  }

  return Math.round(tier.annualPrice / 12);
}

function getBillingCaption(tier: Tier, billing: BillingPlan) {
  if (billing === "monthly") {
    return "Billed monthly";
  }

  return `$${tier.annualPrice.toLocaleString()} billed annually`;
}

function ComparisonValue({ value, highlighted }: { value: string; highlighted?: boolean }) {
  const isIncluded = value === "Included" || value === "Unlimited";

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-sm font-medium",
        highlighted
          ? "bg-[#fff8e4] text-[#7a5710]"
          : isIncluded
            ? "bg-[#e9f7ef] text-[#17613a]"
            : "bg-[#f4f1ec] text-[#425466]"
      )}
    >
      {value}
    </span>
  );
}

function WaveBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#06162a]"
      style={{
        "--wave-x": "50%",
        "--wave-y": "18%",
        "--wave-drift-a": "0px",
        "--wave-drift-b": "0px",
      } as React.CSSProperties}
      data-wave-background
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_var(--wave-x)_var(--wave-y),rgba(143,216,246,0.22),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(216,170,49,0.12),transparent_28%),linear-gradient(180deg,#06162a_0%,#0b2036_46%,#071727_100%)] transition-[background] duration-300" />
      <svg
        className="absolute inset-0 h-full w-full opacity-80"
        viewBox="0 0 1440 1600"
        preserveAspectRatio="none"
        role="presentation"
      >
        <defs>
          <linearGradient id="pricing-wave-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8fd8f6" stopOpacity="0" />
            <stop offset="24%" stopColor="#8fd8f6" stopOpacity="0.32" />
            <stop offset="52%" stopColor="#ffffff" stopOpacity="0.36" />
            <stop offset="78%" stopColor="#8fd8f6" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#d8aa31" stopOpacity="0" />
          </linearGradient>
        </defs>
        {WAVE_LINES.map((line) => {
          const y = 60 + line * 66;
          const offset = line % 2 === 0 ? 0 : 34;
          const lift = line % 3 === 0 ? 26 : 10;
          const interactiveShift = line % 2 === 0 ? "var(--wave-drift-a)" : "var(--wave-drift-b)";

          return (
            <path
              key={line}
              d={`M -120 ${y + offset} C 120 ${y - 66}, 265 ${y + 74}, 455 ${y + lift} S 760 ${y - 62}, 990 ${y + 16} S 1240 ${y + 88}, 1560 ${y - 38}`}
              fill="none"
              stroke="url(#pricing-wave-stroke)"
              strokeWidth={line % 5 === 0 ? 1.15 : 0.7}
              opacity={0.22 + (line % 4) * 0.045}
              style={{ transform: `translate3d(${interactiveShift}, 0, 0)` }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,42,0.10),rgba(6,22,42,0.72)_48%,rgba(6,22,42,0.92))]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent,#06162a)]" />
    </div>
  );
}

export function ProxyPricing() {
  const [billing, setBilling] = useState<BillingPlan>("annually");
  const backgroundRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const target = backgroundRef.current?.querySelector("[data-wave-background]") as HTMLElement | null;
    const bounds = backgroundRef.current?.getBoundingClientRect();

    if (!target || !bounds) {
      return;
    }

    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    const driftA = (x - 50) * 0.42;
    const driftB = (50 - x) * 0.28;

    target.style.setProperty("--wave-x", `${Math.max(0, Math.min(100, x))}%`);
    target.style.setProperty("--wave-y", `${Math.max(0, Math.min(100, y))}%`);
    target.style.setProperty("--wave-drift-a", `${driftA}px`);
    target.style.setProperty("--wave-drift-b", `${driftB}px`);
  }

  return (
    <div
      ref={backgroundRef}
      onPointerMove={handlePointerMove}
      className="relative isolate overflow-hidden px-5 py-16 sm:px-8 lg:px-10 lg:py-24"
    >
      <WaveBackground />

      <div className="relative mx-auto max-w-7xl">
        <section className="relative px-0 pb-10 pt-12 sm:px-0 lg:px-0">
          <div className="relative mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.6875rem] font-semibold uppercase text-[#8fd8f6] shadow-sm backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1b77be]" />
              Pricing
            </span>
            <h1 className="mt-5 text-4xl font-semibold text-white sm:text-5xl lg:text-6xl">
              Simple pricing for serious operators.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/74 sm:text-lg">
              One workspace for owner relationships, documents, financials, projects, and team follow-up. Start lean, then scale without per-property chaos.
            </p>

            <div className="mt-8 inline-flex rounded-full border border-white/15 bg-white/12 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_14px_34px_rgba(0,0,0,0.22)] backdrop-blur-md">
              {BILLING_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setBilling(option.id)}
                  className={cn(
                    "min-h-12 rounded-full px-5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1b77be] focus-visible:ring-offset-2 sm:px-7",
                    billing === option.id
                      ? "bg-white text-[#081b33] shadow-[0_6px_22px_rgba(8,27,51,0.12)]"
                      : "text-white/74 hover:text-white"
                  )}
                  aria-pressed={billing === option.id}
                >
                  <span className="inline-flex items-center gap-2">
                    {option.label}
                    {option.badge ? (
                      <span className="rounded-full bg-[#dff6e8] px-2 py-0.5 text-xs font-bold text-[#177a43]">
                        {option.badge}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {TIERS.map((tier) => (
              <article
                key={tier.id}
                className={cn(
                  "relative flex min-h-[680px] flex-col rounded-[24px] border bg-white p-7 shadow-[0_20px_60px_rgba(8,27,51,0.08)] transition-[box-shadow,transform] duration-300 hover:-translate-y-1 sm:p-8",
                  tier.highlighted
                    ? "border-[#d8aa31] shadow-[0_0_0_1px_rgba(216,170,49,0.7),0_34px_90px_rgba(8,27,51,0.15)]"
                    : "border-[#e1dbd0]"
                )}
              >
              {tier.badge ? (
                <div className="absolute -top-4 left-8 rounded-full bg-[#d8aa31] px-4 py-1.5 text-xs font-bold uppercase text-[#081b33] shadow-[0_10px_26px_rgba(216,170,49,0.28)]">
                  {tier.badge}
                </div>
              ) : null}

              <div>
                <p className="text-xs font-bold uppercase text-[#6f7480]">
                  {tier.name}
                </p>
                <p className="mt-3 text-sm font-semibold text-[#1b77be]">{tier.label}</p>
                <div className="mt-6 flex items-end gap-2">
                  <span className="text-5xl font-semibold text-[#081b33] sm:text-6xl">
                    <NumberFlow
                      value={getDisplayPrice(tier, billing)}
                      format={{
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                        currencyDisplay: "narrowSymbol",
                      }}
                    />
                  </span>
                  <span className="mb-2 text-lg text-[#6b7c8d]">/mo</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${tier.id}-${billing}`}
                    initial={{ y: 6, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -6, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-2 min-h-5 text-sm text-[#798795]"
                  >
                    {getBillingCaption(tier, billing)}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-5 min-h-12 text-sm leading-6 text-[#4b6074]">{tier.tagline}</p>
              </div>

              <div className="mt-8 flex-1 space-y-4">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-4">
                    <Check
                      size={18}
                      weight="bold"
                      className={cn("mt-0.5 shrink-0", tier.highlighted ? "text-[#d8aa31]" : "text-[#9aa3ad]")}
                    />
                    <span className="text-base leading-6 text-[#334255]">{feature}</span>
                  </div>
                ))}

                {tier.additionalFeatures ? (
                  <div className="mt-7 border-t border-[#ece8df] pt-6">
                    <p className="text-xs font-bold uppercase text-[#6f7480]">
                      Additional features
                    </p>
                    <div className="mt-4 space-y-3">
                      {tier.additionalFeatures.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <Check
                            size={15}
                            weight="bold"
                            className={cn("mt-0.5 shrink-0", tier.highlighted ? "text-[#d8aa31]" : "text-[#9aa3ad]")}
                          />
                          <span className="text-sm leading-6 text-[#4b6074]">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <Link
                href={tier.href}
                className={cn(
                  "mt-9 flex min-h-[56px] items-center justify-center rounded-xl px-6 text-base font-semibold transition-[background-color,color,border-color,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1b77be] focus-visible:ring-offset-2",
                  tier.highlighted
                    ? "bg-[#081b33] text-white shadow-[0_16px_34px_rgba(8,27,51,0.22)] hover:bg-[#142a46]"
                    : "border border-[#d9d2c5] bg-white text-[#081b33] hover:border-[#bfc8d1] hover:bg-[#f8f7f3]"
                )}
              >
                {tier.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-[28px] border border-[#e1dbd0] bg-white p-5 shadow-[0_18px_60px_rgba(8,27,51,0.06)] sm:p-8 lg:p-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[#1b77be]">
              Detailed Feature Comparison
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-[#081b33] sm:text-4xl">
              Compare what each plan unlocks.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#5f7183]">
            Built around the work operators repeat every month: owner updates, document review, financial controls, and team accountability.
          </p>
        </div>

        <div className="mt-8 hidden overflow-hidden rounded-2xl border border-[#ece8df] sm:block">
          <div>
            <table className="min-w-[820px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f6f3ee] text-sm text-[#5f7183]">
                  <th scope="col" className="w-[170px] px-5 py-4 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="w-[250px] px-5 py-4 font-semibold">
                    Feature
                  </th>
                  {TIERS.map((tier) => (
                    <th key={tier.id} scope="col" className="px-5 py-4 font-semibold">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece8df]">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={`${row.category}-${row.feature}`} className="bg-white">
                    <td className="px-5 py-4 text-sm font-bold uppercase text-[#9a7c31]">
                      {row.category}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-[#24354a]">{row.feature}</td>
                    <td className="px-5 py-4">
                      <ComparisonValue value={row.starter} />
                    </td>
                    <td className="px-5 py-4">
                      <ComparisonValue value={row.operator} highlighted />
                    </td>
                    <td className="px-5 py-4">
                      <ComparisonValue value={row.scale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:hidden">
          {COMPARISON_ROWS.map((row) => (
            <article
              key={`${row.category}-${row.feature}-mobile`}
              className="rounded-2xl border border-[#ece8df] bg-[#fbfaf7] p-4"
            >
              <p className="text-xs font-bold uppercase text-[#9a7c31]">{row.category}</p>
              <h3 className="mt-2 text-base font-semibold text-[#081b33]">{row.feature}</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#5f7183]">Starter</span>
                  <ComparisonValue value={row.starter} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#5f7183]">Operator</span>
                  <ComparisonValue value={row.operator} highlighted />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#5f7183]">Scale</span>
                  <ComparisonValue value={row.scale} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-[28px] bg-[#081b33] p-5 text-white shadow-[0_24px_80px_rgba(8,27,51,0.16)] sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase text-[#8fd8f6]">
              Common operator wins
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              What operators tell us they need.
            </h2>
            <p className="mt-4 text-sm leading-6 text-white/70">
              These are anonymous composite themes from operator conversations, not verified customer testimonials.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {REVIEWS.map((review) => (
              <article
                key={review.metric}
                className="flex min-h-[280px] flex-col rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <Quotes size={26} weight="fill" className="text-[#8fd8f6]" />
                  <div className="flex gap-0.5" role="img" aria-label="Composite positive theme">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} size={14} weight="fill" className="text-[#f4c856]" />
                    ))}
                  </div>
                </div>
                <p className="mt-5 flex-1 text-sm leading-6 text-white/80">&ldquo;{review.quote}&rdquo;</p>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#8fd8f6]">
                    <TrendUp size={14} weight="bold" />
                    {review.metric}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-white">{review.name}</p>
                  <p className="mt-1 text-xs text-white/55">{review.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-col items-start justify-between gap-6 rounded-2xl border border-[#d9d2c5] bg-white px-6 py-6 shadow-[0_18px_50px_rgba(8,27,51,0.05)] sm:flex-row sm:items-center sm:px-8">
        <div>
          <p className="text-xs font-semibold uppercase text-[#1b77be]">Need a custom rollout?</p>
          <h3 className="mt-1 text-xl font-semibold text-[#081b33]">Built for your portfolio, not a generic template.</h3>
          <p className="mt-2 text-sm leading-6 text-[#5f7183]">
            Talk through onboarding, migration, custom billing, and advanced integration needs.
          </p>
        </div>
        <Link
          href="mailto:hello@myproxyhost.com?subject=Pricing inquiry"
          className="flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-[#081b33] px-6 text-sm font-semibold text-white transition-[background-color] duration-200 hover:bg-[#142a46] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1b77be] focus-visible:ring-offset-2"
        >
          <Phone size={16} weight="duotone" />
          Contact sales
        </Link>
      </div>
        <a
          href="https://21st.dev/community/components/xubohuah/wave-background/default"
          target="_blank"
          rel="noreferrer"
          className="mx-auto mt-8 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8fd8f6] underline-offset-4 transition-[color] duration-200 hover:text-white hover:underline"
        >
          Wave background reference
          <ArrowSquareOut size={13} weight="bold" />
        </a>
      </div>
    </div>
  );
}
