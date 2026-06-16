import { describe, it, expect } from "vitest";
import { pxToPt, matchComputedFontId } from "./text-style";

describe("pxToPt", () => {
  it("converts 11pt-equivalent px to 11pt", () => {
    expect(pxToPt("14.6667px")).toBe("11pt");
  });
  it("converts heading px to pt", () => {
    expect(pxToPt("22.6667px")).toBe("17pt");
  });
  it("handles plain numbers", () => {
    expect(pxToPt(16)).toBe("12pt");
  });
  it("returns empty string for a non-numeric value", () => {
    expect(pxToPt("normal")).toBe("");
  });
});

describe("matchComputedFontId", () => {
  it("matches an explicit web-font stack by googleFamily", () => {
    expect(matchComputedFontId("Montserrat, sans-serif")).toBe("montserrat");
  });
  it("matches the CSS heading font by label", () => {
    expect(matchComputedFontId("Arial, Helvetica, sans-serif")).toBe("arial");
  });
  it("matches the default body font", () => {
    expect(matchComputedFontId('Georgia, "Times New Roman", serif')).toBe("georgia");
  });
  it("returns empty string for an unknown family", () => {
    expect(matchComputedFontId("Comic Sans MS")).toBe("");
  });
});
