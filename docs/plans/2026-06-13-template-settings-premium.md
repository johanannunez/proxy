# Premium Template Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the signature-template Settings page into an editable, premium per-template control surface with trustworthy "ready to sign" verification.

**Architecture:** Add `title` + `settings jsonb` to `document_templates`. Compute readiness from DocuSeal field/role coverage. Make About inline-editable (title also renames the DocuSeal template). Add a Sending block (email, reminders, expiration, redirect/CC, org-scoped pre-fill, access PIN, test send). All settings live in the jsonb blob. Pure logic (coverage, token resolution, tenant scoping) is unit-tested with vitest; UI is built and screenshot-verified on port 4000.

**Tech Stack:** Next.js 16 App Router, Supabase, DocuSeal REST API, TypeScript strict, vitest, CSS Modules.

**Source design:** `docs/plans/2026-06-13-template-settings-premium-design.md`

**Conventions:** run from `apps/web/` with `doppler run --project proxy --config dev --`. `pnpm exec tsc --noEmit`, `pnpm exec vitest run`. Commit after each task. Migrations applied via Supabase MCP (not `supabase` CLI). Screenshot auth: `node screenshot.mjs <url> <label> --dev-login`.

---

## Phase A — Data model + readiness (highest value)

### Task A1: Migration — title + settings jsonb

**Files:**
- Create: `supabase/migrations/20260613090000_template_settings.sql`

```sql
alter table public.document_templates add column if not exists title text;
alter table public.document_templates
  add column if not exists settings jsonb not null default '{}'::jsonb;
```

Apply via Supabase MCP `apply_migration` (name `template_settings`, project `pwoxwpryummqeqsxdgyc`). Then extend `document-templates-types.ts` (`DocumentTemplate` gains `title: string | null`, `settings: TemplateSettings`) and `normalizeTemplate` to default them (`title ?? null`, `settings ?? {}`). Define `TemplateSettings` type (all optional): `email?: {subject?: string; message?: string}`, `reminders?: {everyDays: number; maxCount: number} | null`, `expiresInDays?: number | null`, `afterSign?: {redirectUrl?: string; cc?: string[]}`, `prefill?: boolean`, `accessPin?: string | null`.

Commit: `feat(db): add title and settings to document_templates`.

### Task A2: DocuSeal field-coverage helper (TESTED)

**Files:**
- Modify: `apps/web/src/lib/signing/docuseal.ts` (add `getTemplateFields(templateId)` → calls `GET /templates/:id`, returns `fields: Array<{name, role}>` mapped from DocuSeal's `fields[].submitter_uuid` → `submitters[].name`)
- Create: `apps/web/src/lib/signing/field-coverage.ts` — pure `computeCoverage(fields: {role:string}[], signerRoles: string[]): {ready: boolean; missingRoles: string[]}`. Map DocuSeal "Proxy"/role names to signerRoles; a role is covered if ≥1 field has that role.
- Test: `apps/web/src/lib/signing/__tests__/field-coverage.test.ts`

**Step 1 (failing test):**
```ts
import { computeCoverage } from "../field-coverage";
test("missing role when a signer has no fields", () => {
  const r = computeCoverage([{ role: "Proxy" }], ["Owner", "Proxy"]);
  expect(r.ready).toBe(false);
  expect(r.missingRoles).toEqual(["Owner"]);
});
test("ready when every signer has a field", () => {
  const r = computeCoverage([{ role: "Owner" }, { role: "Proxy" }], ["Owner", "Proxy"]);
  expect(r.ready).toBe(true);
  expect(r.missingRoles).toEqual([]);
});
```
Run `pnpm exec vitest run src/lib/signing/__tests__/field-coverage.test.ts` → FAIL. Implement → PASS. Commit `feat(signing): field-coverage helper`.

### Task A3: Wire readiness into activateTemplate

**Files:**
- Modify: `apps/web/src/app/(admin)/admin/paperwork/templates/template-actions.ts` (`activateTemplate`): load the template, fetch DocuSeal fields, `computeCoverage(fields, signer_roles)`. If not ready, return `{ ok: false, error: "Add a field for: " + missingRoles.join(", ") }` and do NOT set `is_active`. Else activate. Return `{ ok: true }`.
- Modify: `DocuSealBuilderView.tsx` `handleFinish` to surface the returned error inline (a small banner) instead of only resetting the button.

Manual verify: build a template, click Done with no Owner field → blocked with "Add a field for: Owner"; add an Owner field → Done activates and navigates. Commit `feat(paperwork): block ready until every signer has a field`.

### Task A4: Settings Status reflects real readiness

**Files:**
- Modify: `templates/page.tsx` (or a server helper) to compute coverage for the detail view, and `[id]/SignatureTemplateDetail.tsx` Status row to show "Ready to send" or "Needs fields for: <roles>" with a "Place fields" link to the Fields tab.

Commit `feat(paperwork): show missing-field roles in template status`.

---

## Phase B — Editable About + title sync

### Task B1: updateTemplateMeta server action (TESTED where logic exists)

**Files:**
- Modify: `template-actions.ts` add `updateTemplateMeta(id, { title?, display_name?, description?, document_key?, signer_roles? })`. Guards: `document_key` and `signer_roles` rejected if the template has any sent instance (query `documents` for `document_key`); return a clear error. On `title` change, also PATCH the DocuSeal template name (`PATCH /templates/:id { name }`) via a new `renameDocuSealTemplate(templateId, name)` in `docuseal.ts`.
- Modify: `document-templates.ts` add `templateHasBeenSent(documentKey): Promise<boolean>` (reuse `listTemplateSendCounts` logic or a direct count).
- Test: `__tests__/template-meta.test.ts` for the "locked after send" guard using a mocked DB (assert it returns an error when sent count > 0). If mocking the service client is heavy, cover `templateHasBeenSent` logic indirectly; otherwise keep the guard test at the action layer with a stubbed helper.

Commit `feat(paperwork): editable template meta with title->DocuSeal sync`.

### Task B2: Inline-editable About card UI

**Files:**
- Modify: `[id]/SignatureTemplateDetail.tsx` `SignatureSettings` — make Title, Name, Description inline-editable (pencil → input → save/cancel, optimistic, inline error). Document key: editable only when `!templateHasBeenSent`; else show lock icon + tooltip. Signer roles: editable (reuse the signing-order list pattern from `CreateTemplateModal`) only when not sent; else read-only with note.
- Build + screenshot verify on port 4000 (light; admin shell has no dark mode).

Commit `feat(paperwork): inline-editable About section`.

---

## Phase C — Sending settings block

### Task C1: Personalization token resolver (TESTED)

**Files:**
- Create: `apps/web/src/lib/documents/tokens.ts` — `resolveTokens(template: string, ctx: {firstName?; ownerName?; property?}): string`. Replaces `{{first_name}}`, `{{owner_name}}`, `{{property}}`; unknown tokens left as-is.
- Test: `__tests__/tokens.test.ts` (resolves known, preserves unknown, handles missing ctx).

Commit `feat(documents): personalization token resolver`.

### Task C2: Settings persistence action

**Files:**
- Modify: `template-actions.ts` add `updateTemplateSettings(id, settings: Partial<TemplateSettings>)` (admin-gated, org-checked) merging into the jsonb and `revalidatePath`.

Commit `feat(paperwork): persist per-template send settings`.

### Task C3: Sending UI (email, reminders, expiration, after-signing)

**Files:**
- Create: `[id]/SendingSettings.tsx` (+ `.module.css`) rendered in `SignatureSettings`. Email subject/message inputs with a live preview pane resolving sample tokens (uses C1). Reminder cadence (every N days, max M) with a "use global default" off state. Expiration (N days, CustomSelect or number). After-signing redirect URL + CC emails (chip input).
- No bare `<select>`/`<input type=date>`; use `CustomSelect`/`DatePickerInput`. Build + screenshot verify.

Commit `feat(paperwork): email/reminder/expiration/after-sign settings`.

### Task C4: Org-scoped pre-fill recipient source (TESTED for isolation)

**Files:**
- Modify: the send recipient query (`templates/page.tsx` / `lib/admin/documents-hub.ts` `fetchDocumentsHubData`) to confirm `org_id` scoping; add `prefill` toggle in settings; at send time, pass owner/property values into the DocuSeal submission `values`/`fields` (extend `lib/documents/signing.ts` `sendTemplateToOwner`).
- Test: `__tests__/recipient-scope.test.ts` — given two orgs each with a client, the recipient list for org A never includes org B's client. Mock the DB layer to assert the query filters by org_id (assert the `.eq("org_id", orgA)` filter is applied / results exclude foreign org).

Commit `feat(paperwork): org-scoped owner pre-fill with isolation test`.

### Task C5: Access PIN

**Files:**
- Modify: settings UI adds an optional Access PIN input (4–8 digits). At open time, gate the signing link: if `accessPin` set, our signing-link route requires the PIN before redirecting to DocuSeal (or pass through DocuSeal's submitter gate if available). Store hashed PIN in settings (not plaintext).
- Test: `__tests__/access-pin.test.ts` for the PIN check helper (correct PIN passes, wrong fails).

Commit `feat(paperwork): per-template access PIN`.

### Task C6: Test send to self

**Files:**
- Modify: `template-actions.ts` add `sendTestToSelf(templateId)` creating a DocuSeal submission to the current admin's email, tagged `test`, excluded from coverage/metrics. Settings UI adds a "Send me a test" button with success/error feedback.

Commit `feat(paperwork): test-send-to-self`.

---

## Phase D — Coverage clarity

### Task D1: Rewrite Coverage card copy

**Files:**
- Modify: `[id]/CoverageSettingsCard.tsx` — replace the terse copy with the plain-language explanation from the design, add a tiny inline preview of the column it produces.

Commit `feat(paperwork): clearer Coverage explanation`.

---

## Final verification

- `pnpm exec tsc --noEmit` clean.
- `pnpm exec vitest run` all pass (new suites: field-coverage, tokens, recipient-scope, access-pin, template-meta).
- `next build` succeeds.
- Screenshot the Settings page (About editable, Sending block, Coverage) + the builder readiness block on port 4000.
- Apply both migrations via Supabase MCP and confirm columns exist.
