import { describe, expect, it } from "vitest";
import { RESERVED_ORG_SLUGS, isValidOrgSlug, normalizeOrgSlug } from "../slug";

describe("isValidOrgSlug", () => {
  it("accepts simple lowercase slugs", () => {
    expect(isValidOrgSlug("acme")).toBe(true);
    expect(isValidOrgSlug("blue-door-pm")).toBe(true);
    expect(isValidOrgSlug("a1b2")).toBe(true);
  });

  it("requires at least 3 characters", () => {
    expect(isValidOrgSlug("ab")).toBe(false);
    expect(isValidOrgSlug("a")).toBe(false);
    expect(isValidOrgSlug("")).toBe(false);
    expect(isValidOrgSlug("abc")).toBe(true);
  });

  it("caps slugs at 32 characters", () => {
    expect(isValidOrgSlug("a".repeat(32))).toBe(true);
    expect(isValidOrgSlug("a".repeat(33))).toBe(false);
  });

  it("rejects uppercase, spaces, and symbols", () => {
    expect(isValidOrgSlug("Acme")).toBe(false);
    expect(isValidOrgSlug("acme inc")).toBe(false);
    expect(isValidOrgSlug("acme_inc")).toBe(false);
    expect(isValidOrgSlug("acme.inc")).toBe(false);
  });

  it("rejects leading or trailing hyphens", () => {
    expect(isValidOrgSlug("-acme")).toBe(false);
    expect(isValidOrgSlug("acme-")).toBe(false);
  });

  it("rejects reserved slugs regardless of format validity", () => {
    for (const reserved of RESERVED_ORG_SLUGS) {
      expect(isValidOrgSlug(reserved), reserved).toBe(false);
    }
  });
});

describe("normalizeOrgSlug", () => {
  it("lowercases and converts spaces to hyphens", () => {
    expect(normalizeOrgSlug("Blue Door PM")).toBe("blue-door-pm");
  });

  it("strips characters that can never appear in a slug", () => {
    expect(normalizeOrgSlug("Acme, Inc.")).toBe("acme-inc");
  });

  it("collapses repeated separators and trims edge hyphens", () => {
    expect(normalizeOrgSlug("--acme   property--group--")).toBe(
      "acme-property-group",
    );
  });

  it("truncates to the 32 character cap", () => {
    expect(normalizeOrgSlug("x".repeat(50))).toHaveLength(32);
  });
});
