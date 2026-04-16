// @ts-check
import tseslint from 'typescript-eslint';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/',
      'coverage/',
      '.angular/',
      '.dagger/',
      'node_modules/',
      'public/mockServiceWorker.js',
    ],
  },

  // TypeScript files
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      '@angular-eslint': angular,
    },
    processor: angularTemplate.processors['extract-inline-html'],
    rules: {
      ...angular.configs.recommended.rules,
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'kp', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'kp', style: 'camelCase' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Intentional: components wrap native events (e.g. `close = output()`)
      '@angular-eslint/no-output-native': 'off',
    },
  },

  // Test files: relax rules for standard Vitest mocking patterns
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Inline Angular templates
  {
    files: ['**/*.html'],
    plugins: {
      '@angular-eslint/template': angularTemplate,
    },
    languageOptions: {
      parser: angularTemplateParser,
    },
    rules: {
      ...angularTemplate.configs.recommended.rules,
    },
  },

  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
);
