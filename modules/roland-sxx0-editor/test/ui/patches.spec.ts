/**
 * S-330 Patches page -- simulated MIDI harness.
 *
 * Mounting the page triggers `loadInitialData()` which calls
 * `loadPatchBank(0)` only after #405 (tone-bank-0 loads lazily on first
 * patch selection). Mount-only tests use the targeted `patches-bank-0`
 * fixture (`modules/sampler-devices/test/fixtures/s330/patches-bank-0.ndjson`)
 * which captures connect + loadPatchRange(0, 8) and nothing else — so
 * any harness divergence on mount is a real regression.
 *
 * The selection test uses `load-everything` because it triggers the
 * lazy tone-load at click time, which sends 8 tone-area RQDs against a
 * cursor that's still expecting more patches (load-everything has all
 * 16 patches recorded before any tones). The mismatch is the same
 * byte-6 area-code divergence the eager-mount path produced pre-#405,
 * so the existing filter still applies — just at click time instead of
 * mount time. A combined `patches-then-tones-bank-0` fixture would
 * close the click-test gap; tracked under the same #405 close-out.
 */
import { test, expect } from '@playwright/test';

const MOUNT_HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0';

const SELECTION_HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=load-everything';

// Used by the selection test only. After #405 the lazy tone-load fires
// on click; against `load-everything` the cursor is at sequence ~152
// (still in patch records) so the tone-RQD diverges at byte 6 — same
// shape as the pre-#405 eager-mount divergence.
const KNOWN_TONE_LAZY_LOAD_DIVERGENCE =
  /SimulatedAdapterUnexpectedSendError[\s\S]*at sequence \d+[\s\S]*first diff at byte 6: expected 0x00, got 0x03/;

const S330_TONE_LOAD_ERROR = /\[S330Client\] Error loading tone \d+/;

function isKnownLazyToneLoadDiagnostic(text: string): boolean {
  return KNOWN_TONE_LAZY_LOAD_DIVERGENCE.test(text) || S330_TONE_LOAD_ERROR.test(text);
}

test.describe('S-330 Patches mount -- simulated harness (patches-bank-0)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      pageErrors.push(msg.text());
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(MOUNT_HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(() => {
    expect(pageErrors, 'unexpected pageerror or console error on mount').toEqual([]);
  });

  test('renders bank 0 patches against the patches-bank-0 fixture', async ({ page }) => {
    // Sticky header.
    await expect(page.getByRole('heading', { name: 'Patches' })).toBeVisible();

    // Bank-0 load (patches 0-7) replays cleanly against the targeted fixture.
    await expect(page.getByTestId('patch-item-0')).toBeVisible({ timeout: 5_000 });
    const firstPatchName = page
      .getByTestId('patch-item-0')
      .getByTestId('patch-name');
    await expect(firstPatchName).not.toHaveText(/\(not loaded\)/);
  });

  test('list contains all 16 S-330 patch slots', async ({ page }) => {
    // S-330 has totalPatches = 16 (P11-P28 in bank/slot notation; see
    // modules/roland-sxx0-editor/src/configs/s330.ts). Bank-0 load
    // populates slots 0-7; slots 8-15 stay as not-loaded placeholders.
    // Assert presence in the DOM, not viewport visibility -- the list
    // scrolls inside `ac-list-scroll` so off-screen slots are still real.
    await expect(page.getByTestId('patch-item-0')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid^="patch-item-"]')).toHaveCount(16);

    // Address space cap: there is no slot 16 (zero-indexed cap at 15).
    await expect(page.getByTestId('patch-item-16')).toHaveCount(0);
  });
});

test.describe('S-330 Patches selection -- simulated harness (load-everything)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];

    page.on('pageerror', (err) => {
      if (isKnownLazyToneLoadDiagnostic(err.message)) return;
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (isKnownLazyToneLoadDiagnostic(text)) return;
      pageErrors.push(text);
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(SELECTION_HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'unexpected pageerror beyond the known lazy tone-load divergence (issue #405)',
    ).toEqual([]);
  });

  test('selecting a loaded patch updates the detail pane', async ({ page }) => {
    await expect(page.getByTestId('patch-item-0')).toBeVisible({ timeout: 5_000 });

    // Initially the detail pane shows the placeholder.
    await expect(page.getByText('Select a patch to edit')).toBeVisible();

    // Click slot 0 -- it's loaded, so it should select. This also triggers
    // the lazy tone-bank-0 load (#405); against `load-everything` that
    // surfaces the byte-6 divergence which the filter above tolerates.
    await page.getByTestId('patch-item-0').click();

    // Placeholder disappears once a patch is selected.
    await expect(page.getByText('Select a patch to edit')).toHaveCount(0);

    // Positive assertion: PatchEditor actually rendered (not just that the
    // placeholder went away). The wrapper carries data-testid="patch-editor"
    // (see modules/roland-sxx0-editor/src/components/patches/PatchEditor.tsx).
    await expect(page.getByTestId('patch-editor')).toBeVisible();
  });
});
