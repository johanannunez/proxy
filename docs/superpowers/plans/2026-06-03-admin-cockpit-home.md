# Admin Cockpit Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the maximalist admin widget wall at `/admin` with a time-first triage cockpit — one pulse line, one ranked "Needs you today" queue, a "you're clear" payoff, and demoted lanes — powered by a pure normalization + scoring engine.

**Architecture:** A pure engine in `src/lib/admin/action-items/` turns the output of the existing (untouched) Supabase fetchers into one comparable `ActionItem[]` stream. A time-first scorer ranks them; a composer splits the stream into pulse atoms, a capped hero queue, and grouped lanes. The page (a server component) calls the existing fetchers, runs the pure adapters/scorer/composer, and renders four thin zones. Only the lane accordion is a client component.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, TypeScript strict, CSS Modules with `globals.css` tokens, Phosphor icons. Vitest (new, scoped to the engine) for the pure logic.

**Spec:** `docs/superpowers/specs/2026-06-03-admin-cockpit-home-design.md`

---

## Key decisions locked for this plan

- **Adapters are pure functions** `(data: SourceData) => ActionItem[]`. The existing async fetchers in `src/lib/admin/dashboard-v2.ts`, `dashboard-data.ts`, and `communications-dashboard-data.ts` are **not modified**. The page calls them, then passes their results to the pure adapters. This keeps the engine unit-testable with no DB.
- **v1 rows route to their `href`** (the page where the item lives). The inline primary action shows a **label** but navigates rather than mutating. True optimistic mutations are deferred (spec open question). This keeps v1 shippable without wiring 9 server actions.
- **Time tiers** (scorer): `0` liveNow, `1` overdue (deadline < now), `2` due today, `3` due within 7 days, `4` none. Hero queue = tiers 0–2. Lanes = everything not shown in the hero.
- **Within a tier:** sort by `moneyAtRisk` desc (nulls last), then `ownerVisible` first, then soonest deadline.

## File structure

```
apps/web/
  vitest.config.ts                                  CREATE  vitest config (engine only)
  package.json                                      MODIFY  add vitest deps + test scripts
  src/lib/admin/action-items/
    types.ts                                        CREATE  ActionItem, LaneKey, PulseAtom, CockpitView
    format.ts                                       CREATE  formatUsdCents, formatUsdShort
    score.ts                                        CREATE  tierOf, sortByPriority
    score.test.ts                                   CREATE
    compose.ts                                      CREATE  composeCockpit, pulseFromItems, HERO_CAP
    compose.test.ts                                 CREATE
    adapters/index.ts                               CREATE  barrel + buildActionItems orchestrator
    adapters/invoices.ts                            CREATE
    adapters/schedule.ts                            CREATE
    adapters/risk.ts                                CREATE
    adapters/onboarding.ts                          CREATE
    adapters/maintenance.ts                         CREATE
    adapters/projects.ts                            CREATE
    adapters/leads.ts                               CREATE  cold + winback -> growth
    adapters/guests.ts                              CREATE  houseActions + comms -> riskGuests
    adapters/adapters.test.ts                       CREATE
  src/app/(admin)/admin/
    page.tsx                                         REWRITE the cockpit
    Today.module.css                                CREATE  page layout
    PulseBar.tsx + PulseBar.module.css              CREATE  Zone 1
    NowQueue.tsx + NowQueue.module.css              CREATE  Zone 2 (+ ActionRow)
    ClearState.tsx + ClearState.module.css          CREATE  Zone 3
    TriageLane.tsx + TriageLane.module.css          CREATE  Zone 4 (client accordion)
  src/app/(admin)/admin/properties/page.tsx         MODIFY  relocate PropertyHealthGrid (Task 13)
```

---

### Task 1: Vitest setup + first failing scorer test

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/admin/action-items/score.test.ts`

- [ ] **Step 1: Install dev dependencies**

Run (from `apps/web`):
```bash
pnpm add -D vitest@^3 vite-tsconfig-paths@^5
```

- [ ] **Step 2: Add test scripts to package.json**

In `apps/web/package.json`, add to the `"scripts"` object:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest config**

Create `apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/lib/admin/action-items/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing scorer test**

Create `apps/web/src/lib/admin/action-items/score.test.ts`:
```ts
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
```

- [ ] **Step 5: Run the test to verify it fails**

Run (from `apps/web`): `pnpm test`
Expected: FAIL — cannot resolve `./score` / `./types` (modules not yet created).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/vitest.config.ts apps/web/src/lib/admin/action-items/score.test.ts
git commit -m "test: scaffold vitest + failing action-item scorer test"
```

---

### Task 2: ActionItem types and money formatters

**Files:**
- Create: `apps/web/src/lib/admin/action-items/types.ts`
- Create: `apps/web/src/lib/admin/action-items/format.ts`

- [ ] **Step 1: Create the types**

Create `apps/web/src/lib/admin/action-items/types.ts`:
```ts
export type ActionItemType =
  | "invoice"
  | "risk"
  | "onboarding"
  | "guest"
  | "maintenance"
  | "project"
  | "schedule"
  | "lead"
  | "winback";

export type LaneKey = "money" | "onboarding" | "riskGuests" | "growth";

export type PulseTone = "red" | "amber" | "neutral" | "brand";

export type ActionItem = {
  /** Globally unique across sources: `${type}:${sourceId}`. */
  id: string;
  type: ActionItemType;
  lane: LaneKey;
  /** Human sentence, not a data row. */
  title: string;
  context: string;
  /** ISO timestamp of the hard clock, if any. */
  deadline: string | null;
  /** Actively happening right now. */
  liveNow: boolean;
  /** Dollars (not cents) at stake, if quantifiable. */
  moneyAtRisk: number | null;
  ownerVisible: boolean;
  href: string;
};

export type PulseAtom = {
  key: string;
  label: string;
  value: string;
  tone: PulseTone;
  href: string;
};

export type Lane = {
  key: LaneKey;
  count: number;
  items: ActionItem[];
  worst: ActionItem | null;
};

export type CockpitView = {
  pulse: PulseAtom[];
  hero: ActionItem[];
  heroOverflowCount: number;
  lanes: Lane[];
};

export const LANE_ORDER: LaneKey[] = ["money", "onboarding", "riskGuests", "growth"];

export const LANE_LABELS: Record<LaneKey, string> = {
  money: "Money",
  onboarding: "Onboarding",
  riskGuests: "Risk & Guests",
  growth: "Growth",
};
```

- [ ] **Step 2: Create the formatters**

Create `apps/web/src/lib/admin/action-items/format.ts`:
```ts
/** "$4,250" from 425000 cents. */
export function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Compact: 58200 -> "$58k", 4250 -> "$4.3k", 900 -> "$900". */
export function formatUsdShort(dollars: number): string {
  if (Math.abs(dollars) >= 1000) {
    const k = dollars / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `$${rounded}k`;
  }
  return `$${Math.round(dollars)}`;
}
```

- [ ] **Step 3: Typecheck**

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: PASS (these files alone introduce no errors).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/admin/action-items/types.ts apps/web/src/lib/admin/action-items/format.ts
git commit -m "feat: action-item types and money formatters"
```

---

### Task 3: The time-first scorer

**Files:**
- Create: `apps/web/src/lib/admin/action-items/score.ts`

- [ ] **Step 1: Implement the scorer**

Create `apps/web/src/lib/admin/action-items/score.ts`:
```ts
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
```

- [ ] **Step 2: Run the scorer test to verify it passes**

Run (from `apps/web`): `pnpm test`
Expected: PASS — both `score.test.ts` describe blocks green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/admin/action-items/score.ts
git commit -m "feat: time-first action-item scorer"
```

---

### Task 4: The composer (pulse + hero + lanes)

**Files:**
- Create: `apps/web/src/lib/admin/action-items/compose.ts`
- Create: `apps/web/src/lib/admin/action-items/compose.test.ts`

- [ ] **Step 1: Write the failing composer test**

Create `apps/web/src/lib/admin/action-items/compose.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./compose`.

- [ ] **Step 3: Implement the composer**

Create `apps/web/src/lib/admin/action-items/compose.ts`:
```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test`
Expected: PASS — `score.test.ts` and `compose.test.ts` all green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/admin/action-items/compose.ts apps/web/src/lib/admin/action-items/compose.test.ts
git commit -m "feat: cockpit composer (pulse, hero, lanes)"
```

---

### Task 5: Adapters batch 1 — invoices, schedule, risk

**Files:**
- Create: `apps/web/src/lib/admin/action-items/adapters/invoices.ts`
- Create: `apps/web/src/lib/admin/action-items/adapters/schedule.ts`
- Create: `apps/web/src/lib/admin/action-items/adapters/risk.ts`

- [ ] **Step 1: Invoices adapter (money lane)**

Create `apps/web/src/lib/admin/action-items/adapters/invoices.ts`:
```ts
import type { OpenInvoicesData } from "@/lib/admin/dashboard-v2";
import { formatUsdCents } from "../format";
import type { ActionItem } from "../types";

export function invoiceActionItems(data: OpenInvoicesData): ActionItem[] {
  return data.invoices.map((inv) => ({
    id: `invoice:${inv.id}`,
    type: "invoice",
    lane: "money",
    title: `${inv.ownerName} owes ${formatUsdCents(inv.amountCents)}`,
    context: inv.daysOverdue > 0 ? `${inv.daysOverdue}d overdue · ${inv.kind}` : inv.kind,
    deadline: inv.dueAt,
    liveNow: false,
    moneyAtRisk: inv.amountCents / 100,
    ownerVisible: true,
    href: "/admin/finances",
  }));
}
```

- [ ] **Step 2: Schedule adapter (today's tasks)**

Create `apps/web/src/lib/admin/action-items/adapters/schedule.ts`:
```ts
import type { TodayScheduleData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function scheduleActionItems(data: TodayScheduleData): ActionItem[] {
  return data.items.map((it) => ({
    id: `schedule:${it.id}`,
    type: "schedule",
    lane: "riskGuests",
    title: it.title,
    context: [it.propertyName, it.contactName].filter(Boolean).join(" · ") || it.taskType,
    deadline: it.dueAt,
    liveNow: false,
    moneyAtRisk: null,
    ownerVisible: false,
    href: "/admin/tasks",
  }));
}
```

- [ ] **Step 3: Risk adapter (critical = liveNow)**

Create `apps/web/src/lib/admin/action-items/adapters/risk.ts`:
```ts
import type { AIRiskDigestData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function riskActionItems(data: AIRiskDigestData): ActionItem[] {
  return data.insights.map((i) => ({
    id: `risk:${i.id}`,
    type: "risk",
    lane: "riskGuests",
    title: i.title,
    context: i.propertyName,
    deadline: null,
    liveNow: i.isCritical,
    moneyAtRisk: null,
    ownerVisible: true,
    href: `/admin/properties/${i.propertyId}`,
  }));
}
```

- [ ] **Step 4: Typecheck**

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/admin/action-items/adapters/invoices.ts apps/web/src/lib/admin/action-items/adapters/schedule.ts apps/web/src/lib/admin/action-items/adapters/risk.ts
git commit -m "feat: action-item adapters for invoices, schedule, risk"
```

---

### Task 6: Adapters batch 2 — onboarding, maintenance, projects

**Files:**
- Create: `apps/web/src/lib/admin/action-items/adapters/onboarding.ts`
- Create: `apps/web/src/lib/admin/action-items/adapters/maintenance.ts`
- Create: `apps/web/src/lib/admin/action-items/adapters/projects.ts`

- [ ] **Step 1: Onboarding adapter (stalled only)**

Create `apps/web/src/lib/admin/action-items/adapters/onboarding.ts`:
```ts
import type { OnboardingProgressData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

const STALLED_DAYS = 7;

export function onboardingActionItems(data: OnboardingProgressData): ActionItem[] {
  return data.contacts
    .filter((c) => c.daysInStage >= STALLED_DAYS || c.properties.some((p) => p.worstStatus === "stuck"))
    .map((c) => {
      const stuck = c.properties.find((p) => p.worstStatus === "stuck");
      return {
        id: `onboarding:${c.id}`,
        type: "onboarding",
        lane: "onboarding",
        title: `${c.name}'s onboarding is stalled`,
        context: stuck
          ? `${stuck.address} stuck · ${c.daysInStage}d in stage`
          : `${c.daysInStage}d in stage`,
        deadline: null,
        liveNow: false,
        moneyAtRisk: null,
        ownerVisible: true,
        href: `/admin/people/${c.id}`,
      };
    });
}
```

- [ ] **Step 2: Maintenance adapter**

Create `apps/web/src/lib/admin/action-items/adapters/maintenance.ts`:
```ts
import type { RecurringMaintenanceData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function maintenanceActionItems(data: RecurringMaintenanceData): ActionItem[] {
  return data.tasks.map((t) => ({
    id: `maintenance:${t.id}`,
    type: "maintenance",
    lane: "riskGuests",
    title: `${t.templateName} at ${t.propertyName}`,
    context: t.isOverdue ? `${Math.abs(t.daysUntilDue)}d overdue` : `due in ${t.daysUntilDue}d`,
    deadline: t.nextDueAt,
    liveNow: false,
    moneyAtRisk: null,
    ownerVisible: false,
    href: t.propertyId ? `/admin/properties/${t.propertyId}` : "/admin/tasks",
  }));
}
```

- [ ] **Step 3: Projects adapter (blocked only)**

Create `apps/web/src/lib/admin/action-items/adapters/projects.ts`:
```ts
import type { ProjectBoardData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function projectActionItems(data: ProjectBoardData): ActionItem[] {
  return data.blockedProjects.map((p) => ({
    id: `project:${p.id}`,
    type: "project",
    lane: "onboarding",
    title: `${p.emoji ? `${p.emoji} ` : ""}${p.name} is blocked`,
    context: `${p.daysSinceUpdate}d since last update`,
    deadline: null,
    liveNow: false,
    moneyAtRisk: null,
    ownerVisible: false,
    href: `/admin/projects/${p.id}`,
  }));
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/admin/action-items/adapters/onboarding.ts apps/web/src/lib/admin/action-items/adapters/maintenance.ts apps/web/src/lib/admin/action-items/adapters/projects.ts
git commit -m "feat: action-item adapters for onboarding, maintenance, projects"
```

---

### Task 7: Adapters batch 3 — leads, guests — plus barrel + adapter tests

**Files:**
- Create: `apps/web/src/lib/admin/action-items/adapters/leads.ts`
- Create: `apps/web/src/lib/admin/action-items/adapters/guests.ts`
- Create: `apps/web/src/lib/admin/action-items/adapters/index.ts`
- Create: `apps/web/src/lib/admin/action-items/adapters/adapters.test.ts`

- [ ] **Step 1: Leads adapter (cold + winback -> growth)**

Create `apps/web/src/lib/admin/action-items/adapters/leads.ts`:
```ts
import type { ColdLeadsData, WinbackQueueData } from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";

export function coldLeadActionItems(data: ColdLeadsData): ActionItem[] {
  return data.topLeads.map((l) => ({
    id: `lead:${l.id}`,
    type: "lead",
    lane: "growth",
    title: `${l.name} has gone cold`,
    context: `${l.daysDormant}d dormant${l.estimatedMrr ? ` · ~$${l.estimatedMrr}/mo` : ""}`,
    deadline: null,
    liveNow: false,
    moneyAtRisk: l.estimatedMrr || null,
    ownerVisible: false,
    href: `/admin/people/${l.id}`,
  }));
}

export function winbackActionItems(data: WinbackQueueData): ActionItem[] {
  return data.contacts.map((c) => ({
    id: `winback:${c.id}`,
    type: "winback",
    lane: "growth",
    title: c.insightTitle ?? `Win back ${c.name}`,
    context: `${c.stage} · ${c.daysDormant}d dormant`,
    deadline: null,
    liveNow: false,
    moneyAtRisk: c.estimatedMrr || null,
    ownerVisible: false,
    href: `/admin/people/${c.id}`,
  }));
}
```

- [ ] **Step 2: Guests adapter (house actions + unresolved callers)**

Create `apps/web/src/lib/admin/action-items/adapters/guests.ts`:
```ts
import type { EnrichedInsight } from "@/lib/admin/dashboard-data";
import type { CommunicationsDashboardData } from "@/lib/admin/communications-dashboard-data";
import type { ActionItem } from "../types";

export function guestActionItems(houseActions: EnrichedInsight[]): ActionItem[] {
  return houseActions.map((a) => ({
    id: `guest:${a.id}`,
    type: "guest",
    lane: "riskGuests",
    title: a.title,
    context: a.propertyName,
    deadline: null,
    liveNow: a.severity === "warning",
    moneyAtRisk: null,
    ownerVisible: true,
    href: `/admin/properties/${a.propertyId}`,
  }));
}

export function callerActionItems(data: CommunicationsDashboardData): ActionItem[] {
  return data.unresolvedCallers.map((c) => ({
    id: `caller:${c.phone}`,
    type: "guest",
    lane: "riskGuests",
    title: `Unresolved call from ${c.phone}`,
    context: c.claudeSummary ?? "No summary yet",
    deadline: c.createdAt,
    liveNow: true,
    moneyAtRisk: null,
    ownerVisible: false,
    href: "/admin/inbox",
  }));
}
```

- [ ] **Step 3: Barrel + orchestrator**

Create `apps/web/src/lib/admin/action-items/adapters/index.ts`:
```ts
import type { EnrichedInsight } from "@/lib/admin/dashboard-data";
import type { CommunicationsDashboardData } from "@/lib/admin/communications-dashboard-data";
import type {
  AIRiskDigestData,
  ColdLeadsData,
  OnboardingProgressData,
  OpenInvoicesData,
  ProjectBoardData,
  RecurringMaintenanceData,
  TodayScheduleData,
  WinbackQueueData,
} from "@/lib/admin/dashboard-v2";
import type { ActionItem } from "../types";
import { invoiceActionItems } from "./invoices";
import { scheduleActionItems } from "./schedule";
import { riskActionItems } from "./risk";
import { onboardingActionItems } from "./onboarding";
import { maintenanceActionItems } from "./maintenance";
import { projectActionItems } from "./projects";
import { coldLeadActionItems, winbackActionItems } from "./leads";
import { guestActionItems, callerActionItems } from "./guests";

export type ActionItemSources = {
  invoices: OpenInvoicesData;
  schedule: TodayScheduleData;
  risk: AIRiskDigestData;
  onboarding: OnboardingProgressData;
  maintenance: RecurringMaintenanceData;
  projects: ProjectBoardData;
  coldLeads: ColdLeadsData;
  winback: WinbackQueueData;
  houseActions: EnrichedInsight[];
  communications: CommunicationsDashboardData;
};

/** Flatten every source into one ActionItem stream. Pure. */
export function buildActionItems(s: ActionItemSources): ActionItem[] {
  return [
    ...invoiceActionItems(s.invoices),
    ...scheduleActionItems(s.schedule),
    ...riskActionItems(s.risk),
    ...onboardingActionItems(s.onboarding),
    ...maintenanceActionItems(s.maintenance),
    ...projectActionItems(s.projects),
    ...coldLeadActionItems(s.coldLeads),
    ...winbackActionItems(s.winback),
    ...guestActionItems(s.houseActions),
    ...callerActionItems(s.communications),
  ];
}

export {
  invoiceActionItems,
  scheduleActionItems,
  riskActionItems,
  onboardingActionItems,
  maintenanceActionItems,
  projectActionItems,
  coldLeadActionItems,
  winbackActionItems,
  guestActionItems,
  callerActionItems,
};
```

- [ ] **Step 4: Write adapter tests**

Create `apps/web/src/lib/admin/action-items/adapters/adapters.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { invoiceActionItems } from "./invoices";
import { riskActionItems } from "./risk";
import { coldLeadActionItems } from "./leads";

describe("invoiceActionItems", () => {
  it("maps cents to dollars, money lane, owner-visible", () => {
    const out = invoiceActionItems({
      invoices: [{ id: "i1", ownerName: "Maria", ownerId: "o1", amountCents: 425000, kind: "monthly", status: "open", dueAt: "2026-06-01T00:00:00Z", daysOverdue: 2 }],
      totalCents: 425000,
      overdueCount: 1,
      total: 1,
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "invoice:i1", lane: "money", moneyAtRisk: 4250, ownerVisible: true });
    expect(out[0].title).toContain("Maria");
    expect(out[0].context).toContain("2d overdue");
  });
});

describe("riskActionItems", () => {
  it("marks critical insights as liveNow", () => {
    const out = riskActionItems({
      insights: [{ id: "r1", propertyId: "p1", propertyName: "14 Oak", agentKey: "k", severity: "warning", title: "No hot water", body: "b", createdAt: "2026-06-03T00:00:00Z", isCritical: true }],
      totalUnresolved: 1,
      criticalCount: 1,
      warningCount: 0,
    });
    expect(out[0]).toMatchObject({ id: "risk:r1", liveNow: true, href: "/admin/properties/p1" });
  });
});

describe("coldLeadActionItems", () => {
  it("uses estimatedMrr as moneyAtRisk, null when zero", () => {
    const out = coldLeadActionItems({
      total: 2,
      topLeads: [
        { id: "c1", name: "Sam", daysDormant: 30, estimatedMrr: 1200, lastStage: "lead_cold" },
        { id: "c2", name: "Dee", daysDormant: 12, estimatedMrr: 0, lastStage: "lead_cold" },
      ],
    });
    expect(out[0].moneyAtRisk).toBe(1200);
    expect(out[1].moneyAtRisk).toBeNull();
  });
});
```

> Note: the test objects above are typed structurally against the real `*Data` shapes. If a field name drifts, `pnpm exec tsc --noEmit` (Task 15) will catch it; the runtime test only needs the fields each adapter reads.

- [ ] **Step 5: Run the full engine test suite**

Run (from `apps/web`): `pnpm test`
Expected: PASS — score, compose, and adapters suites all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/admin/action-items/adapters/
git commit -m "feat: leads + guest adapters, orchestrator, adapter tests"
```

---

### Task 8: Zone 1 — PulseBar

**Files:**
- Create: `apps/web/src/app/(admin)/admin/PulseBar.tsx`
- Create: `apps/web/src/app/(admin)/admin/PulseBar.module.css`

- [ ] **Step 1: Component**

Create `apps/web/src/app/(admin)/admin/PulseBar.tsx`:
```tsx
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
```

- [ ] **Step 2: Styles**

Create `apps/web/src/app/(admin)/admin/PulseBar.module.css`:
```css
.bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 14px 18px;
  background: var(--color-white);
  border: 1px solid var(--color-warm-gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
.greeting {
  font-family: var(--font-sora);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}
.atoms { display: flex; flex-wrap: wrap; gap: 10px; margin-left: auto; }
.atom {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  background: var(--color-warm-gray-50);
  text-decoration: none;
  transition: transform 160ms var(--ease-spring), background-color 160ms var(--ease-spring);
}
.atom:hover { transform: translateY(-1px); }
.atom:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.value { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text-primary); }
.label { font-size: 13px; color: var(--color-text-secondary); }
.red .dot { background: var(--color-error); }
.amber .dot { background: #f59e0b; }
.neutral .dot { background: var(--color-text-secondary); }
.brand .dot { background: var(--color-brand); }
.allClear { margin-left: auto; font-size: 13px; color: var(--color-text-secondary); }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(admin)/admin/PulseBar.tsx" "apps/web/src/app/(admin)/admin/PulseBar.module.css"
git commit -m "feat: cockpit Zone 1 PulseBar"
```

---

### Task 9: Zone 2 — NowQueue + ActionRow

**Files:**
- Create: `apps/web/src/app/(admin)/admin/NowQueue.tsx`
- Create: `apps/web/src/app/(admin)/admin/NowQueue.module.css`

- [ ] **Step 1: Component (server; rows link to href)**

Create `apps/web/src/app/(admin)/admin/NowQueue.tsx`:
```tsx
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
```

- [ ] **Step 2: Styles**

Create `apps/web/src/app/(admin)/admin/NowQueue.module.css`:
```css
.queue {
  background: var(--color-white);
  border: 1px solid var(--color-warm-gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
.head { display: flex; align-items: center; gap: 10px; padding: 18px 20px 12px; }
.title { font-family: var(--font-sora); font-size: 18px; font-weight: 600; letter-spacing: -0.01em; color: var(--color-text-primary); }
.count {
  display: inline-flex; min-width: 22px; height: 22px; padding: 0 7px;
  align-items: center; justify-content: center;
  border-radius: 999px; background: var(--color-brand); color: #fff;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
}
.list { list-style: none; margin: 0; padding: 0; }
.row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-warm-gray-100);
  text-decoration: none;
  transition: background-color 140ms var(--ease-spring);
}
.row:hover { background: var(--color-warm-gray-50); }
.row:focus-visible { outline: 2px solid var(--color-brand); outline-offset: -2px; }
.chip {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  min-width: 74px; padding: 4px 9px;
  border-radius: var(--radius-sm);
  background: var(--color-warm-gray-100);
  font-size: 12px; font-weight: 600; color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.live { background: rgba(220, 38, 38, 0.10); color: var(--color-error); }
.pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--color-error); animation: livePulse 1.6s var(--ease-spring) infinite; }
@keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.35); } }
.body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.rowTitle { font-size: 14px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.context { font-size: 13px; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.money { flex-shrink: 0; font-size: 13px; font-weight: 700; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
.go { flex-shrink: 0; color: var(--color-text-tertiary); }
.more {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 12px; border-top: 1px solid var(--color-warm-gray-100);
  font-size: 13px; font-weight: 600; color: var(--color-brand); text-decoration: none;
}
.more:hover { background: var(--color-warm-gray-50); }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(admin)/admin/NowQueue.tsx" "apps/web/src/app/(admin)/admin/NowQueue.module.css"
git commit -m "feat: cockpit Zone 2 NowQueue"
```

---

### Task 10: Zone 3 — ClearState

**Files:**
- Create: `apps/web/src/app/(admin)/admin/ClearState.tsx`
- Create: `apps/web/src/app/(admin)/admin/ClearState.module.css`

- [ ] **Step 1: Component**

Create `apps/web/src/app/(admin)/admin/ClearState.tsx`:
```tsx
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import styles from "./ClearState.module.css";

export function ClearState({ subline }: { subline: string }) {
  return (
    <section className={styles.clear}>
      <span className={styles.badge}>
        <CheckCircle size={26} weight="duotone" />
      </span>
      <h2 className={styles.title}>Nothing needs you right now</h2>
      <p className={styles.sub}>{subline}</p>
    </section>
  );
}
```

- [ ] **Step 2: Styles**

Create `apps/web/src/app/(admin)/admin/ClearState.module.css`:
```css
.clear {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 8px; padding: 44px 24px;
  background: var(--color-white);
  border: 1px solid var(--color-warm-gray-200);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}
.badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(22, 163, 74, 0.10); color: var(--color-success);
  margin-bottom: 4px;
}
.title { font-family: var(--font-sora); font-size: 18px; font-weight: 600; color: var(--color-text-primary); }
.sub { font-size: 14px; color: var(--color-text-secondary); max-width: 360px; }
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → PASS
```bash
git add "apps/web/src/app/(admin)/admin/ClearState.tsx" "apps/web/src/app/(admin)/admin/ClearState.module.css"
git commit -m "feat: cockpit Zone 3 ClearState"
```

---

### Task 11: Zone 4 — TriageLane (client accordion)

**Files:**
- Create: `apps/web/src/app/(admin)/admin/TriageLane.tsx`
- Create: `apps/web/src/app/(admin)/admin/TriageLane.module.css`

- [ ] **Step 1: Component (client; collapse state)**

Create `apps/web/src/app/(admin)/admin/TriageLane.tsx`:
```tsx
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
```

- [ ] **Step 2: Styles**

Create `apps/web/src/app/(admin)/admin/TriageLane.module.css`:
```css
.lane {
  background: var(--color-white);
  border: 1px solid var(--color-warm-gray-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.header {
  display: flex; align-items: center; gap: 12px; width: 100%;
  padding: 14px 18px; background: none; border: none; cursor: pointer; text-align: left;
  transition: background-color 140ms var(--ease-spring);
}
.header:hover { background: var(--color-warm-gray-50); }
.header:focus-visible { outline: 2px solid var(--color-brand); outline-offset: -2px; }
.name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); flex-shrink: 0; }
.count {
  display: inline-flex; min-width: 20px; height: 20px; padding: 0 6px;
  align-items: center; justify-content: center; border-radius: 999px;
  background: var(--color-warm-gray-100); color: var(--color-text-secondary);
  font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.worst { font-size: 13px; color: var(--color-text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.caret { color: var(--color-text-tertiary); flex-shrink: 0; transition: transform 200ms var(--ease-spring); }
.caretOpen { transform: rotate(180deg); }
.items { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--color-warm-gray-100); }
.item { display: flex; flex-direction: column; gap: 2px; padding: 11px 18px; text-decoration: none; border-top: 1px solid var(--color-warm-gray-100); }
.item:first-child { border-top: none; }
.item:hover { background: var(--color-warm-gray-50); }
.itemTitle { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.itemContext { font-size: 12px; color: var(--color-text-secondary); }
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → PASS
```bash
git add "apps/web/src/app/(admin)/admin/TriageLane.tsx" "apps/web/src/app/(admin)/admin/TriageLane.module.css"
git commit -m "feat: cockpit Zone 4 TriageLane accordion"
```

---

### Task 12: Rewrite the admin page as the cockpit

**Files:**
- Rewrite: `apps/web/src/app/(admin)/admin/page.tsx`
- Create: `apps/web/src/app/(admin)/admin/Today.module.css`

- [ ] **Step 1: Replace the page**

Replace the entire contents of `apps/web/src/app/(admin)/admin/page.tsx` with:
```tsx
import type { Metadata } from "next";
import {
  fetchOpenInvoices,
  fetchTodaySchedule,
  fetchAIRiskDigest,
  fetchOnboardingProgress,
  fetchRecurringMaintenance,
  fetchProjectBoard,
  fetchColdLeads,
  fetchWinbackQueue,
  fetchPipelinePulse,
  fetchRevenueCollectedTrend,
} from "@/lib/admin/dashboard-v2";
import { fetchDashboardData, fetchGuestIntelligenceInsights } from "@/lib/admin/dashboard-data";
import { fetchCommunicationsDashboard } from "@/lib/admin/fetch-communications";
import { buildActionItems } from "@/lib/admin/action-items/adapters";
import { composeCockpit } from "@/lib/admin/action-items/compose";
import { formatUsdShort } from "@/lib/admin/action-items/format";
import type { PulseAtom } from "@/lib/admin/action-items/types";
import { PulseBar } from "./PulseBar";
import { NowQueue } from "./NowQueue";
import { ClearState } from "./ClearState";
import { TriageLane } from "./TriageLane";
import styles from "./Today.module.css";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

function greeting(now: Date): string {
  const h = now.getHours();
  const part = h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
  return `Good ${part}, Jo`;
}

export default async function AdminTodayPage() {
  const [
    invoices,
    schedule,
    risk,
    onboarding,
    maintenance,
    projects,
    coldLeads,
    winback,
    pipeline,
    revenueTrend,
    { propertyCards },
    communications,
  ] = await Promise.all([
    fetchOpenInvoices(),
    fetchTodaySchedule(),
    fetchAIRiskDigest(),
    fetchOnboardingProgress(),
    fetchRecurringMaintenance(),
    fetchProjectBoard(),
    fetchColdLeads(),
    fetchWinbackQueue(),
    fetchPipelinePulse(),
    fetchRevenueCollectedTrend().catch(() => [] as { date: string; value: number }[]),
    fetchDashboardData(),
    fetchCommunicationsDashboard().catch(() => ({ recentActionItems: [], unresolvedCallers: [] })),
  ]);

  const propertyRefs = propertyCards.map((c) => ({ id: c.id, name: c.address ?? c.name }));
  const { houseActions } = await fetchGuestIntelligenceInsights(propertyRefs).catch(() => ({
    ownerUpdates: [],
    houseActions: [],
  }));

  const items = buildActionItems({
    invoices,
    schedule,
    risk,
    onboarding,
    maintenance,
    projects,
    coldLeads,
    winback,
    houseActions,
    communications,
  });

  const now = Date.now();
  const pipelineAtom: PulseAtom = {
    key: "pipeline",
    label: "pipeline",
    value: formatUsdShort(pipeline.totalPipelineValue),
    tone: "brand",
    href: "/admin/prospects",
  };
  const view = composeCockpit(items, now, [pipelineAtom]);

  const revenueCollected = revenueTrend.reduce((sum, p) => sum + p.value, 0);
  const healthyCount = propertyCards.length;
  const clearSubline = `${healthyCount} ${healthyCount === 1 ? "property" : "properties"} tracked · ${formatUsdShort(revenueCollected)} collected this month`;

  return (
    <div className={styles.page}>
      <PulseBar greeting={greeting(new Date(now))} atoms={view.pulse} />

      {view.hero.length > 0 ? (
        <NowQueue items={view.hero} overflowCount={view.heroOverflowCount} now={now} />
      ) : (
        <ClearState subline={clearSubline} />
      )}

      <div className={styles.lanes}>
        {view.lanes.map((lane) => (
          <TriageLane key={lane.key} lane={lane} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Page layout styles**

Create `apps/web/src/app/(admin)/admin/Today.module.css`:
```css
.page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
}
.lanes { display: flex; flex-direction: column; gap: 10px; }
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. If an import of a removed symbol errors, it is from the old page body — ensure the file matches Step 1 exactly.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(admin)/admin/page.tsx" "apps/web/src/app/(admin)/admin/Today.module.css"
git commit -m "feat: rewrite /admin as the time-first triage cockpit (Today)"
```

---

### Task 13: Relocate Property Health to /admin/properties; rename nav label

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/properties/page.tsx`
- Modify: admin sidebar nav (label "Dashboard" → "Today")

- [ ] **Step 1: Inspect the properties page**

Run (from `apps/web`): `sed -n '1,60p' "src/app/(admin)/admin/properties/page.tsx"`
Read its structure and note the top-level wrapper element and how it imports server data.

- [ ] **Step 2: Decision rule for the health grid**

The `PropertyHealthGrid` component and its data come from the old dashboard. To avoid coupling the properties page to dashboard internals, **do not** import the old widget. The properties page already lists properties; the per-property Docs/Fin/List health belongs there as a follow-up and is **explicitly deferred** (see "Deferred" section). For this task, only verify the grid is gone from the home (it is, after Task 12) and leave a tracking note.

- [ ] **Step 3: Find and rename the nav label**

Run (from `apps/web`): `grep -rn ">Dashboard<\|\"Dashboard\"\|'Dashboard'" src/components/admin/ src/app/\(admin\)`
Identify the sidebar/nav entry whose `href` is `/admin`. Change its visible label from `Dashboard` to `Today`. Change only the label string for the `/admin` link; do not touch unrelated "Dashboard" strings (e.g. analytics pages).

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit` → PASS
Run: `pnpm lint` → no new errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: rename admin home nav label Dashboard -> Today"
```

---

### Task 14: Remove now-unused dashboard widget files

**Files:**
- Delete: old home-only widget components verified to have no other importers.

- [ ] **Step 1: List the candidates**

Candidates (home-only widgets and customizer):
`CommandStrip` `AIBriefingCard` `KPISparklineRow` `PipelinePulse` `ColdLeadsWidget` `OwnerActivityWidget` `TodayScheduleWidget` `OnboardingProgressWidget` `AIRiskDigest` `AllocationHealthWidget` `OpenInvoicesWidget` `RecurringMaintenanceWidget` `ProjectBoardWidget` `WinbackQueueWidget` `GuestPulse` `PropertyHealthGrid` `DashboardClientShell` `DashboardCustomizer` `DashboardTaskSurface` `AttentionQueue` `WidgetShell` `InsightDetailPanel` `KPISparklineRow`.

- [ ] **Step 2: For EACH candidate, check for importers outside the admin home folder**

Run (from `apps/web`), replacing `NAME`:
```bash
grep -rn "NAME" src --include=*.tsx --include=*.ts | grep -v "src/app/(admin)/admin/NAME" | grep -v "src/app/(admin)/admin/page.tsx"
```
- If the command prints **nothing**, the component is safe to delete (`NAME.tsx` + `NAME.module.css`).
- If it prints any line, **keep** that component (it is used elsewhere) and remove it from the deletion list.

- [ ] **Step 3: Delete the confirmed-unused files**

For each confirmed-safe `NAME`, run:
```bash
git rm "src/app/(admin)/admin/NAME.tsx" "src/app/(admin)/admin/NAME.module.css"
```
(Use `git rm` so deletions are staged. If a `.module.css` does not exist for a given component, omit it.)

- [ ] **Step 4: Verify nothing references deleted files**

Run: `pnpm exec tsc --noEmit`
Expected: PASS. A failure here means something still imports a deleted file — restore that file (`git checkout -- <path>`) and keep it.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove dashboard widgets superseded by the cockpit"
```

---

### Task 15: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Engine tests**

Run (from `apps/web`): `pnpm test`
Expected: PASS — all score/compose/adapter suites green.

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no new errors in the new files. Fix any (no `any`, no unused imports).

- [ ] **Step 4: Production build**

Run: `doppler run -- next build`
Expected: build succeeds; `/admin` compiles as a dynamic route.

- [ ] **Step 5: Visual check in the browser**

Start dev (`doppler run -- next dev -p 4000`) in a background shell, then with gstack browse (`B=~/.claude/skills/gstack/browse/dist/browse`):
```bash
$B goto http://localhost:4000/api/dev/auth
$B goto http://localhost:4000/admin
$B screenshot /tmp/cockpit.png
```
Read `/tmp/cockpit.png`. Confirm: PulseBar row, "Needs you today" queue (or ClearState if empty), four collapsed lanes, single-column ≤920px layout. Capture mobile too: `$B responsive /tmp/cockpit-mobile`.

- [ ] **Step 6: Final commit (if lint/build fixes were needed)**

```bash
git add -A
git commit -m "fix: cockpit lint/build cleanups"
```

---

## Deferred (explicitly out of scope, not silently dropped)

- **Inline optimistic actions** on Now Queue rows (mark-paid, message-guest). v1 rows route to their page.
- **Relocating `PropertyHealthGrid` and the KPI/trend charts** to `/admin/properties`, `/admin/prospects`, `/admin/finances`. They are removed from the home now; re-homing them on their domain pages is a follow-up.
- **Owner home** (`/workspace/home`) derivation from the same engine.
- **Notifications** consuming the engine.
- **Tunable scoring weights** UI.

## Self-review notes

- **Spec coverage:** Zone 1 (Task 8), Zone 2 (Task 9), Zone 3 (Task 10), Zone 4 (Task 11), engine types/scorer/composer/adapters (Tasks 2–7), page wiring + rename (Task 12–13), removals (Task 14). All spec sections mapped.
- **Type consistency:** `ActionItem`, `Lane`, `PulseAtom`, `CockpitView`, `LANE_ORDER`, `LANE_LABELS` defined once in `types.ts` and imported everywhere. `tierOf`/`sortByPriority` names stable across score/compose/NowQueue. `composeCockpit(items, now, extraAtoms)` signature consistent between test, impl, and page.
- **Adapter field accuracy:** each adapter reads only fields verified present in the source `*Data` types in `dashboard-v2.ts` / `dashboard-data.ts` / `communications-dashboard-data.ts`.
