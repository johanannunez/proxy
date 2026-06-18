-- Workspace projects: client visibility and Parcel-specific project types.

alter table public.projects
  add column if not exists visibility text not null default 'internal';

alter table public.projects
  drop constraint if exists projects_visibility_check;

alter table public.projects
  add constraint projects_visibility_check
  check (visibility in ('internal', 'portal_visible'));

alter table public.projects
  drop constraint if exists projects_project_type_check;

alter table public.projects
  add constraint projects_project_type_check
  check (project_type in (
    'furnishing',
    'renovation',
    'onboarding',
    'vendor_work',
    'launch_prep',
    'internal',
    'idea',
    'feature_build',
    'employee_onboarding',
    'cleaner_onboarding',
    'vendor_onboarding'
  ));

create index if not exists projects_visibility_idx
  on public.projects (visibility)
  where status <> 'archived';

insert into saved_views (entity_type, key, name, is_shared, sort_order, filter_jsonb, sort, view_mode)
values
  ('project','furnishing','Furnishing',true,22,'{"types":["furnishing"]}','recent_activity','compact'),
  ('project','renovations','Renovations',true,24,'{"types":["renovation"]}','recent_activity','compact'),
  ('project','launch-prep','Launch Prep',true,26,'{"types":["launch_prep"]}','recent_activity','compact'),
  ('project','portal-visible','Visible in Portal',true,28,'{"visibility":["portal_visible"],"exclude_status":["archived"]}','recent_activity','compact')
on conflict (entity_type, key, coalesce(owner_user_id::text, 'SHARED')) do nothing;
