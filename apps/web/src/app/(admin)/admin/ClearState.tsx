import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import styles from "./ClearState.module.css";

export function ClearState({ subline }: { subline: string }) {
  return (
    <section className={styles.clear}>
      <span className={styles.badge}>
        <CheckCircle size={26} weight="duotone" />
      </span>
      <h2 className={styles.title}>Nothing needs you right now</h2>
      <p className={styles.sub}>{subline}</p>
    </section>
  );
}
