import type { MrrSummary } from "@/lib/platform/revenue";
import { formatUsd, shortDate } from "@/lib/platform/format";
import { Sparkline } from "./Sparkline";
import { DataNote } from "./DataNote";
import { StatDelta } from "./StatDelta";
import styles from "./HeroVitalSigns.module.css";

/**
 * The signature "Vital Signs" hero: one oversized agency-operating MRR figure in
 * the brand gradient, beside the deliberately-$0 platform-SaaS MRR. The two-MRR
 * contrast is the platform-vs-tenant story made visual. The under-hero trace is the
 * real MRR snapshot trend, not an ornament.
 */
export function HeroVitalSigns({ mrr }: { mrr: MrrSummary }) {
  const { delta } = mrr;
  const diff = delta.hasHistory && delta.previousCents != null ? delta.currentCents - delta.previousCents : 0;

  return (
    <section className={styles.hero}>
      <div className={styles.main}>
        <div className={styles.eyebrowRow}>
          <span className={styles.eyebrow}>Agency-operating MRR</span>
          <DataNote>
            What agencies bill their own clients on Proxy, reconciled across legacy
            subscriptions and new billing schedules. This is not what agencies pay Proxy.
          </DataNote>
        </div>
        <div className={styles.figureRow}>
          <span className={`${styles.figure} pc-mono`}>{formatUsd(mrr.reconciledCents)}</span>
          <span className={styles.per}>/mo</span>
        </div>
        <div className={styles.trendRow}>
          {delta.hasHistory ? (
            <StatDelta
              direction={diff > 0 ? "up" : diff < 0 ? "down" : "flat"}
              label={`${diff >= 0 ? "+" : "−"}${formatUsd(Math.abs(diff))} vs yesterday`}
            />
          ) : (
            <span className={styles.tracking}>Tracking since {shortDate(delta.sinceDate)}</span>
          )}
          <span className={styles.trendNote}>
            Across {mrr.totalAgencies} {mrr.totalAgencies === 1 ? "agency" : "agencies"}
          </span>
        </div>
        <div className={styles.spark}>
          <Sparkline id="hero-mrr" data={mrr.trend.map((p) => p.cents)} height={52} />
        </div>
      </div>

      <div className={styles.aside}>
        <div className={styles.asideCard}>
          <div className={styles.asideHead}>
            <span className={styles.asideLabel}>Platform-SaaS MRR</span>
            <DataNote>What agencies pay Proxy. $0 today: the only agency is comped.</DataNote>
          </div>
          <span className={`${styles.asideValue} pc-mono`}>{formatUsd(mrr.platformSaasCents)}</span>
          <span className={styles.asideSub}>No agency pays Proxy yet</span>
        </div>

        <div className={styles.asideCard}>
          <div className={styles.asideHead}>
            <span className={styles.asideLabel}>Legacy, unattributed</span>
            <DataNote>
              An active legacy subscription whose owner has no workspace, so it is not
              folded into reconciled MRR. Shown separately, on purpose.
            </DataNote>
          </div>
          <span className={`${styles.asideValue} pc-mono`}>{formatUsd(mrr.legacyUnattributedCents)}</span>
          <span className={styles.asideSub}>Held out of the hero figure</span>
        </div>
      </div>
    </section>
  );
}
