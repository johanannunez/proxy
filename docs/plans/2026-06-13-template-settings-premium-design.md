# Signature Template Settings: Premium Control Surface

**Date:** 2026-06-13
**Status:** Approved
**Context:** DocuSeal-backed signature templates in the Proxy STR co-hosting
admin (`/admin/paperwork/templates/[id]` → Settings tab). Multi-tenant: each
operator (org) reuses a template to send to many of their own clients.

## Problem

The template Settings page is read-only and thin. "Ready to sign" is computed
as `docuseal_template_id != null && is_active`, which does not verify that
signers actually have fields. There is no way to edit a typo, customize the
document title, or control how the document is sent (email copy, reminders,
expiration, pre-filled data, access protection).

## 1. Ready-to-sign verification (rework)

Rule (approved): a template is **Ready** only when **every role in the signing
order has at least one field assigned to it** in the DocuSeal builder. A signer
with zero fields has nothing to do, so this catches the real mistake.

- Computed from DocuSeal's template `fields` (each field carries its submitter
  role) and the template's `submitters`. Source of truth, never stale.
- On **Done** (`activateTemplate`): fetch the DocuSeal template, map fields to
  roles, and verify coverage. If any signing role has zero fields, do **not**
  activate; return the missing roles. The builder surfaces "Add a field for
  Owner before finishing." If all covered, activate and navigate.
- Settings **Status** line reflects this: "Ready to send", or
  "Needs fields for: Owner" with the specific roles, plus a "Place fields"
  shortcut to the builder.
- A new helper `getTemplateFieldCoverage(docusealTemplateId, signerRoles)`
  returns `{ ready: boolean, missingRoles: string[] }`.

## 2. Editable "About this template"

Inline-editable card. Edit safety per field:

| Field | Editable | Notes |
|---|---|---|
| Title | Always | The document's display title. Editing also renames the DocuSeal template (PATCH the DocuSeal template `name`) so the builder header and our heading stay in sync. |
| Name | Always | Internal display name in our UI. |
| Description | Always | Free text. |
| Document key | Until first send | The system identifier. Editable while no instance has been sent; then locked with a lock icon + tooltip ("Locked because documents have been sent under this key"). |
| Signer roles | Until first send | Changing signers changes the signing flow; safe only before any send. After first send, read-only with an explanation. |

Title sync detail: the title is what the user called "two places" — our page
heading (e.g. "Host Paper") and the DocuSeal document name (e.g. "Host
Agreement"). One edit updates both: persist `title` in our DB and PATCH the
DocuSeal template name.

Saving: per-field inline edit with optimistic update + a server action
(`updateTemplateMeta`), `revalidatePath` on success, inline error on failure.

## 3. Sending: premium per-template settings

Stored in a single `settings jsonb` column on `document_templates` for
extensibility (no migration per option). All optional; sensible defaults.

- **Email customization**: custom subject + message the recipient sees, with
  personalization tokens (`{{owner_name}}`, `{{property}}`, `{{first_name}}`)
  resolved per recipient at send time. Live preview.
- **Auto-reminders**: per-template cadence override (every N days, up to M
  times) feeding the existing reminder engine; falls back to the global default
  when unset.
- **Expiration**: signing link valid for N days; expired documents show as
  expired and can be re-sent.
- **After signing**: redirect URL (thank-you page) + CC emails (e.g. the
  operator's accountant) on the completed document.

### Pre-fill / merge data (approved, tenant-isolated)

When sending, auto-fill known fields (owner name, property address, date) from
the recipient and property records so the client does not retype what the
operator already has. **Strict org scoping:** the recipient picker and the
pre-fill data source query only `where org_id = <current org>`, so one
operator's clients can never appear for another operator's send. This rides on
the org_id isolation already in place; the design adds an explicit test
asserting cross-org recipients are never returned.

### Access PIN (approved)

Optional per-template access code. When set, the recipient must enter the PIN to
open the document (DocuSeal supports a submitter `phone`/`pin` style gate; if
not exposed, we gate at our signing-link redirect). Recommended for financial
documents (ACH, card authorization).

### Test send to yourself (approved)

One-click "Send me a test" that creates a throwaway submission to the operator's
own email so they see exactly what the client receives before a real send. The
test instance is tagged and excluded from coverage/metrics.

## 4. Coverage section (clearer explanation)

Keep the Track toggle, rewrite the copy to plain language:

> **Coverage tracking** — Turn this on to watch which owners still need this
> document. Tracked templates become a column in the Documents → Coverage view,
> so you can see at a glance who has signed, who is pending, and who has not been
> sent it yet, across all your owners. Off by default; turning it on does not
> send anything.

Add a tiny inline example/preview of the column it produces.

## Page layout (Settings tab)

1. **About** (editable: title, name, description, key, signer roles)
2. **Signing** (order summary, readiness status + missing roles, Place fields)
3. **Sending** (email, reminders, expiration, after-signing, pre-fill, access PIN, test send)
4. **Coverage** (clarified)
5. **Danger zone** (existing remove)

## Data model

`document_templates` gains:
- `title text` (nullable; falls back to `display_name` when unset)
- `settings jsonb not null default '{}'` (email/reminder/expiration/redirect/cc/prefill/pin config)

No change to signing-order storage (`signer_roles` array, Proxy last).

## Out of scope

- Per-template branding overrides (org branding already covers it)
- Locale/language of the signing experience
- SMS identity verification (add only on a real client request)

## Already fixed en route to this work

- DocuSeal upload (`/templates/pdf`), builder JWT + `data-token`, endless-save,
  clipped gate-step dropdown, "Done stalls on Finishing", signer-role "You"
  labeling, and the intuitive signing-order list. These shipped already.
