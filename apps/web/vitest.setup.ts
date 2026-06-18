import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest globals are disabled, so testing-library cannot self-register its
// afterEach cleanup. Without this, renders leak across tests.
afterEach(() => {
  cleanup();
});
