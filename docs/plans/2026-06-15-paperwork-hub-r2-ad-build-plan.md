# Paperwork Hub Redesign — Round 2 UI Wave (A-D) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (this session) or superpowers:executing-plans (parallel) to implement task-by-task.

**Goal:** Ship the validated Round 2 visual redesign of the admin Paperwork section (create-flow gallery, Library/Activity hubs, redesigned Action Center, Status Board polish) as four independent, individually reviewable increments on top of Phase 1. UI only; no data-model changes.

**Architecture:** Port the look already validated in the disposable previews (`apps/web/src/app/preview/{action-center,paperwork-hub,template-gallery}`) into real, token-driven components wired to the existing data fetchers. A handful of reusable building blocks (Template Gallery, template card, icon picker, Send sheet, Action Center card, right drawer) are built once and reused across Signatures and Forms. Each milestone (R2-A..D) is its own commit + `/review`, then merges. Phase 1 (`paperwork/phase-1`, committed `61980606`) is the foundation; this wave extends it.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, CSS Modules, `motion/react`, Phosphor Icons (duotone), Tailwind v4 tokens (`globals.css`), Supabase, vitest.

---

## Shared conventions (read before any task)

1. **Source of truth for the look:** the three preview components and their CSS. Port markup/styles from them; do not redesign. Preview → real-component mapping:
   - `preview/action-center/ActionCenterPreview.tsx` + `preview.module.css` → real `ActionCenterDrawer.tsx`.
   - `preview/paperwork-hub/HubPreview.tsx` + `hub.module.css` → real Signatures/Forms hub (Library card+list, Activity table).
   - `preview/template-gallery/GalleryPreview.tsx` + `gallery.module.css` → real Template Gallery modal + template card.
2. **Tokens, not hardcodes.** Replace preview hardcodes with `globals.css` tokens (`--color-brand`, `--surface-base`, `--dash-border`, `--text-*`, `--shadow-*`, `--color-brand-gradient`, `--font-sora`, `--ease-spring`). Keep the preview's `color-mix()` patterns.
3. **Dark elevated-surface fix (real finding).** Our dark tokens make cards slightly *darker* than the canvas. Add a reusable elevated-surface treatment in dark (a `--surface-elevated` token in `:root.dark`, or a documented `.dark` override pattern) so cards/rows lift off the canvas with a visible border. Apply to every card/table/drawer surface this wave adds. Decide the token name in Task A0 and reuse it everywhere.
4. **No data-model work.** Do NOT touch `spine.ts deriveDesiredRows`, expiry tables, the documents spine schema, or board column derivation. The "Status Board tracking" toggle and the Send-sheet audience/security are **UI-only** this wave (persist toggle state to the existing `document_templates.settings` jsonb if trivial; otherwise stub with a TODO and a disabled-state note). Per-recipient link wiring, board tracking engine, AI, and signature field extraction are the deferred E-G wave.
5. **Naming (locked):** create buttons = **New paperwork** (Status Board) / **New signature** / **New form**; the created-docs sub-tab = **Library** (never "Templates"); the instances sub-tab = **Activity** (never "Completions"); board summary = **"N workspaces · M documents tracked"**.
6. **Verification per milestone:** `pnpm exec tsc --noEmit` (clean; `rm -rf .next` first if stale), `pnpm lint`, `doppler run --project proxy --config dev -- pnpm exec next build`, then **authenticated** screenshots of the real admin route in light + dark via `node screenshot.mjs <url> --theme {light,dark} --dev-login` on **port 4000** (dev-login only works there; `/preview` shortcuts do not exercise real data). Advisor review of the diff, then `/review`.
7. **Commit boundaries:** one commit per task, one `/review` per milestone (R2-A, R2-B, R2-C, R2-D). End commit messages with the Co-Authored-By trailer.
8. **Cleanup gate:** the final task deletes `apps/web/src/app/preview/{action-center,paperwork-hub,template-gallery}`. Nothing in `src/` outside `preview/` may import from `preview/`.

---

## Task A0: Dark elevated-surface token (foundation for all cards)

**Files:** Modify `apps/web/src/app/globals.css` (the `:root.dark` block).

- Add `--surface-elevated` (light: same as `--surface-base`; dark: a tone ~`#1d212a`, clearly lighter than the dark `--color-off-white` canvas) and `--border-elevated` (dark: `rgba(255,255,255,0.09)`).
- **Verify:** grep that the tokens exist in both `:root` and `:root.dark`; no visual change in light.
- **Commit:** `feat(paperwork): add elevated-surface tokens for dark cards`.

---

## Milestone R2-A — Status Board polish + tracking toggle UI

Targets: `components/admin/status-board/StatusBoard.module.css`, `StatusBoardView.tsx`, `StatusBoardTab.tsx` (+ `.module.css`), `PaperworkShell.tsx` (+ `.module.css`), `status-board-config.ts`, `paperwork/page.tsx`, and the template Settings card.

### Task A1: Page padding off the nav
- In the paperwork route's content wrapper (`PaperworkShell.module.css` `.shell` / the admin content area), ensure horizontal/top padding so nothing is edge-to-edge against the sidebar. Match the hub preview's `.page` padding (`~26px 32px`).
- Verify: screenshot `/admin/paperwork` at admin width; left gutter visible.

### Task A2: Center the corner status-key
- `StatusBoard.module.css` `.matrixCornerCell` + `.legend*`: center the legend grid within the corner cell (the user flagged it left-hugging). Keep the 6-state legend; ensure even alignment.
- Verify: screenshot corner cell; legend visually centered.

### Task A3: True dashed "not sent" ring (bug fix)
- `StatusBoardView.tsx` `CompletionRing` `needed` branch + `.cellNeeded`: render a **dashed** ring (it currently reads as a solid gray dot). Use `border: 1.5px dashed var(--text-tertiary); background: transparent;` at the right opacity for light + dark.
- Verify: screenshot a `needed` cell in both themes; clearly dashed.

### Task A4: Color-coded kinds down the bands
- `status-board-config.ts`: confirm/extend a per-kind color (signature=`--color-brand` blue, form=purple `#7c3aed`, file=green `--color-success`). `StatusBoard.module.css` `.matrixGroupBand_*` + the column band tints: carry each kind's tint down its column band so the filter and the matrix share one color language.
- Verify: screenshot the board header + bands; three distinct kind tints.

### Task A5: Unified count line
- `StatusBoardTab.tsx`: replace the duplicated "N workspaces tracked" caption + the board's result summary with one line: **"N workspaces · M documents tracked"** (M = visible columns). Remove the redundant caption.
- Verify: only one count line renders.

### Task A6: Action Center trigger inline with create button
- Move the Action Center trigger pill from `StatusBoardTab`'s own toolbar row into `PaperworkShell`'s header `headerActions`, immediately left of the create button (`New paperwork`), off its own line and off the edge. `StatusBoardTab` dispatches the same `admin:action-center-toggle` event; pass the count down (keep the `fetchActionQueue` count from `page.tsx`).
- Verify: trigger sits inline beside the create button; clicking still opens the drawer.

### Task A7: "Status Board tracking" toggle UI on template Settings
- In the template Settings surface (`templates/[id]/CoverageSettingsCard.tsx` or its replacement): **retire the stale Coverage copy** and render a "Status Board tracking" card — a toggle (default on) + scope radio (Owner/Property/Workspace) + the copy from the design doc §6.2. **UI only**: persist to `document_templates.settings` jsonb if a setter already exists; otherwise render the control disabled with a "wires up in the tracking engine" note. Do NOT build column derivation or auto-instantiation.
- Verify: card renders, no "Coverage view" / "Documents tab" copy remains (`grep -ri "coverage view" apps/web/src`).

### Task A8: Verify + review R2-A
- tsc, lint, build, authenticated light+dark screenshots of `/admin/paperwork`. Advisor review. `/review`. Commit per task; this is the first mergeable increment.

---

## Milestone R2-B — Shared blocks (Template Gallery, template card, icon picker, Send sheet)

Targets (new): `components/admin/paperwork/TemplateGallery.tsx` (+ css), `TemplateCard.tsx` (+ css), `components/admin/IconPicker.tsx` (+ css). Modify: `PaperworkShell.tsx` (replace `NewDocumentChooser`), `templates/SendSheet.tsx` (+ css), forms appearance card.

### Task B1: Reusable `TemplateCard`
- Port `gallery.module.css` / `hub.module.css` card: signature → document-preview (`MiniDoc`); form → icon/color tile. Props: `{ kind, name, tone, icon, sentCount?, onSelect?, selected?, actions? }`. Two-line titles (`-webkit-line-clamp:2`, min-height), elevated in dark (A0 token).
- Verify: render both variants in a scratch story or the hub; equal heights, no truncation.

### Task B2: `TemplateGallery` modal
- Port `GalleryPreview.tsx`: type switch (Signature|Form), category sidebar (All / Recents / Your templates / Proxy library / by-group), search, "Start fresh" (Blank + Generate with AI), Your library + Proxy library grids of `TemplateCard`, Cancel/Create. Data: `listDocumentTemplates()` (signatures) + `listForms(orgId)` (forms), split by `org_id` into Your vs Proxy. AI card routes to the existing forms AI path (`AiGenerateSlideOver`) for forms; for signatures, the AI card is present but routes to "coming soon"/disabled (R2-G). Create routes: Blank/template → `createFormAction` or the signature template create, into `templates/[id]`.
- Verify: opens, type switch swaps datasets, Create navigates correctly.

### Task B3: Wire create flow through the gallery
- `PaperworkShell.tsx`: replace `NewDocumentChooser` + the chooser path with `TemplateGallery`. **New paperwork** (status) opens it with no type pre-selected; **New signature** opens scoped to signatures; **New form** scoped to forms (both still switchable). Keep `?create=pdf` upload deep-link handling.
- Verify: each create button opens the gallery in the right state.

### Task B4: `IconPicker` (Notion-style)
- New popover: search + two tabs (Emoji / Icons). Icons = searchable Phosphor set (decide source: `@phosphor-icons/react` dynamic list vs the local SVGs at `workspace/_assets/icons/phosphor`). Props: `{ value, onChange }`. Reusable.
- Replace the fixed icon grid on the forms appearance card with `IconPicker`.
- Verify: search filters; selecting updates the form icon (autosave handled in C).

### Task B5: Send sheet — audience + security UI
- Extend `templates/SendSheet.tsx`: audience radios (Public link / Entire workspace / Specific client) + security (Require access code with PIN input, Expires-after). **UI only** — render the controls and reflect state; do not wire per-recipient tokenized links (R2-E). Gate the not-yet-wired controls clearly (helper text) so they do not imply working behavior.
- Verify: sheet renders all controls; existing public-link send still works.

### Task B6: Verify + review R2-B
- tsc, lint, build, authenticated screenshots (open the gallery from a real admin page, light+dark). Advisor review. `/review`.

---

## Milestone R2-C — Hubs (Library + Activity) + drawer + Forms specifics

Targets: `paperwork/signatures/{page.tsx,SignaturesHub.tsx}`, `paperwork/forms/{page.tsx,FormsTab.tsx}`, new `Activity` components, `DocumentDrawer.tsx` (+ css), `templates/[id]/FormTemplateDetail.tsx`, `SendingSettings.tsx`.

### Task C1: Library sub-tab (rename + card/list)
- Both hubs: rename the landing sub-tab **Templates → Library**; groups → **Your signatures** / **Your forms** + **Proxy library**. Port the hub preview's card+list views, the Cards/List toggle (labeled), and the cross-link to the other library. Templates render via `TemplateCard` (B1).
- Verify: lands on Library; Cards/List toggles real layouts; cross-link navigates.

### Task C2: Activity sub-tab (table + filters)
- Both hubs: the Activity table from the preview (columns Document / Who / Status / Sent / **Seen** / Signed|Submitted), filters (Property/Workspace/Document/Signer/Status), no count on the tab label. Data from existing fetchers (`fetchDocumentsHubData` versions for signatures; `listFormResponsesDetailed` for forms). Rows open the drawer (C3).
- Verify: table renders real instances; Seen column highlighted; filters present.

### Task C3: Evolve `DocumentDrawer` into the Activity drawer
- Extend the existing `DocumentDrawer.tsx`: header (name + status + contact), **Sent → Seen → Signed/Submitted timeline** (Seen from `viewedAt`), **extracted-fields panel** (forms: from stored response data; signatures: leave a placeholder section labeled for R2-G), signers, actions. Reuse the existing audit-log/certificate wiring.
- Verify: opening a form submission shows extracted fields; a signature shows the timeline + placeholder.

### Task C4: Forms hub specifics
- `FormsTab.tsx` Library cards/rows: fill metadata (questions · pending · answered · last activity · created). `FormTemplateDetail.tsx`: move "About this template" to a top identity header (visible across Build/Responses/Settings). Add an autosave-on-blur **"Saving… → Saved ✓"** indicator near the title for builder/appearance/settings (wire to existing update actions; debounce on blur).
- Verify: metadata shows; About is at the top; editing a field shows Saving→Saved.

### Task C5: Verify + review R2-C
- tsc, lint, build, authenticated screenshots of `/admin/paperwork/signatures` and `/forms` (Library + Activity + drawer), light+dark. Advisor review. `/review`.

---

## Milestone R2-D — Action Center redesign

Targets: `components/admin/chrome/ActionCenterDrawer.tsx` (+ css), `/api/admin/action-center/route.ts` (shape only if needed for the why-line/chips).

### Task D1: Vertical cards
- Port `ActionCenterPreview` cards into `ActionCenterDrawer`: header (type icon + name + status badge), divider, who (avatar + name + property + email), big urgency headline, **why-line** (plain-language context), **context chips** (kind / impact / reminder count), **Sent→Seen→Signed mini-meter**, centered footer (sent-by / validity), full-width actions (Remind / Resend / View, or Request renewal / Call owner). Severity color on badge + headline. The route already returns enriched items; add `context`/`chips` fields derived server-side from existing data (no new tables).
- Verify: cards render from the real route with the enriched fields.

### Task D2: Collapsible premium section headers
- Port the collapsible `Section` (tone dot + Sora title + count that persists when collapsed + right chevron, hover bar). Three sections (Needs attention / Expiring soon / Lapsed); Expiring/Lapsed stay honest empty states until R2-E/F.
- Verify: sections collapse/expand; counts persist collapsed.

### Task D3: Inline trigger handshake
- Confirm the A6 inline trigger drives this drawer (event + count). Remove any leftover standalone trigger.
- Verify: inline trigger opens the redesigned drawer.

### Task D4: Verify + review R2-D
- tsc, lint, build, authenticated screenshots of the drawer open over `/admin/paperwork`, light+dark, including a collapsed section. Advisor review. `/review`.

---

## Final Task: Remove disposable previews + close out

- Delete `apps/web/src/app/preview/{action-center,paperwork-hub,template-gallery}`.
- `grep -rn "app/preview" apps/web/src` → zero references from real code.
- tsc + lint + build clean.
- Commit `chore(paperwork): remove Round 2 disposable previews`.
- Hand off to the user for `/ship` (do not deploy).

---

## NOT in scope (deferred to the E-G data-model wave)
- Per-recipient tokenized send links, access-code enforcement, expiration (R2-E).
- Board tracking engine: dynamic template-driven columns, auto-instantiation on new owner/property, migration off the fixed requirement set, the open per-form completion-semantics question (R2-F).
- DocuSeal signature field extraction; forms-AI metadata generation; signatures-AI (R2-G).
- Any change to `spine.ts deriveDesiredRows`, the expiry systems, or the documents-spine schema.

## Test notes
- Pure-logic additions (Action Center `context`/`chips` derivation, count formatting, autosave debounce) get vitest unit tests (`pnpm exec vitest run`).
- UI is verified by authenticated light+dark screenshots per milestone (the real gate, since the look is the deliverable).
- The Action Center route keeps its `requireAdminUser` gate; add a test asserting 403 unauth if one does not exist.
