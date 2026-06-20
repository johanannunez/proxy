import { describe, it, expect } from "vitest";
import { resolvePlatformGateDest } from "../gate";

describe("resolvePlatformGateDest (super-admin wall)", () => {
  it("lets a superadmin through (null = no redirect)", () => {
    expect(resolvePlatformGateDest({ role: "admin", platform_role: "superadmin" })).toBeNull();
    expect(resolvePlatformGateDest({ role: "owner", platform_role: "superadmin" })).toBeNull();
  });

  it("bounces an agency admin to /admin", () => {
    expect(resolvePlatformGateDest({ role: "admin", platform_role: null })).toBe("/admin");
  });

  it("bounces an owner (and any other non-superadmin) to /workspace/home", () => {
    expect(resolvePlatformGateDest({ role: "owner", platform_role: null })).toBe("/workspace/home");
    expect(resolvePlatformGateDest({ role: "compliance", platform_role: null })).toBe("/workspace/home");
  });

  it("treats only platform_role='superadmin' as the wall key (support/finance do NOT pass)", () => {
    expect(resolvePlatformGateDest({ role: "admin", platform_role: "support" })).toBe("/admin");
    expect(resolvePlatformGateDest({ role: "owner", platform_role: "finance" })).toBe("/workspace/home");
    expect(resolvePlatformGateDest({ role: "admin", platform_role: "compliance" })).toBe("/admin");
  });

  it("fails closed: a missing or unreadable profile is bounced, never allowed in", () => {
    expect(resolvePlatformGateDest(null)).toBe("/workspace/home");
    expect(resolvePlatformGateDest({ role: null, platform_role: null })).toBe("/workspace/home");
  });
});
