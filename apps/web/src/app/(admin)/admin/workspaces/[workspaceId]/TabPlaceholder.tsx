import Link from "next/link";
import { Wrench } from "@phosphor-icons/react/dist/ssr";
import styles from "./TabPlaceholder.module.css";

/**
 * Dignified "rebuilding" card shown on tabs that haven't been rebuilt yet
 * (Properties, Finances, Activity, Files, Settings). Deliberately quiet
 * so the admin sees it once, knows why it's empty, and moves on.
 */
export function TabPlaceholder({
  title,
  body,
  linkHref,
  linkLabel,
}: {
  title: string;
  body: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className={styles.placeholder}>
      <div className={styles.placeholderIcon}>
        <Wrench size={22} weight="duotone" />
      </div>
      <div className={styles.placeholderTitle}>{title}</div>
      <div className={styles.placeholderBody}>{body}</div>
      {linkHref && linkLabel ? (
        <Link href={linkHref} className={styles.placeholderLink}>
          {linkLabel} &rarr;
        </Link>
      ) : null}
    </div>
  );
}
