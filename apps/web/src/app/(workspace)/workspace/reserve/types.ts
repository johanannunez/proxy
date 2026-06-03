/**
 * Shared types for the portal Reserve surface. Kept in a standalone
 * file so the form, the live summary, the my-reservations list, and
 * the detail modal can all share the same shape without circular
 * imports.
 */

export type BlockRequestStatus =
  | "pending"
  | "approved"
  | "declined"
  | "cancelled";

export type BlockRequest = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  status: BlockRequestStatus;
  note: string | null;
  created_at: string;
  check_in_time: string | null;
  check_out_time: string | null;
  reason: string | null;
  is_owner_staying: boolean;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  adults: number;
  children: number;
  pets: number;
  needs_lock_code: boolean;
  requested_lock_code: string | null;
  wants_cleaning: boolean;
  cleaning_fee: number | null;
  damage_acknowledged: boolean;
};

export type ReserveProperty = {
  id: string;
  /** Street address only (no unit). E.g. "524 Sycamore Avenue". */
  name: string;
  /** Normalized unit string, e.g. "Unit A". Null if no unit. */
  unit: string | null;
  /** City, state, ZIP. E.g. "Pasco, WA, 99301". */
  address: string;
  bedrooms: number | null;
  /**
   * Whether pets are allowed at this home. Null if the owner has not
   * set it in property_rules yet. When false we surface a warning if
   * the reservation includes pets. When null or true, no warning.
   */
  petsAllowed: boolean | null;
  /**
   * The owner's configured cleaning fee (from property_rules). If null
   * we fall back to the bedroom-count heuristic.
   */
  cleaningFee: number | null;
  /**
   * Owner's configured pet fee surcharge (from property_rules). If
   * null we fall back to a flat default pet surcharge when pets are
   * part of the reservation and cleaning is scheduled.
   */
  petFee: number | null;
};
