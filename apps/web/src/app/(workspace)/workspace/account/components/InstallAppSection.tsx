"use client";

import { useState } from "react";
import Image from "next/image";
import {
  DownloadSimple,
  Export,
  CheckCircle,
  House,
  Lightning,
  ArrowsOut,
} from "@phosphor-icons/react";
import { usePwaInstall } from "@/hooks/usePwaInstall";

/**
 * Account page section for adding Proxy as a home-screen web app.
 *
 * This is a deliberate, opt-in surface — there is no auto-prompt
 * anywhere in the portal. The user lands here either via the
 * Account nav or the ⌘K command palette.
 */
export function InstallAppSection() {
  const state = usePwaInstall();

  return (
    <section id="install" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Install as a web app
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Add Proxy to your home screen for one-tap access. Proxy opens in its own window with no browser bar, just like a regular app.
      </p>

      <div
        className="relative overflow-hidden rounded-2xl border p-7"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(2, 170, 235, 0.05) 0%, transparent 55%), var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {state.status === "checking" ? <CheckingState /> : null}
        {state.status === "available" ? (
          <AvailableState promptInstall={state.promptInstall} />
        ) : null}
        {state.status === "ios" ? <IosState /> : null}
      </div>
    </section>
  );
}

/* ─── States ─── */

function CheckingState() {
  return (
    <div className="flex min-h-[180px] items-center justify-center">
      <p
        className="text-sm"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Checking this device...
      </p>
    </div>
  );
}

function AvailableState({
  promptInstall,
}: {
  promptInstall: () => Promise<"accepted" | "dismissed">;
}) {
  const [justAdded, setJustAdded] = useState(false);

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      setJustAdded(true);
    }
  }

  return (
    <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:gap-8">
      <PhoneMockup />

      <div className="min-w-0 flex-1">
        <p
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Install Proxy as a web app
        </p>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Tap once to launch from your home screen. Proxy opens in its own window like a regular app.
        </p>

        <BenefitChips />

        <button
          type="button"
          onClick={handleInstall}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          <DownloadSimple size={16} weight="bold" />
          Install web app
        </button>

        {justAdded ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium"
            style={{
              backgroundColor: "rgba(22, 163, 74, 0.1)",
              color: "var(--color-success, #16a34a)",
            }}
          >
            <CheckCircle size={14} weight="fill" />
            Added to your home screen. You can install it again here anytime if you remove it.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IosState() {
  return (
    <div className="flex flex-col gap-7 sm:flex-row sm:items-start sm:gap-8">
      <PhoneMockup />

      <div className="min-w-0 flex-1">
        <p
          className="text-base font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Add Proxy to your home screen
        </p>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Open Proxy in Safari, then add it to your iPhone home screen in three steps.
        </p>

        <BenefitChips />

        <ol className="mt-5 flex flex-col gap-3">
          <IosStep index={1}>
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Tap the Share icon
              <Export
                size={14}
                weight="bold"
                style={{ color: "var(--color-brand)" }}
              />
              in Safari&apos;s toolbar.
            </span>
          </IosStep>
          <IosStep index={2}>
            Scroll down and choose <strong>Add to Home Screen</strong>.
          </IosStep>
          <IosStep index={3}>
            Tap <strong>Add</strong> in the top right.
          </IosStep>
        </ol>
      </div>
    </div>
  );
}

function IosStep({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: "var(--color-brand)" }}
      >
        {index}
      </span>
      <span
        className="pt-0.5 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        {children}
      </span>
    </li>
  );
}


/* ─── Benefit chips ─── */

function BenefitChips() {
  const chips: { icon: typeof House; label: string }[] = [
    { icon: House, label: "Home screen icon" },
    { icon: Lightning, label: "One-tap launch" },
    { icon: ArrowsOut, label: "Fullscreen window" },
  ];
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {chips.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium"
          style={{
            backgroundColor: "var(--color-warm-gray-50)",
            borderColor: "var(--color-warm-gray-200)",
            color: "var(--color-text-secondary)",
          }}
        >
          <Icon
            size={12}
            weight="duotone"
            style={{ color: "var(--color-brand)" }}
          />
          {label}
        </li>
      ))}
    </ul>
  );
}

/* ─── Phone mockup ─── */

/**
 * Realistic iPhone mockup. The PNG at `/brand/iphone-mockup-v2.png` is a
 * fully composed render (phone shell + status bar + home screen + Proxy
 * app icon with brand glow + dock + home indicator) so the component is
 * just an `<Image>` with a layered drop shadow for depth.
 */
function PhoneMockup() {
  return (
    <div
      className="relative mx-auto shrink-0 sm:mx-0"
      style={{
        width: 220,
        aspectRatio: "1080 / 1920",
        filter:
          "drop-shadow(0 30px 50px rgba(15, 23, 42, 0.22)) drop-shadow(0 10px 20px rgba(15, 23, 42, 0.12))",
      }}
      role="img"
      aria-label="iPhone showing the Proxy app icon on the home screen"
    >
      <Image
        src="/brand/iphone-mockup-v2.png"
        alt=""
        width={1080}
        height={1920}
        className="absolute inset-0 h-full w-full select-none"
        priority
        draggable={false}
      />
    </div>
  );
}
