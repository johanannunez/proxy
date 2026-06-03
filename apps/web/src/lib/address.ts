/**
 * Shared address formatting utilities for the Proxy portal and admin.
 *
 * The DB stores address_line1 (street) and address_line2 (unit/apt — optional).
 * These helpers normalize and assemble them into consistent display strings
 * so that every surface across the app shows addresses the same way.
 */

type AddressParts = {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

/**
 * Shortens full street suffixes to their USPS-style abbreviations
 * (e.g. "Avenue" → "Ave", "Drive" → "Dr"). Only replaces the final token
 * of the string so directional words like "West" in "West 1st Place"
 * stay untouched.
 */
const STREET_SUFFIX_ABBREVIATIONS: Record<string, string> = {
  avenue: "Ave",
  boulevard: "Blvd",
  circle: "Cir",
  court: "Ct",
  drive: "Dr",
  highway: "Hwy",
  lane: "Ln",
  parkway: "Pkwy",
  place: "Pl",
  road: "Rd",
  square: "Sq",
  street: "St",
  terrace: "Ter",
  trail: "Trl",
};

export function shortenStreet(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(.+?)\s+([A-Za-z]+)$/);
  if (!match) return trimmed;
  const [, prefix, lastWord] = match;
  const abbr = STREET_SUFFIX_ABBREVIATIONS[lastWord.toLowerCase()];
  return abbr ? `${prefix} ${abbr}` : trimmed;
}

/**
 * Normalizes the unit field so bare identifiers like "B" become "Unit B"
 * while existing prefixes like "Apt 4", "Suite 200", "#12" pass through unchanged.
 */
export function normalizeUnit(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // Recognized prefixes — keep as-is (case-insensitive)
  if (/^(apt\.?|apartment|unit|suite|ste\.?|#|bldg\.?|building|floor|fl\.?|penthouse)\s*/i.test(s)) {
    return s;
  }
  // Bare value (e.g. "B", "4B", "204") — prefix with "Unit"
  return `Unit ${s}`;
}

/**
 * Returns the street-level display: "1431 Jadwin Avenue" or "1431 Jadwin Avenue, Unit B".
 * Does not include city, state, or ZIP. Use this for card headings where
 * city/state/zip are shown on a separate line.
 */
export function formatStreet(parts: Pick<AddressParts, "address_line1" | "address_line2">): string {
  const line1 = parts.address_line1?.trim() ?? "";
  const unit = parts.address_line2 ? normalizeUnit(parts.address_line2) : "";
  return [line1, unit].filter(Boolean).join(", ");
}

/**
 * Returns the full single-line address: "1431 Jadwin Avenue, Unit B, Richland, WA, 99352".
 * Use this in dropdowns, selectors, emails, and anywhere the entire address
 * must appear on one line.
 */
export function formatAddress(parts: AddressParts): string {
  const street = formatStreet(parts);
  const location = [parts.city?.trim(), parts.state?.trim(), parts.postal_code?.trim()]
    .filter(Boolean)
    .join(", ");
  return [street, location].filter(Boolean).join(", ");
}

/**
 * Convenience: returns the best single-line label for a property.
 * Uses the formatted address. Never falls back to a marketing name.
 */
export function propertyLabel(parts: AddressParts): string {
  return formatAddress(parts) || "Property";
}
