-- Workstream A3: find_reminder_candidates() — the daily reminder cron asks
-- Postgres which documents are due for their next reminder round.
--
-- A document is a candidate when:
--   * it is incomplete (status not on_file/expired/expiring/waived/declined,
--     and not waived via the boolean flag),
--   * it is a catalog document (document_key is set; raw form rows are exempt),
--   * fewer than 3 reminder rounds have been logged for it,
--   * its created_at is older than the configured day threshold for the next round,
--   * the owner has an email on file (reminders are email-first).
--
-- Deviations from the plan sketch, grounded in the live schema:
--   * org_id returns the config row's uuid instead of a hardcoded text literal
--     (documents are single-org today; the config join pins the Proxy org).
--   * also excludes status 'expiring' and waived = true — expiring documents
--     get renewal requests from the expiry workflow, not nag reminders, and
--     `waived` is a boolean column on documents, not a status value.
--   * search_path pinned (security definer hygiene, repo convention).

create or replace function public.find_reminder_candidates()
returns table (
  document_id    uuid,
  owner_id       uuid,
  owner_email    text,
  owner_name     text,
  document_key   text,
  document_title text,
  workspace_id   uuid,
  org_id         uuid,
  round          int,
  config_days    int
)
language sql
security definer
set search_path = public
as $$
  with reminder_status as (
    select
      d.id as doc_id,
      d.owner_id as doc_owner_id,
      d.document_key as doc_key,
      d.title as doc_title,
      d.workspace_id as doc_workspace_id,
      d.created_at as doc_created_at,
      -- Highest reminder round already sent (0 = none yet)
      coalesce(max(dr.round), 0) as last_round_sent
    from documents d
    left join document_reminders dr on dr.document_id = d.id
    where d.status not in ('on_file', 'expired', 'expiring', 'waived', 'declined')
      and d.waived = false
      and d.document_key is not null
    group by d.id
  ),
  next_round as (
    select
      rs.*,
      rs.last_round_sent + 1 as upcoming_round,
      drc.org_id as config_org_id,
      drc.round_1_days,
      drc.round_2_days,
      drc.round_3_days
    from reminder_status rs
    join document_reminder_config drc
      on drc.document_key = rs.doc_key
     and drc.org_id = '00000000-0000-0000-0000-000000000001'::uuid
    where rs.last_round_sent < 3
  )
  select
    nr.doc_id,
    nr.doc_owner_id,
    p.email,
    p.full_name,
    nr.doc_key,
    nr.doc_title,
    nr.doc_workspace_id,
    nr.config_org_id,
    nr.upcoming_round,
    case nr.upcoming_round
      when 1 then nr.round_1_days
      when 2 then nr.round_2_days
      when 3 then nr.round_3_days
    end as config_days
  from next_round nr
  join profiles p on p.id = nr.doc_owner_id
  where p.email is not null
    -- Fire once created_at is older than the configured days for this round
    and nr.doc_created_at <= now() - (
      case nr.upcoming_round
        when 1 then nr.round_1_days
        when 2 then nr.round_2_days
        when 3 then nr.round_3_days
      end || ' days'
    )::interval
$$;

-- The cron uses the service role; nothing else should call this directly.
revoke execute on function public.find_reminder_candidates() from public, anon, authenticated;
grant execute on function public.find_reminder_candidates() to service_role;
