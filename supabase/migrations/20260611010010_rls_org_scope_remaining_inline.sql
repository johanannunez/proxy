-- B2.4 batch 7 (final): org-scope the remaining inline admin checks
-- (exists profiles.role='admin') across documents, owner records, vendors,
-- and the *_legacy task tables. After this, zero policies grant global
-- cross-org admin access.

drop policy if exists "Admins full access to documents" on public.documents;
create policy "Admins full access to documents" on public.documents
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins full access to document_properties" on public.document_properties;
create policy "Admins full access to document_properties" on public.document_properties
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "admin_all_owner_meetings" on public.owner_meetings;
create policy "admin_all_owner_meetings" on public.owner_meetings
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins full access to owner_notes" on public.owner_notes;
create policy "Admins full access to owner_notes" on public.owner_notes
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins full access to receipts" on public.owner_receipts;
create policy "Admins full access to receipts" on public.owner_receipts
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins view all block requests" on public.block_requests;
create policy "Admins view all block requests" on public.block_requests
  for select using (is_org_admin(org_id));
drop policy if exists "Admins update block requests" on public.block_requests;
create policy "Admins update block requests" on public.block_requests
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins can manage all client messages" on public.client_messages;
create policy "Admins can manage all client messages" on public.client_messages
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins can manage communication_events" on public.communication_events;
create policy "Admins can manage communication_events" on public.communication_events
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access" on public.property_checklist_items;
create policy "Admin full access" on public.property_checklist_items
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins full access to property_owners" on public.property_owners;
create policy "Admins full access to property_owners" on public.property_owners
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins can manage vendor_properties" on public.vendor_properties;
create policy "Admins can manage vendor_properties" on public.vendor_properties
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins can manage vendors" on public.vendors;
create policy "Admins can manage vendors" on public.vendors
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admins read all documents" on public.signed_documents;
create policy "Admins read all documents" on public.signed_documents
  for select using (is_org_admin(org_id));

-- Legacy task tables (kept for history, still RLS-protected)
drop policy if exists "Admins full access to owner_tasks" on public.owner_tasks_legacy;
create policy "Admins full access to owner_tasks" on public.owner_tasks_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access on task_assignees" on public.task_assignees_legacy;
create policy "Admin full access on task_assignees" on public.task_assignees_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access on task_comments" on public.task_comments_legacy;
create policy "Admin full access on task_comments" on public.task_comments_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access on task_label_map" on public.task_label_map_legacy;
create policy "Admin full access on task_label_map" on public.task_label_map_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access on task_labels" on public.task_labels_legacy;
create policy "Admin full access on task_labels" on public.task_labels_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access on task_subtasks" on public.task_subtasks_legacy;
create policy "Admin full access on task_subtasks" on public.task_subtasks_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access on task_templates" on public.task_templates_legacy;
create policy "Admin full access on task_templates" on public.task_templates_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "Admin full access on tasks" on public.tasks_legacy;
create policy "Admin full access on tasks" on public.tasks_legacy
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
