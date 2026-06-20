import type { ReactNode } from "react";
import styles from "./kit.module.css";

export function Pill({
  children,
  accent,
  mono,
}: {
  children: ReactNode;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <span
      className={`${styles.pill}${accent ? ` ${styles.pillAccent}` : ""}${mono ? ` ${styles.pillMono}` : ""}`}
    >
      {children}
    </span>
  );
}
