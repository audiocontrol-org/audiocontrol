/**
 * Live S-550 Library page design conformance checks.
 *
 * This suite verifies the shared Library page on the live
 * `/roland/s550/editor/library` route against the approved redesign
 * direction: fixed shell chrome, visible three-panel composition, and a
 * safe dialog-open path through the real OPFS connection flow.
 *
 * Run via:
 *   make test-e2e-roland-device-conformance
 */

import { test, expect, type Page } from '@playwright/test';

import {
  connectToDevice,
  connectToOPFS,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';

test.setTimeout(90_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's550';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 10_000;
const DATA_LOAD_TIMEOUT_MS = 20_000;

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

function libraryDialogWarnings(page: Page): string[] {
  const warnings = (page as Page & {
    __libraryWarningLog?: string[];
  }).__libraryWarningLog;
  return warnings ?? [];
}

test.describe('S-550 live Library-page design conformance', () => {
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
    (page as Page & { __libraryWarningLog?: string[] }).__libraryWarningLog = [];
    attachConsoleDebugListener(page);
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Missing `Description` or `aria-describedby={undefined}`')) {
        libraryDialogWarnings(page).push(text);
      }
    });

    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    await page.goto(buildUrl('library'), { timeout: UI_TIMEOUT_MS });
    await page.waitForURL('**/library**');
  });

  test('fixed library shell exposes approved header controls and opens Save dialog after OPFS connect', async ({ page }) => {
    const pageShell = page.locator('.ac-page-shell--fixed-viewport');
    const stickyHeader = page.locator('.ac-page-sticky-header');
    const pageBody = page.locator('.ac-page-shell-body');

    await expect(pageShell).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(stickyHeader).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
    await expect(pageBody).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
    await expect(page.getByText('Experimental')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh Device' })).toBeVisible();

    const saveButton = page.getByTestId('save-set-button');
    const loadButton = page.getByTestId('load-set-button');

    await expect(saveButton).toBeVisible();
    await expect(saveButton).toBeDisabled();
    await expect(loadButton).toBeVisible();
    await expect(loadButton).toBeDisabled();

    await expect(page.getByText('Device Memory')).toBeVisible();
    await expect(page.getByText('Preview')).toBeVisible();

    await connectToOPFS(page);

    await expect(saveButton).toBeEnabled({ timeout: DATA_LOAD_TIMEOUT_MS });
    await saveButton.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(page.getByRole('heading', { name: 'Save Device to Library' })).toBeVisible();
    await expect(page.getByLabel('Set Name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Set' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    expect(libraryDialogWarnings(page)).toEqual([]);
  });
});
