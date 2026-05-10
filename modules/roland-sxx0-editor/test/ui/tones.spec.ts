/**
 * Tones page -- simulated MIDI harness.
 *
 * Mounting the page triggers `loadInitialData()` which calls
 * `loadToneBank(0)` directly (no patch preload). With
 * `tonesPerBank = 8`, the bank-0 load issues 8 per-tone round
 * trips against the device.
 *
 * Fixture: `s330/tones-bank-0.ndjson` (88 records, 1.8s capture against
 * real S-550 on Volt 4 -- captured 2026-05-10). The bytes ARE S-550
 * device behavior; the fixture is filed under `s330/` because the
 * editor's `useMidiStore` legacy alias is hardcoded to
 * `getMidiStore('s330')`, so the simulated transport's `deviceType`
 * is always 's330' regardless of URL device. Once the store is made
 * route-aware (separate issue), this fixture should be relabeled.
 *
 * The fixture matches the page's startup SysEx sequence exactly, so
 * the pageerror listener surfaces ALL errors without filtering --
 * no "known divergence" regex is needed (unlike patches.spec.ts
 * which has the PatchesPage tone-preload divergence per #405).
 *
 * Phase 0 #404 follow-up shipped: this spec un-skipped 2026-05-10.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0';

test.describe('Tones -- simulated harness', () => {
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

  test('renders bank 0 tones against the fixture', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Tones' })).toBeVisible();

    // Bank-0 load (tones 0-7) replays cleanly. tone-item-0's name reflects
    // fixture-decoded data, not a placeholder.
    await expect(page.getByTestId('tone-item-0')).toBeVisible({ timeout: 5_000 });
    const firstToneName = page
      .getByTestId('tone-item-0')
      .getByTestId('tone-name');
    await expect(firstToneName).not.toHaveText(/\(not loaded\)/);
  });

  test('list contains all S-330 tone slots', async ({ page }) => {
    // S-330 config has totalTones = 32 (the editor route is /roland/s330/...
    // even though the captured bytes came from a connected S-550 -- see
    // header comment for why). Bank-0 load populates slots 0-7; slots 8-31
    // stay as not-loaded placeholders. Assert presence in the DOM, not
    // viewport visibility -- the list scrolls.
    await expect(page.getByTestId('tone-item-0')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid^="tone-item-"]')).toHaveCount(32);

    // Address space cap: there is no slot 32.
    await expect(page.getByTestId('tone-item-32')).toHaveCount(0);
  });

  test('selecting a loaded tone updates the detail pane', async ({ page }) => {
    await expect(page.getByTestId('tone-item-0')).toBeVisible({ timeout: 5_000 });

    // Click slot 0 -- it's loaded.
    await page.getByTestId('tone-item-0').click();

    // ToneEditor wrapper carries data-testid="tone-detail" (see
    // modules/roland-sxx0-editor/src/components/tones/ToneEditor.tsx:94).
    await expect(page.getByTestId('tone-detail')).toBeVisible();
  });
});
