import "server-only";
/**
 * Documents spine — the single derivation + sync layer. The `documents` table is
 * the single source of truth: raw form rows (source = 'property_form', form_key
 * set) hold submitted form payloads, signature documents carry their lifecycle
 * directly on the catalog row, and owner_kyc / tax_profiles remain the only
 * external detail tables. Sync computes the canonical status for every catalog
 * document and materializes one row per (owner, document_key, property). Both
 * backfill and the per-event write paths call `syncOwnerDocuments`; the portal
 * and admin read the resulting spine rows.
 *
 * Server-only: uses the Supabase service client to bypass RLS during sync.
 */
import { createServiceClient } from "@/lib/supabase/service";
import {
  WORKSPACE_DOCUMENT_ORDER,
  WORKSPACE_DOCUMENT_DEFINITIONS,
  SECURE_DOC_TYPES,
  type WorkspaceDocumentKey,
  type SecureDocKey,
} from "@/lib/admin/documents-hub-shared";
import { DOCUMENT_LIFECYCLE } from "./lifecycle";
import { type DocumentStatus, normalizeStatus } from "./status";
import { reconcileWorkspaceRequests } from "./requests";

const SETUP_SECTION_KEYS = [
  "setup_basic", "setup_access", "setup_security", "setup_utilities",
  "setup_appliances", "setup_contacts", "setup_tech", "setup_house_rules",
  "setup_amenities", "setup_listing", "setup_communication",
] as const;

/** Raw form row form_key → catalog document key. */
const FORM_KEY_TO_DOCUMENT_KEY: Record<string, WorkspaceDocumentKey> = {
  paid_onboarding_fee: "paid_onboarding_fee",
  wifi_info: "wifi_info",
  setup_tech: "wifi_info",
  guidebook: "guidebook",
  str_permit: "str_permit",
  hoa_info: "hoa_info",
  insurance_certificate: "insurance_certificate",
  platform_authorization: "platform_authorization",
  onboarding_inspection: "onboarding_inspection",
  block_dates_calendar: "block_dates_calendar",
  property_offboarding: "property_offboarding",
};

type FormRow = { id: string; property_id: string; form_key: string; data: Record<string, unknown> | null; completed_at: string | null };
type RawFormDocRow = { id: string; property_id: string; form_key: string; form_data: Record<string, unknown> | null; completed_at: string | null };
type KycRow = { id: string; consent_given: boolean | null; front_photo_url: string | null; back_photo_url: string | null; expiration_date: string | null; updated_at: string | null };
type TaxRow = { id: string; status: string | null; updated_at: string | null };

type DesiredRow = {
  document_key: WorkspaceDocumentKey;
  property_id: string | null;
  status: DocumentStatus;
  source: "signed_document" | "property_form" | "owner_kyc" | "upload" | "manual";
  source_ref: string | null;
  file_url: string | null;
  title: string;
  expires_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
};

/** Status precedence so sync never regresses an admin review decision. */
const STATUS_RANK: Record<DocumentStatus, number> = {
  needed: 0,
  sent: 1,
  signed: 2,
  awaiting_countersignature: 3,
  submitted: 4,
  under_review: 5,
  action_required: 6,
  on_file: 7,
  expired: 8,
};

function expirationToStatus(expiresAt: string | null, base: DocumentStatus): DocumentStatus {
  if (!expiresAt) return base;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expires = new Date(`${expiresAt}T00:00:00`);
  if (expires.getTime() < today.getTime()) return "expired";
  const renewalDue = new Date(expires);
  renewalDue.setDate(renewalDue.getDate() - 60);
  return renewalDue.getTime() <= today.getTime() ? "action_required" : base;
}

function getString(data: Record<string, unknown> | null, key: string): string | null {
  const v = data?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Derive the full set of desired spine rows for one owner across their
 * properties. Every client-visible catalog key gets a row (defaulting to
 * `needed`) so the portal renders a complete checklist.
 */
function deriveDesiredRows(input: {
  forms: FormRow[];
  kyc: KycRow | null;
  tax: TaxRow | null;
  propertyIds: string[];
}): DesiredRow[] {
  const { forms, kyc, tax, propertyIds } = input;
  const rows: DesiredRow[] = [];
  const props = propertyIds.length > 0 ? propertyIds : [null];

  const formsByKey = new Map<string, FormRow[]>();
  for (const f of forms) {
    const list = formsByKey.get(f.form_key) ?? [];
    list.push(f);
    formsByKey.set(f.form_key, list);
  }

  for (const key of WORKSPACE_DOCUMENT_ORDER) {
    const def = WORKSPACE_DOCUMENT_DEFINITIONS[key];
    const lifecycle = DOCUMENT_LIFECYCLE[key];
    const title = def.label;
    // owner/shared => single row; property => one row per property.
    const targets: (string | null)[] = lifecycle.scope === "property" ? props : [null];

    for (const propertyId of targets) {
      let row: DesiredRow = {
        document_key: key,
        property_id: propertyId,
        status: "needed",
        source: "manual",
        source_ref: null,
        file_url: null,
        title,
        expires_at: null,
        submitted_at: null,
        completed_at: null,
      };

      // --- Signature documents: agreement, ach, card ---
      // Their lifecycle lives directly on the spine row (written by the signing
      // orchestration and webhooks); derivation only guarantees the row exists.
      // The non-regressive merge below preserves whatever state the row holds.
      const secureKey = key in SECURE_DOC_TYPES ? (key as SecureDocKey) : null;
      if (secureKey && SECURE_DOC_TYPES[secureKey].templateId) {
        rows.push(row);
        continue;
      }

      // --- W-9: tax_profiles ---
      if (key === "w9") {
        if (tax) {
          const s = normalizeStatus(tax.status ?? undefined);
          row = { ...row, status: s, source: "upload", source_ref: tax.id, submitted_at: tax.updated_at };
        }
        rows.push(row);
        continue;
      }

      // --- Identity: owner_kyc ---
      if (key === "identity") {
        if (kyc && (kyc.consent_given || kyc.front_photo_url || kyc.back_photo_url)) {
          row = {
            ...row,
            status: expirationToStatus(kyc.expiration_date, "on_file"),
            source: "owner_kyc",
            source_ref: kyc.id,
            file_url: kyc.front_photo_url,
            expires_at: kyc.expiration_date,
            completed_at: kyc.updated_at,
          };
        }
        rows.push(row);
        continue;
      }

      // --- Property Setup: aggregate of 11 section forms ---
      if (key === "property_setup") {
        const sectionRows = forms.filter(
          (f) => (propertyId ? f.property_id === propertyId : true)
            && (SETUP_SECTION_KEYS as readonly string[]).includes(f.form_key),
        );
        const completed = sectionRows.filter((f) => f.completed_at || Object.keys(f.data ?? {}).length > 0);
        if (completed.length >= SETUP_SECTION_KEYS.length) {
          row = { ...row, status: "on_file", source: "property_form", completed_at: completed[0]?.completed_at ?? null };
        } else if (completed.length > 0) {
          row = { ...row, status: "submitted", source: "property_form", submitted_at: completed[0]?.completed_at ?? null };
        }
        rows.push(row);
        continue;
      }

      // --- Other forms: raw form rows by mapped key ---
      const formKey = (Object.entries(FORM_KEY_TO_DOCUMENT_KEY).find(([, dk]) => dk === key)?.[0]) ?? key;
      const candidates = (formsByKey.get(formKey) ?? []).filter((f) => (propertyId ? f.property_id === propertyId : true));
      const completedForm = candidates.find((f) => f.completed_at || Object.keys(f.data ?? {}).length > 0);
      if (completedForm) {
        const expiresAt = getString(completedForm.data, "expiration_date");
        row = {
          ...row,
          status: expirationToStatus(expiresAt, completedForm.completed_at ? "on_file" : "submitted"),
          source: "property_form",
          source_ref: completedForm.id,
          expires_at: expiresAt,
          completed_at: completedForm.completed_at,
        };
      }
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Materialize the spine for a single owner. Idempotent: updates existing rows in
 * place (without regressing a more-advanced/reviewed status) and inserts missing
 * ones. Returns the number of rows written.
 */
export async function syncOwnerDocuments(input: {
  ownerProfileId: string;
  workspaceId: string | null;
  propertyIds: string[];
}): Promise<{ written: number; error: string | null }> {
  const { ownerProfileId, workspaceId, propertyIds } = input;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;

  const [forms, kyc, tax] = await Promise.all([
    propertyIds.length > 0
      ? db.from("documents")
          .select("id, property_id, form_key, form_data, completed_at")
          .eq("source", "property_form")
          .not("form_key", "is", null)
          .in("property_id", propertyIds)
      : Promise.resolve({ data: [] }),
    db.from("owner_kyc").select("id, consent_given, front_photo_url, back_photo_url, expiration_date, updated_at").eq("user_id", ownerProfileId).maybeSingle(),
    db.from("tax_profiles").select("id, status, updated_at").eq("owner_id", ownerProfileId).maybeSingle(),
  ]);

  const desired = deriveDesiredRows({
    forms: ((forms.data ?? []) as RawFormDocRow[]).map((r) => ({
      id: r.id,
      property_id: r.property_id,
      form_key: r.form_key,
      data: r.form_data,
      completed_at: r.completed_at,
    })),
    kyc: (kyc.data ?? null) as KycRow | null,
    tax: (tax.data ?? null) as TaxRow | null,
    propertyIds,
  });

  let written = 0;
  for (const d of desired) {
    // form_key is null filters the catalog rows; raw form rows (form_key set)
    // are the storage layer and must never be matched as catalog rows.
    let q = db.from("documents")
      .select("id, status, source, source_ref, file_url, expires_at, submitted_at, completed_at")
      .eq("owner_id", ownerProfileId)
      .eq("document_key", d.document_key)
      .is("form_key", null);
    q = d.property_id ? q.eq("property_id", d.property_id) : q.is("property_id", null);
    const { data: existing } = await q.maybeSingle();

    const lifecycle = DOCUMENT_LIFECYCLE[d.document_key];
    const meta = {
      owner_id: ownerProfileId,
      workspace_id: workspaceId,
      property_id: d.property_id,
      document_key: d.document_key,
      doc_type: d.document_key,
      title: d.title,
      scope_kind: lifecycle.scope,
      visibility: lifecycle.clientVisible ? "client" : "internal",
      gate_group: lifecycle.gateGroup,
      sequence: lifecycle.gateStep,
    };

    if (existing) {
      // Never regress a more-advanced / admin-reviewed status, and never null out
      // detail fields (e.g. an uploaded file_url) that the derivation didn't supply.
      const existingRank = STATUS_RANK[normalizeStatus(existing.status)] ?? 0;
      const desiredRank = STATUS_RANK[d.status] ?? 0;
      const status = desiredRank >= existingRank ? d.status : normalizeStatus(existing.status);
      const merged = {
        ...meta,
        status,
        source: d.source !== "manual" ? d.source : (existing.source ?? "manual"),
        source_ref: d.source_ref ?? existing.source_ref,
        file_url: d.file_url ?? existing.file_url,
        expires_at: d.expires_at ?? existing.expires_at,
        submitted_at: d.submitted_at ?? existing.submitted_at,
        completed_at: d.completed_at ?? existing.completed_at,
      };
      const { error } = await db.from("documents").update(merged).eq("id", existing.id);
      if (!error) written++;
    } else {
      const { error } = await db.from("documents").insert({
        ...meta,
        status: d.status,
        source: d.source,
        source_ref: d.source_ref,
        file_url: d.file_url,
        expires_at: d.expires_at,
        submitted_at: d.submitted_at,
        completed_at: d.completed_at,
      });
      if (!error) written++;
    }
  }

  // Reflect any newly-completed documents back onto open admin requests.
  if (workspaceId) await reconcileWorkspaceRequests(workspaceId);

  return { written, error: null };
}

/**
 * Resolve an owner's workspace + properties and sync their whole spine.
 * Safe to call from any server path (swallows its own errors so a sync failure
 * never breaks the user-facing save that triggered it).
 */
export async function syncSpineForOwner(ownerProfileId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any;
    const [{ data: profile }, { data: props }] = await Promise.all([
      db.from("profiles").select("workspace_id").eq("id", ownerProfileId).maybeSingle(),
      db.from("properties").select("id").eq("owner_id", ownerProfileId),
    ]);
    const propertyIds = ((props ?? []) as Array<{ id: string }>).map((p) => p.id);
    await syncOwnerDocuments({
      ownerProfileId,
      workspaceId: (profile?.workspace_id as string | null) ?? null,
      propertyIds,
    });
  } catch (err) {
    console.error("[spine] syncSpineForOwner failed:", err instanceof Error ? err.message : err);
  }
}

/** Sync the spine for the owner that owns the given property. */
export async function syncSpineForProperty(propertyId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createServiceClient() as any;
    const { data: property } = await db.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
    const ownerId = property?.owner_id as string | undefined;
    if (ownerId) await syncSpineForOwner(ownerId);
  } catch (err) {
    console.error("[spine] syncSpineForProperty failed:", err instanceof Error ? err.message : err);
  }
}

/* ─── Reader ─── */

export type SpineDocument = {
  id: string;
  documentKey: WorkspaceDocumentKey | null;
  propertyId: string | null;
  status: DocumentStatus;
  scopeKind: string;
  visibility: string;
  gateGroup: string | null;
  sequence: number;
  source: string;
  sourceRef: string | null;
  title: string;
  fileUrl: string | null;
  expiresAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  adminGateOverride: boolean;
  displaySortOrder: number;
  displayGroup: string | null;
  waived: boolean;
  isUrgent: boolean;
  adminNote: string | null;
  ownerNote: string | null;
  customDueDate: string | null;
  manuallyCompletedAt: string | null;
  manuallyCompletedNote: string | null;
};

type SpineRow = {
  id: string;
  document_key: string | null;
  property_id: string | null;
  status: string;
  scope_kind: string;
  visibility: string;
  gate_group: string | null;
  sequence: number | null;
  source: string;
  source_ref: string | null;
  title: string;
  file_url: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  admin_gate_override: boolean | null;
  display_sort_order: number | null;
  display_group: string | null;
  waived: boolean | null;
  is_urgent: boolean | null;
  admin_note: string | null;
  owner_note: string | null;
  custom_due_date: string | null;
  manually_completed_at: string | null;
  manually_completed_note: string | null;
};

const SPINE_SELECT =
  "id, document_key, property_id, status, scope_kind, visibility, gate_group, sequence, source, source_ref, title, file_url, expires_at, submitted_at, completed_at, updated_at, admin_gate_override, display_sort_order, display_group, waived, is_urgent, admin_note, owner_note, custom_due_date, manually_completed_at, manually_completed_note";

function mapSpineRow(row: SpineRow): SpineDocument {
  return {
    id: row.id,
    documentKey: (row.document_key as WorkspaceDocumentKey | null) ?? null,
    propertyId: row.property_id,
    status: normalizeStatus(row.status),
    scopeKind: row.scope_kind,
    visibility: row.visibility,
    gateGroup: row.gate_group,
    sequence: row.sequence ?? 0,
    source: row.source,
    sourceRef: row.source_ref,
    title: row.title,
    fileUrl: row.file_url,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    adminGateOverride: row.admin_gate_override ?? false,
    displaySortOrder: row.display_sort_order ?? 0,
    displayGroup: row.display_group ?? null,
    waived: row.waived ?? false,
    isUrgent: row.is_urgent ?? false,
    adminNote: row.admin_note ?? null,
    ownerNote: row.owner_note ?? null,
    customDueDate: row.custom_due_date ?? null,
    manuallyCompletedAt: row.manually_completed_at ?? null,
    manuallyCompletedNote: row.manually_completed_note ?? null,
  };
}

/** Read spine rows for an owner via the service client (admin / verification). */
export async function fetchOwnerSpine(ownerProfileId: string): Promise<SpineDocument[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any;
  const { data, error } = await db
    .from("documents")
    .select(SPINE_SELECT)
    .eq("owner_id", ownerProfileId)
    .is("form_key", null) // catalog rows only, not raw form storage rows
    .order("sequence", { ascending: true });
  if (error) {
    console.error("[spine] fetchOwnerSpine error:", error.message);
    return [];
  }
  return ((data ?? []) as SpineRow[]).map(mapSpineRow);
}

/**
 * Read spine rows using a caller-supplied client (the owner workspace passes its
 * RLS-scoped user client). Filters to client-visible rows for the given owner.
 */
export async function fetchSpineWithClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  ownerProfileId: string,
): Promise<SpineDocument[]> {
  const { data, error } = await client
    .from("documents")
    .select(SPINE_SELECT)
    .eq("owner_id", ownerProfileId)
    .eq("visibility", "client")
    .is("form_key", null) // catalog rows only, not raw form storage rows
    .order("sequence", { ascending: true });
  if (error) {
    console.error("[spine] fetchSpineWithClient error:", error.message);
    return [];
  }
  return ((data ?? []) as SpineRow[]).map(mapSpineRow);
}
