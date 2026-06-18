import Link from "next/link";
import { ArrowRight, Clock } from "@phosphor-icons/react/dist/ssr";
import { tierOf } from "@/lib/admin/action-items/score";
import type { ActionItem } from "@/lib/admin/action-items/types";
import styles from "./NowQueue.module.css";

function timeChip(item: ActionItem, now: number): { text: string; live: boolean } {
  const tier = tierOf(item, now);
  if (tier === 0) return { text: "now", live: true };
  if (item.deadline === null) return { text: "open", live: false };
  const diffMs = new Date(item.deadline).getTime() - now;
  if (diffMs < 0) {
    const days = Math.floor(-diffMs / 86_400_000);
    return { text: days >= 1 ? `${days}d late` : "overdue", live: false };
  }
  const hours = Math.round(diffMs / 3_600_000);
  return { text: hours <= 1 ? "< 1h" : `in ${hours}h`, live: false };
}

export function NowQueue({
  items,
  overflowCount,
  now,
}: {
  items: ActionItem[];
  overflowCount: number;
  now: number;
}) {
  return (
    <section className={styles.queue}>
      <header className={styles.head}>
        <h2 className={styles.title}>Needs you today</h2>
        <span className={styles.count}>{items.length}</span>
      </header>
      <ul className={styles.list}>
        {items.map((item) => {
          const chip = timeChip(item, now);
          return (
            <li key={item.id}>
              <Link href={item.href} className={styles.row}>
                <span className={`${styles.chip} ${chip.live ? styles.live : ""}`}>
                  {chip.live ? <span className={styles.pulse} aria-hidden="true" /> : <Clock size={13} weight="bold" />}
                  {chip.text}
                </span>
                <span className={styles.body}>
                  <span className={styles.rowTitle}>{item.title}</span>
                  <span className={styles.context}>{item.context}</span>
                </span>
                {item.moneyAtRisk ? (
                  <span className={styles.money}>${Math.round(item.moneyAtRisk).toLocaleString()}</span>
                ) : null}
                <ArrowRight size={16} weight="bold" className={styles.go} />
              </Link>
            </li>
          );
        })}
      </ul>
      {overflowCount > 0 ? (
        <Link href="/admin/tasks" className={styles.more}>
          {overflowCount} more today
          <ArrowRight size={13} weight="bold" />
        </Link>
      ) : null}
    </section>
  );
}
