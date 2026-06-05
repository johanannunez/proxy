-- =====================================================================
-- Parcel — Communication Suite (Phase 3): message templates
-- =====================================================================
-- Reusable, variable-driven message templates for the workspace
-- Communication composer. Admin-managed.
-- =====================================================================

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null default 'any' check (channel in ('email', 'sms', 'any')),
  subject text,
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.message_templates is
  'Reusable message templates with {{variable}} placeholders for the Communication composer.';

create index if not exists idx_message_templates_created_at
  on public.message_templates(created_at desc);

alter table public.message_templates enable row level security;

drop policy if exists "Admins full access templates" on public.message_templates;
create policy "Admins full access templates"
  on public.message_templates for all
  using (public.is_admin());
