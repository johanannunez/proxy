-- B2.4 batch 2: org-scope billing and financial RLS.
-- is_admin() -> is_org_admin(org_id). Owner-scoped conditions
-- (user_owns_property) are preserved verbatim.

-- billing_* admin-all policies (to authenticated)
drop policy if exists "billing_catalog_items_admin_all" on public.billing_catalog_items;
create policy "billing_catalog_items_admin_all" on public.billing_catalog_items
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_credits_admin_all" on public.billing_credits;
create policy "billing_credits_admin_all" on public.billing_credits
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_events_admin_all" on public.billing_events;
create policy "billing_events_admin_all" on public.billing_events
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_invoice_lines_admin_all" on public.billing_invoice_lines;
create policy "billing_invoice_lines_admin_all" on public.billing_invoice_lines
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_invoices_admin_all" on public.billing_invoices;
create policy "billing_invoices_admin_all" on public.billing_invoices
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_payment_methods_admin_all" on public.billing_payment_methods;
create policy "billing_payment_methods_admin_all" on public.billing_payment_methods
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_profiles_admin_all" on public.billing_profiles;
create policy "billing_profiles_admin_all" on public.billing_profiles
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_refunds_admin_all" on public.billing_refunds;
create policy "billing_refunds_admin_all" on public.billing_refunds
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_schedule_lines_admin_all" on public.billing_schedule_lines;
create policy "billing_schedule_lines_admin_all" on public.billing_schedule_lines
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "billing_schedules_admin_all" on public.billing_schedules;
create policy "billing_schedules_admin_all" on public.billing_schedules
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- invoices / invoice_items / stripe_customers / subscriptions / finance_requests
drop policy if exists "invoices_admin_all" on public.invoices;
create policy "invoices_admin_all" on public.invoices
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "invoice_items_admin_all" on public.invoice_items;
create policy "invoice_items_admin_all" on public.invoice_items
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "stripe_customers_admin_all" on public.stripe_customers;
create policy "stripe_customers_admin_all" on public.stripe_customers
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "subscriptions_admin_all" on public.subscriptions;
create policy "subscriptions_admin_all" on public.subscriptions
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "finance_requests_admin_all" on public.finance_requests;
create policy "finance_requests_admin_all" on public.finance_requests
  for all to authenticated using (is_org_admin(org_id)) with check (is_org_admin(org_id));

-- payouts: owner-or-admin, owner path preserved
drop policy if exists "Owners view payouts for their properties" on public.payouts;
create policy "Owners view payouts for their properties" on public.payouts
  for select to authenticated
  using (user_owns_property(property_id) or is_org_admin(org_id));
drop policy if exists "Owners insert payouts for their properties" on public.payouts;
create policy "Owners insert payouts for their properties" on public.payouts
  for insert to authenticated
  with check (user_owns_property(property_id) or is_org_admin(org_id));
drop policy if exists "Owners update payouts for their properties" on public.payouts;
create policy "Owners update payouts for their properties" on public.payouts
  for update to authenticated
  using (user_owns_property(property_id) or is_org_admin(org_id))
  with check (user_owns_property(property_id) or is_org_admin(org_id));
drop policy if exists "Owners delete payouts for their properties" on public.payouts;
create policy "Owners delete payouts for their properties" on public.payouts
  for delete to authenticated
  using (user_owns_property(property_id) or is_org_admin(org_id));
