-- ─────────────────────────────────────────────────────────────────────────────
-- M3 groundwork: agency-operating MRR reconciliation
--
-- "MRR" inside Proxy is NOT one number. There are three distinct layers, and a
-- super-admin dashboard that conflates them would mislead:
--
--   1. Platform SaaS MRR (agencies -> Proxy): what subscriber agencies pay
--      Proxy for the platform. Lives on public.agencies (plan_tier,
--      stripe_subscription_id). There is no recurring-amount column in the DB
--      today, so this layer is NOT computed here — it must be derived from the
--      Stripe subscription (or a plan->price map) when the platform-billing
--      surface is built. This is the headline number Johan cares about for the
--      business, and it is ~$0 today (the founding agency is comped).
--
--   2. Agency operating MRR — NEW system (owners -> agency, via the workspace
--      billing engine): public.billing_schedules + billing_schedule_lines.
--
--   3. Agency operating MRR — LEGACY system (owners -> agency, older Parcel
--      owner subscriptions): public.subscriptions.
--
-- This view reconciles layers 2 + 3 = AGENCY OPERATING revenue (what agencies
-- bill their owners), which is the "merge legacy subscriptions + new
-- billing_schedules" the program called for. It is deliberately NOT labelled
-- "platform MRR". The super-admin tile naming is finalized during the M3 design
-- pass; this view is the data plumbing under it.
--
-- DEDUP RULE: a single workspace can simultaneously carry a legacy
-- subscriptions row AND an active billing_schedule (there is no shared key
-- between the two systems). Per workspace we PREFER the new schedule when one
-- exists and fall back to the legacy subscription otherwise — the new billing
-- engine supersedes the legacy owner subscription.
--
-- ATTRIBUTION GAP (made visible, not hidden): legacy subscriptions are mapped
-- to a workspace via owner -> profiles.workspace_id. A legacy sub whose owner
-- has no workspace_id cannot enter the per-workspace reconciliation. To avoid
-- silently dropping that revenue, legacy_mrr_agency_total_cents reports ALL
-- active legacy MRR for the agency mapped via profiles.agency_id (NOT NULL), so
-- (legacy_mrr_agency_total_cents - legacy_mrr_cents) exposes any legacy revenue
-- not yet attributable to a workspace.
--
-- All amounts are normalized to a MONTHLY figure in cents. Access is locked to
-- the service role: the underlying tables are RLS-protected and this view spans
-- every agency, so only the super-admin (service-client) context may read it.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.platform_agency_operating_mrr as
with
-- New system: monthly MRR per workspace from ACTIVE billing schedules.
schedule_workspace_mrr as (
  select
    bs.workspace_id,
    sum(
      line_totals.line_total_cents
      / case bs.interval
          when 'week'    then (12.0 / 52.0) * bs.interval_count
          when 'month'   then 1.0 * bs.interval_count
          when 'quarter' then 3.0 * bs.interval_count
          when 'year'    then 12.0 * bs.interval_count
        end
    ) as monthly_cents
  from public.billing_schedules bs
  join lateral (
    select coalesce(
      sum(l.quantity * l.unit_price_cents - l.discount_cents),
      0
    ) as line_total_cents
    from public.billing_schedule_lines l
    where l.schedule_id = bs.id and l.active = true
  ) line_totals on true
  where bs.status = 'active'
  group by bs.workspace_id
),
-- Legacy system, per workspace (for the dedup): ACTIVE/TRIALING owner
-- subscriptions mapped owner -> profiles.workspace_id.
legacy_workspace_mrr as (
  select
    p.workspace_id,
    sum(
      s.price_cents
      / case s.interval
          when 'day'   then (12.0 / 365.0)
          when 'week'  then (12.0 / 52.0)
          when 'month' then 1.0
          when 'year'  then 12.0
          else 1.0
        end
    ) as monthly_cents
  from public.subscriptions s
  join public.profiles p on p.id = s.owner_id
  where s.status in ('active', 'trialing')
    and p.workspace_id is not null
  group by p.workspace_id
),
-- Legacy system, per agency (the honest total): ACTIVE/TRIALING owner
-- subscriptions mapped owner -> profiles.agency_id (NOT NULL), so this captures
-- subs whose owner has no workspace_id too.
legacy_agency_mrr as (
  select
    p.agency_id,
    sum(
      s.price_cents
      / case s.interval
          when 'day'   then (12.0 / 365.0)
          when 'week'  then (12.0 / 52.0)
          when 'month' then 1.0
          when 'year'  then 12.0
          else 1.0
        end
    ) as monthly_cents
  from public.subscriptions s
  join public.profiles p on p.id = s.owner_id
  where s.status in ('active', 'trialing')
  group by p.agency_id
),
-- Reconcile per workspace: prefer the new schedule MRR when present.
workspace_reconciled as (
  select
    coalesce(sw.workspace_id, lw.workspace_id) as workspace_id,
    coalesce(sw.monthly_cents, 0) as schedule_monthly_cents,
    coalesce(lw.monthly_cents, 0) as legacy_monthly_cents,
    case
      when sw.workspace_id is not null then sw.monthly_cents
      else lw.monthly_cents
    end as reconciled_monthly_cents
  from schedule_workspace_mrr sw
  full outer join legacy_workspace_mrr lw
    on lw.workspace_id = sw.workspace_id
),
-- Roll the per-workspace reconciliation up to the agency (join workspaces here,
-- before joining the per-agency legacy total, to avoid fan-out).
agency_rollup as (
  select
    w.agency_id,
    sum(wr.reconciled_monthly_cents) as reconciled_monthly_cents,
    sum(wr.schedule_monthly_cents) as schedule_monthly_cents,
    sum(wr.legacy_monthly_cents) as legacy_monthly_cents,
    count(wr.workspace_id) as billing_workspace_count
  from public.workspaces w
  join workspace_reconciled wr on wr.workspace_id = w.id
  group by w.agency_id
)
select
  a.id   as agency_id,
  a.name as agency_name,
  a.plan_tier,
  round(coalesce(ar.reconciled_monthly_cents, 0))::bigint as reconciled_mrr_cents,
  round(coalesce(ar.schedule_monthly_cents, 0))::bigint   as schedule_mrr_cents,
  round(coalesce(ar.legacy_monthly_cents, 0))::bigint     as legacy_mrr_cents,
  round(coalesce(la.monthly_cents, 0))::bigint            as legacy_mrr_agency_total_cents,
  coalesce(ar.billing_workspace_count, 0)                 as billing_workspace_count
from public.agencies a
left join agency_rollup ar on ar.agency_id = a.id
left join legacy_agency_mrr la on la.agency_id = a.id
order by reconciled_mrr_cents desc;

comment on view public.platform_agency_operating_mrr is
  'M3 super-admin groundwork. Per-agency monthly recurring revenue that agencies bill their OWNERS, reconciling the new billing_schedules engine with legacy owner subscriptions (schedule preferred per workspace when both exist). legacy_mrr_agency_total_cents exposes legacy revenue not yet attributable to a workspace. NOT platform SaaS MRR (agencies paying Proxy), which is a separate metric derived from Stripe/plan_tier. Read via the service client only.';

-- Lock down: only the service-role (super-admin context) may read platform-wide MRR.
revoke all on public.platform_agency_operating_mrr from anon, authenticated;
grant select on public.platform_agency_operating_mrr to service_role;
