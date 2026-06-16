# Unified AI Modal — Design

**Goal:** The "Generate with AI" flow renders *inside* the existing template gallery modal as in-place views, instead of closing the gallery and opening a second modal. One premium modal: light template chooser → morphs to the dark premium AI workspace → back arrow returns. Applies to **both** Signature and Form create paths.

## Decisions (locked)
- **Morph to dark.** The single modal container stays mounted; entering AI animates its background/border light → dark and crossfades the chooser body out for the AI flow. Preserves the dark CPU generation scene and makes "entering AI" a deliberate premium moment.
- **Both flows** unified (Signature + Form).
- Entry: clicking the **Generate with AI** tile (for the active type) enters the AI flow immediately (one click, in-place), no separate footer click.

## Architecture
`TemplateGallery` becomes the single modal host (its existing `createPortal`). New state `view: "browse" | "ai"`.
- `view === "browse"`: today's light chooser.
- `view === "ai"`: renders the matching shell-less flow inside the modal; container carries a `.modalDark` variant; header shows `← Templates` (back) + close X.

The two standalone overlays are split into **shell** (portal/backdrop/panel/chrome) and **flow** (the step machine):
- `AICreationFlow` — prompt → generating(CPU) → preview. Props: `onExit()`, `onCreated(intelligence)`, `onStepChange?(step)`. No portal/backdrop/panel/close.
- `FormAIFlow` — describe → generating → review. Props: `onExit()`, `onCreated(payload)`, `onStepChange?(step)`. No portal/backdrop/panel/close.
- `AICreationOverlay` / `FormAIOverlay` become thin portal wrappers around their flow (Phase 1, behavior-preserving), then are retired from `PaperworkShell` (Phase 2). Each is used only by `PaperworkShell`.

## Data flow
Gallery reports the final AI result upward via new callbacks `onAiSignatureCreated(intelligence)` / `onAiFormCreated(payload)`. `PaperworkShell` wires them to its existing `handleSignatureAICreated` / `handleFormAICreated` (own the create server actions, navigation, and closing the modal). Generation errors stay inline in the flow. Back disabled / hidden during `generating`; close always works.

## Theme morph
`.modal.modalDark` transitions `background`, `border-color`, header/footer chrome to the dark palette (`#0f172a` family, brand glow). AI step content is already dark-themed. The modal keeps one stable, generous footprint (chooser width) so nothing jumps; AI steps center within it (prompt/generating) or use the split layout (preview). Reduced motion: skip the morph/crossfade, swap instantly.

## Phases (sub-agent execution, senior review between each)
1. **Extract flows** (behavior-preserving): `AICreationFlow` + `FormAIFlow`; old overlays become thin wrappers. Verify tsc + overlays still work standalone. (2 parallel agents, disjoint files.)
2. **Host in gallery**: `view` state, AI tile entry, dark morph, back chrome, completion callbacks; `PaperworkShell` rewires to the gallery, retires standalone mounts.
3. **Polish + verify**: morph transition, layout/sizing (incl. signature split), reduced motion, no scrollbars; gstack e2e for both flows; tsc; screenshots; open the page + link.

## Verification
gstack browse (dev port 4000, dev-auth shortcut): entering AI morphs the *same* modal (assert only one dialog/portal in the DOM, no stacked backdrop), back returns to the light chooser, generate → review → create navigates, for both Signature and Form; reduced-motion; no spurious scrollbars. `pnpm exec tsc --noEmit` clean (pre-existing `use-upload-file.ts` error excepted).
