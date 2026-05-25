/**
 * Live S-550 Play page design conformance checks.
 *
 * This suite targets the reopened Play-page chrome issue tracked in #423:
 * the page header and drawer affordance must not occlude the first part row
 * on the live `/roland/s550/editor/play` route.
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

test.setTimeout(60_000);

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

async function expectBelowStickyHeader(
  stickyHeader: Locator,
  target: Locator,
): Promise<void> {
  const headerBox = await stickyHeader.boundingBox();
  const targetBox = await target.boundingBox();

  expect(headerBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const headerBottom = (headerBox?.y ?? 0) + (headerBox?.height ?? 0);
  expect(targetBox?.y ?? 0).toBeGreaterThanOrEqual(headerBottom - 1);
}

async function normalizeDrawerClosed(page: Page): Promise<void> {
  const closeToggle = page.locator('button[title^="Close "]').first();
  if (await closeToggle.count()) {
    await closeToggle.click();
    await expect(page.locator('aside')).toHaveClass(/-translate-x-full/, {
      timeout: UI_TIMEOUT_MS,
    });
  }
}

test.describe('S-550 live Play-page design conformance', () => {
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

    await page.goto(buildUrl('play'), { timeout: UI_TIMEOUT_MS });
    await page.waitForURL('**/play**');
    await normalizeDrawerClosed(page);
  });

  test('Part A row and drawer affordance remain pointer-reachable on the live route', async ({ page }) => {
    // .ac-page-title-row is the canonical page-title chrome (promoted
    // 2026-05-24 in akai-harmonization Phase 2 task 2.2; the legacy
    // sticky-header chrome was retired in the same window).
    const stickyHeader = page.locator('.ac-page-title-row');
    const partAChannel = page.locator('[aria-label="Part A MIDI channel"]');
    const openDrawerToggle = page.locator('button[title^="Open "]').first();

    await expect(stickyHeader).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expectReceivesPointer(openDrawerToggle);
    await expectReceivesPointer(partAChannel);
    await expectBelowStickyHeader(stickyHeader, partAChannel);

    await openDrawerToggle.click();

    const drawer = page.locator('aside');
    await expect(drawer).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const closeDrawerToggle = page.locator('button[title^="Close "]').first();
    await expectReceivesPointer(closeDrawerToggle);
    await expectReceivesPointer(partAChannel);
    await expectBelowStickyHeader(stickyHeader, partAChannel);
  });
});
