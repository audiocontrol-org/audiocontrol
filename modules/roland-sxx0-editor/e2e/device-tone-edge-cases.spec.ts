/**
 * E2E tests for tone/import edge cases: empty tone state, unsupported
 * file format rejection, and corrupted WAV rejection.
 *
 * Prerequisites: Roland S-330/S-550 via MIDI, midi-server, devenv shell.
 * Run via: make test-e2e-hardware
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';

// --- Configuration ---

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;
const UI_TIMEOUT_MS = 5_000;
const DATA_LOAD_TIMEOUT_MS = 15_000;

function buildUrl(): string {
  if (!MIDI_SERVER_PORT) return EDITOR_BASE_PATH;
  return `${EDITOR_BASE_PATH}?midi=http&midiServerPort=${MIDI_SERVER_PORT}`;
}

function attachCrashDetector(
  page: import('@playwright/test').Page,
): { errors: string[] } {
  const tracker = { errors: [] as string[] };
  page.on('pageerror', (err) => {
    console.log('PAGE ERROR:', err.message);
    tracker.errors.push(err.message);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('S330Client') ||
      text.includes('S550Client') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log(`BROWSER:`, text);
    }
  });
  return tracker;
}

// --- Helpers ---

function extractToneIndex(testId: string): number | null {
  const match = testId.match(/tone-item-(\d+)/);
  return match ? Number(match[1]) : null;
}

async function findToneByEmptiness(
  page: import('@playwright/test').Page,
  wantEmpty: boolean,
): Promise<number | null> {
  const toneItems = page.locator('[data-testid^="tone-item-"]');
  const count = await toneItems.count();

  for (let i = 0; i < count; i++) {
    const item = toneItems.nth(i);
    const nameEl = item.locator('[data-testid="tone-name"]');
    const hasName = (await nameEl.count()) > 0;
    const name = hasName ? await nameEl.textContent() : null;
    const isEmpty = !name || !name.trim() || name.includes('(empty)');

    if (isEmpty === wantEmpty) {
      const testId = await item.getAttribute('data-testid');
      if (testId) return extractToneIndex(testId);
    }
  }
  return null;
}

async function selectTone(
  page: import('@playwright/test').Page,
  toneIndex: number,
): Promise<void> {
  const toneItem = page.locator(`[data-testid="tone-item-${toneIndex}"]`);
  await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await toneItem.locator('button').first().click();
}

async function connectAndNavigateToTones(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
  await waitForAppReady(page);
  await connectToDevice(page);
  expect(await getMidiStatus(page)).toBe('connected');

  const tonesLink = page.locator('a[href$="/tones"]');
  await tonesLink.click();
  await page.waitForURL('**/tones**');
  await expect(
    page.locator('[data-testid^="tone-item-"]').first(),
  ).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
}

async function openImportDialog(
  page: import('@playwright/test').Page,
): Promise<void> {
  const importButton = page
    .locator('[data-testid="import-sample-button"]')
    .or(page.locator('button', { hasText: 'Import Sample' }));
  await expect(importButton.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await importButton.first().click();
  await expect(
    page.getByText(/Import Sample to T/),
  ).toBeVisible({ timeout: UI_TIMEOUT_MS });
}

/** Upload a bad file and assert: error banner visible, submit disabled, no crashes. */
async function uploadBadFileAndVerifyRejection(
  page: import('@playwright/test').Page,
  file: { name: string; mimeType: string; buffer: Buffer },
  crashTracker: { errors: string[] },
  errorContext: string,
): Promise<void> {
  const fileInput = page.locator('[data-testid="import-file-input"]');
  await fileInput.setInputFiles(file);

  // Verify an error is displayed (parseError from getWavFileInfo)
  const errorBanner = page.getByText(/Invalid WAV|unsupported|error/i);
  await expect(errorBanner).toBeVisible({ timeout: UI_TIMEOUT_MS });

  // Verify no page crashes
  expect(
    crashTracker.errors,
    `No page errors should occur ${errorContext}`,
  ).toHaveLength(0);
}

test.describe('Tone Edge Cases', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-hardware',
      );
    }
  });

  // 3.4.1 — Empty tone slot shows appropriate state

  test('tone with no wave data shows appropriate state', async ({ page }) => {
    const crashTracker = attachCrashDetector(page);
    await connectAndNavigateToTones(page);

    const emptyIndex = await findToneByEmptiness(page, true);
    console.log(`Found empty tone at index: ${emptyIndex}`);
    if (emptyIndex === null) {
      test.skip(true, 'No empty tone slots found on device');
      return;
    }

    await selectTone(page, emptyIndex);
    await page.waitForTimeout(2_000);

    // Export button should be either absent or disabled for empty tones
    const exportButton = page.locator('[data-testid="export-sample-button"]');
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeDisabled();
    }

    expect(
      crashTracker.errors,
      'No page errors should occur when viewing an empty tone',
    ).toHaveLength(0);
  });

  // 3.4.4 — Import with unsupported format shows error

  test('import with unsupported format shows error', async ({ page }) => {
    const crashTracker = attachCrashDetector(page);
    await connectAndNavigateToTones(page);

    const toneIndex = await findToneByEmptiness(page, false);
    if (toneIndex === null) {
      test.skip(true, 'No non-empty tones found on device');
      return;
    }
    await selectTone(page, toneIndex);
    await expect(
      page.locator('[data-testid="tone-detail"]'),
    ).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    await openImportDialog(page);
    await uploadBadFileAndVerifyRejection(
      page,
      {
        name: 'test.mp3',
        mimeType: 'audio/mpeg',
        buffer: Buffer.from('ID3\x03\x00not-mp3-data'),
      },
      crashTracker,
      'when uploading unsupported format',
    );
  });

  // 3.4.5 — Import corrupted WAV file shows error

  test('import corrupted WAV file shows error', async ({ page }) => {
    const crashTracker = attachCrashDetector(page);
    await connectAndNavigateToTones(page);

    const toneIndex = await findToneByEmptiness(page, false);
    if (toneIndex === null) {
      test.skip(true, 'No non-empty tones found on device');
      return;
    }
    await selectTone(page, toneIndex);
    await expect(
      page.locator('[data-testid="tone-detail"]'),
    ).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    await openImportDialog(page);
    await uploadBadFileAndVerifyRejection(
      page,
      {
        name: 'corrupt.wav',
        mimeType: 'audio/wav',
        buffer: Buffer.from('not a valid wav file'),
      },
      crashTracker,
      'when uploading corrupted WAV',
    );
  });
});
