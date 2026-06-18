create table if not exists public.finance_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  request_type text not null,
  status text not null default 'sent',
  delivery_method text not null default 'email',
  message text,
  request_url text,
  last_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_requests_request_type_check
    check (request_type in (
      'ach_authorization',
      'card_authorization',
      'receipt_upload',
      'reimbursement_details',
      'claim_evidence'
    )),
  constraint finance_requests_status_check
    check (status in ('draft', 'sent', 'viewed', 'completed', 'cancelled')),
  constraint finance_requests_delivery_method_check
    check (delivery_method in ('email', 'sms'))
);

create index if not exists finance_requests_workspace_idx
  on public.finance_requests (workspace_id, status, created_at desc);

create index if not exists finance_requests_contact_idx
  on public.finance_requests (contact_id, created_at desc);

alter table public.finance_requests enable row level security;

drop policy if exists finance_requests_admin_all on public.finance_requests;
create policy finance_requests_admin_all
  on public.finance_requests
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
