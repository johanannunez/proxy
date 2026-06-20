import type { Icon } from "@phosphor-icons/react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import styles from "./ComingSoon.module.css";

/**
 * Designed "coming next" state for platform surfaces that are scoped but not yet
 * built (Waitlist, Feature Log, Broadcast, Entitlements). Not a placeholder — it
 * states what the surface will do and what's planned, so the roadmap is legible.
 */
export function ComingSoon({
  icon: IconCmp,
  title,
  description,
  planned,
}: {
  icon: Icon;
  title: string;
  description: string;
  planned: string[];
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.iconWrap}>
          <IconCmp size={26} weight="duotone" />
        </span>
        <span className={styles.badge}>In design</span>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
        <ul className={styles.list}>
          {planned.map((item) => (
            <li key={item} className={styles.listItem}>
              <CheckCircle size={16} weight="duotone" className={styles.check} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
