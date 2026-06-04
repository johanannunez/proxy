import { describe, expect, it } from "vitest";
import { sortByPriority, tierOf } from "./score";
import type { ActionItem } from "./types";

const NOW = new Date("2026-06-03T12:00:00.000Z").getTime();

function item(over: Partial<ActionItem>): ActionItem {
  return {
    id: "x:1",
    type: "risk",
    lane: "riskGuests",
    title: "t",
    context: "c",
    deadline: null,
    liveNow: false,
    moneyAtRisk: null,
    ownerVisible: false,
    href: "/admin",
    ...over,
  };
}

describe("tierOf", () => {
  it("ranks liveNow=0, overdue=1, today=2, soon=3, none=4", () => {
    expect(tierOf(item({ liveNow: true }), NOW)).toBe(0);
    expect(tierOf(item({ deadline: "2026-06-01T00:00:00Z" }), NOW)).toBe(1);
    expect(tierOf(item({ deadline: "2026-06-03T20:00:00Z" }), NOW)).toBe(2);
    expect(tierOf(item({ deadline: "2026-06-07T00:00:00Z" }), NOW)).toBe(3);
    expect(tierOf(item({ deadline: null }), NOW)).toBe(4);
  });
});

describe("sortByPriority", () => {
  it("orders by tier first, money desc within a tier", () => {
    const live = item({ id: "live", liveNow: true });
    const overdueSmall = item({ id: "od-s", deadline: "2026-06-01T00:00:00Z", lane: "money", moneyAtRisk: 100 });
    const overdueBig = item({ id: "od-b", deadline: "2026-06-01T00:00:00Z", lane: "money", moneyAtRisk: 5000 });
    const today = item({ id: "today", deadline: "2026-06-03T20:00:00Z" });

    const out = sortByPriority([today, overdueSmall, live, overdueBig], NOW).map((i) => i.id);
    expect(out).toEqual(["live", "od-b", "od-s", "today"]);
  });

  it("breaks money ties with ownerVisible first", () => {
    const a = item({ id: "a", deadline: "2026-06-01T00:00:00Z", moneyAtRisk: 200, ownerVisible: false });
    const b = item({ id: "b", deadline: "2026-06-01T00:00:00Z", moneyAtRisk: 200, ownerVisible: true });
    expect(sortByPriority([a, b], NOW).map((i) => i.id)).toEqual(["b", "a"]);
  });
});
