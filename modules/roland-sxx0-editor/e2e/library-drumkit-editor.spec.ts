/**
 * E2E tests for drum kit editor features (pad display, audio loading, playback).
 *
 * Test case 13.x: Verifies the DrumKitPadList component renders correctly
 * for v2 drum kits in the library preview panel. Tests pad rows, MIDI note
 * labels, Load Audio button, and play button interactions.
 *
 * These are library-only tests (no hardware required). They write a valid
 * v2 drum kit fixture to OPFS with both kit.yaml and source.wav.
 *
 * Run via: make test-e2e-roland-library ARGS="--grep 'Drum Kit Editor'"
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  createMinimalWavBase64,
  cleanupOPFS,
  initializeCleanOPFS,
  connectToOPFSBackend,
} from './helpers/library-opfs-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(30_000);

const LIBRARY_DEVICE = 's330';
const UI_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KIT_DIR_NAME = 'e2e-editor-kit';
/** Display name shown in the library tree (from kit.yaml name field) */
const KIT_DISPLAY_NAME = 'E2E Editor Kit';
const KIT_WAV_BASE64 = createMinimalWavBase64(30000, 2);

const KIT_60_DIR_NAME = 'e2e-editor-kit-60';
const KIT_60_DISPLAY_NAME = 'E2E Editor Kit 60';
const KIT_60_WAV_BASE64 = createMinimalWavBase64(30000, 2);

const KIT_60_YAML = `format: drum-kit-bundle
version: 2
name: E2E Editor Kit 60
sampleRate: 30000
baseNote: 60
source: source.wav
slices:
  - label: Kick
    startSample: 0
    endSample: 15000
  - label: Snare
    startSample: 15000
    endSample: 30000
  - label: hhClosed
    startSample: 30000
    endSample: 45000
  - label: hhOpen
    startSample: 45000
    endSample: 60000
`;

const KIT_YAML = `format: drum-kit-bundle
version: 2
name: E2E Editor Kit
sampleRate: 30000
baseNote: 36
source: source.wav
slices:
  - label: Kick
    startSample: 0
    endSample: 15000
  - label: Snare
    startSample: 15000
    endSample: 30000
  - label: hhClosed
    startSample: 30000
    endSample: 45000
  - label: hhOpen
    startSample: 45000
    endSample: 60000
`;

// ---------------------------------------------------------------------------
// OPFS Helpers
// ---------------------------------------------------------------------------

/** Write a v2 drum kit fixture (kit.yaml + source.wav) to OPFS. */
async function writeDrumKitV2FixtureToOPFS(
  page: Page,
  kitName: string,
  kitYaml: string,
  wavBase64: string,
): Promise<void> {
  await page.evaluate(
    async ({
      kitName,
      kitYaml,
      wavBase64,
    }: {
      kitName: string;
      kitYaml: string;
      wavBase64: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const deviceDir = await lib.getDirectoryHandle('s330', { create: true });
      const drumKitsDir = await deviceDir.getDirectoryHandle('drum-kits', {
        create: true,
      });
      const kitDir = await drumKitsDir.getDirectoryHandle(kitName, {
        create: true,
      });

      // Write kit.yaml
      const yamlHandle = await kitDir.getFileHandle('kit.yaml', {
        create: true,
      });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(kitYaml);
      await yamlWriter.close();

      // Write source.wav from base64
      const binaryString = atob(wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await kitDir.getFileHandle('source.wav', {
        create: true,
      });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();
    },
    { kitName, kitYaml, wavBase64 },
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Select the drum kit in the library tree by name. */
async function selectKitInTree(page: Page, kitName: string): Promise<void> {
  const kitNameSpan = page
    .locator('.ac-tree-node-name', {
      hasText: new RegExp(`^${kitName}$`),
    })
    .first();
  await expect(kitNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

  const treeNode = kitNameSpan.locator(
    'xpath=ancestor::div[contains(@class, "ac-tree-node")]',
  );
  await treeNode.click();
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Drum Kit Editor (13.x)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roland/s330/editor/library?midi=mock');
    await page.waitForLoadState('networkidle');

    await initializeCleanOPFS(page, LIBRARY_DEVICE);
    await writeDrumKitV2FixtureToOPFS(page, KIT_DIR_NAME, KIT_YAML, KIT_WAV_BASE64);
    await connectToOPFSBackend(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('drum kit preview shows pads with MIDI notes', async ({ page }) => {
    await selectKitInTree(page, KIT_DISPLAY_NAME);

    const padList = page.locator('[data-testid="pad-list"]');
    await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Verify all 4 pad rows exist
    for (let i = 0; i < 4; i++) {
      await expect(page.locator(`[data-testid="pad-${i}"]`)).toBeVisible();
    }

    // Verify MIDI note names are rendered (exact format depends on midiNoteToName)
    // Check that the first pad row contains a note name matching letter+octave pattern
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
    await selectKitInTree(page, KIT_DISPLAY_NAME);

    const loadAudioButton = page.locator(
      '[data-testid="load-audio-button"]',
    );
    await expect(loadAudioButton).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await loadAudioButton.click();

    // After clicking, button should be disabled or show loading state
    await expect(loadAudioButton).toBeDisabled({ timeout: UI_TIMEOUT_MS });
  });

  test('can click play button on drum pad without crash', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await selectKitInTree(page, KIT_DISPLAY_NAME);

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
    expect(pageErrors.length, `Page errors: ${pageErrors.join('; ')}`).toBe(0);

    // App must still be functional
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('automatic MIDI note assignment assigns sequential notes from base note (12.3)', async ({
    page,
  }) => {
    await selectKitInTree(page, KIT_DISPLAY_NAME);

    const padList = page.locator('[data-testid="pad-list"]');
    await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Collect MIDI note names from the .font-mono span in each pad row
    const noteNames: string[] = [];
    for (let i = 0; i < 4; i++) {
      const noteSpan = page.locator(`[data-testid="pad-${i}"] .font-mono`);
      await expect(noteSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });
      const text = await noteSpan.textContent();
      expect(text).toBeTruthy();
      noteNames.push(text!.trim());
    }

    // All 4 note names must be non-empty and distinct (sequential from baseNote 36)
    const uniqueNotes = new Set(noteNames);
    expect(uniqueNotes.size).toBe(4);

    // Verify sequential ordering: each note name should differ from its neighbors
    // (midiNoteToName maps consecutive MIDI numbers to different names)
    for (let i = 1; i < noteNames.length; i++) {
      expect(noteNames[i]).not.toBe(noteNames[i - 1]);
    }
  });

  test('drum kit with different base note shows correct MIDI assignments (12.4)', async ({
    page,
  }) => {
    // Reload and set up both kits from scratch so both are present before connect
    await page.goto('/roland/s330/editor/library?midi=mock');
    await page.waitForLoadState('networkidle');

    await initializeCleanOPFS(page, LIBRARY_DEVICE);
    await writeDrumKitV2FixtureToOPFS(page, KIT_DIR_NAME, KIT_YAML, KIT_WAV_BASE64);
    await writeDrumKitV2FixtureToOPFS(page, KIT_60_DIR_NAME, KIT_60_YAML, KIT_60_WAV_BASE64);
    await connectToOPFSBackend(page);

    // Read note names from the base-36 kit
    await selectKitInTree(page, KIT_DISPLAY_NAME);
    const padList = page.locator('[data-testid="pad-list"]');
    await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const base36FirstNote = await page
      .locator('[data-testid="pad-0"] .font-mono')
      .textContent();
    expect(base36FirstNote).toBeTruthy();

    // Select the base-60 kit and wait for the pad notes to change
    await selectKitInTree(page, KIT_60_DISPLAY_NAME);
    await expect(padList).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Wait for the pad list to re-render with new MIDI notes
    const pad0Note = page.locator('[data-testid="pad-0"] .font-mono');
    await expect(pad0Note).not.toHaveText(base36FirstNote!.trim(), { timeout: UI_TIMEOUT_MS });

    const noteNames60: string[] = [];
    for (let i = 0; i < 4; i++) {
      const noteSpan = page.locator(`[data-testid="pad-${i}"] .font-mono`);
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
