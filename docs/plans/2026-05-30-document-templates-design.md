# Document Templates: In-App Template Management Design

**Date:** 2026-05-30
**Status:** Approved

## Problem

DocuSeal template IDs are hardcoded as `null` in `signature-config.ts`. Creating or updating templates requires a code deploy and direct access to the DocuSeal console. The system only supports 3 fixed document types. There is no path for future SaaS tenants to manage their own document templates.

## Goal

Admins can upload a PDF, let DocuSeal auto-detect signature field placements, adjust those placements in an embedded builder, and save the template — all from within Parcel. The system supports open-ended document types. Parcel ships starter (system) templates that all tenants see on day one. Tenants can create custom templates or fork and customize system templates.

## Decision

**DB-driven document catalog with embedded DocuSeal builder.** The `document_templates` Supabase table replaces the hardcoded config. An admin UI at Documents → Templates handles creation and editing via the `<docuseal-builder>` web component. The signing flow resolves templates from DB with a tenant-first, system-fallback priority chain.

---

## Section 1: Data Model

### New table: `document_templates`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `org_id` | uuid nullable FK | null = system template (Parcel-provided); set = tenant-owned |
| `document_key` | text | slug, e.g. `host_rental_agreement`. Unique per org. |
| `display_name` | text | Human-readable name shown in UI |
| `description` | text nullable | Admin-facing note |
| `docuseal_template_id` | bigint nullable | null until built in-app |
| `signer_roles` | text[] | e.g. `["Owner", "Parcel"]` |
| `requires_countersignature` | boolean | |
| `gate_step` | int nullable | Position in onboarding flow, matches existing GATE_STEP enum |
| `is_system` | boolean | true = Parcel-provided starter template |
| `is_active` | boolean | Soft-delete / disable without removing |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### Migration seeding

The migration seeds the 3 existing document types as system templates:
- `host_rental_agreement` — Host Rental Agreement
- `ach_authorization` — ACH Authorization
- `card_authorization` — Card Authorization

All three get `is_system = true`, `org_id = null`, `docuseal_template_id = null` (to be filled via the new admin UI).

### Config file changes

`signature-config.ts` retains only the two role name constants:
```ts
export const SIGNER_ROLE = "Owner";
export const COUNTERSIGNER_ROLE = "Parcel";
```

`DOCUSEAL_TEMPLATE_IDS` and `SIGNATURE_DOCUMENT_KEYS` are retired.

---

## Section 2: DocuSeal Integration

### Template creation flow (3 steps)

**Step 1 — PDF upload and auto-detection.**
Admin uploads a PDF via server action. The action posts the file to DocuSeal `POST /api/templates` (multipart). DocuSeal runs field detection and returns a template ID. The `document_templates` DB row is created immediately with that ID.

**Step 2 — Embedded builder.**
The page renders the `<docuseal-builder>` web component pointing at the new template ID. DocuSeal's auto-detected fields are shown on the PDF. The admin adjusts placements, assigns roles (Owner / Parcel), and clicks Save.

The API token is never included in the client bundle. An admin-only route handler at `/api/admin/docuseal/builder-session` returns the token, protected by existing admin middleware.

**Step 3 — Save confirmation.**
The builder fires a `save` event. The client calls a server action that marks `is_active = true` on the DB row. The template is now live.

### System template customization (fork)

When a tenant clicks "Customize" on a system template:
1. A confirmation modal explains the fork.
2. A server action copies the original PDF to DocuSeal under a new template ID.
3. A new `document_templates` row is created with the current `org_id`.
4. Phase 2 (embedded builder) opens with the forked template.

### New adapter functions (additions to `src/lib/signing/docuseal.ts`)

- `createTemplate(name: string, pdfBuffer: Buffer): Promise<{ templateId: number } | null>`
- `forkTemplate(sourceTemplateId: number, name: string): Promise<{ templateId: number } | null>`

---

## Section 3: Admin UI

**Route:** `apps/web/src/app/(admin)/admin/documents/templates/`

**Navigation:** "Templates" link added to the Documents section nav.

### Templates list page

Two sections:
- **Parcel Library** — system templates (`is_system = true`). Actions: Edit layout, Customize.
- **Custom Templates** — org-specific templates. Actions: Edit, Delete.

Each row: display name, document key slug, signer roles, status badge (Ready / Draft).

"New Template" button top-right opens the create flow.

### Create flow (two phases)

**Phase 1 — Metadata slide-over:**
- Display name (text input)
- Document key (auto-slugified from name, editable)
- Description (optional)
- Signer roles (checkboxes: Owner, Parcel)
- Requires countersignature (toggle)
- Gate step (dropdown)
- PDF upload (drag and drop zone)
- "Build Template" button → triggers Step 1 + 2 of the integration flow

**Phase 2 — Builder full-page:**
- `<docuseal-builder>` fills the content area
- Sticky header: template name + "Save Template" button
- On save: server action marks template active, redirect to list with success state

### Edit flow

Clicking Edit opens Phase 2 directly (builder for the existing template ID). An optional "Replace PDF" button at the top of Phase 2 lets the admin go back to Phase 1 to swap the file.

### Customize flow (system templates)

Confirmation modal → server action forks the template → Phase 2 opens for the fork.

---

## Section 4: Signing Flow Changes

### Template resolution in `signing.ts`

Replace `DOCUSEAL_TEMPLATE_IDS[key]` with a DB query:

```
SELECT docuseal_template_id
FROM document_templates
WHERE document_key = $key
  AND is_active = true
  AND (org_id = $workspaceOrgId OR (org_id IS NULL AND is_system = true))
ORDER BY org_id NULLS LAST   -- tenant-specific wins over system
LIMIT 1
```

Resolution priority:
1. Tenant-specific template (org_id matches workspace org)
2. System template (org_id IS NULL, is_system = true)
3. `docuseal_template_id` is null → return `status: "preparing"` (graceful degradation)
4. No row found → "not signed electronically" (same error as today)

### `isSignatureDocument()` change

Currently checks against the hardcoded `SIGNATURE_DOCUMENT_KEYS` array. Becomes a DB check: any active `document_templates` row with that key exists for this org or globally.

### Unchanged

- Webhook handler (`/api/webhooks/docuseal/route.ts`)
- Status machine (`signing.ts` state transitions)
- Portal signing UI (`DocumentsHub.tsx`, `signing-actions.ts`)

---

## Out of Scope (v1)

- Per-tenant DocuSeal accounts (shared Parcel account for now; per-org credentials added when SaaS launches)
- Template versioning / history
- Template preview for portal users before signing
- Tenant self-service onboarding (template setup wizard for new tenants)
