"use client";

import { Quotes, TrendUp } from "@phosphor-icons/react";
import ScrollReveal from "./ScrollReveal";

/* TODO: Replace with real owner testimonials — these are realistic placeholders */
const OWNER_TESTIMONIALS = [
  {
    id: "owner-1",
    quote:
      "Since partnering with Proxy, our occupancy rate jumped from 45% to 78%. They handle everything — I just watch the deposits come in.",
    name: "David R.",
    propertyType: "3BR lakeside cabin",
    metric: "78% occupancy",
    metricLabel: "up from 45%",
  },
  {
    id: "owner-2",
    quote:
      "I was managing my rental myself and burning out. Proxy took over and my revenue actually increased by 40% in the first quarter while I did nothing.",
    name: "Lisa M.",
    propertyType: "2BR downtown condo",
    metric: "+40% revenue",
    metricLabel: "first quarter",
  },
  {
    id: "owner-3",
    quote:
      "The professional photos and listing optimization alone were worth it. But the guest screening and 24/7 support give me complete peace of mind about my property.",
    name: "James & Karen W.",
    propertyType: "4BR family home",
    metric: "4.9★ avg rating",
    metricLabel: "across 120+ stays",
  },
];

export default function OwnerTestimonials() {
  return (
    <section aria-label="Owner testimonials" className="bg-surface py-24 md:py-32">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12 lg:px-16">
        <ScrollReveal>
          <p className="text-label text-brand">Owner success stories</p>
          <h2 className="text-h2 mt-3 text-text-primary">
            Hear from property owners like you
          </h2>
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {OWNER_TESTIMONIALS.map((t, i) => (
            <ScrollReveal key={t.id} delay={i * 0.08}>
              <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-warm-gray-100 bg-surface-elevated p-6 transition-shadow duration-500 hover:shadow-md md:p-8">
                {/* Quote Icon */}
                <Quotes
                  size={28}
                  weight="fill"
                  className="text-brand/20"
                  aria-hidden="true"
                />

                {/* Metric Badge */}
                <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-brand-light/10 to-brand/10 px-4 py-2">
                  <TrendUp size={16} weight="bold" className="text-brand" aria-hidden="true" />
                  <span className="text-sm font-bold text-brand">{t.metric}</span>
                  <span className="text-xs text-text-tertiary">{t.metricLabel}</span>
                </div>

                {/* Quote */}
                <p className="mt-4 flex-1 text-base leading-relaxed text-text-secondary">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-brand-light to-brand text-sm font-bold text-white">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {t.name}
                    </p>
                    <p className="text-xs text-text-tertiary">{t.propertyType}</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
