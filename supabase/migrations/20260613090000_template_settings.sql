-- Premium template Settings: per-template title override and a flexible
-- settings bag (email copy, reminders, expiry, after-sign redirect/cc, prefill,
-- access PIN). settings is a single jsonb column so new options ship without a
-- migration each time. Both default safely for rows that predate this change.
alter table public.document_templates add column if not exists title text;
alter table public.document_templates
  add column if not exists settings jsonb not null default '{}'::jsonb;
