-- Platform Console: agency-operating MRR daily snapshots.
--
-- The platform_agency_operating_mrr view is point-in-time only — it has no history,
-- so the super-admin hero "MRR vs last period" delta and the MRR trend line have
-- nothing to diff against. This table is the one enabling piece: a daily cron
-- (/api/cron/platform-mrr-snapshot) appends one row per agency per UTC day from the
-- view, and the Platform Console reads the series for the delta + trend. Until two
-- snapshots exist the console renders an honest "tracking since {date}" state.
--
-- Service-role only, mirroring platform_agency_operating_mrr / platform_agencies_overview:
-- this is cross-agency platform data that no tenant (anon/authenticated) may read.

create table if not exists public.platform_mrr_snapshots (
  id                              uuid primary key default gen_random_uuid(),
  captured_date                   date not null default (now() at time zone 'utc')::date,
  agency_id                       uuid not null references public.agencies(id) on delete cascade,
  plan_tier                       text,
  reconciled_mrr_cents            bigint not null default 0,
  schedule_mrr_cents              bigint not null default 0,
  legacy_mrr_cents                bigint not null default 0,
  legacy_mrr_agency_total_cents   bigint not null default 0,
  billing_workspace_count         bigint not null default 0,
  created_at                      timestamptz not null default now(),
  unique (captured_date, agency_id)
);

create index if not exists platform_mrr_snapshots_captured_date_idx
  on public.platform_mrr_snapshots (captured_date);

-- The wall: lock to service_role exactly like the platform views.
alter table public.platform_mrr_snapshots enable row level security;

drop policy if exists platform_mrr_snapshots_service_role on public.platform_mrr_snapshots;
create policy platform_mrr_snapshots_service_role
  on public.platform_mrr_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.platform_mrr_snapshots from anon, authenticated;
grant select, insert, update on public.platform_mrr_snapshots to service_role;

-- Seed today's baseline so the trend has a first point from day one.
insert into public.platform_mrr_snapshots (
  captured_date, agency_id, plan_tier,
  reconciled_mrr_cents, schedule_mrr_cents, legacy_mrr_cents,
  legacy_mrr_agency_total_cents, billing_workspace_count
)
select
  (now() at time zone 'utc')::date,
  m.agency_id, m.plan_tier,
  m.reconciled_mrr_cents, m.schedule_mrr_cents, m.legacy_mrr_cents,
  m.legacy_mrr_agency_total_cents, m.billing_workspace_count
from public.platform_agency_operating_mrr m
on conflict (captured_date, agency_id) do nothing;
