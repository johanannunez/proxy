export type SetupStepEntry = {
  stepKey: string;
  label: string;
  keywords: string[];
  href: string;
  track: "property" | "owner";
  group: string;
  estimateMinutes: number;
  /** True when the portal route does not exist yet. Filtered out of all active consumers. */
  disabled?: true;
};

export const setupSearchIndex: SetupStepEntry[] = [
  // ── Property Setup ──────────────────────────────────────
  // Group: Getting started
  {
    stepKey: "agreement-preview",
    label: "Agreement preview",
    keywords: [
      "agreement", "contract", "host agreement", "terms", "commission",
      "management", "preview", "summary", "legal",
    ],
    href: "/workspace/setup/agreement-preview",
    track: "property",
    group: "Getting started",
    estimateMinutes: 3,
  },
  {
    stepKey: "basics",
    label: "The basics",
    keywords: [
      "basics", "nickname", "property type", "launch date", "rental type",
      "short term", "long term", "arbitrage", "co-hosting", "name",
    ],
    href: "/workspace/setup/basics",
    track: "property",
    group: "Getting started",
    estimateMinutes: 3,
  },
  {
    stepKey: "address",
    label: "Address",
    keywords: [
      "address", "street", "city", "state", "zip", "postal code", "location",
      "map", "unit", "apartment", "geolocation",
    ],
    href: "/workspace/setup/address",
    track: "property",
    group: "Getting started",
    estimateMinutes: 2,
  },

  // Group: Your home
  {
    stepKey: "space",
    label: "Space and capacity",
    keywords: [
      "space", "capacity", "sqft", "square feet", "bedrooms", "beds",
      "bathrooms", "guests", "max guests", "bed arrangement", "king",
      "queen", "twin", "bunk", "sofa bed", "sleeps",
    ],
    href: "/workspace/setup/space",
    track: "property",
    group: "Your home",
    estimateMinutes: 4,
  },
  {
    stepKey: "amenities",
    label: "Amenities",
    keywords: [
      "amenities", "essentials", "kitchen", "laundry", "entertainment",
      "outdoor", "pool", "hot tub", "wifi", "parking", "safety",
      "accessibility", "family", "sports", "recreation", "gym",
      "washer", "dryer", "coffee", "tv", "grill",
    ],
    href: "/workspace/setup/amenities",
    track: "property",
    group: "Your home",
    estimateMinutes: 5,
  },
  {
    stepKey: "rules",
    label: "House rules and access",
    keywords: [
      "rules", "house rules", "pets", "pet policy", "smoking", "events",
      "quiet hours", "check-in", "check-out", "lockbox", "gate code",
      "backup key", "access", "keys", "instructions", "parking",
    ],
    href: "/workspace/setup/rules",
    track: "property",
    group: "Your home",
    estimateMinutes: 4,
  },
  {
    stepKey: "wifi",
    label: "Wi-Fi and tech",
    keywords: [
      "wifi", "wi-fi", "ssid", "password", "router", "modem", "internet",
      "provider", "isp", "network name", "network", "tech", "account",
      "billing",
    ],
    href: "/workspace/setup/wifi",
    track: "property",
    group: "Your home",
    estimateMinutes: 3,
  },

  // Group: Finishing touches
  {
    stepKey: "financial",
    label: "Financial baseline",
    keywords: [
      "financial", "income", "revenue", "budget", "furnishing", "goal",
      "red line", "minimum", "target", "go live", "ready", "money",
    ],
    href: "/workspace/setup/financial",
    track: "property",
    group: "Finishing touches",
    estimateMinutes: 3,
  },
  {
    stepKey: "recommendations",
    label: "Local recommendations",
    keywords: [
      "recommendations", "guidebook", "local", "restaurants", "places",
      "spots", "tips", "neighborhood", "area", "attractions",
    ],
    href: "/workspace/setup/recommendations",
    track: "property",
    group: "Finishing touches",
    estimateMinutes: 5,
  },
  {
    stepKey: "cleaning",
    label: "Your cleaning team",
    keywords: [
      "cleaning", "cleaner", "housekeeping", "turnover", "byoc",
      "bring your own", "team", "schedule", "emergency",
    ],
    href: "/workspace/setup/cleaning",
    track: "property",
    group: "Finishing touches",
    estimateMinutes: 3,
  },
  {
    stepKey: "photos",
    label: "Photos",
    keywords: [
      "photos", "images", "gallery", "hero", "upload", "pictures",
      "photography", "listing photos",
    ],
    href: "/workspace/setup/photos",
    track: "property",
    group: "Finishing touches",
    estimateMinutes: 5,
  },
  {
    stepKey: "compliance",
    label: "Compliance",
    keywords: [
      "compliance", "permit", "str permit", "hoa", "insurance",
      "certificate", "license", "regulation", "zoning",
    ],
    href: "/workspace/setup/compliance",
    track: "property",
    group: "Finishing touches",
    estimateMinutes: 3,
  },

  // Group: Go live
  {
    stepKey: "host-agreement",
    label: "Host agreement signing",
    keywords: [
      "host agreement", "sign", "e-sign", "boldsign", "signature",
      "contract", "legal", "document",
    ],
    href: "/workspace/setup/host-agreement",
    track: "property",
    group: "Go live",
    estimateMinutes: 5,
  },
  {
    stepKey: "review",
    label: "Review and submit",
    keywords: [
      "review", "submit", "final", "launch", "go live", "summary",
      "checklist", "confirmation",
    ],
    href: "/workspace/setup/review",
    track: "property",
    group: "Go live",
    estimateMinutes: 3,
  },

  // ── Property Data (saves to property_forms table) ───────
  // Group: Property data — disabled: true until Phase 2 portal routes are built
  {
    stepKey: "setup_basic",
    label: "Basic info",
    keywords: [
      "basic", "basics", "bedrooms", "bathrooms", "bed arrangements", "max guests",
      "sqft", "square feet", "property type", "year built", "adu",
    ],
    href: "/workspace/setup/setup-basic",
    track: "property",
    group: "Property data",
    estimateMinutes: 4,
    disabled: true,
  },
  {
    stepKey: "setup_access",
    label: "Access and entry",
    keywords: [
      "access", "entry", "smart lock", "lockbox", "key", "backup key",
      "gate code", "garage code", "parking pass", "check-in", "schlage", "august",
    ],
    href: "/workspace/setup/setup-access",
    track: "property",
    group: "Property data",
    estimateMinutes: 4,
    disabled: true,
  },
  {
    stepKey: "setup_security",
    label: "Security system",
    keywords: [
      "security", "alarm", "system", "panel", "arm", "disarm", "code",
      "monitoring", "sensors", "battery", "ring", "adt", "brinks",
    ],
    href: "/workspace/setup/setup-security",
    track: "property",
    group: "Property data",
    estimateMinutes: 3,
    disabled: true,
  },
  {
    stepKey: "setup_utilities",
    label: "Utilities and systems",
    keywords: [
      "utilities", "electric", "gas", "water", "trash", "recycling",
      "breaker", "panel", "hvac", "filter", "water heater", "smoke detector",
      "carbon monoxide", "fire extinguisher", "first aid",
    ],
    href: "/workspace/setup/setup-utilities",
    track: "property",
    group: "Property data",
    estimateMinutes: 6,
    disabled: true,
  },
  {
    stepKey: "setup_appliances",
    label: "Appliances",
    keywords: [
      "appliances", "washer", "dryer", "dishwasher", "refrigerator",
      "coffee maker", "laundry", "kitchen", "brand",
    ],
    href: "/workspace/setup/setup-appliances",
    track: "property",
    group: "Property data",
    estimateMinutes: 4,
    disabled: true,
  },
  {
    stepKey: "setup_contacts",
    label: "Emergency contacts",
    keywords: [
      "contacts", "emergency", "plumber", "hvac", "electrician", "handyman",
      "pest control", "hospital", "hoa", "vendor", "contractor",
    ],
    href: "/workspace/setup/setup-contacts",
    track: "property",
    group: "Property data",
    estimateMinutes: 5,
    disabled: true,
  },
  {
    stepKey: "setup_tech",
    label: "Tech and connectivity",
    keywords: [
      "tech", "wifi", "wi-fi", "ssid", "password", "router", "doorbell",
      "thermostat", "noise monitor", "tv", "television", "smart home",
      "nest", "ecobee", "ring", "minut",
    ],
    href: "/workspace/setup/setup-tech",
    track: "property",
    group: "Property data",
    estimateMinutes: 5,
    disabled: true,
  },
  {
    stepKey: "setup_house_rules",
    label: "House rules",
    keywords: [
      "house rules", "rules", "pets", "smoking", "events", "parties",
      "noise curfew", "max occupancy", "min stay", "parking", "pool hours",
    ],
    href: "/workspace/setup/setup-house-rules",
    track: "property",
    group: "Property data",
    estimateMinutes: 5,
    disabled: true,
  },
  {
    stepKey: "setup_amenities",
    label: "Outdoor amenities",
    keywords: [
      "amenities", "pool", "hot tub", "bbq", "grill", "fire pit",
      "outdoor shower", "sauna", "propane", "chemical service",
    ],
    href: "/workspace/setup/setup-amenities",
    track: "property",
    group: "Property data",
    estimateMinutes: 4,
    disabled: true,
  },
  {
    stepKey: "setup_listing",
    label: "Listing setup",
    keywords: [
      "listing", "photography", "photos", "staging", "personal items",
      "restricted areas", "off limits", "valuables", "secure",
    ],
    href: "/workspace/setup/setup-listing",
    track: "property",
    group: "Property data",
    estimateMinutes: 3,
    disabled: true,
  },
  {
    stepKey: "setup_communication",
    label: "Communication preferences",
    keywords: [
      "communication", "contact", "text", "call", "email", "notifications",
      "booking", "preference", "availability", "hours",
    ],
    href: "/workspace/setup/setup-communication",
    track: "property",
    group: "Property data",
    estimateMinutes: 2,
    disabled: true,
  },

  // Group: Compliance
  {
    stepKey: "str_permit",
    label: "STR permit",
    keywords: ["str permit", "permit", "short-term rental license", "license", "city permit", "vacation rental permit", "permit number", "expiration"],
    href: "/workspace/setup/str-permit",
    track: "property",
    group: "Compliance",
    estimateMinutes: 3,
  },
  {
    stepKey: "hoa_info",
    label: "HOA information",
    keywords: ["hoa", "homeowners association", "hoa contact", "str allowed", "hoa restrictions", "management company", "cc&rs"],
    href: "/workspace/setup/hoa-info",
    track: "property",
    group: "Compliance",
    estimateMinutes: 3,
  },
  {
    stepKey: "insurance_certificate",
    label: "Insurance certificate",
    keywords: ["insurance", "certificate", "carrier", "policy", "liability", "homeowners insurance", "vacation rental insurance", "coverage"],
    href: "/workspace/setup/insurance-certificate",
    track: "property",
    group: "Compliance",
    estimateMinutes: 3,
  },
  {
    stepKey: "platform_authorization",
    label: "Platform authorization",
    keywords: ["platform", "airbnb", "vrbo", "booking.com", "furnished finder", "co-host", "account access", "listing platform", "ota"],
    href: "/workspace/setup/platform-authorization",
    track: "property",
    group: "Compliance",
    estimateMinutes: 4,
  },

  // ── Owner Essentials ────────────────────────────────────
  // Group: About you
  {
    stepKey: "account",
    label: "Your account",
    keywords: [
      "account", "name", "phone", "mailing address", "contact",
      "personal", "profile",
    ],
    href: "/workspace/setup/account",
    track: "owner",
    group: "About you",
    estimateMinutes: 2,
  },
  {
    stepKey: "identity",
    label: "Identity verification",
    keywords: [
      "identity", "verification", "id", "drivers license", "driver license",
      "kyc", "photo id", "government id",
    ],
    href: "/workspace/setup/identity",
    track: "owner",
    group: "About you",
    estimateMinutes: 3,
  },

  // Group: Payments and tax
  {
    stepKey: "w9",
    label: "Tax form (W-9)",
    keywords: [
      "w9", "w-9", "tax", "tax form", "irs", "tin", "ssn", "ein",
      "taxpayer",
    ],
    href: "/workspace/setup/w9",
    track: "owner",
    group: "Payments and tax",
    estimateMinutes: 5,
  },
  {
    stepKey: "payout",
    label: "Payout method",
    keywords: [
      "payout", "payment", "ach", "bank", "direct deposit", "card",
      "authorization", "bank account", "routing number",
    ],
    href: "/workspace/setup/payout",
    track: "owner",
    group: "Payments and tax",
    estimateMinutes: 5,
  },
];

/**
 * Get the next incomplete step for a given track.
 * completedKeys: set of step keys already completed.
 */
export function getNextIncompleteStep(
  track: "property" | "owner",
  completedKeys: Set<string>,
): SetupStepEntry | null {
  const trackSteps = setupSearchIndex.filter((s) => s.track === track);
  return trackSteps.find((s) => !completedKeys.has(s.stepKey)) ?? null;
}

/**
 * Group steps by their group header for rendering.
 */
export function groupStepsByGroup(
  track: "property" | "owner",
): { group: string; steps: SetupStepEntry[] }[] {
  const trackSteps = setupSearchIndex.filter((s) => s.track === track);
  const groups: { group: string; steps: SetupStepEntry[] }[] = [];
  let current: { group: string; steps: SetupStepEntry[] } | null = null;

  for (const step of trackSteps) {
    if (!current || current.group !== step.group) {
      current = { group: step.group, steps: [] };
      groups.push(current);
    }
    current.steps.push(step);
  }

  return groups;
}

export const activeSetupSearchIndex = setupSearchIndex.filter((e) => !e.disabled);
