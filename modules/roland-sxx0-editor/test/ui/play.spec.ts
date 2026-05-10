/**
 * Play page -- simulated MIDI harness.
 *
 * Mounting the page triggers an effect that runs:
 *
 *   loadPatchBank(0).then(() => loadFunctionParams())
 *
 * `loadPatchBank(0)` issues 8 per-patch round trips
 * (`patchesPerBank = 8`). `loadFunctionParams` then sends a single
 * `requestFunctionParameters()` SysEx to read the multi-mode
 * configuration.
 *
 * Fixture: `s330/play-init.ndjson` (172 records, 3.6s capture against
 * real S-550 on Volt 4 -- captured 2026-05-10). Bytes are S-550 device
 * behavior; filed under `s330/` because `useMidiStore` is hardcoded
 * to `getMidiStore('s330')` -- see tones.spec.ts header for context.
 *
 * Matches the page's startup sequence exactly, so the pageerror
 * listener surfaces ALL errors without filtering.
 *
 * Phase 0 #404 follow-up shipped: this spec un-skipped 2026-05-10.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/play?midi=simulated&scenario=play-init';

test.describe('Play -- simulated harness', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(() => {
    expect(pageErrors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('renders Play heading against the fixture', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
  });

  test('shows 8 MIDI parts (A-H) with channel + patch + output + level controls', async ({ page }) => {
    // PlayPage hard-codes 8 parts (the comment at PlayPage.tsx:4 calls them
    // A-H). For each part, the page renders four data-testid'd controls:
    // part-N-channel, part-N-patch, part-N-output, part-N-level.
    // The first row settles after auto-connect + bank load + functionParams.
    await expect(page.getByTestId('part-0-channel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid^="part-0-"]')).toHaveCount(4);
    await expect(page.locator('[data-testid^="part-7-"]')).toHaveCount(4);

    // No 9th part — PlayPage caps at 8.
    await expect(page.getByTestId('part-8-channel')).toHaveCount(0);
  });

  test('part-0 patch selector populated from function parameters', async ({ page }) => {
    // `requestFunctionParameters()` returns a MultiPartConfig[] that
    // populates each part's patchIndex. The exact value depends on the
    // captured S-550 multi-mode state, but the control must be present
    // and enabled (not the disconnected placeholder).
    await expect(page.getByTestId('part-0-patch')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('part-0-patch')).toBeEnabled();
  });
});
