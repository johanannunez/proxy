# Document Editor v2 — Design

## Overview

Editor v1 shipped a working Plate v53 "Write" tab that authors HTML, saves to a
DocuSeal template, and unlocks the Fields builder. Live testing surfaced clear
gaps. v2 turns it into a real document editor: a comprehensive toolbar, a
decoupled draft/publish save model with autosave, a pinned layout, an exact
paginated preview with a page navigator, an image uploader, and correct
multi-party signing.

This builds on v1 (branch `feat/plate-html-editor`). The custom `valueToHtml`
serializer, the round-trip test discipline, and the DocuSeal-output shell all
carry forward and expand.

## Goals (from feedback)

1. Never lose work. Switching Write to Fields must persist; manual-save-only is
   fragile. Add autosave.
2. The frame holds still. Top tabs, the Write/Fields/Settings tabs, and the
   toolbar stay pinned; only the document scrolls.
3. A comprehensive toolbar. v1 felt basic.
4. Pages on the left, collapsible, with a count. Page breaks.
5. Write matches the signed output (WYSIWYG).
6. Owner and an internal admin can both sign.

---

## 1. Save model: draft autosave + explicit publish

The v1 save was one expensive action that re-created the DocuSeal template every
time (resets field positions). Autosave cannot call that. Split it:

- **Draft autosave** writes `source_html` to the database only. Debounced ~1.5s
  after typing stops, and flushed on tab switch and page unload. No DocuSeal
  call. Cheap, never loses work.
- **Publish to fields** is the deliberate action that (re)builds the DocuSeal
  template from the current draft and snapshots what was published. Triggered by
  a "Sync to fields" button and by opening the Fields tab when the draft differs
  from the last published HTML (a clear confirm: "Publish latest content to the
  field layout? This resets field positions.").

### Data model

Add one column:

```sql
alter table public.document_templates
  add column if not exists published_html text null;
```

- `source_html` = the live draft (autosaved).
- `published_html` = snapshot of the HTML last pushed to DocuSeal.
- `needsPublish = source_html !== published_html` (and `docuseal_template_id`
  is set). Drives the "unpublished changes" prompt and a status pill.

### Server actions (replace v1's `saveTemplateHtmlAction`)

- `saveTemplateDraftAction(templateId, html)` — updates `source_html` only.
  Returns `{ ok, savedAt }`. Called by autosave + tab switch.
- `publishTemplateAction(templateId)` — reads `source_html`, wraps in the shell,
  creates a DocuSeal template **passing `signer_roles` as submitters**, updates
  `docuseal_template_id`, sets `published_html = source_html`, forces
  `is_active = false`. Returns `{ ok, newDocusealId }`.

`requireAdmin()` guard on both. Keep the v1 wrap shell, expanded for the new
styles below.

---

## 2. Pinned layout (only the document scrolls)

Rebuild the template detail view as a viewport-height flex column:

- The admin top bar, the Documents/Forms/Templates row, and the
  Write/Fields/Settings tab bar are pinned (do not scroll).
- The editor region is `height: 100%` of the remaining space with the toolbar
  `flex-shrink: 0` (pinned) and a single internal `overflow-y: auto` on the
  document canvas. The Fields tab gets the same treatment for consistency.

The v1 bug is an unconstrained height chain: the admin content area grows with
the document so the whole page scrolls. Fix the chain from the `(admin)` layout
down through `PaperworkShell` and `TemplateDetail` so the detail view is bounded
to `100dvh` minus the top bar, with scrolling owned by the canvas only.

---

## 3. Comprehensive toolbar + serializer expansion

The toolbar, left to right. Each entry maps to a Plate v53 plugin and a
`valueToHtml` serializer case + DocuSeal-shell CSS + round-trip test.

**History:** Undo, Redo.

**Block type** (dropdown): Paragraph, Heading 1–6, Blockquote, Code block.

**Marks:** Bold, Italic, Underline, Strikethrough, Inline code, Superscript,
Subscript, Highlight, Text color, Clear formatting.

**Typography:** Font family (the 15 below), Font size, Font weight.

**Paragraph:** Align (left/center/right/justify), Bulleted list, Numbered list,
Checklist, Indent, Outdent, Line spacing.

**Insert:** Link, Image, Table (with on-table add/remove row + column controls),
Horizontal rule, Page break.

**Right side:** autosave status ("Saved"/"Saving…"), Preview toggle, Pages
panel toggle.

### Plate packages

Already installed: `platejs`, `@platejs/basic-nodes` (bold, italic, underline,
strikethrough, code, sub/sup, highlight, h1–h6, blockquote, horizontal rule),
`@platejs/list-classic` (bulleted, numbered, checklist), `@platejs/table`.

To add (verify exact names against the installed v53 at build, the same way v1
verified its APIs): `@platejs/basic-styles` (font family/size, color, line
height), `@platejs/indent` (indent/outdent + text align, or the dedicated align
plugin), `@platejs/link`, `@platejs/media` (images), `@platejs/code-block`.
Page break is a custom void node (no package).

### Serializer rules (the real work)

Marks like color, font family, font size become inline `<span style="…">`.
Block-level props like text align and line height become `style="…"` on the
block element. Images serialize to `<img src="…" style="…">`. Page breaks
serialize to a `<div class="page-break"></div>` that the shell and Paged.js both
honor. Every addition extends `valueToHtml`, the shell CSS, and the round-trip
test, which must stay green (a wrong type string silently drops content from a
signed document — the v1 discipline holds).

---

## 4. Fonts (15 free families, embeddable in the PDF)

Times New Roman, Arial, Georgia, and Courier New are licensed and cannot be
embedded, so the classics use their free, metric-identical twins.

**Serif:** Tinos (Times New Roman twin), Gelasio (Georgia twin), PT Serif, Lora,
Merriweather, EB Garamond, Playfair Display.

**Sans:** Arimo (Arial twin), Roboto, Open Sans, Lato, Montserrat, Inter.

**Mono:** Cousine (Courier New twin), JetBrains Mono.

Weights exposed per family (only those it ships): Thin 100, ExtraLight 200,
Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700, ExtraBold 800,
Black 900. Roboto, Lato, Montserrat, Inter, and JetBrains Mono carry the full
range including the thin weights. Italic is a toggle on any weight.

- **Loading:** lazy-load a family's CSS when first selected or previewed so the
  editor stays light; do not load all 15 upfront.
- **Embedding:** the DocuSeal shell `@import`s only the families a document
  actually uses (parsed from the serialized HTML) so the PDF render stays lean
  and the fonts are present server-side.

---

## 5. Image uploader (Supabase storage)

- **Bucket:** create a public-read `document-assets` Supabase storage bucket.
  Public read is required so the DocuSeal renderer can fetch the image when it
  builds the PDF. Admin-only write via storage policy.
- **Upload flow:** toolbar Image button opens a file picker (or drag onto the
  canvas) → upload to `document-assets/<templateId>/<uuid>.<ext>` → get the
  public URL → insert an image node. A header-logo affordance is the same flow.
- **Serializer:** image node → `<img src="…" alt="…" style="max-width:100%;…">`.
  Constrain max width to the page content width; allow a width/alignment choice.
- **Validation:** image MIME + size cap (e.g., 5 MB), strip on failure with an
  inline error.

---

## 6. Exact preview + pages panel (WYSIWYG)

The editor stays a continuous writing surface (fast, no pagination fight while
typing). Truth comes from two pinned-frame additions:

- **Pages rail (left, collapsible):** real letter-page thumbnails of the
  document, numbered, with a count ("Page 2 of 4"). Click to scroll-to. Built by
  paginating the serialized shell HTML.
- **Preview mode:** renders the exact `wrapInDocumentShell(valueToHtml(...))`
  HTML that DocuSeal receives, paginated into true 8.5 × 11 pages with
  **Paged.js** (a CSS Paged Media polyfill that flows HTML into pages with real
  page breaks). The Page break button forces breaks where wanted.

Caveat carried from the brainstorm: DocuSeal renders the final PDF server-side,
so the preview is a same-HTML/same-CSS, very close match, not a guaranteed
pixel clone of DocuSeal's internal renderer. It is dramatically closer than v1
and controllable via explicit page breaks.

Implementation note: Paged.js runs in an isolated iframe (it rewrites the DOM it
paginates), so the preview and thumbnails render in iframes fed the shell HTML,
keeping it away from the live editor DOM.

---

## 7. Owner + internal admin both sign (bug fix)

Root cause: v1's save created the DocuSeal template without passing
`signer_roles`, so the builder shows a single default party. Fix:
`publishTemplateAction` passes `submitters: signer_roles.map(name => ({ name }))`
so the builder shows every party (e.g., Owner and Proxy). The admin then drops a
Signature + Date field for each party. Add a one-line hint in the Fields header
naming the parties so switching between them is obvious, and stop encouraging
typed "Owner: ___" lines (those are real fields now).

---

## File map (high level)

**New**
- `supabase/migrations/<ts>_document_templates_published_html.sql`
- `apps/web/src/app/(admin)/admin/paperwork/templates/draft-actions.ts`
  (`saveTemplateDraftAction`, `publishTemplateAction`)
- `apps/web/.../[id]/editor/` — split the editor into focused files: `Toolbar`,
  `FontControls`, `InsertControls`, `PagesRail`, `DocumentPreview`,
  `useAutosave`, `editor-plugins.ts`, `element-components.tsx`.
- `apps/web/src/lib/storage/document-assets.ts` — upload helper.

**Modified**
- `html-serialize.ts` — color/font/size/align/line-height/link/image/page-break/
  strikethrough/code/sub/sup/highlight/blockquote/code-block/checklist cases.
- `html-actions.ts` → shell CSS expansion + dynamic font `@import`; submitters on
  publish. (Likely fold create + publish into `draft-actions.ts`.)
- `TemplateEditor.tsx` — autosave, pinned layout, preview/pages toggles.
- `SignatureTemplateDetail.tsx` / `page.tsx` — publish-on-enter-Fields prompt,
  pinned layout, parties hint.
- `document-templates-types.ts` / `document-templates.ts` — `published_html`.
- `(admin)` layout / `PaperworkShell` / `TemplateDetail.module.css` — height
  chain for the pinned frame.

**Packages:** `@platejs/basic-styles`, `@platejs/indent`, `@platejs/link`,
`@platejs/media`, `@platejs/code-block`, `pagedjs`.

---

## Risks and caveats

- **Serializer breadth.** Each toolbar feature is a serializer + shell-CSS +
  round-trip-test triple. This is the bulk of the effort and the place content
  can silently drop. Round-trip tests gate every node/mark.
- **Preview fidelity.** Paged.js is close to but not identical to DocuSeal's
  renderer. Explicit page breaks are the escape hatch.
- **Font weight load size.** Mitigated by lazy-loading and use-only embedding.
- **Image public bucket.** Public read is a deliberate tradeoff so DocuSeal can
  fetch images; documents are not secret templates, but note it.
- **Autosave vs publish drift.** `published_html` snapshot makes "unpublished
  changes" explicit and prevents accidental field-layout resets.

## Out of scope (v2)

- Real-time collaboration, comments, version history.
- True in-editor pagination (the editor stays continuous; pages live in the
  preview/rail). Revisit only if the preview proves insufficient.
- Inline Plate "signature field" nodes (DocuSeal owns field placement).
