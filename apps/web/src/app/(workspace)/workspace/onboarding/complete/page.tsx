import type { Metadata } from "next";
import { CheckCircle, ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { LinkButton } from "@/components/workspace/Button";

export const metadata: Metadata = { title: "Welcome to Proxy" };

const steps = [
  {
    title: "We review your listing",
    body: "Our team checks pricing, photos, and local regulations within one business day.",
  },
  {
    title: "Calendars sync automatically",
    body: "Once connected, Airbnb, Vrbo, and Booking.com reservations land on your dashboard in real time.",
  },
  {
    title: "Your first payout",
    body: "Payouts hit your connected account on the first of the following month with a full breakdown.",
  },
];

export default function OnboardingCompletePage() {
  return (
    <div className="flex flex-col items-center gap-10 py-10 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: "rgba(22, 163, 74, 0.12)",
          color: "#15803d",
        }}
      >
        <Sparkle size={28} weight="duotone" />
      </span>

      <div>
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          All set
        </p>
        <h1
          className="mt-2 text-[36px] font-semibold leading-tight tracking-tight"
          style={{ color: "var(--color-text-primary)" }}
        >
          Your property is with Proxy.
        </h1>
        <p
          className="mx-auto mt-3 max-w-xl text-base"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Thank you for trusting us with your home. Here is what happens over
          the next few days.
        </p>
      </div>

      <ul className="flex w-full max-w-xl flex-col gap-3 text-left">
        {steps.map((s) => (
          <li
            key={s.title}
            className="flex items-start gap-4 rounded-2xl border p-5"
            style={{
              backgroundColor: "var(--color-white)",
              borderColor: "var(--color-warm-gray-200)",
            }}
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: "rgba(2, 170, 235, 0.12)",
                color: "#0c6fae",
              }}
            >
              <CheckCircle size={18} weight="duotone" />
            </span>
            <div>
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {s.title}
              </div>
              <div
                className="mt-1 text-sm"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {s.body}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <LinkButton href="/workspace/home">
          Go to dashboard
          <ArrowRight size={14} weight="bold" />
        </LinkButton>
        <LinkButton href="/workspace/properties" variant="secondary">
          View all properties
        </LinkButton>
      </div>
    </div>
  );
}
