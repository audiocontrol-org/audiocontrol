/**
 * @audiocontrol/eslint-plugin-test-discipline
 *
 * ESLint plugin enforcing Validity Claim A from
 * docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md §4.
 *
 * Rules:
 *   - no-forbidden-ui-patterns
 *   - no-internal-imports
 *
 * Apply via the root `.eslintrc.cjs` `overrides` block, scoped to the
 * Tier 2/3 canonical directories:
 *
 *   test/ui/contract/**
 *   test/ui/in-context/**
 *
 * Tier 1 specs under `test/wiring/` and the legacy `test/ui/capabilities/`
 * directory are NOT linted by this plugin — wiring-test shortcuts are
 * part of Tier 1's contract.
 */
import type { TSESLint } from '@typescript-eslint/utils';
import { noForbiddenUiPatterns } from './rules/no-forbidden-ui-patterns';
import { noInternalImports } from './rules/no-internal-imports';

export const rules: Record<string, TSESLint.RuleModule<string, unknown[]>> = {
  'no-forbidden-ui-patterns':
    noForbiddenUiPatterns as TSESLint.RuleModule<string, unknown[]>,
  'no-internal-imports':
    noInternalImports as TSESLint.RuleModule<string, unknown[]>,
};

export const configs = {
  recommended: {
    plugins: ['@audiocontrol/test-discipline'],
    rules: {
      '@audiocontrol/test-discipline/no-forbidden-ui-patterns': 'error',
      '@audiocontrol/test-discipline/no-internal-imports': 'error',
    },
  },
};

// Default export is the plugin shape ESLint expects (rules + configs).
const plugin = { rules, configs };
export default plugin;
