/* eslint-disable import/no-unresolved */
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

/** @type {} */
export default [
  { files: ["**/*.{ts}"] },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        Atomics: "readonly",
        SharedArrayBuffer: "readonly",
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.errors,
  importPlugin.flatConfigs.warnings,
  importPlugin.flatConfigs.typescript,

  // As last plugin
  eslintPluginPrettierRecommended,

  // Change rules
  {
    rules: {
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description" },
      ],
      "import/no-unused-modules": "warn",
      "security/detect-object-injection": "off",
      "no-warning-comments": "error",
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true }],
      "func-names": ["error", "as-needed"],
      camelcase: "error",
      "max-classes-per-file": ["error", 1],
      "no-console": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ArrowFunctionExpression > BlockStatement > ExpressionStatement Identifier[name='arguments']",
          message: "Avoid using 'arguments' in arrow functions.",
        },
      ],
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-rest-params": "off",
    },
  },
  // Override rules for test files
  {
    files: ["**/*.test.ts"],
    rules: {
      "max-lines-per-function": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Override rules for test files
  {
    files: ["**/internals/*.js"],
    rules: {
      "pretter/prettier": "off",
    },
  },
  // Ignore generated js files
  {
    ignores: ["**/internals/*.js"],
  },
];
