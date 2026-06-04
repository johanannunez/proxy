-- =====================================================================
-- Parcel — Communication Suite (Phase 1): multi-channel delivery
-- =====================================================================
-- Adds per-channel delivery tracking for messages sent from the
-- workspace Communication tab (portal / email / sms), an email
-- subject column on messages, and widens client_messages.channel to
-- support sms for prospect (non-owner) contacts.
--
-- Safe to run as a single block in the Supabase SQL editor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- messages.subject — email subject line for portal-backed messages
-- ---------------------------------------------------------------------
alter table public.messages
  add column if not exists subject text;


-- ---------------------------------------------------------------------
-- message_deliveries — one row per channel per message
-- ---------------------------------------------------------------------
create table if not exists public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  channel text not null check (channel in ('portal', 'email', 'sms')),
  status text not null default 'queued'
    check (status in ('queued', 'scheduled', 'sent', 'delivered', 'failed')),
  external_id text,                 -- Resend id / OpenPhone id
  error text,
  scheduled_at timestamptz,         -- when status = 'scheduled'
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.message_deliveries is
  'Per-channel delivery + receipt tracking for a message. One row per channel (portal/email/sms).';

create index if not exists idx_message_deliveries_message
  on public.message_deliveries(message_id);

-- Index for the Phase 3 scheduled-send cron sweep.
create index if not exists idx_message_deliveries_due
  on public.message_deliveries(scheduled_at)
  where status = 'scheduled';


-- ---------------------------------------------------------------------
-- RLS — admin only (deliveries are an internal operational record)
-- ---------------------------------------------------------------------
alter table public.message_deliveries enable row level security;

drop policy if exists "Admins full access deliveries" on public.message_deliveries;
create policy "Admins full access deliveries"
  on public.message_deliveries for all
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- client_messages.channel — allow 'sms' for prospect (non-owner) sends
-- (additive: existing 'in_app'/'email' rows remain valid)
-- ---------------------------------------------------------------------
alter table public.client_messages
  drop constraint if exists client_messages_channel_check;

alter table public.client_messages
  add constraint client_messages_channel_check
  check (channel in ('in_app', 'email', 'sms'));


-- ---------------------------------------------------------------------
-- Realtime — stream delivery status updates to the admin tab
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_deliveries'
  ) then
    alter publication supabase_realtime add table public.message_deliveries;
  end if;
end $$;
