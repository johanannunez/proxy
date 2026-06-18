# Paperwork Redesign: Status Board, Signatures/Forms, Action Center, and the Expiry Engine

**Date:** 2026-06-14
**Status:** Design approved in brainstorm; grounded by a 7-subsystem codebase reconnaissance (workflow `wf_48aec13f-45d`). Next step: phased build plan, then `/plan-ceo-review` + `/plan-eng-review` before code.

**Goal:** Restructure the admin Paperwork section into one coherent system (Status Board, Signatures, Forms), replace the always-on alert queue with an on-demand premium Action Center, and add a cross-cutting expiry/renewal engine so nothing (a card, an insurance certificate, a permit, an ID) ever lapses unnoticed.

---

## 1. The core problem

Today the section runs two competing vocabularies. The top tabs say **Documents / Forms / Templates**; the Status Board's filter says **Signatures / Forms / Files**. They never matched, so nothing reads as one product. We unify on the real model: there are two things owners do with paperwork, **sign** it or **submit** it, plus the cross-cutting concern that some documents **expire**.

---

## 2. Information architecture

### 2.1 Tabs
Replace `documents | forms | templates` with **`status | signatures | forms`**.

- **Status Board** is the new default landing (`/admin/paperwork`). The completion matrix that lives at the bottom of the Documents tab today becomes the whole tab.
- **Signatures** (`/admin/paperwork/signatures`) replaces the Documents tab. It holds tracked e-sign instances plus a **Library** section (signature masters).
- **Forms** (`/admin/paperwork/forms`) keeps form submissions plus a permanent **Library** section (form masters).
- **Templates tab is removed.** Its content folds into the Signatures and Forms Libraries. The `/admin/paperwork/templates/[id]` master-detail subtree is **kept untouched** as shared infrastructure that both Libraries link into.

One vocabulary now spans tabs, the board's column groups, and the filter bar.

### 2.2 Reclassification (functional, not cosmetic)
The board collapses from three kinds to two. **`file` is retired.**

| Requirement | Was | Becomes | Work |
|---|---|---|---|
| W-9 | file (tax-profile sourced) | **signature** | Real DocuSeal document created in the Proxy portal |
| Platform Authorization | file/upload (owner-scoped) | **signature** | Real DocuSeal document ("do you authorize us to list your property across all platforms?") created in the portal; fix scope to `owner` |
| STR Permit | file | **form** (upload field + expiry date) | DatePicker + file input |
| Insurance Certificate | file | **form** (upload field + expiry date) | DatePicker + file input |
| Identity | file | **form** (upload field) | File input |

The user chose the **functional** W-9 and Platform Authorization conversion (real signed instruments), not a display-only relabel.

### 2.3 Workspace rows
Show the **people** in the workspace (owner avatars + names, `+N` for extras) instead of the entity type string (`LLC / individual / family`). `WorkspaceRow.owners[]` already exists.

### 2.4 Corner cell
The empty top-left matrix cell becomes the **badge legend** (Complete / Sent / In progress / Declined / Needed / Not needed / Expiring).

---

## 3. Action Center

Replaces the always-on "Needs Action" queue that sits pinned atop the Documents tab today. A live **count pill in the Status Board header** opens a premium **right-side slide-over**. Modeled on the existing `NotificationPopover` portal pattern (CustomEvent toggle, portal mounted in the admin layout).

Three sections, in order:
1. **Needs Attention** — the existing action-queue items (overdue signatures, etc.), already fetched today.
2. **Expiring Soon** — items inside their renewal window, soonest first.
3. **Lapsed** — items past expiry; red, persistent until resolved.

Each row carries inline actions (Remind / View / Resend / Call). The drawer fetches lazily on open via a new `/api/admin/action-center` route returning all three sections in one response. Expiry escalations also feed the existing `/admin` Today cockpit queue, so they are not siloed.

---

## 4. The expiry engine

A cross-cutting concern, not a kind. A card authorization (a Signature) and an insurance certificate (a Form) both expire; the engine watches any requirement instance that carries an expiry date.

### 4.1 Where expiry dates come from
- **Insurance, STR Permit, Identity:** captured at owner submission via `DatePickerInput` (never `<input type=date>`), stored as a real `date`.
- **Card Authorization:** sourced from Stripe, layered:
  - **Real-time:** enable Stripe **Card Account Updater**; handle the `payment_method.automatically_updated` / `payment_method.updated` webhook so reissued cards update instantly (and many expired cards self-heal without owner action).
  - **Backbone:** a daily job copies `billing_payment_methods.exp_month/exp_year` (already mirrored from Stripe, no card number ever touched) into `card_authorization.expires_at`.
  - Security: Proxy never stores or sees the PAN or CVV. Only brand/last4/expiry, which is not protected cardholder data, ever leaves Stripe.

### 4.2 Lead windows (per-type, editable)
Defaults: STR Permit 120 days, Insurance 90, ID 60, Card 60. Stored per `doc_type` so processing-time differences are honored. **Storage decision:** extend the existing `document_reminder_config` table (it already carries an unused `channels` column) rather than create a parallel table.

### 4.3 Escalation ladder (multi-channel, multi-actor)
| Days out | Owner | Admin |
|---|---|---|
| Window open (~90) | Email | — |
| 30 | Email + owner action item | Action item appears |
| 14 | Email + **SMS** | Action item escalates |
| 7 | Email + SMS | High-priority **"Call owner"** task |
| 0 / lapsed | — | Red "Lapsed" item in Action Center + Today cockpit until resolved |

- **Email** via Resend (`sendViaResend`); **SMS** via **OpenPhone** (`sendOpenPhoneSms`; the webhook folder is legacy-named `quo` but it is OpenPhone). There is no Twilio.
- **Owner phone lives in `contacts.phone`**, joined by `profile_id` (the `getOwnerContact` pattern), not `profiles.phone`.
- A daily Vercel cron (`/api/cron/document-renewal`, `0 10 * * *`) recomputes stages and dispatches, guarded by `CRON_SECRET` + an `ENABLE_DOCUMENT_RENEWAL_CRON` feature gate.
- A new `document_renewal_escalations` ledger table records which (document, stage, channel) escalations fired, to prevent re-sends.
- A new `renewal_overdue` `ActionQueueItemKind` (+ a UNION ALL branch in the `fetch_admin_action_queue` SECURITY DEFINER function) powers the admin "Call owner" task.

### 4.4 Consolidating the expiry systems that already exist
Reconnaissance found **three** existing expiry paths fighting each other: `spine.ts` `expirationToStatus` (60-day → `action_required`), `expiry.ts` `processDocumentExpiry` (30-day → `expiring`), and `normalizeStatus` mapping `expiring → action_required` (so status oscillates between cron runs). The new engine must **not** become a fourth. Phase 3 picks one canonical path (`spine.ts` `expirationToStatus`), disables `expiry.ts`'s direct status writes, and removes the oscillating mapping.

---

## 5. Risk register (from reconnaissance)

1. **`spine.ts` guard is a silent data corruptor.** `deriveDesiredRows` uses a legacy BoldSign `templateId` as the gate for preserving DocuSeal state; W-9 has `templateId: null`, so every sync overwrites its DocuSeal state. The W-9/Platform DocuSeal conversion **requires** rewriting this guard to look up `document_templates` by `doc_type` first. Isolated, tested, de-risked step.
2. **Date-format blocker.** Insurance/permit expiry is free-text today (`new Date('Jan 2025')` = Invalid). Phase 2's DatePicker migration + backfill is a hard prerequisite for Phase 3.
3. **Card expiry is net-new plumbing**, not a toggle (`card_authorization.expires_at` is always null).
4. **Dual taxonomy.** `REQUIREMENT_CONFIG` (board) and `WORKSPACE_DOCUMENT_DEFINITIONS` (hub orchestration, 4-way kinds) diverge after reclassification. Decision: reclassify `REQUIREMENT_CONFIG` for board display, audit and document the divergence, and schedule unification as a follow-on (do not silently fork).
5. **`platform_authorization` scope mismatch:** declared `property`, sent as `owner`. Correct to `owner` in config.
6. **Deployment gates (ship-dark risks):** `RESEND_WEBHOOK_SECRET` missing in prd; `ENABLE_DOCUMENT_REMINDER_CRON` and `ENABLE_DOCUMENT_RENEWAL_CRON` unset; `OPENPHONE_API_KEY` / `OPENPHONE_PHONE_NUMBER` must be set. These are explicit deploy blockers, not post-ship cleanup.

---

## 6. Phased build sequence

**Phase 1 — Navigation + Action Center shell** (no data-model or cron changes).
New: `ActionCenterDrawer.tsx`, `/api/admin/action-center/route.ts`, `signatures/page.tsx`, `SignaturesHub.tsx`, `StatusBoardTab.tsx`. Modify: `PaperworkShell.tsx` (tabs/union/redirects), `paperwork/page.tsx` (default → status), admin `layout.tsx` (mount portal), board header trigger, `status-board-types.ts` (`expiresAt`), `StatusBoardView.tsx` (owners + legend). The `templates/[id]` subtree stays untouched. Visible immediately.

**Phase 2 — Reclassification + upload-field Forms + DocuSeal W-9/Platform** (data-model changes).
`status-board-config.ts` kind changes + retire `file`; `FormsTab.tsx` permanent Library + DatePicker + upload inputs; `documents-hub-shared.ts` taxonomy audit; **`spine.ts` guard rewrite** (de-risked); new DocuSeal templates for W-9 + Platform Authorization created through the portal; `status-board.ts` selects `expires_at`; Supabase migration typing expiry columns as `date` + backfill.

**Phase 3 — Expiry engine + notifications** (cron, multi-channel, new writes). Gated on Phase 2 completion + the triple-system consolidation + verifying the `contacts.phone` join.
New: `renewal-escalation.ts`, `/api/cron/document-renewal/route.ts`, `billing/card-expiry-sync.ts` (+ Stripe `automatically_updated` webhook case). Modify: `vercel.json` cron, `action-queue-types.ts` (`renewal_overdue`), `reminders.ts` deps (SMS). Migrations: `renewal_overdue` in `fetch_admin_action_queue`, `document_renewal_escalations` ledger, per-type lead windows on `document_reminder_config`.

---

## 7. External actions for Johan (walked through during build)
1. Enable **Card Account Updater** in the Stripe dashboard.
2. Set `OPENPHONE_API_KEY`, `OPENPHONE_PHONE_NUMBER`, `ENABLE_DOCUMENT_RENEWAL_CRON`, and `RESEND_WEBHOOK_SECRET` in Doppler prd.

---

## 8. Open items for the plan reviews
- W-9 / Platform DocuSeal conversion sizing (templates, countersigner suppression, the guard rewrite) for `/plan-eng-review`.
- Final Action Center trigger placement (board header vs persistent top bar) for `/plan-ceo-review`.
- Dual-taxonomy unification timing.
