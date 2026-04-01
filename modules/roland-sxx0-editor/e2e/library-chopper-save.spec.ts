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

/** Tone fixture: same audio but stored as an individual tone. */
const TONE_FIXTURE_NAME = 'e2e-chop-tone';
const TONE_YAML = `name: "E2E Chop Tone"
sampleRate: 30000
loopStart: 0
loopEnd: 59999
rootKey: 60
fineTune: 0`;

// ===========================================================================
// Test Suite: Save Slices to Library (11.1.10)
// ===========================================================================

test.describe('Chopper Save — save slices to library', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Library page (no mock — uses real OPFS)
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

  test('Save button is disabled when no slices exist', async ({ page }) => {
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

test.describe('Chopper Save — chop into drum kit', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Library page (no mock — uses real OPFS)
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

    // Step 5: Verify kit config fields are present
    await expect(page.getByText('Kit Name (max 12 chars)')).toBeVisible();
    await expect(page.getByText('Sample Rate')).toBeVisible();
    await expect(page.getByText('Base MIDI Note')).toBeVisible();
    await expect(page.getByText('Labels (comma-separated)')).toBeVisible();
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

    // Confirm/Save the drum kit
    // NOTE: This button does not yet exist in the dialog when only onConfirm
    // is provided. When implemented, update this selector.
    const confirmButton = page.getByRole('button', { name: /Save|Confirm|Create Kit/ });
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
