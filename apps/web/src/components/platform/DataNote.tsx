import { Info } from "@phosphor-icons/react/dist/ssr";
import styles from "./kit.module.css";

/**
 * Inline info tooltip (CSS-only, keyboard-focusable). Used to disambiguate metrics
 * — e.g. the difference between agency-operating MRR and platform-SaaS MRR.
 */
export function DataNote({ children, label = "More information" }: { children: string; label?: string }) {
  return (
    <span className={styles.note} tabIndex={0} role="note" aria-label={label}>
      <Info size={14} weight="bold" />
      <span className={styles.noteBubble}>{children}</span>
    </span>
  );
}
