import { sortByPriority, tierOf } from "./score";
import { formatUsdShort } from "./format";
import {
  type ActionItem,
  type CockpitView,
  type Lane,
  type LaneKey,
  type PulseAtom,
  LANE_ORDER,
} from "./types";

export const HERO_CAP = 9;

/** Aggregate pulse atoms derived purely from the item stream. */
export function pulseFromItems(items: ActionItem[], now: number): PulseAtom[] {
  const atoms: PulseAtom[] = [];

  const onFire = items.filter((i) => i.liveNow).length;
  if (onFire > 0) {
    atoms.push({ key: "onFire", label: "on fire", value: String(onFire), tone: "red", href: "/admin/tasks" });
  }

  const overdueMoney = items
    .filter((i) => i.lane === "money" && i.deadline !== null && new Date(i.deadline).getTime() < now)
    .reduce((sum, i) => sum + (i.moneyAtRisk ?? 0), 0);
  if (overdueMoney > 0) {
    atoms.push({ key: "overdue", label: "overdue", value: formatUsdShort(overdueMoney), tone: "amber", href: "/admin/finances" });
  }

  const dueToday = items.filter((i) => !i.liveNow && tierOf(i, now) === 2).length;
  if (dueToday > 0) {
    atoms.push({ key: "dueToday", label: "due today", value: String(dueToday), tone: "neutral", href: "/admin/tasks" });
  }

  return atoms;
}

function groupLanes(remainder: ActionItem[]): Lane[] {
  return LANE_ORDER.map((key: LaneKey) => {
    const items = remainder.filter((i) => i.lane === key);
    return { key, count: items.length, items, worst: items[0] ?? null };
  });
}

/**
 * Split a scored stream into the three cockpit views.
 * @param extraAtoms appended after the derived pulse atoms (e.g. pipeline total).
 */
export function composeCockpit(
  items: ActionItem[],
  now: number,
  extraAtoms: PulseAtom[] = [],
): CockpitView {
  const sorted = sortByPriority(items, now);
  const heroEligible = sorted.filter((i) => tierOf(i, now) <= 2);
  const hero = heroEligible.slice(0, HERO_CAP);
  const heroOverflowCount = Math.max(0, heroEligible.length - hero.length);

  const heroIds = new Set(hero.map((i) => i.id));
  const remainder = sorted.filter((i) => !heroIds.has(i.id));

  return {
    pulse: [...pulseFromItems(sorted, now), ...extraAtoms],
    hero,
    heroOverflowCount,
    lanes: groupLanes(remainder),
  };
}
