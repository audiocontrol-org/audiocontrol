/**
 * Test the `no-internal-imports` rule against fixtures.
 */
import { RuleTester } from '@typescript-eslint/utils/ts-eslint';
import { describe, it } from 'vitest';
import { noInternalImports } from '../src/rules/no-internal-imports';

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('no-internal-imports', () => {
  it('runs', () => {
    ruleTester.run('no-internal-imports', noInternalImports, {
      valid: [
        {
          code: `import { stuff } from '@audiocontrol/editor-core';`,
        },
        {
          code: `import { stuff } from '../src/index.js';`,
        },
        {
          code: `import { stuff } from '@/components/Slider.js';`,
        },
        {
          code: `const m = await import('./util.js');`,
        },
      ],
      invalid: [
        {
          code: `import { x } from '@audiocontrol/editor-core/src/internal/something.js';`,
          errors: [{ messageId: 'noInternalImport' }],
        },
        {
          code: `import { x } from '../../src/internal/state.js';`,
          errors: [{ messageId: 'noInternalImport' }],
        },
        {
          code: `import { x } from '@audiocontrol/foo/src/private/keys.js';`,
          errors: [{ messageId: 'noPrivateImport' }],
        },
        {
          code: `const m = await import('@audiocontrol/foo/src/internal/state.js');`,
          errors: [{ messageId: 'noInternalImport' }],
        },
      ],
    });
  });
});
