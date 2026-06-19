# Phase 1B — `org` → `agency` Rename Implementation Plan (resolved)

**Goal:** Rename the tenant vocabulary from `org`/`organization` to `agency` end to end (DB + code), so the product language and the codebase match, with zero production downtime, on the live DB serving 13 clients.

**Status:** Resolved and executing on branch `feat/phase-1b-org-to-agency-rename`. User chose FULL scope (incl. the 114-column rename and helper rename) on 2026-06-18 after being shown the narrower alternatives.

## Scope (re-measured against the live DB 2026-06-18)

- **114 tables** carry `org_id` (all `uuid`; 113 NOT NULL, 1 nullable; 112 have an FK → `organizations`; 115 indexes touch `org_id`).
- FK `ON DELETE`: 107 `NO ACTION`, 5 `CASCADE`; all `ON UPDATE NO ACTION`.
- Tables `organizations`, `organization_members`.
- Helpers: `is_org_admin(uuid)` + `is_org_member(uuid)` (SECURITY DEFINER), `current_org_id()` (not secdef). `is_superadmin()` stays.
- **241** public RLS policies; **139** reference the `org_id` token, **136** reference an org helper, only **3** reference the org table names, only **1** references `current_org_id`.
- Token-swap safety verified: **no** column contains `org_id` except the exact column; **no** column named `organization*`. So a word-bounded `org_id`→`agency_id` swap in policy bodies is safe and also rewrites `current_org_id`→`current_agency_id`.
- Code: **32 files / 144 `org_id` occurrences**, 7 files use `"organizations"`, 3 use `"organization_members"`, `src/lib/organizations/` (cache, features, host, index, slug + __tests__). **No TS/RPC code references the DB helper names** — they are RLS-internal only.
- Workspaces are NOT renamed.

## Key design decision (resolves the plan's earlier ORs)

Use **dual-column expand → cut over code → constraint-preserving contract**. The contract step does **`DROP COLUMN agency_id` (the mirror) then `RENAME COLUMN org_id TO agency_id`** on each table. Renaming the *original* column preserves its FK (with correct ON DELETE), NOT NULL, and indexes automatically — so we never rebuild 112 FKs or 115 indexes. The added mirror stays lean (no FK/NN/index) and is discarded.

Parent-table rename gets **`security_invoker` compatibility views** so currently-deployed code (`.from("organizations")`) keeps working until the code sweep ships.

## Migration 1 — EXPAND (additive; safe; old code keeps working)

Apply via `apply_migration`. All steps additive — worst case is dropping unused columns.

1. Rename parents: `ALTER TABLE public.organizations RENAME TO agencies;` and `... organization_members RENAME TO agency_members;` (FKs, indexes, policies follow by OID).
2. Compat views (so deployed code still resolves):
   - `CREATE VIEW public.organizations WITH (security_invoker = true) AS SELECT * FROM public.agencies;`
   - `CREATE VIEW public.organization_members WITH (security_invoker = true) AS SELECT * FROM public.agency_members;`
   - Re-GRANT the same privileges the base tables expose to `anon`, `authenticated`, `service_role`.
3. Re-point helper **bodies** to the new base table `agency_members` (keep the names `is_org_admin`/`is_org_member`/`current_org_id` so the 139/136 policies keep working during the window). They still read column `org_id` (exists during the window).
4. Shared sync trigger function `public.sync_org_agency_id()` — keeps `org_id` and `agency_id` equal on INSERT/UPDATE (change-detecting, so an update to either mirrors to the other).
5. Catalog-driven `DO` loop over the 114 tables: `ADD COLUMN agency_id uuid;` → `UPDATE … SET agency_id = org_id;` → attach the sync trigger. No FK/NOT NULL/index on the mirror.

Verify: every tenant table reads identically on `org_id` and `agency_id`; the currently-deployed app still reads/writes through the compat views; cross-agency isolation probe still returns 0 rows.

## Code sweep (subagent-driven, on the feature branch)

1. `src/lib/organizations` → `src/lib/agencies` (folder + imports).
2. `org_id` → `agency_id` (144 occurrences / 32 files).
3. `"organizations"` → `"agencies"`, `"organization_members"` → `"agency_members"` (Supabase `.from()` strings + types).
4. Regenerate Supabase types.
5. Data: rename the seed agency row "Proxy" → "The Parcel Company" (founder's agency, per the design spec).
6. `pnpm exec tsc --noEmit` + `pnpm test` green after each cluster (admin / workspace / api / billing / treasury).

Then merge → push → deploy. Both names still resolve (mirror columns + compat views), so no breakage.

## Migration 2 — CONTRACT-A (recreate policies on agency vocabulary; both columns still present)

1. Create agency-named helpers `is_agency_admin(uuid)`, `is_agency_member(uuid)` (SECURITY DEFINER), `current_agency_id()` — bodies query `agency_members.agency_id`. Match the originals' grants (revoke from `anon` where the originals do).
2. Generate + apply `DROP POLICY … ; CREATE POLICY …` for every policy referencing the org vocabulary, swapping (in order) `is_org_admin`→`is_agency_admin`, `is_org_member`→`is_agency_member`, then word-bounded `org_id`→`agency_id` (also fixes `current_org_id`), and the 3 table refs `organizations`→`agencies` / `organization_members`→`agency_members`. The DDL is generated from `pg_policies`, reviewed, then applied.
3. **Verify isolation BEFORE dropping anything**: authenticated non-member sees 0 rows on `tax_profiles`, `w9_access_log`, and a sample of tenant tables. `org_id` still exists, so a bad regen is revertible with no data loss.

## Migration 3 — CONTRACT-B (drop old; final state)

1. Drop the 114 sync triggers + `sync_org_agency_id()`.
2. Per table: `ALTER TABLE t DROP COLUMN agency_id;` then `ALTER TABLE t RENAME COLUMN org_id TO agency_id;` (preserves FK/NOT NULL/indexes).
3. Drop org-named helpers `is_org_admin`/`is_org_member`/`current_org_id`.
4. Drop compat views `organizations`/`organization_members` (gated on code grep = 0).
5. Verify: code grep for `org_id`/`organizations`/`organization_members` = 0 in-scope; isolation probe = 0; `tsc` 0; suite green; Supabase advisors clean.

## Constraints

- No downtime: every step is either additive (expand) or runs only after the new code is deployed (contract). Contract-B drops the compat views only after grep = 0 confirms no deployed code references them.
- Migrations via Supabase MCP `apply_migration`; staged with verification gates; advisor review before expand and before each contract step.
- `for all` policies need both `using` and `with check`. No `any`/`@ts-ignore`. Verify `pnpm exec tsc --noEmit` + `pnpm test`.
- Evidence over assertion: grep counts + isolation probes are the proof.

## Then: Phase 2 (member permission model)

Builds on the agency naming. See the design spec §4. Plan after 1B lands.
