/**
 * S-330 Library page -- simulated MIDI harness.
 *
 * The Library page does NOT auto-load device data on mount (unlike the
 * Patches/Tones/Play pages). Device data is fetched only when the user
 * clicks "Refresh Device". So the page mounts cleanly under the simulated
 * adapter -- the fixture cursor stays at sequence 0 while the page renders.
 *
 * This spec proves the library page mounts under the harness without
 * exercising the bank-load path that mismatches the load-everything
 * fixture (see patches.spec.ts and tones.spec.ts for the fixture-shape
 * follow-up: github.com/audiocontrol-org/audiocontrol/issues/404).
 *
 * Page-error wiring lives in `beforeEach` so every test surfaces
 * harness/adapter throws -- not just the first.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/library?midi=simulated&scenario=load-everything';

test.describe('S-330 Library -- simulated harness', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];

    // Listeners attached before navigation -- catches any startup-time
    // SimulatedAdapter throws. The PatchList button-in-button fix in this
    // commit means we no longer need a validateDOMNesting filter; if the
    // warning reappears anywhere downstream, surface it.
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

  test('renders without harness errors', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  });

  test('shows the library header buttons', async ({ page }) => {
    // Save and Load testids are wired in LibraryPage.tsx.
    await expect(page.getByTestId('save-set-button')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('load-set-button')).toBeVisible();

    // Refresh-Device button (no testid -- match by visible label).
    await expect(page.getByRole('button', { name: 'Refresh Device' })).toBeVisible();
  });

  test('shows Experimental tag in the header', async ({ page }) => {
    // The Library header carries an "Experimental" badge (see
    // src/pages/LibraryPage.tsx). Its presence is a stable structural
    // signal that the header rendered all the way through.
    await expect(page.getByText('Experimental')).toBeVisible();
  });
});
