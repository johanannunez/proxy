-- RLS hardening migration.
--
-- Closes the four gaps surfaced by the Supabase security advisor on
-- project pwoxwpryummqeqsxdgyc:
--   1. public.api_tokens had RLS disabled (ERROR-level finding).
--   2. Six policies named "Service role full access" / "Service role
--      inserts/updates documents" used USING(true)/WITH CHECK(true)
--      with role = {public}, which is a defense-in-depth gap (the
--      service_role bypasses RLS natively, so these policies grant
--      nothing the service role needs, but they expose the same
--      bypass to anon and authenticated).
--   3. owner_timeline had two overlapping SELECT policies. The older
--      one ("Owners can read their timeline") used just
--      `auth.uid() = owner_id` and bypassed the visibility +
--      soft-delete filters of the newer "Owners view own timeline".
--      A separate "Admins full access" ALL policy was granted to
--      {public} role, which is redundant with the four scoped
--      "Admins insert/update/delete/select" policies.
--   4. Seven SECURITY DEFINER functions were callable by the anon
--      role. Trigger-only functions are revoked from everyone;
--      app/RLS helpers keep authenticated; search_help_articles
--      stays anon-callable because the public marketing-site help
--      search relies on it.
--
-- Companion: apps/web/docs/rls-audit.md.

begin;

-- ---------------------------------------------------------------------
-- 1. api_tokens: enable RLS + add owner-scoped policies.
-- ---------------------------------------------------------------------

alter table public.api_tokens enable row level security;

drop policy if exists "api_tokens_self_select" on public.api_tokens;
create policy "api_tokens_self_select" on public.api_tokens
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "api_tokens_self_insert" on public.api_tokens;
create policy "api_tokens_self_insert" on public.api_tokens
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "api_tokens_self_delete" on public.api_tokens;
create policy "api_tokens_self_delete" on public.api_tokens
  for delete to authenticated
  using (profile_id = auth.uid());

-- No UPDATE policy on api_tokens. last_used_at is touched by the
-- CalDAV / quick-add handlers under the service role only.

-- ---------------------------------------------------------------------
-- 2. owner_timeline: drop the bypass and the redundant admin policy.
-- ---------------------------------------------------------------------

-- "Owners can read their timeline" used `auth.uid() = owner_id` only.
-- The newer "Owners view own timeline" adds the visibility + deleted_at
-- filter that the portal expects. Drop the loose one.
drop policy if exists "Owners can read their timeline" on public.owner_timeline;

-- "Admins full access to owner_timeline" was granted to {public} role.
-- The four scoped "Admins insert/update/delete timeline" policies, plus
-- the is_admin() OR clause inside "Owners view own timeline", cover
-- every admin path without exposing the table to anon.
drop policy if exists "Admins full access to owner_timeline" on public.owner_timeline;

-- ---------------------------------------------------------------------
-- 3. Drop USING(true)/WITH CHECK(true) policies on {public} role.
-- ---------------------------------------------------------------------

drop policy if exists "Service role full access" on public.changelogs;
drop policy if exists "Service role full access" on public.feedback_submissions;
drop policy if exists "Service role full access" on public.support_tickets;
drop policy if exists "Service role full access on balance snapshots"
  on public.treasury_balance_snapshots;
drop policy if exists "Service role inserts documents" on public.signed_documents;
drop policy if exists "Service role updates documents" on public.signed_documents;

-- changelogs, feedback_submissions, support_tickets, and
-- treasury_balance_snapshots are written only by code paths that use
-- createServiceClient() (apps/web/src/lib/{admin/changelogs.ts,
-- admin/support.ts, treasury/sync.ts}, apps/web/src/app/api/treasury/
-- balance-history/route.ts). Service role bypasses RLS, so no
-- replacement policy is required.

-- signed_documents IS written by RLS-enforced clients (owner portal at
-- apps/web/src/app/(portal)/portal/setup/host-agreement/page.tsx and
-- admin server actions at apps/web/src/app/(admin)/admin/documents/
-- document-actions.ts). Add explicit owner-self and admin policies to
-- replace the dropped USING(true) ones.

drop policy if exists "Owners insert own signed_documents" on public.signed_documents;
create policy "Owners insert own signed_documents" on public.signed_documents
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins write signed_documents" on public.signed_documents;
create policy "Admins write signed_documents" on public.signed_documents
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. SECURITY DEFINER function access tightening.
-- ---------------------------------------------------------------------

-- Trigger-only functions. The trigger machinery dispatches under the
-- table owner, so no user-level EXECUTE grant is needed.
revoke execute on function public.auto_create_entity_for_profile()
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;
revoke execute on function public.update_conversation_last_message()
  from public, anon, authenticated;

-- App-callable from authenticated context only.
revoke execute on function public.increment_message_read(uuid, uuid, text)
  from public, anon;
grant execute on function public.increment_message_read(uuid, uuid, text)
  to authenticated;

-- RLS-policy helpers. RLS policies evaluate these inline; authenticated
-- callers (i.e. the supabase-js auth client used by every server
-- component / server action) must keep EXECUTE.
revoke execute on function public.is_admin()
  from public, anon;
grant execute on function public.is_admin()
  to authenticated;

revoke execute on function public.user_owns_property(uuid)
  from public, anon;
grant execute on function public.user_owns_property(uuid)
  to authenticated;

-- search_help_articles(text, integer) is intentionally callable by anon
-- and authenticated. It powers the public marketing-site help search.
-- The wrapped data (help_articles, help_categories) has its own
-- public-read RLS policy, so anon already has access via PostgREST.
-- No change.

commit;
