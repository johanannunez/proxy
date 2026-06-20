import styles from "./BarSeries.module.css";

export type BarSeriesPoint = { label: string; agencies: number; owners: number };

/**
 * Grouped weekly bars: agencies (accent) vs owners (muted). Empty weeks render as
 * empty columns — the sparseness is the truth at this stage.
 */
export function BarSeries({ points }: { points: BarSeriesPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.agencies, p.owners)));

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchAgencies}`} /> Agencies
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchOwners}`} /> Owners
        </span>
      </div>
      <div className={styles.chart}>
        {points.map((p, i) => (
          <div className={styles.col} key={p.label + i}>
            <div className={styles.bars}>
              <span
                className={`${styles.bar} ${styles.barAgencies}`}
                style={{ height: `${(p.agencies / max) * 100}%` }}
                title={`${p.agencies} agencies`}
              />
              <span
                className={`${styles.bar} ${styles.barOwners}`}
                style={{ height: `${(p.owners / max) * 100}%` }}
                title={`${p.owners} owners`}
              />
            </div>
            <span className={styles.colLabel}>{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
