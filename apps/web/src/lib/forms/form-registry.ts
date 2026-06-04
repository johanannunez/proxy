/**
 * Canonical form-field registry — the single source of truth for every
 * question in every property form.
 *
 * This file is CLIENT-SAFE (no "server-only"). It is imported by:
 *   - the shared <DocumentView> presentation (admin + portal),
 *   - the generic save server action (lib/forms/save-form.ts),
 *   - the admin Documents hub completion dashboard.
 *
 * The registry is authoritative for DISPLAY (showing every question, filled
 * or not) and for the GENERIC editor. The existing bespoke setup forms
 * (setup_basic, setup_access) keep their own Zod schemas for now; their
 * field `key`s are transcribed here verbatim so the two stay in sync.
 *
 * CONTRACT: every FieldDef.key MUST equal the key written into
 * property_forms.data by the corresponding form, and the FormData input name.
 */

import type { PropertyFormKey } from "@/lib/admin/documents-hub-shared";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "tel"
  | "email"
  | "date"
  | "radio"
  | "select";

export type FieldDef = {
  /** Matches property_forms.data[key] AND the FormData field name. */
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** "Why we ask" microcopy shown under the field. */
  help?: string;
  /** Gate codes, passwords — masked in read mode, mono-spaced for copy. */
  sensitive?: boolean;
  /** Drives completion math. If a form has any required fields, only those
   *  count toward "total"; otherwise every field counts. */
  required?: boolean;
  /** For radio / select. */
  options?: string[];
  /** Mirrors the z.string().max(500) convention in existing actions. */
  maxLength?: number;
};

export type FormSection = {
  key: string;
  title: string;
  description?: string;
  fields: FieldDef[];
};

export type FormDef = {
  /** The property_forms.form_key this definition describes. */
  formKey: PropertyFormKey;
  label: string;
  description?: string;
  /** Existing portal data-entry route, if one exists. */
  route?: string;
  sections: FormSection[];
};

const DEFAULT_MAX = 500;

/* ─────────────────────────────────────────────────────────────────────────
 * Form definitions
 * ──────────────────────────────────────────────────────────────────────── */

export const FORM_REGISTRY: Record<PropertyFormKey, FormDef> = {
  /* ── Setup: Basic info (bespoke form exists) ── */
  setup_basic: {
    formKey: "setup_basic",
    label: "Basic info",
    description: "Core facts about the home — size, capacity, and layout.",
    route: "/portal/setup/setup-basic",
    sections: [
      {
        key: "basics",
        title: "Property basics",
        fields: [
          { key: "property_type", label: "Property type", type: "select", options: ["House", "Condo", "Townhouse", "Apartment", "Cabin", "Other"], placeholder: "Select a type" },
          { key: "year_built", label: "Year built", type: "text", placeholder: "e.g. 1998" },
          { key: "sqft", label: "Square footage", type: "text", placeholder: "e.g. 2400" },
          { key: "has_adu", label: "Has ADU / guest unit?", type: "radio", options: ["Yes", "No"] },
        ],
      },
      {
        key: "capacity",
        title: "Capacity & layout",
        fields: [
          { key: "bedrooms", label: "Bedrooms", type: "text", placeholder: "e.g. 4" },
          { key: "bathrooms", label: "Bathrooms", type: "text", placeholder: "e.g. 2.5" },
          { key: "max_guests", label: "Max guests", type: "text", placeholder: "e.g. 8" },
          { key: "bed_count", label: "Total beds", type: "text", placeholder: "e.g. 5" },
          { key: "arrangements", label: "Bed arrangements", type: "textarea", placeholder: "e.g. Primary: King · Bedroom 2: Queen · Bedroom 3: 2 Twins" },
        ],
      },
    ],
  },

  /* ── Setup: Access & entry (bespoke form exists) ── */
  setup_access: {
    formKey: "setup_access",
    label: "Access & entry",
    description: "How guests and the team get into the property.",
    route: "/portal/setup/setup-access",
    sections: [
      {
        key: "primary_entry",
        title: "Primary entry",
        fields: [
          { key: "entry_method", label: "Primary entry method", type: "radio", options: ["Smart lock", "Lockbox", "Key pickup"] },
          { key: "smart_lock_brand", label: "Smart lock brand", type: "text", placeholder: "e.g. Schlage Encode, August, Kwikset, Yale" },
          { key: "admin_access_shared", label: "Admin access shared with hello@theparcelco.com", type: "radio", options: ["Yes", "No"] },
          { key: "backup_key_location", label: "Backup key location", type: "text", placeholder: "e.g. Lockbox on side gate, code 4321" },
        ],
      },
      {
        key: "codes",
        title: "Codes and access",
        fields: [
          { key: "gate_code", label: "Gate code", type: "text", placeholder: "e.g. #1234", sensitive: true },
          { key: "garage_code", label: "Garage code", type: "text", placeholder: "e.g. 5678", sensitive: true },
          { key: "parking_pass_details", label: "Parking pass details", type: "text", placeholder: "e.g. 2 passes in kitchen drawer" },
        ],
      },
      {
        key: "entry_points",
        title: "Entry points",
        fields: [
          { key: "secondary_entry_points", label: "Secondary entry points", type: "textarea", placeholder: "Back door, side gate instructions..." },
          { key: "check_in_notes", label: "Guest check-in notes", type: "textarea", placeholder: "Step-by-step instructions for guests..." },
        ],
      },
    ],
  },

  /* ── Setup: Security system ── */
  setup_security: {
    formKey: "setup_security",
    label: "Security system",
    description: "Alarm panel, monitoring, and sensor details.",
    sections: [
      {
        key: "system",
        title: "Alarm system",
        fields: [
          { key: "has_security_system", label: "Has a security system?", type: "radio", options: ["Yes", "No"] },
          { key: "provider", label: "Provider / brand", type: "text", placeholder: "e.g. Ring, ADT, Brinks, SimpliSafe" },
          { key: "panel_location", label: "Panel location", type: "text", placeholder: "e.g. Entry hallway closet" },
          { key: "arm_disarm_code", label: "Arm / disarm code", type: "text", placeholder: "e.g. 0000", sensitive: true },
        ],
      },
      {
        key: "monitoring",
        title: "Monitoring",
        fields: [
          { key: "monitored", label: "Professionally monitored?", type: "radio", options: ["Yes", "No"] },
          { key: "monitoring_phone", label: "Monitoring company phone", type: "tel", placeholder: "e.g. (800) 555-0100" },
          { key: "sensor_notes", label: "Sensors & camera notes", type: "textarea", placeholder: "Door/window sensors, exterior cameras, what is and isn't recorded..." },
        ],
      },
    ],
  },

  /* ── Setup: Utilities & systems ── */
  setup_utilities: {
    formKey: "setup_utilities",
    label: "Utilities & systems",
    description: "Power, water, gas, HVAC, and safety equipment.",
    sections: [
      {
        key: "utilities",
        title: "Utilities",
        fields: [
          { key: "electric_provider", label: "Electric provider", type: "text", placeholder: "e.g. PG&E" },
          { key: "gas_provider", label: "Gas provider", type: "text", placeholder: "e.g. SoCalGas" },
          { key: "water_provider", label: "Water provider", type: "text" },
          { key: "trash_schedule", label: "Trash & recycling schedule", type: "textarea", placeholder: "e.g. Trash Tue, recycling every other Tue, bins on left of garage" },
        ],
      },
      {
        key: "systems",
        title: "Systems",
        fields: [
          { key: "breaker_panel_location", label: "Breaker panel location", type: "text", placeholder: "e.g. Garage, left wall" },
          { key: "water_shutoff_location", label: "Water shutoff location", type: "text" },
          { key: "hvac_notes", label: "HVAC & thermostat notes", type: "textarea", placeholder: "Thermostat brand, filter size & location, seasonal settings..." },
          { key: "water_heater_notes", label: "Water heater notes", type: "text", placeholder: "Location, type, age" },
        ],
      },
      {
        key: "safety",
        title: "Safety equipment",
        fields: [
          { key: "smoke_detectors", label: "Smoke detectors present?", type: "radio", options: ["Yes", "No"] },
          { key: "carbon_monoxide", label: "Carbon monoxide detectors present?", type: "radio", options: ["Yes", "No"] },
          { key: "fire_extinguisher_location", label: "Fire extinguisher location", type: "text" },
          { key: "first_aid_location", label: "First-aid kit location", type: "text" },
        ],
      },
    ],
  },

  /* ── Setup: Appliances ── */
  setup_appliances: {
    formKey: "setup_appliances",
    label: "Appliances",
    description: "Brands and quirks for the major appliances.",
    sections: [
      {
        key: "kitchen",
        title: "Kitchen",
        fields: [
          { key: "refrigerator", label: "Refrigerator brand", type: "text" },
          { key: "dishwasher", label: "Dishwasher brand", type: "text" },
          { key: "oven_range", label: "Oven / range brand", type: "text" },
          { key: "coffee_maker", label: "Coffee maker type", type: "text", placeholder: "e.g. Keurig, drip, espresso" },
        ],
      },
      {
        key: "laundry",
        title: "Laundry",
        fields: [
          { key: "washer", label: "Washer brand", type: "text" },
          { key: "dryer", label: "Dryer brand", type: "text" },
          { key: "appliance_notes", label: "Appliance quirks & instructions", type: "textarea", placeholder: "Anything finicky a guest or cleaner should know..." },
        ],
      },
    ],
  },

  /* ── Setup: Emergency contacts ── */
  setup_contacts: {
    formKey: "setup_contacts",
    label: "Emergency contacts",
    description: "Trusted vendors and local emergency info.",
    sections: [
      {
        key: "vendors",
        title: "Vendors",
        fields: [
          { key: "plumber", label: "Plumber", type: "text", placeholder: "Name & phone" },
          { key: "electrician", label: "Electrician", type: "text", placeholder: "Name & phone" },
          { key: "hvac_tech", label: "HVAC technician", type: "text", placeholder: "Name & phone" },
          { key: "handyman", label: "Handyman", type: "text", placeholder: "Name & phone" },
          { key: "pest_control", label: "Pest control", type: "text", placeholder: "Name & phone" },
        ],
      },
      {
        key: "local",
        title: "Local & emergency",
        fields: [
          { key: "nearest_hospital", label: "Nearest hospital", type: "text", placeholder: "Name & address" },
          { key: "hoa_contact", label: "HOA contact", type: "text", placeholder: "Name & phone" },
          { key: "other_contacts", label: "Other contacts", type: "textarea" },
        ],
      },
    ],
  },

  /* ── Setup: Tech & connectivity (Wi-Fi lives here) ── */
  setup_tech: {
    formKey: "setup_tech",
    label: "Tech & connectivity",
    description: "Wi-Fi, smart-home devices, and entertainment.",
    sections: [
      {
        key: "wifi",
        title: "Wi-Fi",
        fields: [
          { key: "wifi_ssid", label: "Network name (SSID)", type: "text", placeholder: "e.g. Parcel-Guest" },
          { key: "wifi_password", label: "Wi-Fi password", type: "text", sensitive: true },
          { key: "wifi_router_location", label: "Router location", type: "text", placeholder: "e.g. Office closet" },
          { key: "isp", label: "Internet provider", type: "text", placeholder: "e.g. Xfinity, AT&T Fiber" },
        ],
      },
      {
        key: "smart_home",
        title: "Smart home & entertainment",
        fields: [
          { key: "thermostat", label: "Smart thermostat", type: "text", placeholder: "e.g. Nest, Ecobee" },
          { key: "doorbell", label: "Video doorbell", type: "text", placeholder: "e.g. Ring" },
          { key: "noise_monitor", label: "Noise monitor", type: "text", placeholder: "e.g. Minut, NoiseAware" },
          { key: "tv_streaming", label: "TV & streaming notes", type: "textarea", placeholder: "Which apps are signed in, remotes, etc." },
        ],
      },
    ],
  },

  /* ── Setup: House rules ── */
  setup_house_rules: {
    formKey: "setup_house_rules",
    label: "House rules",
    description: "Policies guests must follow.",
    sections: [
      {
        key: "policies",
        title: "Policies",
        fields: [
          { key: "pets_allowed", label: "Pets allowed?", type: "radio", options: ["Yes", "No", "On request"] },
          { key: "smoking_allowed", label: "Smoking allowed?", type: "radio", options: ["Yes", "No"] },
          { key: "events_allowed", label: "Events / parties allowed?", type: "radio", options: ["Yes", "No"] },
          { key: "max_occupancy", label: "Max occupancy", type: "text", placeholder: "e.g. 8" },
        ],
      },
      {
        key: "timing",
        title: "Timing & quiet hours",
        fields: [
          { key: "quiet_hours", label: "Quiet hours", type: "text", placeholder: "e.g. 10pm – 8am" },
          { key: "min_stay", label: "Minimum stay", type: "text", placeholder: "e.g. 2 nights" },
          { key: "pool_hours", label: "Pool / amenity hours", type: "text" },
          { key: "additional_rules", label: "Additional rules", type: "textarea" },
        ],
      },
    ],
  },

  /* ── Setup: Outdoor amenities ── */
  setup_amenities: {
    formKey: "setup_amenities",
    label: "Outdoor amenities",
    description: "Pool, hot tub, and outdoor features.",
    sections: [
      {
        key: "amenities",
        title: "Amenities",
        fields: [
          { key: "pool", label: "Pool", type: "radio", options: ["Yes", "No"] },
          { key: "hot_tub", label: "Hot tub", type: "radio", options: ["Yes", "No"] },
          { key: "bbq_grill", label: "BBQ / grill", type: "text", placeholder: "Type & fuel (propane, charcoal)" },
          { key: "fire_pit", label: "Fire pit", type: "radio", options: ["Yes", "No"] },
          { key: "sauna", label: "Sauna", type: "radio", options: ["Yes", "No"] },
        ],
      },
      {
        key: "service",
        title: "Service & maintenance",
        fields: [
          { key: "pool_service", label: "Pool / spa service", type: "text", placeholder: "Company & schedule" },
          { key: "propane_service", label: "Propane refill details", type: "text" },
          { key: "amenity_notes", label: "Amenity notes", type: "textarea" },
        ],
      },
    ],
  },

  /* ── Setup: Listing setup ── */
  setup_listing: {
    formKey: "setup_listing",
    label: "Listing setup",
    description: "Photography, staging, and owner restrictions.",
    sections: [
      {
        key: "listing",
        title: "Listing prep",
        fields: [
          { key: "photography_status", label: "Photography status", type: "select", options: ["Not started", "Scheduled", "Complete"] },
          { key: "staging_notes", label: "Staging notes", type: "textarea", placeholder: "What's provided, what needs adding..." },
          { key: "personal_items", label: "Owner personal items on site", type: "textarea", placeholder: "Items to remove or leave" },
          { key: "restricted_areas", label: "Restricted / off-limits areas", type: "textarea", placeholder: "Owner closet, garage, etc." },
        ],
      },
    ],
  },

  /* ── Setup: Communication preferences ── */
  setup_communication: {
    formKey: "setup_communication",
    label: "Communication preferences",
    description: "How and when to reach the owner.",
    sections: [
      {
        key: "prefs",
        title: "Preferences",
        fields: [
          { key: "preferred_method", label: "Preferred contact method", type: "radio", options: ["Text", "Call", "Email"] },
          { key: "booking_notifications", label: "Wants booking notifications?", type: "radio", options: ["Yes", "No"] },
          { key: "best_hours", label: "Best hours to reach you", type: "text", placeholder: "e.g. Weekdays 9am–5pm PT" },
          { key: "comm_notes", label: "Other preferences", type: "textarea" },
        ],
      },
    ],
  },

  /* ── Guidebook ── */
  guidebook: {
    formKey: "guidebook",
    label: "Guidebook",
    description: "Local recommendations for the guest guidebook.",
    sections: [
      {
        key: "recs",
        title: "Recommendations",
        fields: [
          { key: "dining", label: "Restaurants & dining", type: "textarea", placeholder: "Favorite spots nearby" },
          { key: "activities", label: "Activities & attractions", type: "textarea" },
          { key: "groceries", label: "Groceries & essentials", type: "textarea", placeholder: "Nearest store, pharmacy" },
          { key: "host_tips", label: "Host tips", type: "textarea", placeholder: "Insider knowledge guests love" },
        ],
      },
    ],
  },

  /* ── STR permit ── */
  str_permit: {
    formKey: "str_permit",
    label: "STR permit",
    description: "Short-term rental permit or license details.",
    route: "/portal/setup/str-permit",
    sections: [
      {
        key: "permit",
        title: "Permit",
        fields: [
          { key: "market", label: "Market / city", type: "text", placeholder: "e.g. City of San Diego" },
          { key: "permit_required", label: "Is a permit required?", type: "radio", options: ["Yes", "No", "Not sure"] },
          { key: "permit_number", label: "Permit number", type: "text", placeholder: "e.g. STR-2024-00123" },
          { key: "issuing_authority", label: "Issuing authority", type: "text" },
          { key: "expiration_date", label: "Expiration date", type: "date" },
        ],
      },
    ],
  },

  /* ── HOA info ── */
  hoa_info: {
    formKey: "hoa_info",
    label: "HOA information",
    description: "Homeowners association rules and contacts.",
    route: "/portal/setup/hoa-info",
    sections: [
      {
        key: "hoa",
        title: "HOA",
        fields: [
          { key: "has_hoa", label: "Is there an HOA?", type: "radio", options: ["Yes", "No"] },
          { key: "hoa_name", label: "HOA name", type: "text" },
          { key: "management_company", label: "Management company", type: "text" },
          { key: "contact_phone", label: "HOA contact phone", type: "tel" },
          { key: "str_allowed", label: "Are STRs allowed by the HOA?", type: "radio", options: ["Yes", "No", "Not sure"] },
          { key: "restrictions", label: "Relevant restrictions", type: "textarea", placeholder: "Quiet hours, parking, amenity rules from CC&Rs" },
        ],
      },
    ],
  },

  /* ── Insurance certificate ── */
  insurance_certificate: {
    formKey: "insurance_certificate",
    label: "Insurance certificate",
    description: "Short-term rental or homeowners insurance policy.",
    route: "/portal/setup/insurance-certificate",
    sections: [
      {
        key: "policy",
        title: "Policy",
        fields: [
          { key: "carrier_name", label: "Carrier", type: "text", placeholder: "e.g. Proper, Steadily, State Farm" },
          { key: "policy_type", label: "Policy type", type: "select", options: ["Homeowners", "Short-term rental", "Commercial", "Other"] },
          { key: "policy_number", label: "Policy number", type: "text" },
          { key: "liability_coverage", label: "Liability coverage amount", type: "text", placeholder: "e.g. $1,000,000" },
          { key: "expiration_date", label: "Expiration date", type: "date" },
        ],
      },
    ],
  },

  /* ── Platform authorization ── */
  platform_authorization: {
    formKey: "platform_authorization",
    label: "Platform access",
    description: "OTA account access and co-host authorization.",
    route: "/portal/setup/platform-authorization",
    sections: [
      {
        key: "airbnb",
        title: "Airbnb",
        fields: [
          { key: "airbnb_listed", label: "Listed on Airbnb?", type: "radio", options: ["Yes", "No"] },
          { key: "airbnb_cohost", label: "Co-host access granted?", type: "radio", options: ["Yes", "No"] },
          { key: "airbnb_listing_url", label: "Airbnb listing URL", type: "text" },
        ],
      },
      {
        key: "vrbo",
        title: "Vrbo & others",
        fields: [
          { key: "vrbo_listed", label: "Listed on Vrbo?", type: "radio", options: ["Yes", "No"] },
          { key: "vrbo_cohost", label: "Vrbo access granted?", type: "radio", options: ["Yes", "No"] },
          { key: "other_platforms", label: "Other platforms", type: "textarea", placeholder: "Booking.com, Furnished Finder, direct site..." },
        ],
      },
    ],
  },

  /* ── Onboarding inspection ── */
  onboarding_inspection: {
    formKey: "onboarding_inspection",
    label: "Onboarding inspection",
    description: "Room-by-room condition report at onboarding.",
    sections: [
      {
        key: "inspection",
        title: "Inspection",
        fields: [
          { key: "inspection_date", label: "Inspection date", type: "date" },
          { key: "inspector_name", label: "Inspector", type: "text" },
          { key: "overall_condition", label: "Overall condition", type: "select", options: ["Excellent", "Good", "Fair", "Needs work"] },
          { key: "issues_found", label: "Issues found", type: "textarea", placeholder: "Damage, missing items, repairs needed" },
          { key: "inventory_notes", label: "Appliance & inventory notes", type: "textarea" },
        ],
      },
    ],
  },

  /* ── Property offboarding ── */
  property_offboarding: {
    formKey: "property_offboarding",
    label: "Offboarding",
    description: "Transition checklist when an owner gives notice.",
    sections: [
      {
        key: "offboarding",
        title: "Transition",
        fields: [
          { key: "notice_date", label: "Notice date", type: "date" },
          { key: "end_date", label: "Management end date", type: "date" },
          { key: "reason", label: "Reason for offboarding", type: "textarea" },
          { key: "final_payout", label: "Final payout amount", type: "text" },
          { key: "offboarding_notes", label: "Handover notes", type: "textarea", placeholder: "Future bookings, deposits, key return..." },
        ],
      },
    ],
  },
};

/* ─────────────────────────────────────────────────────────────────────────
 * Pure helpers (client-safe)
 * ──────────────────────────────────────────────────────────────────────── */

export function getFormDef(key: PropertyFormKey): FormDef | undefined {
  return FORM_REGISTRY[key];
}

/** Every field across all sections of a form. */
export function allFields(def: FormDef): FieldDef[] {
  return def.sections.flatMap((s) => s.fields);
}

/** Every field key across all sections — useful for validation allow-lists. */
export function allFieldKeys(def: FormDef): string[] {
  return allFields(def).map((f) => f.key);
}

/** The configured max length for a field, defaulting to DEFAULT_MAX. */
export function fieldMaxLength(field: FieldDef): number {
  return field.maxLength ?? DEFAULT_MAX;
}

function isFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export type FormCompletion = {
  filled: number;
  total: number;
  pct: number;
  /** True when every required field is filled (or, if none required, when all are). */
  requiredMet: boolean;
};

/**
 * Completion across a form. If the form has any required fields, "total"
 * counts only required fields; otherwise it counts every field. Mirrors the
 * sections-complete / total ratio style used in documents-hub.ts.
 */
export function computeFormCompletion(
  def: FormDef,
  data: Record<string, unknown> | null | undefined,
): FormCompletion {
  const fields = allFields(def);
  const required = fields.filter((f) => f.required);
  const counted = required.length > 0 ? required : fields;
  const d = data ?? {};
  const filled = counted.filter((f) => isFilled(d[f.key])).length;
  const total = counted.length || 1;
  const pct = Math.round((filled / total) * 100);
  return { filled, total: counted.length, pct, requiredMet: filled === counted.length };
}

export type MergedField = FieldDef & {
  section: string;
  sectionTitle: string;
  value: string | null;
};

/**
 * Merge saved answers over the registry. Returns EVERY field — blanks come
 * back with `value: null`. This is what powers the "see all questions,
 * filled or not" requirement.
 */
export function mergeDataOverRegistry(
  def: FormDef,
  data: Record<string, unknown> | null | undefined,
): MergedField[] {
  const d = data ?? {};
  return def.sections.flatMap((section) =>
    section.fields.map((field) => {
      const raw = d[field.key];
      let value: string | null = null;
      if (isFilled(raw)) {
        value = Array.isArray(raw) ? raw.map(String).join(", ") : String(raw);
      }
      return { ...field, section: section.key, sectionTitle: section.title, value };
    }),
  );
}
