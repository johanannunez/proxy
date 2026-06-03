import "server-only";
/**
 * Workspace-facing read model for the owner Documents hub. Reads the spine, joins
 * property labels, computes the strict gate (what is locked vs actionable), and
 * shapes everything into the three lanes the hub renders:
 *   - needed   (unlocked, the owner must act)
 *   - signature (out for signature / awaiting countersignature)
 *   - filed    (submitted / under review / on file)
 * plus a `locked` bucket for progressive disclosure (gated, not yet actionable).
 */
import { fetchSpineWithClient, type SpineDocument } from "./spine";
import { GATE_STEP, DOCUMENT_LIFECYCLE } from "./lifecycle";
import {
  type DocumentStatus,
  type DocumentDisplayStatus,
  STATUS_LABELS_OWNER,
  isComplete,
} from "./status";
import { WORKSPACE_DOCUMENT_DEFINITIONS, type WorkspaceDocumentKey } from "@/lib/admin/documents-hub-shared";

export type HubAction = "upload" | "fill" | "sign" | "view" | "waiting";

export type HubItem = {
  id: string;
  documentKey: WorkspaceDocumentKey | null;
  title: string;
  description: string;
  status: DocumentStatus;
  displayStatus: DocumentDisplayStatus;
  statusLabel: string;
  propertyId: string | null;
  propertyLabel: string | null;
  fileUrl: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  gateStep: number;
  lockedReason: string | null;
  action: HubAction;
  href: string | null;
  previewBadge: string;
  adminGateOverride: boolean;
  displaySortOrder: number;
  waived: boolean;
  isUrgent: boolean;
  ownerNote: string | null;
  customDueDate: string | null;
  manuallyCompletedAt: string | null;
};

export type DocumentHub = {
  progress: { total: number; complete: number; pct: number };
  needed: HubItem[];
  locked: HubItem[];
  signature: HubItem[];
  filed: HubItem[];
  properties: Array<{ id: string; label: string }>;
};

/** Primary action + destination per document kind. */
function actionFor(key: WorkspaceDocumentKey | null): { action: HubAction; href: string | null } {
  switch (key) {
    case "w9":
      return { action: "upload", href: "/workspace/setup/w9" };
    case "identity":
      return { action: "fill", href: "/workspace/setup/identity" };
    case "host_rental_agreement":
    case "ach_authorization":
    case "card_authorization":
      return { action: "sign", href: null };
    case "paid_onboarding_fee":
      return { action: "waiting", href: null };
    case "property_setup":
    case "wifi_info":
    case "guidebook":
    case "block_dates_calendar":
    case "str_permit":
    case "hoa_info":
    case "insurance_certificate":
    case "platform_authorization":
      return { action: "fill", href: "/workspace/setup" };
    default:
      return { action: "view", href: null };
  }
}

const PREVIEW_BADGE: Partial<Record<WorkspaceDocumentKey, string>> = {
  host_rental_agreement: "Agreement",
  w9: "W-9",
  identity: "ID",
  paid_onboarding_fee: "Fee",
  ach_authorization: "ACH",
  card_authorization: "Card",
  property_setup: "Setup",
  wifi_info: "Wi-Fi",
  guidebook: "Guide",
  block_dates_calendar: "Dates",
  str_permit: "Permit",
  hoa_info: "HOA",
  insurance_certificate: "Insurance",
  platform_authorization: "Platforms",
};

/**
 * Compute which gate steps are satisfied at the owner level, given all spine
 * rows. The owner journey: every property's agreement signed (step 1) → the
 * onboarding fee (step 2) → ACH + card authorization (step 3) → everything else.
 */
function computeSatisfiedSteps(docs: SpineDocument[]): Set<number> {
  const satisfied = new Set<number>();
  const byKey = (k: WorkspaceDocumentKey) => docs.filter((d) => d.documentKey === k);
  const allOnFile = (rows: SpineDocument[]) => rows.length > 0 && rows.every((d) => isComplete(d.status));

  // Step 1: every agreement row (one per property) is on file. No agreement rows
  // yet (brand-new owner with no property) => treat as satisfied so owner docs flow.
  const agreements = byKey("host_rental_agreement");
  if (agreements.length === 0 || allOnFile(agreements)) satisfied.add(GATE_STEP.agreement);

  // Step 2: onboarding fee on file.
  if (allOnFile(byKey("paid_onboarding_fee"))) satisfied.add(GATE_STEP.payment);

  // Step 3: both ACH and card authorization on file.
  if (allOnFile(byKey("ach_authorization")) && allOnFile(byKey("card_authorization"))) {
    satisfied.add(GATE_STEP.banking);
  }

  return satisfied;
}

const STEP_LABEL: Record<number, string> = {
  [GATE_STEP.agreement]: "the Host Rental Agreement is signed",
  [GATE_STEP.payment]: "the onboarding fee is paid",
  [GATE_STEP.banking]: "ACH and card authorization are complete",
};

function firstUnsatisfiedBelow(gateStep: number, satisfied: Set<number>): number | null {
  for (let step = GATE_STEP.agreement; step < gateStep; step++) {
    if (!satisfied.has(step)) return step;
  }
  return null;
}

export async function getOwnerDocumentHub(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  ownerProfileId: string,
): Promise<DocumentHub> {
  const docs = await fetchSpineWithClient(client, ownerProfileId);

  // Property labels for scope display.
  const propertyIds = Array.from(new Set(docs.map((d) => d.propertyId).filter(Boolean))) as string[];
  const propertyLabels = new Map<string, string>();
  if (propertyIds.length > 0) {
    const { data: props } = await client
      .from("properties")
      .select("id, name, address_line1, city")
      .in("id", propertyIds);
    for (const p of (props ?? []) as Array<{ id: string; name: string | null; address_line1: string | null; city: string | null }>) {
      propertyLabels.set(p.id, p.name || [p.address_line1, p.city].filter(Boolean).join(", ") || "Property");
    }
  }

  const satisfied = computeSatisfiedSteps(docs);

  const needed: HubItem[] = [];
  const locked: HubItem[] = [];
  const signature: HubItem[] = [];
  const filed: HubItem[] = [];

  let total = 0;
  let complete = 0;

  for (const d of docs) {
    // Waived documents do not appear in the owner portal at all.
    if (d.waived) continue;

    const key = d.documentKey;
    const def = key ? WORKSPACE_DOCUMENT_DEFINITIONS[key] : null;
    const lifecycle = key ? DOCUMENT_LIFECYCLE[key] : null;
    const gateStep = lifecycle?.gateStep ?? GATE_STEP.rest;

    // Admin manual completion overrides the derived status.
    const effectiveStatus: DocumentStatus = d.manuallyCompletedAt ? "on_file" : d.status;

    total += 1;
    if (isComplete(effectiveStatus)) complete += 1;

    const { action, href } = actionFor(key);
    const unsatisfiedStep = firstUnsatisfiedBelow(gateStep, satisfied);
    const isLocked = !isComplete(effectiveStatus) && effectiveStatus === "needed" && unsatisfiedStep !== null && !d.adminGateOverride;
    const displayStatus: DocumentDisplayStatus = isLocked ? "locked" : effectiveStatus;

    const item: HubItem = {
      id: d.id,
      documentKey: key,
      title: d.title,
      description: def?.description ?? "",
      status: effectiveStatus,
      displayStatus,
      statusLabel: STATUS_LABELS_OWNER[displayStatus],
      propertyId: d.propertyId,
      propertyLabel: d.propertyId ? (propertyLabels.get(d.propertyId) ?? null) : null,
      fileUrl: d.fileUrl,
      expiresAt: d.expiresAt,
      completedAt: d.completedAt,
      gateStep,
      lockedReason: isLocked && unsatisfiedStep ? `Unlocks once ${STEP_LABEL[unsatisfiedStep] ?? "earlier steps are complete"}` : null,
      action,
      href,
      previewBadge: (key && PREVIEW_BADGE[key]) || "Doc",
      adminGateOverride: d.adminGateOverride,
      displaySortOrder: d.displaySortOrder,
      waived: d.waived,
      isUrgent: d.isUrgent,
      ownerNote: d.ownerNote,
      customDueDate: d.customDueDate,
      manuallyCompletedAt: d.manuallyCompletedAt,
    };

    if (item.status === "submitted" || item.status === "under_review" || isComplete(item.status)) {
      filed.push(item);
    } else if (item.status === "sent" || item.status === "signed" || item.status === "awaiting_countersignature") {
      signature.push(item);
    } else if (isLocked) {
      locked.push(item);
    } else {
      needed.push(item);
    }
  }

  // Urgent first, then displaySortOrder, then gate step, then title.
  const order = (a: HubItem, b: HubItem) =>
    (b.isUrgent ? 1 : 0) - (a.isUrgent ? 1 : 0) ||
    a.displaySortOrder - b.displaySortOrder ||
    a.gateStep - b.gateStep ||
    a.title.localeCompare(b.title);
  needed.sort(order);
  locked.sort(order);
  signature.sort(order);
  filed.sort(order);

  const properties = propertyIds.map((id) => ({ id, label: propertyLabels.get(id) ?? "Property" }));
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  return { progress: { total, complete, pct }, needed, locked, signature, filed, properties };
}
