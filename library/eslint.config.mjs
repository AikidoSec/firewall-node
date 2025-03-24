import { defineConfig } from "eslint/config";
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  {
    ignores: ["**/*.d.ts"],
  },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        Atomics: "readonly",
        SharedArrayBuffer: "readonly",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "no-warning-comments": "error",
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      "func-names": ["error", "as-needed"],
      camelcase: "error",
      "max-classes-per-file": ["error", 1],
      "no-console": "error",
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ArrowFunctionExpression > BlockStatement > ExpressionStatement Identifier[name='arguments']",
          message: "Avoid using 'arguments' in arrow functions.",
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
  // Only for test files
  {
    files: ["**/*.test.ts", "**/*.tests.ts"],
    rules: {
      "max-lines-per-function": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);
