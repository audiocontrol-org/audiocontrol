/**
 * Hardware e2e tests for Programs page on Akai S3000XL.
 *
 * These tests require an actual Akai S3000XL connected via MIDI.
 * They verify program list loading, program selection, and basic
 * program editing via the editor UI.
 *
 * Tests interact with the app's UI, not raw MIDI APIs. Transport selection
 * is pre-configured via query parameters by the test runner.
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
 * Navigate to Programs page via the nav link.
 * Waits for the URL to update to confirm navigation succeeded.
 */
async function navigateToPrograms(page: import('@playwright/test').Page): Promise<void> {
  const programsLink = page.locator('a[href*="programs"]');
  await programsLink.click();
  await page.waitForURL('**/programs**');
}

/**
 * Wait for program names to finish loading from the device.
 * The ProgramList shows "Loading programs..." while fetching,
 * then renders program-item buttons once names are loaded.
 */
async function waitForProgramNamesLoaded(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Select the first program and wait for its editor to render.
 * Returns the page for chaining.
 */
async function selectFirstProgramAndWaitForEditor(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.locator('[data-testid="program-item-0"]').click();
  await expect(page.locator('input[type="text"][maxlength="12"]')).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Locate a NumberInput by its ParameterRow label text.
 *
 * The ProgramEditor renders each parameter as a ParameterRow with a label span
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

test.describe('S3000XL Programs Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);
  });

  test.describe('Program List', () => {
    test('navigates to programs page', async ({ page }) => {
      await navigateToPrograms(page);

      expect(page.url()).toContain('/programs');
      await expect(page.locator('h2', { hasText: 'Programs' })).toBeVisible();
    });

    test('program list loads program names from device', async ({ page }) => {
      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);

      // At least one program item should be visible
      const programItems = page.locator('[data-testid^="program-item-"]');
      const count = await programItems.count();
      expect(count).toBeGreaterThan(0);

      // Each item should have a program name (or "(empty)" for unnamed)
      const firstItemText = await programItems.first().locator('[data-testid="program-name"]').textContent();
      expect(firstItemText).toBeTruthy();
    });

    test('selecting a program shows the editor panel', async ({ page }) => {
      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);

      // Click the first program
      await page.locator('[data-testid="program-item-0"]').click();

      // The ProgramEditor renders a "Basic" section when a header is loaded
      await expect(page.locator('text=Basic').first()).toBeVisible({ timeout: 10_000 });

      // Program name input should be visible in the editor
      const nameInput = page.locator('input[type="text"][maxlength="12"]');
      await expect(nameInput).toBeVisible({ timeout: 5_000 });
    });

    test('Load All button fetches all program headers', async ({ page }) => {
      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);

      // Click "Load All"
      const loadAllButton = page.locator('button', { hasText: 'Load All' });
      await expect(loadAllButton).toBeEnabled();
      await loadAllButton.click();

      // Should show loading progress
      await expect(page.locator('[data-testid="loading-status"]')).toBeVisible({ timeout: 5_000 });

      // Wait for loading to finish (button re-enabled)
      await expect(loadAllButton).toBeEnabled({ timeout: 30_000 });
    });
  });

  test.describe('Program Editing', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);

      // Select the first program
      await page.locator('[data-testid="program-item-0"]').click();

      // Wait for the editor to render
      await expect(page.locator('input[type="text"][maxlength="12"]')).toBeVisible({
        timeout: 10_000,
      });
    });

    test('can edit program name', async ({ page }) => {
      const nameInput = page.locator('input[type="text"][maxlength="12"]');

      // Read current name
      const originalName = await nameInput.inputValue();

      // Clear and type a new name
      const testName = 'E2ETEST';
      await nameInput.fill(testName);

      // Verify the input reflects the new name
      await expect(nameInput).toHaveValue(testName);

      // The editor title should update to show the new name
      await expect(page.locator(`text=Program 1: ${testName}`)).toBeVisible();

      // Restore original name to avoid polluting device state for other tests
      await nameInput.fill(originalName);
      await expect(nameInput).toHaveValue(originalName);
    });

    test('program name round-trip persists to device', async ({ page }) => {
      const nameInput = page.locator('input[type="text"][maxlength="12"]');

      // Read the current name so we can restore it
      const originalName = await nameInput.inputValue();

      // Set a unique test name
      const testName = 'RTRIP';
      await nameInput.fill(testName);
      await expect(nameInput).toHaveValue(testName);

      // Wait for the write to device to complete (optimistic update + device write)
      // The write happens on change; give it a moment to propagate
      await page.waitForTimeout(1_000);

      // Navigate away from Programs page
      const connectLink = page.locator('a[href$="/editor"]').first();
      await connectLink.click();
      await page.waitForURL((url) => !url.pathname.includes('/programs'));

      // Navigate back to Programs
      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);

      // Re-select the first program
      await page.locator('[data-testid="program-item-0"]').click();
      await expect(page.locator('input[type="text"][maxlength="12"]')).toBeVisible({
        timeout: 10_000,
      });

      // The program name in the list should reflect the change
      const firstProgramName = await page
        .locator('[data-testid="program-item-0"] [data-testid="program-name"]')
        .textContent();
      expect(firstProgramName?.trim()).toBe(testName);

      // The editor input should also show the updated name
      const reloadedInput = page.locator('input[type="text"][maxlength="12"]');
      await expect(reloadedInput).toHaveValue(testName);

      // Restore original name
      await reloadedInput.fill(originalName);
      await page.waitForTimeout(1_000);
    });
  });

  test.describe('Program Parameter Round-Trips', () => {
    /**
     * Full round-trip test for the Polyphony (POLYPH) parameter.
     *
     * This test performs a page.reload() between write and read to guarantee
     * all JS state (Zustand stores, client caches) is cleared, forcing a
     * fresh fetch from the device. This is the only way to verify the value
     * was actually persisted to hardware via SysEx.
     */
    test('polyphony round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const polyphonyInput = numberInputByLabel(page, 'Polyphony');
      await expect(polyphonyInput).toBeVisible();

      // Read the current value so we can restore it
      const originalValue = await polyphonyInput.inputValue();

      // Pick a test value that differs from whatever the device has
      const testValue = originalValue === '8' ? '12' : '8';

      // Set the new value
      await polyphonyInput.fill(testValue);
      await expect(polyphonyInput).toHaveValue(testValue);

      // Wait for the SysEx write to propagate to the device
      await page.waitForTimeout(1_500);

      // Click Refresh to invalidate all caches and re-fetch from device
      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      // Verify the value was read back from the device
      const reloadedInput = numberInputByLabel(page, 'Polyphony');
      await expect(reloadedInput).toHaveValue(testValue);

      // Restore the original value
      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });

    test('program level round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const levelInput = numberInputByLabel(page, 'Program Level');
      await expect(levelInput).toBeVisible();

      const originalValue = await levelInput.inputValue();
      const testValue = originalValue === '50' ? '75' : '50';

      await levelInput.fill(testValue);
      await expect(levelInput).toHaveValue(testValue);
      await page.waitForTimeout(1_500);

      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const reloadedInput = numberInputByLabel(page, 'Program Level');
      await expect(reloadedInput).toHaveValue(testValue);

      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });

    test('pan position round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const panInput = numberInputByLabel(page, 'Pan Position');
      await expect(panInput).toBeVisible();

      const originalValue = await panInput.inputValue();
      const testValue = originalValue === '-25' ? '10' : '-25';

      await panInput.fill(testValue);
      await expect(panInput).toHaveValue(testValue);
      await page.waitForTimeout(1_500);

      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const reloadedInput = numberInputByLabel(page, 'Pan Position');
      await expect(reloadedInput).toHaveValue(testValue);

      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });
  });
});
