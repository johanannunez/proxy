import "server-only";
import { createClient } from "@/lib/supabase/server";
import { untypedDatabase } from "@/lib/supabase/untyped";

export type WorkspaceDocument = {
  id: string;
  documentKey: string | null;
  source: "signed_document" | "property_form" | "owner_kyc";
  templateName: string;
  category: "legal" | "financial" | "property";
  status: string;
  signedAt: string | null;
  signedPdfUrl: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  createdAt: string;
  sentAt: string | null;
  boldsignDocumentId: string | null;
  expiresAt: string | null;
  renewalDueAt: string | null;
};

type WorkspaceDocumentRow = {
  id: string;
  document_key: string | null;
  title: string;
  status: string;
  completed_at: string | null;
  file_url: string | null;
  property_id: string | null;
  created_at: string;
  sent_at: string | null;
  source_ref: string | null;
  property: { address_line1: string | null; city: string | null; state: string | null } | null;
};

type PropertyFormRow = {
  id: string;
  property_id: string;
  form_key: string;
  data: Record<string, unknown> | null;
  completed_at: string | null;
  updated_at: string | null;
  property: { address_line1: string | null; city: string | null; state: string | null } | null;
};

type RawFormDocRow = {
  id: string;
  property_id: string;
  form_key: string;
  form_data: Record<string, unknown> | null;
  completed_at: string | null;
  updated_at: string | null;
  property: { address_line1: string | null; city: string | null; state: string | null } | null;
};

type OwnerKycRow = {
  id: string;
  user_id: string;
  legal_name: string | null;
  license_number: string | null;
  issuing_state: string | null;
  expiration_date: string | null;
  front_photo_url: string | null;
  back_photo_url: string | null;
  consent_given: boolean | null;
  updated_at: string | null;
};

const PROPERTY_FORM_LABELS: Record<string, string> = {
  paid_onboarding_fee: "Paid Initial Onboarding Fee",
  property_setup: "Property Setup",
  wifi_info: "Wi-Fi Information",
  guidebook: "Guidebook",
  str_permit: "STR Permit",
  hoa_info: "HOA",
  insurance_certificate: "Insurance",
  platform_authorization: "Platform Access",
  onboarding_inspection: "Onboarding Inspection",
  block_dates_calendar: "Block Dates on the Calendar",
  property_offboarding: "Offboarding",
};

const PROPERTY_SETUP_SECTION_KEYS = [
  "setup_basic",
  "setup_access",
  "setup_security",
  "setup_utilities",
  "setup_appliances",
  "setup_contacts",
  "setup_tech",
  "setup_house_rules",
  "setup_amenities",
  "setup_listing",
  "setup_communication",
] as const;

const FORM_KEY_TO_DOCUMENT_KEY: Record<string, string> = {
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

/**
 * Map a documents-spine status to the legacy display vocabulary this admin view
 * was built around (pending / completed / expired / declined).
 */
function spineStatusToDocStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "on_file" || s === "completed") return "completed";
  if (s === "expired") return "expired";
  if (s === "action_required" || s === "declined") return "declined";
  return "pending";
}

function deriveCategory(templateName: string): WorkspaceDocument["category"] {
  const lower = templateName.toLowerCase();
  if (lower.includes("agreement") || lower.includes("addendum") || lower.includes("contract")) return "legal";
  if (
    lower.includes("w9")
    || lower.includes("w-9")
    || lower.includes("ach")
    || lower.includes("tax")
    || lower.includes("card authorization")
    || lower.includes("credit card")
    || lower.includes("payment")
    || lower.includes("bank")
  ) {
    return "financial";
  }
  return "property";
}

function propertyLabel(prop: PropertyFormRow["property"] | WorkspaceDocumentRow["property"]): string | null {
  return prop
    ? [prop.address_line1, prop.city, prop.state].filter(Boolean).join(", ")
    : null;
}

function calculateRenewalDueAt(expiresAt: string | null, leadDays: number): string | null {
  if (!expiresAt) return null;
  const date = new Date(`${expiresAt}T00:00:00`);
  date.setDate(date.getDate() - leadDays);
  return date.toISOString();
}

function expirationStatus(expiresAt: string | null): "completed" | "expiring" | "expired" {
  if (!expiresAt) return "completed";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expires = new Date(`${expiresAt}T00:00:00`);
  if (expires.getTime() < today.getTime()) return "expired";
  const renewalDue = new Date(expires);
  renewalDue.setDate(renewalDue.getDate() - 60);
  return renewalDue.getTime() <= today.getTime() ? "expiring" : "completed";
}

function getStringField(data: Record<string, unknown> | null, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formIsComplete(row: PropertyFormRow): boolean {
  return Boolean(row.completed_at) || Object.keys(row.data ?? {}).length > 0;
}

function createFormDocument(documentKey: string, rows: PropertyFormRow[], propertyCount: number): WorkspaceDocument | null {
  const completedRows = rows.filter(formIsComplete);
  if (completedRows.length === 0) return null;
  const latest = completedRows
    .slice()
    .sort((a, b) => new Date(b.completed_at ?? b.updated_at ?? 0).getTime() - new Date(a.completed_at ?? a.updated_at ?? 0).getTime())[0];
  if (!latest) return null;

  const label = PROPERTY_FORM_LABELS[documentKey] ?? documentKey;
  const expiresAt = getStringField(latest.data, "expiration_date");
  const completedPropertyIds = new Set(completedRows.map((row) => row.property_id));
  const allPropertiesComplete = propertyCount === 0 || completedPropertyIds.size >= propertyCount;
  const status = allPropertiesComplete ? expirationStatus(expiresAt) : "partial";

  return {
    id: `form:${documentKey}:${latest.id}`,
    documentKey,
    source: "property_form",
    templateName: label,
    category: "property",
    status,
    signedAt: latest.completed_at ?? latest.updated_at,
    signedPdfUrl: null,
    propertyId: propertyCount === 1 ? latest.property_id : null,
    propertyLabel: propertyCount === 1 ? propertyLabel(latest.property) : `${completedPropertyIds.size}/${propertyCount} properties`,
    createdAt: latest.updated_at ?? latest.completed_at ?? new Date(0).toISOString(),
    sentAt: null,
    boldsignDocumentId: null,
    expiresAt,
    renewalDueAt: calculateRenewalDueAt(expiresAt, 60),
  };
}

function createPropertySetupDocument(rows: PropertyFormRow[], propertyCount: number): WorkspaceDocument | null {
  const completedRows = rows.filter(formIsComplete);
  if (completedRows.length === 0) return null;
  const completedPairs = new Set(completedRows.map((row) => `${row.property_id}:${row.form_key}`));
  const expectedCount = Math.max(propertyCount, 1) * PROPERTY_SETUP_SECTION_KEYS.length;
  const latest = completedRows
    .slice()
    .sort((a, b) => new Date(b.completed_at ?? b.updated_at ?? 0).getTime() - new Date(a.completed_at ?? a.updated_at ?? 0).getTime())[0];
  if (!latest) return null;

  return {
    id: `form:property_setup:${latest.id}`,
    documentKey: "property_setup",
    source: "property_form",
    templateName: PROPERTY_FORM_LABELS.property_setup,
    category: "property",
    status: completedPairs.size >= expectedCount ? "completed" : "partial",
    signedAt: latest.completed_at ?? latest.updated_at,
    signedPdfUrl: null,
    propertyId: propertyCount === 1 ? latest.property_id : null,
    propertyLabel: `${completedPairs.size}/${expectedCount} sections`,
    createdAt: latest.updated_at ?? latest.completed_at ?? new Date(0).toISOString(),
    sentAt: null,
    boldsignDocumentId: null,
    expiresAt: null,
    renewalDueAt: null,
  };
}

export async function fetchWorkspaceDocuments(profileId: string, propertyIds: string[] = []): Promise<WorkspaceDocument[]> {
  const supabase = await createClient();
  // Signature documents live on the documents spine (source = 'signed_document').
  const signedDocumentsPromise = untypedDatabase(supabase)
    .from<WorkspaceDocumentRow[]>("documents")
    .select(`
      id, document_key, title, status, completed_at, file_url, property_id, created_at,
      sent_at, source_ref,
      property:properties(address_line1, city, state)
    `)
    .eq("owner_id", profileId)
    .eq("source", "signed_document")
    .order("created_at", { ascending: false });

  // Raw form rows on the spine (source = 'property_form', form_key set).
  const propertyFormsPromise = propertyIds.length > 0
    ? untypedDatabase(supabase)
        .from<RawFormDocRow[]>("documents")
        .select("id, property_id, form_key, form_data, completed_at, updated_at, property:properties(address_line1, city, state)")
        .eq("source", "property_form")
        .not("form_key", "is", null)
        .in("property_id", propertyIds)
        .order("updated_at", { ascending: false })
    : Promise.resolve({ data: [] as RawFormDocRow[], error: null });

  // Supabase generated types are stale for owner_kyc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerKycPromise = (supabase as any)
    .from("owner_kyc")
    .select("id, user_id, legal_name, license_number, issuing_state, expiration_date, front_photo_url, back_photo_url, consent_given, updated_at")
    .eq("user_id", profileId)
    .maybeSingle();

  const [{ data, error }, { data: formRows, error: formsError }, { data: ownerKyc, error: ownerKycError }] =
    await Promise.all([signedDocumentsPromise, propertyFormsPromise, ownerKycPromise]);

  if (error) {
    console.error("[workspace-documents] fetch error:", error.message);
  }
  if (formsError) console.error("[workspace-documents] form rows fetch error:", formsError.message);
  if (ownerKycError) console.error("[workspace-documents] owner_kyc fetch error:", ownerKycError.message);

  const signedDocuments = ((data ?? []) as WorkspaceDocumentRow[]).map((row) => {
    const prop = row.property;
    return {
      id: row.id,
      documentKey: row.document_key,
      source: "signed_document" as const,
      templateName: row.title,
      category: deriveCategory(row.title),
      status: spineStatusToDocStatus(row.status),
      signedAt: row.completed_at,
      signedPdfUrl: row.file_url,
      propertyId: row.property_id,
      propertyLabel: propertyLabel(prop),
      createdAt: row.created_at,
      sentAt: row.sent_at,
      boldsignDocumentId: row.source_ref,
      expiresAt: null,
      renewalDueAt: null,
    };
  });

  const forms: PropertyFormRow[] = ((formRows ?? []) as RawFormDocRow[]).map((row) => ({
    id: row.id,
    property_id: row.property_id,
    form_key: row.form_key,
    data: row.form_data,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
    property: row.property,
  }));
  const docsByKey = new Map<string, PropertyFormRow[]>();
  for (const row of forms) {
    const documentKey = FORM_KEY_TO_DOCUMENT_KEY[row.form_key];
    if (!documentKey) continue;
    const existing = docsByKey.get(documentKey) ?? [];
    existing.push(row);
    docsByKey.set(documentKey, existing);
  }

  const formDocuments = Array.from(docsByKey.entries())
    .map(([documentKey, rows]) => createFormDocument(documentKey, rows, propertyIds.length))
    .filter((doc): doc is WorkspaceDocument => Boolean(doc));

  const setupRows = forms.filter((row) => PROPERTY_SETUP_SECTION_KEYS.includes(row.form_key as (typeof PROPERTY_SETUP_SECTION_KEYS)[number]));
  const setupDocument = createPropertySetupDocument(setupRows, propertyIds.length);
  if (setupDocument) formDocuments.push(setupDocument);

  const kyc = ownerKyc as OwnerKycRow | null;
  const identityDocument: WorkspaceDocument[] = kyc && (kyc.consent_given || kyc.front_photo_url || kyc.back_photo_url)
    ? [{
        id: `kyc:${kyc.id}`,
        documentKey: "identity",
        source: "owner_kyc",
        templateName: "Identity Verification",
        category: "legal",
        status: expirationStatus(kyc.expiration_date),
        signedAt: kyc.updated_at,
        signedPdfUrl: null,
        propertyId: null,
        propertyLabel: kyc.issuing_state ? `Issued in ${kyc.issuing_state}` : null,
        createdAt: kyc.updated_at ?? new Date(0).toISOString(),
        sentAt: null,
        boldsignDocumentId: null,
        expiresAt: kyc.expiration_date,
        renewalDueAt: calculateRenewalDueAt(kyc.expiration_date, 60),
      }]
    : [];

  return [...signedDocuments, ...formDocuments, ...identityDocument];
}
