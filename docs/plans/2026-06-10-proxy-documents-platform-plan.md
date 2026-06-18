# Proxy Documents Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Proxy documents section into a self-serve, multi-tenant, white-label capable platform that rivals PandaDoc, DocuSeal, and Jobber Forms.

**Architecture:** Two parallel tracks (A: documents product improvements, B: multi-tenant foundation) run simultaneously as Fable 5 sub-agents in isolated worktrees, converging in Phase 3. Track A improves what users see immediately. Track B builds the invisible infrastructure. They do not conflict at the code level.

**Tech Stack:** Next.js 16.2.7 App Router, TypeScript 5.9.3 (strict), Supabase (Postgres + RLS), Tailwind CSS v4, Vitest, Doppler, DocuSeal, Stripe, Resend, Phosphor Icons, motion/react, pnpm

**Design doc:** `docs/plans/2026-06-10-proxy-documents-platform-design.md`

---

## Conventions (Read Before Any Task)

- **Dev server:** `doppler run -- next dev -p 4000` from `apps/web/`
- **Tests:** `pnpm exec vitest run` from `apps/web/`
- **Typecheck:** `pnpm exec tsc --noEmit` from `apps/web/`
- **Migrations:** files in `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
- **No `any`, no `@ts-ignore`, no `transition-all`**
- **Icons:** `@phosphor-icons/react` only
- **Animation:** `motion/react` not `framer-motion`
- **Imports:** `import "server-only"` on any module touching `createClient`
- **CSS:** Tailwind v4 tokens only, no raw hex colors in components
- **Images:** Next.js `<Image>` — rename files to bust cache, never overwrite
- **Commits:** describe WHY, not what

---

## Pre-flight (Run Once Before Dispatching Any Agents)

### Task 0.1: Verify baseline

```bash
cd /Users/johanannunez/workspace/proxy/apps/web
pnpm exec tsc --noEmit
pnpm exec vitest run
```

Expected: typecheck passes (or note existing errors), tests pass. Document any pre-existing failures so agents don't chase them.

### Task 0.2: Count target patterns for sweep verification

```bash
# Signed documents references (A1 must eliminate these)
grep -r "signed_documents" /Users/johanannunez/workspace/proxy/apps/web/src --include="*.ts" --include="*.tsx" -l | wc -l

# property_forms references (A1 must eliminate these)
grep -r "property_forms" /Users/johanannunez/workspace/proxy/apps/web/src --include="*.ts" --include="*.tsx" -l | wc -l

# is_admin() in RLS (B2 must eliminate these)
grep -r "is_admin()" /Users/johanannunez/workspace/proxy/supabase --include="*.sql" | wc -l

# PROXY_ORG_ID hardcode (Phase 3 must eliminate)
grep -r "PROXY_ORG_ID" /Users/johanannunez/workspace/proxy/apps/web/src --include="*.ts" --include="*.tsx" | wc -l
```

Record these baseline counts. After each round, rerun to verify progress.

### Task 0.3: Read the design doc

Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` in full before dispatching agents.

---

## Round 1 — Three Parallel Agents

Dispatch all three simultaneously. They touch different parts of the codebase and do not conflict.

---

## Agent A1: Data Foundation

**Dispatch prompt:**
> You are implementing Workstream A1 of the Proxy Documents Platform. Your job is to consolidate the documents data layer into a single source of truth. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Workstream A1" first. The codebase is at `/Users/johanannunez/workspace/proxy/apps/web`. Run all commands from `apps/web/`. Tests: `pnpm exec vitest run`. Typecheck: `pnpm exec tsc --noEmit`. Follow all tasks below in order.

---

### Task A1.1: Audit the dual-table situation

**Files to read:**
- `src/lib/documents/workspace.ts`
- `src/lib/signing/docuseal.ts`
- `src/lib/admin/documents-hub.ts`
- `src/lib/admin/workspace-documents.ts`
- `src/lib/workspace/property-forms.ts`

**Step 1:** Grep for all `signed_documents` reads and writes:
```bash
grep -rn "signed_documents" src/ --include="*.ts" --include="*.tsx"
```

**Step 2:** Grep for all `property_forms` reads and writes:
```bash
grep -rn "property_forms" src/ --include="*.ts" --include="*.tsx"
```

**Step 3:** Record counts. These must reach zero by end of A1.

---

### Task A1.2: Write migration to add missing columns to documents spine

**Create:** `supabase/migrations/20260610100001_documents_spine_columns.sql`

```sql
-- Add columns needed for property_form documents
alter table documents
  add column if not exists form_key text,           -- 'wifi_info', 'guidebook', etc.
  add column if not exists form_data jsonb,          -- the submitted form data
  add column if not exists reminder_sent_at timestamptz, -- last reminder timestamp
  add column if not exists reminder_count int default 0;

-- Index for expiry cron
create index if not exists idx_documents_expires_at
  on documents (expires_at)
  where expires_at is not null;

-- Index for status queries
create index if not exists idx_documents_workspace_status
  on documents (workspace_id, status)
  where workspace_id is not null;

-- Index for cron reminder queries
create index if not exists idx_documents_reminder
  on documents (status, reminder_sent_at)
  where status not in ('on_file', 'expired', 'waived');
```

**Step:** Apply via Supabase MCP `apply_migration` tool. Verify with `list_tables`.

---

### Task A1.3: Write migration to backfill property_forms into documents spine

**Create:** `supabase/migrations/20260610100002_backfill_property_forms.sql`

```sql
-- Backfill each property_forms row as a documents row
insert into documents (
  owner_id,
  workspace_id,
  property_id,
  document_key,
  title,
  status,
  source,
  scope_kind,
  visibility,
  form_key,
  form_data,
  completed_at,
  created_at,
  updated_at
)
select
  p.owner_id,
  null as workspace_id,
  pf.property_id,
  pf.form_key as document_key,
  initcap(replace(pf.form_key, '_', ' ')) as title,
  case when pf.completed_at is not null then 'on_file' else 'needed' end as status,
  'property_form' as source,
  'property' as scope_kind,
  'client' as visibility,
  pf.form_key,
  pf.data as form_data,
  pf.completed_at,
  now() as created_at,
  now() as updated_at
from property_forms pf
join properties p on p.id = pf.property_id
-- Skip if a documents row already exists for this property + form_key
where not exists (
  select 1 from documents d
  where d.property_id = pf.property_id
    and d.form_key = pf.form_key
    and d.source = 'property_form'
)
on conflict do nothing;
```

**Step:** Apply via Supabase MCP. Verify row count matches `property_forms` count.

---

### Task A1.4: Update workspace.ts to read from documents spine for property forms

**File:** `src/lib/documents/workspace.ts`

**Step 1:** Write a test first.

**Create:** `src/lib/documents/__tests__/workspace.test.ts` (or add to existing)

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('fetchWorkspaceDocumentHub', () => {
  it('includes property form documents from the spine', async () => {
    // Test that property_forms data comes from documents table
    // not from property_forms table directly
    // Mock Supabase client to return documents rows with source = 'property_form'
    // Verify they appear in the hub output
  })
})
```

**Step 2:** Run test to see it fail:
```bash
pnpm exec vitest run src/lib/documents/__tests__/workspace.test.ts
```

**Step 3:** In `workspace.ts`, remove the direct `property_forms` query. Instead query `documents` where `source = 'property_form'` to get form data. Keep the same output shape.

**Step 4:** Run test again. Verify pass.

**Step 5:** Typecheck:
```bash
pnpm exec tsc --noEmit
```

---

### Task A1.5: Migrate signed_documents reads to documents spine

**File:** `src/lib/admin/documents-hub.ts`

**Step 1:** For every query hitting `signed_documents`, rewrite to query `documents` with `source = 'signed_document'`.

Key mapping:
- `signed_documents.boldsign_document_id` → `document_signers.boldsign_document_id`
- `signed_documents.status` → `documents.status`
- `signed_documents.user_id` → `documents.owner_id`

**Step 2:** Typecheck:
```bash
pnpm exec tsc --noEmit
```

**Step 3:** Verify grep count dropped:
```bash
grep -rn "signed_documents" src/ --include="*.ts" --include="*.tsx" | wc -l
```

---

### Task A1.6: Migrate signed_documents writes to documents spine

**Files:** `src/lib/signing/docuseal.ts`, `src/lib/documents/signing.ts`

**Step 1:** Every `insert into signed_documents` → `insert into documents` with `source = 'signed_document'`.

Every `update signed_documents` → `update documents where id = ? and source = 'signed_document'`.

**Step 2:** Typecheck. Fix any shape mismatches.

**Step 3:** Run full test suite:
```bash
pnpm exec vitest run
```

---

### Task A1.7: Verify zero signed_documents and property_forms references remain

```bash
grep -rn "signed_documents" src/ --include="*.ts" --include="*.tsx"
grep -rn "property_forms" src/ --include="*.ts" --include="*.tsx"
```

Expected: zero results in application code (migrations are fine).

---

### Task A1.8: Commit

```bash
git add supabase/migrations/ apps/web/src/lib/documents/ apps/web/src/lib/admin/ apps/web/src/lib/signing/ apps/web/src/lib/workspace/
git commit -m "feat(data): consolidate documents into single spine, retire signed_documents and property_forms"
```

---

## Agent A2: Workspace Portal (Client Experience)

**Dispatch prompt:**
> You are implementing Workstream A2 of the Proxy Documents Platform. Your job is to rebuild the client-facing documents portal into a guided, premium experience. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Workstream A2" first. The codebase is at `/Users/johanannunez/workspace/proxy/apps/web`. Run all commands from `apps/web/`. Invoke the `frontend-design` and `ui-ux-pro-max` skills before writing any UI code. No `transition-all`. Icons from `@phosphor-icons/react`. Animation from `motion/react`. Follow all tasks below in order.

---

### Task A2.1: Invoke design skills

Before writing a single component, invoke:
1. `frontend-design` skill — for the document portal design language
2. `ui-ux-pro-max` skill — for palette, typography, effects

Use the output to drive all design decisions in this workstream.

---

### Task A2.2: Build DocumentPacket component

**Create:** `src/components/workspace/documents/DocumentPacket.tsx`

This component renders a single "packet" card (e.g. "Your Owner Package") with:
- Icon + packet title
- Completion ring (X of Y complete, animated SVG circle)
- Status label ("2 items need your attention" / "Complete")
- "Continue" / "Review" CTA button
- Subtle gradient surface, elevated shadow (not flat `shadow-md`)
- Hover: lift transform + shadow deepen

```typescript
interface DocumentPacketProps {
  title: string
  description: string
  items: PacketItem[]          // each with status, document_key, title
  onOpen: () => void
}
```

**Test:** `src/components/workspace/documents/__tests__/DocumentPacket.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { DocumentPacket } from '../DocumentPacket'

it('shows completion count', () => {
  render(<DocumentPacket
    title="Owner Package"
    description="Your core agreements"
    items={[
      { status: 'on_file', document_key: 'host_rental_agreement', title: 'Agreement' },
      { status: 'needed', document_key: 'w9', title: 'W-9' },
    ]}
    onOpen={() => {}}
  />)
  expect(screen.getByText('1 of 2 complete')).toBeInTheDocument()
})

it('shows all-complete state when every item is on_file', () => {
  render(<DocumentPacket
    title="Owner Package"
    description="Your core agreements"
    items={[{ status: 'on_file', document_key: 'host_rental_agreement', title: 'Agreement' }]}
    onOpen={() => {}}
  />)
  expect(screen.getByText('Complete')).toBeInTheDocument()
})
```

Run: `pnpm exec vitest run src/components/workspace/documents/__tests__/DocumentPacket.test.tsx`

---

### Task A2.3: Build PacketStepper component

**Create:** `src/components/workspace/documents/PacketStepper.tsx`

Full-screen overlay stepper (not a modal — takes the full viewport). Shows one document at a time.

Props:
```typescript
interface PacketStepperProps {
  packetTitle: string
  items: PacketItem[]
  currentIndex: number
  onNext: () => void
  onBack: () => void
  onClose: () => void
  onAction: (item: PacketItem) => void
}
```

UI structure:
- Fixed header: packet title + "X of Y" + close button
- Progress bar (thin, animated, fills left-to-right as steps complete)
- Main content: document title, description, what it is and why it matters, status badge
- Action button (sign / upload / fill / download depending on document state)
- Bottom nav: back button + next/done button
- Completed items show a checkmark and are skippable

**Test:** Verify stepper advances and calls onNext when next is clicked.

---

### Task A2.4: Build DocumentTimeline component

**Create:** `src/components/workspace/documents/DocumentTimeline.tsx`

Shared between workspace portal and admin (admin imports it too).

```typescript
interface TimelineEvent {
  event: 'created' | 'sent' | 'viewed' | 'signed' | 'countersigned' | 'on_file' | 'declined' | 'expired'
  timestamp: string   // ISO timestamp
  actor?: string      // "Proxy" | owner name
  note?: string
}

interface DocumentTimelineProps {
  events: TimelineEvent[]
  collapsed?: boolean
}
```

Each event renders as a vertical timeline item:
- Colored dot (green for positive, amber for pending, red for negative)
- Event label ("Viewed by owner", "Signed", "Countersigned by Proxy")
- Timestamp (relative, e.g. "3 days ago", absolute on hover via title attribute)

**Test:**
```typescript
it('renders events in chronological order', () => {
  render(<DocumentTimeline events={[
    { event: 'sent', timestamp: '2026-06-01T10:00:00Z' },
    { event: 'viewed', timestamp: '2026-06-02T14:00:00Z' },
    { event: 'signed', timestamp: '2026-06-02T14:03:00Z' },
  ]} />)
  const items = screen.getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Sent')
  expect(items[2]).toHaveTextContent('Signed')
})
```

---

### Task A2.5: Build PDFPreviewModal component

**Create:** `src/components/workspace/documents/PDFPreviewModal.tsx`

```typescript
interface PDFPreviewModalProps {
  fileUrl: string
  title: string
  open: boolean
  onClose: () => void
}
```

- Uses `<iframe src={fileUrl} />` at 100% width and height in a full-screen modal overlay
- Animated open/close using `motion/react` (opacity + scale from 0.97 to 1)
- Close button top-right with keyboard trap
- Download button in the header
- Backdrop click closes

---

### Task A2.6: Build CompletionCelebration component

**Create:** `src/components/workspace/documents/CompletionCelebration.tsx`

Shown when all required documents are complete. Full-screen or prominent section state.

- Animated checkmark (SVG path draw animation via `motion/react`)
- "You're all set" headline
- 3-line summary of what was completed ("Signed lease agreement, W-9 on file, Property setup complete")
- "What happens next" section (2-3 sentences explaining the next step in the process)
- Subtle confetti particles using CSS keyframe animations (no library needed — 6-8 absolute-positioned spans with random rotation and fall animations)

---

### Task A2.7: Rewrite DocumentsHub.tsx to use packets

**File:** `src/app/(workspace)/workspace/documents/DocumentsHub.tsx`

**Step 1:** Replace the flat document list with packet cards.

New layout:
- Page title: "Documents" + overall progress (X of Y complete)
- Packet cards grid (2 columns on desktop, 1 on mobile):
  - "Owner Package" (agreement, W-9, ID)
  - "Payment Setup" (fee, ACH, card auth)
  - "Property Setup" (all setup forms)
  - "Compliance" (permit, HOA, insurance)
- Clicking a packet opens the PacketStepper as a full-screen overlay
- When all packets complete: show CompletionCelebration instead of packet grid

**Step 2:** The new IA organizes by:
- **Action required** section first (packets with pending items)
- **In progress** section (packets started but not complete)
- **Complete** section (collapsed by default)

**Step 3:** Keep the per-property filter tabs (multiple properties still need filtering).

**Step 4:** Typecheck and run tests:
```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
```

---

### Task A2.8: Add branded signing to DocuSeal submission creation

**File:** `src/lib/signing/docuseal.ts`

When creating a submission, pass branding if org branding data is available:

```typescript
// In createSubmission or equivalent function:
const submissionPayload = {
  template_id: templateId,
  submitters: signers,
  // Add branding if available
  ...(brandingLogoUrl && {
    customization: {
      logo_url: brandingLogoUrl,
      primary_color: brandingPrimaryColor ?? '#0F172A',
    }
  })
}
```

For now, read branding from env vars (`DOCUSEAL_BRAND_LOGO_URL`, `DOCUSEAL_BRAND_COLOR`). These will be replaced by per-org settings in Phase 3.

---

### Task A2.9: Verify mobile signing on iPhone Safari

**Step 1:** Start dev server:
```bash
doppler run -- next dev -p 4000
```

**Step 2:** Using gstack browse, set mobile viewport and navigate to the signing flow:
```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B viewport 390x844
$B goto http://localhost:4000/workspace/documents
$B screenshot /tmp/mobile-documents.png
```

**Step 3:** Read the screenshot and identify: scrolling issues, touch target sizes, iframe overflow.

**Step 4:** Fix any issues found (typically: add `overflow: hidden` to iframe container, ensure `height: 100dvh` not `100vh` on mobile).

**Step 5:** Screenshot again and verify fix.

---

### Task A2.10: Commit

```bash
git add apps/web/src/components/workspace/ apps/web/src/app/\(workspace\)/workspace/documents/ apps/web/src/lib/signing/
git commit -m "feat(workspace): rebuild documents portal as guided packet workflow with timeline and completion celebration"
```

---

## Agent B1: Organizations Layer

**Dispatch prompt:**
> You are implementing Sub-phase B1 of the Proxy Documents Platform. Your job is to create the organizations, organization_members, organization_branding, and organization_settings tables, seed Proxy as org #1, and update the auth context to carry org_id. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Sub-phase B1" first. The codebase is at `/Users/johanannunez/workspace/proxy`. Migrations go in `supabase/migrations/`. Apply via Supabase MCP `apply_migration` tool. No UI changes in this workstream. Follow all tasks below in order.

---

### Task B1.1: Create organizations table

**Create:** `supabase/migrations/20260610000001_create_organizations.sql`

```sql
create table if not exists organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique
                    check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  plan_tier       text not null default 'starter'
                    check (plan_tier in ('starter', 'pro', 'white_label')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

select public.set_updated_at();
drop trigger if exists set_updated_at on organizations;
create trigger set_updated_at
  before update on organizations
  execute function public.set_updated_at();

-- RLS
alter table organizations enable row level security;

create policy "org members can read their org"
  on organizations for select
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organizations.id
        and om.profile_id = auth.uid()
    )
  );

create policy "service role full access"
  on organizations for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

Apply via Supabase MCP.

---

### Task B1.2: Create organization_members table

**Create:** `supabase/migrations/20260610000002_create_organization_members.sql`

```sql
create table if not exists organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        text not null check (role in ('org_owner', 'org_admin', 'org_member', 'org_viewer')),
  invited_by  uuid references profiles(id) on delete set null,
  joined_at   timestamptz not null default now(),
  unique (org_id, profile_id)
);

create index idx_org_members_profile on organization_members (profile_id);
create index idx_org_members_org on organization_members (org_id);

alter table organization_members enable row level security;

-- Members can read their own membership
create policy "members can read own membership"
  on organization_members for select
  using (profile_id = auth.uid());

-- Org admins can read all memberships in their org
create policy "org admins read all members"
  on organization_members for select
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_members.org_id
        and om.profile_id = auth.uid()
        and om.role in ('org_owner', 'org_admin')
    )
  );

create policy "service role full access"
  on organization_members for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

---

### Task B1.3: Create organization_branding table

**Create:** `supabase/migrations/20260610000003_create_organization_branding.sql`

```sql
create table if not exists organization_branding (
  org_id              uuid primary key references organizations(id) on delete cascade,
  logo_url            text,
  favicon_url         text,
  primary_color       text not null default '#0F172A',
  accent_color        text not null default '#6366F1',
  font_heading        text not null default 'Inter',
  font_body           text not null default 'Inter',
  custom_domain       text unique,
  email_sender_name   text,
  email_sender_domain text,
  powered_by_proxy    boolean not null default true,
  updated_at          timestamptz not null default now()
);

alter table organization_branding enable row level security;

create policy "org members can read branding"
  on organization_branding for select
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_branding.org_id
        and om.profile_id = auth.uid()
    )
  );

-- Public read for client portal (branding must be visible to unauthenticated clients)
create policy "public can read branding"
  on organization_branding for select
  using (true);

create policy "service role full access"
  on organization_branding for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

---

### Task B1.4: Create organization_settings table

**Create:** `supabase/migrations/20260610000004_create_organization_settings.sql`

```sql
create table if not exists organization_settings (
  org_id    uuid primary key references organizations(id) on delete cascade,
  features  jsonb not null default '{}',
  limits    jsonb not null default '{
    "max_workspaces": 10,
    "max_members": 1,
    "max_forms": 5,
    "max_templates": 3
  }'::jsonb
);

alter table organization_settings enable row level security;

create policy "org admins can read settings"
  on organization_settings for select
  using (
    exists (
      select 1 from organization_members om
      where om.org_id = organization_settings.org_id
        and om.profile_id = auth.uid()
        and om.role in ('org_owner', 'org_admin')
    )
  );

create policy "service role full access"
  on organization_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
```

---

### Task B1.5: Seed Proxy as org #1

**Create:** `supabase/migrations/20260610000005_seed_proxy_org.sql`

```sql
-- Insert Proxy as the founding organization
insert into organizations (id, name, slug, plan_tier)
values (
  '00000000-0000-0000-0000-000000000001',
  'Proxy',
  'proxy',
  'white_label'
)
on conflict (id) do nothing;

-- Seed branding for Proxy org
insert into organization_branding (org_id, powered_by_proxy)
values ('00000000-0000-0000-0000-000000000001', false)
on conflict (org_id) do nothing;

-- Seed settings for Proxy org (unlimited everything)
insert into organization_settings (org_id, limits)
values (
  '00000000-0000-0000-0000-000000000001',
  '{"max_workspaces": -1, "max_members": -1, "max_forms": -1, "max_templates": -1}'::jsonb
)
on conflict (org_id) do nothing;

-- Make all existing admin profiles org_owner of Proxy org
insert into organization_members (org_id, profile_id, role)
select
  '00000000-0000-0000-0000-000000000001',
  id,
  'org_owner'
from profiles
where role = 'admin'
on conflict (org_id, profile_id) do nothing;
```

---

### Task B1.6: Add helper functions for org-aware auth

**Create:** `supabase/migrations/20260610000006_org_auth_helpers.sql`

```sql
-- Returns the org_id from the current session claim (set by middleware)
-- Falls back to the Proxy default org during transition period
create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  )
$$;

-- Returns true if the current user is an admin of the given org
create or replace function is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from organization_members
    where org_id = target_org_id
      and profile_id = auth.uid()
      and role in ('org_owner', 'org_admin')
  )
  or auth.role() = 'service_role'
$$;

-- Returns true if the current user is any member of the given org
create or replace function is_org_member(target_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from organization_members
    where org_id = target_org_id
      and profile_id = auth.uid()
  )
  or auth.role() = 'service_role'
$$;
```

---

### Task B1.7: Add TypeScript types for org layer

**Create:** `src/types/organizations.ts`

```typescript
export type OrgPlanTier = 'starter' | 'pro' | 'white_label'
export type OrgMemberRole = 'org_owner' | 'org_admin' | 'org_member' | 'org_viewer'

export interface Organization {
  id: string
  name: string
  slug: string
  plan_tier: OrgPlanTier
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  org_id: string
  profile_id: string
  role: OrgMemberRole
  invited_by: string | null
  joined_at: string
}

export interface OrganizationBranding {
  org_id: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  accent_color: string
  font_heading: string
  font_body: string
  custom_domain: string | null
  email_sender_name: string | null
  email_sender_domain: string | null
  powered_by_proxy: boolean
  updated_at: string
}

export interface OrganizationSettings {
  org_id: string
  features: Record<string, boolean>
  limits: {
    max_workspaces: number   // -1 = unlimited
    max_members: number
    max_forms: number
    max_templates: number
  }
}

export const PROXY_ORG_ID = '00000000-0000-0000-0000-000000000001'
```

---

### Task B1.8: Write org query helpers

**Create:** `src/lib/organizations/index.ts`

```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Organization, OrganizationBranding } from '@/types/organizations'

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single()
  return data
}

export async function getOrgByCustomDomain(domain: string): Promise<Organization | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('*, organization_branding!inner(custom_domain)')
    .eq('organization_branding.custom_domain', domain)
    .single()
  return data
}

export async function getOrgBranding(orgId: string): Promise<OrganizationBranding | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('organization_branding')
    .select('*')
    .eq('org_id', orgId)
    .single()
  return data
}
```

---

### Task B1.9: Write tests for org helpers

**Create:** `src/lib/organizations/__tests__/index.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { getOrgBySlug } from '../index'

describe('getOrgBySlug', () => {
  it('returns null for unknown slug', async () => {
    // Mock Supabase to return null
    const result = await getOrgBySlug('unknown-slug-xyz')
    expect(result).toBeNull()
  })
})
```

Run: `pnpm exec vitest run src/lib/organizations/__tests__/`

---

### Task B1.10: Typecheck and commit

```bash
pnpm exec tsc --noEmit
git add supabase/migrations/20260610000001* supabase/migrations/20260610000002* supabase/migrations/20260610000003* supabase/migrations/20260610000004* supabase/migrations/20260610000005* supabase/migrations/20260610000006* apps/web/src/types/organizations.ts apps/web/src/lib/organizations/
git commit -m "feat(platform): add organizations layer with members, branding, settings tables and seed Proxy as org #1"
```

---

## Round 1 Verification (Before Dispatching Round 2)

After all three Round 1 agents complete and their branches are merged:

```bash
# Verify A1 completion
grep -rn "signed_documents" apps/web/src/ --include="*.ts" --include="*.tsx" | wc -l
# Expected: 0

grep -rn "property_forms" apps/web/src/ --include="*.ts" --include="*.tsx" | wc -l
# Expected: 0 (migrations are fine)

# Verify B1 tables exist
# Use Supabase MCP list_tables to confirm: organizations, organization_members,
# organization_branding, organization_settings

# Full test suite
cd apps/web && pnpm exec vitest run
cd apps/web && pnpm exec tsc --noEmit
```

---

## Round 2 — Three Parallel Agents

---

## Agent A3: Reminders and Expiry Engine

**Dispatch prompt:**
> You are implementing Workstream A3 of the Proxy Documents Platform. Your job is to build automated document reminder sequences and an expiry workflow. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Workstream A3" first. The codebase is at `/Users/johanannunez/workspace/proxy/apps/web`. The organizations tables from B1 are now in place. No UI work — this is backend and cron only. Follow all tasks below in order.

---

### Task A3.1: Create reminder tables migration

**Create:** `supabase/migrations/20260610110001_document_reminder_tables.sql`

```sql
create table if not exists document_reminders (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  sent_at     timestamptz not null default now(),
  channel     text not null check (channel in ('email', 'sms', 'message')),
  round       int not null check (round between 1 and 3),
  delivered   boolean not null default false
);

create index idx_doc_reminders_document on document_reminders (document_id);

create table if not exists document_reminder_config (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  document_key    text not null,
  round_1_days    int not null default 3,
  round_2_days    int not null default 7,
  round_3_days    int not null default 14,
  channels        text[] not null default '{email}',
  unique (org_id, document_key)
);

-- Seed default config for Proxy org covering all document keys
insert into document_reminder_config (org_id, document_key, round_1_days, round_2_days, round_3_days)
select
  '00000000-0000-0000-0000-000000000001',
  unnest(array[
    'host_rental_agreement', 'ach_authorization', 'card_authorization',
    'w9', 'identity', 'property_setup', 'wifi_info', 'guidebook'
  ]),
  3, 7, 14
on conflict do nothing;
```

Apply via Supabase MCP.

---

### Task A3.2: Write reminder logic library

**Create:** `src/lib/documents/reminders.ts`

```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface ReminderCandidate {
  document_id: string
  owner_id: string
  owner_email: string
  owner_name: string
  document_key: string
  document_title: string
  workspace_id: string | null
  org_id: string
  round: number           // which reminder round to send (1, 2, or 3)
  config_days: number     // days since creation this round fires
}

/**
 * Finds all documents that need a reminder sent today.
 * A document is eligible if:
 * - status is not 'on_file', 'expired', 'waived', 'declined'
 * - created_at is >= round_N_days ago
 * - no reminder of this round has been sent yet
 */
export async function findReminderCandidates(): Promise<ReminderCandidate[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('find_reminder_candidates')
  if (error) throw error
  return data ?? []
}

export async function sendDocumentReminder(candidate: ReminderCandidate): Promise<void> {
  // Send email via Resend
  await resend.emails.send({
    from: `Proxy <noreply@myproxyhost.com>`,
    to: candidate.owner_email,
    subject: `Reminder: ${candidate.document_title} is still needed`,
    html: buildReminderEmail(candidate),
  })

  // Record that we sent it
  const supabase = await createClient()
  await supabase.from('document_reminders').insert({
    document_id: candidate.document_id,
    channel: 'email',
    round: candidate.round,
    delivered: true,
  })

  // If round 3, also set is_urgent on the document
  if (candidate.round === 3) {
    await supabase
      .from('documents')
      .update({ is_urgent: true })
      .eq('id', candidate.document_id)
  }
}

function buildReminderEmail(candidate: ReminderCandidate): string {
  const urgencyNote = candidate.round === 3
    ? '<p><strong>This document is now overdue. Please complete it as soon as possible.</strong></p>'
    : ''
  return `
    <p>Hi ${candidate.owner_name},</p>
    <p>This is a reminder that your <strong>${candidate.document_title}</strong> is still needed.</p>
    ${urgencyNote}
    <p><a href="https://proxy.myproxyhost.com/workspace/documents">Complete it now</a></p>
  `
}
```

---

### Task A3.3: Create the find_reminder_candidates Postgres function

**Create:** `supabase/migrations/20260610110002_reminder_candidates_fn.sql`

```sql
create or replace function find_reminder_candidates()
returns table (
  document_id   uuid,
  owner_id      uuid,
  owner_email   text,
  owner_name    text,
  document_key  text,
  document_title text,
  workspace_id  uuid,
  org_id        text,
  round         int,
  config_days   int
)
language sql
security definer
as $$
  with reminder_status as (
    select
      d.id as document_id,
      d.owner_id,
      d.document_key,
      d.title as document_title,
      d.workspace_id,
      '00000000-0000-0000-0000-000000000001'::text as org_id,
      d.created_at,
      -- How many reminders already sent
      coalesce(max(dr.round), 0) as last_round_sent
    from documents d
    left join document_reminders dr on dr.document_id = d.id
    where d.status not in ('on_file', 'expired', 'waived', 'declined')
      and d.document_key is not null
    group by d.id
  ),
  next_round as (
    select
      rs.*,
      rs.last_round_sent + 1 as next_round,
      drc.round_1_days,
      drc.round_2_days,
      drc.round_3_days
    from reminder_status rs
    join document_reminder_config drc
      on drc.document_key = rs.document_key
    where rs.last_round_sent < 3
  )
  select
    nr.document_id,
    nr.owner_id,
    p.email as owner_email,
    p.full_name as owner_name,
    nr.document_key,
    nr.document_title,
    nr.workspace_id,
    nr.org_id,
    nr.next_round as round,
    case nr.next_round
      when 1 then nr.round_1_days
      when 2 then nr.round_2_days
      when 3 then nr.round_3_days
    end as config_days
  from next_round nr
  join profiles p on p.id = nr.owner_id
  where
    -- Fire when created_at is older than the configured days for this round
    nr.created_at <= now() - (
      case nr.next_round
        when 1 then nr.round_1_days
        when 2 then nr.round_2_days
        when 3 then nr.round_3_days
      end || ' days'
    )::interval
$$;
```

---

### Task A3.4: Create the reminder cron API route

**Create:** `src/app/api/cron/document-reminders/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { findReminderCandidates, sendDocumentReminder } from '@/lib/documents/reminders'

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron call
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const candidates = await findReminderCandidates()
  const results = { sent: 0, failed: 0, errors: [] as string[] }

  for (const candidate of candidates) {
    try {
      await sendDocumentReminder(candidate)
      results.sent++
    } catch (err) {
      results.failed++
      results.errors.push(`${candidate.document_id}: ${String(err)}`)
    }
  }

  return NextResponse.json(results)
}
```

---

### Task A3.5: Write expiry library

**Create:** `src/lib/documents/expiry.ts`

```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Updates documents approaching expiry.
 * Run daily via cron.
 * - Documents expiring within 30 days → status = 'expiring'
 * - Documents past expires_at → status = 'expired'
 */
export async function processDocumentExpiry(): Promise<{ expiring: number; expired: number }> {
  const supabase = await createClient()

  // Mark as expired
  const { count: expired } = await supabase
    .from('documents')
    .update({ status: 'expired' })
    .lt('expires_at', new Date().toISOString().split('T')[0])
    .eq('status', 'on_file')

  // Mark as expiring (within 30 days)
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { count: expiring } = await supabase
    .from('documents')
    .update({ status: 'expiring' })
    .lte('expires_at', thirtyDaysFromNow.toISOString().split('T')[0])
    .gt('expires_at', new Date().toISOString().split('T')[0])
    .eq('status', 'on_file')

  return { expiring: expiring ?? 0, expired: expired ?? 0 }
}

export async function fetchExpiringDocuments(orgId: string) {
  const supabase = await createClient()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { data } = await supabase
    .from('documents')
    .select('*, profiles!owner_id(full_name, email)')
    .in('status', ['expiring', 'expired'])
    .lte('expires_at', thirtyDaysFromNow.toISOString().split('T')[0])
    .order('expires_at', { ascending: true })

  return data ?? []
}
```

---

### Task A3.6: Create expiry cron route

**Create:** `src/app/api/cron/document-expiry/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { processDocumentExpiry } from '@/lib/documents/expiry'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processDocumentExpiry()
  return NextResponse.json(result)
}
```

---

### Task A3.7: Register cron jobs in vercel.ts

**File:** `vercel.ts` (create if not exists, or update if exists)

```typescript
import { type VercelConfig } from '@vercel/config/v1'

export const config: VercelConfig = {
  crons: [
    { path: '/api/cron/document-reminders', schedule: '0 9 * * *' },  // 9am UTC daily
    { path: '/api/cron/document-expiry', schedule: '0 8 * * *' },     // 8am UTC daily
  ],
}
```

Add `CRON_SECRET` to Doppler (all environments).

---

### Task A3.8: Write tests for reminder logic

**Create:** `src/lib/documents/__tests__/reminders.test.ts`

```typescript
import { describe, it, expect } from 'vitest'

describe('reminder candidates', () => {
  it('does not include documents with status on_file', async () => {
    // Documents already complete should never get reminders
  })

  it('fires round 1 reminder after configured days', async () => {
    // Document created 3+ days ago with no reminders sent = round 1 candidate
  })

  it('fires round 2 only after round 1 was sent', async () => {
    // Round 2 should not fire if round 1 was never sent
  })

  it('sets is_urgent on round 3', async () => {
    // Sending a round 3 reminder should set is_urgent = true
  })
})
```

Run: `pnpm exec vitest run src/lib/documents/__tests__/reminders.test.ts`

---

### Task A3.9: Commit

```bash
git add supabase/migrations/20260610110001* supabase/migrations/20260610110002* apps/web/src/lib/documents/reminders.ts apps/web/src/lib/documents/expiry.ts apps/web/src/app/api/cron/ vercel.ts
git commit -m "feat(reminders): add automated document reminder sequences and daily expiry cron"
```

---

## Agent A4: Admin Power Tools

**Dispatch prompt:**
> You are implementing Workstream A4 of the Proxy Documents Platform. Your job is to add an action queue tab, bulk operations, global document search, activity timeline in admin, and form responses export to the admin paperwork section. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Workstream A4" first. The codebase is at `/Users/johanannunez/workspace/proxy/apps/web`. Invoke `frontend-design` and `ui-ux-pro-max` before writing any UI components. No `transition-all`. Follow all tasks below in order.

---

### Task A4.1: Invoke design skills before any UI work

Invoke `frontend-design` then `ui-ux-pro-max` to establish design language for admin power tools.

---

### Task A4.2: Build the ActionQueue data fetcher

**Create:** `src/lib/admin/action-queue.ts`

```typescript
import 'server-only'
import { createClient } from '@/lib/supabase/server'

export type ActionQueueItemKind =
  | 'declined_signature'
  | 'stuck_review'
  | 'expiring_document'
  | 'pending_countersignature'
  | 'overdue_unsigned'

export interface ActionQueueItem {
  id: string
  kind: ActionQueueItemKind
  owner_id: string
  owner_name: string
  owner_avatar_url: string | null
  document_id: string
  document_title: string
  document_key: string
  days_waiting: number
  expires_at: string | null
  primary_action: 'resend' | 'countersign' | 'review' | 'remind'
  urgency: 'high' | 'medium' | 'low'
}

export async function fetchActionQueue(): Promise<ActionQueueItem[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('fetch_admin_action_queue')
  return data ?? []
}
```

**Create:** `supabase/migrations/20260610120001_action_queue_fn.sql`

```sql
create or replace function fetch_admin_action_queue()
returns table (
  id                 text,
  kind               text,
  owner_id           uuid,
  owner_name         text,
  owner_avatar_url   text,
  document_id        uuid,
  document_title     text,
  document_key       text,
  days_waiting       int,
  expires_at         date,
  primary_action     text,
  urgency            text
)
language sql
security definer
as $$
  -- Declined signatures
  select
    concat('declined-', d.id) as id,
    'declined_signature' as kind,
    d.owner_id,
    p.full_name as owner_name,
    p.avatar_url as owner_avatar_url,
    d.id as document_id,
    d.title as document_title,
    d.document_key,
    extract(day from now() - d.updated_at)::int as days_waiting,
    d.expires_at,
    'resend' as primary_action,
    'high' as urgency
  from documents d
  join profiles p on p.id = d.owner_id
  where d.status = 'action_required'

  union all

  -- Stuck in under_review > 3 days
  select
    concat('review-', d.id),
    'stuck_review',
    d.owner_id,
    p.full_name,
    p.avatar_url,
    d.id,
    d.title,
    d.document_key,
    extract(day from now() - d.updated_at)::int,
    d.expires_at,
    'review',
    case when extract(day from now() - d.updated_at) > 7 then 'high' else 'medium' end
  from documents d
  join profiles p on p.id = d.owner_id
  where d.status = 'under_review'
    and d.updated_at < now() - interval '3 days'

  union all

  -- Expiring within 30 days
  select
    concat('expiring-', d.id),
    'expiring_document',
    d.owner_id,
    p.full_name,
    p.avatar_url,
    d.id,
    d.title,
    d.document_key,
    0,
    d.expires_at,
    'remind',
    case when d.expires_at <= current_date + 7 then 'high' else 'medium' end
  from documents d
  join profiles p on p.id = d.owner_id
  where d.status in ('on_file', 'expiring')
    and d.expires_at <= current_date + 30

  union all

  -- Pending countersignature
  select
    concat('countersign-', d.id),
    'pending_countersignature',
    d.owner_id,
    p.full_name,
    p.avatar_url,
    d.id,
    d.title,
    d.document_key,
    extract(day from now() - d.updated_at)::int,
    d.expires_at,
    'countersign',
    'high'
  from documents d
  join profiles p on p.id = d.owner_id
  where d.status = 'awaiting_countersignature'

  union all

  -- Unsigned past 7 days
  select
    concat('overdue-', d.id),
    'overdue_unsigned',
    d.owner_id,
    p.full_name,
    p.avatar_url,
    d.id,
    d.title,
    d.document_key,
    extract(day from now() - d.created_at)::int,
    d.expires_at,
    'remind',
    case when extract(day from now() - d.created_at) > 14 then 'high' else 'medium' end
  from documents d
  join profiles p on p.id = d.owner_id
  where d.status = 'sent'
    and d.created_at < now() - interval '7 days'

  order by
    case urgency when 'high' then 1 when 'medium' then 2 else 3 end,
    days_waiting desc
$$;
```

---

### Task A4.3: Build ActionQueue UI component

**Create:** `src/app/(admin)/admin/paperwork/ActionQueue.tsx`

Card-based layout. Each card has:
- Owner avatar + name
- Document title + kind badge ("Declined", "Overdue", "Expiring")
- Days waiting (amber if >7, red if >14)
- Urgency indicator (colored left border: red=high, amber=medium)
- One-click primary action button
- Secondary: "View details" link to DocumentDrawer

```typescript
'use client'
import type { ActionQueueItem } from '@/lib/admin/action-queue'

interface ActionQueueProps {
  items: ActionQueueItem[]
  onAction: (item: ActionQueueItem) => void
}
```

Empty state: "No actions needed. You're all caught up." with a checkmark illustration.

---

### Task A4.4: Add ActionQueue tab to the paperwork hub

**File:** `src/app/(admin)/admin/paperwork/DocumentsHub.tsx`

Add a new tab: "Needs Action (N)" where N is the badge count from `fetchActionQueue()`.

Tab order: "Needs Action" | "All" | "SecureDocs" | "Setup"

The "Needs Action" tab is the default active tab if any items exist.

---

### Task A4.5: Add bulk selection to the matrix view

**File:** `src/app/(admin)/admin/paperwork/DocumentsHub.tsx`

**Step 1:** Add checkbox column as first column in the matrix. Checkbox click toggles selection of that owner row.

**Step 2:** "Select all" checkbox in the header row.

**Create:** `src/components/admin/documents/BulkActionBar.tsx`

```typescript
interface BulkActionBarProps {
  selectedCount: number
  onRemind: () => void
  onRequest: () => void
  onWaive: () => void
  onSend: () => void
  onClear: () => void
}
```

Sticky bar that appears at bottom of screen when selectedCount > 0:
- "N owners selected" + clear selection link
- Action buttons: Remind, Request, Waive, Send
- Animated slide-up using `motion/react`

---

### Task A4.6: Implement bulk remind action

**Create:** `src/app/(admin)/admin/paperwork/bulk-actions.ts`

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { sendDocumentReminder } from '@/lib/documents/reminders'

export async function bulkRemindOwners(ownerIds: string[]): Promise<{ sent: number }> {
  // For each owner, find their pending documents and send the next reminder round
  // Returns count of reminders sent
  const supabase = await createClient()
  const { data: documents } = await supabase
    .from('documents')
    .select('id, owner_id, document_key, title, workspace_id')
    .in('owner_id', ownerIds)
    .not('status', 'in', '("on_file","expired","waived")')

  let sent = 0
  for (const doc of documents ?? []) {
    // Determine next round and send
    sent++
  }
  return { sent }
}

export async function bulkWaiveDocuments(documentIds: string[]): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('documents')
    .update({ waived: true })
    .in('id', documentIds)
}
```

---

### Task A4.7: Build global document search

**Create:** `src/app/(admin)/admin/paperwork/DocumentSearch.tsx`

```typescript
'use client'
// Search input in the paperwork hub header
// Debounced (300ms) search against the server action below
// Results dropdown: owner name, document type, status, last activity
// Clicking result opens DocumentDrawer for that document
```

**Create:** `src/app/(admin)/admin/paperwork/search-actions.ts`

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'

export async function searchDocuments(query: string) {
  if (query.trim().length < 2) return []
  const supabase = await createClient()

  const { data } = await supabase
    .from('documents')
    .select('id, title, document_key, status, owner_id, profiles!owner_id(full_name, email)')
    .or(`title.ilike.%${query}%, profiles.full_name.ilike.%${query}%`)
    .limit(20)

  return data ?? []
}
```

---

### Task A4.8: Add DocumentTimeline to admin drawers

**File:** `src/app/(admin)/admin/paperwork/DocumentDrawer.tsx`

Import `DocumentTimeline` from `src/components/workspace/documents/DocumentTimeline.tsx` (built in A2).

Add timeline section below document status in the drawer. Fetch timeline events from the document's signers timestamps + status change history.

Same component as workspace portal (shared, no duplication).

---

### Task A4.9: Add form responses unified view

**Create:** `src/app/(admin)/admin/paperwork/responses/page.tsx`
**Create:** `src/app/(admin)/admin/paperwork/responses/ResponsesHub.tsx`

- Table: respondent name, form name, submitted date, property, status
- Filters: by form (dropdown), by date range, by property
- Sort: by submitted_at desc default
- CSV export button: calls a server action that queries form_responses and streams a CSV

**Create:** `src/app/(admin)/admin/paperwork/responses/export-actions.ts`

```typescript
'use server'
export async function exportResponsesCSV(filters: { formId?: string; dateFrom?: string }): Promise<string> {
  // Returns CSV string
  // Columns: respondent_name, respondent_email, form_name, property, submitted_at, [dynamic field columns]
}
```

---

### Task A4.10: Typecheck, test, commit

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
git add apps/web/src/app/\(admin\)/admin/paperwork/ apps/web/src/components/admin/documents/ apps/web/src/lib/admin/action-queue.ts supabase/migrations/20260610120001*
git commit -m "feat(admin): add action queue, bulk ops, global search, document timeline and form responses export"
```

---

## Agent B2: Data Isolation

**Dispatch prompt:**
> You are implementing Sub-phase B2 of the Proxy Documents Platform. Your job is to add org_id to all 40+ tables that lack it, rewrite all RLS policies to be workspace-aware, and update the subdomain routing middleware. The organizations tables from B1 are already in place. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Sub-phase B2" first. The codebase is at `/Users/johanannunez/workspace/proxy`. Migrations go in `supabase/migrations/`. Apply via Supabase MCP. Follow all tasks below in order. Do NOT modify any UI components.

---

### Task B2.1: Add org_id to all unscoped tables

**Create:** `supabase/migrations/20260610010001_add_org_id_to_tables.sql`

```sql
-- Phase 1: Add nullable org_id to all tables missing it
-- Properties
alter table properties add column if not exists org_id uuid references organizations(id);

-- Bookings and financial tables
alter table bookings add column if not exists org_id uuid references organizations(id);
alter table invoices add column if not exists org_id uuid references organizations(id);
alter table subscriptions add column if not exists org_id uuid references organizations(id);
alter table stripe_customers add column if not exists org_id uuid references organizations(id);

-- Messaging
alter table messages add column if not exists org_id uuid references organizations(id);
alter table conversations add column if not exists org_id uuid references organizations(id);

-- Operations
alter table tasks add column if not exists org_id uuid references organizations(id);

-- Owner data
alter table activity_log add column if not exists org_id uuid references organizations(id);
alter table onboarding_drafts add column if not exists org_id uuid references organizations(id);
alter table owner_facts add column if not exists org_id uuid references organizations(id);
alter table notifications add column if not exists org_id uuid references organizations(id);
alter table owner_kyc add column if not exists org_id uuid references organizations(id);

-- Add indexes for all new columns
create index if not exists idx_properties_org on properties(org_id);
create index if not exists idx_bookings_org on bookings(org_id);
create index if not exists idx_messages_org on messages(org_id);
create index if not exists idx_tasks_org on tasks(org_id);
create index if not exists idx_activity_log_org on activity_log(org_id);
create index if not exists idx_notifications_org on notifications(org_id);
```

---

### Task B2.2: Backfill all org_id columns to Proxy org

**Create:** `supabase/migrations/20260610010002_backfill_org_id.sql`

```sql
-- Backfill all existing rows to Proxy org
-- Safe: all existing data belongs to Proxy
update properties set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update bookings set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update invoices set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update subscriptions set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update stripe_customers set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update messages set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update conversations set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update tasks set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update activity_log set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update onboarding_drafts set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update owner_facts set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update notifications set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update owner_kyc set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
-- Also update tables that already had org_id/workspace_id as nullable
update documents set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
update forms set org_id = '00000000-0000-0000-0000-000000000001' where org_id is null;
```

---

### Task B2.3: Make org_id not null

**Create:** `supabase/migrations/20260610010003_org_id_not_null.sql`

```sql
-- Now that all rows are backfilled, enforce not null
alter table properties alter column org_id set not null;
alter table bookings alter column org_id set not null;
alter table invoices alter column org_id set not null;
alter table subscriptions alter column org_id set not null;
alter table stripe_customers alter column org_id set not null;
alter table messages alter column org_id set not null;
alter table conversations alter column org_id set not null;
alter table tasks alter column org_id set not null;
alter table activity_log alter column org_id set not null;
alter table notifications alter column org_id set not null;
alter table owner_kyc alter column org_id set not null;
```

---

### Task B2.4: Rewrite RLS policies on core tables

**Create:** `supabase/migrations/20260610010004_rewrite_rls_policies.sql`

Example pattern for `properties` (replicate for all tables):

```sql
-- Properties
drop policy if exists "admins can read all properties" on properties;
drop policy if exists "owners can read own properties" on properties;

create policy "org admins can read org properties"
  on properties for select
  using (is_org_admin(org_id));

create policy "org admins can write org properties"
  on properties for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

create policy "owners can read own properties"
  on properties for select
  using (owner_id = auth.uid());

-- Tasks (same pattern)
drop policy if exists "admins can read all tasks" on tasks;
create policy "org admins can manage tasks"
  on tasks for all
  using (is_org_admin(org_id))
  with check (is_org_admin(org_id));

-- Messages
drop policy if exists "admins can read all messages" on messages;
create policy "org admins can read org messages"
  on messages for select
  using (is_org_admin(org_id));
```

Repeat this pattern for: bookings, invoices, subscriptions, stripe_customers, messages, conversations, tasks, activity_log, notifications, owner_kyc, documents, forms, document_templates.

**Note:** This migration will be long (200+ lines). Write it completely. Do not use `is_admin()` anywhere.

---

### Task B2.5: Update subdomain routing middleware

**File:** `src/proxy.ts`

Add org resolution to the existing middleware:

```typescript
// Near the top of the middleware function, after session refresh:
const hostname = request.headers.get('host') ?? ''
const subdomain = hostname.split('.')[0]

// Skip org resolution for the main domain itself
if (subdomain !== 'myproxyhost' && subdomain !== 'www' && subdomain !== 'localhost') {
  // Look up org by subdomain slug
  // We use a Supabase service-role client here (no auth needed for this lookup)
  const org = await getOrgBySlugCached(subdomain)
  if (!org) {
    // Unknown subdomain — redirect to main site or 404
    return NextResponse.redirect(new URL('/', 'https://myproxyhost.com'))
  }
  // Inject org context into request headers for downstream use
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-org-id', org.id)
  requestHeaders.set('x-org-slug', org.slug)
  requestHeaders.set('x-org-plan', org.plan_tier)
  return NextResponse.next({ request: { headers: requestHeaders } })
}
```

**Create:** `src/lib/organizations/cache.ts`

```typescript
import 'server-only'
// Simple in-memory cache with 60s TTL for org slug lookups
// Avoids a DB roundtrip on every request

const cache = new Map<string, { org: unknown; expires: number }>()

export async function getOrgBySlugCached(slug: string) {
  const cached = cache.get(slug)
  if (cached && cached.expires > Date.now()) return cached.org

  const { getOrgBySlug } = await import('./index')
  const org = await getOrgBySlug(slug)
  cache.set(slug, { org, expires: Date.now() + 60_000 })
  return org
}
```

---

### Task B2.6: Verify RLS rewrite is complete

```bash
grep -rn "is_admin()" /Users/johanannunez/workspace/proxy/supabase --include="*.sql"
```

Expected: zero results (only the function definition itself, if it still exists).

---

### Task B2.7: Typecheck and commit

```bash
cd apps/web && pnpm exec tsc --noEmit
git add supabase/migrations/20260610010001* supabase/migrations/20260610010002* supabase/migrations/20260610010003* supabase/migrations/20260610010004* apps/web/src/proxy.ts apps/web/src/lib/organizations/cache.ts
git commit -m "feat(platform): add org_id to all tables, rewrite RLS policies for multi-tenant isolation, add subdomain routing"
```

---

## Round 2 Verification

```bash
# Verify B2: is_admin() eliminated from RLS
grep -rn "is_admin()" /Users/johanannunez/workspace/proxy/supabase/migrations --include="*.sql"
# Expected: 0 (or only the function definition file)

# Verify all tables have org_id
# Use Supabase MCP execute_sql:
# select table_name from information_schema.columns
# where column_name = 'org_id' and table_schema = 'public'
# order by table_name;

cd apps/web && pnpm exec tsc --noEmit
cd apps/web && pnpm exec vitest run
```

---

## Round 3 — Three Parallel Agents

---

## Agent A5: Forms Builder Upgrades

**Dispatch prompt:**
> You are implementing Workstream A5 of the Proxy Documents Platform. Your job is to add conditional field logic to the form builder and build a unified form responses view. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Workstream A5" first. The codebase is at `/Users/johanannunez/workspace/proxy/apps/web`. Invoke `frontend-design` before writing any UI components. Follow all tasks below in order.

---

### Task A5.1: Add conditions to FormField type

**File:** `src/lib/admin/forms-types.ts`

```typescript
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'

export interface FieldCondition {
  field: string          // fieldId of the field to check
  operator: ConditionOperator
  value?: string         // not needed for is_empty / is_not_empty
}

export interface FieldConditionGroup {
  combinator: 'and' | 'or'
  conditions: FieldCondition[]
}

// Add to FormField interface:
// conditions?: FieldConditionGroup   — if set, field is hidden unless conditions pass
```

**Test:** `src/lib/admin/__tests__/forms-conditions.test.ts`

```typescript
import { evaluateConditions } from '../forms'

describe('evaluateConditions', () => {
  it('shows field when no conditions', () => {
    expect(evaluateConditions(undefined, {})).toBe(true)
  })

  it('shows field when equals condition passes', () => {
    expect(evaluateConditions(
      { combinator: 'and', conditions: [{ field: 'f1', operator: 'equals', value: 'yes' }] },
      { f1: 'yes' }
    )).toBe(true)
  })

  it('hides field when equals condition fails', () => {
    expect(evaluateConditions(
      { combinator: 'and', conditions: [{ field: 'f1', operator: 'equals', value: 'yes' }] },
      { f1: 'no' }
    )).toBe(false)
  })

  it('handles or combinator', () => {
    expect(evaluateConditions(
      { combinator: 'or', conditions: [
        { field: 'f1', operator: 'equals', value: 'a' },
        { field: 'f1', operator: 'equals', value: 'b' },
      ]},
      { f1: 'b' }
    )).toBe(true)
  })
})
```

Run test to see it fail, then implement `evaluateConditions` in `forms.ts`:

```typescript
export function evaluateConditions(
  group: FieldConditionGroup | undefined,
  values: Record<string, unknown>
): boolean {
  if (!group || group.conditions.length === 0) return true
  const results = group.conditions.map(c => {
    const val = String(values[c.field] ?? '')
    switch (c.operator) {
      case 'equals': return val === c.value
      case 'not_equals': return val !== c.value
      case 'contains': return val.includes(c.value ?? '')
      case 'not_contains': return !val.includes(c.value ?? '')
      case 'is_empty': return val === '' || val === 'undefined'
      case 'is_not_empty': return val !== '' && val !== 'undefined'
      default: return true
    }
  })
  return group.combinator === 'and' ? results.every(Boolean) : results.some(Boolean)
}
```

Run tests again: `pnpm exec vitest run src/lib/admin/__tests__/forms-conditions.test.ts`
Expected: PASS

---

### Task A5.2: Add condition editor to FieldPropertyPopover

**File:** `src/app/(admin)/admin/paperwork/forms/[id]/edit/FieldPropertyPopover.tsx`

Add a "Show if" section at the bottom of the property panel:

- Toggle: "Always show" / "Show conditionally"
- When conditional: field selector (dropdown of all other fields in the form), operator selector, value input
- "Add another condition" link (up to 5)
- AND / OR combinator toggle when more than one condition
- Live preview updates in real time as conditions are set

---

### Task A5.3: Apply conditions in FormPreviewPanel

**File:** `src/app/(admin)/admin/paperwork/forms/[id]/edit/FormPreviewPanel.tsx`

Import and use `evaluateConditions`. Fields with failing conditions render as `display: none` (not unmounted, to preserve values).

---

### Task A5.4: Apply conditions in the public form renderer

Find where the public form (what respondents see) renders fields. Apply `evaluateConditions` there using live form values as the respondent fills out the form.

---

### Task A5.5: Build unified responses view

(See Task A4.9 above — A4 and A5 share this work. Confirm A4 built it, otherwise build it here.)

---

### Task A5.6: Typecheck, tests, commit

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
git add apps/web/src/lib/admin/forms-types.ts apps/web/src/lib/admin/forms.ts apps/web/src/app/\(admin\)/admin/paperwork/forms/
git commit -m "feat(forms): add conditional field logic with AND/OR combinators and unified responses view"
```

---

## Agent A6: Premium UI/UX Redesign

**Dispatch prompt:**
> You are implementing Workstream A6 of the Proxy Documents Platform. Your job is to apply a premium visual redesign to the workspace portal documents section and the admin paperwork section. REQUIRED: Invoke `frontend-design` skill then `ui-ux-pro-max` skill before writing any code. Use the output from those skills to drive every design decision. The codebase is at `/Users/johanannunez/workspace/proxy/apps/web`. No `transition-all`. Phosphor icons only. motion/react for animation. Screenshot with gstack browse after each major component. At least 2 rounds of screenshot, compare, fix, re-screenshot per surface. Follow all tasks below in order.

---

### Task A6.1: Invoke design skills

Invoke `frontend-design` then `ui-ux-pro-max`. Document the design tokens output (palette, typography, spacing, effects) before writing a single line of UI code.

---

### Task A6.2: Screenshot baseline

```bash
B=~/.claude/skills/gstack/browse/dist/browse
# Login first via dev auth endpoint
$B goto http://localhost:4000/api/dev/auth
$B goto http://localhost:4000/workspace/documents
$B screenshot /tmp/before-documents-portal.png

$B goto http://localhost:4000/admin/paperwork
$B screenshot /tmp/before-admin-paperwork.png
```

Read both screenshots. Document what needs improvement (spacing, typography, color, density, empty states).

---

### Task A6.3: Redesign workspace portal documents page

**File:** `src/app/(workspace)/workspace/documents/DocumentsHub.tsx` and all components in `src/components/workspace/documents/`

Apply to every component:
- Generous whitespace (not cramped). Use 24px/32px gaps between major sections.
- Typography: heading font weight 600-700, body 400-450, tight tracking on headings (`tracking-tight`)
- Colors: use `var(--color-primary)` and `var(--color-accent)` tokens (set by org branding in Phase 3, defaulting to Proxy brand)
- Elevated surfaces: use multi-layer box shadows, not flat `shadow-md`
- Status pills: color-coded with `background-color` tint + border, not just border
- Progress ring: animated SVG stroke-dashoffset (not a CSS progress bar)
- Hover states on all interactive elements: `transform: translateY(-1px)` + shadow deepen
- Focus-visible: 2px outline in accent color on all focusable elements
- Loading: skeleton screens for the initial data load
- Empty states: illustrated (use Phosphor icons at 48px in a subtle container)

---

### Task A6.4: Screenshot portal and iterate

```bash
$B goto http://localhost:4000/workspace/documents
$B screenshot /tmp/after-documents-portal-r1.png
```

Read the screenshot. Compare to before. List specific issues. Fix them. Screenshot again.

```bash
$B screenshot /tmp/after-documents-portal-r2.png
```

Do not stop after one round. Two rounds minimum.

---

### Task A6.5: Redesign admin paperwork section

**Files:** All components in `src/app/(admin)/admin/paperwork/`

Apply:
- Matrix table: sticky first column (owner name), sticky header row, alternating row tints at 2% opacity
- Status dots: replace with pill badges (colored text + background tint), not just dots
- Document drawer: two-column layout on desktop (700px+), single column mobile
- Action queue cards: colored left border (4px) indicating urgency. Red = high, amber = medium, slate = low
- Bulk action bar: glassmorphism style (backdrop-blur + semi-transparent background)
- Search input: prominent placement in hub header, expands on focus
- Empty states: contextual (different message for "no documents" vs "no actions needed")

---

### Task A6.6: Screenshot admin and iterate

Two rounds minimum. Read screenshots. Fix issues. Re-screenshot.

---

### Task A6.7: Verify responsive layout

```bash
# Mobile
$B viewport 390x844
$B goto http://localhost:4000/workspace/documents
$B screenshot /tmp/mobile-documents-r1.png

# Tablet
$B viewport 768x1024
$B goto http://localhost:4000/workspace/documents
$B screenshot /tmp/tablet-documents-r1.png

# Desktop
$B viewport 1440x900
$B goto http://localhost:4000/workspace/documents
$B screenshot /tmp/desktop-documents-r1.png
```

Read all three. Fix layout breaks. Re-screenshot until all three viewports look premium.

---

### Task A6.8: Verify dark mode

```bash
$B js "document.documentElement.classList.add('dark')"
$B screenshot /tmp/dark-documents.png
$B js "document.documentElement.classList.remove('dark')"
```

Fix any issues: ensure all color tokens have dark mode variants.

---

### Task A6.9: Commit

```bash
git add apps/web/src/components/workspace/documents/ apps/web/src/app/\(workspace\)/workspace/documents/ apps/web/src/app/\(admin\)/admin/paperwork/
git commit -m "feat(ui): premium redesign of workspace documents portal and admin paperwork section"
```

---

## Agent B3: Self-serve Signup and Billing

**Dispatch prompt:**
> You are implementing Sub-phase B3 of the Proxy Documents Platform. Your job is to build the self-serve org signup flow, onboarding wizard, and Stripe subscription billing. The organizations tables from B1 and the multi-tenant isolation from B2 are already in place. Read `docs/plans/2026-06-10-proxy-documents-platform-design.md` section "Sub-phase B3" first. Invoke `frontend-design` before writing UI. Invoke `stripe-integration` skill before writing any Stripe code. Follow all tasks below in order.

---

### Task B3.1: Invoke design and Stripe skills

1. `frontend-design` skill
2. `stripe-integration` skill (for Stripe subscription patterns)

---

### Task B3.2: Create signup page

**Create:** `src/app/(public)/signup/page.tsx`
**Create:** `src/app/(public)/signup/SignupFlow.tsx`

Multi-step form. Steps stored in URL params (`?step=1`, `?step=2`):
- Step 1: Name, email, password
- Step 2: Company name, subdomain (live availability check via debounced server action), industry (property management pre-selected)
- Step 3: Plan selection card grid (Starter free / Pro / White-label)
- Step 4: Stripe payment (skipped for Starter, shown for Pro/White-label)

**Create:** `src/app/(public)/signup/signup-actions.ts`

```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { PROXY_ORG_ID } from '@/types/organizations'

export async function checkSubdomainAvailability(slug: string): Promise<{ available: boolean }> {
  // Validate format
  if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) {
    return { available: false }
  }
  // Reserved slugs
  const reserved = ['proxy', 'www', 'app', 'api', 'admin', 'mail', 'status']
  if (reserved.includes(slug)) return { available: false }

  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()

  return { available: !data }
}

export async function createOrganization(params: {
  name: string
  slug: string
  planTier: 'starter' | 'pro' | 'white_label'
  ownerEmail: string
  ownerName: string
  ownerPassword: string
}): Promise<{ orgId: string; error?: string }> {
  const supabase = await createClient()

  // 1. Create Supabase auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: params.ownerEmail,
    password: params.ownerPassword,
    options: { data: { full_name: params.ownerName } }
  })
  if (authError) return { orgId: '', error: authError.message }

  // 2. Create org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: params.name, slug: params.slug, plan_tier: params.planTier })
    .select()
    .single()
  if (orgError) return { orgId: '', error: orgError.message }

  // 3. Add member as org_owner
  await supabase.from('organization_members').insert({
    org_id: org.id,
    profile_id: authData.user!.id,
    role: 'org_owner',
  })

  // 4. Seed org settings and branding
  await supabase.from('organization_branding').insert({ org_id: org.id })
  await supabase.from('organization_settings').insert({ org_id: org.id })

  // 5. If paid plan, create Stripe customer (handled separately)

  return { orgId: org.id }
}
```

---

### Task B3.3: Add Stripe subscription creation

**File:** `src/app/(public)/signup/signup-actions.ts` (extend)

```typescript
export async function createStripeSubscription(params: {
  orgId: string
  planTier: 'pro' | 'white_label'
  paymentMethodId: string
}): Promise<{ subscriptionId: string; clientSecret?: string }> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

  // Create customer
  const customer = await stripe.customers.create({
    metadata: { org_id: params.orgId },
  })

  // Attach payment method
  await stripe.paymentMethods.attach(params.paymentMethodId, { customer: customer.id })
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: params.paymentMethodId }
  })

  // Create subscription
  const priceId = params.planTier === 'pro'
    ? process.env.STRIPE_PRO_PRICE_ID!
    : process.env.STRIPE_WHITE_LABEL_PRICE_ID!

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  })

  // Update org with Stripe IDs
  const supabase = await createClient()
  await supabase
    .from('organizations')
    .update({
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', params.orgId)

  return { subscriptionId: subscription.id }
}
```

---

### Task B3.4: Build onboarding wizard

**Create:** `src/app/(admin)/admin/onboarding/page.tsx`
**Create:** `src/app/(admin)/admin/onboarding/OnboardingWizard.tsx`

4-step wizard shown once after signup (dismissed via localStorage flag `onboarding_complete`):

```typescript
const STEPS = [
  { id: 'brand', title: 'Set up your brand', description: 'Upload your logo and set your colors' },
  { id: 'client', title: 'Invite your first client', description: 'Enter their email to get started' },
  { id: 'document', title: 'Send your first document', description: 'Choose a template and send a signature request' },
  { id: 'form', title: 'Create your first form', description: 'Build a form to collect client information' },
]
```

Each step has a "Skip for now" link and a primary "Continue" button. Last step shows "Go to dashboard".

---

### Task B3.5: Build billing settings page

**Create:** `src/app/(admin)/admin/settings/billing/page.tsx`

Shows:
- Current plan name + tier badge
- Next invoice date and amount
- "Upgrade" button (opens plan selection modal) if on Starter
- "Manage payment method" button (Stripe Customer Portal redirect)
- Invoice history table (last 10 invoices)

```typescript
// Server action to get Stripe portal URL
export async function createBillingPortalSession(orgId: string): Promise<{ url: string }> {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', orgId)
    .single()

  const session = await stripe.billingPortal.sessions.create({
    customer: org!.stripe_customer_id!,
    return_url: `https://${orgId}.myproxyhost.com/admin/settings/billing`,
  })
  return { url: session.url }
}
```

---

### Task B3.6: Add plan tier feature flags

**Create:** `src/lib/organizations/features.ts`

```typescript
import type { OrgPlanTier } from '@/types/organizations'

export const PLAN_FEATURES: Record<OrgPlanTier, Record<string, boolean>> = {
  starter: {
    conditional_forms: false,
    automated_reminders: false,
    bulk_operations: false,
    team_members: false,
    custom_subdomain: false,
    white_label: false,
    template_marketplace_publish: false,
    advanced_analytics: false,
  },
  pro: {
    conditional_forms: true,
    automated_reminders: true,
    bulk_operations: true,
    team_members: true,
    custom_subdomain: false,
    white_label: false,
    template_marketplace_publish: true,
    advanced_analytics: true,
  },
  white_label: {
    conditional_forms: true,
    automated_reminders: true,
    bulk_operations: true,
    team_members: true,
    custom_subdomain: true,
    white_label: true,
    template_marketplace_publish: true,
    advanced_analytics: true,
  },
}

export function hasFeature(tier: OrgPlanTier, feature: keyof typeof PLAN_FEATURES.starter): boolean {
  return PLAN_FEATURES[tier][feature] ?? false
}
```

**Test:**
```typescript
import { hasFeature } from '../features'
it('starter cannot use conditional forms', () => {
  expect(hasFeature('starter', 'conditional_forms')).toBe(false)
})
it('pro can use conditional forms', () => {
  expect(hasFeature('pro', 'conditional_forms')).toBe(true)
})
```

---

### Task B3.7: Typecheck, tests, commit

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
git add apps/web/src/app/\(public\)/signup/ apps/web/src/app/\(admin\)/admin/settings/billing/ apps/web/src/app/\(admin\)/admin/onboarding/ apps/web/src/lib/organizations/features.ts
git commit -m "feat(platform): add self-serve org signup, onboarding wizard, Stripe billing, and plan feature flags"
```

---

## Round 3 Verification

```bash
cd apps/web && pnpm exec tsc --noEmit
cd apps/web && pnpm exec vitest run

# Verify conditional forms work
# Navigate to a form in the builder and add a condition: pnpm exec vitest run --reporter=verbose

# Verify signup flow renders
# Start dev server and navigate to /signup
```

---

## Round 4 — Phase 3: Convergence and White-label

Run sequentially. One agent (or you, the operator). Depends on all Round 1-3 work being merged and verified.

---

### Task P3.1: Scope all documents queries to org_id

**Files:** All `src/lib/admin/*.ts` files and `src/lib/documents/*.ts`

For every query that fetches documents, forms, templates, workspaces: add `.eq('org_id', orgId)` where `orgId` is read from request context (passed from the server component).

Pattern:
```typescript
// Before
const { data } = await supabase.from('documents').select('*')

// After
const { data } = await supabase.from('documents').select('*').eq('org_id', orgId)
```

The `orgId` comes from `headers().get('x-org-id')` in Server Components, or from the session context in server actions.

---

### Task P3.2: Remove PROXY_ORG_ID hardcode

**File:** `src/app/(admin)/admin/paperwork/forms/page.tsx` and anywhere else `PROXY_ORG_ID` appears.

Replace hardcoded constant with `orgId` from request context.

```bash
grep -rn "PROXY_ORG_ID" src/ --include="*.ts" --include="*.tsx"
# Expected after this task: 0 results
```

---

### Task P3.3: Build branding settings UI

**Create:** `src/app/(admin)/admin/settings/branding/page.tsx`
**Create:** `src/app/(admin)/admin/settings/branding/BrandingForm.tsx`

```typescript
// Form fields:
// - Logo upload (Supabase Storage, public bucket)
// - Favicon upload
// - Primary color (color picker)
// - Accent color (color picker)
// - Heading font (select from curated list)
// - Body font (select from curated list)
// - "Powered by Proxy" toggle (locked on for starter/pro, locked off for white_label)

// Live preview pane (right side on desktop):
// Renders a miniature version of the client portal using the current settings
// Updates in real time as settings change (no save needed to preview)
```

**Server action:**
```typescript
export async function saveBranding(orgId: string, branding: Partial<OrganizationBranding>): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('organization_branding')
    .upsert({ org_id: orgId, ...branding })
}
```

---

### Task P3.4: Apply org branding to client portal

**File:** `src/app/(workspace)/layout.tsx` (or wherever the workspace layout lives)

Fetch org branding on layout load. Inject as CSS custom properties:

```typescript
const branding = await getOrgBranding(orgId)

return (
  <html style={{
    '--color-primary': branding?.primary_color ?? '#0F172A',
    '--color-accent': branding?.accent_color ?? '#6366F1',
  } as React.CSSProperties}>
    {/* ... */}
  </html>
)
```

Show org logo in the workspace navbar. Show "Powered by Proxy" in footer only if `branding.powered_by_proxy === true`.

---

### Task P3.5: Build custom domain settings UI

**Create:** `src/app/(admin)/admin/settings/domain/page.tsx`

Only visible if `plan_tier === 'white_label'` (show upgrade prompt otherwise).

Steps shown:
1. Enter custom domain (e.g. `portal.acme.com`)
2. Add CNAME record: show the target (`proxy-tenant.myproxyhost.com`) with copy button
3. Verification status (polling every 10s via SWR or useEffect)
4. "Verify now" button

**Server actions:**
```typescript
export async function savCustomDomain(orgId: string, domain: string): Promise<void>
export async function verifyCustomDomain(domain: string): Promise<{ verified: boolean; error?: string }>
```

For verification, do a DNS lookup server-side:
```typescript
import dns from 'node:dns/promises'

export async function verifyCustomDomain(domain: string) {
  try {
    const records = await dns.resolveCname(domain)
    const verified = records.some(r => r.includes('myproxyhost.com'))
    return { verified }
  } catch {
    return { verified: false, error: 'DNS record not found yet' }
  }
}
```

---

### Task P3.6: Apply DocuSeal branding from org settings

**File:** `src/lib/signing/docuseal.ts`

Replace the env var branding approach from A2.8 with the org branding from the database:

```typescript
// Fetch org branding and pass to DocuSeal submission
const branding = await getOrgBranding(orgId)
const submissionPayload = {
  template_id: templateId,
  submitters: signers,
  ...(branding?.logo_url && {
    customization: {
      logo_url: branding.logo_url,
      primary_color: branding.primary_color,
    }
  })
}
```

---

### Task P3.7: Typecheck, full test suite, commit

```bash
# Verify PROXY_ORG_ID hardcode eliminated
grep -rn "PROXY_ORG_ID" apps/web/src/ --include="*.ts" --include="*.tsx"
# Expected: 0

pnpm exec tsc --noEmit
pnpm exec vitest run

git add apps/web/src/
git commit -m "feat(platform): convergence — scope all queries to org, branding settings, custom domain support, DocuSeal org branding"
```

---

## Round 4.5 — Paperwork Unification (added 2026-06-12, approved)

**Design doc (READ FIRST, it is the authority for this round):**
`docs/plans/2026-06-12-paperwork-unification-design.md`

One agent, one worktree, sequential tasks. Runs after Phase 3 merges, before Round 5.
Round 5's template marketplace is re-scoped to seed INTO this structure (Proxy
library filter in the Templates tab + "From a template" path in the create chooser).

### Task R45.1: Sidebar collapse
Paperwork becomes a single nav item (no children) landing on `/admin/paperwork`.
Update AdminSidebar, command palette entries, breadcrumbs.

### Task R45.2: Paperwork shell with Documents | Templates tabs
Shared shell at `/admin/paperwork` (Documents tab = existing hub unchanged) and
`/admin/paperwork/templates` (Templates tab) with a `+ New document` header button.
Kind filter chips on Documents tab: All · Signatures · Forms · Files.

### Task R45.3: Unified Templates tab
One library grid absorbing the DocuSeal TemplatesHub and the FormsHub list:
kind badges (Signature / Form), sent count, response count for forms, Send + Edit
actions, real thumbnails (PDF first page / form first fields render).

### Task R45.4: Template detail pages
Form templates: Build | Responses | Settings tabs at
`/admin/paperwork/templates/[id]` (Build = existing builder incl. condition editor;
Responses = ResponsesHub components moved in; Settings = publish state + link).
Signature templates: Fields | Settings.

### Task R45.5: Create chooser + send-to-many sheet
`+ New document` chooser: From a template / Upload a PDF / Build a form.
Send sheet with multi-select recipients AND live client preview pane (portal card
+ email exactly as recipient sees it). Sending creates per-client document
instances in the Documents tab.

### Task R45.6: Premium tracking upgrades (design doc items 1, 2, 3, 7)
Stage meter per row (Created→Sent→Viewed→Signed→On file), verb-first human status
copy everywhere user-facing, "Viewed Xh ago" engagement chips from document_events,
visible "Auto-reminder goes out <day>" with per-document mute.

### Task R45.7: Certificate of completion (design doc item 6)
Audit panel in the document drawer: full event log, signer email + IP from
DocuSeal, downloadable completion certificate.

### Task R45.8: Redirects + deletion
Delete the global Responses page. Redirect map (no 404s):
`/admin/paperwork/forms` → `/admin/paperwork/templates?type=form`;
`/forms/[id]/edit` → template Build tab; `/forms/[id]/responses` → template
Responses tab; `/admin/paperwork/responses` → `/admin/paperwork/templates?type=form`.

### Task R45.9: Verification
Typecheck, full vitest suite, `next build`, screenshot evidence for every new
surface (desktop + 390px mobile + dark mode), 2+ iterate rounds, commit.

---

## Round 5 — Phase 4: Public Launch

Run as parallel agents where noted.

**Re-scoped 2026-06-12:** P4.2 (template marketplace) no longer builds its own
surface. System templates seed into the Round 4.5 Templates tab as the "Proxy
library" filter and the "From a template" path of the create chooser. P4.2's
remaining work: the `is_system` template flag, the library filter UI, seeding.
Round 5 also picks up design doc items 5 (personalization tokens in bulk send),
9 (matrix cell quick-send popover), and 10 (library-as-empty-state).

---

### Task P4.1: Marketing landing page (parallel agent)

**Create:** `src/app/(marketing)/page.tsx`

Sections:
1. Hero: "The document platform property managers trust" + "Start free" CTA
2. Feature highlights: forms builder, signatures, client portal, white-label (each with a screenshot/illustration)
3. Pricing table: Starter / Pro / White-label with feature comparison grid
4. Social proof: logo wall placeholder + testimonial cards
5. Final CTA: "Start free today"

Invoke `frontend-design` skill before writing this page. This is the highest-stakes public-facing surface.

---

### Task P4.2: Template marketplace (parallel agent)

**Create:** `src/app/(admin)/admin/templates/marketplace/page.tsx`

Shows system templates (org_id = null) available to all tenants:
- Categories: "Property Management" (shown first), "General"
- Template cards: name, description, field count, install count
- "Use this template" button: creates a copy in the current org
- For Pro/White-label orgs: "Publish your template" option

**Create:** `supabase/migrations/20260610200001_template_marketplace.sql`

```sql
alter table document_templates
  add column if not exists marketplace_published boolean not null default false,
  add column if not exists install_count int not null default 0,
  add column if not exists category text default 'general';

-- Seed property management templates as marketplace items
update document_templates
set marketplace_published = true, category = 'property_management'
where is_system = true;
```

---

### Task P4.3: Seed launch templates

**Create:** `supabase/migrations/20260610200002_seed_launch_templates.sql`

Ensure these system form templates exist (seed if not):
- Property Owner Intake Form
- Property Inspection Report
- Guest Survey
- Property Welcome Guide
- Block Dates Request

These are `forms` rows with `org_id = null` and `is_public = true` — available to all tenants as starting points.

---

### Task P4.4: Final end-to-end verification

Run the full signup-to-document flow:

1. Navigate to `/signup`
2. Create a new org with a test subdomain
3. Complete the onboarding wizard
4. Send a document to a test client
5. Complete the document as the client
6. Verify it appears as `on_file` in admin

Screenshot each step. Fix anything that breaks.

---

### Task P4.5: Pre-launch checklist

```bash
# All environment variables documented in Doppler
# CRON_SECRET set in all environments
# STRIPE_PRO_PRICE_ID and STRIPE_WHITE_LABEL_PRICE_ID set
# RESEND_API_KEY set (already exists)
# DOCUSEAL_API_KEY set (already exists)

# No hardcoded org IDs in application code
grep -rn "00000000-0000-0000-0000-000000000001" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "test\|spec\|seed"

# No transition-all
grep -rn "transition-all" apps/web/src/ --include="*.tsx" --include="*.css"

# TypeScript clean
pnpm exec tsc --noEmit

# All tests pass
pnpm exec vitest run

# Build passes
pnpm build
```

---

### Task P4.6: Final commit and tag

```bash
git add .
git commit -m "feat: Proxy Documents Platform — multi-tenant, white-label, premium UI launch-ready"
git tag v2.0.0
```

---

## Summary: Agent Dispatch Order

| Round | Agents (parallel) | Gate |
|-------|-------------------|------|
| 1 | A1 (Data Foundation), A2 (Workspace Portal), B1 (Organizations Layer) | Merge + verify all 3 |
| 2 | A3 (Reminders+Expiry), A4 (Admin Power Tools), B2 (Data Isolation) | Merge + verify all 3 |
| 3 | A5 (Forms Builder), A6 (Premium UI), B3 (Signup+Billing) | Merge + verify all 3 |
| 4 | Phase 3 Convergence (sequential) | Verify then proceed |
| 5 | P4.1 (Marketing), P4.2 (Marketplace), P4.3-P4.6 (Launch) | Final pre-launch checklist |

**Model for all agents:** `claude-fable-5`
**Isolation:** `worktree` (each agent gets its own git worktree)
**Merge strategy:** Squash merge per workstream, full test suite before merging each one

---

## Quick Reference: Verification Commands

```bash
# Run after every round before proceeding
cd /Users/johanannunez/workspace/proxy/apps/web

pnpm exec tsc --noEmit                    # TypeScript
pnpm exec vitest run                      # Tests

# Sweep checks (run before Round 1 and after Round 1)
grep -rn "signed_documents" src/ --include="*.ts" --include="*.tsx" | wc -l   # Target: 0
grep -rn "property_forms" src/ --include="*.ts" --include="*.tsx" | wc -l     # Target: 0

# After Round 2
grep -rn "is_admin()" ../supabase --include="*.sql" | wc -l                   # Target: 0

# After Phase 3
grep -rn "PROXY_ORG_ID" src/ --include="*.ts" --include="*.tsx" | wc -l       # Target: 0
grep -rn "transition-all" src/ --include="*.tsx" --include="*.css" | wc -l    # Target: 0
```
