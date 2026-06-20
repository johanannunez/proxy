import { DataNote } from "./DataNote";
import styles from "./FunnelBars.module.css";

export type FunnelBarStage = {
  key: string;
  label: string;
  count: number;
  definition?: string;
};

/**
 * Stepped funnel bars: each stage shows its count, a bar proportional to the first
 * stage (the baseline), the step conversion vs the previous stage, and any drop-off.
 * A zero stage renders an empty track + a muted "0" — never hidden.
 */
export function FunnelBars({ stages }: { stages: FunnelBarStage[] }) {
  const baseline = stages[0]?.count ?? 0;

  return (
    <div className={styles.funnel}>
      {stages.map((stage, i) => {
        const prev = i > 0 ? stages[i - 1].count : stage.count;
        const pctOfBase = baseline > 0 ? (stage.count / baseline) * 100 : 0;
        const stepPct = i === 0 ? 100 : prev > 0 ? (stage.count / prev) * 100 : 0;
        const dropoff = i > 0 ? prev - stage.count : 0;
        const isZero = stage.count === 0;

        return (
          <div className={styles.row} key={stage.key}>
            <div className={styles.rowHead}>
              <span className={styles.stepIndex}>{i + 1}</span>
              <span className={styles.label}>{stage.label}</span>
              {stage.definition && <DataNote>{stage.definition}</DataNote>}
              <span className={styles.count}>{stage.count}</span>
            </div>
            <div className={styles.track}>
              <div
                className={`${styles.fill}${isZero ? ` ${styles.fillZero}` : ""}`}
                style={{ width: `${Math.max(pctOfBase, isZero ? 0 : 4)}%` }}
              />
            </div>
            <div className={styles.rowMeta}>
              <span className={styles.conv}>
                {i === 0 ? "Baseline" : `${stepPct.toFixed(0)}% from previous`}
              </span>
              {dropoff > 0 && <span className={styles.drop}>−{dropoff} dropped</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
