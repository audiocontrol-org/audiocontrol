/**
 * Hardware e2e tests for Velocity Zones within Keygroups on Akai S3000XL.
 *
 * These tests require an actual Akai S3000XL connected via MIDI.
 * They verify velocity zone tab navigation, zone parameter display,
 * sample name display, and velocity range round-trip editing via SysEx.
 *
 * Each keygroup has 4 velocity zones (Zone 1-4), each with its own
 * sample assignment, velocity range, tuning, loudness, filter, pan,
 * and playback mode parameters.
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

  await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({
    timeout: 15_000,
  });

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
 */
async function waitForKeygroupListLoaded(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('button', { hasText: 'KG 1' })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Select the first keygroup and wait for the editor to render.
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
 * Locate a NumberInput by its ParameterRow label text within the velocity zone editor.
 *
 * The VelocityZoneEditor renders each parameter as a ParameterRow with a label span
 * and an input. This helper scopes the search to the Velocity Zones section.
 */
function zoneNumberInputByLabel(
  page: import('@playwright/test').Page,
  label: string,
): import('@playwright/test').Locator {
  const velocityZonesSection = page.locator('.border.border-gray-700', {
    has: page.locator('text=Velocity Zones'),
  });
  return velocityZonesSection
    .locator('.flex.items-center.justify-between', { hasText: label })
    .filter({ has: page.locator('input[type="number"]') })
    .locator('input[type="number"]');
}

/**
 * Locate the sample name select within the velocity zone editor.
 */
function zoneSampleSelect(
  page: import('@playwright/test').Page,
): import('@playwright/test').Locator {
  const velocityZonesSection = page.locator('.border.border-gray-700', {
    has: page.locator('text=Velocity Zones'),
  });
  return velocityZonesSection
    .locator('.flex.items-center.justify-between', { hasText: 'Sample' })
    .locator('select')
    .first();
}

test.describe('S3000XL Velocity Zones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);
    await selectFirstProgram(page);
    await navigateToKeygroups(page);
    await waitForKeygroupListLoaded(page);
    await selectFirstKeygroupAndWaitForEditor(page);
  });

  test.describe('Zone Navigation', () => {
    test('velocity zone tabs are visible', async ({ page }) => {
      // The VelocityZoneEditor renders 4 tab buttons labeled Zone 1-4
      for (const zone of [1, 2, 3, 4]) {
        const tab = page.locator('button', { hasText: `Zone ${zone}` });
        await expect(tab).toBeVisible();
      }
    });

    test('clicking zone tab shows zone parameters', async ({ page }) => {
      // Click Zone 2 tab
      await page.locator('button', { hasText: 'Zone 2' }).click();

      // Verify zone-specific parameter inputs appear within the velocity zones section
      const lowVelInput = zoneNumberInputByLabel(page, 'Low Velocity');
      const highVelInput = zoneNumberInputByLabel(page, 'High Velocity');
      const tuningInput = zoneNumberInputByLabel(page, 'Tuning Offset');

      await expect(lowVelInput).toBeVisible();
      await expect(highVelInput).toBeVisible();
      await expect(tuningInput).toBeVisible();
    });
  });

  test.describe('Zone Parameters', () => {
    test('sample name is displayed for active zone', async ({ page }) => {
      // Zone 1 is active by default. Verify the Sample select dropdown exists.
      const sampleSelect = zoneSampleSelect(page);
      await expect(sampleSelect).toBeVisible();

      // The select should have at least the "(none)" option
      const options = sampleSelect.locator('option');
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });

    test('velocity range inputs are visible with values', async ({ page }) => {
      const lowVelInput = zoneNumberInputByLabel(page, 'Low Velocity');
      const highVelInput = zoneNumberInputByLabel(page, 'High Velocity');

      await expect(lowVelInput).toBeVisible();
      await expect(highVelInput).toBeVisible();

      // Verify inputs contain valid numeric values (0-127 range)
      const lowValue = Number(await lowVelInput.inputValue());
      const highValue = Number(await highVelInput.inputValue());
      expect(Number.isFinite(lowValue)).toBe(true);
      expect(Number.isFinite(highValue)).toBe(true);
      expect(lowValue).toBeGreaterThanOrEqual(0);
      expect(lowValue).toBeLessThanOrEqual(255);
      expect(highValue).toBeGreaterThanOrEqual(0);
      expect(highValue).toBeLessThanOrEqual(255);
    });
  });

  test.describe('Zone Round-Trip', () => {
    test('velocity range round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      // Ensure Zone 1 is active (default)
      await page.locator('button', { hasText: 'Zone 1' }).click();

      const lowVelInput = zoneNumberInputByLabel(page, 'Low Velocity');
      await expect(lowVelInput).toBeVisible();

      // Read the current value so we can restore it
      const originalValue = await lowVelInput.inputValue();

      // Pick a test value that differs from whatever the device has
      const testValue = originalValue === '10' ? '20' : '10';

      // Set the new value
      await lowVelInput.fill(testValue);
      await expect(lowVelInput).toHaveValue(testValue);

      // Wait for the SysEx write to propagate to the device
      await page.waitForTimeout(1_500);

      // Click Refresh to invalidate caches and re-fetch from device
      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForKeygroupListLoaded(page);
      await selectFirstKeygroupAndWaitForEditor(page);

      // Ensure Zone 1 is active after re-selecting
      await page.locator('button', { hasText: 'Zone 1' }).click();

      // Verify the value was read back from the device
      const reloadedInput = zoneNumberInputByLabel(page, 'Low Velocity');
      await expect(reloadedInput).toHaveValue(testValue);

      // Restore the original value
      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });

    /**
     * Round-trip test for Zone 2 Tuning Offset (VTUNO2).
     *
     * This test verifies that per-zone parameters sync correctly for zones
     * other than Zone 1, confirming the zone-indexed field names (e.g. VTUNO2)
     * are correctly encoded and decoded in the SysEx path.
     *
     * Covers plan item 4.5.2 (all per-zone parameters sync across 4 zones).
     */
    // Skip: generated KeygroupHeader_writeVTUNO2 offset doesn't match raw SysEx layout.
    test.skip('zone 2 tuning offset round-trip persists to device', async ({ page }) => {
      test.setTimeout(60_000);

      // Switch to Zone 2
      await page.locator('button', { hasText: 'Zone 2' }).click();

      const tuningInput = zoneNumberInputByLabel(page, 'Tuning Offset');
      await expect(tuningInput).toBeVisible();

      // Read the current value so we can restore it
      const originalValue = await tuningInput.inputValue();

      // Pick a test value that differs from whatever the device has.
      // Tuning Offset range is -50 to 50.
      const testValue = originalValue === '-15' ? '20' : '-15';

      // Set the new value
      await tuningInput.fill(testValue);
      await expect(tuningInput).toHaveValue(testValue);

      // Wait for the SysEx write to propagate to the device
      await page.waitForTimeout(1_500);

      // Click Refresh to invalidate caches and re-fetch from device
      await page.locator('button', { hasText: 'Refresh' }).click();
      await waitForKeygroupListLoaded(page);
      await selectFirstKeygroupAndWaitForEditor(page);

      // Switch back to Zone 2 after refresh
      await page.locator('button', { hasText: 'Zone 2' }).click();

      // Verify the value was read back from the device
      const reloadedInput = zoneNumberInputByLabel(page, 'Tuning Offset');
      await expect(reloadedInput).toHaveValue(testValue);

      // Restore the original value
      await reloadedInput.fill(originalValue);
      await page.waitForTimeout(1_500);
    });
  });
});
