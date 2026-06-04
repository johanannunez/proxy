import { describe, expect, it } from "vitest";
import { composeCockpit, HERO_CAP } from "./compose";
import type { ActionItem } from "./types";

const NOW = new Date("2026-06-03T12:00:00.000Z").getTime();

function item(over: Partial<ActionItem>): ActionItem {
  return {
    id: `x:${Math.random()}`,
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

describe("composeCockpit", () => {
  it("puts tiers 0-2 in the hero and the rest in lanes", () => {
    const live = item({ id: "live", liveNow: true });
    const soon = item({ id: "soon", deadline: "2026-06-07T00:00:00Z", lane: "growth" });
    const view = composeCockpit([soon, live], NOW);

    expect(view.hero.map((i) => i.id)).toEqual(["live"]);
    const growth = view.lanes.find((l) => l.key === "growth")!;
    expect(growth.items.map((i) => i.id)).toEqual(["soon"]);
    expect(growth.worst?.id).toBe("soon");
  });

  it("caps the hero and reports overflow", () => {
    const many = Array.from({ length: HERO_CAP + 3 }, (_, i) =>
      item({ id: `live-${i}`, liveNow: true }),
    );
    const view = composeCockpit(many, NOW);
    expect(view.hero).toHaveLength(HERO_CAP);
    expect(view.heroOverflowCount).toBe(3);
  });

  it("emits a red on-fire atom when liveNow items exist", () => {
    const view = composeCockpit([item({ liveNow: true }), item({ liveNow: true })], NOW);
    const onFire = view.pulse.find((p) => p.key === "onFire");
    expect(onFire?.value).toBe("2");
    expect(onFire?.tone).toBe("red");
  });

  it("appends extra atoms after derived ones", () => {
    const view = composeCockpit([], NOW, [
      { key: "pipeline", label: "pipeline", value: "$58k", tone: "brand", href: "/admin/prospects" },
    ]);
    expect(view.pulse.at(-1)?.key).toBe("pipeline");
  });
});
