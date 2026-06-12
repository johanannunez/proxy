/* ─── Client-safe constants, types, and helpers for Documents Hub ─── */

/* ─── Setup section keys (each is one form_key row on the documents spine) ─── */
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

/* All form keys stored as raw form rows on the documents spine */
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
  paid_onboarding_fee: {
    label: "Paid Initial Onboarding Fee",
    shortLabel: "Fee",
    rowLabel: "Fee",
    color: "#14b8a6",
    description: "Initial onboarding payment confirmation",
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
  block_dates_calendar: {
    label: "Block Dates on the Calendar",
    shortLabel: "Block Dates",
    rowLabel: "Blocks",
    color: "#9333ea",
    description: "Owner stays, unavailable dates, and launch calendar blocks",
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

export type DocumentLifecycleKind = "secure_doc" | "form" | "upload" | "lifecycle";
export type DocumentVisibility = "always" | "offboarding_started";

export type DocumentExpirationRule = {
  expires: boolean;
  renewalLeadDays: number | null;
  dateField: string | null;
};

export type DocumentPreviewKind =
  | "agreement"
  | "bank"
  | "card"
  | "tax"
  | "id"
  | "setup"
  | "wifi"
  | "guidebook"
  | "permit"
  | "hoa"
  | "insurance"
  | "platforms"
  | "inspection"
  | "calendar"
  | "offboarding";

export type WorkspaceDocumentKey =
  | SecureDocKey
  | "paid_onboarding_fee"
  | "property_setup"
  | "wifi_info"
  | "guidebook"
  | "str_permit"
  | "hoa_info"
  | "insurance_certificate"
  | "platform_authorization"
  | "onboarding_inspection"
  | "block_dates_calendar"
  | "property_offboarding";

export type DocumentLifecycleDefinition = {
  key: WorkspaceDocumentKey;
  label: string;
  shortLabel: string;
  group: "Owner package" | "Payment setup" | "Property setup" | "Offboarding";
  kind: DocumentLifecycleKind;
  color: string;
  visibility: DocumentVisibility;
  sendable: boolean;
  requestable: boolean;
  expiration: DocumentExpirationRule;
  description: string;
  preview: DocumentPreviewKind;
};

const NO_EXPIRATION: DocumentExpirationRule = {
  expires: false,
  renewalLeadDays: null,
  dateField: null,
};

export const WORKSPACE_DOCUMENT_DEFINITIONS: Record<WorkspaceDocumentKey, DocumentLifecycleDefinition> = {
  host_rental_agreement: {
    key: "host_rental_agreement",
    label: SECURE_DOC_TYPES.host_rental_agreement.label,
    shortLabel: SECURE_DOC_TYPES.host_rental_agreement.shortLabel,
    group: "Owner package",
    kind: "secure_doc",
    color: "#ef4444",
    visibility: "always",
    sendable: true,
    requestable: false,
    expiration: NO_EXPIRATION,
    description: "Management agreement and fee structure for the owner relationship.",
    preview: "agreement",
  },
  card_authorization: {
    key: "card_authorization",
    label: SECURE_DOC_TYPES.card_authorization.label,
    shortLabel: SECURE_DOC_TYPES.card_authorization.shortLabel,
    group: "Payment setup",
    kind: "secure_doc",
    color: SECURE_DOC_TYPES.card_authorization.color,
    visibility: "always",
    sendable: true,
    requestable: false,
    expiration: { expires: true, renewalLeadDays: 60, dateField: "card_expiration_date" },
    description: "Authorization to keep an owner debit or credit card available for approved property expenses.",
    preview: "card",
  },
  ach_authorization: {
    key: "ach_authorization",
    label: SECURE_DOC_TYPES.ach_authorization.label,
    shortLabel: SECURE_DOC_TYPES.ach_authorization.shortLabel,
    group: "Payment setup",
    kind: "secure_doc",
    color: SECURE_DOC_TYPES.ach_authorization.color,
    visibility: "always",
    sendable: true,
    requestable: false,
    expiration: NO_EXPIRATION,
    description: "Bank authorization for ACH transfers and payouts.",
    preview: "bank",
  },
  w9: {
    key: "w9",
    label: SECURE_DOC_TYPES.w9.label,
    shortLabel: SECURE_DOC_TYPES.w9.shortLabel,
    group: "Owner package",
    kind: "upload",
    color: SECURE_DOC_TYPES.w9.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Taxpayer identification for 1099 reporting.",
    preview: "tax",
  },
  identity: {
    key: "identity",
    label: SECURE_DOC_TYPES.identity.label,
    shortLabel: SECURE_DOC_TYPES.identity.shortLabel,
    group: "Owner package",
    kind: "upload",
    color: SECURE_DOC_TYPES.identity.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: { expires: true, renewalLeadDays: 60, dateField: "expiration_date" },
    description: "Owner identity verification for account and compliance review.",
    preview: "id",
  },
  paid_onboarding_fee: {
    key: "paid_onboarding_fee",
    label: FORM_TYPES.paid_onboarding_fee.label,
    shortLabel: FORM_TYPES.paid_onboarding_fee.shortLabel,
    group: "Payment setup",
    kind: "form",
    color: FORM_TYPES.paid_onboarding_fee.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Confirmation that the initial onboarding payment has been collected or waived.",
    preview: "bank",
  },
  property_setup: {
    key: "property_setup",
    label: FORM_TYPES.property_setup.label,
    shortLabel: FORM_TYPES.property_setup.shortLabel,
    group: "Property setup",
    kind: "form",
    color: FORM_TYPES.property_setup.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Core property details for access, rooms, utilities, rules, and operations.",
    preview: "setup",
  },
  wifi_info: {
    key: "wifi_info",
    label: FORM_TYPES.wifi_info.label,
    shortLabel: FORM_TYPES.wifi_info.shortLabel,
    group: "Property setup",
    kind: "form",
    color: FORM_TYPES.wifi_info.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Network name, password, router location, and connection details.",
    preview: "wifi",
  },
  guidebook: {
    key: "guidebook",
    label: FORM_TYPES.guidebook.label,
    shortLabel: FORM_TYPES.guidebook.shortLabel,
    group: "Property setup",
    kind: "form",
    color: FORM_TYPES.guidebook.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Local recommendations and useful guest-facing information.",
    preview: "guidebook",
  },
  str_permit: {
    key: "str_permit",
    label: FORM_TYPES.str_permit.label,
    shortLabel: FORM_TYPES.str_permit.shortLabel,
    group: "Property setup",
    kind: "upload",
    color: FORM_TYPES.str_permit.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: { expires: true, renewalLeadDays: 60, dateField: "expiration_date" },
    description: "Short-term rental permit or license required for the property.",
    preview: "permit",
  },
  hoa_info: {
    key: "hoa_info",
    label: FORM_TYPES.hoa_info.label,
    shortLabel: FORM_TYPES.hoa_info.shortLabel,
    group: "Property setup",
    kind: "form",
    color: FORM_TYPES.hoa_info.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "HOA rules, restrictions, management contact, and property-specific requirements.",
    preview: "hoa",
  },
  insurance_certificate: {
    key: "insurance_certificate",
    label: FORM_TYPES.insurance_certificate.label,
    shortLabel: FORM_TYPES.insurance_certificate.shortLabel,
    group: "Property setup",
    kind: "upload",
    color: FORM_TYPES.insurance_certificate.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: { expires: true, renewalLeadDays: 60, dateField: "expiration_date" },
    description: "Insurance certificate or policy information for the property.",
    preview: "insurance",
  },
  platform_authorization: {
    key: "platform_authorization",
    label: FORM_TYPES.platform_authorization.label,
    shortLabel: FORM_TYPES.platform_authorization.shortLabel,
    group: "Property setup",
    kind: "form",
    color: FORM_TYPES.platform_authorization.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Authorization and access status for Airbnb, Vrbo, Hospitable, and related platforms.",
    preview: "platforms",
  },
  onboarding_inspection: {
    key: "onboarding_inspection",
    label: FORM_TYPES.onboarding_inspection.label,
    shortLabel: FORM_TYPES.onboarding_inspection.shortLabel,
    group: "Property setup",
    kind: "form",
    color: FORM_TYPES.onboarding_inspection.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Condition, inventory, and readiness notes captured during onboarding.",
    preview: "inspection",
  },
  block_dates_calendar: {
    key: "block_dates_calendar",
    label: FORM_TYPES.block_dates_calendar.label,
    shortLabel: FORM_TYPES.block_dates_calendar.shortLabel,
    group: "Property setup",
    kind: "form",
    color: FORM_TYPES.block_dates_calendar.color,
    visibility: "always",
    sendable: false,
    requestable: true,
    expiration: NO_EXPIRATION,
    description: "Owner stays, unavailable dates, and launch calendar blocks.",
    preview: "calendar",
  },
  property_offboarding: {
    key: "property_offboarding",
    label: FORM_TYPES.property_offboarding.label,
    shortLabel: FORM_TYPES.property_offboarding.shortLabel,
    group: "Offboarding",
    kind: "lifecycle",
    color: FORM_TYPES.property_offboarding.color,
    visibility: "offboarding_started",
    sendable: false,
    requestable: false,
    expiration: NO_EXPIRATION,
    description: "Final transition work for payout, access, platforms, guest communication, and owner handoff.",
    preview: "offboarding",
  },
};

export const WORKSPACE_DOCUMENT_ORDER: WorkspaceDocumentKey[] = [
  "host_rental_agreement",
  "w9",
  "identity",
  "paid_onboarding_fee",
  "ach_authorization",
  "card_authorization",
  "property_setup",
  "wifi_info",
  "guidebook",
  "block_dates_calendar",
  "str_permit",
  "hoa_info",
  "insurance_certificate",
  "platform_authorization",
  "onboarding_inspection",
  "property_offboarding",
];

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
  /** Latest signer view event from document_events (engagement signal). */
  viewedAt: string | null;
  /** Highest auto-reminder round already sent (0 = none). */
  reminderRoundsSent: number;
  /** Per-document auto-reminder mute. */
  remindersMuted: boolean;
};

/* ─── Document stage (package-tracking meter) ─── */

export type DocumentStage = "created" | "sent" | "viewed" | "signed" | "on_file";

export const DOCUMENT_STAGES: Array<{ key: DocumentStage; label: string }> = [
  { key: "created", label: "Created" },
  { key: "sent", label: "Sent" },
  { key: "viewed", label: "Viewed" },
  { key: "signed", label: "Signed" },
  { key: "on_file", label: "On file" },
];

export function stageOfSignedDoc(row: SignedDocRow): DocumentStage {
  const s = row.status?.toLowerCase() ?? "";
  if (s === "on_file" || s === "completed") return "on_file";
  if (s === "signed" || s === "awaiting_countersignature" || row.signedAt) return "signed";
  if (row.viewedAt) return "viewed";
  if (row.sentAt || s === "sent") return "sent";
  return "created";
}

export function stageIndex(stage: DocumentStage): number {
  return DOCUMENT_STAGES.findIndex((s) => s.key === stage);
}

/* ─── Auto-reminder schedule (mirrors DEFAULT_CADENCE in documents/reminders) ─── */

const REMINDER_ROUND_DAYS = [3, 7, 14] as const;

/**
 * When the next auto-reminder goes out for a waiting document, or null when
 * all rounds are spent or reminders are muted. Day thresholds count from
 * document creation, matching find_reminder_candidates().
 */
export function nextReminderDate(row: SignedDocRow): Date | null {
  if (row.remindersMuted) return null;
  if (row.reminderRoundsSent >= 3) return null;
  const days = REMINDER_ROUND_DAYS[row.reminderRoundsSent];
  const due = new Date(new Date(row.createdAt).getTime() + days * 86_400_000);
  return due;
}

export function fmtReminderDay(date: Date): string {
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── Relative time (engagement chips) ─── */

export function fmtRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function firstNameOf(name: string): string {
  return name.split(" ")[0] ?? name;
}

export type DocHubSecureEntry = {
  status: "completed" | "pending" | "not_sent";
  latest: SignedDocRow | null;
  versions: SignedDocRow[];
};

export type DocHubFormEntry = {
  submitted: boolean;
  data: Record<string, string | null>;
  /** Only present on property_setup — per-section completion from spine form rows */
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
  secureDocs: Record<SecureDocKey, DocHubSecureEntry>;
  forms: Record<FormKey, DocHubFormEntry>;
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
