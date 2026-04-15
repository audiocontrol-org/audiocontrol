/**
 * SCSI MIDI bridge e2e tests for sample header reading on Akai S3000XL.
 *
 * Mirrors device-sample-headers.spec.ts but uses the SCSI transport
 * via the Pi bridge daemon instead of MIDI cable.
 *
 * These tests require:
 *   - Raspberry Pi running s2p and scsi-midi-bridge
 *   - Akai S3000XL connected via SCSI with at least one sample loaded
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';

test.setTimeout(30_000);

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

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

async function navigateToKeygroups(page: import('@playwright/test').Page): Promise<void> {
  const keygroupsLink = page.locator('a[href*="keygroups"]');
  await keygroupsLink.click();
  await page.waitForURL('**/keygroups**');
}

async function waitForKeygroupListLoaded(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('button', { hasText: 'KG 1' })).toBeVisible({
    timeout: 15_000,
  });
}

async function selectFirstKeygroupAndWaitForEditor(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.locator('button', { hasText: 'KG 1' }).click();
  await expect(page.locator('text=Keygroup 1:').first()).toBeVisible({
    timeout: 10_000,
  });
}

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

test.describe('S3000XL Sample Headers (SCSI)', () => {
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
    const sampleSelect = zoneSampleSelect(page);
    await expect(sampleSelect).toBeVisible();

    await expect(async () => {
      const count = await sampleSelect.locator('option').count();
      expect(count).toBeGreaterThan(1);
    }).toPass({ timeout: 15_000 });
  });

  test('sample dropdown options contain non-empty sample names', async ({ page }) => {
    const sampleSelect = zoneSampleSelect(page);
    await expect(sampleSelect).toBeVisible();

    const options = sampleSelect.locator('option');
    const count = await options.count();

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
