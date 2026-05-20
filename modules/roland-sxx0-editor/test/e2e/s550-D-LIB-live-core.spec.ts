/**
 * Live S-550 library capability conformance checks verified through the real
 * OPFS-backed Library route.
 *
 * Initial bounded coverage target:
 *   - D-LIB-10: Save full device state to a named library set
 *
 * Run via:
 *   E2E_DEVICE_TYPE=s550 PLAYWRIGHT_CONFIG=playwright.s550-conformance.config.ts \
 *   ./scripts/run-http-midi-e2e.sh test/e2e/s550-D-LIB-live-core.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

import {
  connectToDevice,
  connectToOPFS,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's550';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 10_000;
const DATA_LOAD_TIMEOUT_MS = 20_000;
const SET_SAVE_TIMEOUT_MS = 45_000;

interface SavedSetSnapshot {
  setDirectoryExists: boolean;
  hasManifest: boolean;
  hasTonesDirectory: boolean;
  hasPatchesDirectory: boolean;
  toneEntryCount: number;
  patchEntryCount: number;
}

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

async function readSavedSetSnapshot(page: Page, setName: string): Promise<SavedSetSnapshot> {
  return page.evaluate(async (targetSetName) => {
    const root = await navigator.storage.getDirectory();
    const result: SavedSetSnapshot = {
      setDirectoryExists: false,
      hasManifest: false,
      hasTonesDirectory: false,
      hasPatchesDirectory: false,
      toneEntryCount: 0,
      patchEntryCount: 0,
    };

    try {
      const libraryDir = await root.getDirectoryHandle('library');
      const setsDir = await libraryDir.getDirectoryHandle('sets');
      const setDir = await setsDir.getDirectoryHandle(targetSetName);

      result.setDirectoryExists = true;

      try {
        await setDir.getFileHandle('set.yaml');
        result.hasManifest = true;
      } catch {
        result.hasManifest = false;
      }

      try {
        const tonesDir = await setDir.getDirectoryHandle('tones');
        result.hasTonesDirectory = true;
        for await (const _entry of tonesDir.values()) {
          result.toneEntryCount += 1;
        }
      } catch {
        result.hasTonesDirectory = false;
      }

      try {
        const patchesDir = await setDir.getDirectoryHandle('patches');
        result.hasPatchesDirectory = true;
        for await (const _entry of patchesDir.values()) {
          result.patchEntryCount += 1;
        }
      } catch {
        result.hasPatchesDirectory = false;
      }
    } catch {
      return result;
    }

    return result;
  }, setName);
}

test.describe('S-550 live library capability conformance', () => {
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

    await page.goto(buildUrl('library'), { timeout: UI_TIMEOUT_MS });
    await page.waitForURL('**/library**');
    await connectToOPFS(page);
  });

  test('D-LIB-10: Save to Library creates a named set in OPFS on the live S-550 route', async ({
    page,
  }) => {
    const saveSetButton = page.getByTestId('save-set-button');
    await expect(saveSetButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveSetButton).toBeEnabled({ timeout: DATA_LOAD_TIMEOUT_MS });

    await saveSetButton.click();

    const setName = `s550-live-set-${Date.now()}`;
    const setNameInput = page.getByTestId('set-name-input');
    await expect(setNameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await setNameInput.fill(setName);

    const confirmSaveButton = page.getByTestId('confirm-save-set');
    await expect(confirmSaveButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmSaveButton.click();

    {
      const POLL_MS = 2_000;
      const MAX_POLLS = Math.ceil(SET_SAVE_TIMEOUT_MS / POLL_MS);
      let saved = false;

      for (let poll = 0; poll < MAX_POLLS && !saved; poll += 1) {
        await page.waitForTimeout(POLL_MS);
        saved = await page.locator('[data-testid="save-success"]').isVisible();
        if (!saved && poll % 5 === 0) {
          const status = await page
            .locator('[data-testid="save-progress"]')
            .textContent()
            .catch(() => '');
          console.log(`Save progress: ${status || 'working...'}`);
        }
      }

      expect(saved, 'Set save did not complete in time').toBe(true);
    }

    const setItem = page.locator(`[data-testid="set-item-${setName}"]`);
    await expect(setItem).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    const snapshot = await readSavedSetSnapshot(page, setName);
    expect(snapshot.setDirectoryExists).toBe(true);
    expect(snapshot.hasManifest).toBe(true);
    expect(snapshot.hasTonesDirectory).toBe(true);
    expect(snapshot.hasPatchesDirectory).toBe(true);
    expect(snapshot.toneEntryCount + snapshot.patchEntryCount).toBeGreaterThan(0);
  });
});
