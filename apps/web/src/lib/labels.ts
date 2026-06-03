/**
 * Shared display labels for enum-style fields. Keeping these in one
 * place means every page renders the same human-friendly text and
 * adding a new value (e.g. a new booking source) is a one-line edit.
 */

export const propertyTypeLabels: Record<string, string> = {
  str: "Short term",
  ltr: "Long term",
  arbitrage: "Arbitrage",
  mtr: "Mid term",
  "co-hosting": "Co-hosting",
};

export const propertyTypeLongLabels: Record<string, string> = {
  str: "Short term rental",
  ltr: "Long term rental",
  arbitrage: "Arbitrage",
  mtr: "Mid term rental",
  "co-hosting": "Co-hosting",
};

/**
 * Physical building type. Distinct from propertyType (which is the rental
 * business model). Ordered by expected frequency in the portfolio so the
 * dropdown feels natural: most common types at the top.
 */
export const homeTypeLabels: Record<string, string> = {
  single_family: "Single-family home",
  apartment: "Apartment",
  condo: "Condominium",
  townhouse: "Townhouse",
  duplex: "Duplex",
  multi_family: "Multi-family home",
  adu: "ADU",
  studio: "Studio",
  loft: "Loft",
  cabin: "Cabin",
  tiny_home: "Tiny home",
  mobile_home: "Mobile home",
  other: "Other",
};

/** Ordered list of home_type slugs for building form dropdowns. */
export const homeTypeOptions: Array<{ value: string; label: string }> =
  Object.entries(homeTypeLabels).map(([value, label]) => ({ value, label }));

/**
 * Maps Hospitable's `property_type` enum (which mirrors Airbnb's taxonomy)
 * onto Proxy's `home_type` enum. Used by the reconciliation layer to
 * detect when a Proxy row and a Hospitable listing describe the same
 * building with different labels.
 *
 * Hospitable / Airbnb do NOT have concepts for duplex, multi-family, or
 * ADU, so those Proxy types have no inbound match. In the reconciler a
 * missing mapping is treated as "semantically different taxonomies" and
 * surfaced as a warning rather than a hard mismatch.
 */
export const HOSPITABLE_TYPE_TO_HOME_TYPE: Record<string, string> = {
  house: "single_family",
  apartment: "apartment",
  condominium: "condo",
  condo: "condo",
  townhouse: "townhouse",
  townhome: "townhouse",
  cabin: "cabin",
  loft: "loft",
  studio: "studio",
  tiny_home: "tiny_home",
  tiny_house: "tiny_home",
  mobile_home: "mobile_home",
  bungalow: "single_family",
  cottage: "single_family",
  villa: "single_family",
  other: "other",
};

export const bookingSourceLabels: Record<string, string> = {
  direct: "Direct",
  airbnb: "Airbnb",
  vrbo: "Vrbo",
  booking_com: "Booking.com",
  furnished_finder: "Furnished Finder",
  hospitable: "Hospitable",
  other: "Other",
};

export const bookingStatusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  cancelled: "Cancelled",
};

/**
 * Block request status labels. The DB enum is
 * `pending | approved | declined | cancelled` for historical reasons,
 * but the user-facing language is softened because this is the owner's
 * own home. Johan is not "approving" or "declining" a block, he's
 * verifying it against existing bookings and confirming the dates are
 * clear. Copy reflects that reality.
 */
export type BlockRequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled";

export const blockStatusLabels: Record<BlockRequestStatus, string> = {
  pending: "Under review",
  approved: "Confirmed",
  declined: "Conflict found",
  cancelled: "Cancelled",
};

export function labelForBlockStatus(status: string): string {
  return (
    blockStatusLabels[status as BlockRequestStatus] ?? "Under review"
  );
}

/**
 * Visual tokens (background + foreground + optional dot color) for each
 * block request status. Centralized so every list, pill, and badge in
 * the portal and admin renders the same colorway.
 */
export const blockStatusVisual: Record<
  BlockRequestStatus,
  { bg: string; fg: string; dot: string }
> = {
  pending: {
    bg: "rgba(245, 158, 11, 0.14)",
    fg: "#b45309",
    dot: "#f59e0b",
  },
  approved: {
    bg: "rgba(22, 163, 74, 0.12)",
    fg: "#15803d",
    dot: "#22c55e",
  },
  declined: {
    bg: "rgba(220, 38, 38, 0.10)",
    fg: "#b91c1c",
    dot: "#ef4444",
  },
  cancelled: {
    bg: "rgba(100, 116, 139, 0.12)",
    fg: "#475569",
    dot: "#94a3b8",
  },
};
