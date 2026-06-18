-- supabase/migrations/20260615000001_decision_authority_fixes.sql
-- Fixes for decision_authority migration:
--   1. Admin policies corrected to use is_org_admin (not is_org_member)
--   2. assigned_owner_id FK gets explicit on delete restrict
--   3. Index on docuseal_submission_id added

-- Fix admin policies to use is_org_admin instead of is_org_member
drop policy if exists "Admins full access to workspace_authority" on public.workspace_authority;
create policy "Admins full access to workspace_authority"
  on public.workspace_authority for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

drop policy if exists "Admins full access to workspace_authority_domains" on public.workspace_authority_domains;
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

drop policy if exists "Admins full access to workspace_authority_escalation" on public.workspace_authority_escalation;
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

-- Fix assigned_owner_id FK to have explicit on delete restrict
alter table public.workspace_authority_domains
  drop constraint workspace_authority_domains_assigned_owner_id_fkey,
  add constraint workspace_authority_domains_assigned_owner_id_fkey
    foreign key (assigned_owner_id) references public.profiles(id) on delete restrict;

-- Add index on docuseal_submission_id
create unique index if not exists idx_workspace_authority_submission_id
  on public.workspace_authority (docuseal_submission_id)
  where docuseal_submission_id is not null;
