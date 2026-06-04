"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { Check, Phone } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type BillingPlan = "monthly" | "annually";

type Tier = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annuallyPrice: number;
  cta: string;
  href: string;
  highlighted: boolean;
  badge?: string;
  baseIncludes: string;
  features: string[];
};

const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For independent operators getting organized.",
    monthlyPrice: 99,
    annuallyPrice: 990,
    cta: "Get started",
    href: "/signup?plan=starter",
    highlighted: false,
    baseIncludes: "What's included:",
    features: [
      "Up to 10 properties",
      "1 team member",
      "Core workspace: Calendar, Tasks, Timeline",
      "Guest messaging (Hospitable sync)",
      "Monthly owner reports",
      "Basic financials: income & expense",
      "5 e-signatures per month",
      "10 GB document storage",
      "Email support",
    ],
  },
  {
    id: "operator",
    name: "Operator",
    tagline: "For growing teams managing 10-50 properties.",
    monthlyPrice: 199,
    annuallyPrice: 1990,
    cta: "Get started",
    href: "/signup?plan=operator",
    highlighted: true,
    badge: "Most popular",
    baseIncludes: "Everything in Starter, plus:",
    features: [
      "Up to 50 properties",
      "3 team members (+$49/mo each)",
      "Advanced financials: Treasury, Payouts, Dedup",
      "Vendor management",
      "Prospect pipeline",
      "Unlimited e-signatures (DocuSeal)",
      "Up to 10 document templates",
      "Guest Pulse analytics",
      "50 GB document storage",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For established operators running full portfolios.",
    monthlyPrice: 349,
    annuallyPrice: 3490,
    cta: "Get started",
    href: "/signup?plan=scale",
    highlighted: false,
    baseIncludes: "Everything in Operator, plus:",
    features: [
      "Unlimited properties",
      "Unlimited team members",
      "White-label owner portal",
      "Unlimited document templates",
      "API access & custom integrations",
      "Audit logs",
      "Dedicated success manager",
      "SLA guarantee",
    ],
  },
];

export function ProxyPricing() {
  const [billing, setBilling] = useState<BillingPlan>("monthly");

  return (
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      {/* Header */}
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1b77be]/20 bg-[#1b77be]/6 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-[#1b77be]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1b77be]" />
          Pricing
        </span>
        <h1 className="mt-5 text-5xl font-semibold [letter-spacing:-0.025em] text-[#07192e] sm:text-6xl">
          Simple, transparent pricing.
        </h1>
        <p className="mt-5 text-lg leading-8 text-[#4b6074]">
          One workspace for your entire portfolio. No per-property fees, no hidden costs.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "text-sm font-medium transition-colors duration-200",
              billing === "monthly" ? "text-[#081b33]" : "text-[#6b7c8d] hover:text-[#081b33]"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling(billing === "monthly" ? "annually" : "monthly")}
            className="relative h-6 w-11 rounded-full bg-[#1b77be] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1b77be] focus-visible:ring-offset-2"
            aria-label="Toggle billing period"
          >
            <span
              className={cn(
                "absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-300",
                billing === "annually" ? "left-6" : "left-1"
              )}
            />
          </button>
          <button
            onClick={() => setBilling("annually")}
            className={cn(
              "flex items-center gap-2 text-sm font-medium transition-colors duration-200",
              billing === "annually" ? "text-[#081b33]" : "text-[#6b7c8d] hover:text-[#081b33]"
            )}
          >
            Annual
            <span className="rounded-full bg-[#dcf7e8] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[#16a34a]">
              2 months free
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              "relative flex flex-col rounded-2xl border p-8 transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-[3px]",
              tier.highlighted
                ? "border-[#1b77be] bg-white shadow-[0_0_0_1px_#1b77be,0_32px_80px_rgba(27,119,190,0.18)]"
                : "border-[#d9d2c5] bg-white shadow-[0_18px_50px_rgba(8,27,51,0.06)] hover:shadow-[0_24px_60px_rgba(8,27,51,0.12)]"
            )}
          >
            {/* Glow behind highlighted card */}
            {tier.highlighted && (
              <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-b from-[#1b77be]/8 to-transparent" />
            )}

            {tier.badge && (
              <div className="mb-4 flex">
                <span className="rounded-full bg-[#1b77be] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                  {tier.badge}
                </span>
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-[#081b33]">{tier.name}</h2>
              <p className="mt-1 text-sm leading-6 text-[#6b7c8d]">{tier.tagline}</p>
            </div>

            <div className="mt-6">
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold [letter-spacing:-0.03em] text-[#081b33] md:text-5xl">
                  <NumberFlow
                    value={billing === "monthly" ? tier.monthlyPrice : Math.round(tier.annuallyPrice / 12)}
                    format={{ style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0, currencyDisplay: "narrowSymbol" }}
                  />
                </span>
                <span className="mb-1 text-sm text-[#6b7c8d]">/mo</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={billing}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -6, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="mt-1 text-xs text-[#6b7c8d]"
                >
                  {billing === "monthly" ? "Billed monthly" : `$${tier.annuallyPrice.toLocaleString()} billed annually`}
                </motion.p>
              </AnimatePresence>
            </div>

            <Link
              href={tier.href}
              className={cn(
                "mt-6 flex min-h-[48px] items-center justify-center rounded-lg px-6 text-sm font-semibold transition-colors duration-200",
                tier.highlighted
                  ? "bg-[#1b77be] text-white shadow-[0_8px_24px_rgba(27,119,190,0.28)] hover:bg-[#0f659f]"
                  : "border border-[#d9d2c5] bg-white text-[#081b33] hover:bg-[#f8f7f3]"
              )}
            >
              {tier.cta}
            </Link>

            <div className="mt-8 flex-1 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#a09080]">
                {tier.baseIncludes}
              </p>
              {tier.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check
                    size={16}
                    weight="bold"
                    className={cn(
                      "mt-0.5 shrink-0",
                      tier.highlighted ? "text-[#1b77be]" : "text-[#1b77be]"
                    )}
                  />
                  <span className="text-sm leading-6 text-[#4b6074]">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Enterprise row */}
      <div className="mt-6 flex flex-col items-start justify-between gap-6 rounded-2xl bg-[#081b33] px-8 py-7 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8fd8f6]">Enterprise</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Built for your portfolio, not a generic template.</h3>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {["White-glove onboarding", "Custom contract & billing", "Dedicated infrastructure", "Priority roadmap input"].map((item) => (
              <span key={item} className="flex items-center gap-2 text-sm text-white/70">
                <Check size={14} weight="bold" className="text-[#8fd8f6]" />
                {item}
              </span>
            ))}
          </div>
        </div>
        <Link
          href="mailto:hello@myproxyhost.com?subject=Enterprise inquiry"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#081b33] transition-colors duration-200 hover:bg-[#dff4fd]"
        >
          <Phone size={16} weight="duotone" />
          Contact sales
        </Link>
      </div>

      {/* FAQ teaser */}
      <p className="mt-10 text-center text-sm text-[#6b7c8d]">
        Questions?{" "}
        <Link href="mailto:hello@myproxyhost.com" className="font-medium text-[#1b77be] hover:underline">
          Email us
        </Link>{" "}
        and we&rsquo;ll reply same day.
      </p>
    </div>
  );
}
