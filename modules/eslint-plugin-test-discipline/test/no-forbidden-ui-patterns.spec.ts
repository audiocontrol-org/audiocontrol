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
        // Allowed: locator.click() with a positional option-bag (pointer-positional
        // click is the spec's intended escape hatch for cases where page.mouse.*
        // is overkill). This MUST pass; the arity heuristic only forbids zero-arg.
        {
          code: `
            await page.getByRole('button', { name: 'Submit' }).click({ position: { x: 10, y: 10 } });
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
        // Pin the broad-policy heuristic: ANY `.value =` assignment, even on
        // a plainly non-DOM receiver like a local mock-state object, MUST
        // fire `noValueAssign`. The rule disables type-aware parsing on
        // purpose (parserOptions.project: null) so it cannot — and MUST not
        // try to — narrow on DOM types. The policy is intentionally broad:
        // every `.value =` in Tier 2/3 specs is forbidden because the rule
        // cannot tell mock-state assignments apart from element.value
        // assignments at AST-only time, and tolerating the former would
        // create a hole the latter slips through.
        {
          code: `
            const mockState = { value: 0 };
            mockState.value = 5;
          `,
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
        // Pin the arity heuristic: zero-arg `locator.click()` reads as a
        // synthetic-click call at AST time and MUST fire `noElementClick`.
        // Tier 2/3 specs drive clicks via `page.mouse.*` + position, or via
        // `locator.click({ position: ... })` (covered by a valid case above).
        // A bare `.click()` after an accessible query is exactly the path
        // the spec rejects — pointer engine doesn't run, hit-testing is
        // skipped, no overlay can be caught.
        {
          code: `await page.getByRole('button', { name: 'Submit' }).click();`,
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
