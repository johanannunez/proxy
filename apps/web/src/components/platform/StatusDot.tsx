import styles from "./kit.module.css";

export type StatusKind = "ok" | "warn" | "danger" | "neutral";

export function StatusDot({ status, label }: { status: StatusKind; label?: string }) {
  const cls =
    status === "ok"
      ? styles.statusOk
      : status === "warn"
        ? styles.statusWarn
        : status === "danger"
          ? styles.statusDanger
          : styles.statusNeutral;
  return <span className={`${styles.statusDot} ${cls}`} role="img" aria-label={label ?? status} />;
}
