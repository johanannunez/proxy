"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowSquareOut,
  PaintBrushBroad,
  PaperPlaneTilt,
  Rows,
  UserPlus,
} from "@phosphor-icons/react";
import styles from "./OnboardingWizard.module.css";

const ONBOARDING_COMPLETE_KEY = "onboarding_complete";

const STEPS = [
  {
    id: "brand",
    title: "Set up your brand",
    description: "Upload your logo and set your colors",
    detail:
      "Your clients see your brand, not ours. Logo, colors, and fonts apply to every portal page, form, and email you send.",
    icon: PaintBrushBroad,
    href: "/admin/account",
    linkLabel: "Open brand settings",
  },
  {
    id: "client",
    title: "Invite your first client",
    description: "Enter their email to get started",
    detail:
      "Each client gets a private workspace where their documents, forms, and signatures live. They sign in with a magic link, no password to remember.",
    icon: UserPlus,
    href: "/admin/workspaces",
    linkLabel: "Open workspaces",
  },
  {
    id: "document",
    title: "Send your first document",
    description: "Choose a template and send a signature request",
    detail:
      "Pick from ready-made property management templates or upload your own PDF. Signers get a clean, mobile-friendly signing experience.",
    icon: PaperPlaneTilt,
    href: "/admin/paperwork",
    linkLabel: "Open paperwork",
  },
  {
    id: "form",
    title: "Create your first form",
    description: "Build a form to collect client information",
    detail:
      "Forms collect structured information you can act on: applications, property details, W-9s. Responses land in one place, ready to review.",
    icon: Rows,
    href: "/admin/paperwork/forms",
    linkLabel: "Open form builder",
  },
] as const;

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/** "unknown" during SSR/hydration, then "done" or "todo" on the client. */
function useOnboardingStatus(): "unknown" | "done" | "todo" {
  return useSyncExternalStore(
    subscribeToStorage,
    () =>
      window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) ? "done" : "todo",
    () => "unknown" as const,
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const status = useOnboardingStatus();

  // Already completed onboarding: this page no longer exists for you.
  useEffect(() => {
    if (status === "done") router.replace("/admin");
  }, [status, router]);

  const finish = () => {
    window.localStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
    router.push("/admin");
  };

  const advance = () => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  };

  if (status !== "todo") return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const Icon = step.icon;

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -16 },
      };

  return (
    <div className={styles.wrap}>
      <p className={styles.kicker}>Welcome to Proxy</p>
      <h1 className={styles.title}>Let&apos;s get your workspace ready</h1>
      <p className={styles.sub}>
        Four quick steps. You can skip any of them and come back later.
      </p>

      <div className={styles.progress} aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={`${styles.progressSegment} ${i <= stepIndex ? styles.progressDone : ""}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={step.id}
          className={styles.card}
          aria-label={step.title}
          {...motionProps}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className={styles.stepCount}>
            {stepIndex + 1} / {STEPS.length}
          </span>
          <span className={styles.stepIcon}>
            <Icon size={28} weight="duotone" />
          </span>
          <h2 className={styles.stepTitle}>{step.title}</h2>
          <p className={styles.stepDescription}>{step.description}</p>
          <p className={styles.stepDetail}>{step.detail}</p>

          <Link href={step.href} className={styles.openLink}>
            {step.linkLabel}
            <ArrowSquareOut size={14} weight="bold" />
          </Link>

          <div className={styles.actions}>
            <button type="button" className={styles.skip} onClick={advance}>
              Skip for now
            </button>
            <button type="button" className={styles.continue} onClick={advance}>
              {isLast ? "Go to dashboard" : "Continue"}
              <ArrowRight size={16} weight="bold" />
            </button>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
