# Proxy Super Admin "Platform Console" — Build Spec (2026-06-20)

The platform owner's eagle's-eye mission control over every subscriber agency. Deep-OLED,
brand-locked, honest about a day-zero data reality (1 comped agency, $0 platform-SaaS MRR).
This file is the canonical reference for the build and for any fan-out agents.

Branch: `feat/phase-1b-org-to-agency-rename`. Run all commands from `apps/web/` with Doppler.

---

## Verified data reality (queried live, not from the audit)

- **1 agency** — The Parcel Company, `plan_tier=white_label`, `has_billing=false`, comped → **$0 platform-SaaS MRR**.
- 10 workspaces, 17 owner profiles (19 profiles total), 15 properties.
- `platform_agency_operating_mrr`: `reconciled=0`, `schedule=0`, `legacy=0`, **`legacy_mrr_agency_total_cents=19900`** (one active legacy $199/mo sub whose owner has a null workspace_id → unattributed).
- `billing_schedules=0`, `billing_invoices=0`, `document_signers=0`. So **first_sign and first_payment funnel steps are genuinely empty today** — design honest "not yet" states, never faked.
- `activity_log` is a sparse audit trail (mostly April seed + a few June rows). **0 `support_access_*` rows** (impersonation never exercised).
- `auth.users.last_sign_in_at`: 19 users, 4 ever signed in, **3 active in last 7d / 28d**. This is the real activity signal.
- The agency is 9 days old (created 2026-06-11) → **W4 retention is not yet measurable** (cohort too young). Honest, real low-data state.

## Decisions (locked, with the advisor)

1. **All reads** via `untypedDatabase(createServiceClient())` (cross-agency, RLS-bypass, post-Phase-1B casts). `import "server-only"`.
2. **Reuse** `platform_agency_operating_mrr` + `platform_agencies_overview` (both already `service_role`-only — verified grants). Compute funnel / signups / cohort as **inline service-role queries** in `lib/platform/` (minimize new DB surface). The only new DB object is the MRR snapshot table.
3. **MRR has no history** → add `platform_mrr_snapshots` (one row per agency per day) + a daily cron + a baseline row seeded in the migration. Hero delta + MRR trend come from snapshots; until ≥2 snapshots exist, the delta renders an honest "tracking since {date}" state (no fake delta). `service_role`-only, mirrors the existing views' grants.
4. **Retention / last-active "active" signal = `auth.users.last_sign_in_at`** (join profiles→auth.users on id), NOT `activity_log`. Keep the 1-cohort / W4-too-young low-data banner.
5. **Activation funnel = agency grain** (matches the wired PostHog events signup/workspace_created/owner_invited and the platform-owner mental model), annotated `n=1`. The populated **workspace/client funnel lives in the agency detail view**. Step definitions (DB-sourced, annotated in UI tooltips):
   - `signup` = agency exists.
   - `workspace_created` = agency has ≥1 workspace.
   - `first_invite` = agency has ≥1 `profiles.role='owner'`.
   - `first_sign` = agency has ≥1 `document_signers` with `signed_at` not null. **(0 today)**
   - `first_payment` = agency has ≥1 `billing_invoices` with `status='paid'`. **(0 today)** Do NOT count the active legacy sub here — the hero deliberately excludes it; one story.
6. **The legacy $199 sub** is always its own labeled line (`legacy_mrr_agency_total_cents`), never folded into reconciled MRR or first_payment.
7. **No webhook PostHog wiring in this build** (first_sign/first_payment/churn). The console is fully DB-sourced and renders today. The events only feed future PostHog-native analysis and touch live billing/signing paths — deferred to a tracked follow-up task.
8. **Source of truth for retention = the DB proxy** above (deterministic, self-contained, renders today). PostHog (signup/workspace_created/owner_invited + pageviews, native cohorts) is named in the UI as the richer behavioral source as volume grows.

## Auth / access

- `(platform)/platform/layout.tsx` already gates on `platform_role='superadmin'` (defense in depth); `src/proxy.ts` walls `/platform/*`. Keep both.
- Preview: dev server + `http://localhost:4000/api/dev/auth?redirect=/platform` logs in as Johan (superadmin). Verified the route lands a superadmin session in `NODE_ENV=development`.

---

## Design system — "Mission Control" (scoped, always-dark)

Self-contained OLED theme that does NOT depend on the global `.dark` class. Tokens scoped to
`[data-platform-root]` in `globals.css` (mirrors the existing `[data-admin-root]` precedent), so
every console CSS Module can use them. Brand tokens (`--color-brand*`) are mode-independent and used directly.

```
[data-platform-root] {
  --pc-canvas:       #070809;   /* near-OLED black — the deliberate inversion of admin's warm off-white */
  --pc-surface:      #0e1014;   /* base card */
  --pc-surface-2:    #14171d;   /* elevated / hover */
  --pc-surface-3:    #1a1e26;   /* floating / popover / rail-active */
  --pc-border:       rgba(255,255,255,0.07);
  --pc-border-strong:rgba(255,255,255,0.12);
  --pc-text:         #e8eaed;   /* primary  (~13:1 on canvas, AAA) */
  --pc-text-2:       #9aa3ad;   /* secondary */
  --pc-text-3:       #5f6772;   /* tertiary / mono labels */
  --pc-accent:       #02aaeb;   /* = --color-brand-light */
  --pc-accent-deep:  #1b77be;   /* = --color-brand */
  --pc-accent-grad:  linear-gradient(135deg,#02aaeb,#1b77be);
  --pc-accent-tint:  rgba(2,170,235,0.08);
  --pc-accent-line:  rgba(2,170,235,0.20);
  --pc-glow:         0 0 26px rgba(2,170,235,0.22);   /* reserved for the hero only */
  --pc-success:#22c55e; --pc-warn:#f5a623; --pc-danger:#ef4444;
  --pc-radius: 14px; --pc-radius-sm: 9px;
  --pc-shadow: 0 1px 2px rgba(0,0,0,.5), 0 8px 28px rgba(0,0,0,.45);
  --pc-ease: cubic-bezier(0.16,1,0.3,1);
}
```

- **Type:** Sora (`--font-sora`) headings, tight tracking; Geist (`--font-sans`) body; **IBM Plex Mono (`--font-ibm-plex-mono`) for every metric, ID, timestamp, % and delta**, with `font-variant-numeric: tabular-nums`. Eyebrow labels uppercase, 0.1em+ tracking, 11px, `--pc-text-3`.
- **Motion:** `motion/react`, transform/opacity only, `--pc-ease`. Subtle card stagger + hover lifts. Respect `prefers-reduced-motion`. **No decorative motion** — the under-hero trace is the real MRR snapshot trend, not an ornament.
- **Icons:** `@phosphor-icons/react`, `weight="duotone"` for feature/nav, sizes 16–20.
- **Density:** data-dense but calm — 12-col main grid, gap 16px, card padding 18–20px.

### Signature element — the "Vital Signs" hero

One oversized IBM Plex Mono **agency-operating MRR** figure in the cyan→blue gradient with a soft glow,
set beside a deliberately, honestly **`$0` platform-SaaS MRR** readout ("no agency pays Proxy yet").
The two-MRR contrast is the platform-vs-tenant story made visual. Under it, a real sparkline of the MRR
snapshot trend (flat at $0, "tracking since today" until snapshots accumulate). Spend all boldness here;
everything else stays quiet.

### Honest low-data states are first-class

A branded `EmptyState` / `DataNote` component (per the Graphite/Mixpanel "fewer than N users — not enough
data" precedent) is used wherever a metric is structurally empty (first_sign, first_payment, W4 retention,
movement breakdown). Never lorem, never a faked curve.

---

## Routes & nav

Left rail groups:
- **Overview** `/platform`  (the hero)
- **Agencies** `/platform/agencies` (+ `/platform/agencies/[id]` detail)
- **Revenue** `/platform/revenue`
- **Growth** `/platform/growth`
- **System Health** `/platform/system`
- **Support Access** `/platform/support-access`
- **Soon** group (designed "coming next" states): **Waitlist** `/platform/waitlist`, **Feature Log** `/platform/feature-log`, **Broadcast** `/platform/broadcast`, **Entitlements** `/platform/entitlements`

---

## File plan

**DB**
- `supabase/migrations/20260620_120000_platform_mrr_snapshots.sql` — table (id, captured_date date, agency_id, plan_tier, reconciled_mrr_cents, schedule_mrr_cents, legacy_mrr_cents, legacy_mrr_agency_total_cents, created_at; unique(captured_date,agency_id); index on captured_date). RLS on, `service_role`-only policy + REVOKE anon/authenticated. Seed today's baseline from `platform_agency_operating_mrr`.
- `apps/web/src/app/api/cron/platform-mrr-snapshot/route.ts` — Bearer `CRON_SECRET`; idempotent upsert of today's snapshot from the MRR view. Register in `apps/web/vercel.json` (`0 5 * * *`).

**Data layer** (`apps/web/src/lib/platform/`, all `server-only`)
- `service.ts` — `platformDb()` = `untypedDatabase(createServiceClient())`.
- `format.ts` — cents→USD, compact numbers, ISO-week labels, relative time.
- `integrations.ts` — integration env-presence registry + cron registry (from vercel.json) for System Health.
- `overview.ts`, `revenue.ts`, `growth.ts`, `agencies.ts`, `system-health.ts`, `support-access.ts` — typed read fns per the decisions above.

**Shell + primitives** (`apps/web/src/components/platform/`, each with `.module.css`)
- Shell: `PlatformRail.tsx`, `PlatformTopBar.tsx`, `PlatformMobileNav.tsx`, `nav.ts`.
- Primitives: `KpiTile`, `MonoValue`, `StatDelta`, `Sparkline`, `FunnelBars`, `RetentionGrid`, `BarSeries`, `SectionCard`, `PageHeader`, `EmptyState`, `DataNote` (info tooltip), `StatusDot`, `TimeframeControl`, `HeroVitalSigns`.

**Pages** (`apps/web/src/app/(platform)/platform/`)
- `layout.tsx` (add the shell + `data-platform-root` wrapper; keep the gate), `page.tsx` (Overview), `agencies/`, `revenue/`, `growth/`, `system/`, `support-access/`, and the four Soon stubs.

## Build order

1. Migration + cron (apply migration to prod via Supabase MCP; additive + service-role-locked).
2. Scoped tokens in `globals.css`.
3. Data layer.
4. Shell + primitives + **Overview** (canonical page — sets the language).
5. Commit foundation; verify Overview in preview (dev auth, mobile + desktop).
6. Fan out the remaining pages (each agent owns only its own new files; shared files owned by the lead).
7. Adversarial verify pass (SQL/count correctness vs live DB, service-role wall, token compliance, empty-state honesty, dark + responsive, build/tsc/lint).
8. spawn_task the deferred PostHog webhook wiring.

## Quality bar

Brand tokens only (no raw hex outside the scoped token block, no Tailwind defaults). No `transition-all`.
Every interactive element: hover + focus-visible + active. `CustomSelect`/`DatePickerInput` only if a
select/date is truly needed (prefer a segmented `TimeframeControl`); scoped dark overrides + verify if reused.
No `confirm/alert`; `ConfirmModal` only for real destructive actions (v1 is read-only). No dashes as
punctuation in UI copy. Verify visually (preview + screenshots), ≥2 rounds, mobile + desktop. Build/tsc/lint clean.
