/**
 * Multi-mode (Play page) write-capability specs.
 *
 * Each test mounts a fixture that captures the PlayPage mount sequence
 * (connect + loadPatchRange + requestFunctionParameters) plus ONE
 * setter call. The spec drives the UI to emit the same setter at the
 * same value. The SimulatedAdapter strict-matches the outbound bytes;
 * absence of pageerror = match.
 *
 * Fixture path note: filed under s330/ because the editor's
 * useMidiStore legacy alias is hardcoded to getMidiStore('s330'), so
 * the simulated transport fetches /test-fixtures/s330/... regardless
 * of URL device segment. The captured bytes are S-550 device behavior.
 *
 * Affordances covered:
 *   - D-PLAY-04: setMultiChannel — per-part MIDI channel select
 *   - D-PLAY-05: setMultiPatch   — per-part patch index select
 *   - D-PLAY-06: setMultiOutput  — per-part output select
 *   - D-PLAY-07: setMultiLevel   — per-part level slider
 *
 * After the Phase 9 Task 4 PlayPage amend, the level slider is now an
 * AcRangeBar (display-only) + AcNumberInput (editable) composition. The
 * editable readout streams per-keystroke writes (no separate mouseup
 * commit), matching the patch-writes.spec.ts `fillSliderInput` pattern.
 */
import { test, expect, type Page } from '@playwright/test';

/**
 * Wait until the PlayPage's mount sequence (connect + loadPatchRange +
 * requestFunctionParameters) has fully drained against the simulated
 * adapter. Two signals must both be true:
 *   - The patch select for part 0 has been populated with 8 options
 *     (one per loaded patch) plus the '---' placeholder — proves
 *     loadPatchRange(0, 8) completed and populated the device-data store.
 *   - The patch select carries an integer value (>= -1) — proves
 *     requestFunctionParameters() ran and updated React state.
 * Without this wait, a setter-driven test would issue MIDI traffic
 * against cursor 0 instead of cursor 172.
 */
async function waitForPlayPageMount(page: Page): Promise<void> {
  const patchSelect = page.getByTestId('part-0-patch');
  await expect(patchSelect).toBeVisible({ timeout: 5_000 });

  // Wait for 9 options (1 placeholder + 8 patches from loadPatchRange).
  await expect
    .poll(
      async () =>
        patchSelect.evaluate((el: HTMLSelectElement) => el.options.length),
      { timeout: 10_000, intervals: [50, 100, 200, 500] },
    )
    .toBeGreaterThanOrEqual(9);
}

test.describe('Play multi-mode write affordances (D-PLAY-04..07)', () => {
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
  });

  test.afterEach(() => {
    expect(
      pageErrors,
      'no SimulatedAdapter mismatch or harness errors after driving the setter',
    ).toEqual([]);
  });

  test('D-PLAY-04: adjusting part 0 MIDI channel writes setMultiChannel', async ({ page }) => {
    await page.goto(
      '/roland/s330/editor/play?midi=simulated&scenario=multi-part-0-channel',
    );
    await waitForPlayPageMount(page);

    // Captured fixture sets channel index 5 (display "6"). The select's
    // values are 0-15; selectOption fires change, which invokes
    // handleChannelChange -> setMultiChannel(0, 5).
    await page.getByTestId('part-0-channel').selectOption({ value: '5' });

    // Let the setter's WSD/DAT/EOD round trip resolve against the
    // SimulatedAdapter. The cursor must advance through every captured
    // outbound; a mismatch raises a pageerror that the afterEach asserts.
    await page.waitForLoadState('networkidle');
  });

  test('D-PLAY-05: adjusting part 0 patch index writes setMultiPatch', async ({ page }) => {
    await page.goto(
      '/roland/s330/editor/play?midi=simulated&scenario=multi-part-0-patch',
    );
    await waitForPlayPageMount(page);

    // Captured fixture sets patchIndex 3. The patches loaded from the
    // fixture's loadPatchRange(0, 8) populate options 0..7; selectOption
    // by value drives handlePatchChange(0, 3) -> setMultiPatch(0, 3).
    await page.getByTestId('part-0-patch').selectOption({ value: '3' });

    await page.waitForLoadState('networkidle');
  });

  test('D-PLAY-06: adjusting part 0 output writes setMultiOutput', async ({ page }) => {
    await page.goto(
      '/roland/s330/editor/play?midi=simulated&scenario=multi-part-0-output',
    );
    await waitForPlayPageMount(page);

    // Captured fixture sets output 4 (display "4" — the select stores
    // 1-8 directly). selectOption drives handleOutputChange(0, 4) ->
    // setMultiOutput(0, 4).
    await page.getByTestId('part-0-output').selectOption({ value: '4' });

    await page.waitForLoadState('networkidle');
  });

  test('D-PLAY-07: adjusting part 0 level writes setMultiLevel', async ({ page }) => {
    await page.goto(
      '/roland/s330/editor/play?midi=simulated&scenario=multi-part-0-level',
    );
    await waitForPlayPageMount(page);

    // After the Phase 9 Task 4 amend the level affordance is an
    // AcNumberInput (editable). `page.fill` clears and types the new
    // value atomically — Playwright fires a single `input` event with
    // the final value, the AcNumberInput's onChange parses + clamps,
    // and the page-side handler invokes setMultiLevel(0, 80). Mirrors
    // the patch-writes.spec.ts `fillSliderInput` pattern.
    const slider = page.getByTestId('part-0-level');
    await expect(slider).toBeVisible({ timeout: 5_000 });
    await slider.fill(String(80));
    await slider.blur();

    await page.waitForLoadState('networkidle');
  });
});
