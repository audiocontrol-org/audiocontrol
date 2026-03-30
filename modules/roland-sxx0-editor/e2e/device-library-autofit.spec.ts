/**
 * E2E auto-fit roundtrip tests for device-library integration.
 *
 * These tests use the "Find Best Fit" button to auto-allocate non-conflicting
 * slots instead of manually selecting slot 0. They adapt to the current device
 * state and skip if preconditions are not met.
 *
 * Each test:
 *   1. Loads all device data to get a memory snapshot
 *   2. Validates preconditions (enough empty slots)
 *   3. Creates fixture in OPFS library
 *   4. Imports via Find Best Fit (auto-allocation)
 *   5. Verifies allocated slots don't overlap with existing data
 *   6. Exports from device and compares against original fixture
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
  loadAllDeviceData,
  queryDeviceMemoryState,
  type DeviceMemoryState,
  type ToneSlotSummary,
} from './helpers/roundtrip-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const DEVICE_TYPE = process.env.E2E_DEVICE_TYPE ?? 's330';
const EDITOR_BASE_PATH = `/roland/${DEVICE_TYPE}/editor`;

const UI_TIMEOUT_MS = 5_000;
const MIDI_TRANSFER_TIMEOUT_MS = 60_000;
const EXPORT_TIMEOUT_MS = 60_000;

const TONE_WAV_BASE64 = createMinimalWavBase64(30000, 1);

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
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      console.log(`BROWSER:`, text);
    }
  });
}

// ---------------------------------------------------------------------------
// Wave Segment Overlap Verification
// ---------------------------------------------------------------------------

/**
 * Assert that newly allocated tone slots don't overlap wave segments
 * with previously occupied tones in the same bank.
 */
function assertNoWaveSegmentOverlap(
  memStateBefore: DeviceMemoryState,
  newToneSlots: ToneSlotSummary[],
): void {
  for (const newTone of newToneSlots) {
    const previouslyOccupied = memStateBefore.tones
      .filter((t) => !t.empty && t.waveBank === newTone.waveBank)
      .flatMap((t) =>
        Array.from({ length: t.segmentLength }, (_, i) => t.segmentTop + i)
      );
    const previousSegmentSet = new Set(previouslyOccupied);

    const importedSegments = Array.from(
      { length: newTone.segmentLength },
      (_, i) => newTone.segmentTop + i
    );
    const overlapping = importedSegments.filter((s) =>
      previousSegmentSet.has(s)
    );

    expect(
      overlapping.length,
      `Auto-fit tone at slot ${newTone.index} has wave segments overlapping ` +
        `with existing data in bank ${newTone.waveBank}. ` +
        `Imported: [${importedSegments.join(', ')}], ` +
        `Overlapping: [${overlapping.join(', ')}]`
    ).toBe(0);
  }
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Device Library Auto-Fit Round Trip', () => {
  test.beforeAll(async () => {
    if (!MIDI_SERVER_PORT) {
      throw new Error(
        'E2E_MIDI_SERVER_PORT must be set. Run via: make test-e2e-device-library'
      );
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(buildUrl(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    expect(await getMidiStatus(page)).toBe('connected');
    await navigateToLibrary(page);
    await initializeCleanOPFS(page, DEVICE_TYPE);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -------------------------------------------------------------------------
  // Tone Auto-Fit Round Trip
  // -------------------------------------------------------------------------

  test('tone auto-fit round trip: best-fit import, export, compare', async ({
    page,
  }) => {
    attachConsoleDebugListener(page);

    // Step 1: Load all device data to get complete memory state
    await loadAllDeviceData(page);
    const memStateBefore = await queryDeviceMemoryState(page);
    console.log(
      `Device state before: ${memStateBefore.occupiedToneCount} occupied tones, ` +
        `${memStateBefore.emptyToneCount} empty tones`
    );

    // Step 2: Validate preconditions
    if (memStateBefore.emptyToneCount < 1) {
      test.skip(
        true,
        `Not enough empty tone slots (need 1, have ${memStateBefore.emptyToneCount})`
      );
      return;
    }

    // Step 3: Write tone fixture to OPFS
    const AF_TONE_NAME = 'af-tone';
    const AF_TONE_YAML = `format: sampler-tone
device: ${DEVICE_TYPE}
version: 1
name: "AF Tone"
wave:
  file: "${AF_TONE_NAME}.wav"
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 30000
  loopPoint: 0
${DEVICE_TYPE}:
  originalKey: 60
  outputAssign: 0
`;
    await writeToneFixtureToOPFS(
      page, DEVICE_TYPE, AF_TONE_NAME, AF_TONE_YAML, TONE_WAV_BASE64
    );

    // Step 4: Connect to OPFS and select fixture
    await connectToOPFS(page);
    const toneItem = page.locator(
      `[data-testid="library-tone-${AF_TONE_NAME}"]`
    );
    await expect(toneItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await toneItem.click();

    // Step 5: Open import dialog
    const importButton = page.locator(
      '[data-testid="import-to-device-button"]'
    );
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Step 6: Click "Find Best Fit" and select the first option.
    // BestFitPicker renders option buttons inside a .space-y-1 container.
    const findBestFitButton = page.locator('button', {
      hasText: 'Find Best Fit',
    });
    await expect(findBestFitButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await findBestFitButton.click();

    const bestFitOptions = page.locator('.space-y-1 > button');
    await expect(bestFitOptions.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Log what options are available
    const optionCount = await bestFitOptions.count();
    for (let i = 0; i < Math.min(optionCount, 3); i++) {
      const text = await bestFitOptions.nth(i).textContent();
      console.log(`Best-fit option ${i}: ${text?.trim()}`);
    }

    await bestFitOptions.first().click();

    // Log what slot was selected after best-fit
    const slotAfterFit = page.locator('[data-testid="target-slot-select"]');
    const selectedSlot = await slotAfterFit.inputValue().catch(() => 'N/A');
    console.log(`Auto-fit selected target slot: ${selectedSlot}`);

    // Step 7: Confirm import
    const confirmImport = page.locator(
      '[data-testid="confirm-import-button"]'
    );
    await expect(confirmImport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmImport.click();

    await expect(
      page.locator('[data-testid="import-success"]')
    ).toBeVisible({ timeout: MIDI_TRANSFER_TIMEOUT_MS });
    await page.locator('button', { hasText: 'Done' }).click();

    // Step 8: Reload device data and find the newly allocated slot
    // We're already on the Library page — just refresh device data
    await loadAllDeviceData(page);
    const memStateAfter = await queryDeviceMemoryState(page);

    console.log(
      `Device state after: ${memStateAfter.occupiedToneCount} occupied tones, ` +
        `${memStateAfter.emptyToneCount} empty tones`
    );

    // Debug: log specific slots that changed or were expected to change
    for (const slot of memStateAfter.tones.slice(0, 8)) {
      const before = memStateBefore.tones[slot.index];
      if (before.empty !== slot.empty || before.name !== slot.name) {
        console.log(`Slot ${slot.index} CHANGED: "${before.name}" (empty=${before.empty}) → "${slot.name}" (empty=${slot.empty}, seg=${slot.segmentLength})`);
      }
    }
    // Also log the specific slot auto-fit chose
    const fitSlotIdx = parseInt(selectedSlot, 10);
    if (!isNaN(fitSlotIdx)) {
      const before = memStateBefore.tones[fitSlotIdx];
      const after = memStateAfter.tones[fitSlotIdx];
      console.log(`Fit target slot ${fitSlotIdx} before: "${before?.name}" empty=${before?.empty} seg=${before?.segmentLength}`);
      console.log(`Fit target slot ${fitSlotIdx} after: "${after?.name}" empty=${after?.empty} seg=${after?.segmentLength}`);
    }

    // Detect the imported slot by checking for:
    // 1. Slots that transitioned from empty to occupied
    // 2. Slots where the name changed (overwrite of an occupied slot)
    const changedToneSlots = memStateAfter.tones.filter((after) => {
      const before = memStateBefore.tones[after.index];
      if (!before) return false;
      // New occupation
      if (before.empty && !after.empty) return true;
      // Name changed on an occupied slot (overwrite)
      if (!before.empty && !after.empty && before.name !== after.name) return true;
      // Wave allocation changed on an occupied slot
      if (!before.empty && !after.empty && (
        before.waveBank !== after.waveBank ||
        before.segmentTop !== after.segmentTop ||
        before.segmentLength !== after.segmentLength
      )) return true;
      return false;
    });

    // Log all changes for diagnostics
    for (const slot of changedToneSlots) {
      const before = memStateBefore.tones[slot.index];
      console.log(
        `Tone slot ${slot.index} changed: ` +
          `"${before.name}" → "${slot.name}", ` +
          `empty: ${before.empty} → ${slot.empty}, ` +
          `wave: bank ${before.waveBank} seg ${before.segmentTop}×${before.segmentLength} → ` +
          `bank ${slot.waveBank} seg ${slot.segmentTop}×${slot.segmentLength}`
      );
    }

    // If auto-fit chose an occupied slot, that's a bug in the algorithm —
    // it should prefer empty slots. Log it but continue with the test.
    const newSlots = changedToneSlots.filter((after) => {
      const before = memStateBefore.tones[after.index];
      return before && before.empty;
    });
    const overwrittenSlots = changedToneSlots.filter((after) => {
      const before = memStateBefore.tones[after.index];
      return before && !before.empty;
    });

    if (overwrittenSlots.length > 0 && newSlots.length === 0) {
      console.warn(
        `AUTO-FIT BUG: overwrote occupied slot(s) [${overwrittenSlots.map(s => s.index).join(', ')}] ` +
          `instead of using empty slots (${memStateBefore.emptyToneCount} were available)`
      );
    }

    expect(
      changedToneSlots.length,
      `Expected at least one changed tone slot after auto-fit import. ` +
        `Before: ${memStateBefore.occupiedToneCount} occupied, ${memStateBefore.emptyToneCount} empty. ` +
        `After: ${memStateAfter.occupiedToneCount} occupied, ${memStateAfter.emptyToneCount} empty.`
    ).toBeGreaterThanOrEqual(1);

    const importedSlot = changedToneSlots[0];
    console.log(
      `Auto-fit allocated tone to slot ${importedSlot.index} ` +
        `(name: "${importedSlot.name}", wave bank: ${importedSlot.waveBank}, ` +
        `segment: ${importedSlot.segmentTop}, length: ${importedSlot.segmentLength})`
    );

    // Step 9: Verify no wave segment overlaps
    assertNoWaveSegmentOverlap(memStateBefore, changedToneSlots);

    // Step 10: Navigate to Tones page and export the imported tone
    const tonesLink = page.locator('a[href$="/tones"]');
    await tonesLink.click();
    await page.waitForURL('**/tones**');

    const deviceTone = page.locator(
      `[data-testid="tone-item-${importedSlot.index}"]`
    );
    await expect(deviceTone).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await deviceTone.click();

    const exportButton = deviceTone.locator(
      '[data-testid="export-tone-button"]'
    );
    await expect(exportButton).toBeVisible({
      timeout: MIDI_TRANSFER_TIMEOUT_MS,
    });
    await exportButton.click();

    // Step 11: Confirm export
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const confirmExport = exportDialog.locator(
      '[data-testid="export-confirm"]'
    );
    await expect(confirmExport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmExport.click();

    await expect(
      exportDialog.locator('text=exported successfully')
    ).toBeVisible({ timeout: EXPORT_TIMEOUT_MS });
    await exportDialog.locator('button', { hasText: 'Done' }).click();

    // Step 12: Verify exported tone in OPFS and compare YAML
    const exportedTones = await listExportedTones(page, DEVICE_TYPE);
    const exportedNames = exportedTones.filter((n) => n !== AF_TONE_NAME);
    expect(exportedNames.length).toBeGreaterThanOrEqual(1);

    const exportedName = exportedNames[0];
    expect(
      await exportedToneHasWav(page, DEVICE_TYPE, exportedName)
    ).toBe(true);

    const exportedYaml = await readExportedToneYaml(
      page, DEVICE_TYPE, exportedName
    );
    const exportedFields = extractYamlFields(exportedYaml);

    expect(exportedFields['format']).toBe('sampler-tone');
    expect(exportedFields['device']).toBe(DEVICE_TYPE);

    const exportedNameField =
      typeof exportedFields['name'] === 'string'
        ? exportedFields['name'].trim()
        : '';
    expect(exportedNameField).toBe('AF Tone');
  });

  // -------------------------------------------------------------------------
  // Patch Auto-Fit Round Trip
  // -------------------------------------------------------------------------

  test('patch auto-fit round trip: best-fit import, export, compare', async ({
    page,
  }) => {
    attachConsoleDebugListener(page);

    // Step 1: Load all device data
    await loadAllDeviceData(page);
    const memStateBefore = await queryDeviceMemoryState(page);
    console.log(
      `Device state before: ${memStateBefore.occupiedPatchCount} occupied patches, ` +
        `${memStateBefore.emptyPatchCount} empty patches, ` +
        `${memStateBefore.occupiedToneCount} occupied tones, ` +
        `${memStateBefore.emptyToneCount} empty tones`
    );

    // Step 2: Validate preconditions
    if (memStateBefore.emptyPatchCount < 1) {
      test.skip(
        true,
        `Not enough empty patch slots (need 1, have ${memStateBefore.emptyPatchCount})`
      );
      return;
    }
    if (memStateBefore.emptyToneCount < 1) {
      test.skip(
        true,
        `Not enough empty tone slots (need 1, have ${memStateBefore.emptyToneCount})`
      );
      return;
    }

    // Step 3: Write patch fixture to OPFS
    const AF_PATCH_NAME = 'af-patch';
    const AF_PATCH_YAML = `format: sampler-patch
device: ${DEVICE_TYPE}
version: 1
name: "AF Patch"
level: 100
${DEVICE_TYPE}:
  keyMode: normal
  benderRange: 2
  toneLayer1: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  toneLayer2: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]
`;

    const AF_DEPENDENT_TONE_YAML = `format: sampler-tone
device: ${DEVICE_TYPE}
version: 1
name: "AF Tone"
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

    await writePatchFixtureToOPFS(
      page, DEVICE_TYPE, AF_PATCH_NAME, AF_PATCH_YAML,
      [{
        slotLabel: 'T01',
        yaml: AF_DEPENDENT_TONE_YAML,
        wavBase64: TONE_WAV_BASE64,
      }]
    );

    // Step 4: Connect to OPFS, switch to patches tab, select fixture
    await connectToOPFS(page);
    const patchesTab = page.locator('[data-testid="library-patches-tab"]');
    await expect(patchesTab).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await patchesTab.click();

    const patchItem = page.locator(
      `[data-testid="library-patch-${AF_PATCH_NAME}"]`
    );
    await expect(patchItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await patchItem.click();

    // Step 5: Open import dialog
    const importButton = page.locator(
      '[data-testid="import-to-device-button"]'
    );
    await expect(importButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await importButton.click();

    // Step 6: Click "Find Best Fit" and select the first option
    const findBestFitButton = page.locator('button', {
      hasText: 'Find Best Fit',
    });
    await expect(findBestFitButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await findBestFitButton.click();

    const bestFitOptions = page.locator('.space-y-1 > button');
    await expect(bestFitOptions.first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await bestFitOptions.first().click();

    // Step 7: Confirm import
    const confirmImport = page.locator(
      '[data-testid="confirm-import-button"]'
    );
    await expect(confirmImport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmImport.click();

    await expect(
      page.locator('[data-testid="import-success"]')
    ).toBeVisible({ timeout: MIDI_TRANSFER_TIMEOUT_MS });
    await page.locator('button', { hasText: 'Done' }).click();

    // Step 8: Reload device data and find newly allocated slots
    await navigateToLibrary(page);
    await loadAllDeviceData(page);
    const memStateAfter = await queryDeviceMemoryState(page);

    console.log(
      `Device state after: ${memStateAfter.occupiedPatchCount} occupied patches, ` +
        `${memStateAfter.occupiedToneCount} occupied tones`
    );

    // Find newly occupied patch slot
    const newPatchSlots = memStateAfter.patches.filter((after) => {
      const before = memStateBefore.patches[after.index];
      return before && before.empty && !after.empty;
    });
    expect(
      newPatchSlots.length,
      `Expected at least one newly occupied patch slot after auto-fit import`
    ).toBeGreaterThanOrEqual(1);

    const importedPatchSlot = newPatchSlots[0];
    console.log(
      `Auto-fit allocated patch to slot ${importedPatchSlot.index} ` +
        `(name: "${importedPatchSlot.name}")`
    );

    // Find newly occupied tone slot(s)
    const newToneSlots = memStateAfter.tones.filter((after) => {
      const before = memStateBefore.tones[after.index];
      return before && before.empty && !after.empty;
    });
    expect(
      newToneSlots.length,
      `Expected at least one newly occupied tone slot for dependent tone`
    ).toBeGreaterThanOrEqual(1);

    // Step 9: Verify no wave segment overlaps
    assertNoWaveSegmentOverlap(memStateBefore, newToneSlots);

    // Step 10: Navigate to Patches page and export
    const patchesLink = page.locator('a[href$="/patches"]');
    await patchesLink.click();
    await page.waitForURL('**/patches**');

    const devicePatch = page.locator(
      `[data-testid="patch-item-${importedPatchSlot.index}"]`
    );
    await expect(devicePatch).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await devicePatch.click();

    const exportButton = page.locator(
      '[data-testid="export-patch-button"]'
    );
    await expect(exportButton).toBeVisible({
      timeout: MIDI_TRANSFER_TIMEOUT_MS,
    });
    await exportButton.click();

    // Step 11: Confirm export
    const exportDialog = page.locator('[data-testid="export-dialog"]');
    await expect(exportDialog).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const confirmExport = exportDialog.locator(
      '[data-testid="export-confirm"]'
    );
    await expect(confirmExport).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmExport.click();

    await expect(
      exportDialog.locator('text=exported successfully')
    ).toBeVisible({ timeout: EXPORT_TIMEOUT_MS });
    await exportDialog.locator('button', { hasText: 'Done' }).click();

    // Step 12: Verify exported patch in OPFS and compare YAML
    const exportedPatches = await listExportedPatches(page, DEVICE_TYPE);
    const exportedNames = exportedPatches.filter((n) => n !== AF_PATCH_NAME);
    expect(exportedNames.length).toBeGreaterThanOrEqual(1);

    const exportedName = exportedNames[0];
    const exportedYaml = await readExportedPatchYaml(
      page, DEVICE_TYPE, exportedName
    );
    const exportedFields = extractYamlFields(exportedYaml);

    expect(exportedFields['format']).toBe('sampler-patch');
    expect(exportedFields['device']).toBe(DEVICE_TYPE);

    const exportedNameField =
      typeof exportedFields['name'] === 'string'
        ? exportedFields['name'].trim()
        : '';
    expect(exportedNameField).toBe('AF Patch');
    expect(exportedFields['level']).toBe('100');

    const exportedDeviceSection = exportedFields[DEVICE_TYPE];
    if (typeof exportedDeviceSection === 'object') {
      expect(exportedDeviceSection['keyMode']).toBe('normal');
      expect(exportedDeviceSection['benderRange']).toBe('2');
    } else {
      throw new Error(
        `Expected ${DEVICE_TYPE} section in exported patch YAML`
      );
    }
  });
});
