-- Sub-phase B1: organization_members table.
-- Deviation from the plan SQL: the "org admins read all members" policy as
-- written self-referenced organization_members inside its own using clause,
-- which raises "infinite recursion detected in policy" (42P17) at query time.
-- Fix follows the established codebase pattern (see
-- 20260529160000_documents_rls_fix_recursion.sql): a SECURITY DEFINER helper
-- reads organization_members without re-entering RLS. The helper is the same
-- is_org_admin() that Sub-phase B2 will use for org-scoped RLS everywhere.

create table if not exists organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        text not null check (role in ('org_owner', 'org_admin', 'org_member', 'org_viewer')),
  invited_by  uuid references profiles(id) on delete set null,
  joined_at   timestamptz not null default now(),
  unique (org_id, profile_id)
);

create index idx_org_members_profile on organization_members (profile_id);
create index idx_org_members_org on organization_members (org_id);

-- SECURITY DEFINER so RLS policies on organization_members (and, in B2, on
-- every org-scoped table) can call it without recursing into RLS.
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

alter table organization_members enable row level security;

-- Members can read their own membership
create policy "members can read own membership"
  on organization_members for select
  using (profile_id = auth.uid());

-- Org admins can read all memberships in their org
create policy "org admins read all members"
  on organization_members for select
  using (public.is_org_admin(org_id));

create policy "service role full access"
  on organization_members for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Deferred from 20260610000001: organizations select policy that depends on
-- organization_members existing.
create policy "org members can read their org"
  on organizations for select
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organizations.id
        and om.profile_id = auth.uid()
    )
  );
