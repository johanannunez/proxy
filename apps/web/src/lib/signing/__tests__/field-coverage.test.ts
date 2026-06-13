import { describe, expect, it } from "vitest";
import { computeCoverage } from "../field-coverage";

describe("computeCoverage", () => {
  it("reports a missing role when a signer has no field", () => {
    expect(computeCoverage([{ role: "Proxy" }], ["Owner", "Proxy"])).toEqual({
      ready: false,
      missingRoles: ["Owner"],
    });
  });

  it("is ready when every signer role is covered", () => {
    expect(
      computeCoverage([{ role: "Owner" }, { role: "Proxy" }], ["Owner", "Proxy"]),
    ).toEqual({ ready: true, missingRoles: [] });
  });

  it("is not ready when there are no signer roles", () => {
    expect(computeCoverage([{ role: "Owner" }], [])).toEqual({
      ready: false,
      missingRoles: [],
    });
  });

  it("lists missing roles in signerRoles order", () => {
    expect(computeCoverage([], ["Owner", "Proxy"])).toEqual({
      ready: false,
      missingRoles: ["Owner", "Proxy"],
    });
  });
});
