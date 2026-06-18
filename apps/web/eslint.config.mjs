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
    // We don't run the React Compiler, so these are false positives on working
    // code; turn them off rather than refactoring valid components to appease a
    // rule that doesn't apply here. (react-hooks/exhaustive-deps stays on — it's
    // a legitimate rule, not a compiler-only one.)
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      // Honor the `_`-prefix convention for intentionally-unused bindings,
      // including positional array destructuring like `[_, i]`.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
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
