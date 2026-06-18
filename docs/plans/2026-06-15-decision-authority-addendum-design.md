# Decision Authority Addendum: Design

**Date:** 2026-06-15
**Status:** Approved

---

## Problem

When a workspace has two or more co-owners, Proxy has no record of who holds authority over which decisions. All three areas that matter break equally: document signing (who signs W-9s, leases, agreements), approval routing (who gets notified and is expected to act), and financial decisions (who receives payout reports and approves expenses). The platform currently notifies all workspace members for everything, which creates ambiguity and friction between co-owners.

---

## Solution

A Decision Authority Addendum: a pre-built DocuSeal template in the Paperwork library that co-owners can use to define, in writing, who holds authority in each decision domain. The platform uses the signed assignments to route actions to the right person. It is opt-in, never required, and always available in the template library regardless of workspace size.

---

## Availability

- The addendum template lives in the Paperwork template library for every workspace.
- When a second owner joins a workspace, Proxy shows a soft one-time prompt: "Want to define decision authority for your workspace?" It is dismissible and never blocks any workflow.
- Single-owner workspaces see no prompt but can access the template at any time from the library.
- The template is available on all plan tiers.

---

## Governance Mode

Before configuring domain assignments, a workspace selects one governance mode. This is set once and applies until a new addendum is signed.

| Mode | When to use |
|---|---|
| **Workspace-wide** | Same domain assignments apply to all properties. One addendum, one signature session. Best for LLCs and partnerships where the same two owners have consistent roles across their entire portfolio. |
| **Per-property** | Each property gets its own domain assignments and its own signed addendum. Best when the same two owners intentionally take different roles on different properties. |

Single-owner workspaces do not see this choice.

---

## Authority Domains

Proxy defines four fixed domains. Three are authority domains (single owner, legally binding routing). One is an escalation routing preference (one or both owners).

### Three Authority Domains

Each is assigned to exactly one owner. No shared or joint assignments. If co-owners want to make a joint decision, they do so outside the platform. Proxy needs one routing target per domain.

| Domain | What it governs in Proxy |
|---|---|
| **Documents & Legal** | Who receives DocuSeal signature requests for W-9s, management agreements, leases, and document templates |
| **Finances & Payouts** | Who receives payout reports, approves expenses, and is routed financial decisions and statements |
| **Operations & Maintenance** | Who approves maintenance requests, owner blocks, and property-level operational decisions |

### Guest Escalation Routing

This is not an authority domain. Proxy handles day-to-day guest communication. The escalation setting answers only one question: when a guest situation requires an owner decision that goes beyond what Proxy can resolve, who gets notified?

Options:
- Owner A only
- Owner B only
- Both owners

This can be set to both without conflict, because it is a notification preference, not a legal authority assignment.

---

## The Addendum Document

- Proxy ships a pre-built DocuSeal template: "Decision Authority Addendum."
- When a workspace configures their authority setup, the platform generates an instance from the template pre-filled with: workspace name, entity type (LLC, partnership, trust, etc.), property address(es) based on governance mode, owner legal names, domain assignments, and escalation routing selection.
- The document is sent to all workspace owners for e-signature via DocuSeal.
- The signed copy is stored in the workspace's Paperwork section like any other signed document.
- Per-property mode generates one signed addendum per property.

---

## Platform Behavior

### When no addendum is active

Platform behaves as it does today. All workspace members are notified for all actions. No routing hierarchy. No change to existing behavior.

### When an addendum is active (signed by all owners)

| Action type | Routing |
|---|---|
| DocuSeal signature request | Sent to the owner assigned to Documents & Legal |
| Financial reports, payout notifications | Sent to the owner assigned to Finances & Payouts |
| Maintenance approval, owner block requests | Sent to the owner assigned to Operations & Maintenance |
| Guest escalation | Sent to the owner(s) selected in escalation routing |

The non-authority owner for any domain continues to have full read access in the platform. They are not blocked from seeing anything. They just are not the default action target.

---

## Data Model (high-level)

```
workspace_authority
  id
  workspace_id          FK → workspaces
  governance_mode       enum: workspace | per_property
  status                enum: draft | pending_signatures | active | superseded
  docuseal_document_id  nullable, populated after generation
  signed_at             nullable
  created_at
  updated_at

workspace_authority_domains
  id
  workspace_authority_id  FK → workspace_authority
  property_id             nullable (null = workspace-wide; populated for per-property mode)
  domain                  enum: documents_legal | finances_payouts | operations_maintenance
  assigned_owner_id       FK → profiles

workspace_authority_escalation
  id
  workspace_authority_id  FK → workspace_authority
  property_id             nullable (matches governance mode)
  notify_owner_ids        uuid[] (one or both owners)
```

---

## Constraints and Edge Cases

- **Workspace with one owner:** no addendum needed, no prompt, template still accessible.
- **Third owner added after addendum is signed:** the existing addendum is marked superseded. Proxy prompts all owners to reconfigure and re-sign.
- **Owner removed:** same as above. Existing addendum superseded, re-configuration required.
- **No addendum signed:** platform falls back to current behavior with no degradation.
- **Per-property mode, new property added:** the new property has no addendum. Proxy prompts to configure authority for it. Until signed, that property falls back to notify-all behavior.
- **Governance mode change:** requires a new addendum. Previous addendum is superseded when the new one is signed.

---

## Out of Scope

- Joint/quorum decisions (both owners must approve before an action executes). Not in this version.
- Dollar thresholds for escalation. Not in this version.
- Domain authority for org-level admins (Proxy staff). Admin access is governed by `org_member_role`, not the addendum.
- Custom domain labels. Proxy's four domains are fixed.
