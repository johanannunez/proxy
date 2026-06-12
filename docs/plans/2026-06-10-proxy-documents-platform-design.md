# Proxy Documents Platform: Full Design

**Date:** 2026-06-10
**Status:** Approved for implementation

---

## Overview

Transform the Proxy documents section into a standalone, multi-tenant, white-label capable platform that rivals PandaDoc, DocuSeal, and Jobber Forms. The platform is purpose-built for property managers, architected to expand to other verticals after product-market fit.

The product has two surfaces:
- **Operator admin**: where property managers run their business and manage their clients
- **Client portal**: what their owners, tenants, and clients see and interact with

Both surfaces are premium, responsive, and polished to the standard of the best document products on the market.

---

## Goals

1. Make the documents section a unified, world-class product (forms + signatures + document management as one experience)
2. Make Proxy a self-serve multi-tenant platform (any property manager can sign up)
3. Support white-label as a premium tier (client-facing surfaces fully branded to the operator)
4. Rival the UX quality of PandaDoc, DocuSeal, Jobber Forms, and Dropbox Sign
5. Enable parallel Fable 5 sub-agent dispatch for the entire build

---

## Target Customer

**Primary (launch):** Property management companies and short-term rental operators. They manage a portfolio of owner clients who each need to sign agreements, upload compliance documents, and fill out property setup forms during onboarding.

**Expansion (post product-market fit):** Any service business with a client onboarding workflow: landscaping, cleaning, contracting, legal, financial advisory. The data model is generic. The launch templates and language are property-management-specific.

---

## URL and Routing Model

### Standard tier (no white-label)

```
Operator admin:     acme.myproxyhost.com/admin
Client portal:      acme.myproxyhost.com/workspace
Signing links:      acme.myproxyhost.com/sign/[token]
Form links:         acme.myproxyhost.com/f/[slug]
```

Client sees: operator logo, operator brand colors, "Powered by Proxy" footer. Emails sent from `noreply@myproxyhost.com` with operator name as sender.

### White-label tier

```
Operator admin:     acme.myproxyhost.com/admin  (unchanged)
Client portal:      portal.acme.com
Signing links:      portal.acme.com/sign/[token]
Form links:         portal.acme.com/f/[slug]
```

Client sees: only operator branding. No Proxy mention anywhere. Emails sent from `noreply@acme.com` (operator verifies their sending domain via Resend). Operator sets up a single CNAME pointing to Proxy infrastructure.

### Tenant routing

Subdomain identifies the tenant. The middleware reads the host header, looks up the org by slug (or custom domain for white-label), and injects org context into every request. No path-based tenant slugs.

---

## Build Strategy: Parallel Tracks + Convergence

Two tracks run simultaneously as parallel Fable 5 agent workstreams. They converge in Phase 3.

```
Round 1-3: Track A (Documents Product)   +   Track B1 (Organizations Layer)
Round 2-4: Track A continues             +   Track B2 (Data Isolation)
Round 3-5: Track A continues             +   Track B3 (Signup + Billing)
Round 6:   Phase 3 (Convergence + White-label)
Round 7:   Phase 4 (Public Launch)
```

Track A and Track B do not conflict at the code level. Spine migration and UI work do not touch RLS policies. Org table work does not touch component code. They merge cleanly in Phase 3.

---

## Track A: Documents Product

All six workstreams are dispatchable as parallel Fable 5 agents in isolated worktrees.

---

### Workstream A1: Data Foundation

**Goal:** One source of truth for all documents. No more dual-table situation.

- Migrate all writes away from `signed_documents` to the `documents` spine
- Migrate all reads away from `signed_documents` to the `documents` spine
- Drop `signed_documents` table after verified migration
- Unify `property_forms` into the `documents` spine: each completed setup section (wifi_info, guidebook, setup_basic, etc.) becomes a `documents` row with `source = 'property_form'`
- Retire the `property_forms` table after verified migration
- Resolve the `org_id` vs `workspace_id` column inconsistency across documents-related tables (standardize on `org_id` at the org level, `workspace_id` at the client level)
- Add missing indexes for the new query patterns (org_id + status, workspace_id + document_key, expires_at for cron jobs)

**Files in scope:**
- `supabase/migrations/` (new migration files)
- `src/lib/documents/` (all files)
- `src/lib/signing/docuseal.ts`
- `src/lib/admin/documents-hub.ts`
- `src/lib/admin/workspace-documents.ts`
- `src/app/api/admin/documents/backfill/route.ts`

---

### Workstream A2: Workspace Portal (Client Experience)

**Goal:** The client experience feels like a guided mission, not a file cabinet.

**Document packets as the primary CTA:**
- Replace the flat list of documents with a packet concept
- "Your Owner Package" renders as a single card with an item count and overall completion percentage
- Clicking the packet opens a full-screen stepper: one item per step, progress bar at top, back/next navigation
- Each step shows: document title, description, what it is and why it matters, the action button (sign, upload, fill)
- The stepper remembers position: if the owner closes and returns, they land on the first incomplete step

**Document completion celebration:**
- When all required documents are complete, the portal shows a proper completion state
- Animated checkmark, "You're all set" headline, summary of what was completed, clear what-happens-next message
- Not a list of all-green checkmarks. A moment.

**Urgency-first information architecture:**
- Documents organized by: action required now, coming up, and complete
- Not organized by document taxonomy (agreement, W-9, setup form)
- The owner's question is "what do I need to do?" not "what category is this?"

**Inline PDF preview:**
- On-file documents show a PDF thumbnail inline. No download required to confirm what was submitted.
- Clicking the thumbnail opens a full-screen preview modal.

**Activity timeline per document:**
- Each document shows a collapsible timeline: created, sent, viewed, signed, countersigned, on file
- Timestamps relative ("3 days ago") with absolute on hover
- "Viewed" event pulled from DocuSeal webhook `form.viewed`

**Mobile-first signing:**
- Audit and fix the DocuSeal embedded iframe on iPhone Safari (scrolling, touch targets, viewport)
- Verify signing completion flow on mobile end-to-end

**Branded signing experience:**
- Pass operator logo URL and primary color to DocuSeal submission API on creation
- DocuSeal supports `customization` object on template submissions
- Operator's brand appears inside the signing iframe, not DocuSeal's default branding

**Files in scope:**
- `src/app/(workspace)/workspace/documents/DocumentsHub.tsx`
- `src/app/(workspace)/workspace/documents/signing-actions.ts`
- `src/lib/documents/workspace.ts`
- New: `src/components/workspace/documents/DocumentPacket.tsx`
- New: `src/components/workspace/documents/PacketStepper.tsx`
- New: `src/components/workspace/documents/CompletionCelebration.tsx`
- New: `src/components/workspace/documents/DocumentTimeline.tsx`
- New: `src/components/workspace/documents/PDFPreviewModal.tsx`

---

### Workstream A3: Reminders and Expiry Engine

**Goal:** Zero manual follow-up required for routine document collection.

**Automated reminder sequences:**
- Admin configures per-document-type reminder cadence: day 3, day 7, day 14 (defaults provided, overrideable)
- Each reminder checks: is document still unsigned/incomplete? If yes, send. If no, skip.
- Day 14 reminder also sets `is_urgent = true` and sends admin notification
- Channels: email (Resend), SMS (if configured), Hospitable message (if workspace is linked)
- Reminder state tracked in a new `document_reminders` table: document_id, sent_at, channel, round (1, 2, 3)

**Expiry workflow:**
- Cron job runs daily: find all documents where `expires_at` is within 60 days and status is `on_file`
- Sets `status = 'expiring'` for documents within 30 days
- Admin dashboard expiry card: "N documents expire in the next 30 days" with owner list
- One-click send renewal request to all expiring owners from the expiry card
- Owner receives renewal request with context: "Your card authorization expires June 30. Please re-sign."
- Post-expiry: cron sets `status = 'expired'`, triggers admin notification

**New tables:**
```sql
document_reminders (
  id uuid,
  document_id uuid references documents,
  sent_at timestamptz,
  channel text, -- 'email' | 'sms' | 'message'
  round int,    -- 1, 2, 3
  delivered bool
)

document_reminder_config (
  org_id uuid,
  document_key text,
  round_1_days int default 3,
  round_2_days int default 7,
  round_3_days int default 14,
  channels text[] default '{email}'
)
```

**Vercel cron jobs (or Trigger.dev in mission-control):**
- `/api/cron/document-reminders` — runs daily, dispatches due reminders
- `/api/cron/document-expiry` — runs daily, updates expiry statuses, queues renewal requests

**Files in scope:**
- New: `src/app/api/cron/document-reminders/route.ts`
- New: `src/app/api/cron/document-expiry/route.ts`
- New: `src/lib/documents/reminders.ts`
- New: `src/lib/documents/expiry.ts`
- `src/lib/documents/lifecycle.ts` (add expiry state transitions)
- `supabase/migrations/` (document_reminders, document_reminder_config tables)
- `vercel.json` or `vercel.ts` (add cron schedule entries)

---

### Workstream A4: Admin Power Tools

**Goal:** Admin sees what needs action, takes it in one click, never has to hunt.

**Admin action queue:**
- New tab in the paperwork hub: "Needs Action"
- Items surfaced: declined signatures (need resend), documents stuck in `under_review` for more than 3 days, documents expiring within 30 days, pending countersignatures, unsigned documents past day 7
- Each item shows: owner name, document type, status, days waiting, one-click action button
- The matrix tab remains for the full overview. The action queue is the daily driver.

**Bulk operations:**
- Checkbox column added to the matrix view
- Select all, select by column (e.g. all owners missing W-9)
- Bulk action bar appears on selection: Remind, Request, Waive, Send
- Bulk remind: sends the next reminder round to all selected
- Bulk request: opens the request composer pre-populated with selected owners and document types
- Bulk waive: confirms then waives all selected documents

**Global document search:**
- Search bar in the paperwork hub header
- Searches across: owner name, document type label, status, notes
- Results show owner name, document type, status, last activity
- Clicking a result opens the DocumentDrawer for that owner/document

**Activity timeline in admin:**
- DocumentDrawer and WorkspaceDocumentDrawer both show the full activity timeline
- Same component as the workspace portal timeline (shared)

**Files in scope:**
- `src/app/(admin)/admin/paperwork/DocumentsHub.tsx`
- `src/app/(admin)/admin/paperwork/DocumentDrawer.tsx`
- `src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx`
- `src/app/(admin)/admin/workspaces/[workspaceId]/WorkspaceDocumentDrawer.tsx`
- `src/lib/admin/documents-hub.ts`
- New: `src/app/(admin)/admin/paperwork/ActionQueue.tsx`
- New: `src/components/admin/documents/BulkActionBar.tsx`
- New: `src/components/admin/documents/DocumentSearch.tsx`

---

### Workstream A5: Forms Builder Upgrades

**Goal:** The form builder is a first-class product that operators are proud to use.

**Conditional logic:**
- New field property: `conditions` array on each field
- Condition structure: `{ field: fieldId, operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty', value: string }`
- Multiple conditions combined with AND or OR
- Live preview in the builder reflects conditional visibility in real time
- Conditions evaluated client-side during form fill; also validated server-side on submit

**Form responses unified view:**
- New top-level section in the paperwork hub: "Responses"
- Shows all form responses across all forms, filterable by form, respondent, property, date range
- Row-level view: respondent name, form name, submitted date, property, status
- Click row to see full response
- CSV export from the filtered view

**Files in scope:**
- `src/app/(admin)/admin/paperwork/forms/[id]/edit/FieldPropertyPopover.tsx`
- `src/app/(admin)/admin/paperwork/forms/[id]/edit/FormBuilderCanvas.tsx`
- `src/app/(admin)/admin/paperwork/forms/[id]/edit/FormPreviewPanel.tsx`
- `src/lib/admin/forms-types.ts` (add conditions to FormField type)
- `src/lib/admin/forms.ts`
- New: `src/app/(admin)/admin/paperwork/responses/page.tsx`
- New: `src/app/(admin)/admin/paperwork/responses/ResponsesHub.tsx`

---

### Workstream A6: Premium UI/UX Redesign

**Goal:** Every surface rivals the best document products on the market. Premium aesthetics, extreme attention to detail, fully responsive.

**Workspace portal documents section:**
- Design language: clean, airy, high-contrast typography, generous whitespace
- Packet cards: elevated surfaces with subtle gradient, property thumbnail or icon, progress ring
- Stepper: full-screen focus mode, one thing at a time, no distractions
- Status indicators: color-coded with motion (pulse animation on urgent, checkmark reveal on complete)
- Empty states: illustrated, contextual, clear next action
- Loading states: skeleton screens, not spinners

**Admin paperwork section:**
- Matrix view: denser but not cluttered, sticky header columns, alternating row tints
- Action queue: card-based, each card has clear visual weight indicating urgency
- Document drawer: two-column layout on desktop (metadata left, timeline right)
- Bulk selection: smooth checkbox animation, persistent action bar with count badge
- Search: instant results, keyboard navigable

**Shared design requirements:**
- All transitions use `transform` and `opacity` only. No `transition-all`.
- Every clickable element has hover, focus-visible, and active states
- Consistent use of Phosphor icons throughout
- Dark mode verified for both portal and admin
- Mobile breakpoints verified at 375px, 768px, 1280px minimum

**Files in scope:** All components touched by workstreams A2-A5 plus shared tokens and component library updates.

---

## Track B: Multi-tenant Foundation

Three sub-phases run sequentially. Each round of Track B can overlap with Track A rounds.

---

### Sub-phase B1: Organizations Layer

**New tables:**

```sql
organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,           -- used for subdomain: acme.myproxyhost.com
  plan_tier text not null default 'starter', -- 'starter' | 'pro' | 'white_label'
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  role text not null,                  -- 'org_owner' | 'org_admin' | 'org_member' | 'org_viewer'
  invited_by uuid references profiles,
  joined_at timestamptz default now(),
  unique (org_id, profile_id)
)

organization_branding (
  org_id uuid primary key references organizations on delete cascade,
  logo_url text,
  favicon_url text,
  primary_color text default '#0F172A',
  accent_color text default '#6366F1',
  font_heading text default 'Inter',
  font_body text default 'Inter',
  custom_domain text unique,           -- portal.acme.com (white_label only)
  email_sender_name text,              -- 'Acme Property Management'
  email_sender_domain text,            -- 'acme.com' (white_label only)
  powered_by_proxy bool default true,  -- false on white_label plan
  updated_at timestamptz default now()
)

organization_settings (
  org_id uuid primary key references organizations on delete cascade,
  features jsonb default '{}',         -- feature flags per tier
  limits jsonb default '{}'            -- max_workspaces, max_members, etc.
)
```

**Seed migration:** Proxy itself becomes `organization #1`. Existing admin profiles become `org_owner` members of org #1. All existing data is backfilled with org #1's ID in the following sub-phase.

**Auth context:** Session cookie or JWT custom claim updated to carry `org_id`. Middleware resolves org from subdomain and injects into request context. Every server action and API route reads org from context, never from client input.

---

### Sub-phase B2: Data Isolation

**Column additions (non-destructive):**
- Add `org_id uuid references organizations` to all 40+ tables that lack it
- Column added as nullable first
- Backfill: set `org_id = proxy_org_id` for all existing rows
- Add `not null` constraint after backfill is verified
- Add index on `org_id` for every table

**Tables receiving `org_id`:**
properties, bookings, payouts, invoices, subscriptions, stripe_customers, messages, conversations, tasks, treasury_accounts, treasury_transactions, treasury_snapshots, activity_log, onboarding_drafts, owner_facts, notifications, owner_kyc, document_group_settings, signed_documents (before drop), workspace_requests, workspace_request_items, contacts, profiles, and any remaining tables without it.

**RLS rewrite:**
- New helper functions:
  ```sql
  create function is_org_admin(target_org_id uuid) returns bool
  create function is_org_member(target_org_id uuid) returns bool
  create function current_org_id() returns uuid  -- reads from session claim
  ```
- All 98+ `is_admin()` checks replaced with `is_org_admin(org_id)` checks
- Owner-scoped policies updated to also check `org_id = current_org_id()`
- Service role retains full access for cron jobs and server-side operations

**Subdomain middleware update (`src/proxy.ts`):**
- On each request, extract subdomain from host header
- Look up `organizations` table by slug (cached, 60s TTL)
- For white-label custom domains: look up by `organization_branding.custom_domain`
- Inject `org_id`, `org_slug`, `plan_tier`, `branding` into request headers
- All downstream server components and actions read from headers, never from client

---

### Sub-phase B3: Self-serve Signup and Billing

**Public signup flow:**
1. Landing page CTA: "Start free" → `/signup`
2. Step 1: Name, email, password
3. Step 2: Company name, subdomain selection (live availability check), industry (property management pre-selected)
4. Step 3: Plan selection (Starter free, Pro, White-label)
5. Step 4: Stripe payment (skipped for Starter)
6. Creates org, creates org_owner member, seeds default templates, redirects to onboarding wizard

**Onboarding wizard (4 steps, shown once after signup):**
1. Upload your logo, set your brand colors (previews the portal live)
2. Invite your first client (enter email, system creates workspace and sends welcome)
3. Send your first document (pick a template, send signature request)
4. Set up your first form (pick a template or start blank)

**Plan tiers:**

| Feature | Starter | Pro | White-label |
|---------|---------|-----|-------------|
| Client workspaces | Up to 10 | Unlimited | Unlimited |
| Team members | 1 (owner only) | Up to 5 | Unlimited |
| Forms | Basic (no conditions) | Conditional logic | Conditional logic |
| Signatures | Yes | Yes | Yes |
| Automated reminders | No | Yes | Yes |
| Bulk operations | No | Yes | Yes |
| Custom subdomain | Yes (myproxyhost.com) | Yes (myproxyhost.com) | Yes (own domain) |
| Remove Proxy branding | No | No | Yes |
| Custom email domain | No | No | Yes |
| Template marketplace | Read only | Read + create | Read + create |
| Analytics | Basic | Advanced | Advanced |
| Price | Free | $X/mo | $Y/mo |

**Billing portal:**
- Accessible from operator settings: `/admin/settings/billing`
- Shows current plan, next invoice date, invoice history
- Upgrade/downgrade with immediate effect and prorated credit
- Stripe Customer Portal used for payment method management

---

## Phase 3: Convergence and White-label

Runs after Track A workstreams are verified complete and Track B sub-phases B1-B3 are verified complete.

**Documents features scoped to org:**
- All Track A query functions updated to filter by `org_id` from request context
- Forms and templates now org-owned: `PROXY_ORG_ID` hardcode removed
- Document templates: system templates (org_id = null) remain shared across all tenants, custom templates scoped to org
- Reminder configs scoped to org

**Branding settings UI:**
- New settings page: `/admin/settings/branding`
- Upload logo (stored in Supabase Storage, public bucket)
- Color pickers for primary and accent
- Font selection (curated list of premium Google Fonts)
- Live preview pane: shows what the client portal looks like with current settings
- Toggle: show/hide "Powered by Proxy" (locked off on white-label plan, locked on for other plans)

**White-label custom domain setup:**
- Settings page: `/admin/settings/domain`
- Operator enters their domain (e.g. `portal.acme.com`)
- System generates a CNAME target: `proxy-tenant.myproxyhost.com`
- Step-by-step DNS setup instructions shown inline
- Domain verification: system polls for CNAME propagation, shows live status
- Once verified: custom domain becomes active, client portal serves from it
- SSL: handled by Vercel (automatic certificate provisioning for custom domains)

**Custom email sending domain (white-label only):**
- Operator enters their sending domain in settings
- System generates Resend DNS records (SPF, DKIM, DMARC)
- Instructions shown inline with copy buttons
- Verification status live-polled
- Once verified: all emails to their clients sent from operator's domain

---

## Phase 4: Public Launch

**Marketing landing page (`myproxyhost.com`):**
- Hero: "The document platform property managers trust"
- Feature sections: forms, signatures, client portal, white-label
- Pricing table (Starter / Pro / White-label)
- Social proof (logo wall, testimonials)
- CTA: "Start free" → signup flow

**Template marketplace:**
- Accessible to all tenants from the forms and templates section
- Property management category ships at launch: lease agreement, W-9, property setup form, inspection report, guest survey, property welcome guide, block dates form
- Operators can publish their own templates to the marketplace (Pro and White-label plans)
- Templates installable in one click: creates a copy in the operator's org

**Operator documentation:**
- Getting started guide
- How to set up your first client
- How to send a signature request
- How to build a form
- How to set up white-label

**Launch sequence:**
1. Waitlist opens during Phase 3 (collect signups, build list)
2. Hand-pick 10-20 beta operators during Phase 3 (existing property manager contacts)
3. Beta feedback round (2 weeks)
4. Fix critical feedback
5. Public signup opens

---

## Agent Dispatch Strategy

Each workstream and sub-phase is designed as an isolated unit dispatchable to a Fable 5 sub-agent in its own git worktree.

**Round 1 (parallel):**
- Agent A1: Workstream A1 (Data Foundation)
- Agent A2: Workstream A2 (Workspace Portal)
- Agent B1: Sub-phase B1 (Organizations Layer)

**Round 2 (parallel, after Round 1 merges):**
- Agent A3: Workstream A3 (Reminders + Expiry Engine)
- Agent A4: Workstream A4 (Admin Power Tools)
- Agent B2: Sub-phase B2 (Data Isolation, depends on B1)

**Round 3 (parallel, after Round 2 merges):**
- Agent A5: Workstream A5 (Forms Builder Upgrades)
- Agent A6: Workstream A6 (Premium UI/UX Redesign)
- Agent B3: Sub-phase B3 (Self-serve Signup + Billing, depends on B2)

**Round 4 (sequential):**
- Phase 3: Convergence + White-label (depends on all Round 3 agents complete)

**Round 5 (parallel):**
- Marketing landing page
- Template marketplace
- Operator documentation

**Verification step between every round:**
- Run `pnpm exec tsc --noEmit` from `apps/web/`
- Run `pnpm exec vitest run` from `apps/web/`
- Manual smoke test of affected flows
- Grep for target patterns to verify sweep completeness (before/after counts)

---

## Non-Goals (Out of Scope for This Plan)

- Mobile native apps (iOS/Android)
- Real-time collaborative document editing (Google Docs-style)
- Video or image attachments in forms (file upload only)
- Docusign or HelloSign as a signing provider (DocuSeal is confirmed)
- Per-property subdomain routing (workspace-level is the right granularity)
- API keys for third-party integrations (post-launch)
- Self-hosted deployment option

---

## Key Files Reference

| Area | Key Files |
|------|-----------|
| Documents spine | `src/lib/documents/workspace.ts`, `signing.ts`, `lifecycle.ts`, `status.ts` |
| Admin documents | `src/lib/admin/documents-hub.ts`, `documents-hub-shared.ts`, `workspace-documents.ts` |
| Forms | `src/lib/admin/forms.ts`, `forms-types.ts` |
| Templates | `src/lib/admin/document-templates.ts`, `document-templates-types.ts` |
| Signing | `src/lib/signing/docuseal.ts` |
| Workspace portal | `src/app/(workspace)/workspace/documents/DocumentsHub.tsx` |
| Admin paperwork | `src/app/(admin)/admin/paperwork/DocumentsHub.tsx`, `DocumentDrawer.tsx` |
| Per-workspace | `src/app/(admin)/admin/workspaces/[workspaceId]/DocumentsTab.tsx` |
| Middleware | `src/proxy.ts` |
| Migrations | `supabase/migrations/` |
