module.exports = {
  env: {
    browser: false,
    es6: true,
    node: true,
  },
  extends: [
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
  ],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/ban-ts-comment": [
      "error",
      { "ts-expect-error": "allow-with-description" },
    ],
    "import/no-unused-modules": ["warn", { unusedExports: true }],
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
  },
  overrides: [
    {
      files: "*test.ts",
      rules: {
        "max-lines-per-function": "off",
      },
    },
    {
      files: "**/agent/hooks/instrumentation/*.ts",
      rules: {
        "no-warning-comments": "off",
      },
    },
  ],
};
