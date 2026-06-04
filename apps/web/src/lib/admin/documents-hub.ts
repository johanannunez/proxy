import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  SETUP_SECTION_KEYS,
  type SecureDocKey,
  type FormKey,
  type SetupSectionKey,
  type SignedDocRow,
  type DocHubSecureEntry,
  type DocHubFormEntry,
  type DocHubOwner,
  type DocTypeStats,
  type DocHubStats,
  avatarColor,
  fmtDate,
  fmtShortDate,
} from "./documents-hub-shared";

/* Re-export everything so existing imports from documents-hub still work */
export {
  SECURE_DOC_TYPES,
  FORM_TYPES,
  SETUP_SECTION_KEYS,
  avatarColor,
  fmtDate,
  fmtShortDate,
};
export type {
  SecureDocKey,
  FormKey,
  SetupSectionKey,
  SignedDocRow,
  DocHubSecureEntry,
  DocHubFormEntry,
  DocHubOwner,
  DocTypeStats,
  DocHubStats,
};

/* ─── Helpers ─── */

const NOT_SENT_ENTRY: DocHubSecureEntry = { status: "not_sent", latest: null, versions: [] };
const NOT_SUBMITTED_FORM: DocHubFormEntry = { submitted: false, data: {} };

function normalizeTemplateName(name: string): SecureDocKey | null {
  const lower = name.toLowerCase();
  for (const [key, def] of Object.entries(SECURE_DOC_TYPES) as [SecureDocKey, (typeof SECURE_DOC_TYPES)[SecureDocKey]][]) {
    if (def.templateNames.some((n) => n.toLowerCase() === lower)) return key;
  }
  return null;
}

function makeInitialSecureDocs(): Record<SecureDocKey, DocHubSecureEntry> {
  return Object.fromEntries(
    Object.keys(SECURE_DOC_TYPES).map((k) => [k, { ...NOT_SENT_ENTRY, versions: [] as SignedDocRow[] }]),
  ) as unknown as Record<SecureDocKey, DocHubSecureEntry>;
}

function makeInitialForms(): Record<FormKey, DocHubFormEntry> {
  return Object.fromEntries(
    Object.keys(FORM_TYPES).map((k) => [k, { ...NOT_SUBMITTED_FORM, data: {} as Record<string, string | null> }]),
  ) as unknown as Record<FormKey, DocHubFormEntry>;
}

/* ─── Main data fetcher ─── */

export async function fetchDocumentsHubData(): Promise<DocHubOwner[]> {
  const supabase = await createClient();

  // 1. All active/onboarding contacts with profile info and property count
  const { data: contacts, error: contactsErr } = await (supabase as any)
    .from("contacts")
    .select(`
      id,
      profile_id,
      full_name,
      email,
      phone,
      avatar_url,
      property_count:properties!properties_contact_id_fkey(count)
    `)
    .in("lifecycle_stage", ["active_owner", "onboarding", "qualified", "paused"])
    .order("full_name");

  if (contactsErr) {
    console.error("[documents-hub] contacts fetch error:", contactsErr.message);
    return [];
  }

  if (!contacts || contacts.length === 0) return [];

  const profileIds = (contacts as any[])
    .map((c: any) => c.profile_id)
    .filter(Boolean) as string[];

  const contactIds = (contacts as any[]).map((c: any) => c.id);

  // 2. All signed_documents for these profile IDs, join sender profile
  const { data: signedDocs, error: docsErr } = await (supabase as any)
    .from("signed_documents")
    .select(`
      id, user_id, template_name, status, signed_at, signed_pdf_url,
      created_at, sent_at, boldsign_document_id,
      sender:profiles!signed_documents_sent_by_fkey(full_name)
    `)
    .in("user_id", profileIds)
    .order("created_at", { ascending: false });

  if (docsErr) {
    console.error("[documents-hub] signed_documents fetch error:", docsErr.message);
  }

  // 3. Properties for legacy form data (wifi, bed_arrangements, guidebook_spots) + IDs for property_forms
  const { data: properties, error: propsErr } = await (supabase as any)
    .from("properties")
    .select(`
      id, contact_id,
      wifi_details,
      bed_arrangements,
      guidebook_spots,
      house_rules
    `)
    .in("contact_id", contactIds);

  if (propsErr) {
    console.error("[documents-hub] properties fetch error:", propsErr.message);
  }

  // 4. Owner KYC for identity verification
  const { data: kycRows, error: kycErr } = await (supabase as any)
    .from("owner_kyc")
    .select(`user_id, legal_name, license_number, issuing_state, expiration_date, consent_given`)
    .in("user_id", profileIds);

  if (kycErr) {
    console.error("[documents-hub] owner_kyc fetch error:", kycErr.message);
  }

  // 5. Property forms (setup sections + compliance forms + new forms)
  const propertyIds = ((properties ?? []) as any[]).map((p: any) => p.id);

  const { data: propertyForms, error: formsErr } = propertyIds.length > 0
    ? await (supabase as any)
        .from("property_forms")
        .select("property_id, form_key, data, completed_at")
        .in("property_id", propertyIds)
    : { data: [], error: null };

  if (formsErr) {
    console.error("[documents-hub] property_forms fetch error:", formsErr.message);
  }

  // ─── Build lookup maps ───

  const docsByProfileId = new Map<string, any[]>();
  for (const doc of (signedDocs ?? []) as any[]) {
    const list = docsByProfileId.get(doc.user_id) ?? [];
    list.push(doc);
    docsByProfileId.set(doc.user_id, list);
  }

  // Primary property per contact (first one)
  const firstPropByContactId = new Map<string, any>();
  for (const prop of (properties ?? []) as any[]) {
    if (!firstPropByContactId.has(prop.contact_id)) {
      firstPropByContactId.set(prop.contact_id, prop);
    }
  }

  // All properties per contact (needed to compute per-contact form coverage)
  const propsByContactId = new Map<string, any[]>();
  for (const prop of (properties ?? []) as any[]) {
    const list = propsByContactId.get(prop.contact_id) ?? [];
    list.push(prop);
    propsByContactId.set(prop.contact_id, list);
  }

  // property_forms keyed by property_id → form_key → { data, completed_at }
  const formsByPropertyId = new Map<string, Map<string, { data: any; completed_at: string | null }>>();
  for (const pf of (propertyForms ?? []) as any[]) {
    if (!formsByPropertyId.has(pf.property_id)) {
      formsByPropertyId.set(pf.property_id, new Map());
    }
    formsByPropertyId.get(pf.property_id)!.set(pf.form_key, {
      data: pf.data ?? {},
      completed_at: pf.completed_at ?? null,
    });
  }

  const kycByProfileId = new Map<string, any>();
  for (const kyc of (kycRows ?? []) as any[]) {
    kycByProfileId.set(kyc.user_id, kyc);
  }

  // ─── Assemble owners ───

  return (contacts as any[]).map((contact: any): DocHubOwner => {
    const profileId: string | null = contact.profile_id ?? null;
    const propertyCount = Array.isArray(contact.property_count)
      ? (contact.property_count[0]?.count ?? 0)
      : (contact.property_count ?? 0);

    // SecureDocs map
    const secureDocs = makeInitialSecureDocs();
    const ownerDocs = profileId ? (docsByProfileId.get(profileId) ?? []) : [];

    for (const doc of ownerDocs) {
      const key = normalizeTemplateName(doc.template_name);
      if (!key) continue;

      const row: SignedDocRow = {
        id: doc.id,
        templateName: doc.template_name,
        status: doc.status,
        signedAt: doc.signed_at,
        signedPdfUrl: doc.signed_pdf_url,
        createdAt: doc.created_at,
        sentAt: doc.sent_at,
        sentByName: doc.sender?.full_name ?? null,
        boldsignDocumentId: doc.boldsign_document_id,
      };

      secureDocs[key].versions.push(row);
    }

    // Derive status and latest from versions (already sorted desc by created_at)
    for (const key of Object.keys(secureDocs) as SecureDocKey[]) {
      const { versions } = secureDocs[key];
      if (versions.length === 0) {
        secureDocs[key].status = "not_sent";
        secureDocs[key].latest = null;
      } else {
        secureDocs[key].latest = versions[0];
        const s = versions[0].status?.toLowerCase();
        secureDocs[key].status = s === "completed" ? "completed" : "pending";
      }
    }

    // Identity: mark completed if KYC record exists with consent
    if (profileId) {
      const kyc = kycByProfileId.get(profileId);
      if (kyc && kyc.consent_given) {
        secureDocs.identity = {
          status: "completed",
          latest: null,
          versions: [],
        };
      }
    }

    // Forms map
    const forms = makeInitialForms();
    const firstProp = firstPropByContactId.get(contact.id) ?? null;
    const firstPropId: string | null = firstProp?.id ?? null;
    const firstPropForms = firstPropId ? (formsByPropertyId.get(firstPropId) ?? new Map()) : new Map<string, any>();

    // ─── property_setup: aggregate all 11 setup sections ───
    const sectionCompletion: Partial<Record<SetupSectionKey, boolean>> = {};
    for (const sectionKey of SETUP_SECTION_KEYS) {
      const row = firstPropForms.get(sectionKey);
      sectionCompletion[sectionKey] = row?.completed_at != null;
    }
    const completedCount = Object.values(sectionCompletion).filter(Boolean).length;
    const completionPct = Math.round((completedCount / SETUP_SECTION_KEYS.length) * 100);

    // Fall back to legacy bed_arrangements if setup_basic not in property_forms yet
    const hasSetupInForms = completedCount > 0;
    if (!hasSetupInForms && firstProp?.bed_arrangements) {
      const b = firstProp.bed_arrangements as Record<string, any>;
      sectionCompletion.setup_basic = true;
      const newCompleted = Object.values(sectionCompletion).filter(Boolean).length;
      forms.property_setup = {
        submitted: newCompleted === SETUP_SECTION_KEYS.length,
        completionPct: Math.round((newCompleted / SETUP_SECTION_KEYS.length) * 100),
        sections: sectionCompletion,
        data: {
          "Bedrooms":   b.bedrooms  != null ? String(b.bedrooms)  : null,
          "Bathrooms":  b.bathrooms != null ? String(b.bathrooms) : null,
          "Bed Count":  b.bed_count != null ? String(b.bed_count) : null,
          "Max Guests": b.max_guests != null ? String(b.max_guests) : null,
        },
      };
    } else {
      const setupBasicData = firstPropForms.get("setup_basic")?.data ?? {};
      forms.property_setup = {
        submitted: completionPct === 100,
        completionPct,
        sections: sectionCompletion,
        data: {
          "Completion":        `${completionPct}%`,
          "Sections Complete": `${completedCount} of ${SETUP_SECTION_KEYS.length}`,
          "Bedrooms":   setupBasicData.bedrooms  != null ? String(setupBasicData.bedrooms)  : null,
          "Bathrooms":  setupBasicData.bathrooms != null ? String(setupBasicData.bathrooms) : null,
          "Max Guests": setupBasicData.max_guests != null ? String(setupBasicData.max_guests) : null,
        },
      };
    }

    // ─── wifi_info: read from setup_tech first, fall back to legacy ───
    const techRow = firstPropForms.get("setup_tech");
    if (techRow?.data && (techRow.data.wifi_ssid || techRow.data.wifi_password)) {
      forms.wifi_info = {
        submitted: true,
        data: {
          "Network Name (SSID)": techRow.data.wifi_ssid   ?? null,
          "Password":            techRow.data.wifi_password ?? null,
          "Router Location":     techRow.data.wifi_router_location ?? null,
        },
      };
    } else if (firstProp?.wifi_details && typeof firstProp.wifi_details === "object") {
      const w = firstProp.wifi_details as Record<string, string>;
      forms.wifi_info = {
        submitted: !!(w.ssid || w.password),
        data: {
          "Network Name (SSID)": w.ssid           ?? null,
          "Password":            w.password        ?? null,
          "Router Location":     w.router_location ?? null,
        },
      };
    }

    // ─── guidebook: read from property_forms first, fall back to legacy ───
    const guidebookRow = firstPropForms.get("guidebook");
    if (guidebookRow?.completed_at) {
      const spots = guidebookRow.data.spots;
      forms.guidebook = {
        submitted: true,
        data: {
          "Spots Submitted": Array.isArray(spots) ? String(spots.length) : "—",
        },
      };
    } else if (firstProp?.guidebook_spots && typeof firstProp.guidebook_spots === "object") {
      const spots = firstProp.guidebook_spots as any[];
      forms.guidebook = {
        submitted: Array.isArray(spots) && spots.length > 0,
        data: {
          "Spots Submitted": Array.isArray(spots) ? String(spots.length) : "0",
        },
      };
    }

    // ─── STR Permit ───
    const strPermitRow = firstPropForms.get("str_permit");
    if (strPermitRow?.completed_at) {
      const d = strPermitRow.data;
      forms.str_permit = {
        submitted: true,
        data: {
          "Market":         d.market          ?? null,
          "Permit Required": d.permit_required ?? null,
          "Permit Number":  d.permit_number   ?? null,
          "Expires":        d.expiration_date ?? null,
        },
      };
    }

    // ─── HOA ───
    const hoaRow = firstPropForms.get("hoa_info");
    if (hoaRow?.completed_at) {
      const d = hoaRow.data;
      forms.hoa_info = {
        submitted: true,
        data: {
          "Has HOA":          d.has_hoa          ?? null,
          "HOA Name":         d.hoa_name         ?? null,
          "Management Co.":   d.management_company ?? null,
          "Contact Phone":    d.contact_phone    ?? null,
        },
      };
    }

    // ─── Insurance Certificate ───
    const insuranceRow = firstPropForms.get("insurance_certificate");
    if (insuranceRow?.completed_at) {
      const d = insuranceRow.data;
      forms.insurance_certificate = {
        submitted: true,
        data: {
          "Carrier":       d.carrier_name     ?? null,
          "Policy Type":   d.policy_type      ?? null,
          "Policy Number": d.policy_number    ?? null,
          "Expires":       d.expiration_date  ?? null,
        },
      };
    }

    // ─── Platform Authorization ───
    const platformRow = firstPropForms.get("platform_authorization");
    if (platformRow?.completed_at) {
      const platforms = Array.isArray(platformRow.data.platforms) ? platformRow.data.platforms : [];
      forms.platform_authorization = {
        submitted: platforms.length > 0,
        data: {
          "Platforms Authorized": String(platforms.length),
          "Platforms": platforms.map((p: any) => p.platform).join(", "),
        },
      };
    }

    // ─── Onboarding Inspection ───
    const inspectionRow = firstPropForms.get("onboarding_inspection");
    if (inspectionRow?.completed_at) {
      const d = inspectionRow.data;
      forms.onboarding_inspection = {
        submitted: true,
        data: {
          "Overall Condition": d.overall_condition ?? null,
          "Inspector":         d.inspector_name    ?? null,
          "Date":              d.inspection_date   ?? null,
        },
      };
    }

    // ─── Property Offboarding ───
    const offboardingRow = firstPropForms.get("property_offboarding");
    if (offboardingRow?.data && Object.keys(offboardingRow.data).length > 0) {
      const d = offboardingRow.data;
      forms.property_offboarding = {
        submitted: !!(offboardingRow.completed_at),
        data: {
          "Notice Date":    d.notice_date    ?? null,
          "End Date":       d.end_date       ?? null,
          "Final Payout":   d.final_payout   ?? null,
        },
      };
    }

    // Raw per-form data passthrough for the primary property — full answers,
    // keyed by form_key, for the registry-driven all-questions view.
    const rawForms: Partial<Record<string, Record<string, unknown>>> = {};
    for (const [formKey, row] of firstPropForms.entries()) {
      rawForms[formKey] = (row?.data as Record<string, unknown>) ?? {};
    }

    return {
      contactId: contact.id,
      profileId,
      fullName: contact.full_name ?? contact.email ?? "Unknown",
      email: contact.email ?? "",
      phone: contact.phone ?? null,
      avatarUrl: contact.avatar_url ?? null,
      propertyCount: Number(propertyCount),
      firstPropertyId: firstPropId,
      secureDocs,
      forms,
      rawForms: rawForms as DocHubOwner["rawForms"],
    };
  });
}

/* ─── Stats computer ─── */

export function computeDocTypeStats(owners: DocHubOwner[]): DocHubStats {
  const secureDocs = Object.fromEntries(
    (Object.keys(SECURE_DOC_TYPES) as SecureDocKey[]).map((key) => [
      key,
      { completed: 0, pending: 0, notSent: 0, total: owners.length },
    ]),
  ) as Record<SecureDocKey, DocTypeStats>;

  const forms = Object.fromEntries(
    (Object.keys(FORM_TYPES) as FormKey[]).map((key) => [
      key,
      { completed: 0, pending: 0, notSent: 0, total: owners.length },
    ]),
  ) as Record<FormKey, DocTypeStats>;

  for (const owner of owners) {
    for (const key of Object.keys(SECURE_DOC_TYPES) as SecureDocKey[]) {
      const entry = owner.secureDocs[key];
      if (entry.status === "completed") secureDocs[key].completed++;
      else if (entry.status === "pending") secureDocs[key].pending++;
      else secureDocs[key].notSent++;
    }
    for (const key of Object.keys(FORM_TYPES) as FormKey[]) {
      const entry = owner.forms[key];
      if (entry.submitted) forms[key].completed++;
      else forms[key].notSent++;
    }
  }

  return { secureDocs, forms, totalOwners: owners.length };
}
