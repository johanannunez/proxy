import { describe, it, expect } from "vitest";
import { shadeStepForColumns } from "./column-shade";

const cols = [
  { reqKey: "a", kind: "signature" },
  { reqKey: "b", kind: "signature" },
  { reqKey: "c", kind: "form" },
  { reqKey: "d", kind: "signature" },
  { reqKey: "e", kind: "form" },
] as const;

describe("shadeStepForColumns", () => {
  it("alternates per kind, independent of the other kind", () => {
    expect(cols.map((c) => shadeStepForColumns(cols, c.reqKey))).toEqual([0, 1, 0, 0, 1]);
  });

  it("recomputes when a column is removed (pins change the pattern)", () => {
    // Drop the first signature; b becomes the kind's first column → step 0.
    const pinned = cols.filter((c) => c.reqKey !== "a");
    expect(shadeStepForColumns(pinned, "b")).toBe(0);
    expect(shadeStepForColumns(pinned, "d")).toBe(1);
  });

  it("returns 0 for an unknown column", () => {
    expect(shadeStepForColumns([], "missing")).toBe(0);
  });
});
