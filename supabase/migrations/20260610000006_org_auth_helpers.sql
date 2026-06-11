-- Sub-phase B1: org-aware auth helper functions.
-- Deviation from the plan SQL: is_org_admin and is_org_member are SECURITY
-- DEFINER (with pinned search_path) so they can be used inside RLS policies
-- on organization_members itself and on every org-scoped table in Sub-phase
-- B2 without triggering RLS recursion (42P17). Same pattern as
-- public.auth_workspace_id() in 20260529160000_documents_rls_fix_recursion.sql.

-- Returns the org_id from the current session claim (set by middleware)
-- Falls back to the Proxy default org during transition period
create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  )
$$;

-- Returns true if the current user is an admin of the given org
create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where org_id = target_org_id
      and profile_id = auth.uid()
      and role in ('org_owner', 'org_admin')
  )
  or auth.role() = 'service_role'
$$;

-- Returns true if the current user is any member of the given org
create or replace function public.is_org_member(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from organization_members
    where org_id = target_org_id
      and profile_id = auth.uid()
  )
  or auth.role() = 'service_role'
$$;
