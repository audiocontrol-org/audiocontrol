/**
 * Live S-550 Patches page design conformance checks.
 *
 * This suite verifies the shared Patches page on the live
 * `/roland/s550/editor/patches` route against the approved redesign
 * direction: fixed shell chrome, reachable list/detail composition, and a
 * real loaded-patch row that can open the detail pane.
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

async function findFirstLoadedPatchIndex(page: Page): Promise<number | null> {
  const patchItems = page.locator('[data-testid^="patch-item-"]');
  const count = await patchItems.count();

  for (let i = 0; i < count; i += 1) {
    const item = patchItems.nth(i);
    const nameEl = item.locator('[data-testid="patch-name"]');

    if ((await nameEl.count()) === 0) continue;

    const name = await nameEl.textContent();
    if (name && name.trim() && !name.includes('(not loaded)') && !name.includes('(loading...)')) {
      const testId = await item.getAttribute('data-testid');
      const match = testId?.match(/patch-item-(\d+)/);
      if (match) return Number(match[1]);
    }
  }

  return null;
}

test.describe('S-550 live Patches-page design conformance', () => {
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

    await page.goto(buildUrl('patches'), { timeout: UI_TIMEOUT_MS });
    await page.waitForURL('**/patches**');
  });

  test('fixed patch shell exposes refresh chrome and a loaded patch row can open detail', async ({ page }) => {
    const pageShell = page.locator('.ac-page-shell--fixed-viewport');
    const appShell = page.locator('.ac-app-shell');
    const detailPane = page.locator('.patches__detail');
    const refreshButton = page.getByRole('button', { name: 'Refresh all patches from device' });

    await expect(pageShell).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(page.getByRole('heading', { name: 'Patches' })).toBeVisible();
    await expect(appShell).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(detailPane).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(refreshButton).toBeEnabled({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expectReceivesPointer(refreshButton);
    await expect(page.getByTestId('error-message')).toHaveCount(0);

    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    const patchIndex = await findFirstLoadedPatchIndex(page);
    expect(
      patchIndex,
      'Expected at least one loaded patch row on the live Patches route before selecting detail',
    ).not.toBeNull();

    const patchRow = page.locator(`[data-testid="patch-item-${patchIndex!}"]`);
    await expectReceivesPointer(patchRow);
    await patchRow.click({ timeout: ACTION_TIMEOUT_MS });

    await expect(page.locator('#patch-detail-title')).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(page.getByTestId('patch-editor')).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
  });
});
