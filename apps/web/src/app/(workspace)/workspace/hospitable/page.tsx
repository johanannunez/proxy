import type { Metadata } from "next";
import {
  CalendarCheck,
  ChartLineUp,
  ChatCircle,
  ShieldCheck,
  ArrowSquareOut,
  House,
  CurrencyDollar,
  Bell,
} from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = { title: "Hospitable" };

const FEATURES = [
  {
    icon: <CalendarCheck size={22} weight="duotone" />,
    title: "Calendar and owner stays",
    description:
      "View your booking calendar across all platforms. Block dates, create owner stays, and manage check-in/checkout details directly from the Hospitable Owner Workspace.",
  },
  {
    icon: <ChatCircle size={22} weight="duotone" />,
    title: "Guest messaging",
    description:
      "See all guest conversations in one place. Hospitable handles automated messages, but you can jump in for personal touches or special requests.",
  },
  {
    icon: <CurrencyDollar size={22} weight="duotone" />,
    title: "Revenue and payouts",
    description:
      "Track your earnings by property, by month, or by platform. Download statements and see exactly how your portfolio is performing.",
  },
  {
    icon: <ChartLineUp size={22} weight="duotone" />,
    title: "Performance analytics",
    description:
      "Occupancy rates, average nightly rates, and booking trends. Compare properties and spot opportunities to increase revenue.",
  },
  {
    icon: <House size={22} weight="duotone" />,
    title: "Listing management",
    description:
      "Your properties are listed across Airbnb, VRBO, Booking.com, and more. Hospitable keeps calendars, pricing, and availability in sync across all platforms.",
  },
  {
    icon: <Bell size={22} weight="duotone" />,
    title: "Smart lock codes",
    description:
      "Guest access codes are generated automatically for each stay. You can also request a code for your own owner stays.",
  },
];

export default function HospitablePage() {
  return (
    <div className="flex flex-col gap-10">

      {/* Hero CTA */}
      <section
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--color-warm-gray-200)",
          backgroundColor: "var(--color-white)",
        }}
      >
        <div
          className="px-6 py-8 sm:px-8"
          style={{
            background:
              "linear-gradient(135deg, rgba(2, 170, 235, 0.06) 0%, rgba(27, 119, 190, 0.04) 100%)",
          }}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, #02aaeb, #1b77be)",
                }}
              >
                <ShieldCheck size={24} weight="fill" className="text-white" />
              </span>
              <div>
                <h2
                  className="text-lg font-semibold tracking-tight"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Open your Owner Workspace
                </h2>
                <p
                  className="mt-0.5 text-sm"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  View your calendar, revenue, guest messages, and more.
                </p>
              </div>
            </div>
            <a
              href="https://my.hospitable.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, #02aaeb, #1b77be)",
              }}
            >
              Open Hospitable
              <ArrowSquareOut size={16} weight="bold" />
            </a>
          </div>
        </div>
      </section>

      {/* What you can do */}
      <section>
        <h2
          className="mb-1 text-xl font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          What you can do on Hospitable
        </h2>
        <p
          className="mb-6 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Everything related to your bookings and guests lives here.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-4 rounded-2xl border p-6"
              style={{
                backgroundColor: "var(--color-white)",
                borderColor: "var(--color-warm-gray-200)",
              }}
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.10)",
                  color: "#0c6fae",
                }}
              >
                {feature.icon}
              </span>
              <div>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ / Help */}
      <section
        className="rounded-2xl border p-6 sm:p-8"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
        }}
      >
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Common questions
        </h2>

        <div className="mt-5 flex flex-col gap-5">
          <FaqItem
            question="How do I create an owner stay?"
            answer='Log in to Hospitable, open your calendar, and click "Add Booking." Choose "Owner stay," set your dates, and confirm. Your stay will appear in purple on the calendar.'
          />
          <FaqItem
            question="Can I see my revenue and payout history?"
            answer="Yes. Hospitable shows all your earnings by property, by month, and by platform. You can download statements directly from their dashboard."
          />
          <FaqItem
            question="What if I need to block dates?"
            answer="You can block dates directly on Hospitable, or request a date block through Proxy and we will handle it for you across all platforms."
          />
          <FaqItem
            question="Do I need a separate login?"
            answer="Yes, Hospitable has its own login. Proxy will share your credentials with you during onboarding. If you need help getting in, send us a message."
          />
        </div>
      </section>
    </div>
  );
}

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div
      className="border-t pt-5"
      style={{ borderColor: "var(--color-warm-gray-100)" }}
    >
      <h3
        className="text-sm font-semibold"
        style={{ color: "var(--color-text-primary)" }}
      >
        {question}
      </h3>
      <p
        className="mt-1.5 text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {answer}
      </p>
    </div>
  );
}
