/**
 * The single source of truth for the onboarding wizard's data shape.
 * Every section reads and writes the same `WizardData` object, which
 * also gets persisted to localStorage so an owner can close the tab
 * and resume later.
 *
 * Fields here mirror what the database needs (and will need, after
 * the schema additions in /tmp/proxy-onboarding-schema.sql land).
 * Optional fields stay optional in the DB; required fields are marked
 * with the `required` helper inside each section component.
 */

export type WizardData = {
  // Section 1: Owner identity
  owner: {
    fullName: string;
    preferredName: string;
    phone: string;
    timezone: string;
    contactMethod: "email" | "sms" | "phone" | "whatsapp" | "";
    referralSource: string;
    yearsInvesting: string;
    propertyCount: string;
  };

  // Section 2: Property identity
  identity: {
    nickname: string;
    propertyType: "str" | "ltr" | "arbitrage" | "mtr" | "co-hosting" | "";
    propertySubtype: string;
    yearBuilt: string;
    yearPurchased: string;
    currentlyRented: "yes" | "no" | "";
    listedElsewhere: "yes" | "no" | "";
  };

  // Section 3: Address
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    neighborhood: string;
  };

  // Section 4: Specs
  specs: {
    bedrooms: string;
    bathrooms: string;
    halfBaths: string;
    squareFeet: string;
    guestCapacity: string;
    parkingSpaces: string;
    parkingType: "garage" | "driveway" | "street" | "lot" | "none" | "";
    yearStories: string;
  };

  // Section 5: Amenities (boolean checklist)
  amenities: {
    pool: boolean;
    hotTub: boolean;
    ac: boolean;
    heating: boolean;
    wifi: boolean;
    washerDryer: boolean;
    dishwasher: boolean;
    smartLock: boolean;
    workspace: boolean;
    grill: boolean;
    fencedYard: boolean;
    evCharger: boolean;
  };

  // Section 6: Rules & policies
  rules: {
    checkInTime: string;
    checkOutTime: string;
    minNights: string;
    maxNights: string;
    petsAllowed: "yes" | "no" | "";
    smokingAllowed: "no" | "outdoor" | "designated" | "";
    eventsAllowed: "yes" | "no" | "";
    childrenWelcome: "yes" | "no" | "";
  };

  // Section 7: Compliance & insurance
  compliance: {
    permitRequired: "yes" | "no" | "unsure" | "";
    permitNumber: string;
    permitExpires: string;
    insuranceCarrier: string;
    insurancePolicyNumber: string;
    insuranceExpires: string;
    hoaExists: "yes" | "no" | "";
    hoaAllowsStr: "yes" | "no" | "unsure" | "";
  };

  // Section 8: Notes & next steps
  notes: {
    cleanerName: string;
    cleanerPhone: string;
    handymanName: string;
    handymanPhone: string;
    teamNotes: string;
  };
};

export const EMPTY_WIZARD: WizardData = {
  owner: {
    fullName: "",
    preferredName: "",
    phone: "",
    timezone: "",
    contactMethod: "",
    referralSource: "",
    yearsInvesting: "",
    propertyCount: "",
  },
  identity: {
    nickname: "",
    propertyType: "",
    propertySubtype: "",
    yearBuilt: "",
    yearPurchased: "",
    currentlyRented: "",
    listedElsewhere: "",
  },
  address: {
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    neighborhood: "",
  },
  specs: {
    bedrooms: "",
    bathrooms: "",
    halfBaths: "",
    squareFeet: "",
    guestCapacity: "",
    parkingSpaces: "",
    parkingType: "",
    yearStories: "",
  },
  amenities: {
    pool: false,
    hotTub: false,
    ac: false,
    heating: false,
    wifi: false,
    washerDryer: false,
    dishwasher: false,
    smartLock: false,
    workspace: false,
    grill: false,
    fencedYard: false,
    evCharger: false,
  },
  rules: {
    checkInTime: "",
    checkOutTime: "",
    minNights: "",
    maxNights: "",
    petsAllowed: "",
    smokingAllowed: "",
    eventsAllowed: "",
    childrenWelcome: "",
  },
  compliance: {
    permitRequired: "",
    permitNumber: "",
    permitExpires: "",
    insuranceCarrier: "",
    insurancePolicyNumber: "",
    insuranceExpires: "",
    hoaExists: "",
    hoaAllowsStr: "",
  },
  notes: {
    cleanerName: "",
    cleanerPhone: "",
    handymanName: "",
    handymanPhone: "",
    teamNotes: "",
  },
};

export const SECTIONS = [
  { key: "welcome", label: "Welcome", icon: "Sparkle" },
  { key: "owner", label: "About you", icon: "UserCircle" },
  { key: "identity", label: "Property type", icon: "House" },
  { key: "address", label: "Address", icon: "MapPin" },
  { key: "specs", label: "The space", icon: "Ruler" },
  { key: "amenities", label: "Amenities", icon: "Sparkle" },
  { key: "rules", label: "House rules", icon: "ClipboardText" },
  { key: "compliance", label: "Compliance", icon: "ShieldCheck" },
  { key: "notes", label: "Your team", icon: "Users" },
  { key: "review", label: "Review", icon: "CheckCircle" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export const STORAGE_KEY = "proxy:onboarding:v2";
