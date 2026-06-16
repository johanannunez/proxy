# Editor v3: Fixes and Features Design

**Date:** 2026-06-16
**Context:** Johan tested the rebuilt document-editor toolbar (editor v2) and surfaced a batch of bugs and feature requests. This design covers them. Per his call, we ship the bug fixes first (Phase 1), then the features (Phase 2) in a later pass.

## Decisions (from scoping)

- **Sequencing:** bugs first (Phase 1), features second (Phase 2).
- **Insert UX:** both a Notion-style `/` slash menu and a toolbar "Insert" dropdown (Phase 2).
- **Page thumbnails:** visual mini-page renders mirroring real pagination (Phase 2), not an estimated rail.

## Confirmed technical facts

- `@platejs/list-classic` task items carry a `checked` boolean and a `todo` list style on the `li` node. A list-item component can render a checkbox bound to it.
- `@platejs/link` exports `upsertLink(editor, { url, text? })`, which wraps the current selection in a link. Already installed.
- No slash-command package is installed; the `/` menu (Phase 2) needs `@platejs/slash-command` (+ combobox).
- Tables already work via `@platejs/table` (registered); they only lack an insert trigger (Phase 2).
- The serializer already emits `li[data-checked]`; the shell CSS draws ☐ / ☑. So a checkbox in the editor will match Preview and the signed PDF.

---

## Phase 1 — Bug fixes (this pass)

Scope: `editor/element-components.tsx`, `editor/Toolbar.tsx`, the `LinkControl` and color controls inside it, one new `editor/useActiveTextStyle.ts` hook, and `EditorSelect` (a small prop for disabled state). No schema changes, no new packages.

### 1. Checklist renders real checkboxes
`TaskListPlugin` is registered but `LiEl` renders a plain `<li>`, so a task list looks like bullets. Replace `LiEl` with a component that, when the item is a todo item (`element.listStyleType === 'todo'` / `checked` present), renders a `contentEditable={false}` checkbox bound to `element.checked`, toggled with `editor.tf.setNodes({ checked }, { at })`, and suppresses the bullet. Non-todo items render unchanged.

### 2. Link wraps the selected text
`LinkControl` currently inserts the URL as new text. The popover input steals focus, so: capture `editor.selection` when the popover opens, and on Insert restore it and call `upsertLink(editor, { url })`. Non-collapsed selection → the selected text becomes the link; collapsed → insert the URL as text (today's behavior).

### 3. Undo / Redo buttons
Slate history is already enabled (Cmd+Z works). Add Undo and Redo buttons at the start of the toolbar (Tier-1, before the block select), calling `editor.undo()` / `editor.redo()`, each disabled when its history stack is empty (read via `useEditorSelector` on `editor.history.undos/redos`). `EditorSelect` is untouched; the buttons reuse `Btn` with a new `disabled` affordance.

### 4. Clear a highlight / color
Prepend a "None" chip to both the text-color and highlight palettes. Picking it calls `editor.tf.removeMark('color')` / `removeMark('backgroundColor')`, so a highlight can be removed without hunting for undo.

### 5. Font / Size / Weight detect the real value
Today the selects reflect only explicit marks, so a CSS-styled heading reads blank. Add `useActiveTextStyle`: if an explicit mark exists, use it; otherwise read the selection's rendered style from the DOM (`editor.api.toDOMNode` → `getComputedStyle`) and map font-family → closest known font, font-size px → pt, font-weight → label. The selects display the real value (e.g. "Arial · 17pt · Bold" on the title); picking a value still applies a mark.

### Phase 1 verification
- `tsc`, lint, `vitest run` clean.
- In-browser on port 4000: checklist shows real ☐/☑ that toggle; select text + Insert link wraps it (verify `<a>` in the DOM and serialized HTML); Undo/Redo work and disable correctly; "None" clears a highlight; selecting the heading shows Arial/17pt/Bold in the selects.
- Reset the demo template to clean content before the reveal.
- Advisor (Fable) gate before merge.

---

## Phase 2 — Features (next pass, designed separately)

Recorded here so the direction is captured; each gets its own plan.

- **Block-style previews:** render each option in the block dropdown styled as its block (H1 large/bold, Blockquote italic with rule, Code block monospace). Add an optional per-option style to `EditorSelect`.
- **Insert via `/` and toolbar:** add `@platejs/slash-command` (+ combobox) for a `/` menu (table, image, divider, page break, headings, lists, blockquote, code block) and a parallel toolbar "Insert" dropdown using `EditorPopover`. Tables insert via the existing `@platejs/table`.
- **Visual mini-page thumbnails (Write view):** a left rail of miniature page renders mirroring the Paged.js pagination used in Preview, updated debounced on edit, click-to-scroll to the page's content. Heaviest item; needs its own design for the pagination-to-editor mapping and edit-time performance.
