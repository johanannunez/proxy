# RLS Audit (project `pwoxwpryummqeqsxdgyc`)

Date of audit: 2026-05-11. Scope: every base table in the `public`
schema, every `SUPABASE_SERVICE_ROLE_KEY` call site under
`apps/web/src/`, and every `SECURITY DEFINER` helper in the `public`
schema.

This is the source-of-truth document for "who can do what to which
table". Update it whenever a migration changes a policy or a new
service-role call site is added.

## Acceptance baseline

After running migration `20260511_rls_hardening.sql`, the Supabase
security advisor (`mcp__claude_ai_Supabase__get_advisors type=security`)
returns zero `ERROR`-level findings on this project. Remaining
`WARN`-level findings are tracked in [Known follow-ups](#known-follow-ups).

## Tables

Legend.

- **Owner-self**: owner reads / writes their own rows; admin has full
  access via `is_admin()` or an explicit admin policy.
- **Admin-only**: only `is_admin()` profiles can SELECT / write.
- **Public-read**: anon (logged-out marketing site) can SELECT.
- **Service-only**: no RLS policy exposes the table to anon or
  authenticated. The service role (which bypasses RLS) is the only
  writer; reads happen through admin endpoints.

| Table | Mode | Policies | Notes |
| --- | --- | --- | --- |
| `activity_log` | Admin-only + owner-read | `activity_log_admin_read`, `activity_log_owner_read` | |
| `ai_insights` | Admin-only | `ai_insights_admin_rw` | |
| `api_tokens` | Owner-self | `api_tokens_self_select`, `api_tokens_self_insert`, `api_tokens_self_delete` | RLS enabled in 20260511_rls_hardening. No UPDATE policy: `last_used_at` is updated via service role only. |
| `attachments` | Admin-only | `attachments_admin_rw` | |
| `block_requests` | Owner-self + admin | 5 policies; owners can cancel pending; admins update all | |
| `bookings` | Owner-self | 5 policies scoped to property ownership | Two SELECT policies (`Owners view bookings for their properties` and `Owners view own bookings`) overlap; the second is for direct `owner_id` columns. Both restrictive enough. |
| `changelogs` | Service-only | (none after 20260511_rls_hardening) | Written via `createServiceClient()` in `lib/admin/changelogs.ts`. |
| `client_messages` | Admin-only | `Admins can manage all client messages` | |
| `communication_events` | Admin-only | `Admins can manage communication_events` | |
| `connections` | Owner-self | 4 per-command policies | |
| `contact_sources` | Admin write + public-read | `admins_all`, `public_read_active` | The public-read is intentional for the lead-form picker. |
| `contacts` | Admin-only + owner-self-read | `contacts_admin_rw`, `contacts_owner_self_select` | |
| `conversations` | Admin + owner | `Admins full access conversations`, `Owners read own conversations` | |
| `document_properties` | Admin + owner-read | `Admins full access to document_properties`, `Owners can view own document_properties` | |
| `documents` | Admin + owner-read | 3 policies | Two SELECT policies (`Owners can read their documents`, `Owners can view own documents`) overlap but both use proper owner scoping. |
| `feedback_submissions` | Service-only | (none after 20260511_rls_hardening) | Written via `createServiceClient()` in `lib/admin/support.ts`. |
| `help_articles` | Public-read | `help_articles_select_published` | Public marketing surface. |
| `help_categories` | Public-read | `help_categories_select` | |
| `help_feedback` | Owner-self | `help_feedback_insert`, `help_feedback_select_own` | |
| `help_search_logs` | Anon + authenticated insert | `help_search_logs_insert`, `help_search_logs_insert_anon` | Insert-only; tracks search queries from logged-out users. |
| `inquiries` | Admin-only | 3 policies. Anon INSERT is via `createServiceClient()` in the marketing form handler. | |
| `invoice_items` | Admin + owner-read | `invoice_items_admin_all`, `invoice_items_owner_read` | |
| `invoices` | Admin + owner-read | `invoices_admin_all`, `invoices_owner_read` | |
| `message_reads` | Admin + owner-self-write | 3 policies | |
| `messages` | Admin + owner-scoped | 3 policies; owners can SELECT and reply within own direct conversation | |
| `notes` | Admin-only | `notes_admin_rw` | |
| `notifications` | Admin + owner | 3 policies | |
| `onboarding_drafts` | Owner-self | `Owners read own draft`, `Owners write own draft` | |
| `owner_facts` | Admin-only | `owner_facts_admin_read`, `owner_facts_admin_write` | Owners do not see their own facts; surface is admin-only. |
| `owner_kyc` | Owner-self | `Owners manage own kyc` | |
| `owner_meetings` | Admin + owner-read | `admin_all_owner_meetings`, `owner_read_own_meetings` | |
| `owner_notes` | Admin + owner-read-visible | 3 policies | Two overlapping owner SELECT policies (visible-only). |
| `owner_receipts` | Admin + owner-read-visible | 2 policies | |
| `owner_setup_drafts` | Owner-self | `Owners manage own drafts` | |
| `owner_tasks_legacy` | Admin + owner-read | 3 policies | Legacy table; superseded by `tasks`. |
| `owner_timeline` | Admin + owner-read-visible | 4 policies after 20260511_rls_hardening (`Admins delete/insert/update timeline`, `Owners view own timeline`) | Dropped `Owners can read their timeline` (bypassed visibility filter) and `Admins full access to owner_timeline` (granted to `{public}`). |
| `parcel_team` | Authenticated-read | `Authenticated users can read active team members` | Required so logged-in profiles can see team contacts inside the admin and portal. |
| `payouts` | Owner-self | 4 per-command policies scoped to property ownership | |
| `profiles` | Owner-self | `Users view own profile`, `Users update own profile` | Admins reach profiles via `is_admin()`-gated server actions using the service role where needed. |
| `projects` | Admin-only | `projects_admin_rw` | |
| `properties` | Owner-self | 4 per-command policies | |
| `property_amenities` | Owner-self | `Owners view own amenities`, `Owners write own amenities` | |
| `property_checklist_items` | Admin-only | `Admin full access` | |
| `property_compliance` | Owner-self | `Owners view own compliance`, `Owners write own compliance` | |
| `property_forms` | Owner-self + service | 3 policies (kept `Service role full access to property_forms`; see follow-up below). | |
| `property_owners` | Admin + owner-read | 2 policies | |
| `property_rules` | Owner-self | 2 policies | |
| `property_setup_drafts` | Owner-self | `Owners manage own property drafts` | |
| `property_task_templates` | Admin-only | `property_task_templates_admin_rw` | |
| `property_team` | Owner-self | 2 policies | |
| `push_subscriptions` | Admin + user-self | 2 policies | |
| `saved_views` | Admin-only | `saved_views_admin_rw` | |
| `session_log` | Admin + user-self-read | 2 policies | |
| `setup_field_versions` | Owner-self | 2 policies (INSERT + SELECT) | |
| `signed_documents` | Admin + owner-self-insert + owner-self-read | After 20260511_rls_hardening: `Admins read all documents`, `Admins write signed_documents`, `Owners insert own signed_documents`, `Owners read own documents` | Dropped `Service role inserts documents` and `Service role updates documents`. BoldSign webhook continues to write via `createServiceClient()`. |
| `stripe_customers` | Admin + owner-read | 2 policies | |
| `subscriptions` | Admin + owner-read | 2 policies | |
| `support_tickets` | Service-only | (none after 20260511_rls_hardening) | Written via `createServiceClient()` in `lib/admin/support.ts`. |
| `task_activity` | Admin-only | `task_activity_admin_r` | |
| `task_assignees_legacy` | Admin + owner-read | 2 policies | Legacy. |
| `task_comments` | Admin-only | `task_comments_admin_rw` | |
| `task_comments_legacy` | Admin + owner | 3 policies | Legacy. |
| `task_label_map_legacy` | Admin + read-all | 2 policies | Legacy. |
| `task_labels` | Admin-only | `task_labels_admin_rw` | |
| `task_labels_legacy` | Admin + read-all | 2 policies | Legacy. |
| `task_subtasks_legacy` | Admin + owner | 3 policies | Legacy. |
| `task_templates` | Admin-only | `task_templates_admin_rw` | |
| `task_templates_legacy` | Admin + read-all | 2 policies | Legacy. |
| `tasks` | Admin + owner-read | `tasks_admin_rw`, `tasks_owner_read_own` | |
| `tasks_legacy` | Admin + owner-read | 2 policies | Legacy. |
| `treasury_accounts` | Admin-only | 4 per-command policies | |
| `treasury_alerts` | Admin-only | 4 per-command policies | |
| `treasury_audit_log` | Admin-only | 2 policies (INSERT + SELECT) | |
| `treasury_balance_snapshots` | Service-only | (none after 20260511_rls_hardening) | Written via `createServiceClient()` in `lib/treasury/sync.ts`. Read via `createServiceClient()` in `api/treasury/balance-history` (admin-gated). |
| `treasury_connections` | Admin-only | 4 per-command policies | |
| `treasury_forecasts` | Admin-only | 4 per-command policies | |
| `treasury_savings_goals` | Admin-only | 4 per-command policies | |
| `treasury_subscriptions` | Admin-only | 4 per-command policies | |
| `treasury_transactions` | Admin-only | 4 per-command policies | |
| `vendor_properties` | Admin-only | `Admins can manage vendor_properties` | |
| `vendors` | Admin-only | `Admins can manage vendors` | |
| `workspaces` | Admin + owner-self-read | `Admins full access entities`, `Owners read own entity` | |

## Service-role call sites

Every direct or indirect use of `SUPABASE_SERVICE_ROLE_KEY` in
`apps/web/src/`. Each must either (a) operate on tables that have no
RLS policy exposing them to anon / authenticated, or (b) carry an
explicit owner-id filter on every query.

| Location | Why bypass is safe |
| --- | --- |
| `apps/web/src/lib/supabase/service.ts` | Factory only. Documented at the top of the file. |
| `apps/web/src/proxy.ts:127` `getServiceClient()` (CalDAV) | Resolves the caller's `profileId` from the Basic-auth Bearer token via `verifyApiToken`. Every subsequent CalDAV query is scoped with `.eq("created_by", profileId)` at lines 232, 279, and 316. |
| `apps/web/src/app/api/tasks/quick-add/route.ts:15` | Same token-verification flow as CalDAV. The insert carries `created_by: result.profileId`, so the row is born owned by the authenticated profile rather than filtered after the fact. |
| `apps/web/src/lib/admin/changelogs.ts` | Service-only table (`changelogs`). Admin-only feature. |
| `apps/web/src/lib/admin/support.ts` | Service-only tables (`support_tickets`, `feedback_submissions`). Admin-only feature. |
| `apps/web/src/lib/treasury/sync.ts` | Service-only table (`treasury_balance_snapshots`) and admin-only treasury tables. Sync runs under cron / admin trigger. |
| `apps/web/src/app/api/treasury/balance-history/route.ts` | Gated by `treasuryAdminGuard()` before the service client is constructed. |
| `apps/web/src/app/api/webhooks/boldsign/route.ts` | BoldSign webhook handler. Signature-verified before write. Writes are keyed by `boldsign_document_id`. |

## SECURITY DEFINER functions

| Function | Caller | After 20260511_rls_hardening |
| --- | --- | --- |
| `auto_create_entity_for_profile()` | Trigger `trg_auto_create_entity_for_profile` on `profiles` | EXECUTE revoked from `public`, `anon`, `authenticated` |
| `handle_new_user()` | Trigger `on_auth_user_created` on `auth.users` | EXECUTE revoked from `public`, `anon`, `authenticated` |
| `update_conversation_last_message()` | Trigger `trg_message_update_conversation` on `messages` | EXECUTE revoked from `public`, `anon`, `authenticated` |
| `increment_message_read(uuid, uuid, text)` | App RPC, authenticated | EXECUTE granted to `authenticated`, revoked from anon |
| `is_admin()` | Inline in RLS policies on many tables | EXECUTE granted to `authenticated`, revoked from anon |
| `user_owns_property(uuid)` | Inline in RLS policies | EXECUTE granted to `authenticated`, revoked from anon |
| `search_help_articles(text, integer)` | Marketing-site help search (anon) | Unchanged, intentionally public |

## Known follow-ups

1. **`auth_leaked_password_protection` advisor WARN.** Supabase Auth
   feature toggle to check passwords against HaveIBeenPwned. Not a
   SQL change, lives in Supabase Auth dashboard. Tracked in the "Jo
   External Setup" Todoist project.
2. **`apps/web/src/app/api/admin/tokens/route.ts` is broken.** It
   queries `profiles.user_id`, a column that does not exist on
   `profiles` (the PK `id` is what `auth.uid()` returns). The route
   has been returning 404 ("Profile not found") for every request.
   Not a regression caused by 20260511_rls_hardening, but it means
   the admin API-tokens UI has never functioned in production. Fix
   should: (a) drop the broken profile lookup and use
   `user.id` directly as `profile_id`, and (b) keep the new
   `api_tokens_*_self_*` RLS policies as the security boundary.
3. **Overlapping owner SELECT policies** on `bookings`, `documents`,
   `owner_notes`, and `owner_receipts`. Both policies in each pair
   are restrictive enough today, but the duplication should be
   collapsed to a single canonical policy per command in a future
   pass.
4. **`auto_create_entity_for_profile()` and
   `update_conversation_last_message()`** keep the
   `authenticated_security_definer_function_executable` advisor WARN
   even after the REVOKE because they remain in the `public` schema.
   The advisor cannot tell that EXECUTE has been revoked. If the
   WARN noise becomes a problem, move trigger functions to a private
   schema such as `internal`.
