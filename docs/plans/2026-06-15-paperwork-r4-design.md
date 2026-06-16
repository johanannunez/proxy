# Paperwork Hub — Round 4 design (post-preview feedback)

## Context

Round 3 shipped to branch `paperwork/phase-1` (worktree `proxy-worktrees/paperwork-p1`) and is
pushed: the `⋯` card menu + Forms footer fix, faceted activity filters, tab-switch skeletons, the
scoped Action Center fetch + intent prefetch, and the in-menu "Link copied" confirmation. Johanan
reviewed the live branch on `localhost:4000` (now serving the worktree) and gave a Round 4 round of
feedback. This document turns it into shippable, individually reviewable increments (R4-A..E),
mirroring how R2/R3 shipped. Scope is UI plus one compliant data path (hard delete).

Concurrency note: `PaperworkShell.tsx` and the create flow are being changed in parallel (the
signature/form AI creation overlays are now wired in). R4 must not step on that work. R4-B touches
`PaperworkShell` tab Links (coordinate / rebase carefully); R4-D touches the appearance + icon
pickers, which are separate from the creation overlays.

---

## Questions answered (grounded in code)

- **"16 documents tracked" = 16 document types.** It is `board.columns.length`
  (`StatusBoardView.tsx:1271`), the full tracked-document set, not instances and not the filtered
  column count. Reword to "16 document types".
- **"Outstanding 9" is workspace-level.** The Status filter counts workspaces, not documents:
  `statusCounts.outstanding = searchFiltered.filter(ws => matchesStatus(ws, "outstanding")).length`
  where `matchesStatus(ws, "outstanding") = ws.pct < 100` (`StatusBoardView.tsx:1108-1127`). 9 of 9
  workspaces have outstanding paperwork. Relabel so the counts read as workspaces.
- **Delete today is a soft-delete that keeps the slug + key.** `deactivateTemplate`
  (`templates/template-actions.ts:448`) only sets `is_active = false`. Nothing purges `document_key`,
  `slug`, or the public URL. R4-E adds the compliant hard delete.

## Decisions locked this round

- **Tab speed:** prefetch + keep the existing routes (not a single client shell).
- **Picker colors:** reuse the org's existing Primary/Accent brand colors (from Branding settings)
  as quick-picks, plus an expanded fixed palette and a custom hex input. Icons tint to the selected
  color. No new saved-swatches store.
- **Delete rule:** never-used only (0 sent for a signature / 0 responses for a form) can be hard
  deleted; anything ever used is archive-only. The delete/archive surface explains the reasoning for
  each available or blocked action.

---

## R4-A — Status Board: clarity, per-kind column shading, Columns Clear

**Files:** `components/admin/status-board/StatusBoardView.tsx`, `StatusBoardToolbar.tsx`,
`StatusBoard.module.css`, `status-board-config.ts`.

- **Wording:** "documents tracked" → "document types" (`StatusBoardView.tsx:1271`). Status dropdown
  counts read as workspaces (e.g. "Outstanding · 9 workspaces") in `StatusBoardToolbar` so the
  row-level meaning is unambiguous.
- **Per-kind column shading:** alternating shades within each kind down the column band (blue family
  for Signatures, violet family for Forms), computed from each column's index *within its kind* so it
  recomputes automatically as columns are pinned/unpinned. Drive it from `status-board-config.ts`
  (kind base colors) + a per-column index, applied in the column band / header / cell mixes in
  `StatusBoard.module.css`. Screenshot 2 shading options light + dark before locking.
- **Columns Clear:** remove the pinned-column pills row that pushes the board down. When columns are
  pinned, the Columns button already reads "N pinned"; add a small **Clear** chip directly beside it
  that resets the pin set. No layout shift.

## R4-B — Instant-feel tab switching (prefetch)

**Files:** `PaperworkShell.tsx` (tab Links), the three paperwork `page.tsx`.

Warm each tab on intent: `router.prefetch` (or `<Link prefetch>`) on hover/focus/viewport of the
three top-level tabs so the destination paints immediately; the R3 skeletons only ever show on a cold
first hit. Keep it additive and minimal to avoid colliding with the in-flight AI changes in the
shell. Goal: the click reads instant.

## R4-C — List/cards parity + default view + gray sliver

**Files:** `signatures/SignaturesHub.tsx` (+ `.module.css`), `components/admin/paperwork/HubChrome.tsx`
(`ViewToggle`), `components/admin/paperwork/TemplateCard.module.css`, a small `useStickyView` hook.

- **Signatures list header + denser row:** add a column header (Document · Status · Sent · Last
  activity) matching the Forms list, and enrich `libRow` to carry more info (sent count, status pill,
  last activity) at a premium density.
- **Default view (cards vs list):** persist per hub in `localStorage` via a tiny `useStickyView(key)`
  hook so each hub reopens how it was left. (DB-synced is a later upgrade.)
- **Forms card gray sliver:** finish the `TemplateCard` `.cardPreview` full-bleed so no gray strip
  remains above or below the thumbnail.

## R4-D — Appearance picker overhaul

**Files:** `forms/FormAppearancePicker.tsx`, `components/admin/IconPicker.tsx`, the Phosphor icon
catalog backing `PHOSPHOR_ICONS`, `FORM_TINTS`; read org colors from Branding
(`settings/branding`, `OrganizationBranding.primary_color/accent_color`).

- **Icons tab first, Emoji second** (reorder in `IconPicker`).
- **Icon tinting:** the selected accent color recolors the Phosphor glyphs live (preview + saved
  state).
- **Colors:** expanded fixed palette + the org Primary/Accent as quick-picks + a custom hex input.
- **More icons:** expand the searchable Phosphor set well beyond the current handful.

## R4-E — Delete or Archive, with reasoning (`/plan-eng-review` first)

**Files:** `templates/template-actions.ts` (new hard delete), `templates/form-actions.ts`, usage
counts from the documents/forms helpers, `components/admin/ConfirmModal.tsx`, a new
"Delete or archive" modal surface, wired into the `⋯` menu on both hubs.

- **Eligibility:** signature deletable when 0 sent instances; form deletable when 0 responses.
- **Hard delete:** purges the template row + `slug` + `document_key` so the public link dies. Used
  items are archive-only (audit trail preserved).
- **Reasoning surface:** the `⋯` menu's "Delete or archive…" opens a modal that reads state and
  explains the why:
  - never-used → **Delete** (danger, with reason) + **Archive** (with reason);
  - used → **Delete disabled with inline reason** ("Sent to N owners on <date>. Used documents can't
    be deleted so the signed records and audit trail stay intact.") + **Archive** as the recommended
    path with its own reason.
- Destructive delete still routes through the danger `ConfirmModal`; the reasoning lives in the
  surface above it. No `confirm()/alert()`.

---

## Sequence

A (clarity + shading + Clear) → C (list parity + default view + gray sliver) → D (picker) →
B (prefetch) → E (delete-or-archive, after `/plan-eng-review`).

## Verification (per increment)

1. `rm -rf .next && pnpm exec tsc --noEmit` clean; `pnpm lint` clean;
   `doppler run --project proxy --config dev -- pnpm exec next build` passes.
2. Visual: authenticated on `localhost:4000` (worktree) via gstack browse + `screenshot.mjs` light +
   dark for each visible change; column-shading options signed off in A.
3. Advisor review of the full R4 diff before merge; `/plan-eng-review` specifically before R4-E.

## Risks / not in scope

- **Concurrency:** `PaperworkShell` + create flow are under active AI-overlay work; R4-B/R4-D
  coordinate around it.
- **Not in scope:** DB-synced view preference, a new saved-color store, per-document status
  breakdown on the board (optional, only if requested), the deferred R3 items (workspace facet,
  Signatures duplicate/archive parity, Forms in-place preview drawer, Status Board your-move/stalled
  filters), and signature AI generation (being built separately).
