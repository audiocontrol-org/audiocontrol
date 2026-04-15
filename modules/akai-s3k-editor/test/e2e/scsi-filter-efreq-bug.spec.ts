/**
 * E2E regression test for #280: Envelope→filter (E_FREQ) gets reset to 0
 * when changing filter frequency or resonance via the web editor.
 *
 * Requires: Pi running s2p + scsi-midi-bridge with S3000XL connected.
 *
 * Test flow:
 * 1. Navigate to keygroups, select first keygroup
 * 2. Read the current E_FREQ (Env→Filt) value from the UI
 * 3. Set E_FREQ to a known non-zero value if needed
 * 4. Change FILFRQ (Freq) to a different value
 * 5. Refresh from device (re-fetch keygroup header)
 * 6. Assert E_FREQ hasn't changed
 */

import { test, expect } from '@playwright/test';

// Deviation: relative import — e2e/ is outside src/ and @/ alias doesn't apply
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

async function selectFirstProgram(page: import('@playwright/test').Page): Promise<void> {
  const programsLink = page.locator('a[href*="programs"]');
  await programsLink.click();
  await page.waitForURL('**/programs**');
  await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="program-item-0"]').click();
  // Wait for program editor to render (program name input)
  await expect(page.locator('input[type="text"][maxlength="12"]')).toBeVisible({ timeout: 10_000 });
}

async function navigateToKeygroups(page: import('@playwright/test').Page): Promise<void> {
  const keygroupsLink = page.locator('a[href*="keygroups"]');
  await keygroupsLink.click();
  await page.waitForURL('**/keygroups**');
}

async function waitForKeygroupEditor(page: import('@playwright/test').Page): Promise<void> {
  // Wait for the keygroup editor title "Keygroup 1:" to appear
  await expect(page.locator('text=Keygroup 1:').first()).toBeVisible({ timeout: 15_000 });
  // Wait for the Filter section to be visible
  await expect(page.locator('.s3k-section-title', { hasText: 'Filter' }).first()).toBeVisible({ timeout: 5_000 });
}

/**
 * Find a ParamKnob's displayed value by its label text.
 * ParamKnob renders: <div class="s3k-param"><span class="s3k-param-label">LABEL</span>...<button class="s3k-param-value">VALUE</button></div>
 */
function paramKnobValue(page: import('@playwright/test').Page, label: string): import('@playwright/test').Locator {
  return page.locator('.s3k-param', { has: page.locator(`.s3k-param-label:text-is("${label}")`) }).locator('.s3k-param-value');
}

/**
 * Click a ParamKnob value to enter edit mode, clear, type a new value, press Enter.
 */
async function setParamKnobValue(page: import('@playwright/test').Page, label: string, value: string): Promise<void> {
  const valueBtn = paramKnobValue(page, label);
  await valueBtn.click();
  // After clicking, an input appears in the same s3k-param container
  const input = page.locator('.s3k-param', { has: page.locator(`.s3k-param-label:text-is("${label}")`) }).locator('.s3k-param-input');
  await expect(input).toBeVisible({ timeout: 2_000 });
  await input.fill(value);
  await input.press('Enter');
}

/**
 * Read the displayed numeric value from a ParamKnob.
 */
async function readParamKnobValue(page: import('@playwright/test').Page, label: string): Promise<number> {
  const text = await paramKnobValue(page, label).textContent();
  return Number(text?.trim());
}

async function refreshKeygroups(page: import('@playwright/test').Page): Promise<void> {
  // The keygroup list has a refresh button in the title bar
  const refreshBtn = page.locator('button[title="Reload keygroups from device"]');
  await refreshBtn.click();
  // Wait for keygroup data to reload
  await waitForKeygroupEditor(page);
}

test.describe('Bug #280: E_FREQ reset on filter change', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);
    await selectFirstProgram(page);
    await navigateToKeygroups(page);
    await waitForKeygroupEditor(page);
  });

  test('changing FILFRQ does not reset E_FREQ to 0', async ({ page }) => {
    // 1. Read current E_FREQ value
    const originalEFreq = await readParamKnobValue(page, 'Env→Filt');

    // 2. If E_FREQ is 0, set it to 25 so we can detect if it gets reset
    if (originalEFreq === 0) {
      await setParamKnobValue(page, 'Env→Filt', '25');
      await page.waitForTimeout(1500); // wait for device write
    }
    const expectedEFreq = originalEFreq === 0 ? 25 : originalEFreq;

    // 3. Change FILFRQ to a different value
    const currentFreq = await readParamKnobValue(page, 'FREQ');
    const newFreq = currentFreq === 50 ? 75 : 50;
    await setParamKnobValue(page, 'FREQ', String(newFreq));
    await page.waitForTimeout(1500); // wait for device write

    // 4. Refresh from device to get the actual values
    await refreshKeygroups(page);

    // 5. Read E_FREQ back — it should NOT be 0
    const eFreqAfter = await readParamKnobValue(page, 'Env→Filt');
    expect(eFreqAfter).toBe(expectedEFreq);

    // 6. Verify FILFRQ was actually written
    const freqAfter = await readParamKnobValue(page, 'FREQ');
    expect(freqAfter).toBe(newFreq);

    // Restore original values
    await setParamKnobValue(page, 'FREQ', String(currentFreq));
    if (originalEFreq === 0) {
      await setParamKnobValue(page, 'Env→Filt', '0');
    }
    await page.waitForTimeout(1500);
  });

  test('changing FILQ does not reset E_FREQ to 0', async ({ page }) => {
    // 1. Read current E_FREQ value
    const originalEFreq = await readParamKnobValue(page, 'Env→Filt');

    // 2. Set E_FREQ to 30 if it's 0
    if (originalEFreq === 0) {
      await setParamKnobValue(page, 'Env→Filt', '30');
      await page.waitForTimeout(1500);
    }
    const expectedEFreq = originalEFreq === 0 ? 30 : originalEFreq;

    // 3. Change FILQ (Resonance)
    const currentQ = await readParamKnobValue(page, 'RESONANCE');
    const newQ = currentQ === 8 ? 4 : 8;
    await setParamKnobValue(page, 'RESONANCE', String(newQ));
    await page.waitForTimeout(1500);

    // 4. Refresh from device
    await refreshKeygroups(page);

    // 5. E_FREQ should not be 0
    const eFreqAfter = await readParamKnobValue(page, 'Env→Filt');
    expect(eFreqAfter).toBe(expectedEFreq);

    // Restore
    await setParamKnobValue(page, 'RESONANCE', String(currentQ));
    if (originalEFreq === 0) {
      await setParamKnobValue(page, 'Env→Filt', '0');
    }
    await page.waitForTimeout(1500);
  });
});
