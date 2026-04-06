/**
 * SCSI MIDI bridge e2e tests for Programs page on Akai S3000XL.
 *
 * These tests require a Pi running s2p and scsi-midi-bridge with S3000XL via SCSI.
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
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
} from '../../e2e-infra/helpers/connection-helper';

test.setTimeout(30_000);

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
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

/**
 * Locate a NumberInput by label within a specific section.
 *
 * Use this when label text is ambiguous across sections (e.g. "Rate"
 * appears in both LFO 1 and LFO 2).
 */
function numberInputByLabelInSection(
  page: import('@playwright/test').Page,
  sectionTitle: string,
  label: string,
): import('@playwright/test').Locator {
  const section = page.locator('.border.border-gray-700', {
    has: page.locator('.bg-gray-800', { hasText: sectionTitle }),
  });
  return section
    .locator('.flex.items-center.justify-between', { hasText: label })
    .filter({ has: page.locator('input[type="number"]') })
    .locator('input[type="number"]');
}

/**
 * Locate a <select> element by its ParameterRow label text.
 *
 * The ProgramEditor renders SelectInput as a <select> inside a ParameterRow.
 * This helper finds the row containing the label, then returns the select.
 */
function selectByLabel(
  page: import('@playwright/test').Page,
  label: string,
): import('@playwright/test').Locator {
  return page
    .locator('.flex.items-center.justify-between', { hasText: label })
    .locator('select');
}

/**
 * Locate a Toggle button by its ParameterRow label text within a section.
 *
 * The Toggle component renders as a <button> (not a checkbox). Its checked
 * state is indicated by the `bg-blue-600` CSS class (checked) vs `bg-gray-600`
 * (unchecked).
 */
function toggleByLabelInSection(
  page: import('@playwright/test').Page,
  sectionTitle: string,
  label: string,
): import('@playwright/test').Locator {
  const section = page.locator('.border.border-gray-700', {
    has: page.locator('.bg-gray-800', { hasText: sectionTitle }),
  });
  return section
    .locator('.flex.items-center.justify-between', { hasText: label })
    .locator('button');
}

/**
 * Read the checked state of a Toggle button.
 *
 * The Toggle uses `bg-blue-600` when on and `bg-gray-600` when off.
 */
async function isToggleChecked(toggle: import('@playwright/test').Locator): Promise<boolean> {
  const classes = await toggle.getAttribute('class');
  return classes?.includes('bg-blue-600') ?? false;
}

test.describe('S3000XL Programs Page (SCSI)', () => {
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

    /**
     * Round-trip test for LFO 1 Rate (LFORAT).
     *
     * Uses section-scoped locator because "Rate" also appears in LFO 2 (Pan).
     */
    test('LFO 1 rate round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const rateInput = numberInputByLabelInSection(page, 'LFO 1', 'Rate');
      await expect(rateInput).toBeVisible();

      const originalValue = await rateInput.inputValue();
      const testValue = originalValue === '40' ? '65' : '40';

      await rateInput.fill(testValue);
      await expect(rateInput).toHaveValue(testValue);
      await page.waitForTimeout(1_500);

      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const reloadedInput = numberInputByLabelInSection(page, 'LFO 1', 'Rate');
      await expect(reloadedInput).toHaveValue(testValue);

      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });

    /**
     * Round-trip test for Portamento Time (PORTIME).
     *
     * Uses section-scoped locator for clarity, since "Time" is a generic label.
     */
    test('portamento time round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const timeInput = numberInputByLabelInSection(page, 'Portamento', 'Time');
      await expect(timeInput).toBeVisible();

      const originalValue = await timeInput.inputValue();
      const testValue = originalValue === '30' ? '55' : '30';

      await timeInput.fill(testValue);
      await expect(timeInput).toHaveValue(testValue);
      await page.waitForTimeout(1_500);

      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const reloadedInput = numberInputByLabelInSection(page, 'Portamento', 'Time');
      await expect(reloadedInput).toHaveValue(testValue);

      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });

    /**
     * Round-trip test for Soft Pedal Loudness Reduction (SPLOUD).
     */
    test('soft pedal loudness round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const loudnessInput = numberInputByLabel(page, 'Loudness Reduction');
      await expect(loudnessInput).toBeVisible();

      const originalValue = await loudnessInput.inputValue();
      const testValue = originalValue === '20' ? '45' : '20';

      await loudnessInput.fill(testValue);
      await expect(loudnessInput).toHaveValue(testValue);
      await page.waitForTimeout(1_500);

      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const reloadedInput = numberInputByLabel(page, 'Loudness Reduction');
      await expect(reloadedInput).toHaveValue(testValue);

      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });
  });

  test.describe('Select and Toggle Round-Trips', () => {
    /**
     * Round-trip test for Priority (PRIORT) select parameter.
     *
     * The Priority select renders in the Basic section with options:
     * Low (0), Normal (1), High (2), Hold (3).
     */
    test('priority select round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const prioritySelect = selectByLabel(page, 'Priority');
      await expect(prioritySelect).toBeVisible();

      // Read the current value so we can restore it
      const originalValue = await prioritySelect.inputValue();

      // Pick a test value that differs from whatever the device has
      // Toggle between Low (0) and High (2)
      const testValue = originalValue === '0' ? '2' : '0';

      // Set the new value
      await prioritySelect.selectOption(testValue);
      await expect(prioritySelect).toHaveValue(testValue);

      // Wait for the SysEx write to propagate to the device
      await page.waitForTimeout(1_500);

      // Click Refresh to invalidate all caches and re-fetch from device
      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      // Verify the value was read back from the device
      const reloadedSelect = selectByLabel(page, 'Priority');
      await expect(reloadedSelect).toHaveValue(testValue);

      // Restore the original value
      await reloadedSelect.selectOption(originalValue);
      await page.waitForTimeout(1_500);
    });

    /**
     * Round-trip test for Legato (LEGATO) toggle parameter.
     *
     * The Legato toggle renders in the Advanced section as a <button>.
     * Its checked state is indicated by the `bg-blue-600` class.
     */
    test('legato toggle round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      const legatoToggle = toggleByLabelInSection(page, 'Advanced', 'Legato');
      await expect(legatoToggle).toBeVisible();

      // Read the current checked state
      const originalChecked = await isToggleChecked(legatoToggle);

      // Click to toggle the value
      await legatoToggle.click();

      // Verify the toggle changed state locally
      const afterClickChecked = await isToggleChecked(legatoToggle);
      expect(afterClickChecked).toBe(!originalChecked);

      // Wait for the SysEx write to propagate to the device
      await page.waitForTimeout(1_500);

      // Click Refresh to invalidate all caches and re-fetch from device
      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);

      // Verify the value was read back from the device
      const reloadedToggle = toggleByLabelInSection(page, 'Advanced', 'Legato');
      const reloadedChecked = await isToggleChecked(reloadedToggle);
      expect(reloadedChecked).toBe(!originalChecked);

      // Restore the original value
      await reloadedToggle.click();
      await page.waitForTimeout(1_500);
    });
  });

  test.describe('Program Section Visibility', () => {
    test.beforeEach(async ({ page }) => {
      await navigateToPrograms(page);
      await waitForProgramNamesLoaded(page);
      await selectFirstProgramAndWaitForEditor(page);
    });

    test('Output section displays parameters', async ({ page }) => {
      // The Output section should render with its key parameter labels
      const outputSection = page.locator('.border.border-gray-700', {
        has: page.locator('.bg-gray-800', { hasText: 'Output' }),
      }).filter({ hasText: 'Output Routing' });

      await expect(outputSection).toBeVisible();
      await expect(outputSection.locator('text=Output Routing')).toBeVisible();
      await expect(outputSection.locator('text=Stereo Level')).toBeVisible();
      await expect(outputSection.locator('text=Program Level')).toBeVisible();
    });

    test('LFO 1 section displays parameters', async ({ page }) => {
      // The LFO 1 section should render with Rate, Depth, and Delay
      const lfo1Section = page.locator('.border.border-gray-700').filter({
        has: page.locator('.bg-gray-800', { hasText: /^LFO 1$/ }),
      });

      await expect(lfo1Section).toBeVisible();
      await expect(lfo1Section.locator('text=Rate')).toBeVisible();
      await expect(lfo1Section.locator('text=Depth')).toBeVisible();
      await expect(lfo1Section.locator('text=Delay')).toBeVisible();
    });

    test('Soft Pedal section displays parameters', async ({ page }) => {
      // The Soft Pedal section should render with its three parameters
      const softPedalSection = page.locator('.border.border-gray-700', {
        has: page.locator('.bg-gray-800', { hasText: 'Soft Pedal' }),
      });

      await expect(softPedalSection).toBeVisible();
      await expect(softPedalSection.locator('text=Loudness Reduction')).toBeVisible();
      await expect(softPedalSection.locator('text=Attack Stretch')).toBeVisible();
      await expect(softPedalSection.locator('text=Filter Reduction')).toBeVisible();
    });
  });
});
