-- Workstream A3: automated document reminder sequences.
-- document_reminders logs every reminder dispatched per document (round 1-3).
-- document_reminder_config holds the per-org, per-document-key cadence.
--
-- Deviations from the plan sketch, grounded in the live schema:
--   * RLS enabled on both tables (plan sketch omitted it; repo standard is
--     service-role-full-access plus org-scoped read, see organization_branding).
--   * Seed covers ALL live document keys, not just the 8 listed in the plan
--     ("covering all document keys" is the stated intent). Keys are sourced
--     from the documents spine at migration time plus the plan's explicit list.

create table if not exists document_reminders (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  channel     text not null check (channel in ('email', 'sms', 'message')),
  round       int not null check (round between 1 and 3),
  delivered   boolean not null default false
);

create index if not exists idx_doc_reminders_document on document_reminders (document_id);

create table if not exists document_reminder_config (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  document_key    text not null,
  round_1_days    int not null default 3,
  round_2_days    int not null default 7,
  round_3_days    int not null default 14,
  channels        text[] not null default '{email}',
  unique (org_id, document_key)
);

-- RLS: crons run as service_role; org admins manage cadence; members can read it.
alter table document_reminders enable row level security;

create policy "service role full access"
  on document_reminders for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "org admins can read reminder log"
  on document_reminders for select
  using (public.is_org_admin(public.current_org_id()));

alter table document_reminder_config enable row level security;

create policy "service role full access"
  on document_reminder_config for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "org admins can manage reminder config"
  on document_reminder_config for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy "org members can read reminder config"
  on document_reminder_config for select
  using (public.is_org_member(org_id));

-- Seed default config for the Proxy org covering all document keys:
-- the plan's canonical list unioned with every key live on the documents spine.
insert into document_reminder_config (org_id, document_key, round_1_days, round_2_days, round_3_days)
select
  '00000000-0000-0000-0000-000000000001',
  k.document_key,
  3, 7, 14
from (
  select unnest(array[
    'host_rental_agreement', 'ach_authorization', 'card_authorization',
    'w9', 'identity', 'property_setup', 'wifi_info', 'guidebook'
  ]) as document_key
  union
  select distinct document_key from documents where document_key is not null
) k
on conflict do nothing;
