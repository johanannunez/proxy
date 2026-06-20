import { ArrowUpRight, ArrowDownRight, Minus } from "@phosphor-icons/react/dist/ssr";
import styles from "./kit.module.css";

/**
 * Direction-aware delta chip. `direction` is the semantic meaning (up = good),
 * decoupled from the sign so a "churn down = good" case can be expressed.
 * Pass `label` as the already-formatted text (e.g. "+2 vs last week").
 */
export function StatDelta({
  direction,
  label,
}: {
  direction: "up" | "down" | "flat";
  label: string;
}) {
  const cls =
    direction === "up" ? styles.deltaUp : direction === "down" ? styles.deltaDown : styles.deltaFlat;
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <span className={`${styles.delta} ${cls}`}>
      <Icon size={12} weight="bold" />
      {label}
    </span>
  );
}
