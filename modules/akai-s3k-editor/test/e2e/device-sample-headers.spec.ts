/**
 * Hardware e2e tests for sample header reading on Akai S3000XL.
 *
 * These tests require an actual Akai S3000XL connected via MIDI with
 * at least one sample loaded in memory. They exercise the RSLIST SysEx
 * path by verifying sample names are fetched and displayed in the
 * velocity zone sample dropdown within the Keygroups editor.
 *
 * The S3000XL editor does not yet have a dedicated Samples page, so
 * these tests use the velocity zone's sample select dropdown (populated
 * by useSampleNames / fetchSampleNames) as the verification surface.
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
 * Locate the sample name select within the velocity zone editor.
 * The VelocityZoneEditor renders a SampleNameSelect dropdown for
 * the active zone, populated from the device's resident sample list.
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

test.describe('S3000XL Sample Headers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);
    await selectFirstProgram(page);
    await navigateToKeygroups(page);
    await waitForKeygroupListLoaded(page);
    await selectFirstKeygroupAndWaitForEditor(page);
  });

  test('sample names are loaded in velocity zone dropdown', async ({ page }) => {
    // The sample select dropdown should have more options than just "(none)"
    // if samples are resident on the device. This verifies the RSLIST SysEx
    // request successfully fetched sample names from the S3000XL.
    const sampleSelect = zoneSampleSelect(page);
    await expect(sampleSelect).toBeVisible();

    // Wait for sample names to load from device (RSLIST SysEx).
    // The dropdown starts with just "(none)" and populates asynchronously.
    await expect(async () => {
      const count = await sampleSelect.locator('option').count();
      expect(count).toBeGreaterThan(1);
    }).toPass({ timeout: 15_000 });
  });

  test('sample dropdown options contain non-empty sample names', async ({ page }) => {
    // Verify that at least one sample option has a meaningful name
    // (not empty, not just whitespace). This confirms the RSLIST response
    // was parsed correctly into displayable sample names.
    const sampleSelect = zoneSampleSelect(page);
    await expect(sampleSelect).toBeVisible();

    const options = sampleSelect.locator('option');
    const count = await options.count();

    // Skip the first option which is "(none)"
    let foundNonEmpty = false;
    for (let i = 1; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text && text.trim().length > 0 && text.trim() !== '(unnamed)') {
        foundNonEmpty = true;
        break;
      }
    }

    expect(foundNonEmpty).toBe(true);
  });
});
