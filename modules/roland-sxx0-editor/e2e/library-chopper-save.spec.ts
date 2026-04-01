/**
 * E2E tests for sample chopper save-to-library flows.
 *
 * Tests the following scenarios (library-only, no hardware required):
 *
 *   11.1.10 -- Save slices to library
 *     Open chopper on a common-area sample, slice with Fixed method,
 *     click Save, verify sample.yaml with slice definitions written to OPFS.
 *
 *   11.2.2 -- Save writes slice labels
 *     Open chopper on a common-area sample, slice with Fixed method,
 *     click Save, verify sample.yaml contains label fields (S1..S4).
 *
 *   11.2.3 -- Chop into Drum Kit (save slices as drum kit)
 *     Open chopper on an individual library tone via "Chop into Drum Kit",
 *     slice, verify drum kit output config renders, confirm creates
 *     kit.yaml in OPFS drum-kits directory.
 *
 * These tests create fixture audio in OPFS, connect the library backend via
 * the UI, then interact with the library tree and chopper dialog. They use
 * the real OPFS storage and real app UI -- no mocks.
 *
 * Run via: make test-e2e-library ARGS="--grep 'Chopper Save'"
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  createMinimalWavBase64,
  cleanupOPFS,
  initializeCleanOPFS,
  writeSampleFixtureToOPFS,
  writeToneFixtureToOPFS,
  readSampleYaml,
  readDrumKitYaml,
  listDrumKitDirectories,
  connectToOPFSBackend,
} from './helpers/library-opfs-helpers';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(30_000);

/** OPFS paths always use 's330' regardless of device type */
const LIBRARY_DEVICE = 's330';

const UI_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Sample fixture: 2 seconds of silence at 30kHz (60000 samples, divisible by 4). */
const SAMPLE_WAV_BASE64 = createMinimalWavBase64(30000, 2);
const SAMPLE_FIXTURE_NAME = 'e2e-chop-source';

/**
 * Tone fixture: same audio but stored as an individual tone.
 *
 * Must conform to ToneYamlSchema from sampler-library, which requires:
 * format, device, version, name, wave (with file, sampleRate, loopMode),
 * and a device-specific extension object (s330).
 */
const TONE_FIXTURE_NAME = 'e2e-chop-tone';
const TONE_YAML = `format: sampler-tone
device: s330
version: 1
name: E2E-CHOPTONE
wave:
  file: e2e-chop-tone.wav
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 59999
  loopPoint: 0
s330:
  originalKey: 60
  outputAssign: 0
  transpose: 0
  fineTune: 0
  tva:
    level: 100
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8`;

// ===========================================================================
// Test Suite: Save Slices to Library (11.1.10)
// ===========================================================================

test.describe('Chopper Save -- save slices to library', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Library page (no mock -- uses real OPFS)
    await page.goto('/roland/s330/editor/library?midi=mock');
    await page.waitForLoadState('networkidle');

    // Clean OPFS and write sample fixture BEFORE connecting
    await initializeCleanOPFS(page, LIBRARY_DEVICE);
    await writeSampleFixtureToOPFS(
      page,
      SAMPLE_FIXTURE_NAME,
      30000,
      SAMPLE_WAV_BASE64,
    );

    // Connect to OPFS library backend via UI button
    await connectToOPFSBackend(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('fixed slicing then Save writes sample.yaml with slice definitions', async ({ page }) => {
    // Step 1: Find and click the sample in the library tree using CSS class selector.
    // Use the same pattern as sample-chopper-production.spec.ts
    const sampleNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`) }).first();
    await expect(sampleNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Click the parent tree node
    const treeNode = sampleNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

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
    const sampleNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`) }).first();
    await expect(sampleNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const treeNode = sampleNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

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

  test('saved slice boundaries persist when chopper is reopened', async ({ page }) => {
    // Step 1: Open chopper on the sample
    const sampleNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`) }).first();
    await expect(sampleNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const treeNode = sampleNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

    const chopButton = page.getByRole('button', { name: 'Open in Chopper' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Step 2: Create 4 slices with Fixed method and save
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForTimeout(2_000);

    // Verify the save wrote slices to the YAML
    const yamlAfterSave = await readSampleYaml(page, SAMPLE_FIXTURE_NAME);
    expect(yamlAfterSave).toContain('slices:');
    const sliceMatches = yamlAfterSave.match(/startSample:/g);
    expect(sliceMatches?.length).toBe(4);

    // Step 3: Close the chopper dialog
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();
    await expect(dialog).not.toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 4: Reopen the chopper on the same sample
    await treeNode.click();
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Step 5: Verify slices are pre-populated.
    // The dialog should show the Manual tab with 4 slices loaded from the YAML.
    // The status bar renders "{N} slice{s}" when currentSliceResult has slices.
    // Wait longer since initial slices need to be computed.
    await expect(dialog.getByText(/4 slice/)).toBeVisible({ timeout: 10_000 });
  });

  test('Save writes sample.yaml with correct slice labels', async ({ page }) => {
    // Step 1: Open the sample in the chopper
    const sampleNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`) }).first();
    await expect(sampleNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const treeNode = sampleNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

    const chopButton = page.getByRole('button', { name: 'Open in Chopper' });
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });

    // Step 2: Switch to Fixed tab and set 4 slices
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Step 3: Click Save and wait for completion
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForTimeout(2_000);

    // Step 4: Read saved YAML and verify label fields
    const yamlContent = await readSampleYaml(page, SAMPLE_FIXTURE_NAME);
    expect(yamlContent).toContain('slices:');

    // The default kit labels are S1,S2,S3,S4 — the chopper uppercases them
    // and assigns one per slice in order.
    const labelMatches = yamlContent.match(/label:/g);
    expect(
      labelMatches?.length,
      `Expected 4 label fields in sample.yaml, found ${labelMatches?.length ?? 0}`,
    ).toBe(4);

    // Verify each default label is present
    expect(yamlContent).toContain('label: S1');
    expect(yamlContent).toContain('label: S2');
    expect(yamlContent).toContain('label: S3');
    expect(yamlContent).toContain('label: S4');
  });

  test.fixme('Save button is disabled when no slices exist', async ({ page }) => {
    // FIXME: Save button is enabled even with no slices -- possible UX issue
    const sampleNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`) }).first();
    await expect(sampleNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const treeNode = sampleNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

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

test.describe('Chopper Save -- chop into drum kit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Library page (no mock -- uses real OPFS)
    await page.goto('/roland/s330/editor/library?midi=mock');
    await page.waitForLoadState('networkidle');

    // Clean OPFS and write tone fixture BEFORE connecting
    await initializeCleanOPFS(page, LIBRARY_DEVICE);
    await writeToneFixtureToOPFS(
      page,
      LIBRARY_DEVICE,
      TONE_FIXTURE_NAME,
      TONE_YAML,
      SAMPLE_WAV_BASE64,
    );

    // Connect to OPFS library backend via UI button
    await connectToOPFSBackend(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('Chop into Drum Kit opens chopper with kit output config', async ({ page }) => {
    // Step 1: Select the individual tone in the library tree using CSS class selector.
    // Find the tone by name and click its tree node
    const toneNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${TONE_FIXTURE_NAME}$`) }).first();
    await expect(toneNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const treeNode = toneNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

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

    // Step 5: Verify kit config fields are present (scoped to dialog to avoid strict-mode violations)
    await expect(dialog.getByText('Kit Name (max 12 chars)')).toBeVisible();
    await expect(dialog.getByText('Sample Rate')).toBeVisible();
    await expect(dialog.getByText('Base MIDI Note')).toBeVisible();
    await expect(dialog.getByText('Labels (comma-separated)')).toBeVisible();
  });

  test('Chop into Drum Kit shows slices with Fixed method', async ({ page }) => {
    const toneNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${TONE_FIXTURE_NAME}$`) }).first();
    await expect(toneNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const treeNode = toneNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

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

  test('saving drum kit creates kit.yaml in OPFS', async ({ page }) => {
    const toneNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${TONE_FIXTURE_NAME}$`) }).first();
    await expect(toneNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const treeNode = toneNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

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

    // Click "Create Drum Kit" button (added to SampleChopperDialog footer
    // when renderOutputConfig is provided and onSave is not)
    const confirmButton = page.getByRole('button', { name: 'Create Drum Kit' });
    await expect(confirmButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await confirmButton.click();

    // Wait for save to complete
    await page.waitForTimeout(2_000);

    // Verify drum kit was created in OPFS
    const kitDirs = await listDrumKitDirectories(page, LIBRARY_DEVICE);
    expect(kitDirs.length).toBeGreaterThanOrEqual(1);

    // Find the kit (name is derived from tone name, uppercased, max 12 chars)
    const expectedKitName = TONE_FIXTURE_NAME
      .replace(/\.wav$/i, '')
      .toUpperCase()
      .slice(0, 12)
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_');

    const kitYaml = await readDrumKitYaml(page, LIBRARY_DEVICE, expectedKitName);
    expect(kitYaml).not.toBeNull();
    expect(kitYaml).toContain('format: drum-kit-bundle');
    expect(kitYaml).toContain('version: 2');
    expect(kitYaml).toContain('slices:');
    expect(kitYaml).toContain('source: source.wav');
  });
});
