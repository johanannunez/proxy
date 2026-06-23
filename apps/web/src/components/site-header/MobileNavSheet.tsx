"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { List, X, CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { NavFeatureCard } from "./NavFeatureCard";
import {
  platformItems,
  resourceFeatured,
  resourceLinks,
  pricingLink,
  ctaLinks,
} from "./nav-data";

const SPRING: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function MobileNavSheet() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [section, setSection] = useState<"platform" | "resources" | null>("platform");
  const reduceMotion = useReducedMotion();

  useEffect(() => setMounted(true), []);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Bulletproof body scroll lock (SidebarDrawer pattern).
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  // Close when crossing to desktop.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--nav-fg-strong)] outline-none transition-colors duration-200 hover:bg-[var(--nav-hover-bg)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)] lg:hidden"
      >
        <List size={22} weight="bold" />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                data-mobile-sheet
                role="dialog"
                aria-modal="true"
                aria-label="Site navigation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: SPRING }}
                className="fixed inset-0 z-[70] flex flex-col bg-[var(--lp-page)] lg:hidden"
              >
                <div className="flex h-16 shrink-0 items-center justify-between px-4">
                  <span
                    className="text-[18px] font-bold tracking-[-0.02em] text-[var(--lp-ink)]"
                    style={{ fontFamily: "var(--font-sora)" }}
                  >
                    Proxy
                  </span>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Close menu"
                    className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] text-[var(--lp-ink)] outline-none transition-colors duration-200 hover:bg-[var(--lp-badge-bg)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklab,var(--color-brand)_45%,transparent)]"
                  >
                    <X size={22} weight="bold" />
                  </button>
                </div>

                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.3, ease: SPRING, delay: reduceMotion ? 0 : 0.04 }}
                  className="flex-1 overflow-y-auto px-4 pb-6"
                >
                  <Accordion
                    label="Platform"
                    open={section === "platform"}
                    onToggle={() => setSection(section === "platform" ? null : "platform")}
                  >
                    <ul className="grid gap-1 pt-1">
                      {platformItems.map((item) => (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            onClick={close}
                            className="group block rounded-[var(--radius-md)] p-2.5 transition-colors duration-200 hover:bg-[var(--lp-card-hover)]"
                          >
                            <NavFeatureCard feature={item} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Accordion>

                  <Accordion
                    label="Resources"
                    open={section === "resources"}
                    onToggle={() => setSection(section === "resources" ? null : "resources")}
                  >
                    <ul className="grid gap-1 pt-1">
                      {resourceFeatured.map((item) => (
                        <li key={item.key}>
                          <Link
                            href={item.href}
                            onClick={close}
                            className="group block rounded-[var(--radius-md)] p-2.5 transition-colors duration-200 hover:bg-[var(--lp-card-hover)]"
                          >
                            <NavFeatureCard feature={item} />
                          </Link>
                        </li>
                      ))}
                      {resourceLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              onClick={close}
                              className="group flex items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2.5 transition-colors duration-200 hover:bg-[var(--lp-card-hover)]"
                            >
                              <Icon size={18} weight="duotone" className="text-[var(--lp-ink-mute)]" />
                              <span className="text-[14px] font-medium text-[var(--lp-ink)]">{link.title}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </Accordion>

                  <Link
                    href={pricingLink.href}
                    onClick={close}
                    className="flex items-center justify-between border-b border-[var(--lp-border)] py-3.5 text-[15px] font-semibold text-[var(--lp-ink)]"
                  >
                    {pricingLink.label}
                  </Link>
                  <Link
                    href={ctaLinks.browseStays.href}
                    onClick={close}
                    className="flex items-center justify-between border-b border-[var(--lp-border)] py-3.5 text-[15px] font-medium text-[var(--lp-ink-body)]"
                  >
                    {ctaLinks.browseStays.label}
                  </Link>
                </motion.div>

                <div className="flex shrink-0 flex-col gap-2.5 border-t border-[var(--lp-border)] bg-[var(--lp-page)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
                  <Link
                    href={ctaLinks.signIn.href}
                    onClick={close}
                    className="flex h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--lp-border-strong)] text-[15px] font-semibold text-[var(--lp-ink)] transition-colors duration-200 hover:bg-[var(--lp-badge-bg)]"
                  >
                    {ctaLinks.signIn.label}
                  </Link>
                  <Link
                    href={ctaLinks.getStarted.href}
                    onClick={close}
                    className="flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--color-brand-light)] to-[var(--color-brand)] text-[15px] font-semibold text-white shadow-[0_6px_18px_-3px_color-mix(in_oklab,var(--color-brand-light)_50%,transparent)] transition-[opacity,transform] duration-200 hover:opacity-90 active:scale-[0.99]"
                  >
                    {ctaLinks.getStarted.label}
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

function Accordion({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[var(--lp-border)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-3.5 text-left text-[15px] font-semibold text-[var(--lp-ink)] outline-none"
      >
        {label}
        <CaretDown
          size={16}
          weight="bold"
          className={cn("text-[var(--lp-ink-mute)] transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: SPRING }}
            className="overflow-hidden"
          >
            <div className="pb-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
