-- tax_profiles: only the serving agency's admins, not any global admin/compliance user.
drop policy if exists "tax_profiles: compliance or admin all" on public.tax_profiles;
create policy "tax_profiles agency admin all" on public.tax_profiles
  for all to authenticated
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

-- w9_access_log: same agency scoping for reads.
drop policy if exists "w9_access_log: compliance or admin read" on public.w9_access_log;
create policy "w9_access_log agency admin read" on public.w9_access_log
  for select to authenticated
  using (is_org_admin(org_id));

-- document_templates: stop letting any signed-in user read every agency's templates.
-- System templates (org_id null) stay readable by all signed-in users.
drop policy if exists "Authenticated users can read document templates" on public.document_templates;
create policy "document_templates org or system read" on public.document_templates
  for select to authenticated
  using (is_system = true or org_id is null or is_org_member(org_id));
