import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  REQUIREMENT_CONFIG,
  KIND_ORDER,
  KIND_LABEL,
  configFor,
  type RequirementKind,
} from "./status-board-config";
import type {
  CellState,
  CellSummary,
  EntityDetail,
  StatusBoard,
  StatusColumn,
  WorkspaceRow,
} from "./status-board-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;
function db(): DB {
  return createServiceClient() as DB;
}

/* ─── Raw DB row shapes ─── */

type WorkspaceDbRow = {
  id: string;
  name: string;
  type: string | null;
  agency_id: string;
};

type ProfileDbRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  workspace_id: string | null;
};

type PropertyDbRow = {
  id: string;
  name: string | null;
  owner_id: string | null;
};

type DocumentDbRow = {
  id: string;
  owner_id: string | null;
  workspace_id: string | null;
  property_id: string | null;
  scope_kind: string | null;
  document_key: string | null;
  form_key: string | null;
  doc_type: string | null;
  source: string | null;
  status: string | null;
  waived: boolean | null;
  sent_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  completed_at: string | null;
  manually_completed_at: string | null;
  updated_at: string | null;
};

type SignerDbRow = {
  document_id: string;
  role: string | null;
  status: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signed_at: string | null;
  order_index: number | null;
};

/* ─── Helpers ─── */

function reqKeyOf(doc: DocumentDbRow): string {
  return doc.document_key ?? doc.form_key ?? doc.doc_type ?? "(unknown)";
}

/**
 * Recency tie-breaker when multiple instances exist for the same entity+reqKey.
 * Prefers any completed instance; otherwise the most recently updated.
 */
function recencyScore(doc: DocumentDbRow): number {
  const completedStatuses = new Set([
    "on_file", "submitted", "reviewed", "signed", "completed",
  ]);
  const s = (doc.status ?? "").toLowerCase();
  const isComplete =
    completedStatuses.has(s) ||
    doc.completed_at != null ||
    doc.manually_completed_at != null;
  // Completed instances sort first; within each bucket, more recent wins.
  const base = isComplete ? 2_000_000_000_000 : 0;
  const ts = doc.updated_at
    ? new Date(doc.updated_at).getTime()
    : doc.sent_at
    ? new Date(doc.sent_at).getTime()
    : 0;
  return base + ts;
}

function entityState(doc: DocumentDbRow): CellState {
  // 1. Waived always wins.
  if (doc.waived) return "not_needed";

  const s = (doc.status ?? "").toLowerCase();
  const completedStatuses = new Set([
    "on_file", "submitted", "reviewed", "signed", "completed",
  ]);

  // 2. Complete
  if (
    completedStatuses.has(s) ||
    doc.completed_at != null ||
    doc.manually_completed_at != null
  ) {
    return "complete";
  }

  // 3. Declined / blocked
  if (s === "declined" || s === "action_required") return "declined";

  // 4. Sent (in flight)
  if (s === "sent" || doc.sent_at != null) return "sent";

  // 5. Fallback
  return "needed";
}

function cellState(entities: EntityDetail[]): CellState {
  const nonWaived = entities.filter((e) => e.state !== "not_needed");
  const total = nonWaived.length;

  // All waived: not_needed
  if (total === 0) {
    if (entities.length > 0) return "not_needed";
    return "needed";
  }

  const done = nonWaived.filter((e) => e.state === "complete").length;

  // All done: complete
  if (done === total) return "complete";

  // Any declined beats everything else outstanding
  if (nonWaived.some((e) => e.state === "declined")) return "declined";

  // Partial completion: in_progress
  if (done > 0) return "in_progress";

  // Any sent (and none done)
  if (nonWaived.some((e) => e.state === "sent")) return "sent";

  return "needed";
}

/* ─── Main fetcher ─── */

export async function fetchWorkspaceStatusBoard(orgId: string): Promise<StatusBoard> {
  const client = db();

  // 1. All workspaces for this org
  const { data: workspacesRaw, error: wsErr } = await client
    .from("workspaces")
    .select("id, name, type, agency_id")
    .eq("agency_id", orgId);

  if (wsErr) {
    console.error("[status-board] workspaces fetch:", wsErr.message);
    return emptyBoard(orgId);
  }

  const workspaces: WorkspaceDbRow[] = workspacesRaw ?? [];
  const workspaceIds = workspaces.map((w) => w.id);

  if (workspaceIds.length === 0) return emptyBoard(orgId);

  // 2. All profiles in these workspaces (owners)
  const { data: profilesRaw, error: profilesErr } = await client
    .from("profiles")
    .select("id, full_name, avatar_url, workspace_id")
    .in("workspace_id", workspaceIds);

  if (profilesErr) {
    console.error("[status-board] profiles fetch:", profilesErr.message);
  }
  const profiles: ProfileDbRow[] = profilesRaw ?? [];

  // 3. All properties whose owner is one of those profiles
  const profileIds = profiles.map((p) => p.id);

  const propertiesRaw: PropertyDbRow[] = [];
  if (profileIds.length > 0) {
    const { data: propData, error: propErr } = await client
      .from("properties")
      .select("id, name, owner_id")
      .in("owner_id", profileIds);
    if (propErr) {
      console.error("[status-board] properties fetch:", propErr.message);
    } else {
      propertiesRaw.push(...(propData ?? []));
    }
  }

  // 4. All documents for these workspaces (workspace_id-based, which is the
  //    reliable link; docs with null workspace_id belong to test/legacy owners
  //    without workspace membership and are intentionally excluded).
  const { data: docsRaw, error: docsErr } = await client
    .from("documents")
    .select(
      "id, owner_id, workspace_id, property_id, scope_kind, document_key, form_key, doc_type, source, status, waived, sent_at, submitted_at, reviewed_at, completed_at, manually_completed_at, updated_at",
    )
    .in("workspace_id", workspaceIds);

  if (docsErr) {
    console.error("[status-board] documents fetch:", docsErr.message);
  }
  const docs: DocumentDbRow[] = docsRaw ?? [];

  // 5. Signers for all signed_document rows
  const signedDocIds = docs
    .filter((d) => d.source === "signed_document")
    .map((d) => d.id);

  const signersByDocId = new Map<string, SignerDbRow[]>();
  if (signedDocIds.length > 0) {
    const { data: signersRaw, error: signersErr } = await client
      .from("document_signers")
      .select("document_id, role, status, signer_name, signer_email, signed_at, order_index")
      .in("document_id", signedDocIds)
      .order("order_index", { ascending: true });
    if (signersErr) {
      console.error("[status-board] signers fetch:", signersErr.message);
    }
    for (const signer of signersRaw ?? []) {
      const list = signersByDocId.get(signer.document_id) ?? [];
      list.push(signer);
      signersByDocId.set(signer.document_id, list);
    }
  }

  /* ─── Build lookup maps ─── */

  // workspace_id -> profiles
  const profilesByWorkspace = new Map<string, ProfileDbRow[]>();
  for (const p of profiles) {
    if (!p.workspace_id) continue;
    const list = profilesByWorkspace.get(p.workspace_id) ?? [];
    list.push(p);
    profilesByWorkspace.set(p.workspace_id, list);
  }

  // owner_id -> workspace_id (for property scope cross-reference)
  const workspaceByOwnerId = new Map<string, string>();
  for (const p of profiles) {
    if (p.workspace_id) workspaceByOwnerId.set(p.id, p.workspace_id);
  }

  // workspace_id -> properties (via owner membership)
  const propertiesByWorkspace = new Map<string, PropertyDbRow[]>();
  for (const prop of propertiesRaw) {
    if (!prop.owner_id) continue;
    const wsId = workspaceByOwnerId.get(prop.owner_id);
    if (!wsId) continue;
    const list = propertiesByWorkspace.get(wsId) ?? [];
    list.push(prop);
    propertiesByWorkspace.set(wsId, list);
  }

  // workspace_id + reqKey + entityId -> best doc instance
  // Key: `${workspaceId}|${reqKey}|${entityId}`
  const bestDoc = new Map<string, DocumentDbRow>();

  for (const doc of docs) {
    if (!doc.workspace_id) continue;
    const rk = reqKeyOf(doc);
    const cfg = configFor(rk);
    const scope = cfg.scope;

    let entityId: string | null = null;
    if (scope === "owner") {
      entityId = doc.owner_id;
    } else if (scope === "property") {
      entityId = doc.property_id;
    } else {
      // shared: one entity per workspace
      entityId = doc.workspace_id;
    }
    if (!entityId) continue;

    const key = `${doc.workspace_id}|${rk}|${entityId}`;
    const existing = bestDoc.get(key);
    if (!existing || recencyScore(doc) > recencyScore(existing)) {
      bestDoc.set(key, doc);
    }
  }

  /* ─── Discover distinct reqKeys present in org docs ─── */
  const allReqKeys = new Set<string>();
  for (const doc of docs) {
    allReqKeys.add(reqKeyOf(doc));
  }

  // Build column order: KIND_ORDER then config insertion order within each kind
  const configKeys = Object.keys(REQUIREMENT_CONFIG);
  const orderedReqKeys: string[] = [];
  for (const kind of KIND_ORDER) {
    // Keys in REQUIREMENT_CONFIG order that belong to this kind
    for (const rk of configKeys) {
      if (REQUIREMENT_CONFIG[rk].kind === kind && allReqKeys.has(rk)) {
        orderedReqKeys.push(rk);
      }
    }
    // Unknown keys that happen to default to this kind (edge case)
    for (const rk of allReqKeys) {
      if (!configKeys.includes(rk)) {
        const cfg = configFor(rk);
        if (cfg.kind === kind && !orderedReqKeys.includes(rk)) {
          orderedReqKeys.push(rk);
        }
      }
    }
  }

  /* ─── Assemble workspace rows ─── */

  const workspaceRows: WorkspaceRow[] = [];

  for (const ws of workspaces) {
    const wsProfiles = profilesByWorkspace.get(ws.id) ?? [];
    const wsProperties = propertiesByWorkspace.get(ws.id) ?? [];

    // Skip empty sandbox workspaces
    if (wsProfiles.length === 0 && wsProperties.length === 0) {
      const wsDocs = docs.filter((d) => d.workspace_id === ws.id);
      if (wsDocs.length === 0) continue;
    }

    const cells: Record<string, CellSummary> = {};

    for (const rk of orderedReqKeys) {
      const cfg = configFor(rk);
      const { kind, scope, label } = cfg;

      // Determine entity list for this workspace + scope
      type EntityStub = { id: string; name: string; kind: "owner" | "property" | "workspace" };
      let entityStubs: EntityStub[];
      if (scope === "owner") {
        entityStubs = wsProfiles.map((p) => ({
          id: p.id,
          name: p.full_name ?? p.id,
          kind: "owner" as const,
        }));
      } else if (scope === "property") {
        entityStubs = wsProperties.map((p) => ({
          id: p.id,
          name: p.name ?? p.id,
          kind: "property" as const,
        }));
      } else {
        // shared: treat workspace itself as the single entity
        entityStubs = [{ id: ws.id, name: ws.name, kind: "workspace" as const }];
      }

      // Build entity details from bestDoc map
      const entities: EntityDetail[] = [];
      for (const stub of entityStubs) {
        const docKey = `${ws.id}|${rk}|${stub.id}`;
        const doc = bestDoc.get(docKey);
        if (!doc) continue; // No instance for this entity — skip (no phantom reqs)

        const state = entityState(doc);
        const signers =
          kind === "signature"
            ? (signersByDocId.get(doc.id) ?? []).map((s) => ({
                name: s.signer_name ?? s.signer_email ?? "Unknown",
                role: s.role ?? "signer",
                status: s.status ?? "pending",
                signedAt: s.signed_at,
              }))
            : [];

        entities.push({
          entityId: stub.id,
          entityName: stub.name,
          entityKind: stub.kind,
          state,
          sentAt: doc.sent_at,
          viewedAt: null, // Not fetched in bulk (document_events); add later if needed
          signedAt: doc.completed_at,
          submittedAt: doc.submitted_at,
          reviewedAt: doc.reviewed_at,
          completedAt: doc.completed_at ?? doc.manually_completed_at,
          waived: doc.waived ?? false,
          signers,
        });
      }

      if (entities.length === 0) continue;

      const waivedEntities = entities.filter((e) => e.waived);
      const nonWaivedEntities = entities.filter((e) => !e.waived);
      const doneCount = nonWaivedEntities.filter((e) => e.state === "complete").length;
      const totalCount = nonWaivedEntities.length;
      const notNeededCount = waivedEntities.length;
      const fraction = totalCount > 0 ? doneCount / totalCount : 1;

      cells[rk] = {
        reqKey: rk,
        label,
        kind,
        scope,
        status: cellState(entities),
        doneCount,
        totalCount,
        notNeededCount,
        fraction,
        entities,
      };
    }

    // Workspace pct = round(100 * completedReqs / max(1, applicableReqs))
    const cellValues = Object.values(cells);
    const applicableReqs = cellValues.filter((c) => c.totalCount > 0).length;
    const completedReqs = cellValues.filter(
      (c) => c.status === "complete",
    ).length;
    const pct = Math.round((100 * completedReqs) / Math.max(1, applicableReqs));

    workspaceRows.push({
      id: ws.id,
      name: ws.name,
      type: ws.type,
      pct,
      ownerCount: wsProfiles.length,
      propertyCount: wsProperties.length,
      owners: wsProfiles.map((p) => ({
        id: p.id,
        name: p.full_name ?? p.id,
        avatarUrl: p.avatar_url,
      })),
      properties: wsProperties.map((p) => ({
        id: p.id,
        name: p.name ?? p.id,
      })),
      cells,
    });
  }

  // Sort: most outstanding first (lowest pct), then by name
  workspaceRows.sort((a, b) => {
    if (a.pct !== b.pct) return a.pct - b.pct;
    return a.name.localeCompare(b.name);
  });

  /* ─── Columns ─── */

  const columns: StatusColumn[] = orderedReqKeys.map((rk) => {
    const cfg = configFor(rk);
    const workspacesApplicable = workspaceRows.filter(
      (wr) => wr.cells[rk] && wr.cells[rk].totalCount > 0,
    ).length;
    const workspacesComplete = workspaceRows.filter(
      (wr) => wr.cells[rk]?.status === "complete",
    ).length;
    const pct = Math.round(
      (100 * workspacesComplete) / Math.max(1, workspacesApplicable),
    );
    return {
      reqKey: rk,
      label: cfg.label,
      kind: cfg.kind,
      scope: cfg.scope,
      pct,
    };
  });

  /* ─── Kind groups ─── */
  type KindGroup = { kind: RequirementKind; label: string; reqKeys: string[] };
  const kindGroupMap = new Map<RequirementKind, KindGroup>();
  for (const col of columns) {
    if (!kindGroupMap.has(col.kind)) {
      kindGroupMap.set(col.kind, {
        kind: col.kind,
        label: KIND_LABEL[col.kind],
        reqKeys: [],
      });
    }
    kindGroupMap.get(col.kind)!.reqKeys.push(col.reqKey);
  }
  const kindGroups: KindGroup[] = KIND_ORDER.map((k) => kindGroupMap.get(k)).filter(
    (g): g is KindGroup => g != null && g.reqKeys.length > 0,
  );

  return {
    orgId,
    columns,
    kindGroups,
    workspaces: workspaceRows,
  };
}

/* ─── Fallback ─── */

function emptyBoard(orgId: string): StatusBoard {
  return { orgId, columns: [], kindGroups: [], workspaces: [] };
}
