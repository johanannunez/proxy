# Plate.js Document Editor — Design

## Overview

Add a Plate.js-powered "Write" tab to the signature template detail page
(`/admin/paperwork/templates/[id]`). Admins author document content in Proxy
(no PDF upload required); DocuSeal remains the signing engine. The existing
"Fields" tab (DocuSeal embedded builder) handles all signature/initials/text
field placement, including mid-document positions.

## Scope

- Admin-only: platform super-admins and org operators who purchased the platform.
- HTML-authored templates only. PDF-upload templates are untouched.
- No workspace co-owner access to the editor.

---

## Architecture

### Tab structure for signature templates

Current tabs: `fields | settings`
New tabs for HTML templates: `write | fields | settings`

The "Write" tab appears when `source_html IS NOT NULL` on the
`document_templates` row, OR when a template is being created as an HTML
document (before first save). PDF templates keep the existing `fields | settings`
layout unchanged.

### Save flow

1. Admin edits content in Plate editor.
2. Clicks "Save Document."
3. Plate serializes its AST to HTML via `serializeHtml`.
4. Server action checks `docuseal_template_id` on the template row:
   - **Null (first save):** `POST /templates/html` via `createTemplateFromHtml` →
     stores the returned `templateId` in `document_templates.docuseal_template_id`
     and saves the HTML to `source_html`.
   - **Exists (re-save):** Create a new DocuSeal template from updated HTML,
     store the new `docuseal_template_id`, update `source_html`. Show warning:
     "Field positions may have shifted. Review the Fields tab after saving."
5. Fields tab becomes active (or re-active) after a successful save.

### Why re-create on update

DocuSeal's PUT /templates/:id supports renaming but does not guarantee
in-place HTML document replacement. Creating a fresh template from the updated
HTML is the safe path. The field layout is then re-placed via the DocuSeal
builder. Admins are warned before saving that this will happen.

---

## Data Model

### New column: `document_templates.source_html`

```sql
alter table public.document_templates
  add column if not exists source_html text null;
```

- `null` = PDF-based template (existing behavior).
- Non-null = HTML template, editable in Plate.
- No `template_type` enum needed; the column presence is the discriminant.

No new RLS policies required. `document_templates` inherits existing org-admin
policies.

---

## Plate.js Editor

### Packages

```
@udecode/plate           # unified plate package (core + plugin registry)
@udecode/plate-html      # serializeHtml + deserializeHtml (round-trip)
```

Individual plugins loaded from `@udecode/plate`:
`ParagraphPlugin`, `HeadingPlugin`, `BoldPlugin`, `ItalicPlugin`,
`UnderlinePlugin`, `ListPlugin`, `TablePlugin`

### Canvas

- Max width: 780px, centered, white background.
- Padding: 56px top/bottom, 72px left/right — matches the existing
  `buildAuthorityAddendumHtml` body style so templates look consistent.
- Letter-proportion visual hint (8.5" × 11" reference frame).
- Font stack: Georgia serif body, Arial sans headings — same as the addendum
  HTML so generated output is consistent.

### Toolbar

Heading levels (H1, H2, H3), paragraph, bold, italic, underline, numbered
list, bulleted list, insert table. No comment blocks, no code blocks, no
image upload.

### Serialization

`serializeHtml(editor)` from `@udecode/plate-html` produces a `<div>` fragment.
The server action wraps it in the same `<!DOCTYPE html>` shell used by
`buildAuthorityAddendumHtml` (shared CSS, fonts, body styles) before sending
to DocuSeal.

`deserializeHtml(editor, { element: sourceHtml })` re-hydrates the editor when
an admin opens an existing HTML template. The `source_html` column is the
round-trip source of truth.

---

## Files

### New

| File | Purpose |
|------|---------|
| `supabase/migrations/20260616000000_document_templates_source_html.sql` | Adds `source_html text null` column |
| `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/TemplateEditor.tsx` | Plate editor client component |
| `apps/web/src/app/(admin)/admin/paperwork/templates/html-actions.ts` | `saveTemplateHtmlAction` server action |

### Modified

| File | Change |
|------|--------|
| `apps/web/src/lib/admin/document-templates-types.ts` | Add `source_html: string \| null` to `DocumentTemplate`; add `source_html` to `UpdateDocumentTemplateInput` |
| `apps/web/src/lib/admin/document-templates.ts` | Include `source_html` in `getDocumentTemplate` select; update write helper |
| `apps/web/src/lib/signing/docuseal.ts` | Add `updateTemplateFromHtml(templateId, name, html)` — creates new template, returns new ID |
| `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/SignatureTemplateDetail.tsx` | Add `"write"` to `TabKey`; render `TemplateEditor` on write tab; show three tabs only when `source_html != null` |
| `apps/web/src/app/(admin)/admin/paperwork/templates/[id]/page.tsx` | Pass `source_html` in template prop (already included via updated type) |
| `apps/web/src/app/(admin)/admin/paperwork/templates/CreateTemplateModal.tsx` | Add "Write HTML document" option alongside "Upload PDF" |
| `apps/web/src/app/(admin)/admin/paperwork/templates/template-actions.ts` | Handle `source_html` in `updateTemplateMeta` |

---

## CreateTemplateModal changes

The modal currently offers "Upload PDF" as the only creation path. A second
option, "Write HTML document," is added. Selecting it:
1. Creates the `document_templates` row with `source_html = ''` (empty string,
   not null, so the write tab appears immediately).
2. Sets `docuseal_template_id = null` (no DocuSeal template yet).
3. Redirects to the new template's detail page, landing on the Write tab.

The write tab shows an empty Plate canvas. The Fields tab is disabled with a
tooltip: "Save document content first."

---

## UX Details

- "Save Document" button lives in the tab bar header (same position as the
  existing "Done" button on the Fields tab) — visible only on the Write tab.
- Unsaved changes indicator: a subtle dot on the tab label and a browser
  `beforeunload` warning if the user tries to navigate away with unsaved Plate
  content.
- After a successful re-save that changes the DocuSeal template ID, the Fields
  tab reloads the DocuSeal builder with the new template ID automatically.
- Warning banner shown at the top of the Write tab when `docuseal_template_id`
  is already set: "Saving will reset field positions. Re-place fields in the
  Fields tab after saving."

---

## What Is NOT in scope

- Real-time collaboration.
- Version history / undo across sessions.
- Image embedding inside the document.
- Inline Plate "field" nodes (DocuSeal builder owns field placement).
- PDF export from the editor (DocuSeal renders the document for the signer).
