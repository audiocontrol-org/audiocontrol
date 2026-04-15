/**
 * E2E regression test for #280: Envelope→filter (E_FREQ) gets reset to 0
 * when changing any filter parameter via the web editor.
 *
 * Requires: Pi running s2p + scsi-midi-bridge with S3000XL connected.
 *
 * Strategy:
 * 1. Set E_FREQ to a known non-zero value (25) and CONFIRM via device refresh
 * 2. Change a different filter parameter via the UI
 * 3. Refresh from device
 * 4. Assert E_FREQ is still 25
 *
 * Tests every filter param: Freq, Resonance, Key Track, Vel→Filt, Press→Filt.
 * Also tests the drag path through the FilterDisplay.
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

async function selectFirstProgram(page: Page): Promise<void> {
  const programsLink = page.locator('a[href*="programs"]');
  await programsLink.click();
  await page.waitForURL('**/programs**');
  await expect(page.locator('[data-testid="program-item-0"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="program-item-0"]').click();
  await expect(page.locator('input[type="text"][maxlength="12"]')).toBeVisible({ timeout: 10_000 });
}

async function navigateToKeygroups(page: Page): Promise<void> {
  const keygroupsLink = page.locator('a[href*="keygroups"]');
  await keygroupsLink.click();
  await page.waitForURL('**/keygroups**');
}

async function waitForKeygroupEditor(page: Page): Promise<void> {
  await expect(page.locator('text=Keygroup 1:').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.s3k-section-title', { hasText: 'Filter' }).first()).toBeVisible({ timeout: 5_000 });
}

// ---------------------------------------------------------------------------
// ParamKnob helpers
// ---------------------------------------------------------------------------

function paramKnobValue(page: Page, label: string) {
  return page.locator('.s3k-param', {
    has: page.locator(`.s3k-param-label:text-is("${label}")`),
  }).locator('.s3k-param-value');
}

async function setParamKnobValue(page: Page, label: string, value: string): Promise<void> {
  const valueBtn = paramKnobValue(page, label);
  await valueBtn.click();
  const input = page.locator('.s3k-param', {
    has: page.locator(`.s3k-param-label:text-is("${label}")`),
  }).locator('.s3k-param-input');
  await expect(input).toBeVisible({ timeout: 2_000 });
  await input.fill(value);
  await input.press('Enter');
}

async function readParamKnobValue(page: Page, label: string): Promise<number> {
  const text = await paramKnobValue(page, label).textContent();
  return Number(text?.trim());
}

async function refreshKeygroups(page: Page): Promise<void> {
  const refreshBtn = page.locator('button[title="Reload keygroups from device"]');
  await refreshBtn.click();
  await waitForKeygroupEditor(page);
}

// ---------------------------------------------------------------------------
// Core test helper: set E_FREQ, confirm it, change another param, check E_FREQ
// ---------------------------------------------------------------------------

const E_FREQ_TEST_VALUE = 25;

/**
 * Set E_FREQ to a known value and confirm via device round-trip.
 * Returns the original E_FREQ value for restoration.
 */
async function setAndConfirmEFreq(page: Page): Promise<number> {
  const original = await readParamKnobValue(page, 'Env→Filt');

  // Always set to our known test value
  await setParamKnobValue(page, 'Env→Filt', String(E_FREQ_TEST_VALUE));
  await page.waitForTimeout(1500);

  // Confirm the device actually has the value
  await refreshKeygroups(page);
  const confirmed = await readParamKnobValue(page, 'Env→Filt');
  expect(confirmed, 'E_FREQ should be set to test value before exercising bug').toBe(E_FREQ_TEST_VALUE);

  return original;
}

/**
 * Change a filter parameter via click-to-edit, then verify E_FREQ is unchanged.
 */
async function changeParamAndCheckEFreq(
  page: Page,
  label: string,
  newValue: number,
): Promise<void> {
  await setParamKnobValue(page, label, String(newValue));
  await page.waitForTimeout(1500);

  await refreshKeygroups(page);

  const eFreqAfter = await readParamKnobValue(page, 'Env→Filt');
  expect(eFreqAfter, `E_FREQ should be ${E_FREQ_TEST_VALUE} after changing ${label}`).toBe(E_FREQ_TEST_VALUE);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Bug #280: E_FREQ reset on filter change', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url());
    await waitForAppReady(page);
    await connectToDevice(page);
    await selectFirstProgram(page);
    await navigateToKeygroups(page);
    await waitForKeygroupEditor(page);
  });

  test('changing Freq (FILFRQ) does not reset E_FREQ', async ({ page }) => {
    const originalEFreq = await setAndConfirmEFreq(page);
    const currentFreq = await readParamKnobValue(page, 'Freq');
    const newFreq = currentFreq >= 50 ? 30 : 70;

    await changeParamAndCheckEFreq(page, 'Freq', newFreq);

    // Restore
    await setParamKnobValue(page, 'Freq', String(currentFreq));
    await setParamKnobValue(page, 'Env→Filt', String(originalEFreq));
    await page.waitForTimeout(1000);
  });

  test('changing Resonance (FILQ) does not reset E_FREQ', async ({ page }) => {
    const originalEFreq = await setAndConfirmEFreq(page);
    const currentQ = await readParamKnobValue(page, 'Resonance');
    const newQ = currentQ >= 8 ? 3 : 12;

    await changeParamAndCheckEFreq(page, 'Resonance', newQ);

    await setParamKnobValue(page, 'Resonance', String(currentQ));
    await setParamKnobValue(page, 'Env→Filt', String(originalEFreq));
    await page.waitForTimeout(1000);
  });

  test('changing Key Track (K_FREQ) does not reset E_FREQ', async ({ page }) => {
    const originalEFreq = await setAndConfirmEFreq(page);
    const current = await readParamKnobValue(page, 'Key Track');
    const newVal = current >= 0 ? -20 : 20;

    await changeParamAndCheckEFreq(page, 'Key Track', newVal);

    await setParamKnobValue(page, 'Key Track', String(current));
    await setParamKnobValue(page, 'Env→Filt', String(originalEFreq));
    await page.waitForTimeout(1000);
  });

  test('changing Vel→Filt (V_FREQ) does not reset E_FREQ', async ({ page }) => {
    const originalEFreq = await setAndConfirmEFreq(page);
    const current = await readParamKnobValue(page, 'Vel→Filt');
    const newVal = current >= 0 ? -15 : 15;

    await changeParamAndCheckEFreq(page, 'Vel→Filt', newVal);

    await setParamKnobValue(page, 'Vel→Filt', String(current));
    await setParamKnobValue(page, 'Env→Filt', String(originalEFreq));
    await page.waitForTimeout(1000);
  });

  test('changing Press→Filt (P_FREQ) does not reset E_FREQ', async ({ page }) => {
    const originalEFreq = await setAndConfirmEFreq(page);
    const current = await readParamKnobValue(page, 'Press→Filt');
    const newVal = current >= 0 ? -10 : 10;

    await changeParamAndCheckEFreq(page, 'Press→Filt', newVal);

    await setParamKnobValue(page, 'Press→Filt', String(current));
    await setParamKnobValue(page, 'Env→Filt', String(originalEFreq));
    await page.waitForTimeout(1000);
  });

  test('dragging FilterDisplay node does not reset E_FREQ', async ({ page }) => {
    const originalEFreq = await setAndConfirmEFreq(page);
    const originalFreq = await readParamKnobValue(page, 'Freq');
    const originalQ = await readParamKnobValue(page, 'Resonance');

    // Find the FilterDisplay SVG draggable node
    const filterSvg = page.locator('svg[aria-label^="Filter:"]').first();
    await expect(filterSvg).toBeVisible({ timeout: 5_000 });

    const dragNode = filterSvg.locator('.s3k-adsr-dot--draggable').first();
    await expect(dragNode).toBeVisible();

    const box = await dragNode.boundingBox();
    expect(box).toBeTruthy();

    // Drag horizontally — changes FILFRQ and FILQ simultaneously
    // via onDragChange → handleDragChange, then onCommit → handleCommitHeader
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 50, box!.y + box!.height / 2, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(2000);

    // Refresh and check E_FREQ
    await refreshKeygroups(page);
    const eFreqAfter = await readParamKnobValue(page, 'Env→Filt');
    expect(eFreqAfter, 'E_FREQ should survive filter display drag').toBe(E_FREQ_TEST_VALUE);

    // Restore
    await setParamKnobValue(page, 'Freq', String(originalFreq));
    await setParamKnobValue(page, 'Resonance', String(originalQ));
    await setParamKnobValue(page, 'Env→Filt', String(originalEFreq));
    await page.waitForTimeout(1000);
  });
});
