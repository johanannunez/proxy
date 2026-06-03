/**
 * Document lifecycle config — scope, client visibility, and the strict gate
 * sequence that unlocks onboarding step by step. Co-located with the catalog in
 * `documents-hub-shared` (which holds the labels/groups/expiration); this module
 * adds the lifecycle metadata the spine and the gate engine need.
 *
 * Client-safe: no server-only imports.
 */
import {
  WORKSPACE_DOCUMENT_ORDER,
  type WorkspaceDocumentKey,
} from "@/lib/admin/documents-hub-shared";

/** How a document is scoped relative to the owner and their properties. */
export type DocumentScope =
  | "owner" // one per owner (W-9, ID, ACH, card, onboarding fee)
  | "property" // one per property (agreement, property setup, wifi, permit, ...)
  | "shared"; // one that may be reused across properties in the same city (guidebook, HOA)

/**
 * Gate steps. The owner journey unlocks strictly in this order: a property's
 * Host Rental Agreement must be fully executed before the onboarding fee, which
 * unlocks ACH + card authorization, which unlocks all remaining setup work.
 */
export const GATE_STEP = {
  agreement: 1,
  payment: 2,
  banking: 3,
  rest: 4,
} as const;

export type GateStep = (typeof GATE_STEP)[keyof typeof GATE_STEP];

export type DocumentLifecycle = {
  scope: DocumentScope;
  /** Lower steps must be On file before this document unlocks. */
  gateStep: GateStep;
  /** Logical gate group (for grouping/labels). */
  gateGroup: "agreement" | "payment" | "banking" | "rest";
  /** Whether the owner ever sees this document in the portal. */
  clientVisible: boolean;
};

export const DOCUMENT_LIFECYCLE: Record<WorkspaceDocumentKey, DocumentLifecycle> = {
  host_rental_agreement: { scope: "property", gateStep: GATE_STEP.agreement, gateGroup: "agreement", clientVisible: true },
  paid_onboarding_fee:   { scope: "owner",    gateStep: GATE_STEP.payment,   gateGroup: "payment",   clientVisible: true },
  ach_authorization:     { scope: "owner",    gateStep: GATE_STEP.banking,   gateGroup: "banking",   clientVisible: true },
  card_authorization:    { scope: "owner",    gateStep: GATE_STEP.banking,   gateGroup: "banking",   clientVisible: true },
  w9:                    { scope: "owner",    gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  identity:              { scope: "owner",    gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  property_setup:        { scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  wifi_info:             { scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  guidebook:             { scope: "shared",   gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  block_dates_calendar:  { scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  str_permit:            { scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  hoa_info:              { scope: "shared",   gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  insurance_certificate: { scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  platform_authorization:{ scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: true },
  onboarding_inspection: { scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: false },
  property_offboarding:  { scope: "property", gateStep: GATE_STEP.rest,      gateGroup: "rest",      clientVisible: false },
};

export function lifecycleFor(key: WorkspaceDocumentKey): DocumentLifecycle {
  return DOCUMENT_LIFECYCLE[key];
}

export function scopeFor(key: WorkspaceDocumentKey): DocumentScope {
  return DOCUMENT_LIFECYCLE[key].scope;
}

export function isClientVisible(key: WorkspaceDocumentKey): boolean {
  return DOCUMENT_LIFECYCLE[key].clientVisible;
}

export const CLIENT_VISIBLE_DOCUMENT_KEYS: WorkspaceDocumentKey[] =
  WORKSPACE_DOCUMENT_ORDER.filter((k) => DOCUMENT_LIFECYCLE[k].clientVisible);

/**
 * A document at `gateStep` is unlocked only when every earlier gate step is
 * satisfied. Callers compute `satisfiedSteps` themselves because satisfaction
 * depends on the scope target (a property's agreement, the owner's banking,
 * etc.) which only the reader knows. A step is "satisfied" when all of its
 * applicable required documents are On file.
 */
export function isGateUnlocked(gateStep: GateStep, satisfiedSteps: ReadonlySet<number>): boolean {
  for (let step = GATE_STEP.agreement; step < gateStep; step++) {
    if (!satisfiedSteps.has(step)) return false;
  }
  return true;
}

/** The gate steps that come strictly before `gateStep`, in order. */
export function prerequisiteSteps(gateStep: GateStep): number[] {
  const steps: number[] = [];
  for (let step = GATE_STEP.agreement; step < gateStep; step++) steps.push(step);
  return steps;
}
