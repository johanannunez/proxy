"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChatCircle, ChartLineUp } from "@phosphor-icons/react";
import { Footer, ProxyFooterLogo } from "@/components/ui/footer";

// ─── Data ────────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: "Stripe", href: "https://stripe.com/", src: "/images/integrations-logo/stripe.svg", width: 76 },
  { name: "QuickBooks", href: "https://quickbooks.intuit.com/", src: "/images/integrations-logo/quickbooks-full.svg", width: 138 },
  { name: "Xero", href: "https://www.xero.com/us/", src: "/images/integrations-logo/xero.svg", width: 72 },
  { name: "DocuSign", href: "https://www.docusign.com/", src: "/images/integrations-logo/docusign-full.svg", width: 128 },
  { name: "Dropbox Sign", href: "https://sign.dropbox.com/", src: "/images/integrations-logo/dropbox-sign.svg", width: 36 },
  { name: "Google Drive", href: "https://drive.google.com/", src: "/images/integrations-logo/google-drive.svg", width: 38 },
  { name: "Google Meet", href: "https://meet.google.com/", src: "/images/integrations-logo/google-meet.svg", width: 38 },
  { name: "Gmail", href: "https://mail.google.com/", src: "/images/integrations-logo/gmail.svg", width: 40 },
  { name: "Outlook", href: "https://outlook.live.com/", src: "/images/integrations-logo/outlook-full.svg", width: 42 },
  { name: "Slack", href: "https://slack.com/", src: "/images/integrations-logo/slack.svg", width: 38 },
  { name: "Zapier", href: "https://zapier.com/", src: "/images/integrations-logo/zapier.svg", width: 78 },
  { name: "Make", href: "https://www.make.com/", src: "/images/integrations-logo/make.svg", width: 42 },
  { name: "Calendly", href: "https://calendly.com/", src: "/images/integrations-logo/calendly.svg", width: 40 },
];

const BEFORE_ITEMS = [
  "Five tools open at once: channel manager, DocuSign, invoicing, tasks, and messaging.",
  "Properties go live before permits are filed because the only check is a spreadsheet row.",
  "Owners email you to ask what is happening with their property. Every week.",
  "Documents live across Google Drive, email threads, and DocuSign. Status is always a guess.",
  "Month-end reconciliation means matching bank deposits to a spreadsheet by hand.",
  "Every new owner gets onboarded from a blank doc. Nothing is guided or repeatable.",
];

const AFTER_ITEMS = [
  "One platform covers onboarding, documents, bookings, financials, maintenance, and messaging.",
  "Gate chains block a property from going live until every compliance doc is filed and signed.",
  "Owners log into their portal and see bookings, documents, and property details themselves.",
  "Nine-state document lifecycle with e-signatures routed and filed inside Proxy automatically.",
  "Stripe invoicing and Plaid bank reconciliation built in. Real financial back office.",
  "A 20-plus step guided onboarding flow covers permits, insurance, and compliance. Nothing skipped.",
];

const FEATURES = [
  {
    title: "Onboard",
    description:
      "Property facts, agreements, tax forms, and readiness tasks in one guided workspace. Nothing falls through the cracks.",
  },
  {
    title: "Documents",
    description:
      "Signed agreements, W-9s, insurance files, and receipts move through one spine. No email attachments.",
  },
  {
    title: "Financials",
    description:
      "Revenue summaries and finance requests stay visible without email archaeology or spreadsheet chaos.",
  },
  {
    title: "AI Brief",
    description:
      "Relationship summaries, renewal alerts, and payout drafts generated from actual workspace context.",
  },
  {
    title: "Messages",
    description:
      "Owner inbox, message templates, and communication history attached to the right relationship.",
  },
  {
    title: "Tasks",
    description:
      "Action items, deadlines, and follow-ups connected to the owner and property they belong to.",
  },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckMark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "var(--lp-check-bg)" }}
    >
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
        <path
          d="M1 4l2.5 3L9 1"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function XMark() {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: 20, height: 20, background: "#e74c3c", marginTop: 1 }}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 1l6 6M7 1L1 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeatureIcon({ title }: { title: string }) {
  const paths: Record<string, React.ReactNode> = {
    Onboard: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 14V5l7-4 7 4v9" /><rect x="6.5" y="10" width="5" height="4" rx=".5" />
      </svg>
    ),
    Documents: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h10l2 2v12H4V2z" /><path d="M6 8h6M6 11h4" opacity=".6" />
      </svg>
    ),
    Financials: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.05 4.05l1.41 1.41M12.54 12.54l1.41 1.41M4.05 13.95l1.41-1.41M12.54 5.46l1.41-1.41" />
        <circle cx="9" cy="9" r="3" />
      </svg>
    ),
    "AI Brief": (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="9" cy="9" r="7" /><path d="M9 9l2.5 2.5" opacity=".6" />
        <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
    Messages: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h12v11l-6 2-6-2V3z" /><path d="M6 7h6M6 10h4" opacity=".6" />
      </svg>
    ),
    Tasks: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 6h12M3 10h8" /><circle cx="14" cy="10" r="2.5" />
        <path d="M14 9v1l.7.7" strokeWidth="1.1" opacity=".7" />
      </svg>
    ),
  };
  return paths[title] ?? null;
}

const HERO_TABS = [
  { src: "/marketing/screenshots/workspace-hero-home-v1.png", path: "the-olive-family" },
  {
    src: "/marketing/screenshots/workspace-hero-documents-v1.png",
    path: "the-olive-family/documents",
  },
  {
    src: "/marketing/screenshots/workspace-hero-finances-v1.png",
    path: "the-olive-family/finances",
  },
  {
    src: "/marketing/screenshots/workspace-hero-properties-v1.png",
    path: "the-olive-family/properties",
  },
];

function DarkWorkspaceMockup() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(
      () => setActive((a) => (a + 1) % HERO_TABS.length),
      3200,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{
        borderColor: "var(--lp-mock-border)",
        boxShadow:
          "0 0 0 1px rgba(12,40,75,0.06),0 8px 24px rgba(12,40,75,0.07),0 24px 64px rgba(12,40,75,0.1),0 48px 96px rgba(12,40,75,0.08)",
      }}
    >
      {/* Browser bar */}
      <div
        className="flex items-center gap-[10px] border-b px-[14px] py-[11px]"
        style={{ background: "var(--lp-mock-chrome)", borderColor: "var(--lp-mock-border)" }}
      >
        <div className="flex gap-[5px]">
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: "#ff6b6b" }} />
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: "#ffd43b" }} />
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: "#51cf66" }} />
        </div>
        <div
          className="flex-1 truncate rounded-[5px] px-[10px] py-[5px] text-[11px]"
          style={{ background: "var(--lp-mock-url)", color: "var(--lp-ink-mute)" }}
        >
          app.myproxyhost.com/admin/workspaces/{HERO_TABS[active].path}
        </div>
      </div>

      {/* Rotating real product screenshots (one per workspace tab) */}
      <div className="relative w-full" style={{ aspectRatio: "1440 / 900" }}>
        {HERO_TABS.map((tab, i) => (
          <Image
            key={tab.src}
            src={tab.src}
            alt="The Proxy workspace: documents, financials, properties, and owner updates in one surface"
            width={1440}
            height={900}
            priority={i === 0}
            className="absolute inset-0 h-full w-full transition-opacity duration-700 ease-out"
            style={{ opacity: i === active ? 1 : 0 }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Hero195() {
  return (
    <main
      className="min-h-screen"
      style={
        {
          background: "var(--lp-page)",
          color: "var(--lp-ink)",
          // Buttons on this page use `text-white` on navy/gold fills and must
          // stay true white in both themes. The app's dark mode redefines
          // --color-white to #141414, so pin it back to real white for this
          // subtree. Surface colors flip via the --lp-* tokens instead.
          "--color-white": "#ffffff",
        } as React.CSSProperties
      }
    >
      {/* NAV */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: "var(--lp-border)",
          background: "var(--lp-nav-bg)",
          backdropFilter: "blur(12px)",
        }}
      >
        <nav className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-[60px]">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/proxy-wordmark-navy.png"
              alt="Proxy"
              width={120}
              height={40}
              priority
              className="h-[22px] w-auto object-contain dark:hidden"
            />
            <Image
              src="/brand/logo-mark-white-v2.png"
              alt="Proxy"
              width={120}
              height={40}
              priority
              className="hidden h-[26px] w-auto object-contain dark:block"
            />
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {[
              { href: "#workspace", label: "Workspace" },
              { href: "#compare", label: "Operators" },
              { href: "/pricing", label: "Pricing" },
              { href: "#proof", label: "Proof" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors duration-200 hover:opacity-70"
                style={{ color: "var(--lp-ink-body)" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden px-4 py-2 text-sm font-medium sm:inline-flex"
              style={{ color: "var(--lp-ink-body)" }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[7px] px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: "var(--lp-btn-primary)" }}
            >
              Request access
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section id="workspace" className="scroll-mt-16" style={{ background: "var(--lp-page)" }}>
        <div className="mx-auto flex max-w-[1180px] flex-col items-start gap-10 px-6 py-12 sm:px-[60px] lg:flex-row lg:items-center lg:gap-[52px] lg:py-[64px]">
          {/* Left column */}
          <div className="w-full lg:w-[530px] lg:shrink-0">
            {/* Badge */}
            <div
              className="mb-7 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: "var(--lp-badge-bg)", borderColor: "var(--lp-badge-border)", color: "var(--lp-ink-soft)" }}
            >
              <span
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: "linear-gradient(135deg,#1a5fa6,#0b2540)" }}
              />
              Short stay · Mid stay · Long stay
            </div>

            {/* Headline */}
            <h1
              className="mb-[22px]"
              style={{
                fontFamily: "var(--font-sora)",
                fontSize: "clamp(36px, 3.6vw, 52px)",
                lineHeight: 1.02,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--lp-ink)",
              }}
            >
              Run every owner
              <br />
              relationship from
              <br />
              one <span style={{ color: "#c8853a" }}>premium</span>
              <br />
              workspace.
            </h1>

            {/* Sub */}
            <p
              className="mb-9 text-[17px] leading-[1.68]"
              style={{ color: "var(--lp-ink-body)", maxWidth: 440 }}
            >
              Proxy is the operating layer for co-hosting operators.{" "}
              <strong style={{ color: "var(--lp-ink)", fontWeight: 600 }}>
                Documents, financials, messages, and readiness
              </strong>{" "}
              in one calm surface built for the relationship layer only operators manage.
            </p>

            {/* CTAs */}
            <div className="mb-9 flex items-center gap-[10px]">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-[8px] px-[26px] py-[14px] text-sm font-semibold text-white"
                style={{ background: "var(--lp-btn-primary)" }}
              >
                Request access
                <ArrowRight size={14} weight="bold" />
              </Link>
              <Link
                href="#compare"
                className="inline-flex items-center rounded-[8px] border px-5 py-[13px] text-sm font-medium transition-colors duration-200"
                style={{ borderColor: "var(--lp-border-strong)", color: "var(--lp-ink-soft)" }}
              >
                See the workspace
              </Link>
            </div>

            {/* Checklist */}
            <div className="flex flex-col gap-[9px]">
              {[
                "Built around owner relationship management",
                "Works for any rental type, any portfolio size",
                "Documents, financials, inbox, and tasks in one surface",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-[10px] text-[13.5px]"
                  style={{ color: "var(--lp-ink-soft)" }}
                >
                  <CheckMark />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right column: mockup */}
          <div className="w-full min-w-0 lg:flex-1">
            <DarkWorkspaceMockup />
          </div>
        </div>
      </section>

      {/* PROOF BAND */}
      <section style={{ background: "var(--lp-band)" }} className="px-6 py-[68px] sm:px-[60px]">
        <div className="mx-auto max-w-[1240px]">
          <p
            className="mb-11 text-center text-[10.5px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "rgba(255,255,255,0.62)" }}
          >
            Built for the co-hosting model
          </p>
          <div className="grid grid-cols-2 gap-y-12 md:grid-cols-4">
            {[
              { figure: "1", label: "Workspace for documents, financials, messages, and tasks" },
              { figure: "3", label: "Stay types supported — short, mid, and long" },
              { figure: "5", label: "Disconnected tools, now replaced by one system" },
              { figure: "0", label: "Spreadsheets or copy-paste busywork" },
            ].map((stat, i) => (
              <div
                key={i}
                className="px-6 text-center md:border-l md:first:border-l-0"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-sora)",
                    fontSize: "clamp(40px, 4vw, 56px)",
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                    color: "#ffffff",
                  }}
                >
                  {stat.figure}
                </p>
                <p
                  className="mx-auto mt-[14px] max-w-[210px] text-[13px] leading-[1.5]"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div
        className="border-y"
        style={{ borderColor: "var(--lp-border)", background: "var(--lp-surface)", padding: "28px 0" }}
      >
        <p
          className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--lp-ink-body)" }}
        >
          Connects with your operator stack
        </p>
        <div
          className="overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right,transparent 0%,black 10%,black 90%,transparent 100%)",
          }}
        >
          <div className="proxy-marquee-track flex items-center" style={{ gap: 48 }}>
            {[...PLATFORMS, ...PLATFORMS].map((p, i) => (
              <a
                key={`${p.name}-${i}`}
                href={p.href}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${p.name} homepage`}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-sm outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-[#02aaeb] focus-visible:ring-offset-4"
                style={{ opacity: 0.92 }}
              >
                <Image
                  src={p.src}
                  alt={p.name}
                  width={p.width}
                  height={34}
                  className="h-[34px] w-auto object-contain dark:opacity-80 dark:[filter:brightness(0)_invert(1)]"
                  unoptimized
                />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* COMPARISON SECTION */}
      <section
        id="compare"
        className="scroll-mt-16 border-t px-6 py-20 sm:px-[60px] sm:py-24"
        style={{ borderColor: "var(--lp-border)", background: "var(--lp-page)" }}
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-12">
            <span
              className="mb-5 inline-flex rounded-full border px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: "var(--lp-badge-bg)", borderColor: "var(--lp-badge-border)", color: "var(--lp-ink-soft)" }}
            >
              Without Proxy / With Proxy
            </span>
            <h2
              className="mb-[14px]"
              style={{
                fontFamily: "var(--font-sora)",
                fontSize: "clamp(36px, 3.4vw, 48px)",
                lineHeight: 1.0,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "var(--lp-ink)",
              }}
            >
              Same owners.{" "}
              <span style={{ color: "#c8853a" }}>Premium</span> results.
            </h2>
            <p
              className="text-[17px] leading-[1.65]"
              style={{ color: "var(--lp-ink-body)", maxWidth: 520 }}
            >
              Operators running their business across five separate tools lose hours every week to
              copy-paste busywork. Proxy replaces all of it with one system built specifically for
              the co-hosting model.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Before */}
            <div
              className="overflow-hidden rounded-[18px] border"
              style={{ background: "var(--lp-card-warm)", borderColor: "var(--lp-card-warm-border)" }}
            >
              <div
                className="h-[3px] w-full"
                style={{ background: "linear-gradient(90deg,#e0794f,#c0392b)" }}
              />
              <div className="border-b px-8 pb-5 pt-7" style={{ borderColor: "var(--lp-card-warm-border)" }}>
                <p
                  className="mb-[10px] text-[10px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "var(--lp-danger-ink)" }}
                >
                  Without Proxy
                </p>
                <p
                  className="text-[17px] font-bold"
                  style={{
                    fontFamily: "var(--font-sora)",
                    color: "var(--lp-warm-ink)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  How most co-hosts operate today
                </p>
              </div>
              <div className="px-8 py-2">
                {BEFORE_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-[12px] text-[13.5px] leading-[1.5]"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--lp-card-warm-border)",
                      color: "var(--lp-warm-ink-body)",
                    }}
                  >
                    <XMark />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After */}
            <div
              className="overflow-hidden rounded-[18px] border"
              style={{
                background: "var(--lp-card)",
                borderColor: "var(--lp-card-cool-border)",
                boxShadow:
                  "0 24px 60px -20px rgba(12,40,75,0.22),0 8px 24px -14px rgba(12,40,75,0.12)",
              }}
            >
              <div
                className="h-[3px] w-full"
                style={{ background: "linear-gradient(90deg,#02aaeb,#1b77be)" }}
              />
              <div className="border-b px-8 pb-5 pt-7" style={{ borderColor: "var(--lp-border)" }}>
                <p
                  className="mb-[10px] text-[10px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "var(--lp-accent-ink)" }}
                >
                  With Proxy
                </p>
                <p
                  className="text-[17px] font-bold"
                  style={{
                    fontFamily: "var(--font-sora)",
                    color: "var(--lp-ink)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  What Proxy makes possible
                </p>
              </div>
              <div className="px-8 py-2">
                {AFTER_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-[12px] text-[13.5px] leading-[1.5]"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid var(--lp-border)",
                      color: "var(--lp-cool-ink-body)",
                    }}
                  >
                    <CheckMark size={20} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section
        className="border-t px-6 py-20 sm:px-[60px] sm:py-24"
        style={{ borderColor: "var(--lp-border)", background: "var(--lp-surface)" }}
      >
        <div className="mx-auto max-w-[1240px]">
          <span
            className="mb-5 inline-flex rounded-full border px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: "var(--lp-badge-bg)", borderColor: "var(--lp-badge-border)", color: "var(--lp-ink-soft)" }}
          >
            Operating rhythm
          </span>
          <h2
            className="mb-[14px]"
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: "clamp(34px, 3.2vw, 46px)",
              lineHeight: 1.08,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: "var(--lp-ink)",
            }}
          >
            Built for the relationship layer
            <br />
            operators actually manage.
          </h2>
          <p
            className="mb-14 text-[17px] leading-[1.65]"
            style={{ color: "var(--lp-ink-body)", maxWidth: 540 }}
          >
            Proxy is not a generic dashboard. It is a workspace for the repeatable work between
            operators, owners, properties, documents, and money movement.
          </p>
          <div
            className="grid grid-cols-1 gap-[2px] overflow-hidden rounded-[14px] sm:grid-cols-2 lg:grid-cols-3"
            style={{ background: "var(--lp-grid-gap)", border: "1px solid var(--lp-grid-gap)" }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group px-7 py-8 transition-colors duration-200"
                style={{ background: "var(--lp-card)" }}
              >
                <div
                  className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-200"
                  style={{ background: "var(--lp-badge-bg)", color: "var(--lp-accent-ink)" }}
                >
                  <FeatureIcon title={f.title} />
                </div>
                <p
                  className="mb-2 text-[15px] font-bold"
                  style={{
                    fontFamily: "var(--font-sora)",
                    color: "var(--lp-ink)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {f.title}
                </p>
                <p className="text-[13.5px] leading-[1.62]" style={{ color: "var(--lp-ink-mute)" }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPLIT: CONFIDENCE */}
      <section
        id="proof"
        className="scroll-mt-16 border-t px-6 py-20 sm:px-[60px] sm:py-24"
        style={{ borderColor: "var(--lp-border)", background: "var(--lp-page)" }}
      >
        <div className="mx-auto flex max-w-[1240px] flex-col items-start gap-12 lg:flex-row lg:items-center lg:gap-[72px]">
          <div style={{ flex: 1 }}>
            <p
              className="mb-[18px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--lp-accent-ink)" }}
            >
              Premium, not cold
            </p>
            <h2
              className="mb-4"
              style={{
                fontFamily: "var(--font-sora)",
                fontSize: "clamp(28px, 2.7vw, 38px)",
                lineHeight: 1.1,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--lp-ink)",
              }}
            >
              Give owners confidence
              <br />
              without status meetings.
            </h2>
            <p
              className="mb-7 text-base leading-[1.7]"
              style={{ color: "var(--lp-ink-body)" }}
            >
              The workspace is quiet on purpose. Critical work is visible without turning every
              relationship into another spreadsheet, thread, or one-off update.
            </p>
            <div className="mb-9 flex flex-col gap-[10px]">
              {[
                "Built around owner relationship management",
                "Works for short stay, mid stay, and long stay operators",
                "Documents, financials, messages, and tasks in one surface",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-[10px] text-[13.5px] font-medium"
                  style={{ color: "var(--lp-ink-soft)" }}
                >
                  <CheckMark />
                  {item}
                </div>
              ))}
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[8px] px-[26px] py-[14px] text-sm font-semibold text-white"
              style={{ background: "var(--lp-btn-primary)" }}
            >
              Request access
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
          <div
            className="w-full overflow-hidden rounded-[16px] lg:w-[480px] lg:shrink-0"
            style={{
              boxShadow: "0 20px 60px rgba(12,40,75,0.12),0 4px 16px rgba(12,40,75,0.07)",
            }}
          >
            <Image
              src="/marketing/photos/2217%20Estate%20Ave_36.jpg"
              alt="Premium co-hosting property"
              width={960}
              height={760}
              className="h-[380px] w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section
        className="relative overflow-hidden px-6 py-28 sm:px-[60px]"
        style={{ background: "var(--lp-band)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 80% at 50% -10%, rgba(2,170,235,0.18), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(45% 60% at 85% 110%, rgba(27,119,190,0.16), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-[760px] text-center">
          <p
            className="mb-5 text-[10.5px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "rgba(255,255,255,0.62)" }}
          >
            Get early access
          </p>
          <h2
            className="mb-4"
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: "clamp(32px, 3.2vw, 46px)",
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              color: "white",
            }}
          >
            The <span style={{ color: "#c8853a" }}>premium</span> workspace
            <br />
            for serious operators.
          </h2>
          <p
            className="mx-auto mb-9 max-w-[480px] text-[17px] leading-[1.65]"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Proxy is built for operators who take owner relationships seriously. Request access
            and see it with your own portfolio.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[10px] px-8 py-[15px] text-[15px] font-semibold transition-transform duration-200 hover:-translate-y-0.5 focus-visible:-translate-y-0.5"
              style={{
                background: "#c8853a",
                color: "#0b2540",
                boxShadow: "0 14px 32px -10px rgba(200,133,58,0.55)",
              }}
            >
              Request access
              <ArrowRight size={15} weight="bold" />
            </Link>
            <Link
              href="#workspace"
              className="inline-flex items-center rounded-[10px] border px-7 py-[14px] text-sm font-medium transition-colors duration-200 hover:bg-white/5"
              style={{ borderColor: "rgba(255,255,255,0.28)", color: "rgba(255,255,255,0.82)" }}
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <Footer
        logo={<ProxyFooterLogo />}
        brandName="Proxy"
        defaultMode="dark"
        showModeToggle
        socialLinks={[
          {
            icon: <ChatCircle size={18} weight="duotone" />,
            href: "mailto:hello@myproxyhost.com",
            label: "Email Proxy",
          },
          {
            icon: <ChartLineUp size={18} weight="duotone" />,
            href: "https://www.myproxyhost.com",
            label: "Proxy website",
          },
        ]}
      />
    </main>
  );
}
