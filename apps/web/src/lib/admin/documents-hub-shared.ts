/* ─── Client-safe constants, types, and helpers for Documents Hub ─── */

/* ─── Setup section keys (each is one form_key row in property_forms) ─── */
export const SETUP_SECTION_KEYS = [
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

export type SetupSectionKey = (typeof SETUP_SECTION_KEYS)[number];

export const SETUP_SECTION_LABELS: Record<SetupSectionKey, string> = {
  setup_basic:          "Basic Info",
  setup_access:         "Access & Entry",
  setup_security:       "Security System",
  setup_utilities:      "Utilities & Systems",
  setup_appliances:     "Appliances",
  setup_contacts:       "Emergency Contacts",
  setup_tech:           "Tech & Connectivity",
  setup_house_rules:    "House Rules",
  setup_amenities:      "Outdoor Amenities",
  setup_listing:        "Listing Setup",
  setup_communication:  "Communication Preferences",
};

/* All form keys that live in the property_forms table */
export const PROPERTY_FORM_KEYS = [
  ...SETUP_SECTION_KEYS,
  "guidebook",
  "str_permit",
  "hoa_info",
  "insurance_certificate",
  "platform_authorization",
  "onboarding_inspection",
  "property_offboarding",
] as const;

export type PropertyFormKey = (typeof PROPERTY_FORM_KEYS)[number];

export const SECURE_DOC_TYPES = {
  host_rental_agreement: {
    label: "Host Rental Agreement",
    shortLabel: "Host Agreement",
    rowLabel: "Agreement",
    templateId: "3b0032db-3036-493d-8e6a-f53667430af8",
    templateNames: ["Host Rental Agreement (20%)", "Host Rental Agreement (15%)", "Host Rental Agreement"],
    color: "#7c3aed",
    description: "Management agreement and fee structure",
  },
  card_authorization: {
    label: "Card Authorization",
    shortLabel: "Card Auth",
    rowLabel: "Card",
    templateId: "b1537fca-210d-426a-b931-7af0c3841c40",
    templateNames: ["Card Authorization Form"],
    color: "#0284c7",
    description: "Credit/debit card on file for owner expenses",
  },
  ach_authorization: {
    label: "ACH Authorization",
    shortLabel: "ACH Auth",
    rowLabel: "ACH",
    templateId: "c299afc6-7aba-42ec-8f03-337c88966990",
    templateNames: ["ACH Authorization Form"],
    color: "#0891b2",
    description: "Bank routing and account for ACH transfers",
  },
  w9: {
    label: "W9 Form",
    shortLabel: "W9",
    rowLabel: "W-9",
    templateId: null as string | null,
    templateNames: ["W9 Form", "W-9 Form"],
    color: "#16a34a",
    description: "IRS taxpayer identification for 1099 reporting",
  },
  identity: {
    label: "Identity Verification",
    shortLabel: "ID Verify",
    rowLabel: "ID",
    templateId: null as string | null,
    templateNames: ["Identity Verification"],
    color: "#8b5cf6",
    description: "Government-issued ID for KYC compliance",
  },
} as const;

export const FORM_TYPES = {
  property_setup: {
    label: "Property Setup",
    shortLabel: "Setup",
    rowLabel: "Setup",
    color: "#ec4899",
    description: "11-section property data — access, tech, rules, utilities, and more",
  },
  wifi_info: {
    label: "Wi-Fi Information",
    shortLabel: "Wi-Fi",
    rowLabel: "Wi-Fi",
    color: "#f59e0b",
    description: "Network credentials for the property",
  },
  guidebook: {
    label: "Guidebook",
    shortLabel: "Guidebook",
    rowLabel: "Guide",
    color: "#10b981",
    description: "Local recommendations by category for the guest guidebook",
  },
  str_permit: {
    label: "STR Permit",
    shortLabel: "Permit",
    rowLabel: "Permit",
    color: "#0ea5e9",
    description: "Short-term rental permit or license per property",
  },
  hoa_info: {
    label: "HOA",
    shortLabel: "HOA",
    rowLabel: "HOA",
    color: "#6366f1",
    description: "HOA membership, rules, and management contact",
  },
  insurance_certificate: {
    label: "Insurance",
    shortLabel: "Insurance",
    rowLabel: "Insurance",
    color: "#f97316",
    description: "Short-term rental or homeowners insurance certificate",
  },
  platform_authorization: {
    label: "Platform Access",
    shortLabel: "Platforms",
    rowLabel: "Platforms",
    color: "#8b5cf6",
    description: "OTA account access and co-host authorization per platform",
  },
  onboarding_inspection: {
    label: "Onboarding Inspection",
    shortLabel: "Inspection",
    rowLabel: "Inspection",
    color: "#64748b",
    description: "Room-by-room condition report and appliance inventory at onboarding",
  },
  property_offboarding: {
    label: "Offboarding",
    shortLabel: "Offboarding",
    rowLabel: "Offboarding",
    color: "#dc2626",
    description: "Property transition checklist when an owner gives notice",
  },
} as const;

export type SecureDocKey = keyof typeof SECURE_DOC_TYPES;
export type FormKey = keyof typeof FORM_TYPES;

export type SignedDocRow = {
  id: string;
  templateName: string;
  status: string;
  signedAt: string | null;
  signedPdfUrl: string | null;
  createdAt: string;
  sentAt: string | null;
  sentByName: string | null;
  boldsignDocumentId: string;
};

export type DocHubSecureEntry = {
  status: "completed" | "pending" | "not_sent";
  latest: SignedDocRow | null;
  versions: SignedDocRow[];
};

export type DocHubFormEntry = {
  submitted: boolean;
  data: Record<string, string | null>;
  /** Only present on property_setup — per-section completion from property_forms */
  sections?: Partial<Record<SetupSectionKey, boolean>>;
  /** 0-100, only present on property_setup */
  completionPct?: number;
};

export type DocHubOwner = {
  contactId: string;
  profileId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  propertyCount: number;
  /** Primary property used for form data/edits (first property today). */
  firstPropertyId: string | null;
  secureDocs: Record<SecureDocKey, DocHubSecureEntry>;
  forms: Record<FormKey, DocHubFormEntry>;
  /** Full property_forms.data for the primary property, keyed by form_key.
   *  Powers the registry-driven all-questions view (filled or not). */
  rawForms: Partial<Record<PropertyFormKey, Record<string, unknown>>>;
};

export type DocTypeStats = {
  completed: number;
  pending: number;
  notSent: number;
  total: number;
};

export type DocHubStats = {
  secureDocs: Record<SecureDocKey, DocTypeStats>;
  forms: Record<FormKey, DocTypeStats>;
  totalOwners: number;
};

/* ─── Avatar color helper (deterministic per name) ─── */

const AVATAR_COLORS = [
  "#0ea5e9", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#64748b", "#f97316", "#06b6d4",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─── Date formatters ─── */

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
