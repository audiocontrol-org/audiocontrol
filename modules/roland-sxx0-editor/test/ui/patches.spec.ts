/**
 * S-330 Patches page -- simulated MIDI harness.
 *
 * Mounting the page triggers `loadInitialData()` which calls
 * `loadPatchBank(0)` then `loadToneBank(0)` (S-330 has
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
 *     `SimulatedAdapterUnexpectedSendError ... first diff at byte 6:
 *     expected 0x00, got 0x03` (0x00 = patch area, 0x03 = tone area)
 *     and is logged via `[S330Client] Error loading tone N: ...`.
 *
 * Consequence: we CAN assert that patches render and select correctly
 * (the patches half of the load works), but we CANNOT assert
 * "no harness errors" without filtering. The pageerror listener below
 * surfaces ALL errors EXCEPT the known tone-load divergence -- a real
 * regression in the patches path will still fail the spec.
 *
 * Two follow-ups:
 *   - Targeted patches-bank-0 fixture (no tone preload):
 *     github.com/audiocontrol-org/audiocontrol/issues/404
 *   - Decouple PatchesPage tone preload so the page only loads what it
 *     consumes on mount:
 *     github.com/audiocontrol-org/audiocontrol/issues/405
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=load-everything';

// Matches the SimulatedAdapter throw documented above. The error name and
// the byte-6 area-selector diff are the load-bearing parts -- a real new
// regression won't share both.
//
// Format reference: SimulatedAdapter.send() throws
// `SimulatedAdapterUnexpectedSendError: send([...]) at sequence N does not
//  match recorded outbound [...] -- first diff at byte 6: expected 0xXX,
//  got 0xYY`
// (see modules/sampler-devices/src/simulation/simulated-adapter.ts).
//
// Tracked: https://github.com/audiocontrol-org/audiocontrol/issues/405
const KNOWN_TONE_LOAD_DIVERGENCE =
  /SimulatedAdapterUnexpectedSendError[\s\S]*at sequence \d+[\s\S]*first diff at byte 6: expected 0x00, got 0x03/;

// The S330Client's own error-log line is the proximate console error that
// surfaces the same divergence. Filter it for the same reason.
const S330_TONE_LOAD_ERROR = /\[S330Client\] Error loading tone \d+/;

function isKnownTonePreloadDiagnostic(text: string): boolean {
  return KNOWN_TONE_LOAD_DIVERGENCE.test(text) || S330_TONE_LOAD_ERROR.test(text);
}

test.describe('S-330 Patches -- simulated harness', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];

    page.on('pageerror', (err) => {
      if (isKnownTonePreloadDiagnostic(err.message)) return;
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (isKnownTonePreloadDiagnostic(text)) return;
      pageErrors.push(text);
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'unexpected pageerror beyond the known PatchesPage tone-preload divergence (issues #404, #405)',
    ).toEqual([]);
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

    // Positive assertion: PatchEditor actually rendered (not just that the
    // placeholder went away). The wrapper carries data-testid="patch-editor"
    // (see modules/roland-sxx0-editor/src/components/patches/PatchEditor.tsx).
    await expect(page.getByTestId('patch-editor')).toBeVisible();
  });
});
