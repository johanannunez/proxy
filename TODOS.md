# TODOS

Deferred work with enough context to pick up cold. Newest first.

---

## Make `persistSubmission` transactional + error-checked (data integrity)

- **What:** In `apps/web/src/lib/documents/signing.ts` (`persistSubmission`, ~166-374), the `documents` UPDATE (source→`signed_document`, status→`sent`, `sent_at`) and the `document_signers` INSERT are two separate awaited writes with no transaction and no error check, and they run after `createSubmission` has already created the DocuSeal submission. Wrap them atomically (a Postgres RPC/transaction) and check both results.
- **Why:** A partial failure leaves a **live remote signature** while local state says "never sent" (`source='manual'`, no `sent_at`, possibly no signers). This is the root cause that forced the signature hard-delete gate to add a fail-closed DocuSeal verification (D1) and to redefine `templateHasBeenSent`. It also silently corrupts the Status Board matrix and send counts.
- **Pros:** Removes a real data-integrity hole; lets the delete gate drop the DocuSeal round-trip and go local-only; fixes edit-lock and board accuracy at the source.
- **Cons:** Touches the hot core signature send path; needs careful regression testing of the full DocuSeal send flow.
- **Context:** Discovered during the signature hard-delete eng-review (2026-06-16, workflow `wf_308dc6c8-878`). Order today: insert `documents` stub (`source='manual'`) → `createSubmission` (DocuSeal) → `persistSubmission` (update + signers insert). The second send path `decision-authority-actions.ts:225-291` is more atomic (sets `source='signed_document'` in the INSERT) and is a good reference shape.
- **Depends on / blocked by:** Nothing. Should land before anyone tries to simplify the hard-delete gate back to local-only.

## Before a fork UI ships: scope reminder-config cleanup to the row's own ownership

- **What:** `deleteTemplate` calls `deleteReminderConfigForKey(template.org_id, template.document_key)`. `forkSystemTemplate` (template-actions.ts) clones a system template into a TENANT row reusing the same `document_key`. If a fork is ever created with `org_id = PROXY_ORG_ID` (00000000-0000-0000-0000-000000000001) on a seeded key, deleting that never-sent fork would delete the `(PROXY_ORG_ID, document_key)` reminder cadence the still-existing system flow relies on.
- **Why:** Silent reminder-cadence loss for the system signature flow.
- **Pros:** Closes a sharp data-corruption footgun before forks become reachable.
- **Cons:** Adds a uniqueness check (or a fork-target restriction) to a path that has no value yet.
- **Context:** NOT triggerable today — `forkSystemTemplate` has zero callers (grep), and every UI-reachable custom template currently has `org_id = null` (so `deleteReminderConfigForKey` early-returns and the cleanup is inert). Surfaced by the signature hard-delete adversarial review (2026-06-16, workflow wf_0eaedd8a-d99, data lens). Fix options: (a) only delete reminder config when no other `document_templates` row holds the same `(org_id, document_key)`; (b) refuse to fork onto `PROXY_ORG_ID`; (c) gate cleanup on the row being the unique owner of that `(org_id, document_key)`. Add a test that a fork delete leaves the system flow's config intact.
- **Depends on / blocked by:** Only matters once `forkSystemTemplate` is wired to a UI and org-scoped templates with real reminder config become deletable.

## (Low) Close the hard-delete TOCTOU window

- **What:** A send that lands between `countTemplateSendEvidence` and the row `DELETE` in `deleteTemplate` is not caught (point-in-time count, no lock).
- **Why:** Tiny but real race; could orphan a just-sent document.
- **Pros:** Fully closes the delete-safety story.
- **Cons:** Needs a transaction or advisory lock around count+delete; not worth it for a rare manual-vs-manual race.
- **Context:** Recorded in `docs/plans/2026-06-16-signature-hard-delete-plan.md` (Residual risk). Naturally resolved if the `persistSubmission` transaction TODO above lands and the gate moves to a single atomic check.
- **Depends on / blocked by:** Easiest after the `persistSubmission` transaction fix.
