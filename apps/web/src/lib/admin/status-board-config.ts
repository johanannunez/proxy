/**
 * Status Board requirement config — maps req_key to label, kind, and scope.
 * Client-safe: no server imports.
 */

export type RequirementKind = "signature" | "form";
export type RequirementScope = "owner" | "property" | "shared";

export type RequirementConfig = {
  label: string;
  kind: RequirementKind;
  scope: RequirementScope;
};

/**
 * Canonical config for all known requirement keys.
 * Ordered within each kind group in the order columns should appear.
 */
export const REQUIREMENT_CONFIG: Record<string, RequirementConfig> = {
  // Signatures (signed documents, incl. W-9 and platform authorization)
  host_rental_agreement:   { label: "Host Rental Agreement", kind: "signature", scope: "property" },
  ach_authorization:       { label: "ACH Authorization",     kind: "signature", scope: "owner" },
  card_authorization:      { label: "Card Authorization",    kind: "signature", scope: "owner" },
  w9:                      { label: "W-9",                   kind: "signature", scope: "owner" },
  platform_authorization:  { label: "Platform Authorization",kind: "signature", scope: "property" },

  // Forms (incl. upload-backed compliance docs: permit, cert, ID)
  str_permit:              { label: "STR Permit",              kind: "form", scope: "property" },
  insurance_certificate:   { label: "Insurance Certificate",   kind: "form", scope: "property" },
  identity:                { label: "Identity",                kind: "form", scope: "owner" },
  wifi_info:               { label: "WiFi Info",            kind: "form", scope: "property" },
  hoa_info:                { label: "HOA Info",             kind: "form", scope: "shared" },
  guidebook:               { label: "Guidebook",            kind: "form", scope: "shared" },
  property_setup:          { label: "Property Setup",       kind: "form", scope: "property" },
  block_dates_calendar:    { label: "Block Dates",          kind: "form", scope: "property" },
  onboarding_inspection:   { label: "Onboarding Inspection",kind: "form", scope: "property" },
  property_offboarding:    { label: "Offboarding",          kind: "form", scope: "property" },
  paid_onboarding_fee:     { label: "Onboarding Fee",       kind: "form", scope: "owner" },
};

/** Column grouping order: signatures first, then forms. */
export const KIND_ORDER: RequirementKind[] = ["signature", "form"];

export const KIND_LABEL: Record<RequirementKind, string> = {
  signature: "Signatures",
  form: "Forms",
};

/**
 * Returns the config for a req_key, or a safe default for unknown keys.
 * Unknown keys log a warning at runtime and default to form/owner.
 */
export function configFor(reqKey: string): RequirementConfig {
  const cfg = REQUIREMENT_CONFIG[reqKey];
  if (cfg) return cfg;
  console.warn(`[status-board] Unknown req_key: "${reqKey}" — defaulting to form/owner`);
  return {
    label: humanizeKey(reqKey),
    kind: "form",
    scope: "owner",
  };
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
