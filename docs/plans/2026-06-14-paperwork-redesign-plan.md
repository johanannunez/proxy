# Paperwork Redesign Implementation Plan

> **For Claude:** Execute task-by-task. Phase 2 is a hard prerequisite for Phase 3. Do NOT touch the `spine.ts` `deriveDesiredRows` guard until Task 2.6 (it silently corrupts live document state). Run `/plan-ceo-review` + `/plan-eng-review` before starting Phase 1.

**Goal:** Restructure admin Paperwork into Status Board / Signatures / Forms with an on-demand Action Center, functionally convert W-9 + Platform Authorization to DocuSeal signatures, and add a cross-cutting document expiry/renewal engine.

**Architecture:** Next.js 16 App Router, CSS Modules, Supabase (service-role reads for admin), DocuSeal signing pipeline, Stripe billing, Resend email + OpenPhone SMS, Vercel cron. Companion design doc: `docs/plans/2026-06-14-paperwork-redesign-design.md`.

**Tech stack:** TypeScript strict, motion/react, Phosphor duotone, `DatePickerInput`/`CustomSelect` (never native), `var(--*)` tokens only.

---

## Phase 1 — Navigation + Action Center shell

No data-model or cron changes. Ships visible immediately. Light + dark verified via `screenshot.mjs`.

### Task 1.1 — Restructure the shell tabs
- Modify `apps/web/src/app/(admin)/admin/paperwork/PaperworkShell.tsx`: change `PaperworkTab` union to `"status" | "signatures" | "forms"`; rebuild `TABS` (Status Board default, Signatures, Forms); update `PRIMARY_BY_TAB`; redirect `?create=pdf` cleanup (line ~203) and `NewDocumentChooser` "From a template" link (line ~114) to `/admin/paperwork/signatures/templates` → in practice `/admin/paperwork/templates/[id]` (keep the surviving master-detail route).
- Update `PaperworkShell.module.css` only if tab count/markup shifts. Keep the `layoutId="paperwork-tab-indicator"` motion indicator.
- Verify: `pnpm exec tsc --noEmit`.

### Task 1.2 — Status Board becomes the default tab
- Create `apps/web/src/app/(admin)/admin/paperwork/StatusBoardTab.tsx` wrapping `StatusBoardView` (with the board-header Action Center trigger from Task 1.5).
- Modify `paperwork/page.tsx`: `active="status"`, render `StatusBoardTab` (keep `fetchWorkspaceStatusBoard`); the Needs Action queue moves into the Action Center, not the page body.

### Task 1.3 — Signatures tab (was Documents)
- Create `apps/web/src/app/(admin)/admin/paperwork/signatures/page.tsx` (`active="signatures"`) and `SignaturesHub.tsx`: the existing per-document `DocumentDrawer` management UI + a permanent **Library** section listing `document_templates` where `doc_type in (host_rental_agreement, ach_authorization, card_authorization)` (W-9 + platform added in Phase 2), linking to `/admin/paperwork/templates/[id]`.

### Task 1.4 — Action Center drawer
- Create `apps/web/src/components/admin/chrome/ActionCenterDrawer.tsx` modeled on `NotificationPopover.tsx`: portal + `CustomEvent("admin:action-center-toggle")`. Three sections (Needs Attention, Expiring Soon, Lapsed). Lazy-fetch on open.
- Mount the portal in `apps/web/src/app/(admin)/admin/layout.tsx` (~line 116, alongside existing portals).

### Task 1.5 — Action Center data route + trigger
- Create `apps/web/src/app/api/admin/action-center/route.ts` returning `{ queue, expiring, lapsed }`. `queue` = existing `fetchActionQueue`. `expiring`/`lapsed` = empty/derived from any existing `expires_at` until Phase 3.
- Board-header count pill in `StatusBoardTab` dispatches the toggle event. (Open for review: board-header vs persistent top-bar placement.)

### Task 1.6 — Board row + corner polish
- `apps/web/src/lib/admin/status-board-types.ts`: add optional `expiresAt: string | null` to `EntityDetail`.
- `StatusBoardView.tsx`: render owner avatars + names (`WorkspaceRow.owners[]`) instead of `row.type`; corner cell → badge legend.

### Task 1.7 — Link + label sweep
- Update `palette-search.ts` deep links, `OnboardingWizard.tsx` step links, and `AdminSidebar.tsx`/breadcrumb labels for the new routes. Grep for `/admin/paperwork` literals.

### Task 1.8 — Verify Phase 1
- `tsc`, `pnpm lint`, `doppler run -- next build`. Confirm `templates/[id]` subtree untouched. Screenshot `/admin/paperwork`, `/signatures`, `/forms` in light + dark at admin width. Confirm Forms/Templates not regressed.

---

## Phase 2 — Reclassification + upload Forms + DocuSeal W-9/Platform

Data-model changes. No cron.

### Task 2.1 — Board reclassification
- `status-board-config.ts`: `w9` + `platform_authorization` → `kind: "signature"`; `str_permit`, `insurance_certificate`, `identity` → `kind: "form"`; remove `"file"` from `KIND_ORDER` + `KIND_LABEL`.

### Task 2.2 — Fix platform_authorization scope
- `status-board-config.ts`: `platform_authorization` scope `property` → `owner` to match `lifecycle.ts` send paths. Verify board grouping still resolves.

### Task 2.3 — Taxonomy audit
- Audit `documents-hub-shared.ts` `WORKSPACE_DOCUMENT_DEFINITIONS` against new `REQUIREMENT_CONFIG`; document the divergence inline; file the unification as a follow-on (do not silently fork).

### Task 2.4 — Upload-field Forms + permanent Library
- `forms/FormsTab.tsx`: make the Library section permanent (remove empty-state gate, lines ~349-381); add `DatePickerInput` (never native) for `expiration_date` + a file upload control for `str_permit`, `insurance_certificate`, `identity`.

### Task 2.5 — Expiry column typing + backfill
- Supabase migration: type `expiration_date` for the three doc types as `date`; backfill parseable free-text values; log unparseable rows.
- `status-board.ts`: add `expires_at` to the SELECT so `EntityDetail.expiresAt` populates.

### Task 2.6 — `spine.ts` guard rewrite (DE-RISK FIRST, isolated, tested)
- Rewrite `deriveDesiredRows` guard to look up `document_templates` by `doc_type` instead of the legacy hardcoded BoldSign `templateId`. Add a test that proves W-9 (templateId null) no longer has its DocuSeal state overwritten on sync. This precedes Task 2.7.

### Task 2.7 — DocuSeal templates for W-9 + Platform Authorization
- Create both as real DocuSeal documents through the Proxy portal (Platform Auth content: "do you authorize us to list your property across all platforms?"). Insert `document_templates` rows; wire send + signer/countersigner tracking through `signing.ts`; suppress countersigner where not needed.

### Task 2.8 — Verify Phase 2
- `tsc`/lint/build; send-and-sign a test W-9 + Platform Auth in DocuSeal; confirm board cells show signer timelines; screenshots.

---

## Phase 3 — Expiry engine + notifications

Gated. Cron, multi-channel, new writes.

### Task 3.0 — Prerequisite gate
- Confirm Phase 2 complete + expiry dates backfilled. Resolve the triple-expiry conflict (Task 3.1). Verify the `workspace → contacts.phone` join exists before writing SMS code.

### Task 3.1 — Consolidate existing expiry systems
- Pick `spine.ts` `expirationToStatus` as canonical. Disable `expiry.ts` `processDocumentExpiry` direct status writes. Remove the `normalizeStatus` `expiring → action_required` oscillation. Test status stability across two simulated cron runs.

### Task 3.2 — Lead-window config
- Extend `document_reminder_config` with per-`doc_type` lead-window rows (Permit 120, Insurance 90, ID 60, Card 60) and start reading its `channels` column.

### Task 3.3 — Renewal escalation module
- Create `apps/web/src/lib/documents/renewal-escalation.ts`: `fetchRenewalCandidates`, `computeEscalationStage` (90/30/14/7/lapsed), `dispatchEscalation` with injectable `sendEmail` (Resend `sendViaResend`) + `sendSms` (OpenPhone `sendOpenPhoneSms`); phone from `contacts.phone` (join by profile_id, `getOwnerContact` pattern); import `normalize-phone.ts`. Separate from `reminders.ts` (creation-age cron).

### Task 3.4 — Cron route
- Create `apps/web/src/app/api/cron/document-renewal/route.ts` (`CRON_SECRET` guard, `ENABLE_DOCUMENT_RENEWAL_CRON` gate). Add `vercel.json` cron `{ "path": "/api/cron/document-renewal", "schedule": "0 10 * * *" }`.

### Task 3.5 — Escalation ledger
- Migration: `document_renewal_escalations` (id, document_id, stage, channel, sent_at, actor_id); service-role RLS. Dispatch checks it to prevent re-sends.

### Task 3.6 — Admin "Call owner" task
- Add `renewal_overdue` to `ActionQueueItemKind` (`action-queue-types.ts`) + a UNION ALL branch in the `fetch_admin_action_queue` SECURITY DEFINER function (migration + RLS audit). Surfaces in the Action Center Lapsed/7-day stage and the `/admin` Today cockpit.

### Task 3.7 — Card expiry (layered)
- Create `apps/web/src/lib/billing/card-expiry-sync.ts`: daily read of `billing_payment_methods.exp_month/exp_year` → write `card_authorization.expires_at` (never touches PAN). Add a `payment_method.automatically_updated` / `payment_method.updated` case to the Stripe webhook route for real-time updates. (External: enable Card Account Updater in Stripe dashboard.)

### Task 3.8 — Wire Action Center real data
- `/api/admin/action-center` returns real `expiring` + `lapsed` from the engine; the drawer renders them with inline actions.

### Task 3.9 — Templates + deploy gates + verify
- Branded owner email + SMS templates; admin notification copy. Unify the Resend `from` address. Confirm deploy gates set in Doppler prd: `RESEND_WEBHOOK_SECRET`, `ENABLE_DOCUMENT_RENEWAL_CRON`, `OPENPHONE_API_KEY`, `OPENPHONE_PHONE_NUMBER`. Test the full ladder with a seeded near-expiry instance (synthetic data only, never mutate prod).

---

## Cross-cutting rules
- Never mutate production data for demos; seed synthetic.
- `DatePickerInput`/`CustomSelect` only; no native `<select>`/`<input type=date>`.
- `var(--*)` tokens; `transition` specific properties; motion/react.
- Each task: implement → `tsc`/lint → test → screenshot (UI) → commit. Advisor before merging any phase branch.
