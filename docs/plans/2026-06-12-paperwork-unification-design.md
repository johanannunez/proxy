# Paperwork Unification Design

**Date:** 2026-06-12
**Status:** Approved (IA + all 10 premium upgrades)
**Placement:** Round 4.5 — runs after Phase 3 convergence merges, before Round 5 (public launch). Round 5's template marketplace builds on this structure, so this must land first.

---

## Problem

The admin Paperwork section grew into four sibling pages that split one product across artificial seams:

| Today | Problem |
|---|---|
| Documents (`/admin/paperwork`) | The real hub (matrix, queue, search), but only one of four siblings |
| Forms (`/admin/paperwork/forms`) | A form is not a different product from a document; it is a document type |
| Responses (`/admin/paperwork/responses`) | A form's responses live on a different page than the form itself |
| Templates (`/admin/paperwork/templates`) | Only knows signature documents; forms cannot be templates |

Johan's mental model, which this design adopts: Paperwork is one product. A document is something you create once (uploaded PDF with signature fields, or a built form), save for reuse, and send to many clients. Responses belong with their form.

---

## The Model: Three Words, Three Meanings

- **Paperwork** — the section. The whole job of getting documents to clients and getting things back.
- **Documents** — instances. A specific thing sent to or collected from a specific client ("Alex's W-9", "Casey's Property Setup"). Has status (needed, sent, signed, on file) and a timeline.
- **Templates** — masters. Reusable definitions: a signature document (PDF + fields) or a form. One template, many sends; every send creates a document instance.

**"Forms" stops being a nav concept.** A form is a template whose instances collect responses instead of signatures. Its builder and its responses live on the same page.

---

## Sidebar: Before and After

```
BEFORE                          AFTER
Operations                      Operations
├─ Properties                   ├─ Properties
├─ Paperwork ▾                  ├─ Paperwork        ← single item, no children
│  ├─ Documents                 ├─ Projects
│  ├─ Forms                     └─ Pulse
│  ├─ Responses
│  └─ Templates
├─ Projects
└─ Pulse
```

The nav item stays named **Paperwork** (not "Documents") because Documents is already the first tab and the name of the instances; using one word three ways is the confusing version. Paperwork → Documents → Templates reads clean.

---

## The Paperwork Page

One page, two tabs, one global create button:

```
Paperwork
[ Documents ]  [ Templates ]               [+ New document]
─────────────
```

**Documents tab (default):** today's hub unchanged — Needs Action queue, owner matrix, SecureDocs/Setup groupings, global search, bulk operations (remind/request/waive/send).

**Templates tab:** one library grid, both kinds side by side:
- Card: type badge (Signature / Form), title, sent count, response count (forms), Send + Edit actions
- Filter chips: All | Signature | Forms, and later (Round 5) Your templates | Proxy library
- Absorbs the current standalone Templates page (DocuSeal management) and the Forms list page

---

## Inside a Template

**Form template** (`/admin/paperwork/templates/[id]`), three tabs:
- **Build** — the existing drag-and-drop builder (with the new conditional logic editor)
- **Responses** — everything clients submitted: list, detail view, CSV export (reuses the ResponsesHub components built in Round 2)
- **Settings** — publish state, public link, sharing

**Signature template**, same shape minus responses:
- **Fields** — DocuSeal field placement
- **Settings**

Per-form-only decision (confirmed): the global Responses page is deleted. No cross-form roll-up page. Recent submissions still surface via the Today cockpit and Needs Action queue.

---

## The Create Flow

**+ New document** (Paperwork header + global "+" quick-create) opens a chooser with three paths:

1. **From a template** — your library + pre-made Proxy library
2. **Upload a PDF** — straight into DocuSeal field placement
3. **Build a form** — straight into the form builder

Whatever is created is saved as a template automatically (create once, reuse forever).

**Send to many:** from any template card → Send → multi-select owners/properties → one tracked document instance per client appears in the Documents tab.

---

## URLs and Redirects (nothing 404s)

| Old | New |
|---|---|
| `/admin/paperwork` | unchanged (Documents tab) |
| `/admin/paperwork/templates` | unchanged (Templates tab content, rendered in the shared shell) |
| `/admin/paperwork/forms` | redirect → `/admin/paperwork/templates?type=form` |
| `/admin/paperwork/forms/[id]/edit` | redirect → `/admin/paperwork/templates/[id]` (Build tab) |
| `/admin/paperwork/forms/[id]/responses` | redirect → `/admin/paperwork/templates/[id]?tab=responses` |
| `/admin/paperwork/responses` | redirect → `/admin/paperwork/templates?type=form` |

Command palette and sidebar search entries updated to match.

---

## Kind, Not Place

"Signature" is a kind of document, not a tab. The Documents tab gets kind filter chips
(`All · Signatures · Forms · Files`), and template cards carry kind badges
(`Signature` / `Form`, with `File request` as a natural future third type for
"send me your insurance cert" requests). The matrix's existing SecureDocs vs Setup
column groups already prove this taxonomy. Rationale: an unsigned agreement, an
unfilled setup form, and a missing insurance certificate are all the same kind of
outstanding to the admin and to the client; splitting them across tabs re-creates
the seam this design removes.

---

## Premium Upgrades (approved, all ten)

Benchmarked against PandaDoc, DocuSign, and Jobber. Items 1-4 and 6-8 ship in
Round 4.5 (the surfaces they touch are being rebuilt anyway); items 5, 9, 10 ship
in Round 5 where they slot into marketplace and onboarding work.

### Round 4.5 scope

1. **Package-tracking stage meter on every document row.** Horizontal
   `Created ── Sent ── Viewed ── Signed ── On file` meter, current stage lit in
   brand gradient, ambient in the Documents list (not buried in a detail view).
   All events already stored; pure UI.
2. **Human status language, verb-first.** Statuses read as sentences naming who
   owes what: "Waiting on Alex to sign · 13 days", "Casey filled this out
   yesterday", "Expires in 12 days". No label-speak anywhere user-facing.
3. **Engagement signals.** "Viewed 2h ago" chips on rows and in the drawer
   timeline, from the DocuSeal viewed events already flowing into
   `document_events`.
4. **Send sheet with live client preview.** The send flow's right pane renders
   exactly what the recipient will see (their portal card + the email) before
   sending. Doubles as error prevention.
6. **Certificate of completion.** Signed documents get an audit panel in the
   drawer: full event log, signer email + IP (DocuSeal provides), downloadable
   completion certificate.
7. **Visible automation.** "Auto-reminder goes out Thursday" shown on each
   waiting document, with per-document mute. The reminder engine becomes a
   visible feature instead of a hidden setting.
8. **Real thumbnails on template cards.** First page of the PDF or first fields
   of the form rendered as the card image. No icon grids.

### Round 5 scope

5. **Personalization tokens in bulk send.** `{{first_name}}`, `{{property}}`
   resolved per recipient, previewable per recipient inside the send sheet.
9. **Matrix as action surface.** Empty matrix cell click → one-click popover
   "Send W-9 to Alex".
10. **Library-as-empty-state.** Empty Templates tab shows the Proxy pre-made
    library inline ("Start with one of these"); the zero state is onboarding.

---

## What This Changes for Round 5

The "template marketplace" stops being its own surface. System templates (Property Owner Intake, Inspection Report, Guest Survey, Property Welcome Guide, Block Dates) become the **Proxy library** filter inside the Templates tab, and the "From a template" path in the create chooser. Round 5's scope shrinks to: marketing landing page, seeding the system templates, final end-to-end verification, pre-launch checklist.

---

## Out of Scope

- Owner portal (workspace) — untouched; packets already unify the client-facing side
- Data model — no schema changes required; this is IA and UI reorganization over the existing spine, form, and template tables
- Workspace-level "Documents" naming — unchanged
