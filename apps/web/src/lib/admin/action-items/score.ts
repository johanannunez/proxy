import type { ActionItem } from "./types";

const DAY_MS = 86_400_000;

function endOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** 0 liveNow · 1 overdue · 2 due today · 3 due within 7d · 4 none. Lower is more urgent. */
export function tierOf(item: ActionItem, now: number): number {
  if (item.liveNow) return 0;
  if (item.deadline === null) return 4;
  const due = new Date(item.deadline).getTime();
  if (due < now) return 1;
  if (due <= endOfDay(now)) return 2;
  if (due <= now + 7 * DAY_MS) return 3;
  return 4;
}

/** Returns a sorted copy: time tier, then money desc, then owner-visible, then soonest. */
export function sortByPriority(items: ActionItem[], now: number): ActionItem[] {
  return [...items].sort((a, b) => {
    const ta = tierOf(a, now);
    const tb = tierOf(b, now);
    if (ta !== tb) return ta - tb;

    const ma = a.moneyAtRisk ?? -1;
    const mb = b.moneyAtRisk ?? -1;
    if (ma !== mb) return mb - ma;

    if (a.ownerVisible !== b.ownerVisible) return a.ownerVisible ? -1 : 1;

    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  });
}
