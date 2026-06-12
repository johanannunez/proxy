# Paperwork IA Amendment (Round 4.6)

**Date:** 2026-06-12
**Status:** Approved
**Amends:** 2026-06-12-paperwork-unification-design.md
**Placement:** Runs immediately after Round 4.5 merge, before Round 5.

## Why this amendment

Johan reviewed the merged Round 4.5 UI on localhost and identified five problems:
duplicate page header, pill overload, a redundant page-local search, the page
reading as a "glorified status checker", and Proxy catalog hardcodes (SecureDocs
and Setup column groups, the per-kind card row) that leak into tenant orgs.

The core correction: "forms are a kind, not a place" is true for **instances**
but false for **masters**. Managing a form library is a distinct activity from
chasing signatures. Reference product: Hubflo's Forms page (clean list, Send,
Duplicate, Archive, archived-count link).

## Three tabs: Documents | Forms | Templates

- **Documents** — tracked instances only. The verb tab. Needs Action queue is
  the hero at the top, then the instance list with stage meters. Kind filter
  chips: All · Signatures · Forms · Files. Nothing else.
- **Forms** — form masters, Hubflo-style list: name, response count,
  created/updated, row actions (Send, Share link, Duplicate, Archive). Archived
  forms collapse to a count link at top right. Row click opens the existing
  Build | Responses | Settings detail page.
- **Templates** — signature and PDF masters plus the Proxy library. Same list
  treatment as Forms (list, not thumbnail grid).

## Chrome strip on Documents

1. Delete the duplicate "Paperwork" h1. The breadcrumb bar keeps the name; the
   tabs and the "+ New document" button move up into the page top zone.
2. Delete the stats pill row (19 owners · 2 completed · 1 pending · 92 not sent).
3. Delete the page-local search box. Wire documents, forms, and owners into the
   global command palette (⌘K) as searchable entities.
4. Delete the per-kind card row (Setup 0 / Fee 0 / Wi-Fi 0 ...). The Forms tab
   replaces it. This also removes Proxy catalog leakage.

Result: Documents opens directly onto Needs Action.

## Coverage view (replaces the always-on matrix)

One mechanism answers daily use, tenant scale, and multi-tenancy:

- Each template (form or signature) gets a **"Track in coverage"** toggle plus a
  **category** field. Tracked templates become matrix columns; column groups
  derive from category. Proxy's SecureDocs/Setup layout becomes org
  configuration, not hardcode.
- The matrix lives under Documents as a view switch: **List | Coverage**. List
  is the default (confirmed by Johan). Coverage is the onboarding/sweep lens.
- Scale: small orgs render a small table; large orgs get owner search, sort by
  most-missing, pagination. Column count is admin-controlled via tracking.
- Every cell is actionable (premium item 9 pulled forward from Round 5): empty
  cell click opens a "Send X to [owner]" popover; sent cells offer Remind.

## Schema addition (small, deliberate)

`document_templates` gains:
- `tracked boolean not null default false`
- `category text` (nullable; groups coverage columns)

Backfill: Proxy org's existing matrix columns get `tracked = true` and
categories `securedocs` / `setup` matching today's groups, so the Proxy
experience is unchanged after migration.

## Empty states (premium item 10 pulled forward)

- Forms tab empty: Proxy pre-made library inline, "Start with one of these."
- Coverage view empty: "Track a template to see coverage across owners."

## Effect on Round 5

Items 9 and 10 are now done here. Round 5 shrinks to: marketing landing page,
seeding system templates, personalization tokens in bulk send (item 5), final
end-to-end verification, pre-launch checklist.
