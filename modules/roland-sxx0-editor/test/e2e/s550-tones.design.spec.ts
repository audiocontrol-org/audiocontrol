/**
 * Live S-550 Tones page design conformance checks.
 *
 * This suite verifies the shared Tones page on the live
 * `/roland/s550/editor/tones` route against the approved redesign
 * direction: fixed shell chrome, reachable title-row controls, visible
 * list/detail composition, and the default empty-detail state before a
 * row is selected.
 *
 * Run via:
 *   make test-e2e-roland-device-conformance
 */

import { test, expect, type Locator, type Page } from '@playwright/test';

import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';

test.setTimeout(90_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's550';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 10_000;
const DATA_LOAD_TIMEOUT_MS = 20_000;
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

async function expectReceivesPointer(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
  await locator.scrollIntoViewIfNeeded();
  await locator.click({ trial: true, timeout: ACTION_TIMEOUT_MS });

  const handle = await locator.elementHandle();
  expect(handle).not.toBeNull();

  const box = await handle?.boundingBox();
  expect(box).not.toBeNull();

  const receivesPointer = await handle?.evaluate((el, point) => {
    const top = document.elementsFromPoint(point.x, point.y)[0];
    return top === el
      || (top instanceof Element && (top.contains(el) || el.contains(top)));
  }, {
    x: (box?.x ?? 0) + ((box?.width ?? 0) / 2),
    y: (box?.y ?? 0) + ((box?.height ?? 0) / 2),
  });

  expect(receivesPointer).toBe(true);
}

test.describe('S-550 live Tones-page design conformance', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-roland-device-conformance',
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
  });

  test('fixed tones shell exposes title-row chrome and the default list/detail composition', async ({
    page,
  }) => {
    const pageShell = page.locator('.ac-page-shell--fixed-viewport');
    const titleRow = page.locator('.ac-page-title-row');
    const appShell = page.locator('.ac-app-shell');
    const refreshButton = page.getByRole('button', { name: 'Refresh all tones from device' });
    const toneItems = page.locator('[data-testid^="tone-item-"]');

    await expect(pageShell).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(titleRow).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(page.getByRole('heading', { name: 'Tones' })).toBeVisible();
    await expect(appShell).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(refreshButton).toBeEnabled({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expectReceivesPointer(refreshButton);
    await expect(page.getByTestId('error-message')).toHaveCount(0);

    await expect(page.getByText(/of 64 loaded/)).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(
      toneItems.filter({ has: page.getByTestId('tone-name') }).first(),
    ).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    await expect(page.getByText('Select a tone to edit')).toBeVisible({
      timeout: DATA_LOAD_TIMEOUT_MS,
    });
  });
});
