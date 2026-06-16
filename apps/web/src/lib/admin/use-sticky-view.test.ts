// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { readStickyView, writeStickyView } from "./use-sticky-view";

// The test environment's global localStorage is unreliable (Node experimental
// Web Storage shadows jsdom's), so install a clean in-memory store on window.
beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
});

describe("readStickyView / writeStickyView", () => {
  it("falls back to the default when nothing is stored", () => {
    expect(readStickyView("signatures", "cards")).toBe("cards");
  });

  it("returns a stored valid value", () => {
    writeStickyView("signatures", "list");
    expect(readStickyView("signatures", "cards")).toBe("list");
  });

  it("ignores an invalid stored value", () => {
    window.localStorage.setItem("paperwork.view.signatures", "garbage");
    expect(readStickyView("signatures", "cards")).toBe("cards");
  });

  it("scopes by hub key", () => {
    writeStickyView("forms", "list");
    expect(readStickyView("forms", "cards")).toBe("list");
    expect(readStickyView("signatures", "cards")).toBe("cards");
  });
});
