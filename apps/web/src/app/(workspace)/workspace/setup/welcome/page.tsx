import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Play,
  VideoCamera,
  Phone,
  Envelope,
  Globe,
  MapPin,
  Star,
  Camera,
  Handshake,
  ChartLineUp,
  Rocket,
  CurrencyDollar,
  Calculator,
  Desktop,
  CalendarCheck,
  ChatCircle,
  ChartBar,
  DownloadSimple,
} from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Welcome",
};

const FANTASTICAL_URL =
  process.env.FANTASTICAL_KICKOFF_URL ?? "https://fantastical.app/Johanan/kickoff";
const MUX_VIDEO_ID = process.env.MUX_WELCOME_VIDEO_ID ?? "";

/* ── Guest Reviews ─────────────────────────────────────── */

const reviews = [
  { name: "Miguel", stars: 5, text: "Comfort and elegance all in one place." },
  { name: "Korrie", stars: 5, text: "Loved this place! Wish we could've stayed longer!" },
  { name: "Samantha", stars: 5, text: "Great place, hosts were very responsive!" },
  { name: "Omero", stars: 5, text: "Very clean and organized. I would definitely rent again. The host was attentive throughout our stay." },
  { name: "Ryan", stars: 5, text: "Very clean and quiet, easy to find, and close to food and stores." },
  { name: "Jolyn", stars: 5, text: "Clean, cozy, and a great value. Well stocked kitchen, comfortable linens, and quiet neighbors. Would happily stay again!" },
  { name: "Erika", stars: 5, text: "The place was great, felt just like home. Jo was very good with communication." },
  { name: "Danya", stars: 5, text: "Loved the homey feel. Super clean and comfortable. Definitely returning for my next work trip!" },
  { name: "Troy", stars: 5, text: "Jo is extremely professional while still being personable. Looking forward to working with Jo in the future." },
  { name: "Jess", stars: 5, text: "Jo and his team thought of everything! Stocked with coffee, a welcome meal, and all the essentials. Highly recommend!" },
  { name: "Sheree", stars: 5, text: "One of the best Airbnb experiences yet! Super quiet at night, great living room setup, and a flawless stay." },
  { name: "Mary", stars: 5, text: "Peaceful stay, quick responses from the host, and a warm welcome with a handwritten card. Extremely clean!" },
  { name: "Abdulrahman", stars: 5, text: "So cozy! Kitchen was functional, beds were comfortable, and little details like wireless charging stations were a great touch." },
];

/* ── Launch Timeline ───────────────────────────────────── */

const timelineSteps = [
  {
    number: 1,
    title: "Discovery Call",
    description:
      "We start with a conversation to learn about your property, your goals, and what success looks like for you. We will confirm the property is a strong fit for short-term rental and make sure we are aligned before moving forward.",
    icon: <Phone size={20} weight="duotone" />,
  },
  {
    number: 2,
    title: "Agreement and Onboarding",
    description:
      "Once we are both in, we finalize the management agreement and collect everything we need to get started. This covers terms, responsibilities, and key property details so nothing gets missed.",
    icon: <Handshake size={20} weight="duotone" />,
  },
  {
    number: 3,
    title: "Property Preparation",
    description:
      "We do a deep dive into your property, its layout, amenities, and standout features. We make sure the furnishings and setup meet our standards for guest experience. If anything needs attention before launch, we will flag it here.",
    icon: <Camera size={20} weight="duotone" />,
  },
  {
    number: 4,
    title: "Channel and Price Optimization",
    description:
      "We build your listing from the ground up with professional copy and photography, then implement a dynamic pricing strategy designed to keep your calendar full and your revenue strong.",
    icon: <ChartLineUp size={20} weight="duotone" />,
  },
  {
    number: 5,
    title: "Go Live",
    description:
      "Your property is live and we take it from here. We handle reservations, guest communication, and all day-to-day operations so you can stay hands-off and confident.",
    icon: <Rocket size={20} weight="duotone" />,
  },
  {
    number: 6,
    title: "Get Paid",
    description:
      "Payouts are processed within 2 to 3 business days of each completed reservation. Clean, consistent, and on time.",
    icon: <CurrencyDollar size={20} weight="duotone" />,
  },
];

/* ── Tools & Resources ─────────────────────────────────── */

const tools = [
  {
    title: "Furnishing Calculator",
    description: "Accurate furnishing cost estimation.",
    icon: <Calculator size={22} weight="duotone" />,
  },
  {
    title: "Owner Workspace",
    description: "Full access to property data.",
    icon: <Desktop size={22} weight="duotone" />,
  },
  {
    title: "Calendar Visibility",
    description: "Real-time calendar and future bookings view.",
    icon: <CalendarCheck size={22} weight="duotone" />,
  },
  {
    title: "Price Strategy",
    description: "Data-powered pricing to boost revenue.",
    icon: <ChartLineUp size={22} weight="duotone" />,
  },
  {
    title: "Guest Communications",
    description: "Detailed guest messaging system.",
    icon: <ChatCircle size={22} weight="duotone" />,
  },
  {
    title: "Financial Control",
    description: "Track earnings and expenses precisely.",
    icon: <ChartBar size={22} weight="duotone" />,
  },
];

export default function WelcomePage() {
  return (
    <div className="flex flex-col gap-12">
      {/* Back nav */}
      <Link
        href="/workspace/setup"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium transition-colors"
        style={{ color: "var(--color-text-secondary)" }}
      >
        <ArrowLeft size={14} weight="bold" />
        Back to setup
      </Link>

      {/* ─── Section A: Video ─────────────────────────── */}
      <section
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="p-6">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Welcome
          </p>
          <h1
            className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]"
            style={{ color: "var(--color-text-primary)" }}
          >
            Welcome to Proxy
          </h1>
          <p
            className="mt-2 max-w-2xl text-base"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Everything you need to know about how we work, who we are, and
            what comes next.
          </p>
        </div>

        {/* Video slot */}
        <div className="px-6 pb-6">
          {MUX_VIDEO_ID ? (
            <div
              className="relative aspect-video overflow-hidden rounded-xl border-2"
              style={{ borderColor: "#02aaeb" }}
            >
              <iframe
                src={`https://stream.mux.com/${MUX_VIDEO_ID}.m3u8`}
                title="Welcome video"
                className="h-full w-full"
                allow="autoplay; fullscreen"
              />
            </div>
          ) : (
            <div
              className="relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl border-2"
              style={{
                borderColor: "#02aaeb",
                backgroundColor: "#f8f7f4",
              }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full backdrop-blur-md"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                  border: "1px solid rgba(2, 170, 235, 0.2)",
                }}
              >
                <Play
                  size={28}
                  weight="fill"
                  style={{ color: "#02aaeb" }}
                />
              </div>
              <p
                className="mt-4 max-w-xs text-center text-sm italic"
                style={{ color: "var(--color-text-secondary)" }}
              >
                A personal welcome from Johanan and Elmira, coming soon
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Section B: Welcome Packet (inline HTML) ──── */}

      {/* Page 1: Hero */}
      <section
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          <Image
            src="/welcome/hero-bedroom.jpg"
            alt="Beautifully furnished bedroom"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Proxy
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Home Owner Welcome Packet
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Rentals Made Easy
            </p>
          </div>
        </div>
      </section>

      {/* Page 2: Meet Johanan & Elmira */}
      <section
        className="overflow-hidden rounded-2xl"
        style={{ backgroundColor: "#4a4a4a" }}
      >
        <div className="flex flex-col items-center px-6 py-10 text-center sm:px-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Meet
          </h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Johanan and Elmira
          </p>
          <div className="mt-6 h-28 w-28 overflow-hidden rounded-full border-2 border-white/20">
            <Image
              src="/welcome/johanan-elmira.jpg"
              alt="Johanan and Elmira"
              width={112}
              height={112}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-6 max-w-xl text-left text-sm leading-relaxed text-white/90">
            <p className="mb-4 font-serif text-lg italic text-white">
              Hey There,
            </p>
            <p className="mb-3">
              We are Proxy, and we are more than just a service. We
              are a husband-and-wife-run business that truly cares about every
              detail of your home. With us, your property is more than just a
              listing. It is a space we nurture, manage, and treat as if it
              were our own.
            </p>
            <p className="mb-3">
              Our commitment is to ensure that your home operates smoothly,
              efficiently, and in a way that brings out the best in it. We
              understand the importance of a personal touch, and that is why we
              work closely with you to ensure your home is prepared and cared
              for with the utmost attention.
            </p>
            <p className="mb-3">
              We believe that true hospitality does not just extend to guests.
              It starts with the owners. We are here to build a relationship of
              trust, transparency, and excellence, where your needs and
              expectations are always met.
            </p>
            <p>
              At Proxy, we see ourselves as your partners in
              success. Let us work together to make your experience seamless
              and rewarding.
            </p>
          </div>
          <div className="mt-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Your Hosts and Hospitality Experts
            </p>
            <p className="mt-2 font-serif text-lg italic text-white">
              Johanan and Elmira
            </p>
          </div>
        </div>
      </section>

      {/* Page 3: Team profiles */}
      <section
        className="overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Introducing Our
          </p>
          <h2
            className="mt-1 text-2xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Team
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Johanan */}
          <div
            className="flex flex-col items-center gap-4 rounded-xl border p-6 sm:flex-row sm:items-start"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-warm-gray-50)",
            }}
          >
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl">
              <Image
                src="/welcome/johanan.jpg"
                alt="Johanan Nunez"
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h3
                className="text-base font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Johanan Nunez
              </h3>
              <p
                className="text-sm italic"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Founder and Chief Operating Officer
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: "#02aaeb" }}
              >
                hello@myproxyhost.com
              </p>
              <p
                className="mt-2 text-[13px] leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                As the COO of Proxy, Johanan oversees owner
                management, financial reporting, and reservation management.
                He ensures seamless operations by maintaining strong owner
                relationships, providing financial insights, and optimizing
                bookings.
              </p>
            </div>
          </div>

          {/* Elmira */}
          <div
            className="flex flex-col items-center gap-4 rounded-xl border p-6 sm:flex-row sm:items-start"
            style={{
              borderColor: "var(--color-warm-gray-200)",
              backgroundColor: "var(--color-warm-gray-50)",
            }}
          >
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl">
              <Image
                src="/welcome/elmira.jpg"
                alt="Elmira Nunez"
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h3
                className="text-base font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                Elmira Nunez
              </h3>
              <p
                className="text-sm italic"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Hospitality Operations Manager
              </p>
              <p
                className="mt-2 text-[13px] leading-relaxed"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Elmira specializes in maintaining top-tier hospitality
                experiences. She manages cleaning schedules, oversees quality
                control, and coordinates with cleaners to ensure properties
                are spotless for every guest. She handles supply management,
                damage reporting, and home furnishing setups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Page 4: How We Launch Your Property (timeline) */}
      <section
        className="overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="text-center">
          <h2
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            How We Launch{" "}
            <span className="font-bold">Your Property</span>
          </h2>
        </div>

        <div className="relative mx-auto mt-10 max-w-2xl">
          {/* Vertical line */}
          <div
            className="absolute left-5 top-0 h-full w-0.5 sm:left-6"
            style={{ backgroundColor: "#02aaeb" }}
          />

          <div className="flex flex-col gap-8">
            {timelineSteps.map((step) => (
              <div
                key={step.number}
                className="relative flex gap-4 pl-12 sm:pl-14"
              >
                {/* Number circle */}
                <div
                  className="absolute left-0 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white sm:h-12 sm:w-12"
                  style={{
                    background:
                      "linear-gradient(135deg, #02aaeb, #1b77be)",
                  }}
                >
                  {step.number}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#02aaeb" }}>{step.icon}</span>
                    <h3
                      className="text-base font-semibold"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {step.title}
                    </h3>
                  </div>
                  <p
                    className="mt-1.5 text-sm leading-relaxed"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline bar */}
        <div
          className="mt-10 flex items-center justify-between gap-2 overflow-x-auto rounded-xl px-4 py-3"
          style={{ backgroundColor: "var(--color-warm-gray-50)" }}
        >
          {[
            { label: "Discovery Call", time: "1 hour" },
            { label: "Onboarding", time: "1 week" },
            { label: "Furnishing*", time: "1 to 2 months" },
            { label: "Photos", time: "1 day" },
            { label: "Listing", time: "5 days" },
            { label: "Go Live", time: "1 day" },
            { label: "Get Paid", time: "After reservation" },
          ].map((item, i) => (
            <div
              key={item.label}
              className="flex flex-col items-center text-center"
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    i === 0 ? "#02aaeb" : "var(--color-warm-gray-400)",
                }}
              />
              <span
                className="mt-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-primary)" }}
              >
                {item.label}
              </span>
              <span
                className="whitespace-nowrap text-[10px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {item.time}
              </span>
            </div>
          ))}
        </div>
        <p
          className="mt-3 text-center text-[11px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          *Furnishing timeline applies to properties starting from scratch.
          Already furnished? We can move faster.
        </p>
      </section>

      {/* Page 5: Guest Reviews */}
      <section
        className="overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="text-center">
          <h2
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Guest{" "}
            <span className="font-bold">Reviews</span>
          </h2>
        </div>

        <div className="mt-6 flex gap-4 overflow-x-auto pb-2">
          {reviews.map((review) => (
            <div
              key={review.name}
              className="w-64 shrink-0 rounded-xl border p-4"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                backgroundColor: "var(--color-warm-gray-50)",
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {review.name}
                </span>
                <div className="flex gap-0.5">
                  {Array.from({ length: review.stars }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      weight="fill"
                      style={{ color: "#f59e0b" }}
                    />
                  ))}
                </div>
              </div>
              <p
                className="mt-2 text-[13px] leading-snug"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {review.text}
              </p>
            </div>
          ))}
        </div>
        <p
          className="mt-4 text-center text-base font-semibold"
          style={{ color: "#02aaeb" }}
        >
          500+ Reviews
        </p>
      </section>

      {/* Page 6: Tools & Resources */}
      <section
        className="overflow-hidden rounded-2xl border p-6 sm:p-8"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="text-center">
          <h2
            className="text-2xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Tools and Resources
          </h2>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <div
              key={tool.title}
              className="flex items-start gap-3 rounded-xl border p-4"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                backgroundColor: "var(--color-warm-gray-50)",
              }}
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.08)",
                  color: "#02aaeb",
                }}
              >
                {tool.icon}
              </span>
              <div>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {tool.title}
                </h3>
                <p
                  className="mt-0.5 text-[13px]"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {tool.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Page 8: Contact Us */}
      <section
        className="overflow-hidden rounded-2xl"
        style={{ backgroundColor: "#3a3a3a" }}
      >
        <div className="flex flex-col items-center px-6 py-10 text-center sm:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Proxy
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Contact Us
          </h2>

          <div className="mt-8 flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <Phone size={18} weight="duotone" className="text-white/60" />
              <span className="text-sm text-white">+1 (605) 800-7033</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={18} weight="duotone" className="text-white/60" />
              <span className="text-sm text-white">
                4809 W 41st St, Ste 202 #353, Sioux Falls SD 57106
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Globe size={18} weight="duotone" className="text-white/60" />
              <a
                href="https://www.myproxyhost.com"
                className="text-sm text-white underline underline-offset-2"
              >
                www.myproxyhost.com
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Envelope
                size={18}
                weight="duotone"
                className="text-white/60"
              />
              <a
                href="mailto:hello@myproxyhost.com"
                className="text-sm text-white underline underline-offset-2"
              >
                hello@myproxyhost.com
              </a>
            </div>
          </div>

          <p className="mt-8 text-[11px] uppercase tracking-wide text-white/50">
            Office Hours: M to F, 8:00 AM to 5:00 PM
          </p>
        </div>
      </section>

      {/* Download PDF button */}
      <div className="flex justify-center">
        <a
          href="/welcome/proxy-welcome-packet.pdf"
          download
          className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-warm-gray-50)]"
          style={{
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-primary)",
          }}
        >
          <DownloadSimple size={16} weight="bold" />
          Download as PDF
        </a>
      </div>

      {/* ─── Section C: Schedule Kickoff Call ─────────── */}
      <section
        className="overflow-hidden rounded-2xl border p-6"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.08)",
                color: "#02aaeb",
              }}
            >
              <VideoCamera size={24} weight="duotone" />
            </span>
            <div>
              <h3
                className="text-lg font-semibold tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                Schedule your kickoff call
              </h3>
              <p
                className="mt-1 max-w-md text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                A 30-minute walkthrough to get aligned on your property,
                timeline, and any questions.
              </p>
            </div>
          </div>
          {FANTASTICAL_URL ? (
            <a
              href={FANTASTICAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #02aaeb, #1b77be)",
              }}
            >
              Pick a time
              <ArrowRight size={14} weight="bold" />
            </a>
          ) : (
            <span
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-medium"
              style={{
                borderColor: "var(--color-warm-gray-200)",
                color: "var(--color-text-tertiary)",
                backgroundColor: "var(--color-warm-gray-50)",
              }}
            >
              Coming soon
            </span>
          )}
        </div>
      </section>

      {/* Continue to setup */}
      <div className="flex justify-center pb-8">
        <Link
          href="/workspace/setup"
          className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{
            background: "linear-gradient(135deg, #02aaeb, #1b77be)",
          }}
        >
          Continue to setup
          <ArrowRight size={14} weight="bold" />
        </Link>
      </div>
    </div>
  );
}
