// eslint.config.js — flat config for ESLint v9+ (backend)

const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // Ignore build/output folders
  { ignores: ["node_modules/**", "coverage/**", "dist/**"] },

  // Base JS rules
  js.configs.recommended,

  // Project rules (no `env:` in flat config — use `languageOptions.globals`)
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "commonjs",
      globals: {
        // Node globals
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        console: "readonly",

        // Jest globals
        describe: "readonly",
        test: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        jest: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },

  // Turn off rules that conflict with Prettier
  prettier,
];