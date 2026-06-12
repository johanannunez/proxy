-- B2.4 batch 6: org-scope the inline admin checks (exists profiles.role='admin')
-- on the tasks/CRM domain. Same global-admin semantics as is_admin(), same fix:
-- is_org_admin(org_id).

drop policy if exists "tasks_admin_rw" on public.tasks;
create policy "tasks_admin_rw" on public.tasks
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "task_activity_admin_r" on public.task_activity;
create policy "task_activity_admin_r" on public.task_activity
  for select using (is_org_admin(org_id));

drop policy if exists "task_comments_admin_rw" on public.task_comments;
create policy "task_comments_admin_rw" on public.task_comments
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "task_labels_admin_rw" on public.task_labels;
create policy "task_labels_admin_rw" on public.task_labels
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "task_templates_admin_rw" on public.task_templates;
create policy "task_templates_admin_rw" on public.task_templates
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "property_task_templates_admin_rw" on public.property_task_templates;
create policy "property_task_templates_admin_rw" on public.property_task_templates
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "projects_admin_rw" on public.projects;
create policy "projects_admin_rw" on public.projects
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "notes_admin_rw" on public.notes;
create policy "notes_admin_rw" on public.notes
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "attachments_admin_rw" on public.attachments;
create policy "attachments_admin_rw" on public.attachments
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "saved_views_admin_rw" on public.saved_views;
create policy "saved_views_admin_rw" on public.saved_views
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "contacts_admin_rw" on public.contacts;
create policy "contacts_admin_rw" on public.contacts
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "admins_all" on public.contact_sources;
create policy "admins_all" on public.contact_sources
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

drop policy if exists "ai_insights_admin_rw" on public.ai_insights;
create policy "ai_insights_admin_rw" on public.ai_insights
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));
