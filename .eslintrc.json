// eslint.config.js — flat config for ESLint v9 (backend)
const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  // Ignore build/output folders
  { ignores: ['node_modules/**', 'coverage/**', 'dist/**'] },

  // Base JS rules
  js.configs.recommended,

  // Project rules
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs'
    },
    env: { node: true, es2021: true, jest: true },
    linterOptions: { reportUnusedDisableDirectives: true },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off'
    }
  },

  // Turn off rules that conflict with Prettier
  prettier
];