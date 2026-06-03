alter table public.owner_receipts
  add column if not exists payment_source text not null default 'owner_card',
  add column if not exists reimbursement_status text not null default 'none',
  add column if not exists claim_provider text,
  add column if not exists claim_reference text,
  add column if not exists reimbursed_at timestamptz;

alter table public.owner_receipts
  drop constraint if exists owner_receipts_payment_source_check,
  add constraint owner_receipts_payment_source_check
  check (
    payment_source in (
      'owner_card',
      'company_card',
      'owner_paid',
      'vendor_invoice',
      'airbnb_claim',
      'insurance_claim',
      'other'
    )
  );

alter table public.owner_receipts
  drop constraint if exists owner_receipts_reimbursement_status_check,
  add constraint owner_receipts_reimbursement_status_check
  check (
    reimbursement_status in (
      'none',
      'reimbursement_needed',
      'claim_needed',
      'claim_submitted',
      'reimbursed',
      'denied_writeoff'
    )
  );

alter table public.owner_receipts
  drop constraint if exists owner_receipts_claim_provider_check,
  add constraint owner_receipts_claim_provider_check
  check (
    claim_provider is null
    or claim_provider in ('airbnb', 'insurance', 'other')
  );

create index if not exists owner_receipts_payment_source_idx
  on public.owner_receipts (payment_source);

create index if not exists owner_receipts_reimbursement_status_idx
  on public.owner_receipts (reimbursement_status);
