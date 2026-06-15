# Decision Authority Addendum: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let multi-owner workspaces define who holds authority in each decision domain, generate a signed DocuSeal addendum from that config, and use it to route platform actions to the right owner.

**Architecture:** Three new DB tables store governance config per workspace. A configuration section in the workspace account page captures mode, domain assignments, and escalation routing. A server action generates a DocuSeal submission from the pre-built addendum template. The DocuSeal webhook marks the authority record active when all owners sign. A `getAuthorityOwner()` utility provides routing to downstream callers.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), TypeScript, DocuSeal, Vitest, Tailwind v4 CSS vars, Phosphor Icons

---

## Scope Note

The routing integration (Task 9) wires the authority assignments into document sending. It is included here but can be deferred to a follow-up plan if the initial scope is too large. Tasks 1-8 produce a fully working configure-and-sign flow even without Task 9.

---

## Pre-Flight

Before starting:

1. Verify `DOCUSEAL_AUTHORITY_ADDENDUM_TEMPLATE_ID` exists in Doppler. If not, create the addendum template in DocuSeal (see Task 8 setup step) and set the env var in Doppler dev/stg/prd.
2. Run `pnpm exec tsc --noEmit` from `apps/web/` to confirm the repo is clean before you start.

---

## File Map

**Create:**
- `supabase/migrations/20260615_decision_authority.sql` — three new tables + RLS
- `apps/web/src/types/decision-authority.ts` — domain constants, status enums, TS types
- `apps/web/src/lib/workspace/decision-authority.ts` — DB helpers (server-only)
- `apps/web/src/lib/workspace/decision-authority-types.ts` — type-only re-exports safe for client import
- `apps/web/src/lib/workspace/authority-routing.ts` — `getAuthorityOwner()` utility (server-only)
- `apps/web/src/app/(workspace)/workspace/account/decision-authority-actions.ts` — server actions
- `apps/web/src/app/(workspace)/workspace/account/components/DecisionAuthoritySection.tsx` — server component shell (fetches data, renders form or status)
- `apps/web/src/app/(workspace)/workspace/account/components/DecisionAuthorityForm.tsx` — client component form
- `apps/web/src/app/(workspace)/workspace/account/components/AuthorityPromptBanner.tsx` — dismissible soft prompt
- `apps/web/src/lib/workspace/__tests__/decision-authority.test.ts`
- `apps/web/src/lib/workspace/__tests__/authority-routing.test.ts`

**Modify:**
- `apps/web/src/app/(workspace)/workspace/account/page.tsx` — add `DecisionAuthoritySection`
- `apps/web/src/app/(workspace)/workspace/home/page.tsx` — add `AuthorityPromptBanner`
- `apps/web/src/app/api/webhooks/docuseal/route.ts` — handle addendum completion event

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260615_decision_authority.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260615_decision_authority.sql

-- workspace_authority: one governance config per workspace.
-- Only one record per workspace can be 'active' at a time (unique partial index).
create table if not exists public.workspace_authority (
  id                   uuid        primary key default gen_random_uuid(),
  workspace_id         uuid        not null references public.workspaces(id) on delete cascade,
  org_id               uuid        not null references public.organizations(id) on delete cascade,
  governance_mode      text        not null check (governance_mode in ('workspace', 'per_property')),
  status               text        not null default 'draft'
                                   check (status in ('draft', 'pending_signatures', 'active', 'superseded')),
  docuseal_submission_id text      null,
  signed_at            timestamptz null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index idx_workspace_authority_one_active
  on public.workspace_authority (workspace_id)
  where status = 'active';

create index idx_workspace_authority_workspace
  on public.workspace_authority (workspace_id);

create trigger set_workspace_authority_updated_at
  before update on public.workspace_authority
  execute function public.set_updated_at();

-- workspace_authority_domains: maps a domain to one owner.
-- property_id is null for workspace-wide governance_mode, populated for per_property.
create table if not exists public.workspace_authority_domains (
  id                uuid primary key default gen_random_uuid(),
  authority_id      uuid not null references public.workspace_authority(id) on delete cascade,
  property_id       uuid null references public.properties(id) on delete cascade,
  domain            text not null check (domain in ('documents_legal', 'finances_payouts', 'operations_maintenance')),
  assigned_owner_id uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  unique (authority_id, property_id, domain)
);

create index idx_authority_domains_authority
  on public.workspace_authority_domains (authority_id);

-- workspace_authority_escalation: guest escalation routing.
-- notify_owner_ids can contain one or both owner profile IDs.
create table if not exists public.workspace_authority_escalation (
  id                uuid    primary key default gen_random_uuid(),
  authority_id      uuid    not null references public.workspace_authority(id) on delete cascade,
  property_id       uuid    null references public.properties(id) on delete cascade,
  notify_owner_ids  uuid[]  not null default '{}',
  created_at        timestamptz not null default now(),
  unique (authority_id, property_id)
);

create index idx_authority_escalation_authority
  on public.workspace_authority_escalation (authority_id);

-- RLS --

alter table public.workspace_authority enable row level security;
alter table public.workspace_authority_domains enable row level security;
alter table public.workspace_authority_escalation enable row level security;

-- workspace_authority: workspace members (profiles sharing same workspace_id) can manage their own record.
-- Admins (org members) have full access via org_id column.
create policy "Workspace members can manage workspace_authority"
  on public.workspace_authority for all
  using (
    exists (
      select 1 from public.profiles p
      where p.workspace_id = workspace_authority.workspace_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.workspace_id = workspace_authority.workspace_id
        and p.id = auth.uid()
    )
  );

create policy "Admins full access to workspace_authority"
  on public.workspace_authority for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

-- workspace_authority_domains: same pattern via join to workspace_authority.
create policy "Workspace members can manage authority domains"
  on public.workspace_authority_domains for all
  using (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_domains.authority_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_domains.authority_id
        and p.id = auth.uid()
    )
  );

create policy "Admins full access to workspace_authority_domains"
  on public.workspace_authority_domains for all
  using (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_domains.authority_id
        and public.is_org_member(wa.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_domains.authority_id
        and public.is_org_member(wa.org_id)
    )
  );

-- workspace_authority_escalation: same pattern.
create policy "Workspace members can manage escalation routing"
  on public.workspace_authority_escalation for all
  using (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_escalation.authority_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_authority wa
      join public.profiles p on p.workspace_id = wa.workspace_id
      where wa.id = workspace_authority_escalation.authority_id
        and p.id = auth.uid()
    )
  );

create policy "Admins full access to workspace_authority_escalation"
  on public.workspace_authority_escalation for all
  using (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_escalation.authority_id
        and public.is_org_member(wa.org_id)
    )
  )
  with check (
    exists (
      select 1 from public.workspace_authority wa
      where wa.id = workspace_authority_escalation.authority_id
        and public.is_org_member(wa.org_id)
    )
  );
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

In Claude Code, call the Supabase MCP tool `apply_migration` with the SQL above targeting project `pwoxwpryummqeqsxdgyc`.

Expected: no errors, three new tables visible in Supabase dashboard.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260615_decision_authority.sql
git commit -m "feat: add decision_authority tables with RLS"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `apps/web/src/types/decision-authority.ts`
- Create: `apps/web/src/lib/workspace/decision-authority-types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/web/src/types/decision-authority.ts

export const AUTHORITY_DOMAINS = [
  "documents_legal",
  "finances_payouts",
  "operations_maintenance",
] as const;

export type AuthorityDomain = (typeof AUTHORITY_DOMAINS)[number];

export const DOMAIN_LABELS: Record<AuthorityDomain, string> = {
  documents_legal: "Documents & Legal",
  finances_payouts: "Finances & Payouts",
  operations_maintenance: "Operations & Maintenance",
};

export const DOMAIN_DESCRIPTIONS: Record<AuthorityDomain, string> = {
  documents_legal:
    "Receives DocuSeal signature requests for W-9s, management agreements, and leases.",
  finances_payouts:
    "Receives payout reports, approves expenses, and is routed financial decisions.",
  operations_maintenance:
    "Approves maintenance requests, owner blocks, and property-level operational decisions.",
};

export type GovernanceMode = "workspace" | "per_property";

export type AuthorityStatus = "draft" | "pending_signatures" | "active" | "superseded";

export interface WorkspaceAuthority {
  id: string;
  workspace_id: string;
  org_id: string;
  governance_mode: GovernanceMode;
  status: AuthorityStatus;
  docuseal_submission_id: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthorityDomainAssignment {
  id: string;
  authority_id: string;
  property_id: string | null;
  domain: AuthorityDomain;
  assigned_owner_id: string;
}

export interface AuthorityEscalation {
  id: string;
  authority_id: string;
  property_id: string | null;
  notify_owner_ids: string[];
}

/** Flattened config used by the form — one per property or null for workspace-wide. */
export interface AuthorityConfig {
  property_id: string | null;
  domains: Partial<Record<AuthorityDomain, string>>; // domain -> owner profile id
  escalation_owner_ids: string[];
}

/** Full authority record with related assignments loaded. */
export interface AuthorityWithAssignments {
  authority: WorkspaceAuthority;
  configs: AuthorityConfig[];
}
```

- [ ] **Step 2: Create the client-safe re-export**

```typescript
// apps/web/src/lib/workspace/decision-authority-types.ts
// Re-exports only type-level items so client components can import without
// pulling in server-only imports from decision-authority.ts.

export type {
  AuthorityDomain,
  AuthorityDomainAssignment,
  AuthorityEscalation,
  AuthorityConfig,
  AuthorityStatus,
  AuthorityWithAssignments,
  GovernanceMode,
  WorkspaceAuthority,
} from "@/types/decision-authority";

export {
  AUTHORITY_DOMAINS,
  DOMAIN_DESCRIPTIONS,
  DOMAIN_LABELS,
} from "@/types/decision-authority";
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/types/decision-authority.ts apps/web/src/lib/workspace/decision-authority-types.ts
git commit -m "feat: decision authority types and constants"
```

---

## Task 3: DB Helper Library + Tests

**Files:**
- Create: `apps/web/src/lib/workspace/decision-authority.ts`
- Create: `apps/web/src/lib/workspace/__tests__/decision-authority.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/lib/workspace/__tests__/decision-authority.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only and the supabase client before importing the module under test
vi.mock("server-only", () => ({}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockIn = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  order: mockOrder.mockReturnThis(),
  single: mockSingle,
  upsert: mockUpsert.mockReturnThis(),
  delete: mockDelete.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  in: mockIn.mockReturnThis(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "user-1" } }, error: null })),
      },
      from: mockFrom,
    })
  ),
}));

import {
  getActiveWorkspaceAuthority,
  getWorkspaceMembers,
} from "../decision-authority";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getActiveWorkspaceAuthority", () => {
  it("returns null when no active authority exists", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: null });
    const result = await getActiveWorkspaceAuthority("ws-1");
    expect(result).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("workspace_authority");
  });

  it("returns the active authority record when one exists", async () => {
    const fakeAuthority = {
      id: "auth-1",
      workspace_id: "ws-1",
      org_id: "org-1",
      governance_mode: "workspace",
      status: "active",
      docuseal_submission_id: null,
      signed_at: null,
      created_at: "2026-06-15T00:00:00Z",
      updated_at: "2026-06-15T00:00:00Z",
    };
    mockSingle.mockResolvedValueOnce({ data: fakeAuthority, error: null });
    const result = await getActiveWorkspaceAuthority("ws-1");
    expect(result?.id).toBe("auth-1");
    expect(result?.status).toBe("active");
  });
});

describe("getWorkspaceMembers", () => {
  it("returns profiles with matching workspace_id", async () => {
    const fakeMembers = [
      { id: "user-1", full_name: "Alice", email: "alice@test.com", avatar_url: null },
      { id: "user-2", full_name: "Bob", email: "bob@test.com", avatar_url: null },
    ];
    mockEq.mockReturnThis();
    // Chain: from().select().eq() resolves to { data, error }
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: fakeMembers, error: null }),
    };
    mockFrom.mockReturnValueOnce(chain);
    const result = await getWorkspaceMembers("ws-1");
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("alice@test.com");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && pnpm exec vitest run src/lib/workspace/__tests__/decision-authority.test.ts
```

Expected: FAIL — module `../decision-authority` does not exist.

- [ ] **Step 3: Implement the DB helpers**

```typescript
// apps/web/src/lib/workspace/decision-authority.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  WorkspaceAuthority,
  AuthorityWithAssignments,
  AuthorityConfig,
  AuthorityDomain,
  GovernanceMode,
} from "@/types/decision-authority";

export interface WorkspaceMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

/** Returns the single active authority record for a workspace, or null. */
export async function getActiveWorkspaceAuthority(
  workspaceId: string
): Promise<WorkspaceAuthority | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_authority")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .single();
  if (error || !data) return null;
  return data as WorkspaceAuthority;
}

/** Returns the most recent non-superseded authority record (active or pending). */
export async function getCurrentWorkspaceAuthority(
  workspaceId: string
): Promise<WorkspaceAuthority | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_authority")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", ["active", "pending_signatures", "draft"])
    .order("created_at", { ascending: false })
    .single();
  if (error || !data) return null;
  return data as WorkspaceAuthority;
}

/** Returns all profiles that belong to this workspace. */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("workspace_id", workspaceId);
  if (error || !data) return [];
  return data as WorkspaceMember[];
}

/** Returns the full authority record with domain assignments and escalation. */
export async function getAuthorityWithAssignments(
  authorityId: string
): Promise<AuthorityWithAssignments | null> {
  const supabase = await createClient();

  const [{ data: authority, error: authErr }, { data: domains }, { data: escalations }] =
    await Promise.all([
      supabase
        .from("workspace_authority")
        .select("*")
        .eq("id", authorityId)
        .single(),
      supabase
        .from("workspace_authority_domains")
        .select("*")
        .eq("authority_id", authorityId),
      supabase
        .from("workspace_authority_escalation")
        .select("*")
        .eq("authority_id", authorityId),
    ]);

  if (authErr || !authority) return null;

  // Group domains and escalation into AuthorityConfig per property_id (null = workspace-wide)
  const configMap = new Map<string | null, AuthorityConfig>();

  for (const d of domains ?? []) {
    const key = d.property_id ?? null;
    if (!configMap.has(key)) {
      configMap.set(key, { property_id: key, domains: {}, escalation_owner_ids: [] });
    }
    configMap.get(key)!.domains[d.domain as AuthorityDomain] = d.assigned_owner_id;
  }

  for (const e of escalations ?? []) {
    const key = e.property_id ?? null;
    if (!configMap.has(key)) {
      configMap.set(key, { property_id: key, domains: {}, escalation_owner_ids: [] });
    }
    configMap.get(key)!.escalation_owner_ids = e.notify_owner_ids;
  }

  return {
    authority: authority as WorkspaceAuthority,
    configs: Array.from(configMap.values()),
  };
}

export interface SaveAuthorityInput {
  workspaceId: string;
  orgId: string;
  governanceMode: GovernanceMode;
  configs: AuthorityConfig[];
}

/**
 * Supersedes any existing non-superseded authority for this workspace, then
 * creates a new draft record with the provided config.
 * Returns the new authority ID, or null on error.
 */
export async function saveWorkspaceAuthority(
  input: SaveAuthorityInput
): Promise<string | null> {
  const supabase = await createClient();

  // Mark existing non-superseded records as superseded
  await supabase
    .from("workspace_authority")
    .update({ status: "superseded" })
    .eq("workspace_id", input.workspaceId)
    .in("status", ["draft", "pending_signatures", "active"]);

  // Insert new draft record
  const { data: newAuth, error: authErr } = await supabase
    .from("workspace_authority")
    .insert({
      workspace_id: input.workspaceId,
      org_id: input.orgId,
      governance_mode: input.governanceMode,
      status: "draft",
    })
    .select("id")
    .single();

  if (authErr || !newAuth) return null;

  const authorityId = newAuth.id as string;

  // Insert domain assignments
  const domainRows = input.configs.flatMap((config) =>
    (Object.entries(config.domains) as [AuthorityDomain, string][]).map(
      ([domain, assigned_owner_id]) => ({
        authority_id: authorityId,
        property_id: config.property_id,
        domain,
        assigned_owner_id,
      })
    )
  );

  if (domainRows.length > 0) {
    const { error: domErr } = await supabase
      .from("workspace_authority_domains")
      .insert(domainRows);
    if (domErr) return null;
  }

  // Insert escalation routing
  const escalationRows = input.configs
    .filter((c) => c.escalation_owner_ids.length > 0)
    .map((config) => ({
      authority_id: authorityId,
      property_id: config.property_id,
      notify_owner_ids: config.escalation_owner_ids,
    }));

  if (escalationRows.length > 0) {
    const { error: escErr } = await supabase
      .from("workspace_authority_escalation")
      .insert(escalationRows);
    if (escErr) return null;
  }

  return authorityId;
}

/** Marks an authority record as pending_signatures after DocuSeal submission is created. */
export async function markAuthorityPendingSignatures(
  authorityId: string,
  docusealSubmissionId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_authority")
    .update({ status: "pending_signatures", docuseal_submission_id: docusealSubmissionId })
    .eq("id", authorityId);
  return !error;
}

/** Called by the DocuSeal webhook when all owners have signed. */
export async function activateWorkspaceAuthority(
  docusealSubmissionId: string,
  signedAt: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_authority")
    .update({ status: "active", signed_at: signedAt })
    .eq("docuseal_submission_id", docusealSubmissionId)
    .eq("status", "pending_signatures");
  return !error;
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm exec vitest run src/lib/workspace/__tests__/decision-authority.test.ts
```

Expected: PASS.

- [ ] **Step 5: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/workspace/decision-authority.ts apps/web/src/lib/workspace/__tests__/decision-authority.test.ts
git commit -m "feat: decision authority DB helpers"
```

---

## Task 4: Authority Routing Utility + Tests

**Files:**
- Create: `apps/web/src/lib/workspace/authority-routing.ts`
- Create: `apps/web/src/lib/workspace/__tests__/authority-routing.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/lib/workspace/__tests__/authority-routing.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../decision-authority", () => ({
  getActiveWorkspaceAuthority: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    })
  ),
}));

import { getAuthorityOwner, getEscalationOwners } from "../authority-routing";
import { getActiveWorkspaceAuthority } from "../decision-authority";

const mockGetActive = vi.mocked(getActiveWorkspaceAuthority);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAuthorityOwner", () => {
  it("returns null when no active authority exists", async () => {
    mockGetActive.mockResolvedValue(null);
    const result = await getAuthorityOwner("ws-1", "documents_legal");
    expect(result).toBeNull();
  });

  it("returns the assigned owner profile ID for the given domain", async () => {
    mockGetActive.mockResolvedValue({
      id: "auth-1",
      workspace_id: "ws-1",
      org_id: "org-1",
      governance_mode: "workspace",
      status: "active",
      docuseal_submission_id: null,
      signed_at: "2026-06-15T00:00:00Z",
      created_at: "2026-06-15T00:00:00Z",
      updated_at: "2026-06-15T00:00:00Z",
    });

    // Mock the domain lookup
    const { createClient } = await import("@/lib/supabase/server");
    const mockSingle = vi.fn().mockResolvedValue({
      data: { assigned_owner_id: "user-1" },
      error: null,
    });
    (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: mockSingle,
      })),
    });

    const result = await getAuthorityOwner("ws-1", "documents_legal");
    expect(result).toBe("user-1");
  });
});

describe("getEscalationOwners", () => {
  it("returns empty array when no active authority exists", async () => {
    mockGetActive.mockResolvedValue(null);
    const result = await getEscalationOwners("ws-1");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && pnpm exec vitest run src/lib/workspace/__tests__/authority-routing.test.ts
```

Expected: FAIL — module `../authority-routing` does not exist.

- [ ] **Step 3: Implement the routing utility**

```typescript
// apps/web/src/lib/workspace/authority-routing.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceAuthority } from "./decision-authority";
import type { AuthorityDomain } from "@/types/decision-authority";

/**
 * Returns the profile ID of the owner assigned to the given domain,
 * or null if no active authority exists or no assignment was made.
 *
 * For per_property governance_mode, pass propertyId to get the property-specific
 * assignment. Falls back to workspace-wide (property_id IS NULL) if no
 * property-specific record exists.
 */
export async function getAuthorityOwner(
  workspaceId: string,
  domain: AuthorityDomain,
  propertyId?: string
): Promise<string | null> {
  const authority = await getActiveWorkspaceAuthority(workspaceId);
  if (!authority) return null;

  const supabase = await createClient();

  if (authority.governance_mode === "per_property" && propertyId) {
    // Try property-specific assignment first
    const { data: specific } = await supabase
      .from("workspace_authority_domains")
      .select("assigned_owner_id")
      .eq("authority_id", authority.id)
      .eq("domain", domain)
      .eq("property_id", propertyId)
      .single();

    if (specific?.assigned_owner_id) return specific.assigned_owner_id as string;
  }

  // Workspace-wide assignment (property_id IS NULL)
  const { data } = await supabase
    .from("workspace_authority_domains")
    .select("assigned_owner_id")
    .eq("authority_id", authority.id)
    .eq("domain", domain)
    .is("property_id", null)
    .single();

  return (data?.assigned_owner_id as string) ?? null;
}

/**
 * Returns the profile IDs to notify for guest escalations.
 * Returns an empty array when no active authority exists (caller falls back
 * to notifying all workspace members).
 */
export async function getEscalationOwners(
  workspaceId: string,
  propertyId?: string
): Promise<string[]> {
  const authority = await getActiveWorkspaceAuthority(workspaceId);
  if (!authority) return [];

  const supabase = await createClient();

  if (authority.governance_mode === "per_property" && propertyId) {
    const { data: specific } = await supabase
      .from("workspace_authority_escalation")
      .select("notify_owner_ids")
      .eq("authority_id", authority.id)
      .eq("property_id", propertyId)
      .single();

    if (specific?.notify_owner_ids?.length) {
      return specific.notify_owner_ids as string[];
    }
  }

  const { data } = await supabase
    .from("workspace_authority_escalation")
    .select("notify_owner_ids")
    .eq("authority_id", authority.id)
    .is("property_id", null)
    .single();

  return (data?.notify_owner_ids as string[]) ?? [];
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && pnpm exec vitest run src/lib/workspace/__tests__/authority-routing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/workspace/authority-routing.ts apps/web/src/lib/workspace/__tests__/authority-routing.test.ts
git commit -m "feat: authority routing utility (getAuthorityOwner, getEscalationOwners)"
```

---

## Task 5: Server Actions

**Files:**
- Create: `apps/web/src/app/(workspace)/workspace/account/decision-authority-actions.ts`

- [ ] **Step 1: Write the server actions**

```typescript
// apps/web/src/app/(workspace)/workspace/account/decision-authority-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import {
  saveWorkspaceAuthority,
  markAuthorityPendingSignatures,
  getWorkspaceMembers,
} from "@/lib/workspace/decision-authority";
import { createSubmission } from "@/lib/signing/docuseal";
import type { AuthorityConfig, GovernanceMode } from "@/types/decision-authority";
import { revalidatePath } from "next/cache";

async function getCurrentProfileAndWorkspace() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, workspace_id")
    .eq("id", user.id)
    .single();
  if (!profile?.workspace_id) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, type, org_id")
    .eq("id", profile.workspace_id)
    .single();
  if (!workspace) return null;

  return { profile, workspace };
}

/** Save governance config as a draft and return the new authority ID. */
export async function saveAuthorityConfigAction(
  governanceMode: GovernanceMode,
  configs: AuthorityConfig[]
): Promise<{ authorityId: string } | { error: string }> {
  const ctx = await getCurrentProfileAndWorkspace();
  if (!ctx) return { error: "Not authenticated." };

  const authorityId = await saveWorkspaceAuthority({
    workspaceId: ctx.workspace.id,
    orgId: ctx.workspace.org_id,
    governanceMode,
    configs,
  });

  if (!authorityId) return { error: "Failed to save authority configuration." };

  revalidatePath("/workspace/account");
  return { authorityId };
}

/**
 * Generates a DocuSeal addendum submission and sends signing links to all
 * workspace owners. Marks the authority record as pending_signatures.
 */
export async function sendAddendumForSignatureAction(
  authorityId: string
): Promise<{ ok: true } | { error: string }> {
  const ctx = await getCurrentProfileAndWorkspace();
  if (!ctx) return { error: "Not authenticated." };

  const templateId = process.env.DOCUSEAL_AUTHORITY_ADDENDUM_TEMPLATE_ID
    ? parseInt(process.env.DOCUSEAL_AUTHORITY_ADDENDUM_TEMPLATE_ID, 10)
    : null;

  if (!templateId) {
    return { error: "Addendum template is not configured. Contact support." };
  }

  const members = await getWorkspaceMembers(ctx.workspace.id);
  if (members.length < 2) {
    return { error: "At least two workspace members are required to send an addendum." };
  }

  const submitters = members.map((m, i) => ({
    role: `Owner ${i + 1}`,
    email: m.email,
    name: m.full_name ?? undefined,
    externalId: m.id,
  }));

  const result = await createSubmission({
    templateId,
    submitters,
    sendEmail: true,
    orderPreserved: false,
  });

  if (!result) {
    return { error: "Failed to create DocuSeal submission. Check DocuSeal configuration." };
  }

  const ok = await markAuthorityPendingSignatures(authorityId, String(result.submissionId));
  if (!ok) return { error: "Submission created but failed to update authority status." };

  revalidatePath("/workspace/account");
  return { ok: true };
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(workspace\)/workspace/account/decision-authority-actions.ts
git commit -m "feat: decision authority server actions"
```

---

## Task 6: DecisionAuthorityForm Client Component

**Files:**
- Create: `apps/web/src/app/(workspace)/workspace/account/components/DecisionAuthorityForm.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/web/src/app/(workspace)/workspace/account/components/DecisionAuthorityForm.tsx
"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Spinner, WarningCircle, FileText } from "@phosphor-icons/react";
import {
  AUTHORITY_DOMAINS,
  DOMAIN_LABELS,
  DOMAIN_DESCRIPTIONS,
} from "@/lib/workspace/decision-authority-types";
import type {
  AuthorityConfig,
  GovernanceMode,
  WorkspaceAuthority,
} from "@/lib/workspace/decision-authority-types";
import {
  saveAuthorityConfigAction,
  sendAddendumForSignatureAction,
} from "../decision-authority-actions";

export interface DecisionAuthorityFormMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface DecisionAuthorityFormProps {
  workspaceId: string;
  members: DecisionAuthorityFormMember[];
  properties: { id: string; name: string }[];
  existingAuthority: WorkspaceAuthority | null;
  existingConfig: AuthorityConfig | null; // workspace-wide config only for initial render
}

export function DecisionAuthorityForm({
  members,
  properties,
  existingAuthority,
  existingConfig,
}: DecisionAuthorityFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAuthorityId, setSavedAuthorityId] = useState<string | null>(
    existingAuthority?.status === "draft" ? existingAuthority.id : null
  );
  const [stage, setStage] = useState<"configure" | "pending_signature" | "signed">(
    existingAuthority?.status === "pending_signatures"
      ? "pending_signature"
      : existingAuthority?.status === "active"
        ? "signed"
        : "configure"
  );

  const [governanceMode, setGovernanceMode] = useState<GovernanceMode>(
    existingAuthority?.governance_mode ?? "workspace"
  );

  // For workspace-wide mode: single config with property_id null
  const [workspaceConfig, setWorkspaceConfig] = useState<AuthorityConfig>(
    existingConfig ?? { property_id: null, domains: {}, escalation_owner_ids: [] }
  );

  // For per-property mode: one config per property
  const [propertyConfigs, setPropertyConfigs] = useState<AuthorityConfig[]>(
    properties.map((p) => ({ property_id: p.id, domains: {}, escalation_owner_ids: [] }))
  );

  function getDisplayName(member: DecisionAuthorityFormMember) {
    return member.full_name?.trim() || member.email;
  }

  function updateWorkspaceDomain(domain: string, ownerId: string) {
    setWorkspaceConfig((prev) => ({
      ...prev,
      domains: { ...prev.domains, [domain]: ownerId },
    }));
  }

  function toggleWorkspaceEscalation(ownerId: string) {
    setWorkspaceConfig((prev) => {
      const current = prev.escalation_owner_ids;
      const next = current.includes(ownerId)
        ? current.filter((id) => id !== ownerId)
        : [...current, ownerId];
      return { ...prev, escalation_owner_ids: next };
    });
  }

  function handleSave() {
    setError(null);
    const configs = governanceMode === "workspace" ? [workspaceConfig] : propertyConfigs;
    startTransition(async () => {
      const result = await saveAuthorityConfigAction(governanceMode, configs);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSavedAuthorityId(result.authorityId);
    });
  }

  function handleSendForSignature() {
    if (!savedAuthorityId) return;
    setError(null);
    startTransition(async () => {
      const result = await sendAddendumForSignatureAction(savedAuthorityId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStage("pending_signature");
    });
  }

  if (stage === "signed") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border p-5"
        style={{
          backgroundColor: "rgba(16,185,129,0.06)",
          borderColor: "rgba(16,185,129,0.2)",
        }}
      >
        <CheckCircle size={22} weight="duotone" className="shrink-0 text-emerald-500" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Decision authority is active
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            All owners have signed the addendum. Platform actions are now routed accordingly.
          </p>
        </div>
      </div>
    );
  }

  if (stage === "pending_signature") {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border p-5"
        style={{
          backgroundColor: "rgba(245,158,11,0.06)",
          borderColor: "rgba(245,158,11,0.2)",
        }}
      >
        <FileText size={22} weight="duotone" className="shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Awaiting signatures
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            Signing links have been sent to all owners. The addendum becomes active once
            everyone has signed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Governance mode selector */}
      <div>
        <p
          className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Governance mode
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["workspace", "per_property"] as GovernanceMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGovernanceMode(mode)}
              className="rounded-xl border p-4 text-left"
              style={{
                backgroundColor:
                  governanceMode === mode
                    ? "rgba(2,170,235,0.06)"
                    : "var(--color-white)",
                borderColor:
                  governanceMode === mode
                    ? "var(--color-brand)"
                    : "var(--color-warm-gray-200)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{
                  color:
                    governanceMode === mode
                      ? "var(--color-brand)"
                      : "var(--color-text-primary)",
                }}
              >
                {mode === "workspace" ? "Workspace-wide" : "Per-property"}
              </p>
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {mode === "workspace"
                  ? "One set of assignments covers all properties."
                  : "Each property has its own authority assignments."}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Domain assignments */}
      {governanceMode === "workspace" && (
        <div className="flex flex-col gap-3">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Authority domains
          </p>
          {AUTHORITY_DOMAINS.map((domain) => (
            <div
              key={domain}
              className="rounded-xl border p-4"
              style={{
                backgroundColor: "var(--color-white)",
                borderColor: "var(--color-warm-gray-200)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--color-text-primary)" }}
              >
                {DOMAIN_LABELS[domain]}
              </p>
              <p
                className="mt-0.5 mb-3 text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {DOMAIN_DESCRIPTIONS[domain]}
              </p>
              <div className="flex gap-2">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => updateWorkspaceDomain(domain, member.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                    style={{
                      backgroundColor:
                        workspaceConfig.domains[domain] === member.id
                          ? "rgba(2,170,235,0.08)"
                          : "transparent",
                      borderColor:
                        workspaceConfig.domains[domain] === member.id
                          ? "var(--color-brand)"
                          : "var(--color-warm-gray-200)",
                      color:
                        workspaceConfig.domains[domain] === member.id
                          ? "var(--color-brand)"
                          : "var(--color-text-secondary)",
                    }}
                  >
                    {getDisplayName(member)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guest escalation */}
      {governanceMode === "workspace" && (
        <div
          className="rounded-xl border p-4"
          style={{
            backgroundColor: "var(--color-white)",
            borderColor: "var(--color-warm-gray-200)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Guest escalation routing
          </p>
          <p
            className="mt-0.5 mb-3 text-xs"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            When a guest situation requires an owner decision, notify:
          </p>
          <div className="flex gap-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleWorkspaceEscalation(member.id)}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: workspaceConfig.escalation_owner_ids.includes(member.id)
                    ? "rgba(2,170,235,0.08)"
                    : "transparent",
                  borderColor: workspaceConfig.escalation_owner_ids.includes(member.id)
                    ? "var(--color-brand)"
                    : "var(--color-warm-gray-200)",
                  color: workspaceConfig.escalation_owner_ids.includes(member.id)
                    ? "var(--color-brand)"
                    : "var(--color-text-secondary)",
                }}
              >
                {getDisplayName(member)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Per-property mode placeholder — wire full per-property UI in follow-up */}
      {governanceMode === "per_property" && (
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Per-property configuration: assign domains and escalation routing for each property
          below. (UI for per-property mode follows workspace-wide pattern above, one card per
          property.)
        </p>
      )}

      {error && (
        <div
          className="flex items-center gap-2 rounded-lg border p-3"
          style={{
            backgroundColor: "rgba(239,68,68,0.06)",
            borderColor: "rgba(239,68,68,0.2)",
          }}
        >
          <WarningCircle size={16} weight="duotone" className="shrink-0 text-red-500" />
          <p className="text-xs" style={{ color: "var(--color-text-primary)" }}>
            {error}
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
          style={{
            backgroundColor: "var(--color-warm-gray-100)",
            color: "var(--color-text-primary)",
          }}
        >
          {isPending ? <Spinner size={14} className="animate-spin" /> : null}
          Save draft
        </button>

        {savedAuthorityId && (
          <button
            type="button"
            onClick={handleSendForSignature}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-brand)" }}
          >
            {isPending ? <Spinner size={14} className="animate-spin" /> : null}
            Send for signature
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(workspace\)/workspace/account/components/DecisionAuthorityForm.tsx
git commit -m "feat: DecisionAuthorityForm client component"
```

---

## Task 7: DecisionAuthoritySection Server Component + Wire into Account Page

**Files:**
- Create: `apps/web/src/app/(workspace)/workspace/account/components/DecisionAuthoritySection.tsx`
- Modify: `apps/web/src/app/(workspace)/workspace/account/page.tsx`

- [ ] **Step 1: Write the server component**

```tsx
// apps/web/src/app/(workspace)/workspace/account/components/DecisionAuthoritySection.tsx
import { Scale } from "@phosphor-icons/react/dist/ssr";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentWorkspaceAuthority,
  getAuthorityWithAssignments,
  getWorkspaceMembers,
} from "@/lib/workspace/decision-authority";
import { DecisionAuthorityForm } from "./DecisionAuthorityForm";
import type { AuthorityConfig } from "@/types/decision-authority";

interface Props {
  workspaceId: string;
  orgId: string;
}

export async function DecisionAuthoritySection({ workspaceId, orgId }: Props) {
  const [authority, members, propertiesResult] = await Promise.all([
    getCurrentWorkspaceAuthority(workspaceId),
    getWorkspaceMembers(workspaceId),
    (async () => {
      const supabase = await createClient();
      return supabase
        .from("properties")
        .select("id, name")
        .eq("workspace_id", workspaceId)
        .order("name");
    })(),
  ]);

  // Section only renders for multi-member workspaces
  if (members.length < 2) return null;

  const properties = (propertiesResult.data ?? []) as { id: string; name: string }[];

  let existingConfig: AuthorityConfig | null = null;
  if (authority) {
    const full = await getAuthorityWithAssignments(authority.id);
    existingConfig = full?.configs.find((c) => c.property_id === null) ?? null;
  }

  return (
    <section id="decision-authority" className="scroll-mt-8">
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "var(--color-text-primary)" }}
      >
        Decision authority
      </h2>
      <p
        className="mb-6 text-sm"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Define who holds authority in each decision domain. Once signed, Proxy routes
        documents, financial actions, and escalations to the right owner automatically.
      </p>

      <div
        className="rounded-2xl border p-7"
        style={{
          backgroundColor: "var(--color-white)",
          borderColor: "var(--color-warm-gray-200)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(2,170,235,0.08)" }}
          >
            <Scale size={20} weight="duotone" style={{ color: "var(--color-brand)" }} />
          </div>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Decision Authority Addendum
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
              Available in your Paperwork template library
            </p>
          </div>
        </div>

        <DecisionAuthorityForm
          workspaceId={workspaceId}
          members={members}
          properties={properties}
          existingAuthority={authority}
          existingConfig={existingConfig}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add DecisionAuthoritySection to the account page**

In `apps/web/src/app/(workspace)/workspace/account/page.tsx`, add the import and render it after the WorkspaceSection. Find the section where `WorkspaceSection` is rendered and add immediately after:

```tsx
// Add import near top of page.tsx:
import { DecisionAuthoritySection } from "./components/DecisionAuthoritySection";

// Add in JSX after WorkspaceSection (only render when workspace exists):
{profile?.workspace_id && workspaceData ? (
  <DecisionAuthoritySection
    workspaceId={workspaceData.id}
    orgId={workspaceData.org_id}
  />
) : null}
```

Note: the account page already fetches `workspaceData` from `workspaces.select("id, name, type, ein")`. You will need to also select `org_id` — update that select to `"id, name, type, ein, org_id"`.

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(workspace\)/workspace/account/components/DecisionAuthoritySection.tsx apps/web/src/app/\(workspace\)/workspace/account/page.tsx
git commit -m "feat: DecisionAuthoritySection wired into workspace account page"
```

---

## Task 8: Soft Prompt Banner for Multi-Owner Workspaces

**Files:**
- Create: `apps/web/src/app/(workspace)/workspace/account/components/AuthorityPromptBanner.tsx`
- Modify: `apps/web/src/app/(workspace)/workspace/home/page.tsx`

- [ ] **Step 1: Write the banner component**

```tsx
// apps/web/src/app/(workspace)/workspace/account/components/AuthorityPromptBanner.tsx
"use client";

import { useState } from "react";
import { Scale, X } from "@phosphor-icons/react";
import Link from "next/link";

interface AuthorityPromptBannerProps {
  /** Only pass this component when the workspace has 2+ members and no active authority. */
  workspaceMemberCount: number;
}

export function AuthorityPromptBanner({ workspaceMemberCount }: AuthorityPromptBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || workspaceMemberCount < 2) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border p-4"
      style={{
        backgroundColor: "rgba(2,170,235,0.04)",
        borderColor: "rgba(2,170,235,0.15)",
      }}
    >
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "rgba(2,170,235,0.08)" }}
      >
        <Scale size={16} weight="duotone" style={{ color: "var(--color-brand)" }} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Define decision authority for your workspace
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-secondary)" }}>
          You share this workspace with another owner. Setting up a Decision Authority
          Addendum clarifies who handles documents, finances, and operations.
        </p>
        <Link
          href="/workspace/account#decision-authority"
          className="mt-2 inline-block text-xs font-semibold"
          style={{ color: "var(--color-brand)" }}
        >
          Set it up
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-0.5 shrink-0 rounded p-1"
        style={{ color: "var(--color-text-tertiary)" }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add the banner to the workspace home page**

In `apps/web/src/app/(workspace)/workspace/home/page.tsx`, import and render the banner at the top of the home content. It should only render when there are 2+ members and no active authority.

Read the current home page to find where to insert it, then add:

```tsx
// Import (add near top):
import { AuthorityPromptBanner } from "../account/components/AuthorityPromptBanner";
import { getCurrentWorkspaceAuthority, getWorkspaceMembers } from "@/lib/workspace/decision-authority";

// In the server component body (after profile/workspace fetch):
const [workspaceAuthority, workspaceMembers] = profile?.workspace_id
  ? await Promise.all([
      getCurrentWorkspaceAuthority(profile.workspace_id),
      getWorkspaceMembers(profile.workspace_id),
    ])
  : [null, []];

const showAuthorityPrompt =
  workspaceMembers.length >= 2 && workspaceAuthority?.status !== "active";

// In JSX at the top of the content area:
{showAuthorityPrompt && (
  <AuthorityPromptBanner workspaceMemberCount={workspaceMembers.length} />
)}
```

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(workspace\)/workspace/account/components/AuthorityPromptBanner.tsx apps/web/src/app/\(workspace\)/workspace/home/page.tsx
git commit -m "feat: soft authority prompt banner for multi-owner workspaces"
```

---

## Task 9: DocuSeal Webhook Handler Update

**Files:**
- Modify: `apps/web/src/app/api/webhooks/docuseal/route.ts`

- [ ] **Step 1: Read the current webhook handler**

Read `apps/web/src/app/api/webhooks/docuseal/route.ts` to understand the existing event handling structure before modifying.

- [ ] **Step 2: Add the addendum completion handler**

Find the section in the webhook handler that processes DocuSeal events and add handling for the authority addendum. The key event is `submission.completed` (all submitters have signed). Match it by checking whether the submission's `external_id` pattern or template metadata identifies it as an authority addendum.

Since the addendum submission was created with no external ID on the submission itself (only per-submitter external IDs), match by looking up `docuseal_submission_id` in `workspace_authority`:

```typescript
// Add this import at the top of the webhook route:
import { activateWorkspaceAuthority } from "@/lib/workspace/decision-authority";

// Inside the event handler, add a case for "submission.completed":
// (find the existing switch/if-else structure and add alongside other event types)
if (event.event_type === "submission.completed") {
  const submissionId = String(event.data?.id ?? "");
  if (submissionId) {
    await activateWorkspaceAuthority(submissionId, new Date().toISOString());
  }
}
```

`activateWorkspaceAuthority` uses `.eq("docuseal_submission_id", ...)` so it is safe to call for every `submission.completed` event: if the ID does not match any authority record it silently does nothing.

- [ ] **Step 3: Type-check**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/webhooks/docuseal/route.ts
git commit -m "feat: activate workspace authority on DocuSeal submission.completed"
```

---

## Task 10: DocuSeal Template Setup (Manual)

This task is performed by Proxy staff, not by the engineer implementing the code.

- [ ] **Step 1: Create the addendum template in DocuSeal**

Log into DocuSeal at `https://sign.myproxyhost.com` (or DocuSeal cloud if not self-hosted). Create a new template named "Decision Authority Addendum" with the following fields:

| Field name | Type | Notes |
|---|---|---|
| `workspace_name` | Text | Pre-filled with workspace name |
| `entity_type` | Text | Pre-filled with workspace type (LLC, Partnership, etc.) |
| `governance_mode` | Text | Pre-filled: "Workspace-wide" or "Per-property" |
| `owner_1_name` | Text | Pre-filled with owner 1 full name |
| `owner_2_name` | Text | Pre-filled with owner 2 full name |
| `domain_documents_legal` | Text | Pre-filled with assigned owner name |
| `domain_finances_payouts` | Text | Pre-filled with assigned owner name |
| `domain_operations_maintenance` | Text | Pre-filled with assigned owner name |
| `escalation_routing` | Text | Pre-filled: "Owner 1", "Owner 2", or "Both" |
| `signature_owner_1` | Signature | Assigned to "Owner 1" role |
| `signature_owner_2` | Signature | Assigned to "Owner 2" role |
| `date_signed` | Date | Auto-filled on completion |

- [ ] **Step 2: Copy the template ID from DocuSeal**

After creating the template, DocuSeal shows the template ID in the URL (e.g., `/templates/12345`). Copy that number.

- [ ] **Step 3: Set the env var in Doppler**

```bash
doppler secrets set DOCUSEAL_AUTHORITY_ADDENDUM_TEMPLATE_ID=12345 --project proxy --config dev
doppler secrets set DOCUSEAL_AUTHORITY_ADDENDUM_TEMPLATE_ID=12345 --project proxy --config stg
doppler secrets set DOCUSEAL_AUTHORITY_ADDENDUM_TEMPLATE_ID=12345 --project proxy --config prd
```

---

## Verification

After all tasks are complete:

- [ ] Run the full test suite: `cd apps/web && pnpm exec vitest run`
- [ ] Run type-check: `cd apps/web && pnpm exec tsc --noEmit`
- [ ] Start the dev server: `doppler run -- next dev -p 4000` from `apps/web/`
- [ ] Log in as a workspace owner who shares the workspace with a second member
- [ ] Verify the `AuthorityPromptBanner` appears on the workspace home page
- [ ] Navigate to `/workspace/account#decision-authority` and verify `DecisionAuthoritySection` renders
- [ ] Configure workspace-wide mode, assign domains, set escalation routing
- [ ] Click "Save draft" and verify a `workspace_authority` row is created with `status = 'draft'`
- [ ] Click "Send for signature" and verify DocuSeal sends signing emails (check DocuSeal dashboard)
- [ ] Simulate the `submission.completed` webhook and verify `status` flips to `active`
- [ ] Verify the section renders the "active" signed state after activation
- [ ] Verify `getAuthorityOwner("ws-id", "documents_legal")` returns the correct profile ID

---

## Self-Review: Spec Coverage

| Design requirement | Covered by |
|---|---|
| Template available in Paperwork library to all workspaces | Task 10 (manual DocuSeal setup); template is always accessible |
| Multi-owner soft prompt, dismissible, not required | Task 8 |
| Governance mode: workspace-wide or per-property | Task 6, Task 3 |
| Three authority domains, one owner each | Tasks 2, 3, 6 |
| Guest escalation routing: one or both owners | Tasks 2, 3, 6 |
| DocuSeal addendum generation from template | Task 5 |
| Both owners receive signing links | Task 5 |
| Signed copy stored in Paperwork | DocuSeal handles attachment; webhook marks active (Task 9) |
| No active authority = fall back to current behavior | `getAuthorityOwner` returns null; callers handle null as "no routing" |
| Authority superseded when membership changes | Not automated in v1 — admin handles via SQL; add as follow-up |
