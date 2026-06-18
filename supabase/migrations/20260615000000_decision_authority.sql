-- supabase/migrations/20260615000000_decision_authority.sql
-- Decision Authority Addendum: governance config, domain assignments, and escalation routing.

-- workspace_authority: one governance config per workspace.
-- Only one record per workspace can be 'active' at a time (unique partial index).
create table if not exists public.workspace_authority (
  id                     uuid        primary key default gen_random_uuid(),
  workspace_id           uuid        not null references public.workspaces(id) on delete cascade,
  org_id                 uuid        not null references public.organizations(id) on delete cascade,
  governance_mode        text        not null check (governance_mode in ('workspace', 'per_property')),
  status                 text        not null default 'draft'
                                     check (status in ('draft', 'pending_signatures', 'active', 'superseded')),
  docuseal_submission_id text        null,
  signed_at              timestamptz null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create unique index if not exists idx_workspace_authority_one_active
  on public.workspace_authority (workspace_id)
  where status = 'active';

create index if not exists idx_workspace_authority_workspace
  on public.workspace_authority (workspace_id);

create unique index if not exists idx_workspace_authority_submission_id
  on public.workspace_authority (docuseal_submission_id)
  where docuseal_submission_id is not null;

drop trigger if exists set_workspace_authority_updated_at on public.workspace_authority;
create trigger set_workspace_authority_updated_at
  before update on public.workspace_authority
  for each row execute function public.set_updated_at();

-- workspace_authority_domains: maps a decision domain to one owner per authority record.
-- property_id is null for workspace-wide governance_mode, populated for per_property mode.
-- NULL-safe uniqueness:
--   The standard table-level unique constraint treats NULLs as distinct, so two workspace-wide
--   rows with the same (authority_id, domain) and property_id IS NULL would not conflict.
--   We handle this with two partial unique indexes instead of a table-level constraint.
create table if not exists public.workspace_authority_domains (
  id                uuid        primary key default gen_random_uuid(),
  authority_id      uuid        not null references public.workspace_authority(id) on delete cascade,
  property_id       uuid        null references public.properties(id) on delete cascade,
  domain            text        not null check (domain in ('documents_legal', 'finances_payouts', 'operations_maintenance')),
  assigned_owner_id uuid        not null references public.profiles(id) on delete restrict, -- profile IDs; restrict prevents deleting a profile that owns an authority domain
  created_at        timestamptz not null default now()
);

-- Per-property uniqueness (property_id IS NOT NULL).
create unique index if not exists idx_authority_domains_per_property
  on public.workspace_authority_domains (authority_id, property_id, domain)
  where property_id is not null;

-- Workspace-wide uniqueness (property_id IS NULL).
create unique index if not exists idx_authority_domains_workspace_wide
  on public.workspace_authority_domains (authority_id, domain)
  where property_id is null;

create index if not exists idx_authority_domains_authority
  on public.workspace_authority_domains (authority_id);

-- workspace_authority_escalation: guest escalation routing.
-- notify_owner_ids can contain one or both owner profile IDs.
-- Same NULL-safe pattern: two partial unique indexes for property-scoped vs workspace-wide rows.
create table if not exists public.workspace_authority_escalation (
  id                uuid        primary key default gen_random_uuid(),
  authority_id      uuid        not null references public.workspace_authority(id) on delete cascade,
  property_id       uuid        null references public.properties(id) on delete cascade,
  notify_owner_ids  uuid[]      not null default '{}', -- profile IDs; no FK (Postgres does not support array-element FKs)
  created_at        timestamptz not null default now()
);

create unique index if not exists idx_authority_escalation_per_property
  on public.workspace_authority_escalation (authority_id, property_id)
  where property_id is not null;

create unique index if not exists idx_authority_escalation_workspace_wide
  on public.workspace_authority_escalation (authority_id)
  where property_id is null;

create index if not exists idx_authority_escalation_authority
  on public.workspace_authority_escalation (authority_id);

-- RLS --

alter table public.workspace_authority enable row level security;
alter table public.workspace_authority_domains enable row level security;
alter table public.workspace_authority_escalation enable row level security;

-- v1 trust model: workspace members fully trust each other with their own governance record;
-- status = 'active' transitions are controlled in application code, not RLS.
create policy "Workspace members can manage workspace_authority"
  on public.workspace_authority for all
  using (
    exists (
      select 1 from public.profiles p
      where p.workspace_id = workspace_authority.workspace_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.workspace_id = workspace_authority.workspace_id
        and p.id = auth.uid()
    )
  );

create policy "Admins full access to workspace_authority"
  on public.workspace_authority for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- workspace_authority_domains: same pattern via join to workspace_authority.
create policy "Workspace members can manage authority domains"
  on public.workspace_authority_domains for all
  using (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_domains.authority_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_domains.authority_id
        and p.id = auth.uid()
    )
  );

create policy "Admins full access to workspace_authority_domains"
  on public.workspace_authority_domains for all
  using (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_domains.authority_id
        and public.is_org_admin(wa.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_domains.authority_id
        and public.is_org_admin(wa.org_id)
    )
  );

-- workspace_authority_escalation: same pattern.
create policy "Workspace members can manage escalation routing"
  on public.workspace_authority_escalation for all
  using (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_escalation.authority_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_escalation.authority_id
        and p.id = auth.uid()
    )
  );

create policy "Admins full access to workspace_authority_escalation"
  on public.workspace_authority_escalation for all
  using (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_escalation.authority_id
        and public.is_org_admin(wa.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_escalation.authority_id
        and public.is_org_admin(wa.org_id)
    )
  );
