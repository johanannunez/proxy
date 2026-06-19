-- Platform-staff namespace, separate from tenant roles on organization_members.
do $$ begin
  create type public.platform_role as enum ('superadmin','support','compliance','finance');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists platform_role public.platform_role;

-- The sole Superadmin (the founder / platform owner).
update public.profiles
  set platform_role = 'superadmin'
  where email = 'jo@johanannunez.com';

-- Carry over any existing platform compliance staff (today: zero rows).
update public.profiles
  set platform_role = 'compliance'
  where role = 'compliance' and platform_role is null;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'superadmin'
  );
$$;

-- Do not expose this helper to anonymous callers.
revoke execute on function public.is_superadmin() from anon, public;
grant execute on function public.is_superadmin() to authenticated;
