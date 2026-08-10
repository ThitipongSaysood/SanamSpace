import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React-Compiler-era rule that flags legitimate client-only patterns as
      // errors: hydrating state from localStorage in a client component (a lazy
      // useState initialiser would run during SSR where `window` is undefined),
      // and resetting a form when the selected row changes. These are correct
      // here, so keep them visible as warnings rather than failing the build.
      // Real bugs still error via the other react-hooks rules.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
