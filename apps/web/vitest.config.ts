import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      "src/lib/admin/action-items/**/*.test.ts",
      "src/lib/organizations/**/*.test.ts",
    ],
    environment: "node",
  },
});
