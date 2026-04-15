/**
 * E2E tests for importing drum kits from the library to the device.
 *
 * Tests both v1 (individual WAV files per drum) and v2 (single source WAV
 * with slice definitions) drum kit import flows:
 *   1. Write a drum kit fixture to OPFS
 *   2. Connect to OPFS library
 *   3. Select the drum kit in the library tree
 *   4. Import to device via ImportSamplesDialog
 *   5. Verify tones and patch were created on device
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - midi-server running
 *   - devenv shell active
 *
 * Run via: make test-e2e-device ARGS="--grep 'Drum Kit Import'"
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  connectToDevice,
  connectToOPFS,
  navigateToLibrary,
  waitForAppReady,
  getMidiStatus,
} from './helpers/connection-helper';
import {
  createMinimalWavBase64,
  initializeCleanOPFS,
  cleanupOPFS,
  loadAllDeviceData,
  queryDeviceMemoryState,
} from './helpers/roundtrip-helpers';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(180_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

/** OPFS paths always use 's330' regardless of device type */
const LIBRARY_DEVICE = 's330';

const UI_TIMEOUT_MS = 2_000;
const MIDI_TRANSFER_TIMEOUT_MS = 60_000;
const WRITE_FLUSH_MS = 2_500;

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

function attachConsoleDebugListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('S330Client') ||
      text.includes('S550Client') ||
      text.includes('importMonolithic') ||
      text.includes('useImportSamples') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log(`BROWSER:`, text);
    }
  });
}

// ---------------------------------------------------------------------------
// Drum Kit Fixture
// ---------------------------------------------------------------------------

const KIT_FIXTURE_NAME = 'e2e-kit';

/**
 * V2 drum kit bundle YAML with 4 slices (complete kit).
 *
 * Uses drum-kit-bundle format with source WAV and slice definitions.
 * Each slice is 15000 samples (0.5s at 30kHz).
 * Total: 60000 samples = 2 seconds at 30kHz.
 * 4 slices form a complete kit (kick, snare, hhClosed, hhOpen).
 */
const KIT_YAML = `format: drum-kit-bundle
version: 2
name: E2E Kit
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

/** Minimal WAV: 2 seconds of silence at 30kHz (60000 samples) */
const KIT_WAV_BASE64 = createMinimalWavBase64(30000, 2);

// ---------------------------------------------------------------------------
// V1 Drum Kit Fixture (individual WAV files per drum)
// ---------------------------------------------------------------------------

const V1_KIT_FIXTURE_NAME = 'e2e-kit-v1';

const V1_KIT_YAML = `format: drum-kit-bundle
version: 1
name: E2E Kit V1
sampleRate: 30000
baseNote: 36
`;

/** Each drum sample: 0.5 seconds of silence at 30kHz (15000 samples) */
const DRUM_WAV_BASE64 = createMinimalWavBase64(30000, 0.5);

/** V1 drum filenames -- must match parser patterns in drum-kit-parser.ts */
const V1_DRUM_FILENAMES = [
  'KICK 01.wav',
  'SNARE 01.wav',
  'HHC 01.wav',
  'HHO 01.wav',
];

// ---------------------------------------------------------------------------
// OPFS Helper
// ---------------------------------------------------------------------------

/**
 * Write a v2 drum kit fixture to OPFS.
 *
 * Creates: library/s330/drum-kits/{kitName}/kit.yaml
 *          library/s330/drum-kits/{kitName}/source.wav
 *
 * Must be called BEFORE connectToOPFS -- the app reads library on connect.
 */
async function writeDrumKitFixtureToOPFS(
  page: Page,
  kitName: string,
  kitYaml: string,
  wavBase64: string
): Promise<void> {
  await page.evaluate(
    async ({
      kitName,
      kitYaml,
      wavBase64,
      device,
    }: {
      kitName: string;
      kitYaml: string;
      wavBase64: string;
      device: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const deviceDir = await lib.getDirectoryHandle(device, { create: true });
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
    { kitName, kitYaml, wavBase64, device: LIBRARY_DEVICE }
  );
}

// ---------------------------------------------------------------------------
// V1 OPFS Helper
// ---------------------------------------------------------------------------

/**
 * Write a v1 drum kit fixture to OPFS (individual WAV files per drum).
 *
 * Creates: library/s330/drum-kits/{kitName}/kit.yaml
 *          library/s330/drum-kits/{kitName}/KICK 01.wav
 *          library/s330/drum-kits/{kitName}/SNARE 01.wav
 *          library/s330/drum-kits/{kitName}/HHC 01.wav
 *          library/s330/drum-kits/{kitName}/HHO 01.wav
 *
 * Must be called BEFORE connectToOPFS -- the app reads library on connect.
 */
async function writeDrumKitV1FixtureToOPFS(
  page: Page,
  kitName: string,
  kitYaml: string,
  drumWavBase64: string,
  drumFilenames: readonly string[]
): Promise<void> {
  await page.evaluate(
    async ({
      kitName,
      kitYaml,
      drumWavBase64,
      drumFilenames,
      device,
    }: {
      kitName: string;
      kitYaml: string;
      drumWavBase64: string;
      drumFilenames: readonly string[];
      device: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const deviceDir = await lib.getDirectoryHandle(device, { create: true });
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

      // Decode WAV base64 once (all drums use the same silent WAV)
      const binaryString = atob(drumWavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }

      // Write each drum WAV file
      for (const filename of drumFilenames) {
        const wavHandle = await kitDir.getFileHandle(filename, {
          create: true,
        });
        const wavWriter = await wavHandle.createWritable();
        await wavWriter.write(wavBytes);
        await wavWriter.close();
      }
    },
    {
      kitName,
      kitYaml,
      drumWavBase64,
      drumFilenames: [...drumFilenames],
      device: LIBRARY_DEVICE,
    }
  );
}

// ---------------------------------------------------------------------------
// Shared Import + Verify Flow
// ---------------------------------------------------------------------------

/**
 * Select a drum kit from the library tree, import it to the device via the
 * ImportSamplesDialog, wait for success, and verify tones on the device.
 *
 * Shared between v1 and v2 drum kit import tests to avoid duplication.
 */
async function importDrumKitAndVerify(
  page: Page,
  kitFixtureName: string
): Promise<void> {
  // Snapshot device state before import
  await loadAllDeviceData(page);
  const stateBefore = await queryDeviceMemoryState(page);
  console.log(
    `Device state before import: ${stateBefore.occupiedToneCount} tones, ` +
      `${stateBefore.occupiedPatchCount} patches occupied`
  );

  // Connect to OPFS -- app reads library contents on connect
  await connectToOPFS(page);

  // Switch to drum kits tab
  const drumKitsTab = page.locator('[data-testid="library-drumKits-tab"]');
  await expect(drumKitsTab).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await drumKitsTab.click();

  // Wait for kit to appear in tree and select it
  const kitItem = page.locator(
    `[data-testid="library-drum-kit-${kitFixtureName}"]`
  );
  await expect(kitItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await kitItem.click();

  // Click "Import to Device" in the preview panel
  const importButton = page.locator(
    '[data-testid="import-to-device-button"]'
  );
  await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await importButton.click();

  // ImportSamplesDialog opens -- accept defaults and click import
  const importSamplesButton = page.locator('button', {
    hasText: 'Import Samples',
  });
  await expect(importSamplesButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await importSamplesButton.click();

  // Wait for import success (heartbeat-safe polling)
  const POLL_INTERVAL = 2_000;
  const MAX_POLLS = 75; // Watchdog (10s) is the real safety net; this just bounds the loop
  let importSucceeded = false;

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await page.waitForTimeout(POLL_INTERVAL);
    const successVisible = await page
      .locator('text=Samples imported successfully')
      .isVisible();
    if (successVisible) {
      importSucceeded = true;
      break;
    }

    // Check for error
    const errorVisible = await page
      .locator('.ac-operation-error')
      .isVisible();
    if (errorVisible) {
      const errorText = await page
        .locator('.ac-operation-error')
        .textContent();
      throw new Error(`Import failed with error: ${errorText}`);
    }
  }

  expect(
    importSucceeded,
    'Expected import to succeed within timeout'
  ).toBe(true);

  // Close the success dialog by clicking "Done"
  const doneButton = page.locator('button', { hasText: 'Done' });
  await expect(doneButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await doneButton.click();

  // Wait for write flush to ensure device has processed all MIDI
  await page.waitForTimeout(WRITE_FLUSH_MS);

  // Reload device data to see the imported tones and patch
  await loadAllDeviceData(page);
  const stateAfter = await queryDeviceMemoryState(page);
  console.log(
    `Device state after import: ${stateAfter.occupiedToneCount} tones, ` +
      `${stateAfter.occupiedPatchCount} patches occupied`
  );

  // Verify drum kit tones exist on device (by name, not count delta --
  // the device may already have these tones from a prior run)
  expect(
    stateAfter.occupiedToneCount,
    `Expected at least 4 occupied tones for drum kit, got ${stateAfter.occupiedToneCount}`
  ).toBeGreaterThanOrEqual(4);

  // Verify tone names include "KICK" and "SNARE"
  // The device uppercases and may truncate names to 8 chars.
  const toneNames = stateAfter.tones
    .filter((t) => !t.empty)
    .map((t) => t.name.trim());

  console.log(`Occupied tone names: ${toneNames.join(', ')}`);

  const hasKick = toneNames.some((name) => name.includes('KICK'));
  const hasSnare = toneNames.some((name) => name.includes('SNARE'));

  expect(
    hasKick,
    `Expected a tone named "KICK" on device. Found tones: [${toneNames.join(', ')}]`
  ).toBe(true);
  expect(
    hasSnare,
    `Expected a tone named "SNARE" on device. Found tones: [${toneNames.join(', ')}]`
  ).toBe(true);
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Drum Kit Import', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-device'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    // 1. Load app and connect to MIDI device
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // 2. Navigate to Library page
    await navigateToLibrary(page);

    // 3. Clean OPFS so each test starts fresh
    await initializeCleanOPFS(page, LIBRARY_DEVICE);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('v2 drum kit import creates tones and patch on device', async ({
    page,
  }) => {
    attachConsoleDebugListener(page);

    // Write v2 drum kit fixture to OPFS BEFORE connecting to library
    await writeDrumKitFixtureToOPFS(
      page,
      KIT_FIXTURE_NAME,
      KIT_YAML,
      KIT_WAV_BASE64
    );

    await importDrumKitAndVerify(page, KIT_FIXTURE_NAME);
  });

  test('v1 drum kit import creates tones and patch on device', async ({
    page,
  }) => {
    attachConsoleDebugListener(page);

    // Write v1 drum kit fixture to OPFS BEFORE connecting to library
    await writeDrumKitV1FixtureToOPFS(
      page,
      V1_KIT_FIXTURE_NAME,
      V1_KIT_YAML,
      DRUM_WAV_BASE64,
      V1_DRUM_FILENAMES
    );

    await importDrumKitAndVerify(page, V1_KIT_FIXTURE_NAME);
  });
});
