/**
 * Live S-550 tone conformance checks for one visible slider affordance and
 * one visible envelope affordance, both verified by fresh device readback.
 *
 * Coverage targets:
 *   - D-TONE-TVF-02: Edit TVF cutoff (0–127)
 *   - D-TONE-ENV-10: Assign TVA envelope sustain point (0–7)
 *
 * Run via:
 *   E2E_DEVICE_TYPE=s550 PLAYWRIGHT_CONFIG=playwright.s550-conformance.config.ts \
 *   ./scripts/run-http-midi-e2e.sh test/e2e/s550-D-TONE-live-envelope-and-slider.spec.ts
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';
import { readToneFromDevice } from './helpers/device-readback-helpers';

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's550';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 10_000;
const DATA_LOAD_TIMEOUT_MS = 20_000;
const WRITE_FLUSH_MS = 2_500;
const ACTION_TIMEOUT_MS = 3_000;

function buildUrl(subpath = ''): string {
  const normalized = subpath === '/' ? '' : subpath;
  const fullPath = normalized
    ? `${EDITOR_BASE_PATH}/${normalized}`
    : EDITOR_BASE_PATH;
  if (!MIDI_SERVER_PORT) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}midi=http&midiServerPort=${MIDI_SERVER_PORT}`;
}

function attachConsoleDebugListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('S330Client') ||
      text.includes('S550Client') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log('BROWSER:', text);
    }
  });
}

async function findFirstNonEmptyToneIndex(page: Page): Promise<number | null> {
  const toneItems = page.locator('[data-testid^="tone-item-"]');
  const count = await toneItems.count();

  for (let i = 0; i < count; i += 1) {
    const item = toneItems.nth(i);
    const nameEl = item.locator('[data-testid="tone-name"]');

    if ((await nameEl.count()) === 0) continue;

    const name = await nameEl.textContent();
    if (name && name.trim() && !name.includes('(empty)')) {
      const testId = await item.getAttribute('data-testid');
      const match = testId?.match(/tone-item-(\d+)/);
      if (match) return Number(match[1]);
    }
  }

  return null;
}

async function selectTone(page: Page, toneIndex: number): Promise<void> {
  const toneItem = page.locator(`[data-testid="tone-item-${toneIndex}"]`);
  await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await toneItem.click({ timeout: ACTION_TIMEOUT_MS });
  await expect(page.locator('[data-testid="tone-detail"]')).toBeVisible({
    timeout: DATA_LOAD_TIMEOUT_MS,
  });
}

async function switchToToneTab(page: Page, label: 'Filter' | 'Amp'): Promise<void> {
  const tab = page.getByRole('tab', { name: label });
  await expect(tab).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await tab.click();
}

async function driveSliderToValue(slider: Locator, targetValue: number): Promise<void> {
  const currentValue = Number(await slider.getAttribute('aria-valuenow') ?? '64');
  const diff = targetValue - currentValue;

  await slider.focus();
  if (diff > 0) {
    for (let i = 0; i < diff; i += 1) {
      await slider.press('ArrowRight');
    }
  } else {
    for (let i = 0; i < Math.abs(diff); i += 1) {
      await slider.press('ArrowLeft');
    }
  }
  await slider.blur();
}

async function selectEnvelopePip(
  panel: Locator,
  kind: 'sustain' | 'end',
  uiIndex: number,
): Promise<void> {
  const groupLabel = kind === 'sustain' ? 'Sustain segment' : 'Envelope length';
  const group = panel.locator(`[aria-label="${groupLabel}"]`).first();
  await expect(group).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await group.locator('[role="radio"]').nth(uiIndex - 1).click();
}

test.describe('S-550 live tone capability conformance', () => {
  let testToneIndex: number;

  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via the HTTP-MIDI hardware harness.',
      );
    }
    if (DEVICE_TYPE !== 's550') {
      throw new Error(
        `This suite targets the live S-550 route only. Received E2E_DEVICE_TYPE=${DEVICE_TYPE}.`,
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);

    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    await page.goto(buildUrl('tones'), { timeout: UI_TIMEOUT_MS });
    await page.waitForURL('**/tones**');
    await expect(page.locator('[data-testid^="tone-item-"]').first()).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });

    const foundIndex = await findFirstNonEmptyToneIndex(page);
    if (foundIndex === null) {
      test.skip(true, 'No non-empty tones found on device');
      return;
    }

    testToneIndex = foundIndex;
    await selectTone(page, testToneIndex);
  });

  test('D-TONE-TVF-02: visible TVF cutoff slider writes through to live hardware', async ({ page }) => {
    await switchToToneTab(page, 'Filter');

    const tvfCheckbox = page.locator('[data-testid="tone-tvf-enabled"]');
    await expect(tvfCheckbox).toBeVisible({ timeout: UI_TIMEOUT_MS });
    if (!(await tvfCheckbox.isChecked())) {
      await tvfCheckbox.click();
      await page.waitForTimeout(WRITE_FLUSH_MS);
    }

    const filterPanel = page.getByRole('tabpanel', { name: 'Filter' });
    await expect(filterPanel).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const slider = filterPanel.getByRole('slider', { name: 'Cutoff' });
    await expect(slider).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalValue = Number(await slider.getAttribute('aria-valuenow') ?? '64');
    const newValue = originalValue >= 90 ? 60 : 90;

    await driveSliderToValue(slider, newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.tvf.enabled).toBe(true);
    expect(Math.abs(deviceTone!.tvf.cutoff - newValue)).toBeLessThanOrEqual(1);
  });

  test('D-TONE-ENV-10: visible TVA sustain pip writes through to live hardware', async ({ page }) => {
    await switchToToneTab(page, 'Amp');

    const ampPanel = page.getByRole('tabpanel', { name: 'Amp' });
    await expect(ampPanel).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const sustainGroup = ampPanel.locator('[aria-label="Sustain segment"]').first();
    await expect(sustainGroup).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const activePip = sustainGroup.locator('[role="radio"][aria-checked="true"]').first();
    await expect(activePip).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const originalUiIndex = Number((await activePip.textContent())?.trim() ?? '1');
    const newUiIndex = originalUiIndex >= 5 ? 3 : 5;

    await selectEnvelopePip(ampPanel, 'sustain', newUiIndex);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    const deviceTone = await readToneFromDevice(page, testToneIndex);
    expect(deviceTone).not.toBeNull();
    expect(deviceTone!.tva.envelope.sustainPoint).toBe(newUiIndex - 1);
  });
});
