import type { Icon } from "@phosphor-icons/react";
import styles from "./kit.module.css";

/**
 * Honest low-data / not-yet state. Used wherever a metric is structurally empty
 * (no signed documents, no payments, a cohort too young) instead of a faked curve.
 */
export function EmptyState({
  icon: IconCmp,
  title,
  message,
  compact,
}: {
  icon?: Icon;
  title: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.empty}${compact ? ` ${styles.emptyCompact}` : ""}`}>
      {IconCmp && (
        <span className={styles.emptyIcon}>
          <IconCmp size={20} weight="duotone" />
        </span>
      )}
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyMessage}>{message}</p>
    </div>
  );
}
