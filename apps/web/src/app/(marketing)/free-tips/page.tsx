import type { Metadata } from "next";
import {
  CheckCircle,
  EnvelopeSimple,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { FreeTipsForm } from "./FreeTipsForm";

export const metadata: Metadata = {
  title: "Free tips for rental owners",
  description:
    "One short email every week with proven tactics to increase bookings, revenue, and guest satisfaction.",
  openGraph: {
    title: "Free tips for rental owners",
    description:
      "One short email every week with proven tactics that quietly make rental owners more money.",
    type: "website",
    url: "https://www.myproxyhost.com/free-tips",
  },
  twitter: {
    card: "summary_large_image",
    title: "Free tips for rental owners",
    description:
      "One short email every week with proven tactics that quietly make rental owners more money.",
  },
};

const bullets = [
  "Pricing moves that quietly add 18 percent to monthly revenue.",
  "Photo checklist top-earning listings get right every time.",
  "Messaging templates that turn 3-star guests into 5-star reviews.",
  "The exact cleaning standard that keeps Superhost status safe.",
];

export default function FreeTipsPage() {
  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-off-white)" }}
    >
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-24 lg:grid-cols-2 lg:gap-16 lg:py-32">
        <div className="flex flex-col gap-8">
          <span
            className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: "var(--color-warm-gray-200)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Sparkle size={12} weight="duotone" />
            Free weekly newsletter
          </span>

          <h1
            className="text-[34px] font-semibold leading-[1.08] tracking-tight sm:text-[44px] lg:text-[52px]"
            style={{ color: "var(--color-text-primary)" }}
          >
            The tactics that quietly make rental owners more money.
          </h1>

          <p
            className="max-w-xl text-lg leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Every Tuesday, one short email. No fluff, no padding, no selling.
            Just the exact moves we use to run properties for our clients.
          </p>

          <ul className="flex flex-col gap-3">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-3 text-base"
                style={{ color: "var(--color-text-primary)" }}
              >
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "rgba(22, 163, 74, 0.14)",
                    color: "#15803d",
                  }}
                >
                  <CheckCircle size={14} weight="fill" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border p-8"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: "var(--color-warm-gray-200)",
              boxShadow: "0 30px 60px -30px rgba(15,23,42,0.18)",
            }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: "rgba(2, 170, 235, 0.12)",
                  color: "#0c6fae",
                }}
              >
                <EnvelopeSimple size={18} weight="duotone" />
              </span>
              <div>
                <h2
                  className="text-base font-semibold tracking-tight"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Subscribe for free
                </h2>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Starts this Tuesday.
                </p>
              </div>
            </div>

            <FreeTipsForm />
          </div>

          <p
            className="text-center text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Join owners in 14 states already getting the emails.
          </p>
        </div>
      </section>
    </main>
  );
}
