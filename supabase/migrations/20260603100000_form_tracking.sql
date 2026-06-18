create table if not exists public.form_views (
  id          uuid         primary key default gen_random_uuid(),
  form_id     uuid         not null references public.forms(id) on delete cascade,
  viewed_at   timestamptz  not null default now(),
  ip_hash     text,
  user_agent  text
);

-- Index for fast per-form view count queries
create index if not exists form_views_form_id_idx on public.form_views (form_id);

alter table public.form_responses
  add column if not exists started_at   timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.form_views enable row level security;

create policy "Service role full access on form_views"
  on public.form_views for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
