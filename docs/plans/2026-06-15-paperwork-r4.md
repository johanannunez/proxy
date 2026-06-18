# Paperwork Hub Round 4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply Johanan's Round 4 feedback to the Paperwork hub: Status Board clarity + per-kind
column shading + a non-shifting Columns Clear, list/cards parity + remembered default view + the
Forms gray-sliver fix, an appearance-picker overhaul (icons-first, tinted glyphs, org brand colors +
custom hex, many more icons), instant-feel tab switching via prefetch, and a compliant
delete-or-archive surface that explains its reasoning.

**Architecture:** All work continues in worktree `proxy-worktrees/paperwork-p1` on branch
`paperwork/phase-1`. UI is Next.js 16 App Router + React 19 + CSS Modules + motion/react + Phosphor
icons. Each increment (A-E) is its own commit and verification pass. R4-E adds one compliant data
path (hard delete) and gets a `/plan-eng-review` before build.

**Tech Stack:** Next.js 16.2.7, React 19, TypeScript strict, CSS Modules, motion/react,
`@phosphor-icons/react`, Supabase (service/untyped clients), vitest (`pnpm exec vitest run` from
`apps/web`).

**Testing approach (read first):** This is UI-heavy. Write **vitest unit tests** for pure logic
(the column-shade index helper, the `useStickyView` hook, the delete-eligibility helper). For purely
visual changes the verification is `rm -rf .next && pnpm exec tsc --noEmit` clean, `pnpm lint` clean,
`doppler run --project proxy --config dev -- pnpm exec next build` passing, plus authenticated
gstack-browse + `screenshot.mjs` light/dark evidence. All commands run from `apps/web`. Commit per
task. Do not `confirm()/alert()/prompt()`; destructive actions use `ConfirmModal`. Never use
`transition-all`. Use design tokens, not raw hex (except where a documented token fallback is needed).

**Concurrency caution:** `PaperworkShell.tsx` and the create flow are under active AI-overlay work.
R4-B edits the shell's tab Links and R4-D edits the pickers; re-read those files immediately before
editing and stop if you hit a "file modified since read" error (see workspace CLAUDE.md).

---

## Increment R4-A — Status Board: clarity, per-kind column shading, non-shifting Clear

Files: `components/admin/status-board/StatusBoardView.tsx`,
`components/admin/status-board/StatusBoardToolbar.tsx`,
`components/admin/status-board/StatusBoard.module.css`,
`components/admin/status-board/status-board-config.ts`,
new `components/admin/status-board/column-shade.ts` (+ `column-shade.test.ts`).

### Task A1: Reword "documents tracked" and clarify Status counts as workspaces

**Files:** Modify `StatusBoardView.tsx:~1271` (the summary line), `StatusBoardToolbar.tsx` (status menu rows).

**Step 1:** In `StatusBoardView.tsx`, change the tracked-set summary so it reads
`{board.columns.length} {board.columns.length === 1 ? "document type" : "document types"}` (keep the
"N workspaces ·" prefix unchanged).

**Step 2:** In `StatusBoardToolbar.tsx`, where the status dropdown renders each option's count
(`statusCounts`), make the row read as workspaces. Keep the dot + label, and render the count with a
trailing unit only in the menu (e.g. the "All statuses / Outstanding / Complete …" rows show
`{count}` today; add an `aria-label` and a visible micro-unit so "Outstanding 9" reads "Outstanding ·
9 workspaces"). Keep the trigger compact ("Status · All").

**Step 3 (verify):** `rm -rf .next && pnpm exec tsc --noEmit` clean; `pnpm lint` clean.

**Step 4 (commit):** `feat(status-board): clarify tracked-types + workspace-level status counts`.

### Task A2: Column-shade helper (pure logic, tested)

**Files:** Create `components/admin/status-board/column-shade.ts` and `column-shade.test.ts`.

**Step 1 (failing test):** `column-shade.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shadeStepForColumns } from "./column-shade";

describe("shadeStepForColumns", () => {
  it("assigns an alternating step index per kind, independent of the other kind", () => {
    const cols = [
      { reqKey: "a", kind: "signature" },
      { reqKey: "b", kind: "signature" },
      { reqKey: "c", kind: "form" },
      { reqKey: "d", kind: "signature" },
      { reqKey: "e", kind: "form" },
    ] as const;
    expect(cols.map((c) => shadeStepForColumns(cols, c.reqKey))).toEqual([0, 1, 0, 0, 1]);
  });
  it("returns 0 for an unknown column", () => {
    expect(shadeStepForColumns([], "missing")).toBe(0);
  });
});
```

**Step 2 (run, fail):** `pnpm exec vitest run src/components/admin/status-board/column-shade.test.ts`
→ FAIL (module not found).

**Step 3 (implement):** `column-shade.ts`:

```ts
import type { RequirementKind } from "./status-board-config";

type ShadeColumn = { reqKey: string; kind: RequirementKind };

/**
 * Index of a column *within its own kind*, so shading alternates per kind and
 * recomputes automatically as columns are pinned/unpinned. Two steps (0,1) give
 * a light/dark pair; widen the modulo here if more steps are wanted.
 */
export function shadeStepForColumns(columns: readonly ShadeColumn[], reqKey: string): number {
  let step = 0;
  for (const col of columns) {
    if (col.reqKey === reqKey) return step % 2;
    // advance only within the matching kind
    const target = columns.find((c) => c.reqKey === reqKey);
    if (target && col.kind === target.kind) step += 1;
  }
  return 0;
}
```

(Keep it simple and correct; optimize later only if profiling says so.)

**Step 4 (run, pass):** same vitest command → PASS.

**Step 5 (commit):** `feat(status-board): per-kind column shade-step helper`.

### Task A3: Apply alternating shades down the columns

**Files:** Modify `StatusBoardView.tsx` (pass shade step to the column header + cells),
`StatusBoard.module.css` (`.matrixItemHeader_signature/_form`, `.matrixGroupBand_*`, and the cell
mixes near lines 433-470).

**Step 1:** Where columns render their header tile and each body cell, compute
`shadeStepForColumns(board.columns, col.reqKey)` and set it as a CSS var on the element, e.g.
`style={{ ["--shade" as string]: step }}` (the matrix already keys color by kind class).

**Step 2:** In `StatusBoard.module.css`, make the per-kind washes read `--shade` so step 1 is a touch
deeper than step 0. Example for the signature header wash:

```css
.matrixItemHeader_signature {
  background: color-mix(
    in srgb,
    var(--color-brand, #1b77be) calc(8% + var(--shade, 0) * 5%),
    var(--dash-card-alt, #f3f2f0)
  );
}
```

Apply the analogous `calc(... + var(--shade,0) * N%)` to the form header
(`#7c3aed`), and to the cell-level signature/form mixes. Keep deltas subtle (4-6%) so it reads as a
family, not stripes. Verify contrast in dark mode.

**Step 3 (verify):** tsc + lint clean. Screenshot the Status Board light + dark via gstack browse on
`localhost:4000` (authenticate via `/api/dev/auth` then goto `/admin/paperwork`). Produce **two
shading variants** (e.g. 5% vs 7% step) and present both to Johanan before locking the values.

**Step 4 (commit):** `feat(status-board): alternating per-kind column shading`.

### Task A4: Move Clear beside the Columns button; drop the shifting chips row

**Files:** Modify `StatusBoardView.tsx:1161-1251` (the pinned-column chips row + existing
`sbFocusChipsClear`), `StatusBoardToolbar.tsx` (Columns button area), `StatusBoard.module.css`.

**Step 1:** Remove the focus-chips row (the per-column pills at `~1214-1251` that push the board
down). Keep the `focusedKeys` state and the Columns button which already shows "N pinned".

**Step 2:** In `StatusBoardToolbar.tsx`, when `focusedKeys.size > 0`, render a small **Clear** chip
immediately to the right of the Columns button (same toolbar row, no new row) that calls the existing
clear handler (`setFocusedKeys(new Set())` / whatever the current `sbFocusChipsClear` onClick does).
Style it `.sbColsClear` (quiet by default, brand on hover), matching the R3 toolbar chrome.

**Step 3 (verify):** tsc + lint clean. Screenshot: pin 3-4 columns, confirm the board does not shift
and Clear sits next to Columns; clicking Clear resets with no layout jump. Light + dark.

**Step 4 (commit):** `feat(status-board): inline Columns Clear, remove shifting chips row`.

---

## Increment R4-B — Instant-feel tab switching (prefetch)

Files: `app/(admin)/admin/paperwork/PaperworkShell.tsx` (tab `<Link>`s).

### Task B1: Prefetch the three tabs on intent

**Step 1 (re-read first):** Re-read `PaperworkShell.tsx` immediately before editing (it is under
concurrent AI work). The tabs are the `TABS.map(... <Link href=...>)` block.

**Step 2:** Ensure each tab `<Link>` has `prefetch` enabled and add `router.prefetch(tab.href)` on
`onPointerEnter`/`onFocus` of each tab so the destination route + data warm before the click. Reuse
the existing `router` from `useRouter()`. Keep the change additive (do not touch the AI-overlay
state).

**Step 3 (verify):** tsc + lint + build clean. On `localhost:4000`, click between Status Board /
Signatures / Forms after hovering; the destination should paint immediately (skeleton only on a cold
first hit). Note: dev mode compiles routes lazily, so confirm against the production `next build`
output or accept that dev shows the skeleton more often than prod.

**Step 4 (commit):** `perf(paperwork): prefetch tab routes on intent for instant switching`.

---

## Increment R4-C — List/cards parity, remembered default view, gray sliver

Files: `app/(admin)/admin/paperwork/signatures/SignaturesHub.tsx` (+ `.module.css`),
`components/admin/paperwork/HubChrome.tsx` (`ViewToggle`),
`components/admin/paperwork/TemplateCard.module.css`,
new `lib/admin/use-sticky-view.ts` (+ `use-sticky-view.test.ts`).

### Task C1: `useStickyView` hook (tested)

**Step 1 (failing test):** `lib/admin/use-sticky-view.test.ts` using `@testing-library/react`'s
`renderHook` (already used elsewhere; if not present, test the pure read/write helpers instead):

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { readStickyView } from "./use-sticky-view";

describe("readStickyView", () => {
  beforeEach(() => localStorage.clear());
  it("falls back to the default when nothing stored", () => {
    expect(readStickyView("signatures", "cards")).toBe("cards");
  });
  it("returns a stored valid value", () => {
    localStorage.setItem("paperwork.view.signatures", "list");
    expect(readStickyView("signatures", "cards")).toBe("list");
  });
  it("ignores an invalid stored value", () => {
    localStorage.setItem("paperwork.view.signatures", "garbage");
    expect(readStickyView("signatures", "cards")).toBe("cards");
  });
});
```

**Step 2 (run, fail).** **Step 3 (implement):** export `readStickyView(hub, fallback)` +
`writeStickyView(hub, view)` (guarded for SSR: `typeof window === "undefined"` → return fallback) and
a `useStickyView(hub, fallback)` hook that initializes from `readStickyView` and writes on change.
Valid values: `"cards" | "list"`. **Step 4 (run, pass). Step 5 (commit):**
`feat(paperwork): useStickyView hook for remembered hub view`.

### Task C2: Wire default view into both hubs

**Files:** `SignaturesHub.tsx`, `forms/FormsTab.tsx` (the `const [view, setView] = useState<HubView>`).

**Step 1:** Replace the `useState("cards")` view state in each hub with
`useStickyView("signatures" | "forms", "cards")`. Keep `ViewToggle` wiring unchanged.

**Step 2 (verify):** tsc + lint clean. Toggle to List on each hub, reload, confirm it reopens in List;
toggle back to Cards, reload, confirm Cards. **Step 3 (commit):**
`feat(paperwork): remember cards/list per hub`.

### Task C3: Signatures list header + denser premium row

**Files:** `SignaturesHub.tsx` (the `libList`/`libRow` block), `SignaturesHub.module.css`.

**Step 1:** Add a column header row above the list (Document · Status · Sent · Last activity),
matching the Forms list header pattern (`forms/FormsTab.tsx` `headerRow` + `forms/FormsTab.module.css`
fixed-width grid). Use the same fixed-width grid technique so header and rows align (R3 gotcha:
content-sized `auto` columns drift; use fixed widths).

**Step 2:** Enrich each `libRow` to carry more: the existing name + a status pill (Draft/Ready), the
sent count, and a last-activity date if available on the template. Keep `Open` + `Request a
signature` actions. Match the premium density of the Forms list.

**Step 3 (verify):** tsc + lint clean. Screenshot Signatures list light + dark; confirm header aligns
with rows and the row reads richer. **Step 4 (commit):**
`feat(signatures): list header + denser premium rows`.

### Task C4: Forms card gray sliver

**Files:** `components/admin/paperwork/TemplateCard.module.css` (`.cardPreview`, `.cardBody`,
`.cardMeta`).

**Step 1:** Inspect the card preview: a gray strip remains above and below the thumbnail. Make
`.cardPreview` full-bleed (no residual padding/margin/background gap top or bottom) so the tile meets
the card top edge and the meta block directly. Re-check the R3 fix did not leave a `padding-top` or a
background mismatch.

**Step 2 (verify):** Screenshot Forms Cards light + dark; confirm no gray strip top or under the
thumbnail. **Step 3 (commit):** `fix(paperwork): remove Forms card gray sliver`.

---

## Increment R4-D — Appearance picker overhaul

Files: `components/admin/IconPicker.tsx` (+ `.module.css`),
`components/admin/icon-picker-catalog.tsx` (the `PHOSPHOR_ICONS` catalog),
`app/(admin)/admin/paperwork/forms/FormAppearancePicker.tsx`,
`app/(admin)/admin/paperwork/forms/form-icon.tsx` (`FORM_TINTS`), org branding read from
`OrganizationBranding.primary_color/accent_color`.

### Task D1: Icons tab first, default to icons

**Files:** `IconPicker.tsx` (tab order ~175-195, default tab ~56).

**Step 1:** Reorder the tab buttons so **Icons** is first, **Emoji** second. Change the initial tab so
it defaults to `"icon"` unless the current value is an emoji.

**Step 2 (verify):** tsc + lint clean; screenshot the open picker, Icons selected by default.
**Step 3 (commit):** `feat(icon-picker): icons-first ordering and default`.

### Task D2: Tint Phosphor glyphs with the selected color

**Files:** `IconPicker.tsx` (icon grid render + trigger), `FormAppearancePicker.tsx` (passes color).

**Step 1:** In the icon grid and the trigger, apply the selected accent color to the rendered Phosphor
glyphs (`color: var(--picked)` via an inline `--picked` set from the chosen swatch/hex), so picking a
color recolors the glyphs live. The emoji grid is unaffected (emoji ignore color).

**Step 2 (verify):** tsc + lint clean; screenshot picking 2 colors, glyphs recolor. **Step 3
(commit):** `feat(icon-picker): tint glyphs with selected color`.

### Task D3: Expanded colors — palette + org brand + custom hex

**Files:** `form-icon.tsx` (`FORM_TINTS` palette), `FormAppearancePicker.tsx` (color options +
brand colors + hex input), `IconPicker.tsx` (color row + hex input affordance).

**Step 1:** Expand `FORM_TINTS` to a larger fixed palette (keep them on-brand, token-aligned).

**Step 2:** In `FormAppearancePicker.tsx`, fetch/receive the org's `primary_color` + `accent_color`
(from the same source Branding settings uses; pass as props from the server page if not already in
context) and prepend them as labeled "Brand" quick-pick swatches.

**Step 3:** Add a **custom hex** input in the picker's color row (validates `#RRGGBB`; on valid,
applies as the color). No new persistence; the chosen hex is stored on the form's `icon_color` exactly
like a palette key (store the hex string).

**Step 4 (verify):** tsc + lint + build clean; screenshot palette + brand swatches + hex entry; pick a
custom hex and confirm the glyph + saved state use it. **Step 5 (commit):**
`feat(icon-picker): expanded palette, org brand colors, custom hex`.

### Task D4: Many more Phosphor icons

**Files:** `icon-picker-catalog.tsx` (`PHOSPHOR_ICONS`).

**Step 1:** Significantly expand the curated `PHOSPHOR_ICONS` list (add the common
property/document/people/finance/communication glyphs and more), each with searchable keywords so the
existing search filter (`IconPicker.tsx:121-127`) finds them. Keep entries as
`{ name, Icon, keywords }` in the existing shape. Do NOT import all of `@phosphor-icons/react`
eagerly (bundle cost); curate a large but intentional set.

**Step 2 (verify):** tsc + lint + build clean (watch bundle size); search a few terms in the picker,
confirm many results. **Step 3 (commit):** `feat(icon-picker): expand the searchable Phosphor set`.

---

## Increment R4-E — Delete or Archive, with reasoning (`/plan-eng-review` FIRST)

> Before building R4-E, run `/plan-eng-review` on this increment (it touches a compliant data path:
> purging `slug` + `document_key`). Confirm the eligibility query and the irreversibility.

Files: `app/(admin)/admin/paperwork/templates/template-actions.ts` (new hard delete for signatures),
`app/(admin)/admin/paperwork/templates/form-actions.ts` (new hard delete for forms),
new `lib/admin/delete-eligibility.ts` (+ `.test.ts`),
new `components/admin/paperwork/DeleteOrArchiveModal.tsx` (+ `.module.css`),
`components/admin/ConfirmModal.tsx` (reuse), wired into the `⋯` menu on `FormsTab.tsx` and the
Signatures library rows/cards.

### Task E1: Eligibility helper (tested)

**Step 1 (failing test):** `lib/admin/delete-eligibility.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { deleteEligibility } from "./delete-eligibility";

describe("deleteEligibility", () => {
  it("allows hard delete when never used", () => {
    expect(deleteEligibility({ usedCount: 0, kind: "signature" })).toEqual({
      canDelete: true, reason: null,
    });
  });
  it("blocks hard delete when used and explains why", () => {
    const r = deleteEligibility({ usedCount: 2, kind: "signature", lastUsedAt: "2026-05-03" });
    expect(r.canDelete).toBe(false);
    expect(r.reason).toMatch(/sent to 2/i);
  });
});
```

**Step 2 (run, fail). Step 3 (implement):** `delete-eligibility.ts` — pure function returning
`{ canDelete: boolean; reason: string | null }`. `canDelete = usedCount === 0`. When blocked, build
the reason copy ("Sent to N owner(s)…" for signatures, "Has N response(s)…" for forms; include the
date when present). **Step 4 (run, pass). Step 5 (commit):**
`feat(paperwork): delete-eligibility helper`.

### Task E2: Hard-delete server actions

**Files:** `template-actions.ts` (signatures), `form-actions.ts` (forms).

**Step 1:** Add `hardDeleteTemplate(id)` for signatures: re-check server-side that `usedCount === 0`
(query sent instances for this template) and that it is not a system template; then delete the
template row and null/remove `slug` + `document_key` so the public link cannot resolve. Return a
typed `{ ok, error? }`. Refuse if used (defense in depth, not just UI).

**Step 2:** Add the analogous `hardDeleteForm(id)` for forms: re-check `responses === 0`, then delete
the form row + `slug` so the public `/f/<slug>` link dies.

**Step 3 (verify):** tsc + lint clean. Manually (authenticated, on a throwaway never-used template)
confirm the row is gone and the old public URL 404s. Do NOT test against a used template. **Step 4
(commit):** `feat(paperwork): compliant hard delete for never-used signatures/forms`.

### Task E3: DeleteOrArchiveModal surface

**Files:** new `components/admin/paperwork/DeleteOrArchiveModal.tsx` (+ `.module.css`), wired into the
`⋯` menus.

**Step 1:** Build a modal that takes the item + its `deleteEligibility` result and renders:
- eligible → **Delete** (danger, opens `ConfirmModal`) with its reason + **Archive** with its reason;
- blocked → **Delete** disabled with the inline reason + **Archive** presented as the recommended path
  with its reason.
Use tokens, motion/react, focus-visible, no `confirm()/alert()`.

**Step 2:** Add a "Delete or archive…" item to the `CardActionMenu` on Forms cards and the Signatures
library item menu (Signatures may need a `CardActionMenu` added to match Forms). Opening it computes
eligibility from the item's used count and shows the modal.

**Step 3 (verify):** tsc + lint + build clean. Screenshot both states (eligible vs blocked) light +
dark; confirm the reasoning copy renders and Delete is disabled when used. Confirm an actual delete on
a never-used item works and an archive on a used item works. **Step 4 (commit):**
`feat(paperwork): delete-or-archive modal with reasoning`.

---

## Final verification (before merge)

1. Full pipeline clean across the branch: `rm -rf .next && pnpm exec tsc --noEmit`, `pnpm lint`,
   `pnpm exec vitest run`, `doppler run --project proxy --config dev -- pnpm exec next build`.
2. Authenticated visual sweep on `localhost:4000` (worktree) for every A-E surface, light + dark.
3. `advisor` review of the full R4 diff; `/plan-eng-review` already done for R4-E.
4. Hand back to Johanan for `/ship`.

## Risks / not in scope

- Concurrency with the in-flight AI overlays in `PaperworkShell` + create flow (re-read before edit).
- Not in scope: DB-synced view preference, a new saved-color store, per-document board status
  breakdown (optional), and the deferred R3 items (workspace facet, Signatures duplicate/archive
  parity beyond delete, Forms in-place preview drawer, board your-move/stalled filters).
