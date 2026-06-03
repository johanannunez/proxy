-- Web form builder: forms and responses tables.
-- org_id is a plain uuid (no FK) consistent with document_templates pattern.
-- Forms can be public (slug-based) or private (workspace-scoped).

create table if not exists public.forms (
  id          uuid         primary key default gen_random_uuid(),
  org_id      uuid         not null,
  name        text         not null,
  description text,
  schema      jsonb        not null default '{"version":1,"fields":[],"settings":{}}',
  is_public   boolean      not null default false,
  slug        text         unique,
  is_active   boolean      not null default false,
  created_by  uuid         references public.profiles(id) on delete set null,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

create table if not exists public.form_responses (
  id                     uuid         primary key default gen_random_uuid(),
  form_id                uuid         not null references public.forms(id) on delete cascade,
  respondent_profile_id  uuid         references public.profiles(id) on delete set null,
  property_id            uuid         references public.properties(id) on delete set null,
  data                   jsonb        not null default '{}',
  submitted_at           timestamptz  not null default now(),
  metadata               jsonb        default '{}'
);

-- Index for fast per-form response queries
create index if not exists form_responses_form_id_idx on public.form_responses (form_id);

-- updated_at trigger (shared function, do NOT create per-table function)
drop trigger if exists set_updated_at on public.forms;
create trigger set_updated_at
  before update on public.forms
  for each row execute function public.set_updated_at();

-- RLS
alter table public.forms enable row level security;
alter table public.form_responses enable row level security;

create policy "Service role full access on forms"
  on public.forms for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Authenticated users can read active public forms"
  on public.forms for select
  using (is_active = true and is_public = true);

create policy "Service role full access on form_responses"
  on public.form_responses for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
