/**
 * S-330 Patches page -- simulated MIDI harness.
 *
 * Mounting the page triggers `loadInitialData()` which calls
 * `loadPatchBank(0)` then `loadToneBank(0)` (both bank 0; S-330 has
 * patchesPerBank = tonesPerBank = 8).
 *
 * Fixture coverage (load-everything.ndjson):
 *   - The patch-bank-0 load consumes the first ~152 fixture records
 *     (8 per-patch round trips, each with multiple sub-requests).
 *     Patches 0-7 render correctly.
 *   - The follow-on tone-bank-0 load tries to send a tone-area request
 *     while the fixture cursor is still mid-patch-load (sequence 152
 *     of 784 patch records, before the first tone request at
 *     sequence 784). That mismatch surfaces as
 *     `SimulatedAdapterUnexpectedSendError -- first diff at byte 6:
 *     expected 0x00, got 0x03` (0x00 = patch area, 0x03 = tone area)
 *     and is logged via `[S330Client] Error loading tone N: ...`.
 *
 * Consequence: we CAN assert that patches render and select correctly
 * (the patches half of the load works), but we CANNOT assert
 * "no harness errors" -- the post-patch tone load fails loudly. A
 * targeted `patches-only.ndjson` fixture would let us re-add that
 * assertion. See follow-up note in tones.spec.ts for the same idea.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=load-everything';

test.describe('S-330 Patches -- simulated harness', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test('renders bank 0 patches against the fixture', async ({ page }) => {
    // Sticky header.
    await expect(page.getByRole('heading', { name: 'Patches' })).toBeVisible();

    // Bank-0 load (patches 0-7) replays cleanly against the fixture --
    // patch-item-0's name reflects fixture-decoded data, not a placeholder.
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
    // scrolls inside `ac-scroll-list` so off-screen slots are still real.
    await expect(page.getByTestId('patch-item-0')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid^="patch-item-"]')).toHaveCount(16);

    // Address space cap: there is no slot 16 (zero-indexed cap at 15).
    await expect(page.getByTestId('patch-item-16')).toHaveCount(0);
  });

  test('selecting a loaded patch updates the detail pane', async ({ page }) => {
    await expect(page.getByTestId('patch-item-0')).toBeVisible({ timeout: 5_000 });

    // Initially the detail pane shows the placeholder.
    await expect(page.getByText('Select a patch to edit')).toBeVisible();

    // Click slot 0 -- it's loaded, so it should select.
    await page.getByTestId('patch-item-0').click();

    // Placeholder disappears once a patch is selected.
    await expect(page.getByText('Select a patch to edit')).toHaveCount(0);
  });
});
