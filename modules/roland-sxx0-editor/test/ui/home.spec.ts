/**
 * S-330 Home page -- simulated MIDI harness.
 *
 * Validates that the harness chain works end-to-end:
 *   recorded NDJSON fixture (Phase 0 Task 5)
 *     -> SimulatedAdapter (Task 6)
 *       -> editor's SimulatedMidiTransport (Task 7)
 *         -> real HomePage component
 *
 * The Home page hosts MidiConnectionPage. Mounting it should NOT consume
 * any fixture records (the simulated transport auto-connects, but `connect`
 * itself sends no SysEx). Any SimulatedAdapter throw here means the page
 * triggered an unexpected outbound -- treat as diagnostic, not a flake.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/?midi=simulated&scenario=load-everything';

test.describe('S-330 Home -- simulated harness', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage so simulated-port IDs don't leak between specs
    // (and so they don't leak back into a real-app session afterward).
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test('renders without harness errors', async ({ page }) => {
    // Attach listeners BEFORE navigation so we catch any initial-load
    // SimulatedAdapter throws or React errors. Filter validateDOMNesting
    // warnings -- those are pre-existing component issues unrelated to
    // the harness chain.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (text.includes('validateDOMNesting')) return;
      errors.push(text);
    });

    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');

    // Connection card heading uses the device name from the device config.
    await expect(page.getByRole('heading', { name: 'Connect to S-330' })).toBeVisible();

    // Transport label reflects the simulated mode (TRANSPORT_LABELS map in
    // MidiConnectionPage falls through to the raw mode string for any mode
    // not explicitly listed -- 'simulated' is shown verbatim).
    await expect(page.getByText(/Transport: simulated/)).toBeVisible();

    // Give the auto-connect a moment to settle before asserting no errors.
    await page.waitForTimeout(250);

    expect(errors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('reaches connected status under simulated transport', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');

    // Simulated transport has kind !== 'web-midi', so the store auto-connects
    // to the first input/output. After that, the Disconnect button is visible
    // (MidiConnectionPage renders Disconnect+Continue once isConnected).
    await expect(
      page.getByTestId('disconnect-button'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('shows Continue to Patches once connected', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');

    // The continue button label comes from the S-330 device config
    // (`continueLabel: 'Continue to Patches'`). It only renders after
    // auto-connect completes.
    await expect(
      page.getByRole('button', { name: 'Continue to Patches' }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
