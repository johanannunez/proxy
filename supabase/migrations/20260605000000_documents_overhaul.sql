-- Documents overhaul: reconcile signed_documents columns the app already uses.
--
-- The Documents hub (lib/admin/documents-hub.ts) and the send/remind actions
-- (admin/documents/document-actions.ts) read and write `sent_at` and `sent_by`,
-- but no applied migration adds them. Add them idempotently so those queries
-- stop silently failing.
--
-- NOTE: `signed_documents` itself is created in PENDING_onboarding_v2.sql. If
-- that file is the live source of truth, fold these columns in there instead;
-- this migration is safe either way thanks to IF NOT EXISTS guards.

alter table if exists public.signed_documents
  add column if not exists sent_at timestamptz;

alter table if exists public.signed_documents
  add column if not exists sent_by uuid references public.profiles(id) on delete set null;

create index if not exists signed_documents_sent_by_idx
  on public.signed_documents (sent_by);
