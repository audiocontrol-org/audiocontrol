/**
 * E2E roundtrip tests for device-library integration.
 *
 * Each test follows an atomic pattern:
 *   1. Create fixture in OPFS library
 *   2. Import fixture from library to device via UI
 *   3. Export from device back to library via UI
 *   4. Compare exported data against original fixture
 *
 * Prerequisites:
 *   - Roland S-330 or S-550 connected via MIDI
 *   - midi-server running (started by run-device-library-e2e.sh)
 *   - devenv shell active
 *
 * Run via: make test-e2e-device-library
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
  writeToneFixtureToOPFS,
  writePatchFixtureToOPFS,
  initializeCleanOPFS,
  cleanupOPFS,
  listExportedTones,
  listExportedPatches,
  readExportedToneYaml,
  readExportedPatchYaml,
  exportedToneHasWav,
  extractYamlFields,
} from './helpers/roundtrip-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 5_000;
const MIDI_TRANSFER_TIMEOUT_MS = 60_000; // MIDI SysEx transfers to 1987 hardware are slow
const EXPORT_TIMEOUT_MS = 60_000;

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
// Shared Fixtures
// ---------------------------------------------------------------------------

const TONE_FIXTURE_NAME = 'rt-tone';

const TONE_YAML = `format: sampler-tone
device: ${DEVICE_TYPE}
version: 1
name: "RT Tone"
wave:
  file: "${TONE_FIXTURE_NAME}.wav"
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 30000
  loopPoint: 0
${DEVICE_TYPE}:
  originalKey: 60
  outputAssign: 0
`;

const TONE_WAV_BASE64 = createMinimalWavBase64(30000, 1);

// ---------------------------------------------------------------------------
// Console Debug Listener
// ---------------------------------------------------------------------------

function attachConsoleDebugListener(page: import('@playwright/test').Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('S330Client') ||
      text.includes('S550Client') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log(`BROWSER:`, text);
    }
  });
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Device Library Round Trip', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-device-library'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    // 1. Load app and connect to MIDI device
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');

    // 2. Navigate to Library page (don't connect to OPFS yet)
    await navigateToLibrary(page);

    // 3. Clean OPFS so each test starts fresh
    await initializeCleanOPFS(page, DEVICE_TYPE);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -------------------------------------------------------------------------
  // Tone Round Trip
  // -------------------------------------------------------------------------

  test('tone round trip: import from library, export from device, compare', async ({
    page,
  }) => {
    attachConsoleDebugListener(page);

    // Step 1: Create tone fixture in OPFS BEFORE connecting to library
    await writeToneFixtureToOPFS(
      page,
      DEVICE_TYPE,
      TONE_FIXTURE_NAME,
      TONE_YAML,
      TONE_WAV_BASE64
    );

    // Step 2: Connect to OPFS -- app reads library contents on connect
    await connectToOPFS(page);

    // Step 3: Wait for library tree to show the fixture tone
    const toneItem = page.locator(
      `[data-testid="library-tone-${TONE_FIXTURE_NAME}"]`
    );
    await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 4: Select the tone in the library tree
    await toneItem.click();

    // Step 5: Click "Import to Device"
    const importButton = page.locator(
      '[data-testid="import-to-device-button"]'
    );
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Step 6: Select target slot and confirm import
    const slotSelect = page.locator('[data-testid="target-slot-select"]');
    await expect(slotSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await slotSelect.selectOption('0');

    const confirmImport = page.locator(
      '[data-testid="confirm-import-button"]'
    );
    await expect(confirmImport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmImport.click();

    // Step 7: Wait for import success, then close the dialog
    await expect(
      page.locator('[data-testid="import-success"]')
    ).toBeVisible({ timeout: MIDI_TRANSFER_TIMEOUT_MS });

    // Click "Done" to dismiss the success dialog
    const doneButton = page.locator('button', { hasText: 'Done' });
    await doneButton.click();

    // Step 8: Navigate to Tones page via SPA link (preserves Zustand state)
    const tonesLink = page.locator('a[href$="/tones"]');
    await tonesLink.click();
    await page.waitForURL('**/tones**');

    const toneItems = page.locator('[data-testid^="tone-item-"]');
    await expect(toneItems.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 9: Find the imported tone at slot 0 and trigger bank load
    const deviceTone = page.locator('[data-testid="tone-item-0"]');
    await expect(deviceTone).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await deviceTone.click(); // triggers bank load if not yet loaded

    // Wait for tone data to load from device via MIDI
    const exportButton = deviceTone.locator(
      '[data-testid="export-tone-button"]'
    );
    await expect(exportButton).toBeVisible({ timeout: MIDI_TRANSFER_TIMEOUT_MS });
    await exportButton.click();

    // Step 10: Confirm export in export dialog
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmExport = exportDialog.locator(
      '[data-testid="export-confirm"]'
    );
    await expect(confirmExport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmExport.click();

    // Step 11: Wait for export success, then close the dialog
    const exportSuccess = exportDialog.locator('text=exported successfully');
    await expect(exportSuccess).toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    const exportDone = exportDialog.locator('button', { hasText: 'Done' });
    await exportDone.click();

    // Step 12: Verify exported tone exists in OPFS library
    const exportedTones = await listExportedTones(page, DEVICE_TYPE);

    // Filter out the original fixture -- the exported file has the
    // device-derived name, which may differ from the fixture filename.
    const exportedNames = exportedTones.filter(
      (name) => name !== TONE_FIXTURE_NAME
    );
    expect(
      exportedNames.length,
      `Expected at least one exported tone besides the fixture. ` +
        `Found: [${exportedTones.join(', ')}]`
    ).toBeGreaterThanOrEqual(1);

    const exportedName = exportedNames[0];

    // Verify WAV file was also exported
    const hasWav = await exportedToneHasWav(page, DEVICE_TYPE, exportedName);
    expect(
      hasWav,
      `Expected WAV file for exported tone "${exportedName}"`
    ).toBe(true);

    // Step 13: Compare exported YAML against original fixture
    const exportedYaml = await readExportedToneYaml(
      page,
      DEVICE_TYPE,
      exportedName
    );
    const originalFields = extractYamlFields(TONE_YAML);
    const exportedFields = extractYamlFields(exportedYaml);

    // format, device, version must match exactly
    expect(exportedFields['format']).toBe('sampler-tone');
    expect(exportedFields['device']).toBe(DEVICE_TYPE);
    expect(exportedFields['version']).toBe('1');

    // Name: device may pad or truncate -- compare trimmed
    const originalName =
      typeof originalFields['name'] === 'string'
        ? originalFields['name'].trim()
        : '';
    const exportedNameField =
      typeof exportedFields['name'] === 'string'
        ? exportedFields['name'].trim()
        : '';
    expect(exportedNameField).toBe(originalName);

    // Wave fields
    const originalWave = originalFields['wave'];
    const exportedWave = exportedFields['wave'];
    if (
      typeof originalWave === 'object' &&
      typeof exportedWave === 'object'
    ) {
      expect(exportedWave['sampleRate']).toBe(originalWave['sampleRate']);
      expect(exportedWave['loopMode']).toBe(originalWave['loopMode']);
    } else {
      throw new Error(
        'Expected wave sections in both original and exported YAML'
      );
    }

    // Device-specific fields
    const originalDevice = originalFields[DEVICE_TYPE];
    const exportedDevice = exportedFields[DEVICE_TYPE];
    if (
      typeof originalDevice === 'object' &&
      typeof exportedDevice === 'object'
    ) {
      expect(exportedDevice['originalKey']).toBe(
        originalDevice['originalKey']
      );
      expect(exportedDevice['outputAssign']).toBe(
        originalDevice['outputAssign']
      );
    } else {
      throw new Error(
        `Expected ${DEVICE_TYPE} sections in both original and exported YAML`
      );
    }
  });

  // -------------------------------------------------------------------------
  // Patch Round Trip
  // -------------------------------------------------------------------------

  test('patch round trip: import from library, export from device, compare', async ({
    page,
  }) => {
    attachConsoleDebugListener(page);

    // -- Fixture data -------------------------------------------------------

    const PATCH_FIXTURE_NAME = 'rt-patch';

    const PATCH_YAML = `format: sampler-patch
device: ${DEVICE_TYPE}
version: 1
name: "RT Patch"
level: 100
${DEVICE_TYPE}:
  keyMode: normal
  benderRange: 2
  toneLayer1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  toneLayer2: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
`;

    // Reuse the same tone fixture as the tone round trip test
    const DEPENDENT_TONE_YAML = `format: sampler-tone
device: ${DEVICE_TYPE}
version: 1
name: "RT Tone"
wave:
  file: "T01.wav"
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 30000
  loopPoint: 0
${DEVICE_TYPE}:
  originalKey: 60
  outputAssign: 0
`;

    // Step 1: Create patch fixture in OPFS BEFORE connecting to library
    await writePatchFixtureToOPFS(
      page,
      DEVICE_TYPE,
      PATCH_FIXTURE_NAME,
      PATCH_YAML,
      [
        {
          slotLabel: 'T01',
          yaml: DEPENDENT_TONE_YAML,
          wavBase64: TONE_WAV_BASE64,
        },
      ]
    );

    // Step 2: Connect to OPFS -- app reads library contents on connect
    await connectToOPFS(page);

    // Step 3: Switch to patches tab and wait for fixture to appear
    const patchesTab = page.locator(
      '[data-testid="library-patches-tab"]'
    );
    await expect(patchesTab).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await patchesTab.click();

    const patchItem = page.locator(
      `[data-testid="library-patch-${PATCH_FIXTURE_NAME}"]`
    );
    await expect(patchItem).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 4: Select the patch in the library tree
    await patchItem.click();

    // Step 5: Click "Import to Device"
    const importButton = page.locator(
      '[data-testid="import-to-device-button"]'
    );
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Step 6: Select target patch slot and confirm import
    // The import dialog for patches shows tone mapping -- accept defaults
    const slotSelect = page.locator('[data-testid="target-slot-select"]');
    await expect(slotSelect).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await slotSelect.selectOption('0');

    const confirmImport = page.locator(
      '[data-testid="confirm-import-button"]'
    );
    await expect(confirmImport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmImport.click();

    // Step 7: Wait for import success, then close the dialog
    await expect(
      page.locator('[data-testid="import-success"]')
    ).toBeVisible({ timeout: MIDI_TRANSFER_TIMEOUT_MS });

    const doneButton = page.locator('button', { hasText: 'Done' });
    await doneButton.click();

    // Step 8: Navigate to Patches page via SPA link
    const patchesLink = page.locator('a[href$="/patches"]');
    await patchesLink.click();
    await page.waitForURL('**/patches**');

    const patchItems = page.locator('[data-testid^="patch-item-"]');
    await expect(patchItems.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 9: Find the imported patch at slot 0 and trigger bank load
    const devicePatch = page.locator('[data-testid="patch-item-0"]');
    await expect(devicePatch).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await devicePatch.click();

    // Wait for patch data to load from device via MIDI
    const exportButton = page.locator(
      '[data-testid="export-patch-button"]'
    );
    await expect(exportButton).toBeVisible({
      timeout: MIDI_TRANSFER_TIMEOUT_MS,
    });
    await exportButton.click();

    // Step 10: Confirm export in export dialog
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const confirmExport = exportDialog.locator(
      '[data-testid="export-confirm"]'
    );
    await expect(confirmExport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmExport.click();

    // Step 11: Wait for export success, then close the dialog
    const exportSuccess = exportDialog.locator('text=exported successfully');
    await expect(exportSuccess).toBeVisible({ timeout: EXPORT_TIMEOUT_MS });

    const exportDone = exportDialog.locator('button', { hasText: 'Done' });
    await exportDone.click();

    // Step 12: Verify exported patch exists in OPFS library
    const exportedPatches = await listExportedPatches(page, DEVICE_TYPE);

    // Filter out the original fixture
    const exportedNames = exportedPatches.filter(
      (name) => name !== PATCH_FIXTURE_NAME
    );
    expect(
      exportedNames.length,
      `Expected at least one exported patch besides the fixture. ` +
        `Found: [${exportedPatches.join(', ')}]`
    ).toBeGreaterThanOrEqual(1);

    const exportedName = exportedNames[0];

    // Step 13: Compare exported YAML against original fixture
    const exportedYaml = await readExportedPatchYaml(
      page,
      DEVICE_TYPE,
      exportedName
    );
    const originalFields = extractYamlFields(PATCH_YAML);
    const exportedFields = extractYamlFields(exportedYaml);

    // format, device, version must match exactly
    expect(exportedFields['format']).toBe('sampler-patch');
    expect(exportedFields['device']).toBe(DEVICE_TYPE);
    expect(exportedFields['version']).toBe('1');

    // Name: device may pad or truncate -- compare trimmed
    const originalName =
      typeof originalFields['name'] === 'string'
        ? originalFields['name'].trim()
        : '';
    const exportedNameField =
      typeof exportedFields['name'] === 'string'
        ? exportedFields['name'].trim()
        : '';
    expect(exportedNameField).toBe(originalName);

    // Level
    expect(exportedFields['level']).toBe(originalFields['level']);

    // Device-specific fields (don't compare toneLayer arrays -- device may remap)
    const originalDeviceSection = originalFields[DEVICE_TYPE];
    const exportedDeviceSection = exportedFields[DEVICE_TYPE];
    if (
      typeof originalDeviceSection === 'object' &&
      typeof exportedDeviceSection === 'object'
    ) {
      expect(exportedDeviceSection['keyMode']).toBe(
        originalDeviceSection['keyMode']
      );
      expect(exportedDeviceSection['benderRange']).toBe(
        originalDeviceSection['benderRange']
      );
    } else {
      throw new Error(
        `Expected ${DEVICE_TYPE} sections in both original and exported YAML`
      );
    }
  });
});
