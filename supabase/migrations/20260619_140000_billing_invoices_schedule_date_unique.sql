-- Close the recurring-invoice idempotency race.
--
-- generate-draft-invoice.ts guards against duplicate drafts with a
-- SELECT-then-INSERT (does an invoice already exist for this schedule's
-- next_invoice_date?). That check is not atomic: the billing-schedules cron and
-- an admin clicking "Generate draft" can both pass the SELECT before either
-- INSERTs, producing two review_ready drafts for the same period — which become
-- a double charge if both are approved. Adding the cron made the concurrent
-- writer real, so the DB must be the authority on uniqueness.
--
-- Partial index: only schedule-generated invoices are constrained. Manual
-- one-off invoices have schedule_id IS NULL and are unaffected (and NULLs are
-- distinct under a unique index anyway).
--
-- Idempotent. Verified zero existing duplicate (schedule_id, invoice_date)
-- groups before applying.
create unique index if not exists billing_invoices_schedule_date_unique
  on public.billing_invoices (schedule_id, invoice_date)
  where schedule_id is not null;
