create table if not exists public.owner_notification_preferences (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  portal_messages boolean not null default true,
  announcements boolean not null default true,
  account_alerts boolean not null default true,
  financial_documents boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.owner_notification_preferences is
  'Owner-controlled portal notification preferences.';

alter table public.owner_notification_preferences enable row level security;

drop policy if exists "Owners read own notification preferences" on public.owner_notification_preferences;
create policy "Owners read own notification preferences"
  on public.owner_notification_preferences for select
  using (owner_id = auth.uid());

drop policy if exists "Owners insert own notification preferences" on public.owner_notification_preferences;
create policy "Owners insert own notification preferences"
  on public.owner_notification_preferences for insert
  with check (owner_id = auth.uid());

drop policy if exists "Owners update own notification preferences" on public.owner_notification_preferences;
create policy "Owners update own notification preferences"
  on public.owner_notification_preferences for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Admins full access notification preferences" on public.owner_notification_preferences;
create policy "Admins full access notification preferences"
  on public.owner_notification_preferences for all
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists owner_notification_preferences_set_updated_at on public.owner_notification_preferences;
create trigger owner_notification_preferences_set_updated_at
  before update on public.owner_notification_preferences
  for each row
  execute function public.set_updated_at();
