-- Sub-phase B1: organization_branding table (white-label branding per org).
-- Added set_updated_at trigger (table has updated_at; shared trigger function
-- is the codebase convention).

create table if not exists organization_branding (
  org_id              uuid primary key references organizations(id) on delete cascade,
  logo_url            text,
  favicon_url         text,
  primary_color       text not null default '#0F172A',
  accent_color        text not null default '#6366F1',
  font_heading        text not null default 'Inter',
  font_body           text not null default 'Inter',
  custom_domain       text unique,
  email_sender_name   text,
  email_sender_domain text,
  powered_by_proxy    boolean not null default true,
  updated_at          timestamptz not null default now()
);

drop trigger if exists set_updated_at on organization_branding;
create trigger set_updated_at
  before update on organization_branding
  for each row
  execute function public.set_updated_at();

alter table organization_branding enable row level security;

create policy "org members can read branding"
  on organization_branding for select
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_branding.org_id
        and om.profile_id = auth.uid()
    )
  );

-- Public read for client portal (branding must be visible to unauthenticated clients)
create policy "public can read branding"
  on organization_branding for select
  using (true);

create policy "service role full access"
  on organization_branding for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
