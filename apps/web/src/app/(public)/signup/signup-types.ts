import type { AgencyPlanTier } from "@/types/agencies";

/**
 * Client-safe types and display catalog for the signup flow (Sub-phase B3).
 * No server imports here: SignupFlow.tsx (a client component) imports from
 * this file, per the *-types.ts sibling convention.
 */

export type SignupStep = 1 | 2 | 3 | 4;

export type AccountDraft = {
  fullName: string;
  email: string;
  password: string;
};

export type CompanyDraft = {
  companyName: string;
  slug: string;
  industry: string;
};

export type SubdomainCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "invalid"; reason: string }
  | { state: "available" }
  | { state: "taken" };

export type CreateOrgResult = {
  orgId: string;
  requiresEmailConfirmation: boolean;
  error?: string;
};

export type CreateSubscriptionResult = {
  subscriptionId: string;
  clientSecret?: string;
  error?: string;
};

export type PlanCard = {
  tier: AgencyPlanTier;
  name: string;
  /** Monthly display price in dollars; null = free. Must match the Stripe price. */
  priceMonthly: number | null;
  tagline: string;
  features: string[];
  highlighted: boolean;
};

/**
 * Display catalog only. The amounts billed come from the Stripe prices
 * referenced by STRIPE_PRO_PRICE_ID / STRIPE_WHITE_LABEL_PRICE_ID; keep these
 * numbers in sync with the Stripe dashboard products.
 */
export const PLAN_CARDS: PlanCard[] = [
  {
    tier: "starter",
    name: "Starter",
    priceMonthly: null,
    tagline: "Everything you need to send your first documents.",
    features: [
      "Up to 10 client workspaces",
      "Unlimited signature requests",
      "Form builder with templates",
      "Your own Proxy subdomain",
      "Basic analytics",
    ],
    highlighted: false,
  },
  {
    tier: "pro",
    name: "Pro",
    priceMonthly: 49,
    tagline: "For teams running documents at scale.",
    features: [
      "Unlimited client workspaces",
      "Up to 5 team members",
      "Conditional logic on forms",
      "Automated reminders",
      "Bulk operations",
      "Publish to template marketplace",
      "Advanced analytics",
    ],
    highlighted: true,
  },
  {
    tier: "white_label",
    name: "White-label",
    priceMonthly: 199,
    tagline: "Your brand, your domain, our engine.",
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Your own custom domain",
      "Remove Proxy branding",
      "Custom email sending domain",
    ],
    highlighted: false,
  },
];

export const INDUSTRY_OPTIONS = [
  { value: "property_management", label: "Property management" },
  { value: "real_estate", label: "Real estate brokerage" },
  { value: "vacation_rentals", label: "Vacation rentals" },
  { value: "home_services", label: "Home services" },
  { value: "legal", label: "Legal services" },
  { value: "accounting", label: "Accounting and tax" },
  { value: "other", label: "Something else" },
];

export const SIGNUP_STEPS: Array<{ id: SignupStep; label: string }> = [
  { id: 1, label: "Your account" },
  { id: 2, label: "Your company" },
  { id: 3, label: "Pick a plan" },
  { id: 4, label: "Payment" },
];
