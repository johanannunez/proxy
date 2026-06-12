-- B2.4 batch 5: org-scope documents/workspace-requests/help RLS. This clears
-- the last is_admin() policies. Help content stays publicly readable through
-- its existing read policies; only the admin write path becomes org-scoped.

drop policy if exists "document_events_admin_all" on public.document_events;
create policy "document_events_admin_all" on public.document_events
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "document_signers_admin_all" on public.document_signers;
create policy "document_signers_admin_all" on public.document_signers
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "Admins write signed_documents" on public.signed_documents;
create policy "Admins write signed_documents" on public.signed_documents
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "workspace_requests_admin_all" on public.workspace_requests;
create policy "workspace_requests_admin_all" on public.workspace_requests
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "workspace_request_items_admin_all" on public.workspace_request_items;
create policy "workspace_request_items_admin_all" on public.workspace_request_items
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "workspace_request_recipients_admin_all" on public.workspace_request_recipients;
create policy "workspace_request_recipients_admin_all" on public.workspace_request_recipients
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "workspace_request_attachments_admin_all" on public.workspace_request_attachments;
create policy "workspace_request_attachments_admin_all" on public.workspace_request_attachments
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "help_articles_admin_write" on public.help_articles;
create policy "help_articles_admin_write" on public.help_articles
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "help_categories_admin_write" on public.help_categories;
create policy "help_categories_admin_write" on public.help_categories
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
