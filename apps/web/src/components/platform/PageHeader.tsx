import type { ReactNode } from "react";
import styles from "./kit.module.css";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        {eyebrow && <p className={styles.pageEyebrow}>{eyebrow}</p>}
        <h2 className={styles.pageTitle}>{title}</h2>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}
