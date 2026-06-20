-- ─────────────────────────────────────────────────────────────────────────────
-- M3 super-admin groundwork: agencies directory rollup.
--
-- One row per agency with everything the Platform Console's Agencies directory
-- needs: plan, billing flag, workspace/member/owner/property counts, reconciled
-- agency-operating MRR (from platform_agency_operating_mrr), and a last-activity
-- timestamp. Aggregating here keeps the app's data layer a single SELECT and
-- avoids N+1 count queries per agency.
--
-- Service-role-only: spans every agency over RLS-protected tables, so only the
-- super-admin (service-client) context may read it.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.platform_agencies_overview as
select
  a.id,
  a.name,
  a.slug,
  a.plan_tier,
  a.created_at,
  (a.stripe_subscription_id is not null) as has_billing,
  coalesce(ws.workspace_count, 0)  as workspace_count,
  coalesce(mem.member_count, 0)    as member_count,
  coalesce(mem.owner_count, 0)     as owner_count,
  coalesce(prop.property_count, 0) as property_count,
  coalesce(mrr.reconciled_mrr_cents, 0) as mrr_cents,
  greatest(a.updated_at, coalesce(act.last_activity_at, a.created_at)) as last_active_at
from public.agencies a
left join (
  select agency_id, count(*) as workspace_count
  from public.workspaces group by agency_id
) ws on ws.agency_id = a.id
left join (
  select agency_id,
    count(*) as member_count,
    count(*) filter (where role = 'owner') as owner_count
  from public.profiles group by agency_id
) mem on mem.agency_id = a.id
left join (
  select p.agency_id, count(pr.id) as property_count
  from public.properties pr
  join public.profiles p on p.id = pr.owner_id
  group by p.agency_id
) prop on prop.agency_id = a.id
left join public.platform_agency_operating_mrr mrr on mrr.agency_id = a.id
left join (
  select agency_id, max(created_at) as last_activity_at
  from public.activity_log group by agency_id
) act on act.agency_id = a.id
order by mrr_cents desc, workspace_count desc, a.created_at asc;

comment on view public.platform_agencies_overview is
  'M3 super-admin groundwork. One row per agency for the Platform Console directory: plan, billing flag, workspace/member/owner/property counts, reconciled agency-operating MRR, and last-activity. Read via the service client only.';

revoke all on public.platform_agencies_overview from anon, authenticated;
grant select on public.platform_agencies_overview to service_role;
