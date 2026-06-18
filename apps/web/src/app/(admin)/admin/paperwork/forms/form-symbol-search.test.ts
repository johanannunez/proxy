import { describe, expect, it } from "vitest";
import {
  buildSuggestionContext,
  searchFormSymbols,
  suggestFormSymbols,
} from "./form-symbol-search";
import { resolveFormAppearance } from "./form-icon";

describe("form symbol search", () => {
  it("resolves legacy and namespaced icon values", () => {
    expect(
      resolveFormAppearance({ id: "form-1", icon: "wifi", icon_color: "blue" }).kind,
    ).toBe("icon");
    expect(
      resolveFormAppearance({ id: "form-1", icon: "icon:wifi", icon_color: "blue" })
        .symbolValue,
    ).toBe("icon:wifi");
  });

  it("resolves emoji codepoint values", () => {
    const resolved = resolveFormAppearance({
      id: "form-1",
      icon: "emoji:1f4f6",
      icon_color: "blue",
    });

    expect(resolved.kind).toBe("emoji");
    expect(resolved.emoji).toBe("📶");
  });

  it("resolves exact hex accent colors", () => {
    const resolved = resolveFormAppearance({
      id: "form-1",
      icon: "icon:wifi",
      icon_color: "#0EA5E9",
    });

    expect(resolved.fg).toBe("#0ea5e9");
    expect(resolved.bg).toBe("rgba(14, 165, 233, 0.13)");
  });

  it("searches aliases and keywords", () => {
    const results = searchFormSymbols("wifi password");
    const wifiResults = searchFormSymbols("wifi");

    expect(wifiResults[0]?.value).toBe("icon:wifi");
    expect(results.some((entry) => entry.value === "icon:wifi")).toBe(true);
    expect(results.some((entry) => entry.value === "emoji:1f4f6")).toBe(true);
  });

  it("keeps WiFi suggestions sparse and high confidence", () => {
    const context = buildSuggestionContext({
      name: "WiFi Information",
      description: null,
      fields: [
        { id: "name", type: "short_text", label: "Network Name (SSID)" },
        { id: "password", type: "short_text", label: "Password" },
        { id: "router", type: "short_text", label: "Router" },
      ],
    });

    const suggestions = suggestFormSymbols(context, 8);
    const values = suggestions.map((entry) => entry.symbol.value);

    expect(values.length).toBeGreaterThan(0);
    expect(values.length).toBeLessThanOrEqual(4);
    expect(values[0]).toBe("icon:wifi");
    expect(values).toContain("icon:wifi");
    expect(values).toContain("icon:key");
    expect(values).toContain("icon:password");
    expect(values).not.toContain("icon:wrench");
    expect(values).not.toContain("emoji:1f527");
  });
});
