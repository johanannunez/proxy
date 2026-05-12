-- Tax data foundation.
--
-- Lays the schema-level groundwork for the W-9 collection flow
-- (tasks 1.9, 2.5). Specifically:
--   1. Adds a `compliance` role to the user_role enum so non-admin
--      tax personnel can review W-9 submissions without getting full
--      admin access.
--   2. Adds `public.tax_profiles`: one row per owner holding the
--      structured W-9 payload. SSN and EIN are stored as bytea and
--      encrypted with TAX_ENCRYPTION_KEY by apps/web/src/lib/tax/
--      encryption.ts.
--   3. Adds `public.w9_access_log`: an immutable audit trail of every
--      signed-URL generation against a W-9 document. Required for the
--      compliance posture documented in apps/web/docs/security.md
--      (delivered in task 1.9).
--   4. Provisions a private `documents` storage bucket with
--      folder-per-owner RLS so signed URLs are the only access path.
--   5. Adds a small `public.is_compliance_or_admin()` helper that
--      gates the audit-log and admin-read policies on the new tables
--      and bucket.

-- ---------------------------------------------------------------------
-- 1. user_role enum: add `compliance`.
-- ---------------------------------------------------------------------
-- Postgres blocks reads of a newly added enum value within the
-- transaction that added it. Run this on its own so the rest of the
-- migration (which casts to `'compliance'::user_role`) can see it.

alter type public.user_role add value if not exists 'compliance';

-- ---------------------------------------------------------------------
-- 2. Everything else, in one transaction.
-- ---------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------
-- 2a. is_compliance_or_admin() helper.
-- ---------------------------------------------------------------------

create or replace function public.is_compliance_or_admin()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin'::public.user_role, 'compliance'::public.user_role)
  );
end;
$function$;

revoke execute on function public.is_compliance_or_admin() from public, anon;
grant execute on function public.is_compliance_or_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 2b. tax_profiles.
-- ---------------------------------------------------------------------

create table if not exists public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  legal_name text,
  business_name text,
  -- W-9 box 3 federal tax classification. Free text rather than enum so
  -- the IRS adding a new classification does not require a migration.
  tax_classification text,
  ssn_encrypted bytea,
  ein_encrypted bytea,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  signature_date date,
  status text not null default 'incomplete'
    check (status in ('incomplete', 'submitted', 'verified', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tax_profiles_status_idx on public.tax_profiles (status);
create index if not exists tax_profiles_reviewed_by_idx
  on public.tax_profiles (reviewed_by) where reviewed_by is not null;

alter table public.tax_profiles enable row level security;

drop policy if exists "tax_profiles: owner read own" on public.tax_profiles;
create policy "tax_profiles: owner read own" on public.tax_profiles
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "tax_profiles: owner upsert own" on public.tax_profiles;
create policy "tax_profiles: owner upsert own" on public.tax_profiles
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "tax_profiles: owner update own (before verification)"
  on public.tax_profiles;
create policy "tax_profiles: owner update own (before verification)"
  on public.tax_profiles
  for update to authenticated
  using (owner_id = auth.uid() and status in ('incomplete', 'rejected'))
  with check (owner_id = auth.uid() and status in ('incomplete', 'submitted'));

drop policy if exists "tax_profiles: compliance or admin all" on public.tax_profiles;
create policy "tax_profiles: compliance or admin all" on public.tax_profiles
  for all to authenticated
  using (public.is_compliance_or_admin())
  with check (public.is_compliance_or_admin());

-- ---------------------------------------------------------------------
-- 2c. w9_access_log.
-- ---------------------------------------------------------------------

create table if not exists public.w9_access_log (
  id uuid primary key default gen_random_uuid(),
  -- Either references a signed_documents row (BoldSign-signed W-9) or
  -- a raw storage path in the documents bucket. At least one is required.
  document_id uuid references public.signed_documents(id) on delete set null,
  storage_path text,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  accessed_at timestamptz not null default now(),
  signed_url_expires_at timestamptz not null,
  reason text,
  user_agent text,
  ip_address inet,
  check (document_id is not null or storage_path is not null)
);

create index if not exists w9_access_log_profile_idx
  on public.w9_access_log (profile_id, accessed_at desc);
create index if not exists w9_access_log_document_idx
  on public.w9_access_log (document_id) where document_id is not null;
create index if not exists w9_access_log_storage_path_idx
  on public.w9_access_log (storage_path) where storage_path is not null;

alter table public.w9_access_log enable row level security;

-- Reads: only compliance or admin can see the audit trail.
drop policy if exists "w9_access_log: compliance or admin read" on public.w9_access_log;
create policy "w9_access_log: compliance or admin read" on public.w9_access_log
  for select to authenticated
  using (public.is_compliance_or_admin());

-- Inserts: only compliance, admin, or the owner reading their own W-9
-- can record an access event. Most writes happen via the service role
-- (server actions generating signed URLs), but the policy also covers
-- the case where an admin views a W-9 through an RLS-enforced client.
drop policy if exists "w9_access_log: compliance admin or self insert"
  on public.w9_access_log;
create policy "w9_access_log: compliance admin or self insert"
  on public.w9_access_log
  for insert to authenticated
  with check (
    public.is_compliance_or_admin()
    or profile_id = auth.uid()
  );

-- No update / delete policies. The audit log is append-only.

-- ---------------------------------------------------------------------
-- 2d. Private `documents` storage bucket.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object names use `<owner_uuid>/<path>` so the first path segment is
-- the owner. Owners can read and write their own folder; compliance
-- and admins can read and write everything.

drop policy if exists "documents bucket: owner read own" on storage.objects;
create policy "documents bucket: owner read own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "documents bucket: owner write own" on storage.objects;
create policy "documents bucket: owner write own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "documents bucket: owner update own" on storage.objects;
create policy "documents bucket: owner update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "documents bucket: owner delete own" on storage.objects;
create policy "documents bucket: owner delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "documents bucket: compliance or admin all" on storage.objects;
create policy "documents bucket: compliance or admin all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and public.is_compliance_or_admin()
  )
  with check (
    bucket_id = 'documents'
    and public.is_compliance_or_admin()
  );

commit;
