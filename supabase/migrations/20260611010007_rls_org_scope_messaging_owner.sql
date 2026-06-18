-- B2.4 batch 4: org-scope messaging and owner-domain RLS.
-- is_admin() -> is_org_admin(org_id); owner conditions preserved verbatim.

-- conversations / messages / message_reads
drop policy if exists "Admins full access conversations" on public.conversations;
create policy "Admins full access conversations" on public.conversations
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "Admins full access messages" on public.messages;
create policy "Admins full access messages" on public.messages
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "Admins full access message_reads" on public.message_reads;
create policy "Admins full access message_reads" on public.message_reads
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- notifications / push_subscriptions / notification preferences
drop policy if exists "Admins full access notifications" on public.notifications;
create policy "Admins full access notifications" on public.notifications
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "Admins full access push_subscriptions" on public.push_subscriptions;
create policy "Admins full access push_subscriptions" on public.push_subscriptions
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "Admins full access notification preferences" on public.owner_notification_preferences;
create policy "Admins full access notification preferences" on public.owner_notification_preferences
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- session_log / activity_log
drop policy if exists "Admins full access session_log" on public.session_log;
create policy "Admins full access session_log" on public.session_log
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "activity_log_admin_read" on public.activity_log;
create policy "activity_log_admin_read" on public.activity_log
  for select to authenticated using (is_org_admin(org_id));

-- owner_facts
drop policy if exists "owner_facts_admin_read" on public.owner_facts;
create policy "owner_facts_admin_read" on public.owner_facts
  for select to authenticated using (is_org_admin(org_id));
drop policy if exists "owner_facts_admin_write" on public.owner_facts;
create policy "owner_facts_admin_write" on public.owner_facts
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- owner_timeline
drop policy if exists "Owners view own timeline" on public.owner_timeline;
create policy "Owners view own timeline" on public.owner_timeline
  for select to authenticated
  using (
    (owner_id = auth.uid() and visibility = 'owner'::timeline_visibility and deleted_at is null)
    or is_org_admin(org_id)
  );
drop policy if exists "Admins insert timeline" on public.owner_timeline;
create policy "Admins insert timeline" on public.owner_timeline
  for insert to authenticated with check (is_org_admin(org_id));
drop policy if exists "Admins update timeline" on public.owner_timeline;
create policy "Admins update timeline" on public.owner_timeline
  for update to authenticated
  using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "Admins delete timeline" on public.owner_timeline;
create policy "Admins delete timeline" on public.owner_timeline
  for delete to authenticated using (is_org_admin(org_id));

-- inquiries
drop policy if exists "Admins view all inquiries" on public.inquiries;
create policy "Admins view all inquiries" on public.inquiries
  for select to authenticated using (is_org_admin(org_id));
drop policy if exists "Admins update inquiries" on public.inquiries;
create policy "Admins update inquiries" on public.inquiries
  for update to authenticated
  using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "Admins delete inquiries" on public.inquiries;
create policy "Admins delete inquiries" on public.inquiries
  for delete to authenticated using (is_org_admin(org_id));
