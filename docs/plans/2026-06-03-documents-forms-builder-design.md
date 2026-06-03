# Documents & Forms Builder: Design

**Date:** 2026-06-03
**Status:** Approved

---

## Problem

Proxy manages documents (rental agreements, ACH authorizations, W-9s) as fixed PDF e-sign templates. Clients (property managers) have no way to create their own forms: no custom intake questionnaires, inspection checklists, or surveys. The platform needs a self-serve form layer that matches the premium quality of the rest of the product.

---

## Two Subsystems Under One Surface

Both live under `/admin/documents/` and are surfaced as a unified hub with two tabs: **Templates** (PDF e-sign) and **Forms** (interactive web forms).

### Subsystem 1: E-Sign Templates (PDF)

Already ~90% built. The `document_templates` table, `DocuSealBuilderView`, `CreateTemplateSlideOver`, and builder session API are done.

Upgrades to add:

- Template card thumbnails with completion rate stats (X sent, X% completed)
- "Proxy Library" read-only section showing system templates
- "Your Templates" section for org-specific custom templates
- One-click fork: clone a system template into the org's custom copy
- Pre-send preview: see what the filled document looks like before dispatching
- Expose the builder to workspace users (not only admins), gated by org plan

### Subsystem 2: Web Form Builder (Custom, block-based)

New system. Block-based canvas editor inspired by Notion/Linear. AI generation as the starting point for clients who do not know where to begin.

---

## Web Form Builder: UI Layout

### Admin Hub (`/admin/documents/forms/`)

List of all forms for this org. Each card shows:
- Form name and description
- Status badge (Draft / Published)
- Response count and last response date
- Access type badge (Public or Private)
- Edit, Preview, View Responses, and Share actions

"New Form" button at the top right opens a choice: **Generate with AI** or **Start blank**.

### Form Builder (`/admin/documents/forms/[id]/edit`)

Full-page editor. No left sidebar, no right properties panel.

**Top bar:**
- Back arrow + form name (editable inline)
- "Generate with AI" button (opens slide-over)
- Preview button (opens fill view in a new tab)
- Publish / Unpublish toggle
- Share button (copies public URL or workspace link)

**Canvas:**
- Every field is a block. Grip handle on the left to reorder via drag.
- Click a block to select it. Inline property popover appears with: label, required toggle, placeholder, validation rules.
- `+` button appears below each block to add a new field at that position.
- Type `/` to open a command palette listing all field types (searchable).
- Drag-and-drop reorder via dnd-kit.

**"Generate with AI" slide-over:**
- Text area: "Describe the form you need"
- Optional context: Property type, intended audience (owner/guest/inspector)
- Generate button → calls Claude API → returns a field schema array
- Shows a live preview of the generated fields in the slide-over
- Confirm or Regenerate buttons

### Form Fill Page

**Public forms:** `/f/[slug]`
**Private (workspace) forms:** `/workspace/forms/[id]`

Clean, focused, no navigation chrome. Org logo and name at the top. Progress indicator for multi-field forms. Mobile-first layout. Submit button at the bottom.

---

## Field Types (MVP)

| Type | Input | Notes |
|------|-------|-------|
| Short text | `<input type="text">` | |
| Long text | `<textarea>` | |
| Number | `<input type="number">` | Min/max validation |
| Email | `<input type="email">` | Format validation |
| Phone | `<input type="tel">` | Format validation |
| Date | DatePickerInput component | Use existing component |
| Single choice | Radio buttons | Options list |
| Multiple choice | Checkboxes | Options list |
| Dropdown | CustomSelect component | Use existing component |
| File upload | File input | Store in Supabase Storage |
| Rating / Scale | 1-5 or 1-10 star/number | Configurable range |
| Canvas signature | HTML5 canvas | Saved as base64 PNG or Supabase Storage blob |
| Section header | Non-input | Heading text block |
| Description | Non-input | Instructional text block |
| Divider | Non-input | Visual separator |

---

## Data Model

### `forms` table

```sql
create table forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade not null,
  name text not null,
  description text,
  schema jsonb not null default '{"version":1,"fields":[],"settings":{}}',
  is_public boolean not null default false,
  slug text unique,                -- for public URLs: /f/[slug]
  is_active boolean not null default false,  -- false = draft
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `form_responses` table

```sql
create table form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references forms(id) on delete cascade not null,
  respondent_profile_id uuid references profiles(id),  -- null for public submissions
  property_id uuid references properties(id),          -- optional: link to a property
  data jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  metadata jsonb default '{}'                          -- ip, user_agent, referrer
);
```

### Form Schema JSONB Shape

```json
{
  "version": 1,
  "fields": [
    {
      "id": "field_abc123",
      "type": "short_text",
      "label": "Guest Full Name",
      "placeholder": "Enter full name",
      "required": true,
      "validation": {}
    },
    {
      "id": "field_def456",
      "type": "single_choice",
      "label": "Property condition on arrival",
      "required": true,
      "options": ["Excellent", "Good", "Needs attention", "Poor"]
    }
  ],
  "settings": {
    "submitButtonText": "Submit",
    "successMessage": "Thank you. Your response has been recorded.",
    "notifyEmail": null
  }
}
```

---

## Key File Paths

### New files to create

| Purpose | Path |
|---------|------|
| Forms list page | `apps/web/src/app/(admin)/admin/documents/forms/page.tsx` |
| Forms hub component | `apps/web/src/app/(admin)/admin/documents/forms/FormsHub.tsx` |
| Form builder page | `apps/web/src/app/(admin)/admin/documents/forms/[id]/edit/page.tsx` |
| Builder canvas | `apps/web/src/app/(admin)/admin/documents/forms/[id]/edit/FormBuilderCanvas.tsx` |
| Field block components | `apps/web/src/app/(admin)/admin/documents/forms/[id]/edit/fields/` |
| AI generation slide-over | `apps/web/src/app/(admin)/admin/documents/forms/[id]/edit/AiGenerateSlideOver.tsx` |
| Form server actions | `apps/web/src/app/(admin)/admin/documents/forms/form-actions.ts` |
| Form DB helpers | `apps/web/src/lib/admin/forms.ts` |
| Form types | `apps/web/src/lib/admin/forms-types.ts` |
| Public form fill page | `apps/web/src/app/f/[slug]/page.tsx` |
| Workspace form fill page | `apps/web/src/app/(workspace)/workspace/forms/[id]/page.tsx` |
| Form renderer component | `apps/web/src/components/forms/FormRenderer.tsx` |
| Field renderer components | `apps/web/src/components/forms/fields/` |
| AI generation API route | `apps/web/src/app/api/admin/forms/generate/route.ts` |
| Supabase migration | `supabase/migrations/20260603000000_create_forms.sql` |

### Existing files to modify

| Purpose | Path | Change |
|---------|------|--------|
| Documents nav | Admin chrome navigation | Add "Forms" link under Documents |
| Documents hub | Upgrade to tabbed Templates + Forms view | |
| Templates hub | Add thumbnail, stats, fork button | |

---

## AI Generation Flow

1. User opens "Generate with AI" slide-over
2. Types form description + optional context
3. POST to `/api/admin/forms/generate` with the description
4. Route calls Claude API (claude-sonnet-4-6) with a system prompt that instructs it to return a JSON array of field objects matching the schema above
5. Response streamed back and parsed
6. Slide-over shows a live preview of generated fields
7. User confirms → fields written to the form's `schema.fields` in the builder canvas
8. User can then edit, reorder, add, or delete fields in the canvas

---

## Access Control

- Admin users: full builder access for all orgs
- Workspace users: access to their org's published forms only (fill, not build)
- Public forms: no authentication required at `/f/[slug]`
- Private forms: require workspace session at `/workspace/forms/[id]`
- RLS: `forms.org_id` scoped per org; `form_responses` readable by org admins only

---

## Build Sequence (phases)

1. Database migrations and types
2. Form DB helpers (`forms.ts`)
3. Form server actions (`form-actions.ts`)
4. AI generation API route
5. Form builder canvas (core drag-and-drop, no AI yet)
6. Field block components (15 types)
7. AI GenerateSlideOver + wire to API
8. Form renderer component (shared between admin preview and fill pages)
9. Public fill page (`/f/[slug]`)
10. Workspace fill page (`/workspace/forms/[id]`)
11. Responses list view in admin
12. Documents hub tabs upgrade (Templates + Forms)
13. Templates hub upgrades (thumbnail, stats, fork)
