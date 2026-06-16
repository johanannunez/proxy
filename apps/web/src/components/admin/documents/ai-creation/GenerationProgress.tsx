"use client";

import { useReducedMotion } from "motion/react";
import styles from "./GenerationProgress.module.css";

interface Props {
  /** 0–100 */
  value: number;
  /** Live activity text shown above the bar. */
  label: string;
}

export function GenerationProgress({ value, label }: Props) {
  const reduce = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className={styles.wrap}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-live="polite"
    >
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{Math.round(clamped)}%</span>
      </div>
      <div className={styles.track}>
        <div
          className={`${styles.range} ${reduce ? styles.noMotion : ""}`}
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </div>
    </div>
  );
}
