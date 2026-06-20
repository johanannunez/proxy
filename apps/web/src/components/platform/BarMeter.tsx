import styles from "./BarMeter.module.css";

export type BarMeterRow = { label: string; value: number; display: string; sublabel?: string };

/**
 * Horizontal proportion bars (e.g. MRR by plan tier). Bars normalize to the max
 * row; when every value is zero the rows still render with their labels and a
 * muted track, so an all-zero composition reads as real, not missing.
 */
export function BarMeter({ rows }: { rows: BarMeterRow[] }) {
  const max = Math.max(0, ...rows.map((r) => r.value));

  return (
    <div className={styles.meter}>
      {rows.map((row, i) => {
        const pct = max > 0 ? (row.value / max) * 100 : 0;
        return (
          <div className={styles.row} key={row.label + i}>
            <div className={styles.head}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.value}>{row.display}</span>
            </div>
            <div className={styles.track}>
              <div className={styles.fill} style={{ width: `${Math.max(pct, row.value > 0 ? 3 : 0)}%` }} />
            </div>
            {row.sublabel && <span className={styles.sublabel}>{row.sublabel}</span>}
          </div>
        );
      })}
    </div>
  );
}
