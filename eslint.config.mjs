import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/node_modules/**",
      ".myjarbis/**",
      "docs/**",
      "**/.expo/**",
      "**/dist-e2e/**",
      "apps/e2e/test-results/**",
      "apps/e2e/playwright-report/**",
      "apps/mobile/public/**",
      "apps/mobile/scripts/**",
      "**/expo-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      // Con noUncheckedIndexedAccess, `rows[0]!` después de un INSERT ... RETURNING es idiomático.
      "@typescript-eslint/no-non-null-assertion": "off",
      // Los módulos de NestJS son clases vacías con decorador.
      "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // En tests se valida la forma de respuestas JSON arbitrarias.
    files: ["**/test/**", "**/*.test.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  prettier,
);
