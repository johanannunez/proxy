# Workspace Status Board — Design (2026-06-13)

**Goal:** Replace the admin Documents tab's `List | Coverage` with a single premium, workspace-centric **Status Board**: every workspace's compliance across all required documents/forms/files, percent complete, not-needed support, drill-in, wired to real data. No migration (the schema + data already support it).

## Data model (already exists)
- `documents(owner_id, workspace_id, property_id, scope_kind: owner|property|shared, document_key, form_key, doc_type, source, status, waived, sent_at, submitted_at, reviewed_at, completed_at, manually_completed_at, expires_at, renewal_due_at)`
- `document_signers(document_id, role: signer|countersigner, status: pending|signed|declined, signer_name, signer_email, signed_at, order_index)`
- `properties(owner_id -> profiles)`, `profiles(workspace_id -> workspaces)`, `workspaces(id, name, type, org_id)`
- Reality: 10 workspaces (9 active), 13 profiles in workspaces, 15 properties, 340 requirement rows. Each `documents` row IS a requirement instance for an owner/property/workspace.

## Columns = requirement types, grouped by KIND (config map req_key -> {label, kind, scope})
- **Signatures** (e-sign, securedocs): host_rental_agreement, ach_authorization, card_authorization
- **Files** (uploads/verification): str_permit, insurance_certificate, w9, identity, platform_authorization
- **Forms** (data entry): wifi_info, hoa_info, guidebook, property_setup, block_dates_calendar, onboarding_inspection, property_offboarding, paid_onboarding_fee
- Kind toggle: All / Signatures / Forms / Files. Unknown keys -> Forms (safe default), logged.

## Cell = (workspace x requirement)
- Scope entities: owner-scope -> the workspace's owner profiles; property-scope -> the workspace's properties; shared -> 1.
- Gather the workspace's `documents` rows for that req_key; for each scope entity find its best instance.
- Per-entity state: complete (status in on_file/submitted/reviewed OR manually_completed_at set OR a signed_document on_file) | in_progress (sent + viewed/partial) | sent | declined | needed | not_needed (waived).
- Cell aggregate: fraction done = entitiesComplete / (entities - entitiesNotNeeded). Ring fill = fraction; color by worst-outstanding (declined=red, none-started=gray, partial=blue, all done=green, all not-needed=neutral).
- Not-needed cell: every entity waived -> excluded from the workspace denominator.

## Completion math
- Workspace % = completedRequirements / (totalRequirements - notNeededRequirements). A requirement counts complete when all its (non-waived) entities are complete.
- Column % = workspacesComplete / workspacesApplicable.
- Not-needed is neutral: removed from the denominator (does not help or hurt). (User-confirmed direction.)

## Interactions (port the polished preview pieces, wire to real data)
- **Hover a cell -> cursor-following card**: requirement name + status chip + Sent/Viewed/Signed (or Submitted/Reviewed, or Uploaded) timeline + signer list (document_signers; multiple per workspace) + per-entity breakdown (e.g. "2 of 3 properties done"). Edge-flips, pointer-events none, reduced-motion safe.
- **Click a workspace name or any cell -> Workspace drawer**: header (workspace name, type, overall %), then its owners + properties, and every requirement grouped by kind with status + timeline + drill to the specific owner/property. Mark-not-needed toggle per requirement.
- **Filter bar**: workspace search, Kind tabs (All/Sig/Forms/Files), status filter (Outstanding/Complete/Declined/Not needed), and "focus one requirement" (isolate a single column across all workspaces).
- **Needs Action hero** stays on top (workspace-aware: requirements awaiting action / overdue / your countersignature).

## Not-needed action
- `setRequirementNotNeeded(workspaceId, reqKey, notNeeded)`: set `waived` on the matching `documents` rows for that workspace + req_key (across its entities). Reversible. Excluded from completion. (No migration; uses existing `waived`.)

## Build order
1. Backend: `status-board-config.ts` (req map), `status-board-types.ts` (client-safe types), `status-board.ts` (server-only: `fetchWorkspaceStatusBoard(orgId)`, `fetchWorkspaceDetail(workspaceId)`), `status-board-actions.ts` (`setRequirementNotNeeded`). Service client, org-scoped, untyped casts for stale types.
2. Verify backend against real org data (public `/preview/status-board` server route renders the real component with real data; screenshot on the worktree dev server, no admin auth needed).
3. UI: port FileCardTile, the matrix, cursor hover card, workspace drawer, filter bar from the preview; wire to backend types.
4. Wire into real `(admin)/admin/paperwork` Documents view, replacing List/Coverage. Keep Needs Action.
5. Verify (tsc, build, real-data screenshots), advisor review, then merge.

## Non-goals (v1)
- No per-workspace requirement *authoring* UI (which requirements exist is already driven by the `documents` rows seeded per workspace). Not-needed (waive) is the only per-workspace knob in v1.
- No new migration.
