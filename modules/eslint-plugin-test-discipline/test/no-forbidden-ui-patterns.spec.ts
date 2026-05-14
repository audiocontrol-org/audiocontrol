/**
 * Test the `no-forbidden-ui-patterns` rule against fixtures.
 *
 * Fixtures live as plain source strings inside this file — the rule
 * operates on AST nodes, so we don't need on-disk fixtures here. The
 * forbidden patterns must all be flagged; the allowed alternatives
 * (page.mouse.*, page.keyboard.*, getByRole) must produce zero errors.
 */
import { RuleTester } from '@typescript-eslint/utils/ts-eslint';
import { describe, it } from 'vitest';
import { noForbiddenUiPatterns } from '../src/rules/no-forbidden-ui-patterns';

const ruleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('no-forbidden-ui-patterns', () => {
  it('runs', () => {
    ruleTester.run('no-forbidden-ui-patterns', noForbiddenUiPatterns, {
      valid: [
        // Allowed: pointer-driven drag via page.mouse.*
        {
          code: `
            const slider = page.getByRole('slider', { name: 'Cutoff' });
            const box = await slider.boundingBox();
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + 80, box.y + box.height / 2);
            await page.mouse.up();
          `,
        },
        // Allowed: keyboard input after accessible focus
        {
          code: `
            const input = page.getByRole('textbox', { name: 'Patch name' });
            await input.focus();
            await page.keyboard.type('Strings');
          `,
        },
        // Allowed: locator.click() with options (e.g. coordinates)
        {
          code: `
            await page.getByRole('button', { name: 'Connect' }).click({ position: { x: 4, y: 4 } });
          `,
        },
        // Allowed: a string that happens to contain "data-test" outside the bracket prefix
        {
          code: `
            const description = 'this is not a data-test selector';
          `,
        },
      ],
      invalid: [
        {
          code: `await page.getByRole('textbox').fill('value');`,
          errors: [{ messageId: 'noFill' }],
        },
        {
          code: `element.value = 'new value';`,
          errors: [{ messageId: 'noValueAssign' }],
        },
        {
          code: `element.dispatchEvent(new Event('change'));`,
          errors: [{ messageId: 'noDispatchEvent' }],
        },
        {
          code: `element.click();`,
          errors: [{ messageId: 'noElementClick' }],
        },
        {
          code: `const x = page.getByTestId('cutoff-slider');`,
          errors: [{ messageId: 'noGetByTestId' }],
        },
        {
          code: `const x = page.locator('[data-testid="cutoff"]');`,
          errors: [{ messageId: 'noTestIdAttribute' }],
        },
        {
          code: `const x = page.locator('[data-test="cutoff"]');`,
          errors: [{ messageId: 'noTestAttribute' }],
        },
        {
          code: 'const x = page.locator(`[data-testid="cutoff"]`);',
          errors: [{ messageId: 'noTestIdAttribute' }],
        },
      ],
    });
  });
});
