import { Info } from "@phosphor-icons/react/dist/ssr";
import styles from "./RetentionGrid.module.css";

export type RetentionWindowCell = { measurable: boolean; retained: number; cohortMeasurable: number };
export type RetentionRow = {
  weekStart: string;
  label: string;
  size: number;
  w1: RetentionWindowCell;
  w4: RetentionWindowCell;
};

function cellAlpha(pct: number): number {
  return 0.06 + (0.24 * pct) / 100;
}

function Cell({ window, baseSize, isW0 }: { window?: RetentionWindowCell; baseSize: number; isW0?: boolean }) {
  if (isW0) {
    return (
      <td className={styles.cell}>
        <span className={styles.cellValue} style={{ background: `rgba(2,170,235,${cellAlpha(100)})` }}>
          100%
        </span>
        <span className={styles.cellSub}>{baseSize}/{baseSize}</span>
      </td>
    );
  }
  if (!window || !window.measurable) {
    return (
      <td className={styles.cell}>
        <span className={`${styles.cellValue} ${styles.cellPending}`}>—</span>
        <span className={styles.cellSub}>too young</span>
      </td>
    );
  }
  const pct = window.cohortMeasurable > 0 ? (window.retained / window.cohortMeasurable) * 100 : 0;
  return (
    <td className={styles.cell}>
      <span className={styles.cellValue} style={{ background: `rgba(2,170,235,${cellAlpha(pct)})` }}>
        {pct.toFixed(0)}%
      </span>
      <span className={styles.cellSub}>
        {window.retained}/{window.cohortMeasurable}
      </span>
    </td>
  );
}

export function RetentionGrid({
  cohorts,
  totalAgencies,
}: {
  cohorts: RetentionRow[];
  totalAgencies: number;
}) {
  const lowData = totalAgencies < 5 || cohorts.length < 2;

  return (
    <div className={styles.wrap}>
      {lowData && (
        <div className={styles.banner}>
          <Info size={16} weight="duotone" className={styles.bannerIcon} />
          <span>
            Not enough agencies for a retention trend yet. The grid shows the real cohort
            we have; curves fill in as more agencies join.
          </span>
        </div>
      )}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCohort}>Cohort</th>
              <th className={styles.thNum}>Agencies</th>
              <th className={styles.thNum}>Week 0</th>
              <th className={styles.thNum}>Week 1</th>
              <th className={styles.thNum}>Week 4</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.weekStart}>
                <td className={styles.cohortCell}>
                  <span className={styles.cohortLabel}>{c.label}</span>
                </td>
                <td className={styles.sizeCell}>{c.size}</td>
                <Cell baseSize={c.size} isW0 />
                <Cell window={c.w1} baseSize={c.size} />
                <Cell window={c.w4} baseSize={c.size} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.source}>
        Active = a member signed in within the window (auth sessions). PostHog is the
        richer behavioral source as volume grows.
      </p>
    </div>
  );
}
