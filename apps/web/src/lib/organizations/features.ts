import type { OrgPlanTier } from "@/types/organizations";

/**
 * Plan-tier feature flags (Sub-phase B3).
 *
 * Pure module: safe to import from server code, client components, and
 * middleware. Gate any plan-dependent UI or server behavior through
 * `hasFeature(tier, feature)` instead of comparing tier strings inline, so
 * the tier-to-capability mapping lives in exactly one place.
 */

export type PlanFeature =
  | "conditional_forms"
  | "automated_reminders"
  | "bulk_operations"
  | "team_members"
  | "custom_subdomain"
  | "white_label"
  | "template_marketplace_publish"
  | "advanced_analytics";

export const PLAN_FEATURES: Record<OrgPlanTier, Record<PlanFeature, boolean>> = {
  starter: {
    conditional_forms: false,
    automated_reminders: false,
    bulk_operations: false,
    team_members: false,
    custom_subdomain: false,
    white_label: false,
    template_marketplace_publish: false,
    advanced_analytics: false,
  },
  pro: {
    conditional_forms: true,
    automated_reminders: true,
    bulk_operations: true,
    team_members: true,
    custom_subdomain: false,
    white_label: false,
    template_marketplace_publish: true,
    advanced_analytics: true,
  },
  white_label: {
    conditional_forms: true,
    automated_reminders: true,
    bulk_operations: true,
    team_members: true,
    custom_subdomain: true,
    white_label: true,
    template_marketplace_publish: true,
    advanced_analytics: true,
  },
};

export function hasFeature(tier: OrgPlanTier, feature: PlanFeature): boolean {
  return PLAN_FEATURES[tier][feature] ?? false;
}

/**
 * Plan limits seeded into `organization_settings.limits` at signup.
 * `-1` means unlimited, matching the OrganizationSettings type contract.
 */
export const PLAN_LIMITS: Record<
  OrgPlanTier,
  {
    max_workspaces: number;
    max_members: number;
    max_forms: number;
    max_templates: number;
  }
> = {
  starter: {
    max_workspaces: 10,
    max_members: 1,
    max_forms: 5,
    max_templates: 3,
  },
  pro: {
    max_workspaces: -1,
    max_members: 5,
    max_forms: -1,
    max_templates: -1,
  },
  white_label: {
    max_workspaces: -1,
    max_members: -1,
    max_forms: -1,
    max_templates: -1,
  },
};
