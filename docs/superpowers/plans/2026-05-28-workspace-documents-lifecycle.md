# Workspace Documents Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn workspace Documents into an operational document lifecycle system with clear missing/requested/ready states, send actions, document details, expiration tracking, archives, and offboarding hidden until intentionally started.

**Architecture:** Keep the workspace Documents tab as the owner-facing operational surface and reuse the global Documents Hub catalog as the source of document definitions. Add document requirement metadata, then layer UI state, actions, expiration rules, version history, and offboarding lifecycle visibility on top without disrupting the existing `/admin/documents` matrix.

**Tech Stack:** Next.js App Router, TypeScript, CSS modules, Supabase, existing BoldSign document actions, existing `signed_documents` and `property_forms` data, new Supabase migration where lifecycle/version metadata is missing.

---

## File Structure

- Modify `apps/web/src/lib/admin/documents-hub-shared.ts`
  - Owns shared document/form definitions, labels, colors, expiration rules, and visibility metadata.
- Modify `apps/web/src/lib/admin/workspace-documents.ts`
  - Fetches workspace document status, file URLs, expiration dates, renewal deadlines, and version history.
- Modify `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
  - Renders the document package grid, card states, send/request actions, details drawer entry point, and offboarding visibility.
- Modify `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`
  - Visual states, hover color behavior, ready color persistence, preview patterns, drawer styling if kept local.
- Create `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/WorkspaceDocumentDrawer.tsx`
  - Side drawer for missing, requested, ready, expiring, expired, and archived document details.
- Create `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/workspace-document-actions.ts`
  - Server actions for sending one document, sending all needed sendable documents, requesting form/upload items, replacing/updating metadata, and starting offboarding.
- Create `supabase/migrations/YYYYMMDDHHMMSS_workspace_document_lifecycle.sql`
  - Adds lifecycle metadata for expiration, renewal, archival versions, and offboarding state if existing tables cannot hold it cleanly.

---

## Phase 1: Shared Document Metadata

### Task 1: Add Lifecycle Metadata To Document Definitions

**Files:**
- Modify: `apps/web/src/lib/admin/documents-hub-shared.ts`

- [ ] Add a `DocumentLifecycleDefinition` shape:

```ts
export type DocumentLifecycleKind = "secure_doc" | "form" | "upload" | "lifecycle";

export type DocumentVisibility = "always" | "offboarding_started";

export type DocumentExpirationRule = {
  expires: boolean;
  renewalLeadDays: number | null;
  dateField: string | null;
};

export type DocumentLifecycleDefinition = {
  key: string;
  label: string;
  shortLabel: string;
  kind: DocumentLifecycleKind;
  color: string;
  visibility: DocumentVisibility;
  sendable: boolean;
  requestable: boolean;
  expiration: DocumentExpirationRule;
  description: string;
  preview: "agreement" | "bank" | "card" | "tax" | "id" | "setup" | "wifi" | "guidebook" | "permit" | "hoa" | "insurance" | "platforms" | "inspection" | "calendar" | "offboarding";
};
```

- [ ] Add a `WORKSPACE_DOCUMENT_DEFINITIONS` export that includes:
  - Host Rental Agreement
  - Card Authorization
  - ACH Authorization
  - W9 Form
  - Identity Verification
  - Paid Initial Onboarding Fee
  - Property Setup
  - Wi-Fi Information
  - Guidebook
  - STR Permit
  - HOA
  - Insurance
  - Platform Access
  - Onboarding Inspection
  - Block Dates on the Calendar
  - Offboarding

- [ ] Set expiration rules:
  - `card_authorization`: `expires: true`, `renewalLeadDays: 60`, `dateField: "card_expiration_date"`
  - `insurance_certificate`: `expires: true`, `renewalLeadDays: 60`, `dateField: "expiration_date"`
  - `str_permit`: `expires: true`, `renewalLeadDays: 60`, `dateField: "expiration_date"`
  - `identity`: `expires: true`, `renewalLeadDays: 60`, `dateField: "expiration_date"`
  - Everything else: `expires: false`

- [ ] Set offboarding visibility:

```ts
offboarding: {
  visibility: "offboarding_started",
  sendable: false,
  requestable: false,
}
```

- [ ] Run:

```bash
cd /Users/johanannunez/workspace/parcel/apps/web
pnpm exec tsc --noEmit
```

Expected: TypeScript passes.

---

## Phase 2: Card State Language And Preview Patterns

### Task 2: Replace `Pending` With `Requested`

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`

- [ ] Rename visible state labels:
  - `Needed`: not sent or requested.
  - `Requested`: sent/requested and waiting on owner.
  - `Ready`: received, signed, or submitted.
  - `Expiring`: valid but renewal deadline is approaching.
  - `Expired`: no longer valid.

- [ ] Keep internal state names if useful, but map UI text through a helper:

```ts
function getRequirementLabel(state: RequirementState): string {
  if (state === "pending") return "Requested";
  if (state === "signed") return "Ready";
  if (state === "expired") return "Expired";
  return "Needed";
}
```

- [ ] Make `Needed` pill red:

```css
.requirementNeeded {
  background: color-mix(in srgb, var(--color-error) 10%, transparent);
  color: var(--color-error);
}
```

- [ ] Keep the card muted unless hovered so the whole page does not feel alarm-heavy.

- [ ] Run:

```bash
cd /Users/johanannunez/workspace/parcel/apps/web
pnpm exec tsc --noEmit
```

Expected: TypeScript passes.

### Task 3: Make File Previews Resemble Each Document Type

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`

- [ ] Replace the generic `FilePreview` body with preview variants:
  - Agreement: paragraph lines and signature line.
  - Bank/ACH: bank rows and masked account dots.
  - Card authorization: card rectangle and expiration row.
  - W9: tax boxes.
  - ID: photo rectangle and ID lines.
  - Setup: form rows.
  - Wi-Fi: network and password rows.
  - Guidebook: list rows.
  - Permit: certificate layout.
  - HOA: rule/list rows.
  - Insurance: policy rows and expiry line.
  - Platforms: connected account rows.
  - Inspection: checklist rows.
  - Calendar: date blocks.

- [ ] Use the `preview` field from `WORKSPACE_DOCUMENT_DEFINITIONS`.

- [ ] Verify no text overlaps at desktop and mobile widths.

---

## Phase 3: Send And Request Actions

### Task 4: Add Per-Card Actions

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`
- Create: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/workspace-document-actions.ts`

- [ ] Add hover actions to document cards:
  - SecureDocs: `Send`
  - Forms/uploads: `Request`
  - Ready documents: `View`
  - Expiring documents: `Request renewal`

- [ ] Create server action stubs that call existing document sending behavior where available:

```ts
"use server";

export async function sendWorkspaceDocumentAction(input: {
  profileId: string;
  email: string;
  fullName: string;
  documentKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: false, error: "Document sending is not wired for this document yet." };
}
```

- [ ] Replace stubs for existing BoldSign SecureDocs with the same logic used by `/admin/documents`.

- [ ] Do not add `alert`, `confirm`, or native prompt behavior.

### Task 5: Add `Send Needed Documents` Bulk Flow

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/workspace-document-actions.ts`

- [ ] Add a top action: `Send needed documents`.

- [ ] Clicking it opens a modal with only actionable missing documents.

- [ ] Default selected:
  - Host Rental Agreement
  - ACH Authorization
  - Card Authorization
  - Any other sendable SecureDoc.

- [ ] Default unselected or request-only:
  - Uploads and property forms unless request messaging is wired.

- [ ] Submit action sends selected documents and refreshes the workspace path.

---

## Phase 4: Details Drawer And Viewer

### Task 6: Add Workspace Document Details Drawer

**Files:**
- Create: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/WorkspaceDocumentDrawer.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.module.css`

- [ ] Clicking any document card opens a right-side drawer.

- [ ] For `Needed`, show:
  - What this document is.
  - Why we need it.
  - Who completes it.
  - Primary action: `Send` or `Request`.

- [ ] For `Requested`, show:
  - Sent/requested date.
  - Recipient.
  - Primary action: `Send reminder`.

- [ ] For `Ready`, show:
  - Received/signed date.
  - Expiration date if applicable.
  - Renewal deadline if applicable.
  - Actions: `View document`, `Download`, `Replace`, `Request updated version`.

- [ ] For forms, render submitted answers directly in the drawer.

- [ ] For signed PDFs or uploaded files, open the existing secure URL in a new tab for now.

---

## Phase 5: Expiration And Archive

### Task 7: Add Lifecycle Metadata Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_workspace_document_lifecycle.sql`

- [ ] Add a table for workspace document versions:

```sql
create table if not exists public.workspace_document_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  document_key text not null,
  source_table text,
  source_id uuid,
  status text not null default 'ready',
  file_url text,
  data jsonb not null default '{}'::jsonb,
  effective_at timestamptz not null default now(),
  expires_at date,
  renew_by date,
  replaced_at timestamptz,
  replaced_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] Add indexes:

```sql
create index if not exists workspace_document_versions_workspace_key_idx
  on public.workspace_document_versions(workspace_id, document_key);

create index if not exists workspace_document_versions_expiration_idx
  on public.workspace_document_versions(expires_at, renew_by)
  where expires_at is not null;
```

- [ ] Add RLS or service-role-only access consistent with existing admin tables.

### Task 8: Fetch Current And Archived Versions

**Files:**
- Modify: `apps/web/src/lib/admin/workspace-documents.ts`

- [ ] Extend `WorkspaceDocument` with:

```ts
export type WorkspaceDocumentVersion = {
  id: string;
  documentKey: string;
  status: string;
  fileUrl: string | null;
  data: Record<string, string | number | boolean | null>;
  effectiveAt: string;
  expiresAt: string | null;
  renewBy: string | null;
  replacedAt: string | null;
};
```

- [ ] Fetch versions by workspace/contact/profile.

- [ ] Current version = newest version where `replaced_at is null`.

- [ ] Archive = all replaced versions ordered by `effective_at desc`.

### Task 9: Display Expiration And Archive In Drawer

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/WorkspaceDocumentDrawer.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`

- [ ] Compute state:
  - `Expiring` when today is on or after `renew_by` and before `expires_at`.
  - `Expired` when today is after `expires_at`.

- [ ] Show on cards:
  - `Expires Aug 2026`
  - `Renew by Jun 2026`

- [ ] Show archive in drawer:
  - Version label
  - Effective date
  - Expired/replaced date
  - View/download action

---

## Phase 6: Offboarding Lifecycle

### Task 10: Hide Offboarding Until Started

**Files:**
- Modify: `apps/web/src/lib/admin/documents-hub-shared.ts`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`

- [ ] Do not render Offboarding unless workspace lifecycle indicates offboarding has started.

- [ ] If lifecycle status is not available yet, hide it by default.

- [ ] Do not count Offboarding in `Needed` totals until it is visible.

### Task 11: Add `Start Offboarding` Entry Point

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/workspace-document-actions.ts`

- [ ] Add a subtle secondary action, not in the main document grid:
  - `Start offboarding`

- [ ] Open a confirmation modal explaining:
  - This reveals the offboarding checklist.
  - It does not notify the owner by itself.
  - It changes the workspace lifecycle section.

- [ ] After confirmation, show the Offboarding section with:
  - Final payout
  - Access removal
  - Listing transfer
  - Guest communication
  - Final receipts
  - Deposits
  - Platform permissions
  - Owner handoff
  - Archive export

---

## Phase 7: Verification

### Task 12: Full Verification Pass

**Files:**
- Verify changed files above.

- [ ] Run:

```bash
cd /Users/johanannunez/workspace/parcel/apps/web
pnpm exec tsc --noEmit
```

Expected: passes.

- [ ] Run:

```bash
cd /Users/johanannunez/workspace/parcel
git diff --check
```

Expected: no whitespace errors.

- [ ] Browser verify:

```text
http://localhost:4000/admin/workspaces/face0001-cafe-4000-8000-bb0000000001?tab=documents
http://localhost:4000/admin/documents
```

- [ ] Confirm:
  - Needed is red text but card remains calm.
  - Missing items show color on hover.
  - Ready items keep persistent color.
  - Requested replaces Pending in visible UI.
  - Cards open a side drawer.
  - Ready documents can be viewed.
  - Expiring documents show renew-by information.
  - Archive shows old versions.
  - Offboarding is hidden until the process begins.
  - `/admin/documents` still renders.

---

## Recommended Execution Order

1. Phase 1 and 2: Safe UI clarity.
2. Phase 3: Send/request actions.
3. Phase 4: Details drawer and viewer.
4. Phase 5: Expiration and archive, including migration.
5. Phase 6: Offboarding lifecycle.
6. Phase 7: Verification.

## Open Product Decisions

- Whether `Requested` should be the visible label everywhere, or only in workspace Documents.
- Whether property forms should be emailed as requests immediately, or simply opened in portal.
- Whether archive versions should be admin-only or visible to owners.
- Whether offboarding should live in Documents only after started, or have a separate workspace lifecycle page later.
