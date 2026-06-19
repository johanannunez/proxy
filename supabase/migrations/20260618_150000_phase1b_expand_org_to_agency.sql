-- ============================================================================
-- Phase 1B EXPAND: additive org -> agency scaffolding.
-- SAFE / ADDITIVE: old code keeps working throughout. Nothing is dropped here.
--   * organizations -> agencies, organization_members -> agency_members (rename;
--     FKs / indexes / policies follow by OID).
--   * security_invoker compat VIEWS preserve the old table names for deployed code.
--   * every org_id table gains a mirror agency_id column + a sync trigger so both
--     names stay equal while old and new code overlap during the cutover.
-- The matching CONTRACT migration (after the code sweep deploys) renames the
-- columns/functions for real and drops this scaffolding.
-- ============================================================================

-- 1) Rename the two parent tables. FKs, indexes, and RLS policies on them follow
--    automatically (Postgres keys them by OID, not by text).
alter table public.organizations rename to agencies;
alter table public.organization_members rename to agency_members;

-- 2) Backward-compatible views so currently-deployed code (.from("organizations"),
--    .from("organization_members")) keeps resolving. security_invoker = true makes the
--    base-table RLS apply as the querying role; a plain "select *" view is auto-updatable
--    so INSERT/UPDATE/DELETE pass through unchanged.
create view public.organizations
  with (security_invoker = true) as select * from public.agencies;
create view public.organization_members
  with (security_invoker = true) as select * from public.agency_members;

-- 3) Replicate the base-table grants onto the views (RLS stays the real gate).
grant select, insert, update, delete on public.organizations to anon, authenticated, service_role;
grant select, insert, update, delete on public.organization_members to anon, authenticated, service_role;

-- 4) Re-point the membership helpers onto the new base table. Names, signatures, and the
--    role values ('org_owner'/'org_admin') are unchanged (role-value changes are Phase 2),
--    so the ~136 helper-referencing policies keep working. SECURITY DEFINER intentionally
--    bypasses RLS for the membership check, so query the base table directly.
create or replace function public.is_org_admin(target_org_id uuid)
  returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1 from agency_members
    where org_id = target_org_id
      and profile_id = auth.uid()
      and role in ('org_owner', 'org_admin')
  ) or auth.role() = 'service_role'
$fn$;

create or replace function public.is_org_member(target_org_id uuid)
  returns boolean language sql stable security definer set search_path to 'public' as $fn$
  select exists (
    select 1 from agency_members
    where org_id = target_org_id
      and profile_id = auth.uid()
  ) or auth.role() = 'service_role'
$fn$;

-- 5) Sync trigger keeps org_id and agency_id equal during the overlap window.
--    Change-detecting so an update to EITHER column mirrors to the other.
create or replace function public.sync_org_agency_id()
  returns trigger language plpgsql as $fn$
begin
  if (tg_op = 'INSERT') then
    new.agency_id := coalesce(new.agency_id, new.org_id);
    new.org_id := coalesce(new.org_id, new.agency_id);
  elsif (tg_op = 'UPDATE') then
    if new.agency_id is distinct from old.agency_id then
      new.org_id := new.agency_id;
    elsif new.org_id is distinct from old.org_id then
      new.agency_id := new.org_id;
    end if;
  end if;
  return new;
end
$fn$;

-- 6) Add the mirror agency_id column + sync trigger to every REAL table that carries
--    org_id (114). Catalog-driven so it stays uniform. The join to pg_tables excludes the
--    compat views created in step 2. The mirror stays lean (no FK/NOT NULL/index) because
--    the contract preserves the original column's constraints by RENAMING it.
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
    execute format('alter table public.%I add column if not exists agency_id uuid', r.table_name);
    execute format('update public.%I set agency_id = org_id where agency_id is distinct from org_id', r.table_name);
    execute format('drop trigger if exists sync_org_agency_id on public.%I', r.table_name);
    execute format(
      'create trigger sync_org_agency_id before insert or update on public.%I '
      || 'for each row execute function public.sync_org_agency_id()', r.table_name);
  end loop;
end
$do$;
