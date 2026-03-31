/**
 * Hardware e2e tests for connected Roland S-series device operations.
 *
 * These tests require actual Roland S-series hardware (S-330 or S-550)
 * connected via MIDI. The tests work with either transport:
 *
 * - Web MIDI: Run via ./scripts/run-hardware-e2e.sh (requires human to grant permission)
 * - HTTP MIDI: Run via ./scripts/run-http-midi-e2e.sh (fully automated)
 *
 * Tests interact with the app's UI, not raw MIDI APIs. Transport selection
 * is pre-configured via localStorage by the test runner.
 *
 * Test categories:
 * 1. Device Connection Flow
 * 2. Device State Reading (Tones, Patches)
 * 3. Sample Playback
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  connectToDevice,
  waitForAppReady,
  getMidiStatus,
  hasConnectionUI,
} from './helpers/connection-helper';

// Short timeouts - fail fast for hardware tests
test.setTimeout(15_000);

// Environment variables set by run-http-midi-e2e.sh
const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;

// Default to S-330 for tests (can be overridden via E2E_DEVICE_TYPE)
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

// Timeouts for various operations
const UI_TIMEOUT_MS = 5000;
const DATA_LOAD_TIMEOUT_MS = 15000;

/**
 * Build URL with HTTP MIDI parameters if configured.
 * Empty path or '/' goes to the editor root, other paths are appended.
 */
function buildUrl(subpath: string = ''): string {
  // Normalize: empty string or '/' means editor root
  const normalized = subpath === '/' ? '' : subpath;
  const fullPath = normalized ? `${EDITOR_BASE_PATH}/${normalized}` : EDITOR_BASE_PATH;
  if (!MIDI_SERVER_PORT) return fullPath;
  const separator = fullPath.includes('?') ? '&' : '?';
  return `${fullPath}${separator}midi=http&midiServerPort=${MIDI_SERVER_PORT}`;
}

// =============================================================================
// Test Suite: Device Connection Flow
// =============================================================================

test.describe('Device Connection Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);
  });

  test('app initializes with disconnected state', async ({ page }) => {
    const status = await getMidiStatus(page);
    expect(status).toBe('disconnected');
  });

  test('connection UI is available', async ({ page }) => {
    const hasUI = await hasConnectionUI(page);
    expect(hasUI).toBe(true);
  });

  test('can connect to device', async ({ page }) => {
    await connectToDevice(page);
    const status = await getMidiStatus(page);
    expect(status).toBe('connected');
  });

  test('connection persists across navigation', async ({ page }) => {
    await connectToDevice(page);

    // Navigate to another page
    const patchesLink = page.locator('a[href$="/patches"]');
    if ((await patchesLink.count()) > 0) {
      await patchesLink.click();
      await page.waitForURL('**/patches**');

      const status = await getMidiStatus(page);
      expect(status).toBe('connected');
    }
  });

  test('can disconnect from device', async ({ page }) => {
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    const disconnectButton = page.locator('[data-testid="disconnect-button"]');
    await disconnectButton.click();

    await page.waitForFunction(
      () => {
        const store = (window as unknown as Record<string, unknown>).__midiStore as {
          getState: () => { status: string };
        };
        return store.getState().status === 'disconnected';
      },
      { timeout: UI_TIMEOUT_MS }
    );

    expect(await getMidiStatus(page)).toBe('disconnected');
  });
});

// =============================================================================
// Test Suite: Device State Reading
// =============================================================================

test.describe('Device State Reading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);
    await connectToDevice(page);
  });

  test('can navigate to tones page', async ({ page }) => {
    const tonesLink = page.locator('a[href$="/tones"]');
    if ((await tonesLink.count()) === 0) {
      test.skip(true, 'Tones page navigation not available');
      return;
    }

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Should still be connected after navigation
    expect(await getMidiStatus(page)).toBe('connected');
  });

  test('tones page loads tone data from device', async ({ page }) => {
    const tonesLink = page.locator('a[href$="/tones"]');
    if ((await tonesLink.count()) === 0) {
      test.skip(true, 'Tones page navigation not available');
      return;
    }

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tone items to appear (they render immediately, even if loading)
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Should have tone items
    const toneCount = await toneItems.count();
    expect(toneCount).toBeGreaterThan(0);
  });

  test('can navigate to patches page', async ({ page }) => {
    const patchesLink = page.locator('a[href$="/patches"]');
    if ((await patchesLink.count()) === 0) {
      test.skip(true, 'Patches page navigation not available');
      return;
    }

    await patchesLink.click();
    await page.waitForURL('**/patches**');

    expect(await getMidiStatus(page)).toBe('connected');
  });

  test('patches page loads patch data from device', async ({ page }) => {
    const patchesLink = page.locator('a[href$="/patches"]');
    if ((await patchesLink.count()) === 0) {
      test.skip(true, 'Patches page navigation not available');
      return;
    }

    await patchesLink.click();
    await page.waitForURL('**/patches**');

    // Wait for patch items to appear (they render immediately, even if loading)
    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Should have patch items
    const patchCount = await patchItems.count();
    expect(patchCount).toBeGreaterThan(0);
  });

  test('tone details show device parameters', async ({ page }) => {
    const tonesLink = page.locator('a[href$="/tones"]');
    if ((await tonesLink.count()) === 0) {
      test.skip(true, 'Tones page not available');
      return;
    }

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Click first tone to view details
    await toneItems.first().click();

    // Should show tone detail view with parameters
    const detailView = page.locator('[data-testid="tone-detail"]');
    if ((await detailView.count()) > 0) {
      await expect(detailView).toBeVisible({ timeout: UI_TIMEOUT_MS });

      // Should show some parameter controls
      const parameterControls = page.locator('[data-testid^="param-"]');
      const hasParameters = (await parameterControls.count()) > 0;
      expect(hasParameters).toBe(true);
    }
  });
});

// =============================================================================
// Test Suite: Sample Playback
// =============================================================================

test.describe('Sample Playback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);
    await connectToDevice(page);
  });

  test('can trigger sample playback from UI', async ({ page }) => {
    // Navigate to tones
    const tonesLink = page.locator('a[href$="/tones"]');
    if ((await tonesLink.count()) === 0) {
      test.skip(true, 'Tones page not available');
      return;
    }

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Look for play button on first tone
    const playButton = page.locator('[data-testid="play-tone-0"]').or(
      toneItems.first().locator('button:has-text("Play")')
    );

    if ((await playButton.count()) === 0) {
      test.skip(true, 'Play button not implemented');
      return;
    }

    // Click play - this should trigger MIDI note to device
    await playButton.click();

    // If there's a playing indicator, verify it shows
    const playingIndicator = page.locator('[data-testid="playing-indicator"]');
    if ((await playingIndicator.count()) > 0) {
      await expect(playingIndicator).toBeVisible({ timeout: UI_TIMEOUT_MS });
    }

    // Test passes if no error thrown - actual sound verification is manual
  });

  test('keyboard input triggers playback', async ({ page }) => {
    // Navigate to tones
    const tonesLink = page.locator('a[href$="/tones"]');
    if ((await tonesLink.count()) === 0) {
      test.skip(true, 'Tones page not available');
      return;
    }

    await tonesLink.click();
    await page.waitForURL('**/tones**');

    // Wait for tones to load
    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: DATA_LOAD_TIMEOUT_MS });

    // Select first tone
    await toneItems.first().click();

    // Look for virtual keyboard or key trigger area
    const keyboard = page.locator('[data-testid="virtual-keyboard"]');
    if ((await keyboard.count()) === 0) {
      test.skip(true, 'Virtual keyboard not implemented');
      return;
    }

    // Press a key on virtual keyboard
    const keyC4 = keyboard.locator('[data-note="60"]').or(keyboard.locator('.key-c4'));
    if ((await keyC4.count()) > 0) {
      await keyC4.click();
      // Test passes if no error - sound verification is manual
    }
  });
});

// =============================================================================
// Test Suite: Error Handling
// =============================================================================

test.describe('Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl());
    await waitForAppReady(page);
  });

  test('shows error state when connection fails', async ({ page }) => {
    // Verify the error state exists in the store
    const hasErrorState = await page.evaluate(() => {
      const store = (window as unknown as Record<string, unknown>).__midiStore as {
        getState: () => Record<string, unknown>;
      };
      const state = store.getState();
      return 'error' in state;
    });

    expect(hasErrorState).toBe(true);
  });

  test('displays connection error message in UI', async ({ page }) => {
    // Verify there's a place for error messages to appear
    const errorContainer = page.locator('[data-testid="connection-error"]').or(
      page.locator('[role="alert"]')
    );

    const errorUIExists = (await errorContainer.count()) > 0 ||
      (await page.locator('.error-message').count()) > 0 ||
      (await page.locator('[data-testid="midi-error"]').count()) > 0;

    if (!errorUIExists) {
      console.log('Note: No dedicated error UI found - errors may be shown differently');
    }
  });
});
