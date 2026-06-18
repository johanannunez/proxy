-- Sub-phase B1: organizations table (tenant root for the multi-tenant platform).
-- Note: the plan's stray `select public.set_updated_at();` was removed (trigger
-- functions cannot be invoked directly) and `for each row` added per convention.

create table if not exists organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique
                    check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  plan_tier       text not null default 'starter'
                    check (plan_tier in ('starter', 'pro', 'white_label')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists set_updated_at on organizations;
create trigger set_updated_at
  before update on organizations
  for each row
  execute function public.set_updated_at();

-- RLS
alter table organizations enable row level security;

-- The "org members can read their org" select policy lives in the
-- organization_members migration (20260610000002): it references
-- organization_members, which does not exist yet at this point.

create policy "service role full access"
  on organizations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
