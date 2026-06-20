import type { ReactNode } from "react";
import styles from "./kit.module.css";

export function SectionCard({
  eyebrow,
  title,
  action,
  className,
  children,
}: {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${styles.card}${className ? ` ${className}` : ""}`}>
      {(title || eyebrow || action) && (
        <div className={styles.cardHead}>
          <div className={styles.cardTitleWrap}>
            {eyebrow && <span className={styles.cardEyebrow}>{eyebrow}</span>}
            {title && <h3 className={styles.cardTitle}>{title}</h3>}
          </div>
          {action && <div className={styles.cardAction}>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
