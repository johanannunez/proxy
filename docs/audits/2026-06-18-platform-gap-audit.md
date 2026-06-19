# Proxy Platform Gap Audit — 2026-06-18

Read-only audit of `apps/web`. All DB probes against live prod were read-only (no mutations).
Verified findings only; severity reflects **live blast radius today**, with latent multi-org risks called out.

Evidence baseline: vitest 298 passing / 36 files (exit 0); `tsc --noEmit` exit 0.

---

## CRITICAL

### C1. `analyzeAttachment` — unauthenticated SSRF + cross-tenant write + API-key burn
`src/app/(workspace)/workspace/inbox/upload-actions.ts:36`
A `"use server"` action with **no auth check**. It `fetch()`es a caller-supplied `fileUrl`
(server-side request forgery — can hit internal/metadata endpoints), sends the bytes to the
Anthropic API on the app's key (cost-exhaustion), then uses the **service-role** client to
overwrite `messages.metadata` for **any** caller-supplied `messageId` (cross-tenant write /
false AI summaries). Reachable today.
Fix: require `auth.getUser()`, verify the caller owns the conversation/message, allowlist
`fileUrl` to your storage origin, rate-limit.

---

## HIGH

### H1. `property-documents` storage bucket — anonymous enumeration + public read
Verified live: anon `POST /storage/v1/object/list/property-documents` returns the folder tree
(`<owner-uuid>/receipts/…`). It is a **public** bucket, so any known object path is
world-readable. Owner documents/receipts inventory is enumerable by anyone with the anon key
(shipped to the browser). Same lint on `document-assets` and `form-covers`.
Fix: make `property-documents` private; serve via short-lived signed URLs; drop the broad
SELECT policy on `storage.objects`.

### H2. Hospitable webhook — no signature verification
`src/app/api/webhooks/hospitable/route.ts:17` (comment admits "Full HMAC verification can be
added when we store the webhook secret"). Unauthenticated `POST` upserts into `bookings`
(guest PII, **financial amounts**, status) via service-role and emits spoofed owner timeline
events. Only friction is knowing a valid `hospitable_property_id`. An attacker can inject/cancel
bookings and poison financial + notification data.
Fix: verify the HMAC-SHA256 `Signature` header before processing.

### H3. Stripe webhook writes the legacy billing tables with the RLS client (silent no-op)
`src/lib/stripe.ts:170` (`syncInvoiceFromStripe`) and `:223` (`syncSubscriptionFromStripe`)
call `createClient()` (cookie/RLS client) inside the webhook. No session → `anon` role → RLS on
`invoices`/`subscriptions` blocks the UPDATE (0 rows, no error) and the INSERT (error swallowed).
`invoices.status` never reaches `paid`; legacy `subscriptions` never sync. The newer
`syncWorkspaceInvoiceFromStripe` / `syncOrgSubscriptionFromStripe` correctly use the service
client, so plan_tier likely still works — but these two are dead writes.
Fix: use `createServiceClient()` in both, and check `{ error }`.

### H4. Stripe webhook acknowledges 200 on handler failure
`src/app/api/stripe/webhook/route.ts` catch block returns `{ received: true }` (HTTP 200). The
comment says "Stripe will retry" — false; Stripe only retries non-2xx. Transient DB failures are
permanently lost.
Fix: return 500 on handler error so Stripe retries (after signature verification, which is fine).

### H5. Payout math never deducts fees — `net_payout` always equals gross
`src/app/api/admin/generate-payouts/route.ts:83-84` hardcodes `fees:0` and `net_payout:g.total`
(gross). `net_payout` is read in the owner CSV export and in lifetime-payout sums
(`workspace-detail.ts`, `workspace-contact-detail.ts`) but written **only here** (verified). So
every payout record reports the owner netting the full gross with zero fees — overstating owner
payout / hiding the Proxy cut. (The upsert is also non-additive, but since nothing else writes
these columns there's no manual-correction path to clobber today.)
Fix: compute real `fees` and `net_payout = gross - fees`.

### H6. Silent error swallowing on the owner portal's highest-traffic surfaces
Task mutations `src/app/(workspace)/workspace/tasks/WorkspaceTasksShell.tsx:983,1025,1058` and
inbox `src/app/(workspace)/workspace/inbox/WorkspaceMessagesShell.tsx:155,265` do
`if (result.error) return;` — no toast, no inline error. Owner saves/sends, the write fails, and
they get zero feedback (composer keeps the text, thread stays blank).
Fix: surface server-action errors inline (per project UI rules — no `alert()`).

---

## MEDIUM (confirmed; mostly latent until >1 operator org exists)

> Confirmed live: `organizations` count = **1** (2 admin staff, 0 compliance, 19 profiles). So
> the cross-tenant IDOR items below are genuinely latent today, not live — but they become live
> HIGH the day a second operator org with its own admins is onboarded.

### M1. Admin service-role writes are not org-scoped (cross-tenant IDOR, latent)
- `src/app/(admin)/admin/workspaces/[workspaceId]/receipts-admin-actions.ts:236,246,259`
  update/markReviewed/**delete** `owner_receipts` by `id` only, no `owner_id`/`org_id` filter.
- `src/lib/admin/admin-avatar-actions.ts:36` writes to `avatars/{targetProfileId}` by caller arg.
- `src/lib/admin/w9-review.ts:51` `getW9SignedUrlForReview` mints a signed URL for a raw
  caller-supplied `storagePath` (`w9/{ownerProfileId}/…`) → cross-tenant **W-9 SSN/EIN** read.
All gate on a global admin/compliance role, not the target's org. Harmless while Proxy is the
only operator org; a real IDOR the moment multi-org admin exists.
Fix: add `org_id`/ownership filters to every admin service-role mutation and signed-URL mint.

### M2. `document_templates` readable by any authenticated user
RLS policy `auth.uid() IS NOT NULL` (no org scope). Inert today (all templates are
`org_id = null` system rows, verified), latent cross-tenant read once org-scoped templates ship.

### M3. Tax/W-9 PII gated by a global role, not org
`is_compliance_or_admin()` (no org arg) gates `tax_profiles` and `w9_access_log`. By design for
Proxy staff today; **self-escalation to `admin`/`compliance` is NOT possible** (verified: no
mutation writes `profiles.role` from user input). Revisit before onboarding external compliance
users or multi-org.

### M4. Unauthenticated, un-rate-limited public endpoints
- `src/app/api/help/chat/route.ts` — anon → proxies to Anthropic on every request (quota burn).
- `src/app/api/forms/[id]/view/route.ts:22` — anon inserts arbitrary `form_views` (fake counts).
- `src/app/api/help/search/route.ts`, `src/app/(marketing)/free-tips/actions.ts` — table flooding.
Fix: rate-limit; validate IDs against existing public rows.

### M5. `communication-intelligence` cron fails open
`src/app/api/cron/communication-intelligence/route.ts:10` only checks the bearer token *if*
`CRON_SECRET` is set; the other six crons fail closed (500 when unset). Low risk (secret is set
in prod) but inconsistent.

---

## PRODUCT / UX GAPS (owner-facing)

- Banned native inputs in onboarding/setup (every new owner hits these):
  `setup/identity/IdentityForm.tsx:102`, `setup/financial/FinancialForm.tsx:149`,
  `onboarding/property/AddPropertyWizard.tsx:806,835` use `<input type="date">`;
  `timeline/TimelineView.tsx:492` uses raw `<select>`. Use `DatePickerInput` / `CustomSelect`.
- "Coming soon" placeholders in the owner flow: welcome video
  `setup/welcome/page.tsx:217`; property photo upload
  `…/properties/components/PropertySettingsModal.tsx:234`.
- `workspace/setup/page.tsx:137` returns `null` (blank page) when unauthenticated instead of
  `redirect("/login")`.
- `workspace/finances/page.tsx:35` swallows a DB error and renders $0.00 / "no documents" as if
  the owner has no records.

---

## HEALTH / DEBT (one-liners — do not over-weight)

- DB: ~784 perf lints, almost entirely fallout of the recent `org_id` retrofit —
  429 multiple-permissive-policies, 107 `auth_rls_initplan` (auth fn re-evaluated per row),
  96 unindexed FKs, 151 unused indexes. Batch-fix the initplan rewrites + FK indexes for scale.
- Three rich-text stacks shipped (tiptap + `@udecode/plate` v49 + `platejs` v53) and both
  `framer-motion` + `motion` (CLAUDE.md bans framer-motion) → bundle bloat. Pick one each.
- 212 explicit `any`, 246 `console.*` in `src`.
- Known: `persistSubmission` is not transactional (data-integrity hole) — already in `TODOS.md`.

---

## WHAT'S SOLID (verified)

- Dev-auth routes (`/api/dev/auth`, `/api/dev/screenshot-auth`) return **404 in prod**
  (`NODE_ENV !== 'development'`). Not a bypass.
- All 7 cron routes enforce `Authorization: Bearer ${CRON_SECRET}` (M5 aside).
- Webhook signatures verified + rejected: Stripe `constructEvent`, DocuSeal/Resend/Notion/Quo/
  Boldsign (HMAC/secret + `timingSafeEqual`), Plaid JWT (ES256). Only Hospitable (H2) is open.
- Core tenant tables (properties, documents, treasury_*, invoices, subscriptions, tasks, payouts)
  are properly org-scoped via `is_org_admin(org_id)` / ownership / workspace membership.
- `profiles.role` self-escalation is not reachable.
- Treasury API routes sit behind `treasuryAdminGuard()` (admin role + re-auth cookie).
- `fetch_admin_action_queue` RPC gates internally (anon call returns `[]`).
</content>
</invoke>
