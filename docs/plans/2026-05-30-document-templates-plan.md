# Document Templates In-App Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded DocuSeal template IDs in `signature-config.ts` with a `document_templates` Supabase table; build an admin UI at Documents → Templates where admins upload a PDF, let DocuSeal auto-detect field placements, adjust them in an embedded builder, and publish the template — all without touching code or the DocuSeal console.

**Architecture:** A `document_templates` Supabase table holds all document types (system-provided by Parcel and future tenant-specific) with a nullable `org_id` column seeded for multi-tenancy. The signing flow queries this table with a tenant-first / system-fallback priority chain instead of the static config. The `<docuseal-builder>` web component (CDN-loaded) handles field placement in Phase 2 of the create flow; the DocuSeal API token is served through an admin-protected route handler, never baked into client bundles.

**Tech Stack:** Next.js 16 App Router, Supabase (apply migrations via MCP, project `pwoxwpryummqeqsxdgyc`), TypeScript strict, Tailwind v4 with CSS Modules, DocuSeal Cloud API, `<docuseal-builder>` web component from `https://cdn.docuseal.com/js/builder.js`.

**Design doc:** `docs/plans/2026-05-30-document-templates-design.md`

---

## File Map

### New files
| Path | Purpose |
|---|---|
| `supabase/migrations/20260530180000_document_templates.sql` | Table DDL, RLS, seed 3 system templates |
| `apps/web/src/lib/admin/document-templates-types.ts` | `DocumentTemplate` + input types |
| `apps/web/src/lib/admin/document-templates.ts` | DB query helpers (list, resolve, create, update) |
| `apps/web/src/app/api/admin/docuseal/builder-session/route.ts` | Admin-only route returning DocuSeal token + host |
| `apps/web/src/app/(admin)/admin/documents/templates/template-actions.ts` | Server actions (upload, activate, fork, deactivate) |
| `apps/web/src/app/(admin)/admin/documents/templates/DocuSealBuilderView.tsx` | Client component: Phase 2 embedded builder |
| `apps/web/src/app/(admin)/admin/documents/templates/DocuSealBuilderView.module.css` | Styles |
| `apps/web/src/app/(admin)/admin/documents/templates/CreateTemplateSlideOver.tsx` | Client component: Phase 1 metadata + PDF upload |
| `apps/web/src/app/(admin)/admin/documents/templates/CreateTemplateSlideOver.module.css` | Styles |
| `apps/web/src/app/(admin)/admin/documents/templates/TemplatesHub.tsx` | Client component: list + phase orchestration |
| `apps/web/src/app/(admin)/admin/documents/templates/TemplatesHub.module.css` | Styles |
| `apps/web/src/app/(admin)/admin/documents/templates/page.tsx` | Server-rendered route entry |
| `apps/web/src/app/(admin)/admin/documents/templates/page.module.css` | Minimal page wrapper styles |

### Modified files
| Path | Change |
|---|---|
| `apps/web/src/lib/signing/docuseal.ts` | Add `createTemplate()` and `cloneTemplate()` |
| `apps/web/src/lib/signing/signature-config.ts` | Remove `DOCUSEAL_TEMPLATE_IDS`, `SIGNATURE_DOCUMENT_KEYS`, `isSignatureDocument`; keep role constants |
| `apps/web/src/lib/documents/signing.ts` | Replace static lookup with `resolveTemplateId()` and `isSignatureDocumentKey()` |
| Admin nav component (find in Step 1 of Task 12) | Add "Templates" link under Documents |

---

## Task 1: Supabase migration — document_templates table

**Files:**
- Create: `supabase/migrations/20260530180000_document_templates.sql`

- [ ] **Step 1: Write the migration SQL**

Create the file at `supabase/migrations/20260530180000_document_templates.sql` (at the **monorepo root**, not `apps/web/supabase/`):

```sql
-- Document template catalog. Replaces DOCUSEAL_TEMPLATE_IDS in signature-config.ts.
-- org_id nullable: NULL = system template (Parcel-provided, all tenants).
--                  set  = tenant-owned (future; no orgs table yet, FK added later).

create table if not exists public.document_templates (
  id                        uuid         primary key default gen_random_uuid(),
  org_id                    uuid,
  document_key              text         not null,
  display_name              text         not null,
  description               text,
  docuseal_template_id      bigint,
  signer_roles              text[]       not null default '{"Owner"}',
  requires_countersignature boolean      not null default true,
  gate_step                 int,
  is_system                 boolean      not null default false,
  is_active                 boolean      not null default true,
  created_at                timestamptz  not null default now(),
  updated_at                timestamptz  not null default now()
);

-- System templates: one per document_key globally (org_id IS NULL).
create unique index document_templates_system_key_unique
  on public.document_templates (document_key)
  where org_id is null;

-- Tenant templates: one per (org_id, document_key).
create unique index document_templates_tenant_key_unique
  on public.document_templates (org_id, document_key)
  where org_id is not null;

alter table public.document_templates enable row level security;

create policy "Authenticated users can read document templates"
  on public.document_templates for select
  using (auth.uid() is not null);

create policy "Service role can mutate document templates"
  on public.document_templates for all
  using (auth.role() = 'service_role');

create or replace function public.set_document_templates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger document_templates_updated_at
  before update on public.document_templates
  for each row execute function public.set_document_templates_updated_at();

-- gate_step values match GATE_STEP in lifecycle.ts: 1=agreement, 2=payment, 3=banking, 4=rest.
insert into public.document_templates
  (document_key, display_name, description, signer_roles, requires_countersignature, gate_step, is_system, is_active)
values
  ('host_rental_agreement',
   'Host Rental Agreement',
   'Property management agreement between the owner and Parcel.',
   '{"Owner","Parcel"}', true, 1, true, true),
  ('ach_authorization',
   'ACH Authorization',
   'Bank account direct debit authorization for disbursements.',
   '{"Owner","Parcel"}', true, 3, true, true),
  ('card_authorization',
   'Card Authorization',
   'Credit card on file authorization for maintenance and incidentals.',
   '{"Owner","Parcel"}', true, 3, true, true)
on conflict do nothing;
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the Supabase MCP tool `apply_migration`:
- Project ID: `pwoxwpryummqeqsxdgyc`
- Migration name: `document_templates`
- SQL: contents of the file above

Verify the tool reports success with no errors.

- [ ] **Step 3: Confirm seed data**

Use Supabase MCP `execute_sql`:
```sql
select document_key, display_name, is_system, is_active, gate_step
from public.document_templates
order by gate_step;
```
Expected: 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260530180000_document_templates.sql
git commit -m "feat: add document_templates table with system template seed"
```

---

## Task 2: TypeScript types

**Files:**
- Create: `apps/web/src/lib/admin/document-templates-types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// apps/web/src/lib/admin/document-templates-types.ts

export type DocumentTemplate = {
  id: string;
  org_id: string | null;
  document_key: string;
  display_name: string;
  description: string | null;
  docuseal_template_id: number | null;
  signer_roles: string[];
  requires_countersignature: boolean;
  gate_step: number | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateDocumentTemplateInput = {
  org_id?: string;
  document_key: string;
  display_name: string;
  description?: string;
  docuseal_template_id?: number;
  signer_roles: string[];
  requires_countersignature: boolean;
  gate_step?: number;
};

export type UpdateDocumentTemplateInput = Partial<Pick<
  DocumentTemplate,
  | "display_name"
  | "description"
  | "docuseal_template_id"
  | "signer_roles"
  | "requires_countersignature"
  | "gate_step"
  | "is_active"
>>;
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/admin/document-templates-types.ts
git commit -m "feat: add DocumentTemplate TypeScript types"
```

---

## Task 3: DocuSeal adapter additions

**Files:**
- Modify: `apps/web/src/lib/signing/docuseal.ts`

- [ ] **Step 1: Add `createTemplate` and `cloneTemplate` to the end of `docuseal.ts`**

Append after the existing `getSubmitterEmbedUrl` export:

```typescript
export type CreateTemplateResult = {
  templateId: number;
  name: string;
} | null;

/**
 * Upload a PDF to DocuSeal and create a new template from it.
 * DocuSeal runs field auto-detection on the uploaded PDF.
 */
export async function createTemplate(
  name: string,
  pdfBuffer: Buffer,
  fileName: string,
): Promise<CreateTemplateResult> {
  if (!isDocuSealConfigured()) return null;

  const formData = new FormData();
  formData.append("name", name);
  formData.append(
    "documents",
    new Blob([pdfBuffer], { type: "application/pdf" }),
    fileName,
  );

  const res = await fetch(`${baseUrl()}/templates`, {
    method: "POST",
    headers: { "X-Auth-Token": token() as string },
    body: formData,
  });

  if (!res.ok) {
    console.error("[docuseal] createTemplate failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { id: number; name: string };
  return { templateId: data.id, name: data.name };
}

/**
 * Clone an existing DocuSeal template (used for the system-template fork flow).
 */
export async function cloneTemplate(
  sourceTemplateId: number,
  newName: string,
): Promise<CreateTemplateResult> {
  if (!isDocuSealConfigured()) return null;

  const res = await fetch(`${baseUrl()}/templates/${sourceTemplateId}/clone`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName }),
  });

  if (!res.ok) {
    console.error("[docuseal] cloneTemplate failed:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { id: number; name: string };
  return { templateId: data.id, name: data.name };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/signing/docuseal.ts
git commit -m "feat: add createTemplate and cloneTemplate to DocuSeal adapter"
```

---

## Task 4: Admin builder-session route

**Files:**
- Create: `apps/web/src/app/api/admin/docuseal/builder-session/route.ts`

This route hands the DocuSeal API token to the `<docuseal-builder>` client component. It uses the same `profiles.role === "admin"` check established in `document-actions.ts`.

- [ ] **Step 1: Create the route**

```typescript
// apps/web/src/app/api/admin/docuseal/builder-session/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if ((profile as { role: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const apiToken = process.env.DOCUSEAL_API_TOKEN;
  if (!apiToken) {
    return NextResponse.json({ error: "DocuSeal not configured." }, { status: 503 });
  }

  const host = process.env.DOCUSEAL_APP_URL ?? "https://docuseal.com";
  return NextResponse.json({ token: apiToken, host });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/admin/docuseal/builder-session/route.ts
git commit -m "feat: add admin DocuSeal builder-session route"
```

---

## Task 5: DB query helpers

**Files:**
- Create: `apps/web/src/lib/admin/document-templates.ts`

- [ ] **Step 1: Write the helpers**

```typescript
// apps/web/src/lib/admin/document-templates.ts
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  DocumentTemplate,
  CreateDocumentTemplateInput,
  UpdateDocumentTemplateInput,
} from "./document-templates-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
function db(): DB {
  return createServiceClient() as DB;
}

/**
 * List all active templates visible to an org: system templates + org-specific ones.
 * For v1 (no orgs table), orgId is unused — all templates are system-level.
 */
export async function listDocumentTemplates(orgId?: string): Promise<DocumentTemplate[]> {
  let query = db()
    .from("document_templates")
    .select("*")
    .eq("is_active", true)
    .order("is_system", { ascending: false })
    .order("gate_step", { ascending: true, nullsFirst: false })
    .order("display_name");

  if (orgId) {
    query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    query = query.is("org_id", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[document-templates] list:", error.message);
    return [];
  }
  return (data ?? []) as DocumentTemplate[];
}

/**
 * Resolve the DocuSeal template ID for a document key.
 * Tenant-specific template wins over system template.
 */
export async function resolveTemplateId(
  documentKey: string,
  orgId?: string,
): Promise<number | null> {
  let query = db()
    .from("document_templates")
    .select("docuseal_template_id, org_id")
    .eq("document_key", documentKey)
    .eq("is_active", true);

  if (orgId) {
    query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    query = query.is("org_id", null);
  }

  // Prefer tenant row (org_id not null) over system row.
  query = query.order("org_id", { ascending: false, nullsFirst: false }).limit(1);

  const { data } = await query.maybeSingle();
  const row = data as { docuseal_template_id: number | null } | null;
  return row?.docuseal_template_id ?? null;
}

/**
 * Returns true if any active template exists for this document key.
 * Used to decide whether a document is an e-signature document.
 */
export async function isSignatureDocumentKey(
  documentKey: string,
  orgId?: string,
): Promise<boolean> {
  let query = db()
    .from("document_templates")
    .select("id")
    .eq("document_key", documentKey)
    .eq("is_active", true)
    .limit(1);

  if (orgId) {
    query = query.or(`org_id.is.null,org_id.eq.${orgId}`);
  } else {
    query = query.is("org_id", null);
  }

  const { data } = await query.maybeSingle();
  return data !== null;
}

export async function getDocumentTemplate(id: string): Promise<DocumentTemplate | null> {
  const { data } = await db()
    .from("document_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as DocumentTemplate | null) ?? null;
}

export async function createDocumentTemplateRecord(
  input: CreateDocumentTemplateInput,
): Promise<DocumentTemplate | null> {
  const { data, error } = await db()
    .from("document_templates")
    .insert({
      org_id: input.org_id ?? null,
      document_key: input.document_key,
      display_name: input.display_name,
      description: input.description ?? null,
      docuseal_template_id: input.docuseal_template_id ?? null,
      signer_roles: input.signer_roles,
      requires_countersignature: input.requires_countersignature,
      gate_step: input.gate_step ?? null,
      is_system: false,
      is_active: false, // activated after builder save in Phase 2
    })
    .select("*")
    .single();
  if (error) {
    console.error("[document-templates] create:", error.message);
    return null;
  }
  return data as DocumentTemplate;
}

export async function updateDocumentTemplateRecord(
  id: string,
  input: UpdateDocumentTemplateInput,
): Promise<boolean> {
  const { error } = await db().from("document_templates").update(input).eq("id", id);
  if (error) {
    console.error("[document-templates] update:", error.message);
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/admin/document-templates.ts apps/web/src/lib/admin/document-templates-types.ts
git commit -m "feat: add document-templates DB query helpers"
```

---

## Task 6: Server actions

**Files:**
- Create: `apps/web/src/app/(admin)/admin/documents/templates/template-actions.ts`

- [ ] **Step 1: Write the server actions**

```typescript
// apps/web/src/app/(admin)/admin/documents/templates/template-actions.ts
"use server";

import { createTemplate, cloneTemplate } from "@/lib/signing/docuseal";
import {
  createDocumentTemplateRecord,
  updateDocumentTemplateRecord,
  getDocumentTemplate,
} from "@/lib/admin/document-templates";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";

export type TemplateActionResult =
  | { ok: true; template: DocumentTemplate }
  | { ok: false; error: string };

/**
 * Phase 1: upload PDF + metadata → create DocuSeal template (auto-detects fields)
 * → persist DB record with is_active=false. Phase 2 activates it after builder save.
 */
export async function uploadAndCreateTemplate(
  formData: FormData,
): Promise<TemplateActionResult> {
  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const documentKey = (formData.get("document_key") as string | null)?.trim() ?? "";
  const description = (formData.get("description") as string | null)?.trim() || undefined;
  const signerRolesRaw = formData.get("signer_roles") as string | null;
  const requiresCounter = formData.get("requires_countersignature") === "true";
  const gateStepRaw = formData.get("gate_step") as string | null;
  const pdfFile = formData.get("pdf") as File | null;

  if (!displayName || !documentKey) {
    return { ok: false, error: "Display name and document key are required." };
  }
  if (!pdfFile || pdfFile.size === 0) {
    return { ok: false, error: "A PDF file is required." };
  }
  if (!pdfFile.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Only PDF files are supported." };
  }
  if (!/^[a-z0-9_]+$/.test(documentKey)) {
    return { ok: false, error: "Document key must be lowercase letters, numbers, and underscores only." };
  }

  const signerRoles: string[] = signerRolesRaw
    ? (JSON.parse(signerRolesRaw) as string[])
    : ["Owner"];
  if (signerRoles.length === 0) {
    return { ok: false, error: "At least one signer role is required." };
  }
  const gateStep = gateStepRaw && gateStepRaw !== "" ? parseInt(gateStepRaw, 10) : undefined;

  const buffer = Buffer.from(await pdfFile.arrayBuffer());
  const docuSealResult = await createTemplate(displayName, buffer, pdfFile.name);
  if (!docuSealResult) {
    return { ok: false, error: "Could not create the DocuSeal template. Verify DOCUSEAL_API_TOKEN is set in Doppler." };
  }

  const record = await createDocumentTemplateRecord({
    document_key: documentKey,
    display_name: displayName,
    description,
    signer_roles: signerRoles,
    requires_countersignature: requiresCounter,
    gate_step: gateStep,
    docuseal_template_id: docuSealResult.templateId,
  });

  if (!record) {
    return { ok: false, error: "Could not save the template record. The document key may already exist." };
  }

  return { ok: true, template: record };
}

/**
 * Phase 2: called after admin saves the builder layout.
 * Marks the template active so the signing flow can resolve it.
 */
export async function activateTemplate(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const ok = await updateDocumentTemplateRecord(id, { is_active: true });
  return ok ? { ok: true } : { ok: false, error: "Could not activate the template." };
}

/**
 * Fork a system template for a specific org (future multi-tenant use).
 * Clones the DocuSeal template and creates a new org-scoped DB record.
 * orgId is passed as an empty string in v1 (no orgs table yet) — the record
 * will have org_id=null which conflicts with the system template unique index.
 * Wire this up fully when the orgs table ships.
 */
export async function forkSystemTemplate(
  sourceId: string,
  orgId: string,
): Promise<TemplateActionResult> {
  if (!orgId) {
    return { ok: false, error: "Organization context required to customize a template." };
  }

  const source = await getDocumentTemplate(sourceId);
  if (!source || !source.is_system) {
    return { ok: false, error: "Source template not found or is not a system template." };
  }
  if (!source.docuseal_template_id) {
    return { ok: false, error: "System template has no DocuSeal template built yet. Build it first." };
  }

  const cloned = await cloneTemplate(
    source.docuseal_template_id,
    `${source.display_name} (Custom)`,
  );
  if (!cloned) {
    return { ok: false, error: "Could not clone the DocuSeal template." };
  }

  const record = await createDocumentTemplateRecord({
    org_id: orgId,
    document_key: source.document_key,
    display_name: source.display_name,
    description: source.description ?? undefined,
    signer_roles: source.signer_roles,
    requires_countersignature: source.requires_countersignature,
    gate_step: source.gate_step ?? undefined,
    docuseal_template_id: cloned.templateId,
  });

  if (!record) {
    return { ok: false, error: "Could not save the forked template record." };
  }

  return { ok: true, template: record };
}

/** Soft-delete a tenant template. System templates cannot be deleted. */
export async function deactivateTemplate(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const template = await getDocumentTemplate(id);
  if (!template) return { ok: false, error: "Template not found." };
  if (template.is_system) return { ok: false, error: "System templates cannot be deleted." };
  const ok = await updateDocumentTemplateRecord(id, { is_active: false });
  return ok ? { ok: true } : { ok: false, error: "Could not deactivate the template." };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(admin)/admin/documents/templates/template-actions.ts
git commit -m "feat: add document template server actions"
```

---

## Task 7: Update signing flow to use DB lookup

**Files:**
- Modify: `apps/web/src/lib/documents/signing.ts`

- [ ] **Step 1: Update imports**

In `apps/web/src/lib/documents/signing.ts`, find:

```typescript
import {
  DOCUSEAL_TEMPLATE_IDS,
  SIGNER_ROLE,
  COUNTERSIGNER_ROLE,
  isSignatureDocument,
  type SignatureDocumentKey,
} from "@/lib/signing/signature-config";
import { WORKSPACE_DOCUMENT_DEFINITIONS, type WorkspaceDocumentKey } from "@/lib/admin/documents-hub-shared";
```

Replace with:

```typescript
import {
  SIGNER_ROLE,
  COUNTERSIGNER_ROLE,
} from "@/lib/signing/signature-config";
import { WORKSPACE_DOCUMENT_DEFINITIONS, type WorkspaceDocumentKey } from "@/lib/admin/documents-hub-shared";
import { resolveTemplateId, isSignatureDocumentKey } from "@/lib/admin/document-templates";
```

- [ ] **Step 2: Update `ensureSignatureSubmission` — signature check**

Find:

```typescript
  const key = spine.document_key as WorkspaceDocumentKey | null;
  if (!isSignatureDocument(key)) return { ok: false, error: "This document is not signed electronically." };
```

Replace with:

```typescript
  const key = spine.document_key;
  if (!key || !(await isSignatureDocumentKey(key))) {
    return { ok: false, error: "This document is not signed electronically." };
  }
```

- [ ] **Step 3: Update `ensureSignatureSubmission` — template ID lookup**

Find:

```typescript
  const templateId = DOCUSEAL_TEMPLATE_IDS[key as SignatureDocumentKey];
  if (!templateId) return { ok: true, embedUrl: null, status: "preparing" };
```

Replace with:

```typescript
  const templateId = await resolveTemplateId(key);
  if (!templateId) return { ok: true, embedUrl: null, status: "preparing" };
```

- [ ] **Step 4: Fix key usage in `persistSubmission` call and `WORKSPACE_DOCUMENT_DEFINITIONS` lookup**

After the change above, `key` is `string` instead of `WorkspaceDocumentKey`. Find any remaining casts like `key as SignatureDocumentKey` or `key as WorkspaceDocumentKey` and update them. In `persistSubmission`, the `def` lookup uses `spine.document_key as WorkspaceDocumentKey` — that cast is still safe (it's reading a label, not gating logic), so leave it.

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors. If narrowing issues appear on `key`, cast to `string` explicitly where needed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/documents/signing.ts
git commit -m "feat: signing flow resolves template IDs from DB instead of static config"
```

---

## Task 8: Retire hardcoded config

**Files:**
- Modify: `apps/web/src/lib/signing/signature-config.ts`

- [ ] **Step 1: Replace the file contents with role constants only**

```typescript
// apps/web/src/lib/signing/signature-config.ts

/**
 * Signing engine role constants. These must match the role names
 * defined in each DocuSeal template.
 * Document types and template IDs now live in the document_templates DB table.
 */

/** The role name for the property owner (primary signer). */
export const SIGNER_ROLE = "Owner";

/** The role name for Parcel's countersignature. */
export const COUNTERSIGNER_ROLE = "Parcel";
```

- [ ] **Step 2: Verify no stale imports remain**

```bash
cd apps/web && grep -r "DOCUSEAL_TEMPLATE_IDS\|SIGNATURE_DOCUMENT_KEYS\|isSignatureDocument\|SignatureDocumentKey" src/ --include="*.ts" --include="*.tsx"
```

Expected: zero matches. If any appear, update those files to use DB helpers.

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/signing/signature-config.ts
git commit -m "refactor: retire hardcoded DOCUSEAL_TEMPLATE_IDS from signature-config.ts"
```

---

## Task 9: DocuSealBuilderView — Phase 2 client component

**Files:**
- Create: `apps/web/src/app/(admin)/admin/documents/templates/DocuSealBuilderView.tsx`
- Create: `apps/web/src/app/(admin)/admin/documents/templates/DocuSealBuilderView.module.css`

- [ ] **Step 1: Write `DocuSealBuilderView.tsx`**

```typescript
// apps/web/src/app/(admin)/admin/documents/templates/DocuSealBuilderView.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./DocuSealBuilderView.module.css";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "docuseal-builder": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          token?: string;
          "template-id"?: string;
          host?: string;
        },
        HTMLElement
      >;
    }
  }
}

type Props = {
  templateId: number;
  templateName: string;
  onSave: () => void;
  onBack: () => void;
};

export function DocuSealBuilderView({ templateId, templateName, onSave, onBack }: Props) {
  const [session, setSession] = useState<{ token: string; host: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const builderRef = useRef<HTMLElement>(null);

  // Fetch the admin-protected builder session token.
  useEffect(() => {
    fetch("/api/admin/docuseal/builder-session")
      .then((r) => {
        if (!r.ok) throw new Error("Session fetch failed");
        return r.json() as Promise<{ token: string; host: string }>;
      })
      .then(setSession)
      .catch(() =>
        setFetchError("Could not load the template builder. Check DOCUSEAL_API_TOKEN in Doppler."),
      );
  }, []);

  // Load the DocuSeal builder script after session is ready.
  useEffect(() => {
    if (!session) return;
    if (document.getElementById("docuseal-builder-script")) return;
    const script = document.createElement("script");
    script.id = "docuseal-builder-script";
    script.src = "https://cdn.docuseal.com/js/builder.js";
    script.async = true;
    document.head.appendChild(script);
  }, [session]);

  // Listen for the builder's save event.
  useEffect(() => {
    const el = builderRef.current;
    if (!el || !session) return;
    const handler = () => {
      setSaving(true);
      onSave();
    };
    el.addEventListener("save", handler);
    return () => el.removeEventListener("save", handler);
  }, [session, onSave]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← Back
        </button>
        <span className={styles.title}>{templateName}</span>
        <span className={styles.hint}>Adjust signature field placements, then save.</span>
      </div>

      <div className={styles.builderArea}>
        {fetchError && <p className={styles.error}>{fetchError}</p>}
        {!session && !fetchError && <p className={styles.loading}>Loading builder…</p>}
        {session && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <docuseal-builder
            ref={builderRef as React.RefObject<any>}
            token={session.token}
            template-id={String(templateId)}
            host={session.host}
          />
        )}
      </div>

      {saving && (
        <div className={styles.savingOverlay}>Saving template…</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `DocuSealBuilderView.module.css`**

```css
.root {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface-elevated);
  flex-shrink: 0;
}

.backBtn {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: color 0.15s ease, background 0.15s ease;
}

.backBtn:hover {
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
}

.title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--color-text-primary);
}

.hint {
  margin-left: auto;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.builderArea {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.builderArea docuseal-builder {
  display: block;
  width: 100%;
  height: 100%;
}

.loading,
.error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
}

.error {
  color: var(--color-error, #dc2626);
}

.savingOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 500;
  color: #fff;
  z-index: 50;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(admin)/admin/documents/templates/DocuSealBuilderView.tsx apps/web/src/app/(admin)/admin/documents/templates/DocuSealBuilderView.module.css
git commit -m "feat: add DocuSealBuilderView Phase 2 client component"
```

---

## Task 10: CreateTemplateSlideOver — Phase 1

**Files:**
- Create: `apps/web/src/app/(admin)/admin/documents/templates/CreateTemplateSlideOver.tsx`
- Create: `apps/web/src/app/(admin)/admin/documents/templates/CreateTemplateSlideOver.module.css`

- [ ] **Step 1: Write `CreateTemplateSlideOver.tsx`**

```typescript
// apps/web/src/app/(admin)/admin/documents/templates/CreateTemplateSlideOver.tsx
"use client";

import { useState } from "react";
import { uploadAndCreateTemplate } from "./template-actions";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./CreateTemplateSlideOver.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onTemplateCreated: (template: DocumentTemplate) => void;
};

// gate_step values from GATE_STEP in lifecycle.ts
const GATE_OPTIONS = [
  { value: "1", label: "Agreement (step 1)" },
  { value: "2", label: "Payment (step 2)" },
  { value: "3", label: "Banking (step 3)" },
  { value: "4", label: "Identity / other (step 4)" },
];

const AVAILABLE_ROLES = ["Owner", "Parcel", "Tenant", "Co-owner"];

function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function CreateTemplateSlideOver({ open, onClose, onTemplateCreated }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [documentKey, setDocumentKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [roles, setRoles] = useState<string[]>(["Owner", "Parcel"]);
  const [requiresCounter, setRequiresCounter] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!open) return null;

  function handleNameChange(v: string) {
    setDisplayName(v);
    if (!keyEdited) setDocumentKey(toSlug(v));
  }

  function handleKeyChange(v: string) {
    setDocumentKey(toSlug(v));
    setKeyEdited(true);
  }

  function toggleRole(role: string) {
    setRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("signer_roles", JSON.stringify(roles));
    formData.set("requires_countersignature", String(requiresCounter));

    setSubmitting(true);
    try {
      const result = await uploadAndCreateTemplate(formData);
      if (!result.ok) { setError(result.error); return; }
      onTemplateCreated(result.template);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>New Document Template</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="display_name">Display name</label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              className={styles.input}
              placeholder="Host Rental Agreement"
              value={displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="document_key">Document key</label>
            <input
              id="document_key"
              name="document_key"
              type="text"
              className={styles.input}
              placeholder="host_rental_agreement"
              value={documentKey}
              onChange={(e) => handleKeyChange(e.target.value)}
              required
            />
            <p className={styles.hint}>Lowercase letters, numbers, and underscores only.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              className={styles.textarea}
              rows={2}
              placeholder="What is this document for?"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Signer roles</span>
            <div className={styles.checkboxGroup}>
              {AVAILABLE_ROLES.map((role) => (
                <label key={role} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={requiresCounter}
                onChange={(e) => setRequiresCounter(e.target.checked)}
              />
              Requires Parcel countersignature
            </label>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="gate_step">Onboarding gate step</label>
            <select id="gate_step" name="gate_step" className={styles.input}>
              <option value="">None (manual / standalone)</option>
              {GATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>PDF document</span>
            <label className={styles.uploadZone}>
              <input
                type="file"
                name="pdf"
                accept="application/pdf"
                className={styles.fileInput}
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                required
              />
              <div className={styles.uploadContent}>
                {fileName
                  ? <span className={styles.fileName}>{fileName}</span>
                  : <><span className={styles.uploadIcon}>↑</span><span>Click or drag a PDF here</span></>
                }
              </div>
            </label>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? "Creating…" : "Build Template →"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Write `CreateTemplateSlideOver.module.css`**

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 40;
  display: flex;
  justify-content: flex-end;
}

.panel {
  width: 440px;
  max-width: 100vw;
  height: 100%;
  background: var(--color-surface-elevated);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  background: var(--color-surface-elevated);
  z-index: 1;
}

.panelTitle {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.closeBtn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--color-text-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  transition: color 0.15s ease;
}
.closeBtn:hover { color: var(--color-text-primary); }

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input,
.textarea {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.input:focus,
.textarea:focus { outline: none; border-color: var(--color-brand); }
.textarea { resize: vertical; min-height: 4rem; }

.hint {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

.checkboxGroup {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.checkboxLabel {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  color: var(--color-text-primary);
  cursor: pointer;
}

.uploadZone {
  border: 1.5px dashed var(--color-border);
  border-radius: 0.625rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.uploadZone:hover { border-color: var(--color-brand); background: var(--color-surface-hover); }

.fileInput { display: none; }

.uploadContent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
}
.uploadIcon { font-size: 1.5rem; }
.fileName { font-size: 0.875rem; color: var(--color-text-primary); font-weight: 500; }

.errorMsg {
  color: var(--color-error, #dc2626);
  font-size: 0.875rem;
  margin: 0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
}

.cancelBtn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  background: none;
  color: var(--color-text-secondary);
  font-size: 0.9375rem;
  cursor: pointer;
  transition: background 0.15s ease;
}
.cancelBtn:hover { background: var(--color-surface-hover); }

.submitBtn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--color-brand);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.submitBtn:disabled { opacity: 0.6; cursor: not-allowed; }
```

> **Note:** After implementation, inspect `apps/web/src/app/globals.css` or Tailwind config to confirm the exact CSS variable names in use (`--color-brand`, `--color-surface`, etc.) and update if they differ.

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(admin)/admin/documents/templates/CreateTemplateSlideOver.tsx apps/web/src/app/(admin)/admin/documents/templates/CreateTemplateSlideOver.module.css
git commit -m "feat: add CreateTemplateSlideOver Phase 1 component"
```

---

## Task 11: TemplatesHub — list + orchestration

**Files:**
- Create: `apps/web/src/app/(admin)/admin/documents/templates/TemplatesHub.tsx`
- Create: `apps/web/src/app/(admin)/admin/documents/templates/TemplatesHub.module.css`

- [ ] **Step 1: Write `TemplatesHub.tsx`**

```typescript
// apps/web/src/app/(admin)/admin/documents/templates/TemplatesHub.tsx
"use client";

import { useState } from "react";
import { CreateTemplateSlideOver } from "./CreateTemplateSlideOver";
import { DocuSealBuilderView } from "./DocuSealBuilderView";
import { activateTemplate } from "./template-actions";
import type { DocumentTemplate } from "@/lib/admin/document-templates-types";
import styles from "./TemplatesHub.module.css";

type Props = {
  systemTemplates: DocumentTemplate[];
  customTemplates: DocumentTemplate[];
};

type Phase = "list" | "builder";

export function TemplatesHub({ systemTemplates, customTemplates }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [phase, setPhase] = useState<Phase>("list");
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function handleTemplateCreated(template: DocumentTemplate) {
    setShowCreate(false);
    setActiveTemplate(template);
    setPhase("builder");
  }

  function openBuilder(template: DocumentTemplate) {
    setActiveTemplate(template);
    setPhase("builder");
  }

  async function handleBuilderSave() {
    if (!activeTemplate) return;
    await activateTemplate(activeTemplate.id);
    setSavedId(activeTemplate.id);
    setPhase("list");
    setActiveTemplate(null);
  }

  function handleBuilderBack() {
    setPhase("list");
    setActiveTemplate(null);
  }

  if (phase === "builder" && activeTemplate?.docuseal_template_id) {
    return (
      <DocuSealBuilderView
        templateId={activeTemplate.docuseal_template_id}
        templateName={activeTemplate.display_name}
        onSave={handleBuilderSave}
        onBack={handleBuilderBack}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Document Templates</h1>
          <p className={styles.pageSubtitle}>
            Manage the document types used in the owner onboarding flow.
          </p>
        </div>
        <button type="button" className={styles.newBtn} onClick={() => setShowCreate(true)}>
          + New Template
        </button>
      </div>

      {savedId && (
        <div className={styles.successBanner}>
          Template saved and active. Refresh the page to see it listed as Ready.
        </div>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Parcel Library</h2>
        {systemTemplates.length === 0
          ? <p className={styles.empty}>No system templates found.</p>
          : <TemplateList templates={systemTemplates} onEdit={openBuilder} />
        }
      </section>

      {customTemplates.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Custom Templates</h2>
          <TemplateList templates={customTemplates} onEdit={openBuilder} />
        </section>
      )}

      <CreateTemplateSlideOver
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onTemplateCreated={handleTemplateCreated}
      />
    </div>
  );
}

function TemplateList({
  templates,
  onEdit,
}: {
  templates: DocumentTemplate[];
  onEdit: (t: DocumentTemplate) => void;
}) {
  return (
    <div className={styles.templateList}>
      {templates.map((t) => (
        <TemplateRow key={t.id} template={t} onEdit={() => onEdit(t)} />
      ))}
    </div>
  );
}

function TemplateRow({
  template,
  onEdit,
}: {
  template: DocumentTemplate;
  onEdit: () => void;
}) {
  const isReady = template.docuseal_template_id !== null && template.is_active;

  return (
    <div className={styles.row}>
      <div className={styles.rowInfo}>
        <span className={styles.rowName}>{template.display_name}</span>
        <span className={styles.rowKey}>{template.document_key}</span>
      </div>
      <div className={styles.rowMeta}>
        <span className={styles.rowRoles}>{template.signer_roles.join(", ")}</span>
        <span className={`${styles.badge} ${isReady ? styles.badgeReady : styles.badgeDraft}`}>
          {isReady ? "Ready" : "Draft"}
        </span>
      </div>
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.editBtn}
          onClick={onEdit}
          disabled={!template.docuseal_template_id}
          title={!template.docuseal_template_id ? "Build the template first" : "Edit field layout"}
        >
          Edit layout
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `TemplatesHub.module.css`**

```css
.root {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  max-width: 900px;
}

.pageHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.pageTitle {
  font-size: 1.375rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
  letter-spacing: -0.02em;
}

.pageSubtitle {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.newBtn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  background: var(--color-brand);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s ease;
}
.newBtn:hover { opacity: 0.9; }

.successBanner {
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--color-brand) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-brand) 30%, transparent);
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: var(--color-text-primary);
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sectionTitle {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-secondary);
  margin: 0;
}

.empty {
  font-size: 0.9375rem;
  color: var(--color-text-tertiary);
}

.templateList {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: 0.625rem;
  transition: border-color 0.15s ease;
}
.row:hover { border-color: var(--color-border-hover, var(--color-brand)); }

.rowInfo {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.rowName {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.rowKey {
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono, ui-monospace, monospace);
}

.rowMeta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.rowRoles {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.badge {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.badgeReady {
  background: color-mix(in srgb, #22c55e 15%, transparent);
  color: #15803d;
}

.badgeDraft {
  background: color-mix(in srgb, #eab308 15%, transparent);
  color: #a16207;
}

.rowActions { flex-shrink: 0; }

.editBtn {
  padding: 0.375rem 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  background: none;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.editBtn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  color: var(--color-text-primary);
}
.editBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/(admin)/admin/documents/templates/TemplatesHub.tsx apps/web/src/app/(admin)/admin/documents/templates/TemplatesHub.module.css
git commit -m "feat: add TemplatesHub list and phase orchestration"
```

---

## Task 12: Route page and nav link

**Files:**
- Create: `apps/web/src/app/(admin)/admin/documents/templates/page.tsx`
- Create: `apps/web/src/app/(admin)/admin/documents/templates/page.module.css`
- Modify: admin nav component (identify in Step 1)

- [ ] **Step 1: Find the Documents nav component**

```bash
grep -r "documents\|Documents" apps/web/src/components/admin/chrome/ --include="*.tsx" -l
grep -r "href.*admin/documents" apps/web/src/app/\(admin\)/ --include="*.tsx" -l
```

Identify which file renders the navigation link to `/admin/documents`. That is the file to modify for the Templates link.

- [ ] **Step 2: Create `page.tsx`**

```typescript
// apps/web/src/app/(admin)/admin/documents/templates/page.tsx
import { listDocumentTemplates } from "@/lib/admin/document-templates";
import { TemplatesHub } from "./TemplatesHub";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const all = await listDocumentTemplates();
  const systemTemplates = all.filter((t) => t.is_system);
  const customTemplates = all.filter((t) => !t.is_system);

  return (
    <main className={styles.main}>
      <TemplatesHub systemTemplates={systemTemplates} customTemplates={customTemplates} />
    </main>
  );
}
```

- [ ] **Step 3: Create `page.module.css`**

```css
.main {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
```

- [ ] **Step 4: Add the nav link**

In the file identified in Step 1, add a link to `/admin/documents/templates` following the exact same pattern as the existing navigation links in that file. Do not invent a new pattern.

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

- [ ] **Step 6: Start dev server and verify end-to-end**

```bash
cd apps/web && doppler run -- next dev -p 4000
```

Run each check:
1. Navigate to `http://localhost:4000/admin/documents/templates`. The page loads with "Document Templates" heading.
2. The "Parcel Library" section shows 3 template rows: Host Rental Agreement, ACH Authorization, Card Authorization.
3. Each row shows a "Draft" badge (no DocuSeal template ID yet — correct).
4. Each row's "Edit layout" button is disabled (no template ID yet — correct).
5. Clicking "New Template" opens the Phase 1 slide-over with all form fields.
6. Filling the form and uploading a PDF calls DocuSeal, creates the DB record, and transitions to Phase 2.
7. Phase 2 shows the DocuSeal builder header with the template name and a "← Back" button.
8. Check browser console for errors.

- [ ] **Step 7: Screenshot the completed page**

```bash
node screenshot.mjs http://localhost:4000/admin/documents/templates templates-hub
```

Read the screenshot. Verify: consistent spacing with other admin hub pages, correct typography, all 3 system template rows visible, badges styled correctly.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/(admin)/admin/documents/templates/page.tsx apps/web/src/app/(admin)/admin/documents/templates/page.module.css
git commit -m "feat: add document templates admin page and nav link"
```

---

## Self-review

### Spec coverage

| Requirement | Task |
|---|---|
| DB replaces static config | Tasks 1, 7, 8 |
| 3 system templates seeded | Task 1 |
| `org_id` column for future multi-tenancy | Task 1 |
| Open-ended document types via admin UI | Task 10 (form), Task 6 (actions) |
| PDF upload from within Parcel | Task 10, Task 6 |
| DocuSeal auto field detection via API | Task 3 (`createTemplate`), Task 6 |
| Embedded `<docuseal-builder>` Phase 2 | Task 9 |
| Admin-protected builder token route | Task 4 |
| Phase 1 metadata + upload form | Task 10 |
| Phase 2 full-page builder | Task 9 |
| Templates list at Documents → Templates | Tasks 11, 12 |
| Tenant-first / system-fallback signing | Task 7 |
| `signature-config.ts` cleanup | Task 8 |
| Fork / Customize system template | Task 6 (`forkSystemTemplate`) |

### Gap: page reload after activation

After `activateTemplate()` is called in `TemplatesHub`, the `savedId` banner shows but the row still shows "Draft" because the server-rendered data is stale. Add `router.refresh()` from `next/navigation` after `activateTemplate()` completes in `handleBuilderSave` to re-fetch the page data:

```typescript
import { useRouter } from "next/navigation";
// inside TemplatesHub:
const router = useRouter();
// inside handleBuilderSave, after activateTemplate:
router.refresh();
```

Add this in Task 11 before the commit, or as a follow-up fix if the behavior is acceptable for the first pass.

### Gap: select element in Phase 1 form

`CreateTemplateSlideOver` uses a native `<select>` for gate step. Per CLAUDE.md, this is banned — use `CustomSelect` from `@/components/admin/CustomSelect`. Update Task 10 to replace the `<select>` with:

```typescript
import { CustomSelect } from "@/components/admin/CustomSelect";
// replace the <select> block with:
<CustomSelect
  name="gate_step"
  value={gateStep}
  onChange={setGateStep}
  options={[
    { value: "", label: "None (manual / standalone)" },
    ...GATE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ]}
/>
```

Add `const [gateStep, setGateStep] = useState("")` to component state and wire it to the FormData manually before submission: `formData.set("gate_step", gateStep)`.
