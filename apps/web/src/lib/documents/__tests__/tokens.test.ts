import { describe, expect, it } from "vitest";
import { resolveTokens, AVAILABLE_TOKENS } from "../tokens";

const FULL_CTX = {
  firstName: "Alex",
  ownerName: "Alex Rivera",
  property: "12 Bay St",
};

describe("resolveTokens", () => {
  it("resolves each known token", () => {
    expect(resolveTokens("Hi {{first_name}}", FULL_CTX)).toBe("Hi Alex");
    expect(resolveTokens("From {{owner_name}}", FULL_CTX)).toBe("From Alex Rivera");
    expect(resolveTokens("At {{property}}", FULL_CTX)).toBe("At 12 Bay St");
  });

  it("resolves multiple tokens in one string", () => {
    expect(
      resolveTokens("{{first_name}} at {{property}}", FULL_CTX),
    ).toBe("Alex at 12 Bay St");
  });

  it("preserves an unknown token", () => {
    expect(resolveTokens("Hello {{foo}}", FULL_CTX)).toBe("Hello {{foo}}");
  });

  it("preserves a known token when its ctx value is missing", () => {
    expect(resolveTokens("Hi {{first_name}}", {})).toBe("Hi {{first_name}}");
    expect(resolveTokens("Hi {{owner_name}}", { firstName: "Alex" })).toBe(
      "Hi {{owner_name}}",
    );
  });

  it("is case-insensitive on token names", () => {
    expect(resolveTokens("Hi {{First_Name}}", FULL_CTX)).toBe("Hi Alex");
    expect(resolveTokens("Hi {{OWNER_NAME}}", FULL_CTX)).toBe("Hi Alex Rivera");
  });

  it("tolerates optional spaces inside the braces", () => {
    expect(resolveTokens("Hi {{ first_name }}", FULL_CTX)).toBe("Hi Alex");
    expect(resolveTokens("Hi {{  owner_name  }}", FULL_CTX)).toBe(
      "Hi Alex Rivera",
    );
  });

  it("exposes AVAILABLE_TOKENS for the UI", () => {
    const tokens = AVAILABLE_TOKENS.map((t) => t.token);
    expect(tokens).toContain("{{first_name}}");
    expect(tokens).toContain("{{owner_name}}");
    expect(tokens).toContain("{{property}}");
    for (const entry of AVAILABLE_TOKENS) {
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });
});
