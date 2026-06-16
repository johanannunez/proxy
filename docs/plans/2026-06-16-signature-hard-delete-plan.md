# Signature Template Hard-Delete Implementation Plan

> **For Claude:** REQUIRED: take this through `/plan-eng-review` before any code.

**Goal:** Let an admin permanently delete a signature template that was never meaningfully sent, freeing its `document_key`, mirroring the proven Forms delete-or-archive pattern. A template that has been sent stays archive-only (`deactivateTemplate`).

**Architecture:** New service-role DB helper + a usage-evidence counter + a guarded server action, plus a Danger-zone UI in `SignatureTemplateDetail` that shows "Delete completely" when safe and "Delete unavailable" + reason (with Archive) when not. Gate logic is extracted as a pure function for unit testing.

**Tech Stack:** Next.js server actions, Supabase service client, DocuSeal adapter, motion/react, CSS modules, vitest.

---

## Context

R4-E shipped for Forms (`canDeleteForm = response_count === 0` → hard delete; else "Delete unavailable / Archive instead"). Signatures only got soft delete (`deactivateTemplate` sets `is_active=false`). The user's R4-E ask was specifically signatures: *"delete a signature if it wasn't used, that removes any document key... compliant and does not break."* This plan closes that gap.

### Recon findings that shape the design (worktree `paperwork-p1`)

1. **No incoming FKs** to `document_templates` ([20260530180000_document_templates.sql](../../supabase/migrations/20260530180000_document_templates.sql)) → a hard DELETE cannot FK-fail. There is **no `slug` column**; the freed identifier is `document_key`.
2. Sent/signed documents link to a template **only by the free-text `documents.document_key`**, never by id. Deleting a template orphans every `documents` row under that key; afterward `resolveTemplateId`/`isSignatureDocumentKey` return null/false, which would break `signing.ts`, the Status Board matrix, send counts, and the `document_reminder_config (org_id, document_key)` row.
3. **`persistSubmission` is non-transactional and unchecked** ([signing.ts:166-374](../../apps/web/src/lib/documents/signing.ts)). A partial failure can leave real `document_signers` rows (DocuSeal submission created) while `documents.source` is still `'manual'`. So `templateHasBeenSent` (source-only) **under-reports** and is unsafe as the only gate.
4. `document_key` is **not globally unique**: one system row (`org_id NULL`) and per-org forks share the same key (`forkSystemTemplate` reuses it). A key-scoped usage check **over-locks** (a sibling's send blocks deleting an unused fork). Over-lock is safe; under-lock is the hazard.
5. The 3 seeded signature templates (`host_rental_agreement`, `ach_authorization`, `card_authorization`) are **`is_system=true`**; `deactivateTemplate` already refuses system rows. Hard delete must refuse them too.
6. DocuSeal **template** resource is created at template-creation time, so a never-sent template already owns an orphan-able remote template, but **zero submissions / zero signer PII / zero audit trail**. Remote cleanup is hygiene (a SHOULD), and `DELETE /templates/{id}` is an *archive*, not a purge. `document_key` is local-only; freeing it has no remote effect.
7. DELETE on `document_templates` is **service-role only** (RLS); `lib/admin/document-templates.ts` already uses the service client.

---

## The deletability gate (the crux)

```
deleteTemplate(id)
  │
  ├─ not admin? ───────────────────────────► reject "Not authorized"
  ├─ template.is_system? ─────────────────► reject "System templates cannot be deleted"
  │
  ├─ sendEvidenceCount(document_key) > 0? ─► reject "Documents have been sent under
  │     three MONOTONIC signals, by key K:        this signature. Archive it instead."
  │       (1) documents source='signed_document'
  │       (2) documents sent_at IS NOT NULL
  │       (3) any document_signers JOIN documents ON document_id WHERE documents.document_key=K
  │     CARVE-OUT (does NOT count as sent): a bare spine stub
  │       source='manual' AND sent_at IS NULL AND no signers
  │     (Status-enum dropped: a future status would silently under-lock, the dangerous
  │      direction. sent_at/source/signers only ever move forward, so they cannot under-count.)
  │
  ├─ [D1 — LOCKED: verify] docuseal_template_id set AND DocuSeal submissions check > 0?
  │       ─► reject (FAIL-CLOSED: the check THROWS on any unverifiable state — an
  │          HTTP/network error OR an unset token — and the action's catch blocks
  │          with "couldn't verify". It must never return false when unconfigured:
  │          a template that owns a remote id was built while configured, so a live
  │          submission may exist. Adversarial review caught this fail-open and fixed it.)
  │
  └─ all clear ─► delete document_reminder_config for (org_id, document_key)  [D3]
                  ─► DELETE document_templates row (frees document_key)
                  ─► best-effort archive remote DocuSeal template            [D4]
                  ─► revalidate paperwork routes; route back to Signatures
```

`sendEvidenceCount` counts **send-evidence by key**, not documents by key, with the stub carve-out. Status set assembled from `signing.ts` writes; reconcile against [status.ts](../../apps/web/src/lib/documents/status.ts) 9-state model in review.

---

## Files and changes

**Create / pure logic (testable):**
- `apps/web/src/lib/admin/template-deletability.ts` — pure `evaluateDeletability({ isSystem, sendEvidenceCount, hasRemoteSubmissions }): { canDelete: boolean; reason: string | null }`. No I/O. Unit-tested.

**`apps/web/src/lib/admin/document-templates.ts`:**
- `countTemplateSendEvidence(documentKey): Promise<number>` — one `documents` fetch by key (select `id, source, sent_at`) evaluated in JS for the three monotonic signals, plus a single `document_signers` existence check; applies the stub carve-out (service client). 1-2 queries.
- `templateHasBeenSent` redefined to `(await countTemplateSendEvidence(key)) > 0` (single source of truth; edit-lock inherits the stronger guarantee).
- `deleteDocumentTemplateRecord(id): Promise<boolean>` — `.from("document_templates").delete().eq("id", id)` (service client); mirrors `deleteForm`.
- `deleteReminderConfigForKey(orgId, documentKey)` — clears the dangling cadence row.

**`apps/web/src/app/(admin)/admin/paperwork/templates/template-actions.ts`:**
- `deleteTemplate(id)` after `deactivateTemplate`: `requireAdmin` → load template → refuse `is_system` → `countTemplateSendEvidence` (+ [D1] optional DocuSeal check) → `evaluateDeletability` → reminder-config cleanup → `deleteDocumentTemplateRecord` → best-effort `archiveDocuSealTemplate` → `revalidatePath`.

**`apps/web/src/lib/signing/docuseal.ts`:**
- `archiveDocuSealTemplate(templateId)` — `DELETE /templates/{id}`, best-effort (try/catch, log, never throw), mirroring the rename adapter. Uses the row's **own** `docuseal_template_id`, never a fork source.

**`apps/web/src/app/(admin)/admin/paperwork/templates/[id]/page.tsx`:**
- Compute deletability server-side (reuse `countTemplateSendEvidence`) and pass `canHardDelete` + `reason` to the detail component alongside existing `hasBeenSent`.

**`apps/web/src/app/(admin)/admin/paperwork/templates/[id]/SignatureTemplateDetail.tsx`:**
- Danger zone: when `canHardDelete`, add **"Delete completely"** (danger) opening a second `ConfirmModal variant="danger"`; else **"Delete unavailable"** (disabled, `description=reason`) and keep the existing Archive/deactivate. No `confirm()/alert()`.

---

## Decisions (LOCKED by /plan-eng-review 2026-06-16)

- **D1 — gate strength: VERIFY (1A).** Local three-signal predicate **+ a DocuSeal submissions check when `docuseal_template_id` is set, fail-closed** (block if DocuSeal unreachable). Closes the non-transactional no-local-evidence case. One extra API call on a rare admin action.
- **Usage check: UNIFY (2A).** The new send-evidence counter is the single source of truth; `templateHasBeenSent` is redefined as `count > 0`, so the edit-lock inherits the stronger guarantee. One definition of "used."
- **Tests: FULL (3A).** Pure gate + DB-helper (incl. signers-but-source=manual) + action (system/sent/DocuSeal-fail/reminder-cleanup) + UI render.
- **Root cause: TODO (4A).** The non-transactional `persistSubmission` fix is recorded in `TODOS.md`; this PR mitigates the delete-side effect via D1.
- **D2 — shared-key over-lock: ACCEPT.** Scope the count by `document_key` alone. Safe; cost is an unused org fork can't be deleted while a sibling under the same key has sent.
- **D3 — reminder-config orphan: CLEAN UP.** Delete matching `document_reminder_config` rows on hard delete.
- **D4 — DocuSeal remote cleanup: BEST-EFFORT NOW.** Archive the remote template, never blocking the local delete on a DocuSeal outage.

### Residual risk (accepted, not blocking)

- **TOCTOU:** a send that lands between the evidence count and the row delete is not caught (point-in-time count, no lock). Both are manual admin/owner actions, so the window is tiny. Recorded in `TODOS.md` as a low-priority hardening note; not closeable without a transaction or advisory lock.

---

## Tests (vitest)

- **`template-deletability.test.ts`** (pure): system → blocked; sendEvidenceCount>0 → blocked; hasRemoteSubmissions → blocked; all-zero → deletable; reason strings.
- **`countTemplateSendEvidence`** (mocked service client): each of the 4 signals non-zero → ≥1; bare needed-stub only → 0; decision-authority send path key → counted.
- **`deleteTemplate` action** (mocked): refuses system; refuses sent; never-sent deletes row + frees key + clears reminder-config; DocuSeal failure logs and does not block; non-admin rejected.
- **UI**: menu renders "Delete completely" vs "Delete unavailable" + reason by `canHardDelete`.

---

## Failure modes

- DocuSeal outage at delete: with D1, **fail-closed** (block with "couldn't verify, try again"). Remote cleanup (D4) is best-effort and logs.
- No-local-evidence partial failure: mitigated by D1; without D1 it is a silent unsafe delete (documented residual risk).
- Reused `document_key` later: D3 prevents stale reminder cadence; a fresh `docuseal_template_id` is minted on next create.

---

## Not in scope

- Making `persistSubmission` transactional (the root non-transactional bug). Flag as a separate TODO; D1 mitigates its effect on delete.
- Bulk delete, hard-deleting SENT templates (never allowed), and the R4-B persistent-shell refactor.
- Cleaning up already-orphaned `documents` rows (cascades to signers/reminders; out of scope and dangerous).

---

## Verification

1. `rm -rf apps/web/.next && pnpm exec tsc --noEmit` clean (ignore `.next/types`).
2. `pnpm lint` clean.
3. `pnpm exec vitest run` green for the new suites.
4. Manual on port 4000: a never-sent custom signature shows "Delete completely" and deleting frees the key (recreate with same key succeeds); a sent one shows "Delete unavailable" + Archive; a system template offers neither.
5. Advisor (Fable) review before merge. No migration is applied to Supabase (shared dev/prod).
