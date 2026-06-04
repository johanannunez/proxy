import Link from "next/link";
import type { PulseAtom } from "@/lib/admin/action-items/types";
import styles from "./PulseBar.module.css";

export function PulseBar({ greeting, atoms }: { greeting: string; atoms: PulseAtom[] }) {
  return (
    <div className={styles.bar}>
      <span className={styles.greeting}>{greeting}</span>
      {atoms.length > 0 ? (
        <div className={styles.atoms}>
          {atoms.map((a) => (
            <Link key={a.key} href={a.href} className={`${styles.atom} ${styles[a.tone]}`}>
              <span className={styles.dot} aria-hidden="true" />
              <span className={styles.value}>{a.value}</span>
              <span className={styles.label}>{a.label}</span>
            </Link>
          ))}
        </div>
      ) : (
        <span className={styles.allClear}>All quiet</span>
      )}
    </div>
  );
}
