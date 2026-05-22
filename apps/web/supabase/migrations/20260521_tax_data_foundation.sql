-- Tax data foundation: user_role enum extension, tax_profiles table,
-- w9_access_log table, and the is_compliance_or_admin() helper.
--
-- These tables were created directly in production; this file
-- documents that schema so Supabase CLI, local dev, and preview
-- branches all stay in sync. Every statement is idempotent.

-- 1. Extend the user_role enum with the compliance value.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'compliance';

-- 2. Helper function used by RLS policies on both tables.
CREATE OR REPLACE FUNCTION public.is_compliance_or_admin()
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO ''
AS $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin'::public.user_role, 'compliance'::public.user_role)
  );
end;
$$;

-- 3. Tax profiles — one row per owner, holds encrypted SSN/EIN and
-- the W-9 lifecycle status (incomplete → submitted → verified/rejected).
CREATE TABLE IF NOT EXISTS public.tax_profiles (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  legal_name        text,
  business_name     text,
  tax_classification text,
  ssn_encrypted     bytea,
  ein_encrypted     bytea,
  address_line1     text,
  address_line2     text,
  city              text,
  state             text,
  postal_code       text,
  country           text        NOT NULL DEFAULT 'US',
  signature_date    date,
  status            text        NOT NULL DEFAULT 'incomplete'
                    CHECK (status IN ('incomplete', 'submitted', 'verified', 'rejected')),
  rejection_reason  text,
  reviewed_by       uuid        REFERENCES public.profiles(id),
  reviewed_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_profiles_status_idx
  ON public.tax_profiles (status);

CREATE INDEX IF NOT EXISTS tax_profiles_reviewed_by_idx
  ON public.tax_profiles (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_profiles: owner upsert own" ON public.tax_profiles;
CREATE POLICY "tax_profiles: owner upsert own"
  ON public.tax_profiles FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "tax_profiles: owner read own" ON public.tax_profiles;
CREATE POLICY "tax_profiles: owner read own"
  ON public.tax_profiles FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "tax_profiles: owner update own (before verification)" ON public.tax_profiles;
CREATE POLICY "tax_profiles: owner update own (before verification)"
  ON public.tax_profiles FOR UPDATE
  USING (owner_id = auth.uid() AND status IN ('incomplete', 'rejected'));

DROP POLICY IF EXISTS "tax_profiles: compliance or admin all" ON public.tax_profiles;
CREATE POLICY "tax_profiles: compliance or admin all"
  ON public.tax_profiles FOR ALL
  USING (public.is_compliance_or_admin())
  WITH CHECK (public.is_compliance_or_admin());

-- 4. W-9 access log — append-only audit trail. Every signed URL
-- generated for a W-9 document must produce exactly one row here;
-- generateW9SignedUrl in w9-storage.ts fails closed if this insert
-- fails rather than silently leaking a signed URL.
CREATE TABLE IF NOT EXISTS public.w9_access_log (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           uuid        REFERENCES public.signed_documents(id),
  storage_path          text,
  profile_id            uuid        NOT NULL REFERENCES public.profiles(id),
  accessed_at           timestamptz NOT NULL DEFAULT now(),
  signed_url_expires_at timestamptz NOT NULL,
  reason                text,
  user_agent            text,
  ip_address            inet
);

CREATE INDEX IF NOT EXISTS w9_access_log_profile_idx
  ON public.w9_access_log (profile_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS w9_access_log_document_idx
  ON public.w9_access_log (document_id)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS w9_access_log_storage_path_idx
  ON public.w9_access_log (storage_path)
  WHERE storage_path IS NOT NULL;

ALTER TABLE public.w9_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "w9_access_log: compliance admin or self insert" ON public.w9_access_log;
CREATE POLICY "w9_access_log: compliance admin or self insert"
  ON public.w9_access_log FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    OR public.is_compliance_or_admin()
  );

DROP POLICY IF EXISTS "w9_access_log: compliance or admin read" ON public.w9_access_log;
CREATE POLICY "w9_access_log: compliance or admin read"
  ON public.w9_access_log FOR SELECT
  USING (public.is_compliance_or_admin());
