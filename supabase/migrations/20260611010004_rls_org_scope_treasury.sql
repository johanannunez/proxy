-- B2.4 batch 1: org-scope treasury RLS. Replaces global is_admin() with
-- is_org_admin(org_id) so treasury data is isolated per organization.
-- is_org_admin() is SECURITY DEFINER and already passes service_role through.
-- Drop+create runs in one transaction, so no window with zero policies.

-- treasury_accounts
drop policy if exists "treasury_accounts_admin_select" on public.treasury_accounts;
create policy "treasury_accounts_admin_select" on public.treasury_accounts
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_accounts_admin_insert" on public.treasury_accounts;
create policy "treasury_accounts_admin_insert" on public.treasury_accounts
  for insert with check (is_org_admin(org_id));
drop policy if exists "treasury_accounts_admin_update" on public.treasury_accounts;
create policy "treasury_accounts_admin_update" on public.treasury_accounts
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "treasury_accounts_admin_delete" on public.treasury_accounts;
create policy "treasury_accounts_admin_delete" on public.treasury_accounts
  for delete using (is_org_admin(org_id));

-- treasury_alerts
drop policy if exists "treasury_alerts_admin_select" on public.treasury_alerts;
create policy "treasury_alerts_admin_select" on public.treasury_alerts
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_alerts_admin_insert" on public.treasury_alerts;
create policy "treasury_alerts_admin_insert" on public.treasury_alerts
  for insert with check (is_org_admin(org_id));
drop policy if exists "treasury_alerts_admin_update" on public.treasury_alerts;
create policy "treasury_alerts_admin_update" on public.treasury_alerts
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "treasury_alerts_admin_delete" on public.treasury_alerts;
create policy "treasury_alerts_admin_delete" on public.treasury_alerts
  for delete using (is_org_admin(org_id));

-- treasury_audit_log (insert + select only, append-only log)
drop policy if exists "treasury_audit_log_admin_select" on public.treasury_audit_log;
create policy "treasury_audit_log_admin_select" on public.treasury_audit_log
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_audit_log_admin_insert" on public.treasury_audit_log;
create policy "treasury_audit_log_admin_insert" on public.treasury_audit_log
  for insert with check (is_org_admin(org_id));

-- treasury_connections
drop policy if exists "treasury_connections_admin_select" on public.treasury_connections;
create policy "treasury_connections_admin_select" on public.treasury_connections
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_connections_admin_insert" on public.treasury_connections;
create policy "treasury_connections_admin_insert" on public.treasury_connections
  for insert with check (is_org_admin(org_id));
drop policy if exists "treasury_connections_admin_update" on public.treasury_connections;
create policy "treasury_connections_admin_update" on public.treasury_connections
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "treasury_connections_admin_delete" on public.treasury_connections;
create policy "treasury_connections_admin_delete" on public.treasury_connections
  for delete using (is_org_admin(org_id));

-- treasury_forecasts
drop policy if exists "treasury_forecasts_admin_select" on public.treasury_forecasts;
create policy "treasury_forecasts_admin_select" on public.treasury_forecasts
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_forecasts_admin_insert" on public.treasury_forecasts;
create policy "treasury_forecasts_admin_insert" on public.treasury_forecasts
  for insert with check (is_org_admin(org_id));
drop policy if exists "treasury_forecasts_admin_update" on public.treasury_forecasts;
create policy "treasury_forecasts_admin_update" on public.treasury_forecasts
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "treasury_forecasts_admin_delete" on public.treasury_forecasts;
create policy "treasury_forecasts_admin_delete" on public.treasury_forecasts
  for delete using (is_org_admin(org_id));

-- treasury_savings_goals
drop policy if exists "treasury_savings_goals_admin_select" on public.treasury_savings_goals;
create policy "treasury_savings_goals_admin_select" on public.treasury_savings_goals
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_savings_goals_admin_insert" on public.treasury_savings_goals;
create policy "treasury_savings_goals_admin_insert" on public.treasury_savings_goals
  for insert with check (is_org_admin(org_id));
drop policy if exists "treasury_savings_goals_admin_update" on public.treasury_savings_goals;
create policy "treasury_savings_goals_admin_update" on public.treasury_savings_goals
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "treasury_savings_goals_admin_delete" on public.treasury_savings_goals;
create policy "treasury_savings_goals_admin_delete" on public.treasury_savings_goals
  for delete using (is_org_admin(org_id));

-- treasury_subscriptions
drop policy if exists "treasury_subscriptions_admin_select" on public.treasury_subscriptions;
create policy "treasury_subscriptions_admin_select" on public.treasury_subscriptions
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_subscriptions_admin_insert" on public.treasury_subscriptions;
create policy "treasury_subscriptions_admin_insert" on public.treasury_subscriptions
  for insert with check (is_org_admin(org_id));
drop policy if exists "treasury_subscriptions_admin_update" on public.treasury_subscriptions;
create policy "treasury_subscriptions_admin_update" on public.treasury_subscriptions
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "treasury_subscriptions_admin_delete" on public.treasury_subscriptions;
create policy "treasury_subscriptions_admin_delete" on public.treasury_subscriptions
  for delete using (is_org_admin(org_id));

-- treasury_transactions
drop policy if exists "treasury_transactions_admin_select" on public.treasury_transactions;
create policy "treasury_transactions_admin_select" on public.treasury_transactions
  for select using (is_org_admin(org_id));
drop policy if exists "treasury_transactions_admin_insert" on public.treasury_transactions;
create policy "treasury_transactions_admin_insert" on public.treasury_transactions
  for insert with check (is_org_admin(org_id));
drop policy if exists "treasury_transactions_admin_update" on public.treasury_transactions;
create policy "treasury_transactions_admin_update" on public.treasury_transactions
  for update using (is_org_admin(org_id)) with check (is_org_admin(org_id));
drop policy if exists "treasury_transactions_admin_delete" on public.treasury_transactions;
create policy "treasury_transactions_admin_delete" on public.treasury_transactions
  for delete using (is_org_admin(org_id));
