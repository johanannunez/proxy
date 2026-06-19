-- ============================================================================
-- Phase 1B CONTRACT: finalize the org -> agency rename. RENAME-BASED (no policy
-- regeneration). Postgres keys RLS policies, FKs, and indexes by attnum/OID, so
-- RENAME COLUMN / RENAME TABLE / ALTER FUNCTION ... RENAME make all of them
-- auto-follow (empirically confirmed on a throwaway table before writing this).
--
-- PRECONDITION: the org->agency CODE SWEEP must already be DEPLOYED. This migration
-- drops the compat views and the mirror columns that the *old* code depended on, so
-- it is only safe once no old instance is still serving traffic.
--
-- Runs as ONE transaction (Supabase apply_migration wraps DDL); no CREATE INDEX
-- CONCURRENTLY is used, so a single tx is legal and keeps every intermediate state
-- invisible to other sessions.
-- ============================================================================

-- 1) Drop the backward-compat views (grep proof: no deployed code references
--    "organizations" / "organization_members" anymore).
drop view if exists public.organizations;
drop view if exists public.organization_members;

-- 2) For every real table carrying org_id (114): remove the sync trigger, drop the
--    mirror agency_id column (lean, unreferenced by any policy/FK/index), then RENAME
--    the original org_id -> agency_id. The rename preserves the original FK (incl. its
--    ON DELETE), NOT NULL, and indexes, and every RLS policy referencing the column
--    auto-follows.
do $do$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join pg_tables t on t.schemaname = 'public' and t.tablename = c.table_name
    where c.table_schema = 'public' and c.column_name = 'org_id'
    order by c.table_name
  loop
    execute format('drop trigger if exists sync_org_agency_id on public.%I', r.table_name);
    execute format('alter table public.%I drop column agency_id', r.table_name);
    execute format('alter table public.%I rename column org_id to agency_id', r.table_name);
  end loop;
end
$do$;

-- 3) Retire the sync machinery.
drop function if exists public.sync_org_agency_id();

-- 4) Rewrite the 4 functions whose TEXT bodies reference org_id (prosrc does NOT
--    auto-follow). agency_members.org_id is now agency_id after step 2.

-- 4a) Membership helpers: re-point bodies onto agency_members.agency_id, then rename
--     the functions (the ~136 helper-referencing policies auto-follow by OID; renames
--     preserve grants). Role values are unchanged (Phase 2).
--     NOTE: these are CREATE OR REPLACE (not drop+create) because ~136 policies depend
--     on them. CREATE OR REPLACE cannot rename an input parameter, so the arg stays
--     named target_org_id (internal-only; it now carries an agency id). Only the body
--     and the function name change.
create or replace function public.is_org_admin(target_org_id uuid)
  returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1 from agency_members
    where agency_id = target_org_id
      and profile_id = auth.uid()
      and role in ('org_owner', 'org_admin')
  ) or auth.role() = 'service_role'
$fn$;
alter function public.is_org_admin(uuid) rename to is_agency_admin;

create or replace function public.is_org_member(target_org_id uuid)
  returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1 from agency_members
    where agency_id = target_org_id
      and profile_id = auth.uid()
  ) or auth.role() = 'service_role'
$fn$;
alter function public.is_org_member(uuid) rename to is_agency_member;

-- 4b) current_org_id -> current_agency_id. Body still reads the JWT claim key 'org_id'
--     (that claim is an external auth contract set at token-mint time, not a column),
--     so only the function name changes; the single policy using it auto-follows.
alter function public.current_org_id() rename to current_agency_id;

-- 4c) find_reminder_candidates: drc.org_id is now drc.agency_id; rename the OUT column
--     org_id -> agency_id to match the deployed RPC consumer (reminders.ts).
--     DROP + CREATE (not CREATE OR REPLACE): changing an OUT column name changes the
--     return type, which CREATE OR REPLACE forbids. No policy/view depends on this RPC.
drop function if exists public.find_reminder_candidates();
create function public.find_reminder_candidates()
 returns table(document_id uuid, owner_id uuid, owner_email text, owner_name text,
               document_key text, document_title text, workspace_id uuid,
               agency_id uuid, round integer, config_days integer)
 language sql security definer set search_path to 'public'
as $fn$
  with reminder_status as (
    select
      d.id as doc_id, d.owner_id as doc_owner_id, d.document_key as doc_key,
      d.title as doc_title, d.workspace_id as doc_workspace_id, d.created_at as doc_created_at,
      coalesce(max(dr.round), 0) as last_round_sent
    from documents d
    left join document_reminders dr on dr.document_id = d.id
    where d.status not in ('on_file', 'expired', 'expiring', 'waived', 'declined')
      and d.waived = false
      and d.document_key is not null
    group by d.id
  ),
  next_round as (
    select
      rs.*, rs.last_round_sent + 1 as upcoming_round,
      drc.agency_id as config_agency_id, drc.round_1_days, drc.round_2_days, drc.round_3_days
    from reminder_status rs
    join document_reminder_config drc
      on drc.document_key = rs.doc_key
     and drc.agency_id = '00000000-0000-0000-0000-000000000001'::uuid
    where rs.last_round_sent < 3
  )
  select
    nr.doc_id, nr.doc_owner_id, p.email, p.full_name, nr.doc_key, nr.doc_title,
    nr.doc_workspace_id, nr.config_agency_id, nr.upcoming_round,
    case nr.upcoming_round
      when 1 then nr.round_1_days when 2 then nr.round_2_days when 3 then nr.round_3_days
    end as config_days
  from next_round nr
  join profiles p on p.id = nr.doc_owner_id
  where p.email is not null
    and nr.doc_created_at <= now() - (
      case nr.upcoming_round
        when 1 then nr.round_1_days when 2 then nr.round_2_days when 3 then nr.round_3_days
      end || ' days'
    )::interval
$fn$;

-- 4d) DROP+CREATE reset the ACL to Supabase defaults (PUBLIC execute). This function is
--     SECURITY DEFINER and returns owner PII (email/name) while bypassing RLS, and is
--     called ONLY by the service-role cron (reminders.ts -> createServiceClient). Restore
--     the pre-contract lock so no anon/authenticated caller can harvest cross-tenant PII.
revoke all on function public.find_reminder_candidates() from public, anon, authenticated;
grant execute on function public.find_reminder_candidates() to service_role;
