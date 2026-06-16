"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Sun, Moon } from "@phosphor-icons/react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { DesktopNav } from "./DesktopNav";
import { MobileNavSheet } from "./MobileNavSheet";
import { ctaLinks } from "./nav-data";

function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

const ctaPrimaryCls = cn(
  "hidden items-center rounded-[var(--radius-sm)] bg-gradient-to-r from-[var(--color-brand-light)] to-[var(--color-brand)] px-4 py-2 text-[13.5px] font-semibold text-white outline-none sm:inline-flex",
  "shadow-[0_4px_14px_-2px_color-mix(in_oklab,var(--color-brand-light)_50%,transparent)]",
  "transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.98]",
  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_60%,transparent)]",
);

type SiteHeaderProps = {
  /**
   * Set on pages whose top section is a full-bleed dark/image hero. The bar
   * then sits transparent with light text until scrolled. Leave false (default)
   * on light content pages so the bar is frosted/solid from the top.
   */
  overHero?: boolean;
};

export function SiteHeader({ overHero = false }: SiteHeaderProps) {
  const scrolled = useScrolled(24);
  const reduceMotion = useReducedMotion();
  const { resolvedTheme, toggleTheme } = useTheme();

  // Light text on a transparent bar only while actually over the hero.
  const heroMode = overHero && !scrolled;
  const frosted = !heroMode;

  const navVars = {
    "--nav-fg": heroMode ? "rgba(255,255,255,0.85)" : "var(--lp-ink-body)",
    "--nav-fg-strong": heroMode ? "#ffffff" : "var(--lp-ink)",
    "--nav-hover-bg": heroMode ? "rgba(255,255,255,0.16)" : "var(--lp-badge-bg)",
  } as React.CSSProperties;

  return (
    <motion.header
      initial={reduceMotion ? false : { y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={navVars}
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b",
        "transition-[background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        frosted
          ? "border-[var(--lp-border)] bg-[var(--lp-nav-bg)] shadow-[var(--shadow-md)] backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        {/* Left: lockup + flyout nav */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            aria-label="Proxy home"
            className="flex items-center gap-2 rounded-[var(--radius-sm)] outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_55%,transparent)]"
          >
            <span className="relative block h-7 w-7">
              {heroMode ? (
                <Image src="/brand/logo-mark-white-v2.png" alt="" fill sizes="28px" className="object-contain" priority />
              ) : (
                <>
                  <Image
                    src="/brand/proxy-wordmark-navy.png"
                    alt=""
                    fill
                    sizes="28px"
                    className="object-contain dark:hidden"
                    priority
                  />
                  <Image
                    src="/brand/proxy-wordmark-stone.png"
                    alt=""
                    fill
                    sizes="28px"
                    className="hidden object-contain dark:block"
                    priority
                  />
                </>
              )}
            </span>
            <span
              className="text-[19px] font-bold leading-none tracking-[-0.02em] text-[var(--nav-fg-strong)]"
              style={{ fontFamily: "var(--font-sora)" }}
            >
              Proxy
            </span>
          </Link>
          <DesktopNav />
        </div>

        {/* Right: utilities + CTAs */}
        <div className="flex items-center gap-1.5">
          <Link
            href={ctaLinks.browseStays.href}
            className="hidden rounded-[var(--radius-sm)] px-3 py-2 text-[13.5px] font-medium text-[var(--nav-fg)] outline-none transition-colors duration-200 hover:text-[var(--nav-fg-strong)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)] lg:inline-flex"
          >
            {ctaLinks.browseStays.label}
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--nav-fg)] outline-none transition-colors duration-200 hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-fg-strong)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)]"
          >
            {resolvedTheme === "light" ? <Moon size={18} weight="bold" /> : <Sun size={18} weight="bold" />}
          </button>
          <Link
            href={ctaLinks.signIn.href}
            className="hidden rounded-[var(--radius-sm)] px-3.5 py-2 text-[13.5px] font-semibold text-[var(--nav-fg-strong)] outline-none transition-colors duration-200 hover:bg-[var(--nav-hover-bg)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)] lg:inline-flex"
          >
            {ctaLinks.signIn.label}
          </Link>
          <Link href={ctaLinks.getStarted.href} className={ctaPrimaryCls}>
            {ctaLinks.getStarted.label}
          </Link>
          <MobileNavSheet />
        </div>
      </nav>
    </motion.header>
  );
}
