/**
 * E2E tests for error handling and recovery when MIDI communication fails.
 *
 * These tests use Playwright's page.route() API to intercept HTTP requests
 * to midi-server and simulate various failure modes:
 *   - HTTP 500 responses (server error)
 *   - Hanging requests (timeout simulation)
 *   - Aborted connections (network failure)
 *
 * The tests verify that the application:
 *   1. Displays meaningful error messages to the user
 *   2. Does not crash or enter an unrecoverable state
 *   3. Can recover when the underlying issue is resolved
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - midi-server running (started by run script)
 *   - devenv shell active
 *
 * Run via: make test-e2e-device ARGS="--grep 'Error Handling'"
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(60_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 2_000;
const DATA_LOAD_TIMEOUT_MS = 15_000;

/** Time to wait after a UI change for the buffered MIDI write to flush. */
const WRITE_FLUSH_MS = 2500;

/** Time to wait for an error message to appear after a failed operation. */
const ERROR_DISPLAY_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// URL Builder
// ---------------------------------------------------------------------------

function buildUrl(subpath = ''): string {
  const normalized = subpath === '/' ? '' : subpath;
  const fullPath = normalized
    ? `${EDITOR_BASE_PATH}/${normalized}`
    : EDITOR_BASE_PATH;
  if (!MIDI_SERVER_PORT) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}midi=http&midiServerPort=${MIDI_SERVER_PORT}`;
}

// ---------------------------------------------------------------------------
// Console Debug Listener
// ---------------------------------------------------------------------------

function attachConsoleDebugListener(
  page: import('@playwright/test').Page,
): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('S330Client') ||
      text.includes('S550Client') ||
      text.includes('error') ||
      text.includes('Error') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log(`BROWSER:`, text);
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the index of the first non-empty tone in the list.
 * A non-empty tone has a visible name that is not "(empty)" or blank.
 */
async function findFirstNonEmptyToneIndex(
  page: import('@playwright/test').Page,
): Promise<number | null> {
  const toneItems = page.locator('[data-testid^="tone-item-"]');
  const count = await toneItems.count();

  for (let i = 0; i < count; i++) {
    const item = toneItems.nth(i);
    const nameEl = item.locator('[data-testid="tone-name"]');

    if ((await nameEl.count()) === 0) continue;

    const name = await nameEl.textContent();
    if (name && name.trim() && !name.includes('(empty)')) {
      const testId = await item.getAttribute('data-testid');
      if (testId) {
        const match = testId.match(/tone-item-(\d+)/);
        if (match) return Number(match[1]);
      }
    }
  }
  return null;
}

/**
 * Select a tone by its index in the list.
 */
async function selectTone(
  page: import('@playwright/test').Page,
  toneIndex: number,
): Promise<void> {
  const toneItem = page.locator(`[data-testid="tone-item-${toneIndex}"]`);
  await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await toneItem.locator('button').first().click();

  const toneDetail = page.locator('[data-testid="tone-detail"]');
  await expect(toneDetail).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });
}

/**
 * Navigate to the Tones page and wait for items to render.
 */
async function navigateToTonesPage(
  page: import('@playwright/test').Page,
): Promise<void> {
  const tonesLink = page.locator('a[href$="/tones"]');
  await tonesLink.click();
  await page.waitForURL('**/tones**');

  const toneItems = page.locator('[data-testid^="tone-item-"]');
  await expect(toneItems.first()).toBeVisible({
    timeout: DATA_LOAD_TIMEOUT_MS,
  });
}

/**
 * Navigate to the Play page and wait for it to load.
 */
async function navigateToPlayPage(
  page: import('@playwright/test').Page,
): Promise<void> {
  const playLink = page.locator('a[href$="/play"]').or(
    page.locator('a[href$="/editor"]'),
  );
  await playLink.first().click();
  await page.waitForURL('**/play**');
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Error Handling', () => {
  let testToneIndex: number;

  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-device',
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);

    // 1. Load app and connect to MIDI device
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // 2. Navigate to Tones page and load initial data
    await navigateToTonesPage(page);

    // 3. Find and select a non-empty tone (establishes working baseline)
    const foundIndex = await findFirstNonEmptyToneIndex(page);
    console.log(`Found non-empty tone at index: ${foundIndex}`);
    if (foundIndex === null) {
      test.skip(true, 'No non-empty tones found on device');
      return;
    }
    testToneIndex = foundIndex;
    await selectTone(page, testToneIndex);
    console.log(`Tone ${testToneIndex} selected, editor visible`);
  });

  // -------------------------------------------------------------------------
  // MIDI send failure
  // -------------------------------------------------------------------------

  test('displays error on MIDI send failure', async ({ page }) => {
    // Intercept POST to midi-server send endpoint and return HTTP 500
    await page.route('**/port/*/send', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated MIDI send failure' }),
      }),
    );

    // Change the tone name to trigger a sendToneData call
    const nameInput = page.locator(
      '[data-testid="tone-detail"] input[type="text"][maxlength="8"]',
    );
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await nameInput.fill('ERRTEST');
    await nameInput.blur();

    // Wait for the error to propagate and display
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: ERROR_DISPLAY_TIMEOUT_MS });

    // Verify the error contains meaningful text
    const errorText = await errorMessage.textContent();
    expect(errorText).toBeTruthy();
    console.log(`Error displayed: "${errorText}"`);
  });

  // -------------------------------------------------------------------------
  // Timeout (hanging request)
  // -------------------------------------------------------------------------

  test('displays timeout error when device stops responding', async ({ page }) => {
    // Intercept POST to midi-server send endpoint and never respond (simulates timeout)
    await page.route('**/port/*/send', () => {
      // Intentionally do not call route.fulfill() or route.abort().
      // The request hangs until the app's internal timeout fires.
    });

    // Change the tone name to trigger a sendToneData call
    const nameInput = page.locator(
      '[data-testid="tone-detail"] input[type="text"][maxlength="8"]',
    );
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await nameInput.fill('TIMEOUT');
    await nameInput.blur();

    // Wait for the app's internal timeout to fire and show an error.
    // This may take longer since we're waiting for a timeout, not an immediate failure.
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: 30_000 });

    const errorText = await errorMessage.textContent();
    expect(errorText).toBeTruthy();
    console.log(`Timeout error displayed: "${errorText}"`);
  });

  // -------------------------------------------------------------------------
  // Recovery after error
  // -------------------------------------------------------------------------

  test('recovers after clearing error and retrying', async ({ page }) => {
    // Step 1: Break the connection
    await page.route('**/port/*/send', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Simulated failure' }),
      }),
    );

    // Step 2: Trigger an error by changing the tone name
    const nameInput = page.locator(
      '[data-testid="tone-detail"] input[type="text"][maxlength="8"]',
    );
    await expect(nameInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await nameInput.fill('FAIL');
    await nameInput.blur();

    // Step 3: Verify error appears
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible({ timeout: ERROR_DISPLAY_TIMEOUT_MS });
    console.log('Error displayed after simulated failure');

    // Step 4: Restore the connection by removing route interception
    await page.unroute('**/port/*/send');

    // Step 5: Retry the operation — set a new name and commit
    await nameInput.fill('RECOVER');
    await nameInput.blur();

    // Step 6: Wait for the write to flush to the device
    await page.waitForTimeout(WRITE_FLUSH_MS);

    // Verify the app is still functional: no page crash, still connected
    expect(await getMidiStatus(page)).toBe('connected');

    // Verify the tone name input still shows the value we set
    const currentValue = await nameInput.inputValue();
    expect(currentValue).toBe('RECOVER');
    console.log('Recovery successful — app functional after error cleared');
  });

  // -------------------------------------------------------------------------
  // SSE disconnect
  // -------------------------------------------------------------------------

  test('handles SSE disconnect gracefully', async ({ page }) => {
    // Abort the SSE event stream to simulate a network disconnect.
    // This cuts the incoming MIDI data channel from midi-server.
    await page.route('**/port/*/events', (route) => route.abort());

    // Try to change a tone parameter — this triggers a write that
    // will succeed (HTTP POST) but any subsequent read will fail
    // because SSE responses can't arrive.
    const nameInput = page.locator('[data-testid="tone-name-input"]');
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('SSETEST');
      await nameInput.blur();
      await page.waitForTimeout(2000);
    }

    // Verify the app did not crash — the page should still be interactive
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Navigation links should still be rendered (app didn't white-screen)
    const navLinks = page.locator('nav a');
    expect(await navLinks.count()).toBeGreaterThan(0);

    console.log('App remained stable after SSE disconnect');
  });
});
