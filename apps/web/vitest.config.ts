import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      "src/**/*.test.ts",
      "src/components/**/__tests__/**/*.test.{ts,tsx}",
      "src/app/**/__tests__/**/*.test.{ts,tsx}",
    ],
    // Component tests opt into jsdom via a `// @vitest-environment jsdom`
    // docblock; lib tests stay on node.
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
