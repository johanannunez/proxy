# Admin Cockpit Home — Design Spec

Date: 2026-06-03
Surface: `/admin` (admin landing page, `apps/web/src/app/(admin)/admin/page.tsx`)
Status: Approved design, pending implementation plan

---

## Problem

The current admin home is a maximalist widget wall: a command strip, an AI
briefing card, a 3-KPI sparkline row, an 11-widget bento grid across four
labeled sections, a Guest Intelligence panel, a Communications panel, and a
full Property Health grid. Roughly 18 distinct information surfaces and 17
parallel data fetches on one screen, plus a `DashboardCustomizer` to rearrange
the pile.

It answers "what is the state of everything" but never the question an operator
actually opens it to answer: **"What needs me right now, and is anything
actually on fire?"**

A customizer is the symptom: it is what gets built when no single thing was
chosen as primary.

## Decision

Replace the monitoring wall with a **triage cockpit**. The home becomes one
ranked worklist of things only a human can move forward today, with a thin
health pulse above it and a real "you're clear" payoff at the bottom. Reference
and analytics data moves out to its own pages, one tap away.

Core job (confirmed with owner): **"Clear my queue."**
Ranking spine (confirmed with owner): **time-sensitive first**, money at risk as
the tiebreaker, owner-visibility as a small boost.

## The genre choice

Two genres of home screen:

- **Monitoring** — passive, glanceable, "is the business healthy." Look, feel
  okay, leave.
- **Triage / command** — active, "here is your queue, ranked, go clear it."
  Arrive, act, the list shrinks.

For a hands-on ops operator, triage wins. The home should be a worklist, not a
museum. The eleven widgets are mostly reference data that each belong on their
own domain page.

---

## Architecture

### The engine (build once, render three places)

A normalization + scoring layer is the centerpiece. Each existing data fetch
gets a thin adapter that emits a common shape:

```ts
type ActionItem = {
  id: string;
  type: ActionItemType;        // 'invoice' | 'risk' | 'onboarding' | 'guest' | 'maintenance' | 'project' | 'lead' | 'winback' | ...
  title: string;               // human sentence, not a data row
  context: string;             // supporting line
  deadline: string | null;     // ISO timestamp of the hard clock, if any
  liveNow: boolean;            // actively happening right now (mid-stay issue, check-in tonight unresolved)
  moneyAtRisk: number | null;  // dollars at stake, if quantifiable
  ownerVisible: boolean;       // can an owner see/feel this
  href: string;                // where the full item lives
  primaryAction: ActionRef;    // the one inline action + its handler
  lane: LaneKey;               // 'money' | 'onboarding' | 'riskGuests' | 'growth'
};
```

**Scorer** (time-first):

1. Tier by time pressure: `liveNow` > `deadline <= today` > `deadline <= 7d` >
   `no deadline`.
2. Within a tier, sort by `moneyAtRisk` descending (nulls last).
3. Apply a small boost to `ownerVisible` items as a final nudge.

The page derives three views from the single scored stream:

- **Pulse atoms** — aggregates (counts, sums) for Zone 1.
- **Hero queue** — top-tier items, capped, for Zone 2.
- **Lanes** — the grouped remainder, for Zone 4.

This same engine later powers notifications and the owner home's "your one
thing to do." Build the brain once.

### Data sources to adapt

Reuse existing fetchers; wrap each in an adapter to `ActionItem[]`:

- `fetchOpenInvoices` -> money lane (overdue = deadline past; amount = moneyAtRisk)
- `fetchAIRiskDigest` -> riskGuests lane (critical = liveNow candidate)
- `fetchTodaySchedule` -> liveNow check-ins / events today
- `fetchOnboardingProgress` -> onboarding lane (stalled steps blocking go-live)
- `fetchRecurringMaintenance` -> riskGuests/money (overdue maintenance)
- `fetchProjectBoard` -> onboarding/ops (blocked projects)
- `fetchAllocationHealth` -> money lane
- `fetchPipelinePulse` / `fetchColdLeads` / `fetchWinbackQueue` -> growth lane
- `fetchGuestIntelligenceInsights` -> riskGuests lane (guest-facing actions)
- `fetchCommunicationsDashboard` -> riskGuests lane (unresolved callers, action items)

Aggregates for the pulse (`fetchPipelineTrend`, revenue/owner trends) are reduced
to single numbers, not charted on the home.

---

## Layout (top to bottom)

### Zone 1 — The Pulse (one row, never scrolls)

`Good morning, Jo` plus 3-4 status atoms with color dots and nothing more.
Example: `🔴 2 on fire · 🟠 $4.2k overdue · 5 check-ins tonight · pipeline $58k`.
No charts. Each atom jumps/filters. Replaces `CommandStrip` + `KPISparklineRow`.

### Zone 2 — The Now Queue (the hero)

Header: **"Needs you today"** with a count that ticks down as items resolve.
A single ranked list. Each row:

- **Left:** time-pressure indicator — a live pulsing dot for happening-now, or a
  countdown chip (`in 3h`, `due today`).
- **Title:** the human sentence ("Maria's guest reports no hot water, mid-stay at
  14 Oak"), not the underlying record.
- **Sub:** context + a small money or owner tag.
- **Right:** ONE inline primary action (Message guest / Mark paid / Nudge owner)
  plus an overflow menu. Acting collapses the row with a satisfying animation.

Ranked time-first per the scorer. **Capped at ~7±2 visible**, with a "N more
today" expander. The cap is a hard rule: a triage list taller than the screen
is the wall again.

### Zone 3 — "You're clear" (the payoff)

When the Now Queue reaches zero, render a reward state, not a blank: e.g.
"Nothing needs you right now. 14 properties healthy, $112k collected this
month." This is the streak/rings moment; the surface is designed *for* zero.

### Zone 4 — The Lanes (demoted, collapsed)

Four quiet accordions: **Money · Onboarding · Risk & Guests · Growth.**
Collapsed by default, each showing a count and its worst item. Expand for the
full lane list. Holds the actionable content of the old widgets for when the
hero list is clear and the operator wants to get ahead.

### What leaves the home entirely

- **Property Health grid** -> `/admin/properties` (browse surface, not a today
  surface).
- **KPI sparklines / pipeline & revenue trend charts** -> top of their domain
  pages (`/admin/prospects`, `/admin/finances`).
- **`DashboardCustomizer`** -> deleted. The ranking engine removes the need to
  hand-arrange widgets.

---

## Interaction & states

- **Inline actions** resolve an item optimistically; the row animates out and
  the count decrements. Errors surface inline on the row (no `alert()`), per
  project UI standards.
- **Empty / clear** state is a first-class design, not an afterthought.
- **Overflow** per item routes to the full record (`href`) and secondary
  actions.
- **Loading**: pulse and hero render as soon as their data resolves; lanes can
  stream in.

## Components (new)

- `lib/admin/action-items/` — the engine: `types.ts`, per-source `adapters`, and
  `score.ts`.
- `PulseBar` — Zone 1.
- `NowQueue` + `ActionRow` — Zone 2.
- `ClearState` — Zone 3.
- `TriageLane` (x4 via config) — Zone 4.

## Components (removed / relocated)

- Remove from home: `KPISparklineRow`, `PropertyHealthGrid` (relocate),
  `DashboardCustomizer`, `DashboardClientShell` customizer wiring.
- Reuse data only (not widget UI) from: `OpenInvoicesWidget`, `AIRiskDigest`,
  `TodayScheduleWidget`, `OnboardingProgressWidget`, `RecurringMaintenanceWidget`,
  `ProjectBoardWidget`, `AllocationHealthWidget`, `PipelinePulse`,
  `ColdLeadsWidget`, `WinbackQueueWidget`, `OwnerActivityWidget`, `GuestPulse`,
  `CommunicationsPanel`.

## Design system

Per `globals.css` tokens only. Brand palette, `--shadow-*`, `--radius-*`,
`--ease-spring`. Phosphor icons (duotone for feature, regular/bold for small
UI). `transform`/`opacity` transitions only. Every actionable row has hover,
focus-visible, and active states. CSS Modules to match the existing admin
pattern (one `.module.css` per component).

## Out of scope (this spec)

- Owner home redesign (derived later from the same engine).
- Notification system (future consumer of the engine).
- Tunable scoring weights UI (start with the fixed time-first model).

## Open questions for implementation planning

- Exact `liveNow` rules per source (which conditions count as "happening now").
- Which inline `primaryAction`s are wired in v1 vs route-to-page only.
- Whether lanes paginate or cap like the hero.
