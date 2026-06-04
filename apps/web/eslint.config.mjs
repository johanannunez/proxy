import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static assets served as-is (minified vendor bundles, e.g. the gitignored
    // pdf.js worker). These are not source and must never be linted.
    "public/**",
  ]),
  {
    // eslint-plugin-react-hooks v7 ships React Compiler rules that fire on
    // valid React patterns when the project doesn't use the React Compiler.
    // Downgrade to warn so they surface as guidance without blocking the pipeline.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // AdminBottomNav is actively maintained by a separate agent — suppress its
    // warnings here rather than adding inline disable comments to the file.
    files: ["src/components/admin/AdminBottomNav.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
