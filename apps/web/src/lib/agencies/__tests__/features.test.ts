import { describe, expect, it } from "vitest";
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  hasFeature,
  type PlanFeature,
} from "../features";
import type { AgencyPlanTier } from "@/types/agencies";

const ALL_TIERS: AgencyPlanTier[] = ["starter", "pro", "white_label"];

const ALL_FEATURES: PlanFeature[] = [
  "conditional_forms",
  "automated_reminders",
  "bulk_operations",
  "team_members",
  "custom_subdomain",
  "white_label",
  "template_marketplace_publish",
  "advanced_analytics",
];

describe("PLAN_FEATURES", () => {
  it("defines every feature for every tier", () => {
    for (const tier of ALL_TIERS) {
      for (const feature of ALL_FEATURES) {
        expect(
          typeof PLAN_FEATURES[tier][feature],
          `${tier}.${feature} should be boolean`,
        ).toBe("boolean");
      }
    }
  });

  it("starter cannot use conditional forms", () => {
    expect(hasFeature("starter", "conditional_forms")).toBe(false);
  });

  it("pro can use conditional forms", () => {
    expect(hasFeature("pro", "conditional_forms")).toBe(true);
  });

  it("starter has no paid features", () => {
    for (const feature of ALL_FEATURES) {
      expect(hasFeature("starter", feature), `starter.${feature}`).toBe(false);
    }
  });

  it("pro unlocks everything except white-label surfaces", () => {
    expect(hasFeature("pro", "automated_reminders")).toBe(true);
    expect(hasFeature("pro", "bulk_operations")).toBe(true);
    expect(hasFeature("pro", "team_members")).toBe(true);
    expect(hasFeature("pro", "template_marketplace_publish")).toBe(true);
    expect(hasFeature("pro", "advanced_analytics")).toBe(true);
    expect(hasFeature("pro", "custom_subdomain")).toBe(false);
    expect(hasFeature("pro", "white_label")).toBe(false);
  });

  it("white_label unlocks every feature", () => {
    for (const feature of ALL_FEATURES) {
      expect(hasFeature("white_label", feature), `white_label.${feature}`).toBe(
        true,
      );
    }
  });

  it("plan power is monotonic: pro never loses a starter feature, white_label never loses a pro feature", () => {
    for (const feature of ALL_FEATURES) {
      if (hasFeature("starter", feature)) {
        expect(hasFeature("pro", feature), `pro downgraded ${feature}`).toBe(true);
      }
      if (hasFeature("pro", feature)) {
        expect(
          hasFeature("white_label", feature),
          `white_label downgraded ${feature}`,
        ).toBe(true);
      }
    }
  });
});

describe("PLAN_LIMITS", () => {
  it("starter caps workspaces at 10 with a single member", () => {
    expect(PLAN_LIMITS.starter.max_workspaces).toBe(10);
    expect(PLAN_LIMITS.starter.max_members).toBe(1);
  });

  it("pro has unlimited workspaces and up to 5 members", () => {
    expect(PLAN_LIMITS.pro.max_workspaces).toBe(-1);
    expect(PLAN_LIMITS.pro.max_members).toBe(5);
  });

  it("white_label is unlimited across the board", () => {
    expect(PLAN_LIMITS.white_label.max_workspaces).toBe(-1);
    expect(PLAN_LIMITS.white_label.max_members).toBe(-1);
    expect(PLAN_LIMITS.white_label.max_forms).toBe(-1);
    expect(PLAN_LIMITS.white_label.max_templates).toBe(-1);
  });
});
