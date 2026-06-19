# Agency Role and Permission Model — Design Spec

- Date: 2026-06-18
- Status: Approved design, pending spec review
- Author: Johanan Nunez (Superadmin)
- Related: `docs/audits/2026-06-18-platform-gap-audit.md` (this model remediates the
  cross-tenant findings M1, M2, M3)

---

## 1. Problem

Proxy is turning into a multi-tenant SaaS. Property-management **agencies** subscribe, and the
people those agencies serve (**clients**, i.e. property owners) use the platform too. The current
code does not reflect that.

- `profiles.role = 'admin'` is overloaded. It means "Proxy / the founder" **and** it is what gates
  essentially all back-office access. The per-organization roles in `organization_members`
  (`org_owner`, `org_admin`) exist but barely gate anything.
- Consequence, confirmed in the 2026-06-18 audit: admin-scoped, service-role writes are not
  agency-scoped (receipts, W-9 PII signed URLs, avatars). With one operator org today this is
  latent, but the moment a second agency exists, one agency's admin can reach another agency's
  data, because a single `admin` flag cannot tell platform power apart from tenant power.

We need one unambiguous hierarchy, platform and tenant roles in **separate namespaces**, and the
codebase renamed to match the product language (no UI-says-Agency / code-says-org split).

---

## 2. The Model

```
SUPERADMIN — the platform (you). One person today.
  │
  └── AGENCY — the subscriber's business (property manager, company, or solo operator)
        │   staff who work across all the agency's workspaces:
        │     ADMIN    the subscriber / billing person. Account holder, full control.
        │     MEMBER   staff the Admin adds; scoped to the workspaces they are assigned
        │
        └── WORKSPACE — a client hub. An agency has MANY (a solo operator might run 12).
              ├── CLIENT(s)   the person or people the agency serves here. The portal users.
              └── Properties / houses, plus files, tasks, and documents for that engagement
```

Definitions:

- **Superadmin**: global platform authority. Manages agencies, subscriptions, and system health.
  Lives in its own namespace and never functions as a tenant role.
- **Agency**: the subscribing business. The platform hosts many of them. Holds the subscription
  (at a pricing tier) and billing. The unit of tenancy; every workspace belongs to exactly one
  agency.
- **Admin** (agency): full control of one agency, including billing, deleting the agency, managing
  members, and managing all of the agency's workspaces, clients, properties, and finances.
- **Member** (agency): internal staff added by an Admin. Access is a permission set scoped to the
  workspaces they are assigned, never global.
- **Workspace**: a collaborative client hub. An agency has many, one per client engagement. Holds
  that client's people, properties/houses, files, tasks, and documents. This is today's
  `workspaces` table, kept as-is (not renamed).
- **Client**: the person or people the agency serves inside a workspace. They sign into the Client
  portal and see their workspace (files, tasks, documents). A workspace can hold more than one
  client-person (co-owners, the owner's accountant). Not agency staff.

**Concrete instance (this deployment).** "Proxy" is the **platform** (myproxyhost.com), the layer
owned by the Superadmin. It is not an agency and has no row in `agencies`. The founder's own
co-hosting business, **The Parcel Company**, is the **first agency** on the platform, a tenant like
any other, whose Admin and billing owner also happens to be the Superadmin (dogfooding). So Johanan
Nunez holds two roles at once: Superadmin of Proxy and Admin of The Parcel Company. This is the
clearest reason the two namespaces must stay separate. The seed `organizations` row currently
labeled "Proxy" should be renamed to "The Parcel Company"; "Proxy" is reserved for the platform.

---

## 3. The Two-Namespace Rule (the core fix)

- Platform roles live on `profiles.platform_role` (`superadmin`; later `support`, `compliance`,
  `finance`).
- Agency roles live on `agency_members.role` (`admin`, `member`).
- **Platform roles never grant access to tenant data.** Tenant access is decided solely by agency
  membership and its permissions.
- In code, never gate on a bare `admin`. You are `platform_role = 'superadmin'`. An agency admin is
  `agency_members.role = 'admin'`. They are different columns on different tables, so no query can
  confuse "is this person an agency admin" with "is this person the platform owner."

This is the direct resolution of today's overloaded single `profiles.role = 'admin'`.

---

## 4. Roles, Permissions, and Scope

**Membership is the base fact.** Belonging to an agency is one row in `agency_members`. Role and
permissions are attributes of that row. The Admin is the member whose role is `admin`; there is no
separate "owner" entity.

**Roles** are named bundles of capabilities, for convenience:

- **Admin** = all capabilities, plus the account-principal powers: billing, the subscription and
  tier, creating and deleting workspaces, deleting the agency, and transferring ownership. Billing
  is an **attribute** (the billing account holder), transferable. **Multiple admins are allowed**,
  with exactly one flagged as the billing account holder.
- **Member** = a configurable subset of capabilities, narrowable by workspace scope. "High" and
  "low" access is just how broad that subset is.

**Capabilities** map to areas of the agency (enumerated; final list set during implementation),
for example: `manage_subscription`, `manage_billing`, `manage_members`, `create_workspace`,
`delete_workspace`, `manage_properties`, `manage_tasks`, `access_inbox`, `manage_finances`,
`view_finances`, `send_documents`.

**Scope** controls which **workspaces** a member can act on: `all`, or `assigned` (an explicit list
of workspaces via an assignment table). A member assigned to 4 of the agency's 12 workspaces sees
only those 4 and everything inside them.

**Ship vs. model:** model the permission and scope columns from day one (cheap, and it is the
requested capability). Ship with two roles (Admin, Member) and an all-or-assigned scope toggle.
Build the per-capability permissions editor UI later; the schema already supports it.

### Entitlements vs. permissions (two separate gates)

Two different systems gate access and must never be conflated:

- **Entitlements** = what the agency's subscription **tier** unlocks (limits such as number of
  workspaces or members, and premium features). A block here means "your plan does not include
  this," and the remedy is to upgrade.
- **Permissions** = what a given member is **allowed** to do (capabilities plus workspace scope).
  A block here means "you do not have access," and the remedy is for an Admin to grant it.

Different checks, different error messages, different remedies. Mixing them produces the worst kind
of confusing UX (telling a user to upgrade when they actually need permission, or vice versa).

### What each role can touch (summary)

- **Superadmin**: full control of the *platform* (agencies, plans, system health). Access into a
  tenant's actual content is **support-only and audited**, never a casual god-view. This is why the
  founder reads The Parcel Company's data through the Agency Admin hat, not the Superadmin hat.
- **Agency Admin**: full control of one agency and all its workspaces, including billing, the plan,
  members and permissions, and creating or deleting workspaces.
- **Member**: scoped. Acts only inside **assigned workspaces**, at a per-area level. Never sees
  billing, the plan, members, or workspace deletion.
- **Client**: their own workspace only (view, plus acting on their own tasks and documents).

### How a Member is scoped (best practice)

Two dials define a Member:

1. **Workspace scope** — `all`, or `assigned` (an explicit subset). Default `assigned`.
2. **Area level** — for each area (Properties, Tasks, Documents, Inbox, Finances), one of
   `none` / `view` / `manage`. Default `view`.

Hard ceiling: Billing, Subscription, Members, Agency settings, and Create/Delete workspace are
**Admin-only** and never appear on a Member's menu.

Principles enforced:

- **Least privilege by default** (new members start narrow: assigned workspaces, view level).
- **Deny by default in the database** (RLS denies anything not explicitly granted; UI hiding is not
  a control).
- **Role as bundle, scope as filter** (scoped RBAC).
- **Separation of duties** (finance access is off until an Admin grants it).
- **No self-escalation** (only Admins edit members; Members cannot see that surface).
- **Explicit, auditable grants** (every permission change is logged).

Ship four presets that map to real jobs (Operator, Bookkeeper, Coordinator, Read-only), then allow
full custom control underneath.

---

## 5. Surfaces (three consoles)

| Today | Becomes | Who uses it |
| --- | --- | --- |
| `src/app/(admin)/admin` | **Agency console** | Agency Admins and Members (scoped) |
| `src/app/(workspace)/workspace` | **Client portal** | Clients |
| (new, thin) | **Platform console** | Superadmin (you) |

The current `(admin)` back-office is really an *agency* console; it only feels like a *platform*
console because you are the only agency today. The new Platform console (manage agencies,
subscriptions and tiers, system health) must be carved out from it so platform power and agency
power live on different surfaces.

### Navigation map

**Agency console** (Admins see all; Members see only their assigned workspaces):
- Workspaces (the list of client hubs; open one to drill in)
- Tasks (the global queue across all workspaces)
- Inbox (client messages)
- Settings (billing, subscription and tier, Members and their permissions, branding, integrations)

**Inside one Workspace** (a staff member drilling in; also the shape a Client sees of their own):
- Overview
- Properties (the client's houses)
- Tasks
- Files and Documents
- People (the client contacts: owner, co-owner, accountant)
- Settings (this workspace)

**Client portal** (the client signs in and sees only their own workspace): Home, Properties, Tasks,
Files and Documents, Messages, Account.

**Platform console** (Superadmin): Agencies, Subscriptions and tiers, System health.

---

## 6. Data Model Changes

Renames (product language end to end, no patchwork):

- `organizations` → `agencies`
- `organization_members` → `agency_members`, plus new columns: `permissions` (capability set),
  `scope` (`all` | `assigned`), `is_billing_owner` (boolean)
- `org_id` → `agency_id` on every tenant table
- `profiles`: add `platform_role`; migrate today's `role`:
  - `admin` (you) → `platform_role = 'superadmin'`
  - `compliance` → `platform_role = 'compliance'` (platform staff, later)
  - `owner` → relabeled as a **Client** (a person served inside a workspace); not a table change
- `src/lib/organizations` → `src/lib/agencies`
- `agencies` carry the subscription **tier** and status (today's org `plan_tier`), which drive
  entitlements (workspace and member limits, premium features), enforced separately from permissions
- Rename the seed org row "Proxy" to "The Parcel Company" (it is the founder's agency, not the
  platform). "Proxy" is the platform/system layer, not an `agencies` row. The `PROXY_ORG_ID`
  sentinel and `current_org_id()` fallback need a deliberate decision in the plan: keep it as the
  default agency for legacy rows, or repoint it; do not leave it meaning "the platform."
- Regenerate Supabase types

**`workspaces` is kept, not renamed.** This is the deliberate decision. The `workspaces` table, the
`workspace_id` columns (~800 references), `auth_workspace_id()`, `src/lib/workspace`, the
`(workspace)` route, and `(admin)/admin/workspaces/[id]` all stay. A workspace is a client hub, and
the word reads clearly to clients on the front end ("your workspace"). Keeping it removes the single
largest and riskiest rename (~400 files / ~4,000 references) from the effort.

**Existing structure (do not invent, just clarify):** the codebase already half-built this
three-tier shape. The recent `org_id` retrofit layered `organizations` on top of the older
`workspaces` concept. So you already have agency over workspace over people.

```
AGENCY (organizations → agencies)
  └─ contains many → WORKSPACE (workspaces, kept)   a client hub, has agency_id (was org_id)
                       ├─ CLIENT(s): people (profiles with workspace_id), served by the agency
                       └─ properties / houses, documents, tasks, files, billing
```

**Client modeling (resolved):** a Client is not a new table and the workspace is not renamed. A
Client is the person or people served inside a workspace, today's `profiles` with `role = 'owner'`
and a `workspace_id`, relabeled to "Client." A workspace already supports more than one such person
(max 2 today). The agency link is `agency_id` on the workspace (today's `org_id`).

Functions:

- `current_org_id()` → `current_agency_id()`
- `is_org_admin(org_id)` → `is_agency_admin(agency_id)` plus a new
  `has_agency_permission(agency_id, capability)` helper
- `is_compliance_or_admin()` → re-scope to platform staff and revisit (it currently gates W-9 / tax
  PII with a global role; that becomes a platform-staff check)

**Client modeling (decision to finalize in the plan):** a Client is a property owner served by an
agency, with own-data-only access. Recommended representation is a dedicated `agency_clients` link
(agency_id, client_profile_id) rather than an `agency_members` row, because a Client is not staff
and its access model (own resources only) is fundamentally different from a scoped staff member.

---

## 7. Row-Level Security

- Every tenant table is scoped by `agency_id` plus membership/permission.
- Replace `is_org_admin` usage with `is_agency_admin(agency_id)` and
  `has_agency_permission(agency_id, capability)`.
- Client read policies grant access to the client's own resources only.
- By construction this closes audit findings M1, M2, M3: every admin-scoped write becomes
  agency-scoped, so cross-agency reach is impossible at the database layer, not just the app layer.

---

## 8. Migration Strategy (expand then contract)

1. **Expand:** add `agencies`, `agency_members`, `agency_id`, and `platform_role` alongside the
   existing shapes. Backfill from `organizations` / `org_id`. Dual-write where a cutover window
   needs it.
2. **Cut over:** application code and RLS read from the new shapes.
3. **Contract:** drop `organizations`, `org_id`, and the old `role`-as-admin usage.
4. **Verify (evidence over assertion):** grep counts of `org_id`, `organization`, and any bare
   `role === 'admin'` gate in scope must be **zero** before the migration is called done. Tests
   green, types clean.

Risk is low today: one agency, ~19 profiles, two admins, little data.

---

## 9. Build Sequence (phases for the implementation plan)

1. **Namespace and rename:** `agencies` / `agency_members` / `agency_id`, `platform_role`, RLS
   rewrite. This is the security-critical untangling and ships first. `workspaces` is left untouched.
2. **Member permission model:** capabilities, role bundles, scope by assigned workspace.
3. **Platform console:** the new thin Superadmin surface, split out of `(admin)`.
4. **Client relabel (small):** present today's served `owner` profiles as "Clients" across the
   Agency console and the Client portal. Label and copy, not a table rename, because `workspaces`
   stays.

Each phase is independently shippable. Phase 1 alone removes the overloaded-`admin` risk. The only
large rename is `org` to `agency`; `workspaces` is deliberately kept, which is what keeps this
effort safe.

---

## 10. Out of Scope (separate, already-decided workstreams)

- **Property-documents lockdown** (private bucket, signed URLs, owner-managed linking). Depends on
  this model for agency scoping; sequence it right after Phase 1.
- **Hospitable disconnect** (neutralize the unauthenticated webhook, feature-flag the integration).
- **Finance tab** (agency-generated invoices to clients for management fees and reimbursements).
- **Per-capability permission editor UI** (schema is ready now, UI comes later).

---

## 11. Risks

- A large rename right after the recent `org_id` retrofit. Mitigated by expand/contract, grep-count
  verification, and the existing test suite.
- "Admin" versus "Superadmin" can blur in conversation. Mitigated in code by separate columns and
  never gating on a bare `admin`.
- The Client representation (separate link vs. membership row) must be finalized in the plan.

---

## 12. Success Criteria

- No code path uses a single `admin` flag to gate both platform and tenant access.
- A second agency cannot read or write the first agency's data (verified by a cross-agency probe).
- Every tenant query is scoped by `agency_id`.
- Tests green, types clean, in-scope grep counts for `org_id` / `organization` are zero.
</content>
