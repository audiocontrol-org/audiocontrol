/**
 * E2E tests for sample chopper save-to-library flows.
 *
 * Tests the following scenarios (library-only, no hardware required):
 *
 *   11.1.10 — Save slices to library
 *     Open chopper on a common-area sample, slice with Fixed method,
 *     click Save, verify sample.yaml with slice definitions written to OPFS.
 *
 *   11.2.3 — Chop into Drum Kit (save slices as drum kit)
 *     Open chopper on an individual library tone via "Chop into Drum Kit",
 *     slice, verify drum kit output config renders, confirm creates
 *     kit.yaml in OPFS drum-kits directory.
 *
 * These tests create fixture audio in OPFS before connecting the library
 * backend. They use the real OPFS storage and real app UI -- no mocks.
 *
 * Run via: make test-e2e-library ARGS="--grep 'Chopper Save'"
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  connectToOPFS,
  navigateToLibrary,
} from './helpers/connection-helper';
import {
  createMinimalWavBase64,
  initializeCleanOPFS,
  cleanupOPFS,
  writeToneFixtureToOPFS,
} from './helpers/roundtrip-helpers';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(60_000);

const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

/** OPFS paths always use 's330' regardless of device type */
const LIBRARY_DEVICE = 's330';

const UI_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// URL Builder
// ---------------------------------------------------------------------------

function buildUrl(subpath = ''): string {
  const normalized = subpath === '/' ? '' : subpath;
  return normalized
    ? `${EDITOR_BASE_PATH}/${normalized}`
    : EDITOR_BASE_PATH;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Sample fixture: 2 seconds of silence at 30kHz (60000 samples, divisible by 4). */
const SAMPLE_WAV_BASE64 = createMinimalWavBase64(30000, 2);
const SAMPLE_FIXTURE_NAME = 'e2e-chop-source';

/** Tone fixture: same audio but stored as an individual tone. */
const TONE_FIXTURE_NAME = 'e2e-chop-tone';
const TONE_YAML = `name: "E2E Chop Tone"
sampleRate: 30000
loopStart: 0
loopEnd: 59999
rootKey: 60
fineTune: 0`;

// ---------------------------------------------------------------------------
// OPFS Helpers
// ---------------------------------------------------------------------------

/**
 * Write a common-area sample fixture to OPFS.
 *
 * Creates: library/common/samples/{name}/sample.yaml
 *          library/common/samples/{name}/sample.wav
 *
 * Must be called BEFORE connectToOPFS -- the app reads library on connect.
 */
async function writeSampleFixtureToOPFS(
  page: Page,
  sampleName: string,
  sampleRate: number,
  wavBase64: string,
): Promise<void> {
  await page.evaluate(
    async ({
      sampleName,
      sampleRate,
      wavBase64,
    }: {
      sampleName: string;
      sampleRate: number;
      wavBase64: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const common = await lib.getDirectoryHandle('common', { create: true });
      const samples = await common.getDirectoryHandle('samples', { create: true });
      const sampleDir = await samples.getDirectoryHandle(sampleName, { create: true });

      // Write sample.yaml
      const yaml = [
        'format: sample',
        'version: 1',
        `name: "${sampleName}"`,
        'file: sample.wav',
        `sampleRate: ${sampleRate}`,
      ].join('\n');

      const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();

      // Write sample.wav from base64
      const binaryString = atob(wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();
    },
    { sampleName, sampleRate, wavBase64 },
  );
}

/**
 * Read sample.yaml from OPFS and return its text content.
 */
async function readSampleYaml(
  page: Page,
  sampleName: string,
): Promise<string> {
  return page.evaluate(
    async (name: string) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library');
      const common = await lib.getDirectoryHandle('common');
      const samples = await common.getDirectoryHandle('samples');
      const sampleDir = await samples.getDirectoryHandle(name);
      const handle = await sampleDir.getFileHandle('sample.yaml');
      const file = await handle.getFile();
      return file.text();
    },
    sampleName,
  );
}

/**
 * Check if a drum kit directory exists in OPFS and return its kit.yaml content.
 * Returns null if the kit directory or kit.yaml doesn't exist.
 */
async function readDrumKitYaml(
  page: Page,
  kitName: string,
): Promise<string | null> {
  return page.evaluate(
    async ({ kitName, device }: { kitName: string; device: string }) => {
      const root = await navigator.storage.getDirectory();
      try {
        const lib = await root.getDirectoryHandle('library');
        const deviceDir = await lib.getDirectoryHandle(device);
        const drumKitsDir = await deviceDir.getDirectoryHandle('drum-kits');
        const kitDir = await drumKitsDir.getDirectoryHandle(kitName);
        const handle = await kitDir.getFileHandle('kit.yaml');
        const file = await handle.getFile();
        return file.text();
      } catch {
        return null;
      }
    },
    { kitName, device: LIBRARY_DEVICE },
  );
}

/**
 * List drum kit directory names in OPFS.
 */
async function listDrumKitDirectories(page: Page): Promise<string[]> {
  return page.evaluate(
    async (device: string) => {
      const root = await navigator.storage.getDirectory();
      try {
        const lib = await root.getDirectoryHandle('library');
        const deviceDir = await lib.getDirectoryHandle(device);
        const drumKitsDir = await deviceDir.getDirectoryHandle('drum-kits');
        const dirs: string[] = [];
        for await (const handle of (
          drumKitsDir as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }
        ).values()) {
          if (handle.kind === 'directory') {
            dirs.push(handle.name);
          }
        }
        return dirs;
      } catch {
        return [];
      }
    },
    LIBRARY_DEVICE,
  );
}

// ===========================================================================
// Test Suite: Save Slices to Library (11.1.10)
// ===========================================================================

test.describe('Chopper Save — save slices to library', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and Library page
    await page.goto(buildUrl('library'));
    await page.waitForLoadState('networkidle');

    // Clean OPFS
    await initializeCleanOPFS(page, LIBRARY_DEVICE);

    // Write sample fixture BEFORE connecting to library
    await writeSampleFixtureToOPFS(
      page,
      SAMPLE_FIXTURE_NAME,
      30000,
      SAMPLE_WAV_BASE64,
    );

    // Connect to OPFS library
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('fixed slicing then Save writes sample.yaml with slice definitions', async ({ page }) => {
    // Step 1: Find and click the sample in the Samples section of the library tree.
    // Tree nodes use data-testid="library-{type}-{directoryName}".
    const sampleNode = page.locator(
      `[data-testid="library-sample-${SAMPLE_FIXTURE_NAME}"]`,
    );
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sampleNode.click();

    // Step 2: Click "Open in Chopper" in the preview panel
    const chopButton = page.getByRole('button', { name: 'Open in Chopper' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    // Step 3: Wait for the chopper dialog to open
    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Step 4: Switch to Fixed tab and set 4 slices
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await expect(sliceCountInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sliceCountInput.fill('4');

    // Step 5: Wait for slices to be computed
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 6: Click Save
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Step 7: Wait for save to complete (button text changes to "Saving..." then back)
    // Poll until save is done by checking OPFS directly.
    await page.waitForTimeout(2_000);

    // Step 8: Verify sample.yaml was updated with slice definitions
    const yamlContent = await readSampleYaml(page, SAMPLE_FIXTURE_NAME);
    expect(yamlContent).toContain('slices:');
    expect(yamlContent).toContain('startSample:');
    expect(yamlContent).toContain('endSample:');

    // Verify we have 4 slices defined
    const startSampleMatches = yamlContent.match(/startSample:/g);
    expect(
      startSampleMatches?.length,
      `Expected 4 slices in sample.yaml, found ${startSampleMatches?.length ?? 0}`,
    ).toBe(4);
  });

  test('fixed slicing with 8 slices saves correct count', async ({ page }) => {
    const sampleNode = page.locator(
      `[data-testid="library-sample-${SAMPLE_FIXTURE_NAME}"]`,
    );
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sampleNode.click();

    const chopButton = page.getByRole('button', { name: 'Open in Chopper' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('8');
    await expect(page.getByText('8 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await page.waitForTimeout(2_000);

    const yamlContent = await readSampleYaml(page, SAMPLE_FIXTURE_NAME);
    const startSampleMatches = yamlContent.match(/startSample:/g);
    expect(
      startSampleMatches?.length,
      `Expected 8 slices in sample.yaml, found ${startSampleMatches?.length ?? 0}`,
    ).toBe(8);
  });

  test('Save button is disabled when no slices exist', async ({ page }) => {
    const sampleNode = page.locator(
      `[data-testid="library-sample-${SAMPLE_FIXTURE_NAME}"]`,
    );
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sampleNode.click();

    const chopButton = page.getByRole('button', { name: 'Open in Chopper' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // On Manual tab (default), no slices exist yet
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(saveButton).toBeDisabled();
  });
});

// ===========================================================================
// Test Suite: Chop into Drum Kit (11.2.3)
// ===========================================================================

test.describe('Chopper Save — chop into drum kit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl('library'));
    await page.waitForLoadState('networkidle');

    // Clean OPFS
    await initializeCleanOPFS(page, LIBRARY_DEVICE);

    // Write an individual tone fixture BEFORE connecting
    await writeToneFixtureToOPFS(
      page,
      LIBRARY_DEVICE,
      TONE_FIXTURE_NAME,
      TONE_YAML,
      SAMPLE_WAV_BASE64,
    );

    // Connect to OPFS library
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('Chop into Drum Kit opens chopper with kit output config', async ({ page }) => {
    // Step 1: Select the individual tone in the library tree
    const toneNode = page.locator(
      `[data-testid="library-tone-${TONE_FIXTURE_NAME}"]`,
    );
    await expect(toneNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await toneNode.click();

    // Step 2: Click "Chop into Drum Kit" in the preview panel
    const chopButton = page.getByRole('button', { name: 'Chop into Drum Kit' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    // Step 3: Wait for the chopper dialog to open
    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Step 4: Verify the "Drum Kit Output" config section is rendered
    // This is the S330KitOutputConfig render prop content.
    await expect(page.getByText('Drum Kit Output')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 5: Verify kit config fields are present
    await expect(page.getByText('Kit Name (max 12 chars)')).toBeVisible();
    await expect(page.getByText('Sample Rate')).toBeVisible();
    await expect(page.getByText('Base MIDI Note')).toBeVisible();
    await expect(page.getByText('Labels (comma-separated)')).toBeVisible();
  });

  test('Chop into Drum Kit shows slices with Fixed method', async ({ page }) => {
    const toneNode = page.locator(
      `[data-testid="library-tone-${TONE_FIXTURE_NAME}"]`,
    );
    await expect(toneNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await toneNode.click();

    const chopButton = page.getByRole('button', { name: 'Chop into Drum Kit' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Switch to Fixed tab and set 4 slices
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('4');

    // Verify 4 slices computed
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Verify slice list items are rendered (they show duration in ms)
    await expect(page.getByText(/\d+ms/).first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  /**
   * BUG/GAP: The SampleChopperDialog does not render a Confirm/Save button
   * when only onConfirm is provided (no onSave). The "Chop into Drum Kit"
   * flow from ItemPreviewPanel only wires onConfirm, so there is no way
   * for the user to trigger the drum kit save from the chopper dialog.
   *
   * This test documents the expected behavior when the button is added.
   * Remove .fixme when the dialog renders a confirm/save button for the
   * onConfirm callback.
   */
  test.fixme('saving drum kit creates kit.yaml in OPFS', async ({ page }) => {
    const toneNode = page.locator(
      `[data-testid="library-tone-${TONE_FIXTURE_NAME}"]`,
    );
    await expect(toneNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await toneNode.click();

    const chopButton = page.getByRole('button', { name: 'Chop into Drum Kit' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Switch to Fixed tab and set 4 slices
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Confirm/Save the drum kit
    // NOTE: This button does not yet exist in the dialog when only onConfirm
    // is provided. When implemented, update this selector.
    const confirmButton = page.getByRole('button', { name: /Save|Confirm|Create Kit/ });
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for save to complete
    await page.waitForTimeout(2_000);

    // Verify drum kit was created in OPFS
    const kitDirs = await listDrumKitDirectories(page);
    expect(kitDirs.length).toBeGreaterThanOrEqual(1);

    // Find the kit (name is derived from tone name, uppercased, max 12 chars)
    const expectedKitName = TONE_FIXTURE_NAME
      .replace(/\.wav$/i, '')
      .toUpperCase()
      .slice(0, 12)
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_');

    const kitYaml = await readDrumKitYaml(page, expectedKitName);
    expect(kitYaml).not.toBeNull();
    expect(kitYaml).toContain('format: drum-kit-bundle');
    expect(kitYaml).toContain('version: 2');
    expect(kitYaml).toContain('slices:');
    expect(kitYaml).toContain('source: source.wav');
  });
});
