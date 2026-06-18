-- Corrective migration for document_templates.
-- Fixes two issues introduced in 20260530180000_document_templates.sql.

-- Fix 1: Add WITH CHECK to service-role mutation policy.
-- Without it, PostgreSQL applies false on INSERT/UPDATE, blocking server-side writes.
drop policy if exists "Service role can mutate document templates" on public.document_templates;
create policy "Service role can mutate document templates"
  on public.document_templates for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Fix 2: Replace bespoke trigger function with shared set_updated_at(), and guard the trigger.
drop trigger if exists document_templates_updated_at on public.document_templates;
drop function if exists public.set_document_templates_updated_at();
create trigger document_templates_updated_at
  before update on public.document_templates
  for each row execute function public.set_updated_at();
