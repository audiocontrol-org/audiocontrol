/**
 * Live S-550 patch capability conformance checks verified by fresh device
 * readback.
 *
 * Initial bounded coverage target:
 *   - D-PATCH-02: Assign patch key mode
 *
 * Run via:
 *   E2E_DEVICE_TYPE=s550 PLAYWRIGHT_CONFIG=playwright.s550-conformance.config.ts \
 *   ./scripts/run-http-midi-e2e.sh test/e2e/s550-D-PATCH-live-core.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';
import { readPatchFromDevice } from './helpers/device-readback-helpers';

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's550';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 10_000;
const DATA_LOAD_TIMEOUT_MS = 20_000;
const WRITE_FLUSH_MS = 2_500;

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

async function navigateToPatchesPage(page: Page): Promise<void> {
  await page.goto(buildUrl('patches'), { timeout: UI_TIMEOUT_MS });
  await page.waitForURL('**/patches**');
  await expect(page.locator('[data-testid^="patch-item-"]').first()).toBeVisible({
    timeout: DATA_LOAD_TIMEOUT_MS,
  });
}

async function findFirstNonEmptyPatchIndex(page: Page): Promise<number | null> {
  const patchItems = page.locator('[data-testid^="patch-item-"]');
  const count = await patchItems.count();

  for (let i = 0; i < count; i += 1) {
    const item = patchItems.nth(i);
    const nameEl = item.locator('[data-testid="patch-name"]');

    if ((await nameEl.count()) === 0) continue;

    const name = await nameEl.textContent();
    if (name && name.trim() && !name.includes('(empty)') && !name.includes('(not loaded)')) {
      const testId = await item.getAttribute('data-testid');
      const match = testId?.match(/patch-item-(\d+)/);
      if (match) return Number(match[1]);
    }
  }

  return null;
}

async function selectPatch(page: Page, patchIndex: number): Promise<void> {
  const patchItem = page.locator(`[data-testid="patch-item-${patchIndex}"]`);
  await expect(patchItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await patchItem.click();
  await expect(page.getByTestId('patch-editor')).toBeVisible({
    timeout: DATA_LOAD_TIMEOUT_MS,
  });
}

async function openSelectedPatch(page: Page): Promise<number> {
  await navigateToPatchesPage(page);

  const foundIndex = await findFirstNonEmptyPatchIndex(page);
  expect(foundIndex, 'Expected at least one non-empty patch on the live S-550').not.toBeNull();
  const patchIndex = foundIndex!;

  await selectPatch(page, patchIndex);
  return patchIndex;
}

async function patchKeyModeSelect(page: Page) {
  const keyModeSelect = page.locator('[data-testid="patch-key-mode"]');
  await expect(keyModeSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
  return keyModeSelect;
}

test.describe('S-550 live patch capability conformance', () => {
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
  });

  test('D-PATCH-02: visible Key Mode select writes through to live hardware', async ({ page }) => {
    const patchIndex = await openSelectedPatch(page);
    const keyModeSelect = await patchKeyModeSelect(page);

    const originalValue = await keyModeSelect.inputValue();
    const newValue = originalValue === 'v-sw' ? 'normal' : 'v-sw';

    await keyModeSelect.selectOption(newValue);
    await page.waitForTimeout(WRITE_FLUSH_MS);

    try {
      const devicePatch = await readPatchFromDevice(page, patchIndex);
      expect(devicePatch).not.toBeNull();
      expect(devicePatch!.keyMode).toBe(newValue);
    } finally {
      await navigateToPatchesPage(page);
      await selectPatch(page, patchIndex);

      const restoreSelect = await patchKeyModeSelect(page);
      await restoreSelect.selectOption(originalValue);
      await page.waitForTimeout(WRITE_FLUSH_MS);

      const restoredPatch = await readPatchFromDevice(page, patchIndex);
      expect(restoredPatch).not.toBeNull();
      expect(restoredPatch!.keyMode).toBe(originalValue);
    }
  });
});
