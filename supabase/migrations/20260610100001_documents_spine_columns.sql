-- Workstream A1: documents spine becomes the single source of truth.
-- Adds the columns needed to absorb property_forms (raw form payloads) and
-- signed_documents (signature lifecycle metadata) into `documents`.

alter table documents
  add column if not exists form_key text,                 -- 'wifi_info', 'setup_basic', etc. (raw form rows only)
  add column if not exists form_data jsonb,               -- the submitted form payload
  add column if not exists reminder_sent_at timestamptz,  -- last reminder timestamp
  add column if not exists reminder_count int not null default 0,
  add column if not exists sent_at timestamptz,           -- when the signature request went out
  add column if not exists sent_by uuid references profiles(id) on delete set null;

-- Index for expiry cron
create index if not exists idx_documents_expires_at
  on documents (expires_at)
  where expires_at is not null;

-- Index for status queries
create index if not exists idx_documents_workspace_status
  on documents (workspace_id, status)
  where workspace_id is not null;

-- Index for cron reminder queries
create index if not exists idx_documents_reminder
  on documents (status, reminder_sent_at)
  where status not in ('on_file', 'expired', 'waived');

-- Raw form rows (source = 'property_form', form_key set) are unique per
-- (property, form_key) — this is the replacement for property_forms' natural key.
create unique index if not exists uq_documents_property_form
  on documents (property_id, form_key)
  where source = 'property_form' and form_key is not null;

-- Keep updated_at fresh via the shared trigger function.
drop trigger if exists set_updated_at on documents;
create trigger set_updated_at
  before update on documents
  for each row execute function public.set_updated_at();
