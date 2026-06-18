-- Sub-phase B1: seed Proxy as the founding organization (org #1).

-- Insert Proxy as the founding organization
insert into organizations (id, name, slug, plan_tier)
values (
  '00000000-0000-0000-0000-000000000001',
  'Proxy',
  'proxy',
  'white_label'
)
on conflict (id) do nothing;

-- Seed branding for Proxy org
insert into organization_branding (org_id, powered_by_proxy)
values ('00000000-0000-0000-0000-000000000001', false)
on conflict (org_id) do nothing;

-- Seed settings for Proxy org (unlimited everything)
insert into organization_settings (org_id, limits)
values (
  '00000000-0000-0000-0000-000000000001',
  '{"max_workspaces": -1, "max_members": -1, "max_forms": -1, "max_templates": -1}'::jsonb
)
on conflict (org_id) do nothing;

-- Make all existing admin profiles org_owner of Proxy org
insert into organization_members (org_id, profile_id, role)
select
  '00000000-0000-0000-0000-000000000001',
  id,
  'org_owner'
from profiles
where role = 'admin'
on conflict (org_id, profile_id) do nothing;
