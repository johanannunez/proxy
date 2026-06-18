/**
 * Status Board types — client-safe (no server imports).
 */

import type { RequirementKind, RequirementScope } from "./status-board-config";

/** Filter-bar selections, shared by the board view and its toolbar. */
export type StatusFilter = "all" | "outstanding" | "complete" | "declined" | "not_needed";
export type KindFilter = "all" | RequirementKind;

/** State of a single entity's requirement instance. */
export type CellState =
  | "complete"
  | "in_progress"
  | "sent"
  | "declined"
  | "needed"
  | "not_needed";

/** Detail for one owner/property/workspace entity within a cell. */
export type EntityDetail = {
  entityId: string;
  entityName: string;
  entityKind: "owner" | "property" | "workspace";
  state: CellState;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  waived: boolean;
  /** Renewal/expiry date for time-bound requirements (insurance, permit, ID,
   * card). Null until the expiry engine (Phase 3) populates it. Drives the
   * "Expiring" treatment and the Action Center's Expiring/Lapsed sections. */
  expiresAt?: string | null;
  /** Populated for signature-kind requirements. */
  signers: {
    name: string;
    role: string;
    status: string;
    signedAt: string | null;
  }[];
};

/** Aggregated cell for a (workspace x reqKey) intersection. */
export type CellSummary = {
  reqKey: string;
  label: string;
  kind: RequirementKind;
  scope: RequirementScope;
  /** Aggregate state for the cell. */
  status: CellState;
  /** Entities that have an instance and are not waived. */
  doneCount: number;
  totalCount: number;
  /** Entities with waived=true. */
  notNeededCount: number;
  /** doneCount / totalCount (1 when totalCount==0). */
  fraction: number;
  entities: EntityDetail[];
};

/** Column descriptor for the board header. */
export type StatusColumn = {
  reqKey: string;
  label: string;
  kind: RequirementKind;
  scope: RequirementScope;
  /** % of applicable workspaces that are complete for this req. */
  pct: number;
};

/** One workspace row in the board. */
export type WorkspaceRow = {
  id: string;
  name: string;
  type: string | null;
  /** Overall completion % for this workspace. */
  pct: number;
  ownerCount: number;
  propertyCount: number;
  owners: { id: string; name: string; avatarUrl: string | null }[];
  properties: { id: string; name: string }[];
  /** Map of reqKey -> CellSummary for every req that appears in this workspace. */
  cells: Record<string, CellSummary>;
};

/** Full status board payload. */
export type StatusBoard = {
  orgId: string;
  columns: StatusColumn[];
  kindGroups: {
    kind: RequirementKind;
    label: string;
    reqKeys: string[];
  }[];
  workspaces: WorkspaceRow[];
};
