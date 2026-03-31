/**
 * Hardware e2e tests for Keygroups page on Akai S3000XL.
 *
 * These tests require an actual Akai S3000XL connected via MIDI.
 * They verify keygroup list loading, keygroup selection, and basic
 * keygroup parameter editing via the RKDATA/KDATA SysEx path.
 *
 * Keygroups belong to a program, so every test navigates to Programs
 * first, selects a program, then navigates to the Keygroups page.
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildUrl,
  waitForAppReady,
  connectToDevice,
} from '../../e2e-infra/helpers/connection-helper';

test.setTimeout(30_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildUrl(EDITOR_BASE_PATH, subpath, MIDI_SERVER_PORT);
}

/**
 * Navigate to Programs page, wait for program names to load from device,
 * and select the first program so that keygroup data is available.
 */
async function selectFirstProgram(page: import('@playwright/test').Page): Promise<void> {
  const programsLink = page.locator('a[href*="programs"]');
  await programsLink.click();
  await page.waitForURL('**/programs**');

  // Wait for at least one program item to appear
  await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({
    timeout: 15_000,
  });

  // Click the first program and wait for its editor to render
  await page.locator('[data-testid="program-item-0"]').click();
  await expect(page.locator('input[type="text"][maxlength="12"]')).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Navigate to the Keygroups page via the nav link.
 * Assumes a program has already been selected.
 */
async function navigateToKeygroups(page: import('@playwright/test').Page): Promise<void> {
  const keygroupsLink = page.locator('a[href*="keygroups"]');
  await keygroupsLink.click();
  await page.waitForURL('**/keygroups**');
}

/**
 * Wait for at least one keygroup item to appear in the list.
 * Keygroup items are buttons containing text like "KG 1".
 */
async function waitForKeygroupListLoaded(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('button', { hasText: 'KG 1' })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Select the first keygroup and wait for the editor to render.
 * The editor title shows "Keygroup 1:" when loaded.
 */
async function selectFirstKeygroupAndWaitForEditor(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.locator('button', { hasText: 'KG 1' }).click();
  await expect(page.locator('text=Keygroup 1:').first()).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Locate a NumberInput by its ParameterRow label text.
 *
 * The KeygroupEditor renders each parameter as a ParameterRow with a label span
 * and an input. This helper finds the row containing the label, then returns
 * the number input within that row.
 */
function numberInputByLabel(
  page: import('@playwright/test').Page,
  label: string,
): import('@playwright/test').Locator {
  return page
    .locator('.flex.items-center.justify-between', { hasText: label })
    .filter({ has: page.locator('input[type="number"]') })
    .locator('input[type="number"]');
}

test.describe('S3000XL Keygroups Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);
  });

  test.describe('Keygroup List', () => {
    test('navigates to keygroups page', async ({ page }) => {
      await selectFirstProgram(page);
      await navigateToKeygroups(page);

      expect(page.url()).toContain('/keygroups');
      await expect(page.locator('h2', { hasText: 'Keygroups' })).toBeVisible();
    });

    test('shows prompt when no program is selected', async ({ page }) => {
      // Navigate directly to keygroups without selecting a program
      await page.goto(url('keygroups'));
      await waitForAppReady(page);

      await expect(
        page.locator('text=Select a program on the Programs page first.'),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('keygroup list loads after program selection', async ({ page }) => {
      await selectFirstProgram(page);
      await navigateToKeygroups(page);
      await waitForKeygroupListLoaded(page);

      // At least one keygroup button should be visible
      const keygroupButtons = page.locator('button', { hasText: /KG \d+/ });
      const count = await keygroupButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('selecting a keygroup shows the editor', async ({ page }) => {
      await selectFirstProgram(page);
      await navigateToKeygroups(page);
      await waitForKeygroupListLoaded(page);
      await selectFirstKeygroupAndWaitForEditor(page);

      // Verify editor sections are visible
      await expect(page.locator('text=Note Range').first()).toBeVisible();
      await expect(page.locator('text=Filter').first()).toBeVisible();
      await expect(page.locator('text=Amplitude Envelope').first()).toBeVisible();
    });
  });

  test.describe('Keygroup Parameters', () => {
    test.beforeEach(async ({ page }) => {
      await selectFirstProgram(page);
      await navigateToKeygroups(page);
      await waitForKeygroupListLoaded(page);
      await selectFirstKeygroupAndWaitForEditor(page);
    });

    test('note range inputs are displayed with values', async ({ page }) => {
      // The Note Range section renders Low Note and High Note inputs
      const lowNoteInput = numberInputByLabel(page, 'Low Note');
      const highNoteInput = numberInputByLabel(page, 'High Note');

      await expect(lowNoteInput).toBeVisible();
      await expect(highNoteInput).toBeVisible();

      // Verify inputs have numeric values
      const lowValue = Number(await lowNoteInput.inputValue());
      const highValue = Number(await highNoteInput.inputValue());
      expect(Number.isFinite(lowValue)).toBe(true);
      expect(Number.isFinite(highValue)).toBe(true);
    });

    test('filter frequency round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      const filterFreqInput = numberInputByLabel(page, 'Frequency');
      await expect(filterFreqInput).toBeVisible();

      // Read the current value so we can restore it
      const originalValue = await filterFreqInput.inputValue();

      // Pick a test value that differs from whatever the device has
      const testValue = originalValue === '50' ? '75' : '50';

      // Set the new value
      await filterFreqInput.fill(testValue);
      await expect(filterFreqInput).toHaveValue(testValue);

      // Wait for the SysEx write to propagate to the device
      await page.waitForTimeout(1_500);

      // Click Refresh to invalidate caches and re-fetch from device
      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForKeygroupListLoaded(page);
      await selectFirstKeygroupAndWaitForEditor(page);

      // Verify the value was read back from the device
      const reloadedInput = numberInputByLabel(page, 'Frequency');
      await expect(reloadedInput).toHaveValue(testValue);

      // Restore the original value
      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });
  });
});
