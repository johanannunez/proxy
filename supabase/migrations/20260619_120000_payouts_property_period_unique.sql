-- Capture the unique index that the payout upsert depends on.
--
-- runPayoutGeneration() upserts into public.payouts with
-- onConflict: 'property_id,period_start', which requires a UNIQUE index on
-- exactly those two columns for conflict inference to work. That index
-- (payouts_property_period_unique) already exists in production but was applied
-- directly, never captured in a migration — so a fresh DB or preview branch
-- would lack it and the upsert would fail there.
--
-- Idempotent: `if not exists` makes this a no-op against production while making
-- the schema reproducible everywhere else.
create unique index if not exists payouts_property_period_unique
  on public.payouts using btree (property_id, period_start);
