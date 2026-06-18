# Editor v3 Phase 1 (Bug Fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five editor defects Johan hit: checklist makes bullets instead of checkboxes, links don't wrap selected text, no undo/redo buttons, highlights can't be cleared, and the Font/Size/Weight selects don't reflect a selection's real style.

**Architecture:** All changes live in the editor folder. A new smart list-item component renders checkboxes; the link control wraps the selection via the installed `@platejs/link` `upsertLink`; the toolbar gains Undo/Redo buttons (Slate history) and a "None" chip in the color palettes; a new `useActiveTextStyle` hook reads explicit marks first and falls back to the selection's computed DOM style, and `EditorSelect` shows a raw value when it isn't one of its options.

**Tech Stack:** React 19, Plate v53 (`platejs/react`, `@platejs/link`, `@platejs/list-classic`), CSS Modules, vitest. No new packages, no schema changes.

**Working dir for all commands:** `apps/web/`. Dev server already runs on port 4000.

---

## File Structure

- **Create** `src/app/(admin)/admin/paperwork/templates/[id]/editor/text-style.ts` — pure helpers `pxToPt`, `matchComputedFontId`, `weightLabel` (unit-tested).
- **Create** `src/app/(admin)/admin/paperwork/templates/[id]/editor/text-style.test.ts` — unit tests for the helpers.
- **Create** `src/app/(admin)/admin/paperwork/templates/[id]/editor/useActiveTextStyle.ts` — hook returning `{ fontId, size, weight }`, mark-first with computed fallback.
- **Modify** `editor/element-components.tsx` — replace `LiEl` with a checkbox-aware `ListItemEl`.
- **Modify** `TemplateEditor.module.css` — task-item layout (checkbox + content, no bullet).
- **Modify** `editor/EditorSelect.tsx` — show the raw `value` when it matches no option; small change only.
- **Modify** `editor/Toolbar.tsx` — Undo/Redo buttons; `Btn` disabled state; "None" chip in palettes; `LinkControl` captures selection + `upsertLink`; wire `useActiveTextStyle` into the font/size/weight selects.

---

## Task 1: Checklist renders real checkboxes

**Files:**
- Modify: `editor/element-components.tsx`
- Modify: `TemplateEditor.module.css`

Task items in `@platejs/list-classic` carry a boolean `checked` on the `li` node (the serializer already emits `data-checked` from it — verified at `html-serialize.ts:198`). `LiEl` currently renders a bare `<li>`, so the checkbox never appears.

- [ ] **Step 1: Replace `LiEl` with a checkbox-aware component.**

In `editor/element-components.tsx`, add imports and replace the `LiEl` line:

```tsx
"use client";

import { PlateElement, useEditorRef } from "platejs/react";
import type { ComponentProps } from "react";
import styles from "../TemplateEditor.module.css";

type ElProps = ComponentProps<typeof PlateElement>;

// ... H1El..HrEl, UlEl, OlEl unchanged ...

/**
 * List item. Task-list items carry a boolean `checked` on the node; render a
 * checkbox bound to it (and suppress the bullet via .taskItem). Plain list
 * items render unchanged.
 */
export function LiEl(p: ElProps) {
  const editor = useEditorRef();
  const checked = (p.element as { checked?: boolean }).checked;
  const isTask = typeof checked === "boolean";
  if (!isTask) return <PlateElement as="li" {...p} />;
  return (
    <PlateElement as="li" {...p} className={styles.taskItem}>
      <span className={styles.taskCheckbox} contentEditable={false}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            const path = editor.api.findPath(p.element);
            if (path) editor.tf.setNodes({ checked: e.target.checked }, { at: path });
          }}
        />
      </span>
      {p.children}
    </PlateElement>
  );
}
```

Keep `LicEl` as the `<div>` content. (`UlEl`/`OlEl`/`LicEl`/others unchanged.)

- [ ] **Step 2: Add task-item CSS.**

Append to `TemplateEditor.module.css`:

```css
/* Task-list items: checkbox + content, no bullet. */
.page :global(li.taskItem) {
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-left: 0;
}
.page :global(li.taskItem) .taskCheckbox {
  flex-shrink: 0;
  margin-top: 3px;
}
.page :global(li.taskItem) input[type="checkbox"] {
  width: 15px;
  height: 15px;
  accent-color: var(--color-brand);
  cursor: pointer;
}
```

(`styles.taskItem`/`styles.taskCheckbox` resolve to hashed names; the `li.taskItem` global selector targets the rendered class. Use `:global(li.taskItem)` so it matches the actual element regardless of hashing — match the existing `.page :global(...)` pattern in this file.)

> Note: the class on the `<li>` comes from `className={styles.taskItem}` (hashed). To make the global CSS match, instead key the CSS off the structure: a task `<li>` is the only `<li>` whose child is an `<input type=checkbox>`. Simpler and hash-proof — replace the selectors above with `.page :global(li:has(input[type="checkbox"]))` for the layout and `.page :global(li:has(> .taskCheckbox))`. Since `:has` is supported in the target browsers, prefer it and drop the `styles.taskItem` className entirely (render `<PlateElement as="li" {...p}>` without the class). Keep the `taskCheckbox` wrapper inline-styled instead to avoid hashing:

```tsx
<span style={{ flexShrink: 0, marginTop: 3 }} contentEditable={false}>
  <input type="checkbox" ... />
</span>
```

and CSS:

```css
.page :global(li:has(> span > input[type="checkbox"])) {
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-left: 0;
}
.page :global(li > span > input[type="checkbox"]) {
  width: 15px;
  height: 15px;
  accent-color: var(--color-brand);
  cursor: pointer;
}
```

- [ ] **Step 3: Verify in the browser.** Reload the Write tab, select list items, click the checklist button. Expected: items show real checkboxes, no bullets; clicking a checkbox toggles it; the "Saved" pill turns green (autosave). Then open Preview: the same items show ☐/☑.

- [ ] **Step 4: Commit.**

```bash
git add ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/element-components.tsx" \
        ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/TemplateEditor.module.css"
git commit -m "fix(editor): render real checkboxes for task lists"
```

---

## Task 2: Link wraps the selected text

**Files:**
- Modify: `editor/Toolbar.tsx` (the `LinkControl` component)

The popover input steals focus, collapsing the editor selection, so we capture it on open and restore it before inserting.

- [ ] **Step 1: Import `upsertLink`.** At the top of `Toolbar.tsx`:

```tsx
import { upsertLink } from "@platejs/link";
```

- [ ] **Step 2: Rewrite `LinkControl` to capture + restore the selection and wrap.**

```tsx
function LinkControl({ editor }: { editor: EditorHandle }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("https://");
  const anchorRef = useRef<HTMLButtonElement>(null);
  // The popover input blurs the editor; remember where the selection was.
  const savedSelection = useRef<unknown>(null);

  function openPopover() {
    savedSelection.current = editor.api.selection?.() ?? null;
    setOpen((v) => !v);
  }

  function commit() {
    const href = url.trim();
    if (!href || href === "https://") {
      setOpen(false);
      return;
    }
    // Restore the selection captured when the popover opened, then wrap it.
    if (savedSelection.current) {
      editor.tf.select(savedSelection.current);
    }
    upsertLink(editor, { url: href });
    setOpen(false);
    setUrl("https://");
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={[base.btn, open ? base.btnActive : ""].filter(Boolean).join(" ")}
        aria-label="Insert link"
        aria-pressed={open}
        title="Insert link"
        onMouseDown={(e) => {
          e.preventDefault();
          openPopover();
        }}
      >
        <LinkSimple size={15} weight="bold" />
      </button>

      <EditorPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} ariaLabel="Insert link">
        <div className={tStyles.linkPopover}>
          <input
            className={tStyles.linkInput}
            type="url"
            value={url}
            placeholder="https://"
            aria-label="URL"
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <button type="button" className={tStyles.linkConfirm}
            onMouseDown={(e) => { e.preventDefault(); commit(); }}>Insert</button>
          <button type="button" className={tStyles.linkCancel} aria-label="Cancel"
            onMouseDown={(e) => { e.preventDefault(); setOpen(false); }}>
            <X size={13} weight="bold" />
          </button>
        </div>
      </EditorPopover>
    </>
  );
}
```

> `editor.api.selection()` returns the current selection; `editor.tf.select(sel)` restores it. `upsertLink(editor, { url })` wraps the (restored) selection in an `<a>`; with a collapsed selection it inserts the URL as text. If `editor.api.selection` is not a function in this build, fall back to reading `editor.selection` directly (it is a plain property on the Slate editor).

- [ ] **Step 3: Verify.** Select a word, click the link button, type a URL, Insert. Expected: the selected word becomes a link (`<a href>` in the editor DOM and serialized HTML). With nothing selected, Insert drops the URL as a link at the cursor.

- [ ] **Step 4: Commit.**

```bash
git add ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/Toolbar.tsx"
git commit -m "fix(editor): link wraps the selected text"
```

---

## Task 3: Undo / Redo buttons

**Files:**
- Modify: `editor/Toolbar.tsx`

- [ ] **Step 1: Extend `Btn` with a `disabled` prop.**

```tsx
function Btn({ active, disabled, label, onAction, children }: {
  active?: boolean; disabled?: boolean; label: string; onAction: () => void; children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={[base.btn, active ? base.btnActive : ""].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onAction(); }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Add disabled styling.** In `TemplateEditor.module.css`, under `.btn`:

```css
.btn:disabled {
  opacity: 0.35;
  cursor: default;
}
```

- [ ] **Step 3: Add undo/redo state + Tier-1 items.** Import the icons (`ArrowUUpLeft`, `ArrowUUpRight` from `@phosphor-icons/react`). In `EditorToolbar`, add selectors and prepend two Tier-1 items before `block`:

```tsx
const canUndo = useEditorSelector((ed) => ed.history.undos.length > 0, []);
const canRedo = useEditorSelector((ed) => ed.history.redos.length > 0, []);
```

```tsx
const tier1Items: ToolbarItem[] = [
  { id: "undo", group: "history", node: (
    <Btn label="Undo" disabled={!canUndo} onAction={() => editor.undo()}>
      <ArrowUUpLeft size={15} weight="bold" />
    </Btn>) },
  { id: "redo", group: "history", node: (
    <Btn label="Redo" disabled={!canRedo} onAction={() => editor.redo()}>
      <ArrowUUpRight size={15} weight="bold" />
    </Btn>) },
  // ... existing block / bold / italic / underline / font / size ...
];
```

> `editor.undo()` / `editor.redo()` are Slate history methods on the editor; `editor.history.undos/redos` are the stacks. The `EditorHandle` narrow type already exposes `api`/`tf`; add `undo`/`redo`/`history` to it: change `type EditorHandle = { tf: any; api: any }` to `type EditorHandle = { tf: any; api: any; undo: () => void; redo: () => void; history: { undos: unknown[]; redos: unknown[] } }`.

- [ ] **Step 4: Verify.** Type, then Undo reverts and Redo re-applies; Undo is dimmed at the start (empty history), Redo dimmed until you undo.

- [ ] **Step 5: Commit.**

```bash
git add ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/Toolbar.tsx" \
        ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/TemplateEditor.module.css"
git commit -m "feat(editor): undo/redo toolbar buttons"
```

---

## Task 4: Clear a highlight / color ("None" chip)

**Files:**
- Modify: `editor/Toolbar.tsx` (the `ColorSwatch` component + its two usages)
- Modify: `editor/Toolbar.module.css`

- [ ] **Step 1: Add a `None` chip to `ColorSwatch`.** Give it an `onClear` callback; render a leading chip with a diagonal slash before the color chips:

```tsx
function ColorSwatch({ colors, currentColor, label, onPick, onClear, renderTrigger }: {
  colors: string[]; currentColor: string; label: string;
  onPick: (hex: string) => void; onClear: () => void; renderTrigger: () => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={anchorRef} type="button" aria-label={label} aria-expanded={open}
        aria-haspopup="dialog" title={label} className={tStyles.swatchBtn}
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}>
        {renderTrigger()}
      </button>
      <EditorPopover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} ariaLabel={label}>
        <div className={tStyles.palette} role="listbox" aria-label={label}>
          <button type="button" role="option" aria-label="None" title="None"
            className={tStyles.paletteNone}
            onMouseDown={(e) => { e.preventDefault(); onClear(); setOpen(false); }} />
          {colors.map((hex) => (
            <button key={hex} type="button" role="option" aria-selected={hex === currentColor}
              aria-label={hex} title={hex} className={tStyles.paletteChip}
              style={{ backgroundColor: hex }}
              onMouseDown={(e) => { e.preventDefault(); onPick(hex); setOpen(false); }} />
          ))}
        </div>
      </EditorPopover>
    </>
  );
}
```

- [ ] **Step 2: Wire `onClear` at both call sites.**

```tsx
// text color
onClear={() => editor.tf.removeMark("color")}
// highlight color
onClear={() => editor.tf.removeMark("backgroundColor")}
```

- [ ] **Step 3: Style the None chip.** In `editor/Toolbar.module.css`:

```css
.paletteNone {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1.5px solid rgba(15, 23, 42, 0.2);
  background:
    linear-gradient(to top left, transparent calc(50% - 1px), #dc2626 calc(50% - 1px), #dc2626 calc(50% + 1px), transparent calc(50% + 1px)),
    #fff;
  cursor: pointer;
}
.paletteNone:hover { box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2); }
.paletteNone:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
```

- [ ] **Step 4: Verify.** Apply a highlight, reopen the highlight palette, click None — the highlight clears. Same for text color.

- [ ] **Step 5: Commit.**

```bash
git add ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/Toolbar.tsx" \
        ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/Toolbar.module.css"
git commit -m "feat(editor): clear text/highlight color with a None chip"
```

---

## Task 5: Font/Size/Weight reflect the real value

**Files:**
- Create: `editor/text-style.ts`, `editor/text-style.test.ts`, `editor/useActiveTextStyle.ts`
- Modify: `editor/EditorSelect.tsx`, `editor/Toolbar.tsx`

- [ ] **Step 1: Write the failing unit tests** in `editor/text-style.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pxToPt, matchComputedFontId } from "./text-style";

describe("pxToPt", () => {
  it("converts 11pt-equivalent px to 11pt", () => {
    expect(pxToPt("14.6667px")).toBe("11pt"); // 11 * 96/72
  });
  it("converts heading px to pt", () => {
    expect(pxToPt("22.6667px")).toBe("17pt"); // 17pt
  });
  it("handles plain numbers", () => {
    expect(pxToPt(16)).toBe("12pt");
  });
});

describe("matchComputedFontId", () => {
  it("matches an explicit web-font stack by googleFamily", () => {
    expect(matchComputedFontId("Montserrat, sans-serif")).toBe("montserrat");
  });
  it("matches the CSS heading font by label", () => {
    expect(matchComputedFontId("Arial, Helvetica, sans-serif")).toBe("arial");
  });
  it("matches the default body font", () => {
    expect(matchComputedFontId('Georgia, "Times New Roman", serif')).toBe("georgia");
  });
  it("returns empty string for an unknown family", () => {
    expect(matchComputedFontId("Comic Sans MS")).toBe("");
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `pnpm exec vitest run src/app/\(admin\)/admin/paperwork/templates/\[id\]/editor/text-style.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `editor/text-style.ts`:**

```ts
import { FONTS } from "./fonts";

/** Computed px font-size (e.g. "14.6667px" or number) → "Npt" string. */
export function pxToPt(px: string | number): string {
  const n = typeof px === "number" ? px : parseFloat(px);
  if (!Number.isFinite(n)) return "";
  return `${Math.round(n * 0.75)}pt`;
}

/**
 * Maps a computed font-family string to a known font id. Checks each font's
 * googleFamily (used by explicit marks) and its human label (used by CSS
 * defaults like "Arial"/"Georgia"). Returns "" when nothing matches.
 */
export function matchComputedFontId(family: string): string {
  if (!family) return "";
  const f = family.toLowerCase();
  for (const font of FONTS) {
    if (f.includes(font.googleFamily.toLowerCase()) || f.includes(font.label.toLowerCase())) {
      return font.id;
    }
  }
  return "";
}
```

- [ ] **Step 4: Run the tests to green.**

Run: `pnpm exec vitest run src/app/\(admin\)/admin/paperwork/templates/\[id\]/editor/text-style.test.ts`
Expected: PASS (7 assertions).

- [ ] **Step 5: Implement `editor/useActiveTextStyle.ts`:**

```ts
"use client";

import { useEffect, useState } from "react";
import { useEditorSelector } from "platejs/react";
import { FONTS } from "./fonts";
import { pxToPt, matchComputedFontId } from "./text-style";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorHandle = { api: any };

export type ActiveTextStyle = { fontId: string; size: string; weight: string };

/**
 * Mark-first, computed-fallback text style for the toolbar selects. When the
 * selection carries an explicit fontFamily/fontSize/fontWeight mark, that wins;
 * otherwise we read the rendered style off the DOM (so a CSS-styled heading
 * reports e.g. Arial / 17pt / 700 instead of blank).
 */
export function useActiveTextStyle(editor: EditorHandle): ActiveTextStyle {
  const selKey = useEditorSelector(
    (ed: { selection: unknown }) => JSON.stringify(ed.selection),
    [],
  );
  const [style, setStyle] = useState<ActiveTextStyle>({ fontId: "", size: "", weight: "" });

  useEffect(() => {
    const marks = (editor.api.marks() ?? {}) as Record<string, unknown>;
    const markFontId = marks.fontFamily
      ? (FONTS.find((f) => f.stack === marks.fontFamily)?.id ?? "")
      : "";
    const markSize = (marks.fontSize as string | undefined) ?? "";
    const markWeight = (marks.fontWeight as string | undefined) ?? "";

    // Computed fallback from the DOM selection's focus node.
    let csFontId = "", csSize = "", csWeight = "";
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const node = sel?.focusNode ?? null;
    const el = node ? (node.nodeType === 3 ? node.parentElement : (node as Element)) : null;
    if (el) {
      const cs = getComputedStyle(el);
      csFontId = matchComputedFontId(cs.fontFamily);
      csSize = pxToPt(cs.fontSize);
      csWeight = String(parseInt(cs.fontWeight, 10) || 400);
    }

    setStyle({
      fontId: markFontId || csFontId,
      size: markSize || csSize,
      weight: markWeight || csWeight,
    });
    // Recompute whenever the selection changes.
  }, [selKey, editor]);

  return style;
}
```

- [ ] **Step 6: Let `EditorSelect` show an unmatched value.** In `editor/EditorSelect.tsx`, change the label fallback so a detected value that is not in `options` still displays:

```tsx
const current = options.find((o) => o.value === value);
// ...
<span className={`${styles.label} ${current || value ? "" : styles.placeholder}`}>
  {current?.label ?? (value || placeholder)}
</span>
```

- [ ] **Step 7: Wire the hook into the toolbar.** In `Toolbar.tsx`, replace the three `useEditorSelector` reads (`activeFontId`, `activeSize`, `activeWeight`) with:

```tsx
const { fontId: activeFontId, size: activeSize, weight: activeWeight } = useActiveTextStyle(editor);
```

(`activeColor`/`activeBgColor` stay as-is.) Add the import:

```tsx
import { useActiveTextStyle } from "./useActiveTextStyle";
```

- [ ] **Step 8: Verify.** Click into a body paragraph → Font shows "Georgia", Size "11pt", Weight "Regular". Click into the title (h1) → Font "Arial", Size "17pt", Weight "Bold". Explicitly pick Montserrat on a range → the selects still reflect the chosen values.

- [ ] **Step 9: Commit.**

```bash
git add ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/text-style.ts" \
        ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/text-style.test.ts" \
        ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/useActiveTextStyle.ts" \
        ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/EditorSelect.tsx" \
        ":(literal)src/app/(admin)/admin/paperwork/templates/[id]/editor/Toolbar.tsx"
git commit -m "feat(editor): font/size/weight selects detect the selection's real style"
```

---

## Task 6: Full verification + cleanup

- [ ] **Step 1:** `rm -rf .next` is NOT needed (no route changes). Run `pnpm exec tsc --noEmit` → 0 errors.
- [ ] **Step 2:** `pnpm lint` (or eslint on the changed files) → 0 errors/warnings.
- [ ] **Step 3:** `pnpm exec vitest run` → all green (existing 240 + new text-style tests).
- [ ] **Step 4: Browser pass on port 4000** (gstack browse): checklist checkboxes toggle and persist; link wraps a selected word (`<a>` in DOM + serialized HTML); Undo/Redo work and disable correctly; None clears a highlight; the font/size/weight selects report the real values for a paragraph and for the heading. Read screenshots.
- [ ] **Step 5: Reset the demo template** `8f35ae6c-6709-4979-987a-c35f0b3b341c` to clean content (Johan edited it while testing). Restore from a known-clean snapshot or re-seed the Property Management Addendum content, and ensure `source_html = published_html`.
- [ ] **Step 6: Advisor (Fable) gate**, then report to Johan with the link.

---

## Self-Review notes

- **Spec coverage:** Task 1 = checkbox, Task 2 = link wrap, Task 3 = undo/redo, Task 4 = clear highlight, Task 5 = font/size/weight detection. All five design items covered.
- **Type consistency:** `EditorHandle` is widened in Task 3 to include `undo`/`redo`/`history`; `useActiveTextStyle` uses its own narrow `{ api }` handle; `ColorSwatch` gains `onClear`; `EditorSelect` value fallback is additive.
- **Risk:** `editor.api.selection()` vs `editor.selection` — Task 2 notes the fallback. `getComputedStyle` fallback in Task 5 is read-only and guarded for SSR (`typeof window`). The `:has()` selector in Task 1 is supported in the target browsers; if any doubt, the inline-styled `taskCheckbox` wrapper makes the structural selector reliable.
