"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { List, X, Sun, Moon } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import { useTheme } from "./ThemeProvider";

const NAV_LINKS = [
  { label: "Properties", href: "#properties" },
  { label: "About", href: "#about" },
  { label: "Journal", href: "#journal" },
  { label: "Contact", href: "#contact" },
];

interface FrostedNavProps {
  transparent?: boolean;
}

export default function FrostedNav({ transparent = true }: FrostedNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, toggleTheme } = useTheme();

  const isDark = transparent && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.nav
        aria-label="Main navigation"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          !isDark
            ? "frosted border-b border-warm-gray-200/50 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-6 md:px-12 lg:px-16">
          {/* Logo */}
          <Link href="/" className="relative z-10 flex items-center gap-2">
            <Image
              src={!isDark && resolvedTheme === "light" ? "/brand/logo-mark-v2.png" : "/brand/logo-mark-white-v2.png"}
              alt="Proxy"
              width={48}
              height={48}
              className="h-9 w-auto transition-opacity duration-300"
              priority
            />
          </Link>

          {/* Desktop Links */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-300 hover:text-brand ${
                  isDark ? "text-white" : "text-text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              className={`text-sm font-medium transition-colors duration-300 hover:text-brand ${
                isDark ? "text-white" : "text-text-primary"
              }`}
            >
              Owner Login
            </Link>
            <button
              onClick={toggleTheme}
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 ${
                isDark
                  ? "text-white hover:bg-white/10"
                  : "text-text-primary hover:bg-warm-gray-100"
              }`}
              aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            >
              {resolvedTheme === "light" ? (
                <Moon size={20} weight="bold" />
              ) : (
                <Sun size={20} weight="bold" />
              )}
            </button>
            <Link
              href="#properties"
              className="rounded-[var(--radius-sm)] bg-gradient-to-r from-brand-light to-brand px-5 py-2.5 text-sm font-semibold text-white transition-opacity duration-300 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Search
            </Link>
          </div>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={toggleTheme}
              className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 ${
                isDark
                  ? "text-white hover:bg-white/10"
                  : "text-text-primary hover:bg-warm-gray-100"
              }`}
              aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            >
              {resolvedTheme === "light" ? (
                <Moon size={20} weight="bold" />
              ) : (
                <Sun size={20} weight="bold" />
              )}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className={`relative z-10 flex h-11 w-11 items-center justify-center rounded-full ${
                isDark ? "text-white" : "text-text-primary"
              }`}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
            >
              {mobileOpen ? <X size={24} weight="bold" /> : <List size={24} weight="bold" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="frosted fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-2xl font-semibold text-text-primary transition-colors duration-300 hover:text-brand"
              >
                {link.label}
              </Link>
            ))}

            {/* Real page links */}
            <div className="flex flex-col items-center gap-4 pt-2">
              <Link
                href="/list-with-us"
                onClick={() => setMobileOpen(false)}
                className="text-lg font-medium text-text-secondary transition-colors duration-300 hover:text-brand"
              >
                List With Us
              </Link>
              <Link
                href="/help"
                onClick={() => setMobileOpen(false)}
                className="text-lg font-medium text-text-secondary transition-colors duration-300 hover:text-brand"
              >
                Help
              </Link>
            </div>

            <Link
              href="#properties"
              onClick={() => setMobileOpen(false)}
              className="mt-2 rounded-[var(--radius-sm)] bg-gradient-to-r from-brand-light to-brand px-8 py-3 text-base font-semibold text-white"
            >
              Search Properties
            </Link>

            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-[var(--radius-sm)] border px-6 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-brand hover:text-brand"
              style={{ borderColor: "var(--color-warm-gray-200)" }}
            >
              Owner Login
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
