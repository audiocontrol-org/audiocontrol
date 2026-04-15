/**
 * E2E test for sample editor parameter round-trip on Akai S3000XL via SCSI.
 *
 * Verifies that sample header parameters can be read, edited via the UI,
 * written to the device, and read back with the correct values.
 *
 * Requires:
 *   - Raspberry Pi running s2p and scsi-midi-bridge
 *   - Akai S3000XL connected via SCSI with at least one sample loaded
 */

import { test, expect } from '@playwright/test';

import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';

test.setTimeout(60_000);

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
const EDITOR_BASE_PATH = '/akai/s3000xl/editor';

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, BRIDGE_URL);
}

type Page = import('@playwright/test').Page;

// ---------------------------------------------------------------------------
// Navigation helpers
// ---------------------------------------------------------------------------

async function navigateToSamples(page: Page): Promise<void> {
  const samplesLink = page.locator('a[href*="samples"]');
  await samplesLink.click();
  await page.waitForURL('**/samples**');
}

async function waitForSampleEditor(page: Page): Promise<void> {
  await expect(
    page.locator('.s3k-section-title', { hasText: 'Basic' }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// ParamKnob helpers
// ---------------------------------------------------------------------------

function paramKnobValue(page: Page, label: string) {
  return page
    .locator('.s3k-param', {
      has: page.locator(`.s3k-param-label:text-is("${label}")`),
    })
    .locator('.s3k-param-value');
}

async function readParamKnobValue(page: Page, label: string): Promise<number> {
  const text = await paramKnobValue(page, label).textContent();
  return Number(text?.trim());
}

async function setParamKnobValue(
  page: Page,
  label: string,
  value: string,
): Promise<void> {
  const valueBtn = paramKnobValue(page, label);
  await valueBtn.click();
  const input = page
    .locator('.s3k-param', {
      has: page.locator(`.s3k-param-label:text-is("${label}")`),
    })
    .locator('.s3k-param-input');
  await expect(input).toBeVisible({ timeout: 2_000 });
  await input.fill(value);
  await input.press('Enter');
}

// ---------------------------------------------------------------------------
// ParamSelect helpers
// ---------------------------------------------------------------------------

function paramSelectLocator(page: Page, label: string) {
  return page
    .locator('.s3k-param', {
      has: page.locator(`.s3k-param-label:text-is("${label}")`),
    })
    .locator('.s3k-param-select');
}

async function readParamSelectValue(
  page: Page,
  label: string,
): Promise<string> {
  const select = paramSelectLocator(page, label);
  return await select.inputValue();
}

async function setParamSelectValue(
  page: Page,
  label: string,
  value: string,
): Promise<void> {
  const select = paramSelectLocator(page, label);
  await select.selectOption(value);
}

// ---------------------------------------------------------------------------
// Refresh helper
// ---------------------------------------------------------------------------

async function refreshSampleFromDevice(page: Page): Promise<void> {
  // The per-item refresh button appears on hover — use force click
  const refreshBtn = page
    .locator('button[title="Reload from device"]')
    .first();
  await refreshBtn.click({ force: true });
  await waitForSampleEditor(page);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('S3000XL Sample Editor Round-Trip (SCSI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);

    // Navigate to Samples via nav bar
    await page.locator('a[href*="samples"]').click();
    await page.waitForURL('**/samples**');

    // Wait for sample list to populate
    await expect(
      page.locator('[data-testid^="sample-item-"]').first(),
    ).toBeVisible({ timeout: 30_000 });

    // Select first sample
    await page.locator('[data-testid="sample-item-0"]').click();
    await waitForSampleEditor(page);
  });

  test('sample editor shows Basic section fields', async ({ page }) => {
    const labels = ['Original Key', 'Bandwidth', 'Sample Rate', 'Playback Mode'];
    for (const label of labels) {
      await expect(
        page.locator(`.s3k-param-label:text-is("${label}")`),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('changing Original Key round-trips with device', async ({ page }) => {
    const original = await readParamKnobValue(page, 'Original Key');

    // Pick a value different from current
    const newValue = original >= 60 ? 48 : 72;
    await setParamKnobValue(page, 'Original Key', String(newValue));
    await page.waitForTimeout(1500);

    // Refresh from device and verify
    await refreshSampleFromDevice(page);
    const afterRefresh = await readParamKnobValue(page, 'Original Key');
    expect(
      afterRefresh,
      `Original Key should be ${newValue} after round-trip`,
    ).toBe(newValue);

    // Restore original value
    await setParamKnobValue(page, 'Original Key', String(original));
    await page.waitForTimeout(1000);
  });

  test('changing Playback Mode round-trips with device', async ({ page }) => {
    const original = await readParamSelectValue(page, 'Playback Mode');

    // Pick a different option: toggle between "0" (Looping) and "2" (No Loop)
    const newValue = original === '0' ? '2' : '0';
    await setParamSelectValue(page, 'Playback Mode', newValue);
    await page.waitForTimeout(1500);

    // Refresh from device and verify
    await refreshSampleFromDevice(page);
    const afterRefresh = await readParamSelectValue(page, 'Playback Mode');
    expect(
      afterRefresh,
      `Playback Mode should be ${newValue} after round-trip`,
    ).toBe(newValue);

    // Restore original value
    await setParamSelectValue(page, 'Playback Mode', original);
    await page.waitForTimeout(1000);
  });

  test('changing Tune Offset round-trips with device', async ({ page }) => {
    const original = await readParamKnobValue(page, 'Tune Offset');

    // Pick a value different from current (bipolar range: -3600 to 3600)
    const newValue = original >= 0 ? -100 : 100;
    await setParamKnobValue(page, 'Tune Offset', String(newValue));
    await page.waitForTimeout(1500);

    // Refresh from device and verify
    await refreshSampleFromDevice(page);
    const afterRefresh = await readParamKnobValue(page, 'Tune Offset');
    expect(
      afterRefresh,
      `Tune Offset should be ${newValue} after round-trip`,
    ).toBe(newValue);

    // Restore original value
    await setParamKnobValue(page, 'Tune Offset', String(original));
    await page.waitForTimeout(1000);
  });
});
