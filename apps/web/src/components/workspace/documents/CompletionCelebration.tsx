"use client";

/**
 * CompletionCelebration — the moment every required document is complete.
 * Animated checkmark draw, a short summary of what was finished, and a clear
 * what-happens-next message. Confetti is pure CSS (transform + opacity only).
 */
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle } from "@phosphor-icons/react";
import styles from "./CompletionCelebration.module.css";

export interface CompletionCelebrationProps {
  /** Up to three lines summarizing what was completed. */
  summaryLines: string[];
  /** Short explanation of the next step in the process. */
  whatHappensNext: string;
}

/** Deterministic confetti spec — brand and success tones, varied drift. */
const CONFETTI_PIECES = [
  { left: "12%", color: "var(--color-brand-light)", delay: "0.45s", spin: "480deg" },
  { left: "24%", color: "var(--color-success)", delay: "0.6s", spin: "-520deg" },
  { left: "38%", color: "var(--color-brand)", delay: "0.5s", spin: "600deg" },
  { left: "50%", color: "var(--color-brand-light)", delay: "0.72s", spin: "-440deg" },
  { left: "62%", color: "var(--color-success)", delay: "0.48s", spin: "560deg" },
  { left: "74%", color: "var(--color-brand)", delay: "0.66s", spin: "-600deg" },
  { left: "86%", color: "var(--color-brand-light)", delay: "0.54s", spin: "500deg" },
  { left: "94%", color: "var(--color-success)", delay: "0.78s", spin: "-480deg" },
];

export function CompletionCelebration({
  summaryLines,
  whatHappensNext,
}: CompletionCelebrationProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className={styles.wrap} aria-label="All documents complete">
      {CONFETTI_PIECES.map((piece, i) => (
        <span
          key={i}
          className={styles.confetti}
          aria-hidden="true"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            ["--confetti-spin" as string]: piece.spin,
          }}
        />
      ))}

      <motion.div
        className={styles.checkRing}
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
          <motion.circle
            cx="26"
            cy="26"
            r="23"
            stroke="var(--color-success)"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.path
            d="M15.5 27.5 L22.5 34.5 L36.5 19.5"
            stroke="var(--color-success)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduceMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
      </motion.div>

      <motion.h2
        className={styles.headline}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        You&rsquo;re all set
      </motion.h2>

      <motion.div
        className={styles.summary}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {summaryLines.slice(0, 3).map((line) => (
          <span key={line} className={styles.summaryLine}>
            <CheckCircle size={15} weight="fill" color="var(--color-success)" />
            {line}
          </span>
        ))}
      </motion.div>

      <motion.div
        className={styles.next}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className={styles.nextTitle}>What happens next</p>
        <p className={styles.nextBody}>{whatHappensNext}</p>
      </motion.div>
    </section>
  );
}
