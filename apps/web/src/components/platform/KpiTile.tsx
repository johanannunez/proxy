import type { ReactNode } from "react";
import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import styles from "./kit.module.css";

export function KpiTile({
  icon: IconCmp,
  label,
  value,
  sub,
  delta,
  href,
}: {
  icon?: Icon;
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <div className={styles.kpiTop}>
        {IconCmp && (
          <span className={styles.kpiIcon}>
            <IconCmp size={17} weight="duotone" />
          </span>
        )}
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <div className={styles.kpiValueRow}>
        <span className={styles.kpiValue}>{value}</span>
        {delta}
      </div>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${styles.kpi} ${styles.kpiInteractive}`}>
        {body}
      </Link>
    );
  }
  return <div className={styles.kpi}>{body}</div>;
}
