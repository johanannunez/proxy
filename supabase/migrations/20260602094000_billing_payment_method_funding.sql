alter table public.billing_payment_methods
  add column if not exists funding text;

alter table public.billing_payment_methods
  drop constraint if exists billing_payment_methods_funding_check,
  add constraint billing_payment_methods_funding_check
    check (
      funding is null
      or funding in ('credit', 'debit', 'prepaid', 'unknown')
    );
