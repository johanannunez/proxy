"use client";

import { motion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";

export default function ListWithUsHero() {
  return (
    <section className="relative flex min-h-[70vh] items-end justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          role="img"
          aria-label="Premium vacation rental property"
          className="h-full w-full bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80&auto=format')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-6 pb-16 pt-48 md:px-12 md:pb-24 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-label text-brand-light">For Property Owners</p>
          <h1 className="text-hero mt-4 max-w-2xl text-white">
            Earn more from
            <br />
            your property
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/80 md:text-xl">
            Partner with Proxy for professional co-hosting,
            premium guests, and hands-off vacation rental management.
          </p>
          <a
            href="#revenue-calculator"
            className="mt-8 inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-sm)] bg-gradient-to-r from-brand-light to-brand px-8 py-3.5 text-base font-semibold text-white transition-opacity duration-300 hover:opacity-90"
          >
            Estimate your revenue
            <ArrowRight size={18} weight="bold" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
