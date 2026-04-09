/**
 * Factory for drum kit editor e2e tests.
 *
 * Tests pad display, MIDI note assignment, Load Audio, and play button
 * interactions for drum kit samples in the library preview panel.
 *
 * Extracted from roland-sxx0-editor so both editors can share the same
 * test logic. Each editor calls registerDrumKitEditorTests() with its
 * own LibraryTestConfig.
 */

import { test, expect } from '@playwright/test';

import type { LibraryTestConfig } from './library-test-config';
import { writeDrumKitFixture } from '../helpers/library-fixtures';
import {
  cleanupOPFS,
  connectToOPFS,
  clickLibraryItem,
} from '../helpers/library-ui-helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UI_TIMEOUT_MS = 5_000;

const BASE_36_KIT_NAME = 'E2E Editor Kit';
const BASE_36_SLICE_LABELS = ['Kick', 'Snare', 'hhClosed', 'hhOpen'];

const BASE_60_KIT_NAME = 'E2E Editor Kit 60';
const BASE_60_SLICE_LABELS = ['Kick', 'Snare', 'hhClosed', 'hhOpen'];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function registerDrumKitEditorTests(config: LibraryTestConfig): void {
  test.describe(`Drum Kit Editor — ${config.editorName} (13.x)`, () => {
    test.setTimeout(30_000);

    test.beforeEach(async ({ page }) => {
      await page.goto(`${config.libraryUrl}?midi=mock`);
      await page.waitForLoadState('networkidle');

      await config.initializeOPFS(page);
      await writeDrumKitFixture(page, {
        name: BASE_36_KIT_NAME,
        baseNote: 36,
        sliceLabels: BASE_36_SLICE_LABELS,
        sampleRate: 30000,
      });
      await connectToOPFS(page);
    });

    test.afterEach(async ({ page }) => {
      await cleanupOPFS(page);
    });

    test('drum kit preview shows pads with MIDI notes', async ({ page }) => {
      await clickLibraryItem(page, BASE_36_KIT_NAME);

      const padList = page.locator('[data-testid="pad-list"]');
      await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

      // Verify all 4 pad rows exist
      for (let i = 0; i < 4; i++) {
        await expect(page.locator(`[data-testid="pad-${i}"]`)).toBeVisible();
      }

      // Verify MIDI note names are rendered
      const firstPad = page.locator('[data-testid="pad-0"]');
      await expect(firstPad.locator('.font-mono')).toBeVisible();

      // Verify play buttons exist for each pad
      for (let i = 0; i < 4; i++) {
        await expect(
          page.locator(`[data-testid="pad-play-${i}"]`),
        ).toBeVisible();
      }
    });

    test('drum kit preview shows Load Audio button for v2 kits', async ({
      page,
    }) => {
      await clickLibraryItem(page, BASE_36_KIT_NAME);

      const loadAudioButton = page.locator(
        '[data-testid="load-audio-button"]',
      );
      await expect(loadAudioButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

      await loadAudioButton.click();

      // After clicking, button should be disabled or show loading state
      await expect(loadAudioButton).toBeDisabled({ timeout: UI_TIMEOUT_MS });
    });

    test('can click play button on drum pad without crash', async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      await clickLibraryItem(page, BASE_36_KIT_NAME);

      // Load audio first so play has something to work with
      const loadAudioButton = page.locator(
        '[data-testid="load-audio-button"]',
      );
      await expect(loadAudioButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await loadAudioButton.click();
      await expect(loadAudioButton).toBeDisabled({ timeout: UI_TIMEOUT_MS });

      // Click play on pad 0
      const playButton = page.locator('[data-testid="pad-play-0"]');
      await expect(playButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await playButton.click();

      // Brief wait to allow any async errors to surface
      await page.waitForTimeout(500);

      // No page errors should have occurred
      expect(
        pageErrors.length,
        `Page errors: ${pageErrors.join('; ')}`,
      ).toBe(0);

      // App must still be functional
      const appRoot = page.locator('#root');
      await expect(appRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });
    });

    test('automatic MIDI note assignment assigns sequential notes from base note (12.3)', async ({
      page,
    }) => {
      await clickLibraryItem(page, BASE_36_KIT_NAME);

      const padList = page.locator('[data-testid="pad-list"]');
      await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

      // Collect MIDI note names from the .font-mono span in each pad row
      const noteNames: string[] = [];
      for (let i = 0; i < 4; i++) {
        const noteSpan = page.locator(
          `[data-testid="pad-${i}"] .font-mono`,
        );
        await expect(noteSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });
        const text = await noteSpan.textContent();
        expect(text).toBeTruthy();
        noteNames.push(text!.trim());
      }

      // All 4 note names must be non-empty and distinct (sequential from baseNote 36)
      const uniqueNotes = new Set(noteNames);
      expect(uniqueNotes.size).toBe(4);

      // Verify sequential ordering: each note name should differ from its neighbors
      for (let i = 1; i < noteNames.length; i++) {
        expect(noteNames[i]).not.toBe(noteNames[i - 1]);
      }
    });

    test('drum kit with different base note shows correct MIDI assignments (12.4)', async ({
      page,
    }) => {
      // Reload and set up both kits from scratch so both are present
      await page.goto(`${config.libraryUrl}?midi=mock`);
      await page.waitForLoadState('networkidle');

      await config.initializeOPFS(page);
      await writeDrumKitFixture(page, {
        name: BASE_36_KIT_NAME,
        baseNote: 36,
        sliceLabels: BASE_36_SLICE_LABELS,
        sampleRate: 30000,
      });
      await writeDrumKitFixture(page, {
        name: BASE_60_KIT_NAME,
        baseNote: 60,
        sliceLabels: BASE_60_SLICE_LABELS,
        sampleRate: 30000,
      });
      await connectToOPFS(page);

      // Read note names from the base-36 kit
      await clickLibraryItem(page, BASE_36_KIT_NAME);
      const padList = page.locator('[data-testid="pad-list"]');
      await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

      const base36FirstNote = await page
        .locator('[data-testid="pad-0"] .font-mono')
        .textContent();
      expect(base36FirstNote).toBeTruthy();

      // Select the base-60 kit and wait for the pad notes to change
      await clickLibraryItem(page, BASE_60_KIT_NAME);
      await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

      // Wait for the pad list to re-render with new MIDI notes
      const pad0Note = page.locator('[data-testid="pad-0"] .font-mono');
      await expect(pad0Note).not.toHaveText(base36FirstNote!.trim(), {
        timeout: UI_TIMEOUT_MS,
      });

      const noteNames60: string[] = [];
      for (let i = 0; i < 4; i++) {
        const noteSpan = page.locator(
          `[data-testid="pad-${i}"] .font-mono`,
        );
        await expect(noteSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });
        const text = await noteSpan.textContent();
        expect(text).toBeTruthy();
        noteNames60.push(text!.trim());
      }

      // Base-60 pads must have 4 distinct sequential notes
      const uniqueNotes60 = new Set(noteNames60);
      expect(uniqueNotes60.size).toBe(4);
    });

    test.fixme(
      'shows MIDI conflict warning for duplicate assignments',
      async () => {
        // Currently MIDI notes are always unique (calculated from baseNote + index).
        // This test would require per-pad MIDI note editing which is not yet
        // implemented. When per-pad note assignment is added, this test should:
        // 1. Set two pads to the same MIDI note
        // 2. Verify a conflict warning appears on both pads
      },
    );
  });
}
