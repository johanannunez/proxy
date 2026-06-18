"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown } from "@phosphor-icons/react";
import { LANE_LABELS, type Lane } from "@/lib/admin/action-items/types";
import styles from "./TriageLane.module.css";

export function TriageLane({ lane }: { lane: Lane }) {
  const [open, setOpen] = useState(false);
  if (lane.count === 0) return null;

  return (
    <div className={styles.lane}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.name}>{LANE_LABELS[lane.key]}</span>
        <span className={styles.count}>{lane.count}</span>
        <span className={styles.worst}>{lane.worst?.title}</span>
        <CaretDown size={15} weight="bold" className={`${styles.caret} ${open ? styles.caretOpen : ""}`} />
      </button>
      {open ? (
        <ul className={styles.items}>
          {lane.items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className={styles.item}>
                <span className={styles.itemTitle}>{item.title}</span>
                <span className={styles.itemContext}>{item.context}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
