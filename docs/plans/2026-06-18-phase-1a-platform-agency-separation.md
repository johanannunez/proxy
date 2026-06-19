# Phase 1A — Platform / Agency Role Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate platform authority (Superadmin) from tenant authority at the database layer, and close the audit's cross-tenant findings, without renaming any tables.

**Architecture:** Add a `platform_role` enum on `profiles` (the platform namespace, seeded with the sole Superadmin) so platform power stops riding on the overloaded `profiles.role = 'admin'`. Then repoint the three over-broad RLS reads (`tax_profiles`, `w9_access_log`, `document_templates`) from global-role checks to agency-scoped membership checks, and scope the three admin server actions that write with the service-role client to the caller's own org. The `organizations` to `agencies` rename and the middleware/app-gating switch to `platform_role` are deliberately deferred to Phase 1B; the member permission model (the two dials) is Phase 2. Everything here is additive and non-breaking.

**Tech Stack:** Postgres + Supabase Row-Level Security, Next.js 16 server actions (TypeScript), vitest, Supabase MCP `apply_migration`.

## Global Constraints

- Platform roles live on `profiles.platform_role`; tenant roles live on `organization_members.role`. They never share a column, and `platform_role` never grants tenant data access. (Spec, Two-Namespace Rule.)
- RLS denies by default; UI hiding is not a control. Every `for all` policy needs both `using` and `with check`. (CLAUDE.md.)
- No `any`, no `@ts-ignore`, no type assertions without a comment. (CLAUDE.md.)
- Migrations live in `supabase/migrations/` at the monorepo root (NOT `apps/web/supabase/`) and are applied with the Supabase MCP `apply_migration` tool. (CLAUDE.md.)
- All `pnpm`/`tsc` commands run from `apps/web/`. Type check is `pnpm exec tsc --noEmit` (there is no `typecheck` script). Tests are `pnpm test` (vitest).
- The sole Superadmin is `jo@johanannunez.com`. The Supabase project ref is `pwoxwpryummqeqsxdgyc`. The seed org sentinel is `00000000-0000-0000-0000-000000000001`.
- SQL helpers `is_org_admin(target_org_id uuid)` and `is_org_member(target_org_id uuid)` already exist and are membership-scoped (`is_org_admin` also returns true for `service_role`). Reuse them; do not reinvent.

**Safety:** Prefer applying each migration to a Supabase branch first (`create_branch` → `apply_migration` → verify → `merge_branch`). If applying directly to production, run the verification query in the same task immediately after, and stop if it does not match.

---

### Task 1: Introduce `platform_role` and seed the Superadmin

**Files:**
- Create: `supabase/migrations/20260618_120000_platform_role.sql`
- Modify: `apps/web/src/types/supabase.ts` (regenerated, not hand-edited)

**Interfaces:**
- Produces: `public.is_superadmin() returns boolean` (SQL, security definer); a new `platform_role` enum on `public.profiles` with values `superadmin | support | compliance | finance`.

- [ ] **Step 1: Write the verification query and capture the BEFORE state**

Run via Supabase MCP `execute_sql` (project `pwoxwpryummqeqsxdgyc`):

```sql
select
  (select count(*) from information_schema.columns
     where table_schema='public' and table_name='profiles' and column_name='platform_role') as has_col;
```

Expected BEFORE: `has_col = 0` (column does not exist yet).

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260618_120000_platform_role.sql`:

```sql
-- Platform-staff namespace, separate from tenant roles on organization_members.
do $$ begin
  create type public.platform_role as enum ('superadmin','support','compliance','finance');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists platform_role public.platform_role;

-- The sole Superadmin (the founder / platform owner).
update public.profiles
  set platform_role = 'superadmin'
  where email = 'jo@johanannunez.com';

-- Carry over any existing platform compliance staff (today: zero rows).
update public.profiles
  set platform_role = 'compliance'
  where role = 'compliance' and platform_role is null;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'superadmin'
  );
$$;

-- Do not expose this helper to anonymous callers.
revoke execute on function public.is_superadmin() from anon, public;
grant execute on function public.is_superadmin() to authenticated;
```

- [ ] **Step 3: Apply the migration**

Use the Supabase MCP `apply_migration` tool with name `platform_role` and the SQL above.

- [ ] **Step 4: Run the verification query (AFTER state)**

Run via `execute_sql`:

```sql
select
  (select platform_role::text from public.profiles where email='jo@johanannunez.com') as founder,
  (select count(*) from public.profiles where platform_role = 'superadmin') as superadmins,
  (select count(*) from public.profiles where email='dev-agent' or full_name='Dev Agent') as dev_rows,
  (select platform_role::text from public.profiles where full_name='Dev Agent') as dev_platform_role;
```

Expected AFTER: `founder = 'superadmin'`, `superadmins = 1`, `dev_platform_role` is `null` (Dev Agent is agency staff, not platform staff).

- [ ] **Step 5: Regenerate Supabase types**

Use the Supabase MCP `generate_typescript_types` tool and overwrite `apps/web/src/types/supabase.ts` with the result.

- [ ] **Step 6: Type-check and commit**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: exits 0.

```bash
git add supabase/migrations/20260618_120000_platform_role.sql apps/web/src/types/supabase.ts
git commit -m "feat(auth): add platform_role namespace and seed sole superadmin"
```

---

### Task 2: Scope the three over-broad RLS reads to the agency

**Files:**
- Create: `supabase/migrations/20260618_121000_rls_scope_fixes.sql`

**Interfaces:**
- Consumes: `is_org_admin(org_id)`, `is_org_member(org_id)` (existing).
- Produces: agency-scoped SELECT/ALL policies on `tax_profiles`, `w9_access_log`, `document_templates`.

- [ ] **Step 1: Capture the BEFORE state (the leak)**

Run via `execute_sql`:

```sql
select polname, cmd, coalesce(qual::text,'') as using_clause
from pg_policy pol join pg_class c on c.oid = pol.polrelid
where c.relname in ('tax_profiles','w9_access_log','document_templates')
order by c.relname, polname;
```

Expected BEFORE: `tax_profiles` / `w9_access_log` use `is_compliance_or_admin()` (global, no `org_id`); `document_templates` read uses `(auth.uid() IS NOT NULL)`.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260618_121000_rls_scope_fixes.sql`:

```sql
-- tax_profiles: only the serving agency's admins, not any global admin/compliance user.
drop policy if exists "tax_profiles: compliance or admin all" on public.tax_profiles;
create policy "tax_profiles agency admin all" on public.tax_profiles
  for all to authenticated
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

-- w9_access_log: same agency scoping for reads.
drop policy if exists "w9_access_log: compliance or admin read" on public.w9_access_log;
create policy "w9_access_log agency admin read" on public.w9_access_log
  for select to authenticated
  using (is_org_admin(org_id));

-- document_templates: stop letting any signed-in user read every agency's templates.
-- System templates (org_id null) stay readable by all signed-in users.
drop policy if exists "Authenticated users can read document templates" on public.document_templates;
create policy "document_templates org or system read" on public.document_templates
  for select to authenticated
  using (is_system = true or org_id is null or is_org_member(org_id));
```

- [ ] **Step 3: Apply the migration**

Use Supabase MCP `apply_migration` with name `rls_scope_fixes`.

- [ ] **Step 4: Verify with a live read-only cross-tenant probe**

The publishable (anon) key is in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. As an unauthenticated client (no membership), confirm the leak is closed:

```bash
K="$(doppler run --project proxy -- printenv NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)"
U="https://pwoxwpryummqeqsxdgyc.supabase.co"
# document_templates: anon should still get [] (needs membership; system rows are org_id null but read needs authenticated). 
curl -s "$U/rest/v1/document_templates?select=id,org_id&limit=3" -H "apikey: $K" -H "Authorization: Bearer $K"
# tax_profiles: anon must get []
curl -s "$U/rest/v1/tax_profiles?select=id,org_id&limit=3" -H "apikey: $K" -H "Authorization: Bearer $K"
```
Expected: both return `[]`. (Authenticated cross-org reads are now blocked by membership; a full authenticated probe requires a second test user and is covered in Task 4.)

- [ ] **Step 5: Run the existing suite and commit**

```bash
cd apps/web && pnpm test
```
Expected: `Test Files 36 passed`, `Tests 298 passed`.

```bash
git add supabase/migrations/20260618_121000_rls_scope_fixes.sql
git commit -m "fix(rls): scope tax_profiles, w9_access_log, document_templates reads to the agency"
```

---

### Task 3: Scope the admin service-role writes to the caller's own org

Service-role writes bypass RLS, so Task 2 does not cover them. Add an explicit `org_id` guard to the three admin actions the audit flagged (latent today with one agency, an IDOR the moment a second agency exists).

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/workspaces/[workspaceId]/receipts-admin-actions.ts` (functions `updateReceiptFieldAdmin`, `markReceiptReviewedAdmin`, `deleteReceiptAdmin`)
- Modify: `apps/web/src/lib/admin/admin-avatar-actions.ts` (function `uploadAdminAvatar`)
- Modify: `apps/web/src/lib/admin/w9-review.ts` (function `getW9SignedUrlForReview`)

**Interfaces:**
- Consumes: the existing `requireAdmin()` / `checkAdmin()` / `requireReviewer()` guards in each file, which return the authenticated `userId`. `owner_receipts`, `tax_profiles`, and `profiles` all carry `org_id`.

- [ ] **Step 1: Resolve the caller's org in `receipts-admin-actions.ts`**

After the existing `requireAdmin()` call (which yields `userId`), resolve the caller's org and add it as a filter. In each of `updateReceiptFieldAdmin`, `markReceiptReviewedAdmin`, and `deleteReceiptAdmin`, immediately before the mutation, add:

```ts
const { data: caller, error: callerErr } = await db
  .from("profiles")
  .select("org_id")
  .eq("id", userId)
  .single();
if (callerErr || !caller?.org_id) {
  return { error: "Could not resolve your organization." };
}
```

- [ ] **Step 2: Add the `org_id` filter to every receipt mutation**

On each `owner_receipts` write, append the org filter alongside the existing `.eq("id", id)`:

```ts
// updateReceiptFieldAdmin
await db.from("owner_receipts").update(patch).eq("id", id).eq("org_id", caller.org_id);
// markReceiptReviewedAdmin
await db.from("owner_receipts").update({ reviewed_at: new Date().toISOString() }).eq("id", id).eq("org_id", caller.org_id);
// deleteReceiptAdmin
await db.from("owner_receipts").delete().eq("id", id).eq("org_id", caller.org_id);
```

Keep the surrounding error handling that already exists in each function.

- [ ] **Step 3: Scope `uploadAdminAvatar` to the caller's org**

In `admin-avatar-actions.ts`, after the admin check yields the caller's `userId`, verify the `targetProfileId` is in the same org before writing:

```ts
const { data: target } = await svc.from("profiles").select("org_id").eq("id", targetProfileId).single();
const { data: me } = await svc.from("profiles").select("org_id").eq("id", userId).single();
if (!target?.org_id || !me?.org_id || target.org_id !== me.org_id) {
  return "You can only manage avatars within your organization.";
}
```

- [ ] **Step 4: Scope `getW9SignedUrlForReview` to the caller's org**

In `w9-review.ts`, after `requireReviewer()` yields the caller, resolve the tax profile by the supplied `signedDocumentId`/`storagePath`, and reject if its `org_id` differs from the caller's:

```ts
const { data: me } = await supabase.from("profiles").select("org_id").eq("id", reviewer.id).single();
const { data: row } = await supabase
  .from("tax_profiles")
  .select("org_id")
  .eq(signedDocumentId ? "id" : "storage_path", signedDocumentId ?? storagePath)
  .maybeSingle();
if (!row || !me?.org_id || row.org_id !== me.org_id) {
  throw new Error("Not authorized to access this document.");
}
```

Adjust the lookup column to match how the function currently identifies the row; the invariant is: resolve the row, compare `org_id` to the caller's, reject on mismatch before minting the signed URL.

- [ ] **Step 5: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: exits 0.

- [ ] **Step 6: Run the suite and commit**

```bash
cd apps/web && pnpm test
```
Expected: `Tests 298 passed`.

```bash
git add apps/web/src/app/\(admin\)/admin/workspaces/\[workspaceId\]/receipts-admin-actions.ts apps/web/src/lib/admin/admin-avatar-actions.ts apps/web/src/lib/admin/w9-review.ts
git commit -m "fix(admin): scope admin receipt, avatar, and W-9 writes to the caller's org"
```

---

### Task 4: Cutover verification gate

**Files:** none (verification only).

- [ ] **Step 1: Authenticated cross-org probe**

Create a throwaway second org and member in a Supabase branch (or use `execute_sql` with `set local role` simulation). Confirm: a member of org B selecting `tax_profiles`, `w9_access_log`, and `document_templates` for org A's rows returns zero rows. Document the exact query and result in the PR description.

- [ ] **Step 2: Confirm the platform/tenant split holds**

Run via `execute_sql`:

```sql
select
  (select count(*) from public.profiles where platform_role='superadmin') as superadmins,        -- expect 1
  (select count(*) from public.profiles where role='admin' and platform_role is null) as legacy_admins; -- Dev Agent etc.
```
Expected: `superadmins = 1`. `legacy_admins` may be > 0 (those become agency Admins in Phase 1B); this is expected and non-breaking because middleware still honors `role='admin'` until 1B.

- [ ] **Step 3: Full green check**

```bash
cd apps/web && pnpm exec tsc --noEmit && pnpm test
```
Expected: tsc exits 0; `Tests 298 passed`.

- [ ] **Step 4: Re-run the Supabase security advisor**

Use the Supabase MCP `get_advisors` (type `security`). Confirm the `document_templates` broad-read and the global-role gating on `tax_profiles`/`w9_access_log` no longer appear, and no NEW security lints were introduced.

- [ ] **Step 5: Final commit / PR**

```bash
git commit --allow-empty -m "chore: Phase 1A platform/agency separation verified (audit cross-tenant findings closed)"
```

---

## What Phase 1A deliberately does NOT do (next plans)

- **Phase 1B:** rename `organizations` → `agencies`, `org_id` → `agency_id`; rename the seed org "Proxy" → "The Parcel Company"; switch middleware and app gating from `profiles.role='admin'` to `platform_role` + agency membership. Pure expand/contract rename, grep-verified.
- **Phase 2:** the member permission model (`permissions`, `scope`, `is_billing_owner` on `agency_members`, `has_agency_permission(...)`, assigned-workspace scoping, the four presets).
- **Out of scope (separate audit fixes):** `analyzeAttachment` auth/SSRF, the public `property-documents` bucket lockdown, the Hospitable webhook disconnect. Tracked in `docs/audits/2026-06-18-platform-gap-audit.md`.
</content>
