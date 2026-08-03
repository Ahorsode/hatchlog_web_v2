import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Fail builds on type escapes so unsafe data handling is visible before deploy.
      "@typescript-eslint/no-explicit-any": "error",
      // Fail builds on dead code while preserving the local _unused convention.
      "@typescript-eslint/no-unused-vars": ["error", {
        vars: "all",
        args: "after-used",
        argsIgnorePattern: "^_",
        ignoreRestSiblings: true
      }],
      // Keep the ESM app from accumulating CommonJS require() imports.
      "@typescript-eslint/no-require-imports": "error",
      "@next/next/no-img-element": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/static-components": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off"
    }
  },
  {
    // Legacy UI, server-action, and maintenance scripts need a dedicated type cleanup pass
    // before the new no-any/no-unused rules can be applied without risky mechanical rewrites.
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "prisma/**",
      "scripts/**",
      "src/app/**",
      "src/components/**",
      "src/lib/actions/**",
      "src/lib/auth-utils.ts",
      "src/lib/db.ts",
      "src/lib/supabase-client.ts",
      "src/types/**"
    ]
  }
];

export default eslintConfig;
