// Fixture-only ESLint flat config. Plugins resolve from fixtures/node_modules.
// Each fixture file uses an /* eslint */ comment to enable the rule(s) under test.
// Run via: npx eslint -c fixtures/eslint.fixture.config.js fixtures/<RULE>.tsx
const path = require("node:path");

const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const jsxA11yPlugin = require("eslint-plugin-jsx-a11y");
const importPlugin = require("eslint-plugin-import");
const tailwindcssPlugin = require("eslint-plugin-tailwindcss");
const noOnlyTestsPlugin = require("eslint-plugin-no-only-tests");

module.exports = [
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
      tailwindcss: {
        config: path.join(__dirname, "..", "tailwind.config.ts"),
      },
    },
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      import: importPlugin,
      tailwindcss: tailwindcssPlugin,
      "@typescript-eslint": tsPlugin,
      "no-only-tests": noOnlyTestsPlugin,
    },
    rules: {},
  },
];
