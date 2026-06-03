"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChatCircle, ChartLineUp } from "@phosphor-icons/react";
import { Footer, ProxyFooterLogo } from "@/components/ui/footer";

// ─── Data ────────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { src: "/images/platforms/airbnb.svg", alt: "Airbnb" },
  { src: "/images/platforms/vrbo.svg", alt: "Vrbo" },
  { src: "/images/platforms/booking.svg", alt: "Booking.com" },
  { src: "/images/platforms/furnished-finder.svg", alt: "Furnished Finder" },
  { src: "/images/platforms/hospitable.svg", alt: "Hospitable" },
  { src: "/images/platforms/turbotenant.svg", alt: "TurboTenant" },
  { src: "/images/platforms/housinganywhere.svg", alt: "HousingAnywhere" },
  { src: "/images/platforms/kayak.svg", alt: "Kayak" },
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

const SIDEBAR_NAV = [
  { label: "Workspace", group: true },
  { label: "Overview", active: true },
  { label: "Properties", active: false },
  { label: "Documents", active: false },
  { label: "Finance", group: true },
  { label: "Financials", active: false },
  { label: "Messages", active: false },
  { label: "Operations", group: true },
  { label: "Tasks", active: false },
];

const MOCKUP_PROPS = [
  { addr: "4 Chateau Terrace", city: "Scottsdale, AZ", live: true },
  { addr: "18 Palazzo Blvd, Unit 3", city: "Naples, FL", live: true },
  { addr: "22 Grand Estate Dr", city: "Sedona, AZ", live: false },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckMark({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "#0b2540" }}
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
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1a5fa6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 14V5l7-4 7 4v9" /><rect x="6.5" y="10" width="5" height="4" rx=".5" />
      </svg>
    ),
    Documents: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1a5fa6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2h10l2 2v12H4V2z" /><path d="M6 8h6M6 11h4" opacity=".6" />
      </svg>
    ),
    Financials: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1a5fa6" strokeWidth="1.4" strokeLinecap="round">
        <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.05 4.05l1.41 1.41M12.54 12.54l1.41 1.41M4.05 13.95l1.41-1.41M12.54 5.46l1.41-1.41" />
        <circle cx="9" cy="9" r="3" />
      </svg>
    ),
    "AI Brief": (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1a5fa6" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="9" cy="9" r="7" /><path d="M9 9l2.5 2.5" opacity=".6" />
        <circle cx="9" cy="9" r="1.5" fill="#1a5fa6" stroke="none" />
      </svg>
    ),
    Messages: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1a5fa6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h12v11l-6 2-6-2V3z" /><path d="M6 7h6M6 10h4" opacity=".6" />
      </svg>
    ),
    Tasks: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#1a5fa6" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 6h12M3 10h8" /><circle cx="14" cy="10" r="2.5" />
        <path d="M14 9v1l.7.7" strokeWidth="1.1" opacity=".7" />
      </svg>
    ),
  };
  return paths[title] ?? null;
}

function DarkWorkspaceMockup() {
  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{
        borderColor: "#e2e8f0",
        boxShadow:
          "0 0 0 1px rgba(12,40,75,0.06),0 8px 24px rgba(12,40,75,0.07),0 24px 64px rgba(12,40,75,0.1),0 48px 96px rgba(12,40,75,0.08)",
      }}
    >
      {/* Browser bar */}
      <div
        className="flex items-center gap-[10px] border-b px-[14px] py-[11px]"
        style={{ background: "#f5f7fa", borderColor: "#e6eaf0" }}
      >
        <div className="flex gap-[5px]">
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: "#ff6b6b" }} />
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: "#ffd43b" }} />
          <span className="h-[10px] w-[10px] rounded-full" style={{ background: "#51cf66" }} />
        </div>
        <div
          className="flex-1 rounded-[5px] px-[10px] py-[5px] text-[11px]"
          style={{ background: "#edf0f5", color: "#94a3b8" }}
        >
          app.myproxyhost.com/admin/workspace
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: 460 }}>
        {/* Sidebar */}
        <div
          className="flex shrink-0 flex-col"
          style={{ width: 196, background: "#0c1e30", borderRight: "1px solid rgba(255,255,255,0.04)" }}
        >
          {/* Logo row */}
          <div
            className="flex items-center gap-[9px] border-b px-[18px] pb-[18px] pt-[14px]"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-[5px]"
              style={{ background: "linear-gradient(135deg,#1a5fa6 0%,#0b2540 100%)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
                <circle cx="6" cy="6" r="2" fill="rgba(255,255,255,0.8)" />
              </svg>
            </div>
            <span
              className="text-[12.5px] font-semibold"
              style={{ fontFamily: "var(--font-sora)", color: "rgba(255,255,255,0.85)" }}
            >
              Proxy
            </span>
          </div>

          {/* Nav */}
          {SIDEBAR_NAV.map((item, i) =>
            item.group ? (
              <p
                key={i}
                className="px-[18px] pb-[5px] pt-[10px] text-[9px] font-bold uppercase tracking-[0.09em]"
                style={{ color: "rgba(255,255,255,0.22)" }}
              >
                {item.label}
              </p>
            ) : (
              <div
                key={i}
                className="px-[18px] py-[7px] text-[12px]"
                style={{
                  color: item.active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.42)",
                  background: item.active ? "rgba(255,255,255,0.06)" : undefined,
                  borderRight: item.active ? "2px solid #1a5fa6" : undefined,
                  fontWeight: item.active ? 600 : undefined,
                }}
              >
                {item.label}
              </div>
            )
          )}
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "#0f2540" }}>
          {/* Breadcrumb */}
          <div
            className="border-b px-[18px] py-[12px]"
            style={{ background: "#0c1e30", borderColor: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="flex items-center gap-[5px] text-[10.5px]"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <span>Workspaces</span>
              <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                <path d="M2 1.5l2 2-2 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                Versailles Portfolio Group
              </span>
            </div>
          </div>

          {/* Workspace header */}
          <div className="px-[18px] pt-[14px]">
            <p
              className="mb-[5px] text-[15px] font-bold"
              style={{
                fontFamily: "var(--font-sora)",
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "-0.02em",
              }}
            >
              Versailles Portfolio Group
            </p>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}
              >
                Active
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold"
                style={{ background: "rgba(26,95,166,0.2)", color: "#7ab9f7" }}
              >
                6/8 signed
              </span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                8 properties · 2h ago
              </span>
            </div>
            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {["Overview", "Documents", "Financials", "Messages", "Tasks"].map((tab, i) => (
                <div
                  key={tab}
                  className="border-b-2 px-[14px] py-[8px] text-[11px]"
                  style={{
                    color: i === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                    borderBottomColor: i === 0 ? "#1a5fa6" : "transparent",
                    fontWeight: i === 0 ? 600 : 500,
                    marginBottom: -1,
                  }}
                >
                  {tab}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard grid */}
          <div
            className="grid grid-cols-3 gap-[10px] overflow-hidden p-[14px]"
            style={{ flex: 1, gridTemplateRows: "auto auto" }}
          >
            {/* AI Brief */}
            <div
              className="relative col-span-3 overflow-hidden rounded-[9px] border p-[12px]"
              style={{
                background: "linear-gradient(135deg,#0e2a46 0%,#0b2040 100%)",
                borderColor: "rgba(26,95,166,0.3)",
              }}
            >
              <div
                className="pointer-events-none absolute -right-[30px] -top-[30px] h-[120px] w-[120px] rounded-full"
                style={{ background: "radial-gradient(circle,rgba(26,95,166,0.2) 0%,transparent 70%)" }}
              />
              <div
                className="mb-[7px] inline-flex items-center gap-[5px] rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em]"
                style={{
                  background: "rgba(26,95,166,0.2)",
                  borderColor: "rgba(26,95,166,0.3)",
                  color: "#7ab9f7",
                }}
              >
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                  <circle cx="4.5" cy="4.5" r="3" stroke="#7ab9f7" strokeWidth="1.2" />
                  <circle cx="4.5" cy="4.5" r="1.2" fill="#7ab9f7" />
                </svg>
                AI Relationship Brief
              </div>
              <p className="text-[11.5px] leading-[1.55]" style={{ color: "rgba(255,255,255,0.65)" }}>
                <strong style={{ color: "rgba(255,255,255,0.88)" }}>2 lease renewals due in 18 days.</strong>{" "}
                Owner response rate is strong. March payout summary is ready to send.
              </p>
            </div>

            {/* Metrics */}
            <div
              className="rounded-[9px] border p-[12px]"
              style={{ background: "#162d48", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <p
                className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Open Tasks
              </p>
              <p
                className="text-[18px] font-bold"
                style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em" }}
              >
                3
              </p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                1 overdue
              </p>
            </div>
            <div
              className="rounded-[9px] border p-[12px]"
              style={{ background: "#162d48", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <p
                className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.07em]"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Next Payout
              </p>
              <p
                className="text-[18px] font-bold"
                style={{ color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em" }}
              >
                $8,200
              </p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                March statement
              </p>
            </div>

            {/* Properties card */}
            <div
              className="col-span-2 overflow-hidden rounded-[9px] border"
              style={{ background: "#162d48", borderColor: "rgba(255,255,255,0.06)" }}
            >
              <div
                className="flex items-center justify-between border-b px-[14px] py-[10px]"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.07em]"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Properties
                </p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  8 total
                </p>
              </div>
              {MOCKUP_PROPS.map((p) => (
                <div
                  key={p.addr}
                  className="flex items-center justify-between border-b px-[14px] py-[8px]"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}
                >
                  <div>
                    <p className="text-[11.5px]" style={{ color: "rgba(255,255,255,0.72)" }}>
                      {p.addr}
                    </p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>
                      {p.city}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-[7px] py-[2px] text-[9.5px] font-semibold"
                    style={{
                      background: p.live ? "rgba(74,222,128,0.1)" : "rgba(200,133,58,0.15)",
                      color: p.live ? "#4ade80" : "#c8853a",
                    }}
                  >
                    {p.live ? "Live" : "Setup"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Hero195() {
  return (
    <main className="min-h-screen" style={{ background: "#ffffff", color: "#0b1929" }}>
      {/* NAV */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          borderColor: "#eef0f4",
          background: "rgba(255,255,255,0.96)",
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
              className="h-[22px] w-auto object-contain"
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
                className="text-sm font-medium transition-colors duration-200 hover:text-[#0b2540]"
                style={{ color: "#4a5568" }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden px-4 py-2 text-sm font-medium sm:inline-flex"
              style={{ color: "#4a5568" }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[7px] px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: "#0b2540" }}
            >
              Request access
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section id="workspace" className="scroll-mt-16" style={{ background: "#ffffff" }}>
        <div className="mx-auto flex max-w-[1360px] items-center gap-[52px] px-[60px] py-[86px]">
          {/* Left column */}
          <div style={{ flex: "0 0 530px" }}>
            {/* Badge */}
            <div
              className="mb-7 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: "#f0f4f8", borderColor: "#dce4ed", color: "#3d5470" }}
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
                fontSize: "clamp(48px, 4.6vw, 66px)",
                lineHeight: 1.0,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: "#0b1929",
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
              style={{ color: "#546880", maxWidth: 440 }}
            >
              Proxy is the operating layer for co-hosting operators.{" "}
              <strong style={{ color: "#1e3a52", fontWeight: 600 }}>
                Documents, financials, messages, and readiness
              </strong>{" "}
              in one calm surface built for the relationship layer only operators manage.
            </p>

            {/* CTAs */}
            <div className="mb-9 flex items-center gap-[10px]">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-[8px] px-[26px] py-[14px] text-sm font-semibold text-white"
                style={{ background: "#0b2540" }}
              >
                Request access
                <ArrowRight size={14} weight="bold" />
              </Link>
              <Link
                href="#compare"
                className="inline-flex items-center rounded-[8px] border px-5 py-[13px] text-sm font-medium transition-colors duration-200"
                style={{ borderColor: "#d0d8e4", color: "#2d4059" }}
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
                  style={{ color: "#3d5470" }}
                >
                  <CheckMark />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right column: mockup */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <DarkWorkspaceMockup />
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div
        className="border-y"
        style={{ borderColor: "#eef0f4", background: "#f7f9fc", padding: "28px 0" }}
      >
        <p
          className="mb-5 text-center text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "#94a3b8" }}
        >
          Works with your platforms
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
              <Image
                key={i}
                src={p.src}
                alt={p.alt}
                width={120}
                height={32}
                className="h-[24px] w-auto object-contain"
                style={{ opacity: 0.75 }}
                unoptimized
              />
            ))}
          </div>
        </div>
      </div>

      {/* COMPARISON SECTION */}
      <section
        id="compare"
        className="scroll-mt-16 border-t px-[60px] py-24"
        style={{ borderColor: "#eef0f4", background: "#ffffff" }}
      >
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-12">
            <span
              className="mb-5 inline-flex rounded-full border px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ background: "#f0f4f8", borderColor: "#dce4ed", color: "#3d5470" }}
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
                color: "#0b1929",
              }}
            >
              Same owners.{" "}
              <span style={{ color: "#c8853a" }}>Premium</span> results.
            </h2>
            <p
              className="text-[17px] leading-[1.65]"
              style={{ color: "#546880", maxWidth: 520 }}
            >
              Operators running their business across five separate tools lose hours every week to
              copy-paste busywork. Proxy replaces all of it with one system built specifically for
              the co-hosting model.
            </p>
          </div>

          <div
            className="grid grid-cols-2 gap-[3px] overflow-hidden rounded-[14px]"
            style={{ background: "#e8ecf2" }}
          >
            {/* Before */}
            <div style={{ background: "#fafafa" }}>
              <div
                className="border-b px-7 py-5"
                style={{ borderColor: "#ede8e0" }}
              >
                <p
                  className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "#c0392b" }}
                >
                  Without Proxy
                </p>
                <p
                  className="text-base font-bold"
                  style={{
                    fontFamily: "var(--font-sora)",
                    color: "#0b1929",
                    letterSpacing: "-0.02em",
                  }}
                >
                  How most co-hosts operate today
                </p>
              </div>
              <div className="py-2">
                {BEFORE_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-7 py-[10px] text-[13.5px] leading-[1.5]"
                    style={{
                      background: i % 2 === 0 ? "rgba(0,0,0,0.015)" : undefined,
                      color: "#3d2020",
                    }}
                  >
                    <XMark />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After */}
            <div style={{ background: "#fff" }}>
              <div className="border-b px-7 py-5" style={{ borderColor: "#eef0f4" }}>
                <p
                  className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "#1a5fa6" }}
                >
                  With Proxy
                </p>
                <p
                  className="text-base font-bold"
                  style={{
                    fontFamily: "var(--font-sora)",
                    color: "#0b1929",
                    letterSpacing: "-0.02em",
                  }}
                >
                  What Proxy makes possible
                </p>
              </div>
              <div className="py-2">
                {AFTER_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-7 py-[10px] text-[13.5px] leading-[1.5]"
                    style={{
                      background: i % 2 === 0 ? "rgba(0,0,0,0.015)" : undefined,
                      color: "#1e3a52",
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
        className="border-t px-[60px] py-24"
        style={{ borderColor: "#eef0f4", background: "#f7f9fc" }}
      >
        <div className="mx-auto max-w-[1240px]">
          <span
            className="mb-5 inline-flex rounded-full border px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
            style={{ background: "#f0f4f8", borderColor: "#dce4ed", color: "#3d5470" }}
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
              color: "#0b1929",
            }}
          >
            Built for the relationship layer
            <br />
            operators actually manage.
          </h2>
          <p
            className="mb-14 text-[17px] leading-[1.65]"
            style={{ color: "#546880", maxWidth: 540 }}
          >
            Proxy is not a generic dashboard. It is a workspace for the repeatable work between
            operators, owners, properties, documents, and money movement.
          </p>
          <div
            className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[12px]"
            style={{ background: "#eef0f4", border: "1px solid #eef0f4" }}
          >
            {FEATURES.map((f) => (
              <div key={f.title} className="px-7 py-8" style={{ background: "#ffffff" }}>
                <div
                  className="mb-[18px] flex h-10 w-10 items-center justify-center rounded-[10px]"
                  style={{ background: "#f0f4f8" }}
                >
                  <FeatureIcon title={f.title} />
                </div>
                <p
                  className="mb-2 text-[15px] font-bold"
                  style={{
                    fontFamily: "var(--font-sora)",
                    color: "#0b1929",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {f.title}
                </p>
                <p className="text-[13.5px] leading-[1.62]" style={{ color: "#64748b" }}>
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
        className="scroll-mt-16 border-t px-[60px] py-24"
        style={{ borderColor: "#eef0f4", background: "#ffffff" }}
      >
        <div className="mx-auto flex max-w-[1240px] items-center gap-[72px]">
          <div style={{ flex: 1 }}>
            <p
              className="mb-[18px] text-[10.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "#1a5fa6" }}
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
                color: "#0b1929",
              }}
            >
              Give owners confidence
              <br />
              without status meetings.
            </h2>
            <p
              className="mb-7 text-base leading-[1.7]"
              style={{ color: "#546880" }}
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
                  style={{ color: "#2d4059" }}
                >
                  <CheckMark />
                  {item}
                </div>
              ))}
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[8px] px-[26px] py-[14px] text-sm font-semibold text-white"
              style={{ background: "#0b2540" }}
            >
              Request access
              <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
          <div
            className="overflow-hidden rounded-[16px]"
            style={{
              flex: "0 0 480px",
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
      <section className="px-[60px] py-24" style={{ background: "#0b2540" }}>
        <div className="mx-auto max-w-[760px] text-center">
          <p
            className="mb-5 text-[10.5px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "rgba(255,255,255,0.35)" }}
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
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[9px] px-8 py-[15px] text-[15px] font-semibold text-white"
              style={{ background: "#c8853a" }}
            >
              Request access
              <ArrowRight size={15} weight="bold" />
            </Link>
            <Link
              href="#workspace"
              className="inline-flex items-center rounded-[9px] border px-7 py-[14px] text-sm font-medium"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.65)" }}
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <Footer
        logo={<ProxyFooterLogo />}
        brandName="Proxy"
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
        mainLinks={[
          { href: "#workspace", label: "Workspace" },
          { href: "#compare", label: "Operators" },
          { href: "/pricing", label: "Pricing" },
          { href: "#proof", label: "Proof" },
          { href: "/help", label: "Help" },
          { href: "/login", label: "Log in" },
        ]}
        legalLinks={[
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Terms" },
          { href: "/cookies", label: "Cookies" },
        ]}
        copyright={{
          text: `© ${new Date().getFullYear()} Proxy`,
          license: "All rights reserved",
        }}
      />
    </main>
  );
}
