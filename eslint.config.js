'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/**', 'public/sites/**', 'coverage/**'],
  },

  js.configs.recommended,

  // Server-side CommonJS (includes the extensionless bin/www).
  {
    files: ['**/*.js', 'bin/www'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // Browser client.
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: { ...globals.browser, io: 'readonly' },
    },
  },

  // Jest tests.
  {
    files: ['__tests__/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },

  prettier,
];
