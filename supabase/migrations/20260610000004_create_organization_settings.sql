-- Sub-phase B1: organization_settings table (feature flags and plan limits).

create table if not exists organization_settings (
  org_id    uuid primary key references organizations(id) on delete cascade,
  features  jsonb not null default '{}',
  limits    jsonb not null default '{
    "max_workspaces": 10,
    "max_members": 1,
    "max_forms": 5,
    "max_templates": 3
  }'::jsonb
);

alter table organization_settings enable row level security;

create policy "org admins can read settings"
  on organization_settings for select
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_settings.org_id
        and om.profile_id = auth.uid()
        and om.role in ('org_owner', 'org_admin')
    )
  );

create policy "service role full access"
  on organization_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
