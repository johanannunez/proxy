-- Admin action queue: one function that surfaces every document needing admin
-- attention, ranked by urgency. Powers the "Needs Action" tab in /admin/paperwork.
--
-- Security: SECURITY DEFINER so it can read across owners, gated to admins via
-- an explicit profiles.role check (callable by any authenticated user otherwise).
-- Only signature/catalog rows are considered (form_key is null) and waived
-- documents never need action.

create or replace function fetch_admin_action_queue()
returns table (
  id                 text,
  kind               text,
  owner_id           uuid,
  owner_name         text,
  owner_avatar_url   text,
  document_id        uuid,
  document_title     text,
  document_key       text,
  days_waiting       int,
  expires_at         date,
  primary_action     text,
  urgency            text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select p.role::text from public.profiles p where p.id = auth.uid()) is distinct from 'admin' then
    return;
  end if;

  return query
  select * from (
    -- Declined signatures / action required
    select
      concat('declined-', d.id) as id,
      'declined_signature' as kind,
      d.owner_id,
      p.full_name as owner_name,
      p.avatar_url as owner_avatar_url,
      d.id as document_id,
      d.title as document_title,
      d.document_key,
      extract(day from now() - d.updated_at)::int as days_waiting,
      d.expires_at,
      'resend' as primary_action,
      'high' as urgency
    from documents d
    join profiles p on p.id = d.owner_id
    where d.status = 'action_required'
      and d.form_key is null
      and coalesce(d.waived, false) = false

    union all

    -- Stuck in under_review > 3 days
    select
      concat('review-', d.id),
      'stuck_review',
      d.owner_id,
      p.full_name,
      p.avatar_url,
      d.id,
      d.title,
      d.document_key,
      extract(day from now() - d.updated_at)::int,
      d.expires_at,
      'review',
      case when extract(day from now() - d.updated_at) > 7 then 'high' else 'medium' end
    from documents d
    join profiles p on p.id = d.owner_id
    where d.status = 'under_review'
      and d.updated_at < now() - interval '3 days'
      and d.form_key is null
      and coalesce(d.waived, false) = false

    union all

    -- Expiring within 30 days
    select
      concat('expiring-', d.id),
      'expiring_document',
      d.owner_id,
      p.full_name,
      p.avatar_url,
      d.id,
      d.title,
      d.document_key,
      0,
      d.expires_at,
      'remind',
      case when d.expires_at <= current_date + 7 then 'high' else 'medium' end
    from documents d
    join profiles p on p.id = d.owner_id
    where d.status in ('on_file', 'expiring')
      and d.expires_at is not null
      and d.expires_at <= current_date + 30
      and d.form_key is null
      and coalesce(d.waived, false) = false

    union all

    -- Pending countersignature
    select
      concat('countersign-', d.id),
      'pending_countersignature',
      d.owner_id,
      p.full_name,
      p.avatar_url,
      d.id,
      d.title,
      d.document_key,
      extract(day from now() - d.updated_at)::int,
      d.expires_at,
      'countersign',
      'high'
    from documents d
    join profiles p on p.id = d.owner_id
    where d.status = 'awaiting_countersignature'
      and d.form_key is null
      and coalesce(d.waived, false) = false

    union all

    -- Unsigned past 7 days
    select
      concat('overdue-', d.id),
      'overdue_unsigned',
      d.owner_id,
      p.full_name,
      p.avatar_url,
      d.id,
      d.title,
      d.document_key,
      extract(day from now() - d.created_at)::int,
      d.expires_at,
      'remind',
      case when extract(day from now() - d.created_at) > 14 then 'high' else 'medium' end
    from documents d
    join profiles p on p.id = d.owner_id
    where d.status = 'sent'
      and d.created_at < now() - interval '7 days'
      and d.form_key is null
      and coalesce(d.waived, false) = false
  ) q
  order by
    case q.urgency when 'high' then 1 when 'medium' then 2 else 3 end,
    q.days_waiting desc;
end;
$$;

revoke execute on function fetch_admin_action_queue() from anon;
grant execute on function fetch_admin_action_queue() to authenticated;
