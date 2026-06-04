-- Add premium feature columns to owner_receipts
alter table owner_receipts
  add column if not exists starred_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists review_notes text,
  add column if not exists tags text[] not null default '{}';

-- Audit trail table for receipt changes
create table if not exists receipt_audit_log (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references owner_receipts(id) on delete cascade,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  action text not null,
  field text,
  old_value text,
  new_value text
);

alter table receipt_audit_log enable row level security;

create policy "owner_and_service_role_audit"
  on receipt_audit_log for all
  using (
    auth.role() = 'service_role'
    or changed_by = auth.uid()
  )
  with check (
    auth.role() = 'service_role'
    or changed_by = auth.uid()
  );

create index if not exists receipt_audit_log_receipt_id_idx
  on receipt_audit_log (receipt_id, changed_at desc);
