# Paperwork Hub Redesign (Round 2): Create Flow, Signatures/Forms Hubs, Action Center, Board Tracking

**Date:** 2026-06-14
**Status:** Design validated section-by-section with the user via disposable on-screen previews (light + dark) in worktree `proxy-worktrees/paperwork-p1` on `localhost:4012`. Supersedes/extends the Round 1 design (`2026-06-14-paperwork-redesign-design.md`). Next step: phased build plan, then `/plan-ceo-review` + `/plan-eng-review` before code.

**Goal:** Turn the Paperwork section into one premium, coherent system built from a few reusable building blocks. Signatures and Forms become symmetric hubs (Templates + Activity); creating anything flows through one Apple-Pages-style Template Gallery; the Action Center becomes a real triage surface; and the Status Board becomes a living, template-driven compliance tracker.

Phase 1 (tabs restructure, Signatures tab, Action Center shell, board polish) is already built and committed (`61980606`) on branch `paperwork/phase-1` and renders against real data. This document is the design for everything Round 2 layers on top.

---

## 1. Information architecture

```
Paperwork
├─ Status Board   (default — cross-workspace completion matrix; now template-driven)
├─ Signatures
│   ├─ Templates ──→ your created docs up front (preview cards) + Proxy library + New
│   └─ Activity  ──→ every sent instance · filters · Seen column → right drawer
└─ Forms
    ├─ Templates ──→ form cards (icon/emoji + color) + Proxy library + New
    └─ Activity  ──→ submissions · filters · Seen column → right drawer
```

- **Signatures and Forms are symmetric.** Both land on **Templates** (an inline card gallery of everything you have already created, ready to send) with a sibling **Activity** sub-tab (the Hubflo-style ledger of sent instances). Same structure, same components, two datasets.
- **Templates is the landing view, inline, not a modal.** A modal appears only when you *create*.
- **Activity is a dense table** (default), card toggle optional. No count on the Activity sub-tab label (it is unbounded).
- **Cross-library switch:** each library names itself ("Forms library") and offers a quiet cross-link ("Need a signature instead? Signatures →").

### Naming (locked)
- Create buttons name the artifact: **New paperwork** (Status Board, opens the chooser), **New signature** (Signatures), **New form** (Forms).
- The instances view is **Activity** (never "Completions").
- The board summary reads **"N workspaces · M documents tracked"** (never "requirements").

---

## 2. The create flow + Template Gallery (one shared component)

Two steps, one modal:

1. **Type:** a segmented **Signature | Form** switch lives at the top of the modal. From the Status Board's "New paperwork" neither is pre-selected; from a hub it is pre-scoped (and still switchable, so you can flip mid-create without backing out).
2. **Template Gallery** (Apple-Pages "Choose a Template"): a category sidebar (All templates · Recents · Your templates · Proxy library · by-group), a search box, and a grid of large preview cards. **Blank** and **Generate with AI** are always pinned first under "Start fresh," then **Your templates**, then the **Proxy library**. Selecting a card rings it in brand; **Create** proceeds. Paginates/scrolls as the library grows.

The same gallery card language renders the hub's **Templates** view, so a template looks identical whether you are browsing it or starting from it. Signature cards show a real **document preview**; form cards show an **icon/color tile** (forms have no document image).

### Generate with AI
AI returns a complete starter, not just a body: **title, subtitle/summary, an emoji or icon, and the content** (questions for forms; document + suggested signer fields for signatures). Preview → Accept (drops into the editor pre-filled) or Regenerate.
- **Forms-AI exists today** (`AiGenerateSlideOver`) → ship first, extended to also emit title/summary/icon.
- **Signatures-AI is net-new and heavier** (generating an actual legal document) → fast-follow, UI designed now.

### User-created templates (first-class)
Anyone can build a signature or form, save it, and reuse/build off it. The library splits **Your templates** (org-scoped, `document_templates.org_id`) vs the **Proxy library** (system, `org_id = null`). "Save as template" promotes an existing doc. The data model already supports org-scoped templates; this is primarily UX.

### Icon picker (Notion-style)
A popover with a search box and two tabs — **Emoji** and **Icons** (a large, searchable Phosphor library, hundreds, with weight/color). Reusable on form appearance and signature templates; it is exactly what AI calls when it auto-picks one. Replaces the fixed icon grid on the Forms appearance card.

---

## 3. Activity (the ledger) + the drawer

### 3.1 Activity list
A dense, scannable table (the Hubflo "completions" pattern), filters across the top (**Property · Workspace · Document · Signer · Status**), each row opening the drawer:

```
 Document        Who            Status      Sent    Seen     Signed
 Card Auth       Alex Hirtle    ● Awaiting  Today   2:30 PM  —        →
 Host RA         Cassandra H.   ● Signed    May 4   May 4    May 4    →
```
The **Seen** column (client opened it) is highlighted in brand color — the premium engagement signal. Status pills: Awaiting (amber), Signed (green), Declined (red). For forms, columns become Submitted instead of Signed.

### 3.2 The drawer (right-side, shared shell)
Opens on row click; same shell for signatures and forms:
- **Header:** name + status chip + the contact (avatar, email, property/workspace), so "who" is answered instantly.
- **Timeline:** **Sent → Seen → Signed** (forms: Sent → Seen → Submitted) with timestamps. The Seen row pulls from DocuSeal viewed events (`viewedAt`, already stored).
- **Details (extracted):** every field the signer/submitter entered (name, date, phone, email…), like the Hubflo completion panel.
- **Signers** roster; **Actions:** Remind / Resend / View; completed swaps to **Download signed PDF** + **Certificate**.

**Build notes / honesty flags:**
- We **evolve the existing `DocumentDrawer`** (already has audit log, certificate, stage meter), not rebuild.
- **Field extraction for signatures is net-new plumbing**: form answers are already in our DB (easy); pulling a signer's entered field values back from DocuSeal (submission → values) is a new call. Forms get full extraction immediately; signatures get it once that call is wired.

---

## 4. Action Center (redesigned)

A right-side slide-over, three **collapsible** sections (**Needs attention · Expiring soon · Lapsed**). Validated in preview.

### 4.1 Cards (vertical, OpportunityCard-style)
```
 ✍ Card Authorization                          ● Overdue
 ────────────────────────────────────────────────────────
 👤 Alex Hirtle · Reyes Property · alex@email.com
 16 days waiting
 Alex opened it on Jun 2 but never signed. Two reminders
 have gone out, so a call will likely move it faster.
 [Signature] [Blocking onboarding] [2 reminders sent]
 Sent ●──● Seen ──○ Signed
 ────────────────────────────────────────────────────────
              Sent by Johanan · Jun 1
 [   Remind   ] [ Resend ] [ View ]
```
- Type icon + name + color-coded status badge; **who** prominent; a **big urgency headline**; a **plain-language "why" line**; **context chips** (kind, impact, reminder count); a **Sent→Seen→Signed mini-meter**; a **centered footer** (sent-by / validity); full-width actions.
- Severity color: Overdue/Lapsed red, Awaiting/Expiring amber, on badge + headline.
- Context-aware primary action: Remind / Request renewal / **Call owner** (lapsed).

### 4.2 Collapsible sections
Each section header is a tappable bar: a **tone dot** (brand/amber/red), a **Sora title** (sentence case), the **count** (stays visible when collapsed so nothing hides silently), and a **chevron** on the right that rotates. Lets the admin focus on one slice at a time.

### 4.3 Placement
The trigger moves **inline with the create button** in the page header (off its own row, off the edge). Count pill when items exist.

---

## 5. The send layer (forms and signatures)

Sending is a first-class object, not a reused public link. The Send sheet carries **audience + security**:

```
 WHO
  ○ Public link        anyone with the link
  ○ Entire workspace   every owner in [ Reyes ▾ ]
  ● Specific client    [ Alex Hirtle ▾ ]
 SECURITY
  [✓] Require access code   ••••  (4-digit PIN)
  [ ] Link expires after    [ 7 days ▾ ]
```
- **Specific client** mints a **per-recipient, tokenized link** bound to that contact: submissions auto-attribute, open/seen + completion flow into Activity and the board. Public and per-recipient links are genuinely different objects, wired separately (net-new wiring).
- **Access code (PIN)** gates opening; optional **expiration** for sensitive docs. The template settings already carry an "access PIN" concept.

---

## 6. Status Board: polish + tracking-by-default

### 6.1 Polish (Phase 1 follow-through)
- Real page **padding** off the nav (nothing edge-to-edge).
- **Status key** centered in the corner cell.
- **Color-coded kinds** (Signatures blue · Forms purple · Files green) carried down the column bands.
- **Search** moved to the far right; filter row reads as one cohesive bar with the top tabs.
- True **dashed ring** for "not sent" (it currently renders as a solid gray dot — a real bug).
- One **unified count line** ("N workspaces · M documents tracked"), replacing the duplicated caption + summary.
- Action Center trigger inline with the create button.

### 6.2 Tracking-by-default (the biggest workstream)
The board stops being a hard-coded list of ~16 requirements and becomes **driven by tracked templates**. This resolves the Round 1 "dual taxonomy" landmine by making templates the single source of truth for board columns.

- **Every template (form or signature) is tracked on the board by default**, with a per-template **Status Board tracking** toggle in Settings (replacing the stale "Coverage" copy entirely). Turn it off for one-off sends.
- **Scope = the unit of completion:** per **owner**, per **property**, or per **workspace**. The cell aggregates "done of total" across that unit (the board already understands all three scopes).
- **Assignment = which specific units are on the hook.** Two modes:
  - **Standing requirement:** tracked, auto-assigned to *everyone* in scope (compliance default). New owner/property → auto-instantiates the right "needed" requirements.
  - **Targeted send:** assigned only to the people/properties you send to. A per-owner doc sent to one person tracks just that person; the board never nags the others.
- **The knobs:** Track-on-board (is it a column at all) · Scope (counted how) · Assignment (for whom). The board reflects the assigned set, never the whole scope blindly.

```
 Standing  → everyone in scope assigned       → cell "1 of 3 signed"
 Targeted  → only chosen recipients assigned   → cell "0 of 1", complete when they sign
 Track off → one-off, lives only in Activity    → no board column
```

**Onboarding payoff:** declare scope on a template → tracking auto-creates the right requirements when an owner/property is added → the board shows what is outstanding → filter to a single property/owner to see exactly their compliance checklist. The auto-instantiation is real wiring and is the heaviest part of this workstream.

---

## 7. Forms hub specifics

- **Fill the empty space (no clutter):** each form shows questions · pending · answered · last activity · created, in card and list form.
- **"About this template" moves to the top** (a compact identity header always visible across Build / Responses / Settings; full About card leads Settings).
- **Autosave everywhere, on click-out/blur**, with a fast **"Saving… → Saved ✓"** microtransition (builder, appearance, settings). No save button.
- **Coverage copy retired**, replaced by the **Status Board tracking** card (§6.2).
- **Icon = the Notion-style picker** (§2).
- Form detail keeps Build / Responses / Settings; responses already show all submissions and in-progress detail.

---

## 8. Shared building blocks (built once, reused)

| Block | Used by |
|---|---|
| **Template Gallery** (modal) | create flow + both hub Templates views |
| **Template card** (doc preview / icon tile) | gallery + hub Templates |
| **Activity table + filters** | Signatures Activity + Forms Activity |
| **Right drawer** (timeline + extracted fields) | signature instances + form submissions |
| **Action Center card + collapsible section** | Needs attention / Expiring / Lapsed |
| **Send sheet** (audience + security) | every send |
| **Icon picker** (emoji + Phosphor) | form/signature appearance + AI auto-pick |
| **Status Board tracking** control | every template's Settings |

---

## 9. Risk register (carried + new)

1. **`spine.ts` `deriveDesiredRows` guard** silently corrupts DocuSeal state for templateId-null docs (W-9). Must be rewritten before any functional W-9/Platform conversion. (Round 1 landmine, still open.)
2. **Triple expiry systems** (`spine.ts`/`expiry.ts`/`normalizeStatus`) must be consolidated to one before the engine. (Round 1.)
3. **Free-text expiry dates** → DatePicker migration + backfill is a hard prerequisite for the engine. (Round 1.)
4. **Board tracking-by-default is the largest new workstream:** dynamic column derivation + auto-instantiation of requirements on new owner/property + migration from the fixed requirement set to tracked system templates. Risk: board width/noise (mitigated by kind bands, column pinning, search, one-off opt-out, sensible defaults).
5. **Signature field extraction** (DocuSeal submission → values) is net-new; forms extraction is free.
6. **Per-recipient tokenized send links** are net-new wiring (token table/route, attribution, seen tracking, access-code gate, expiration).
7. **Signatures-AI** generation is heavier than forms-AI; sequence as fast-follow.
8. **Disposable previews** (`app/preview/action-center`, `paperwork-hub`, `template-gallery`) must be **deleted before merge**.

---

## 10. Phasing (Round 2, on top of Phase 1)

- **R2-A — Status Board polish + tracking control (no engine):** padding, centered key, color-coded kinds, dashed not-sent, unified count line, inline trigger; add the per-template "Status Board tracking" toggle UI (default on) and retire the Coverage copy. Visible immediately.
- **R2-B — Shared blocks:** Template Gallery modal (type switch, Blank/AI/library), template cards (preview/tile), the icon picker, the Send sheet (audience + security UI). Wire create flow through the gallery.
- **R2-C — Hubs:** Signatures + Forms as Templates + Activity (cards, table, filters, cross-link, view toggle); the right drawer (evolve `DocumentDrawer`) with timeline + form-field extraction.
- **R2-D — Action Center redesign:** vertical cards + collapsible sections + inline trigger, wired to the real route.
- **R2-E — Send wiring (net-new):** per-recipient tokenized links + access code + expiration + attribution into Activity/board.
- **R2-F — Board tracking engine:** dynamic template-driven columns + auto-instantiation on new owner/property + migration; depends on the Round 1 spine/expiry/date prerequisites where it touches expiry.
- **R2-G — AI + signature field extraction:** forms-AI emits title/summary/icon; DocuSeal field-extraction; signatures-AI fast-follow.

Autosave, "About to top," and the Forms metadata fill ride along with R2-C (Forms hub).

---

## 11. External actions for Johan (walked through during build)
1. Confirm the searchable Phosphor icon set source (local SVGs at `workspace/_assets/icons/phosphor` vs `@phosphor-icons/react`).
2. Decide AI provider/budget for forms-AI metadata generation (reuses existing OpenRouter wiring).
3. Stripe Card Account Updater + OpenPhone/Resend/cron env gates (carried from Round 1 for the expiry engine).
