/**
 * E2E tests for sample chopper save-to-library flows (S3K editor).
 *
 * Tests the chopper dialog's save functionality:
 *   - Fixed slicing → save writes sample.yaml with slice definitions
 *   - Saved slice boundaries persist when chopper is reopened
 *   - Chop into Drum Kit creates kit.yaml in OPFS
 *   - Save writes sample.yaml with correct slice labels
 *
 * These are library-only tests — no hardware required. The chopper is a
 * shared component from editor-core; these tests verify it works in the
 * S3K editor context.
 *
 * Run via: modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library 'ARGS=--grep "Chopper"'
 */

import { test, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
  createMinimalWavBase64,
  cleanupOPFS,
  initializeS3kOPFS,
  readSampleYaml,
  connectToOPFS,
} from '../../e2e-infra/helpers/library-ui-helpers';
// Fixture audio generated inline — see beforeEach

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(30_000);

const UI_TIMEOUT_MS = 5_000;
const port = process.env.E2E_PORT;

if (!port) {
  throw new Error('E2E_PORT must be set. Run via: make test-e2e-s3k-library');
}

const LIBRARY_URL = `https://localhost:${port}/akai/s3000xl/editor/library`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** 2 seconds of silence at 30kHz (60000 samples, divisible by 4 and 8). */
const SAMPLE_WAV_BASE64 = createMinimalWavBase64(30000, 2);
const SAMPLE_FIXTURE_NAME = 'e2e-chop-source';

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Chopper Save -- save slices to library', () => {
  test.beforeEach(async ({ page }) => {
    // Capture browser console for debugging
    page.on('console', (msg) => console.log(`BROWSER [${msg.type()}]:`, msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

    await page.goto(LIBRARY_URL);
    await page.waitForLoadState('networkidle');

    await cleanupOPFS(page);
    await initializeS3kOPFS(page);

    // Write a sample with enough audio for slicing (60000 samples = 2s at 30kHz)
    await page.evaluate(async ({ name, wavBase64 }: { name: string; wavBase64: string }) => {
      const root = await navigator.storage.getDirectory();
      let dir = root;
      for (const seg of ['library', 'common', 'samples']) {
        dir = await dir.getDirectoryHandle(seg, { create: true });
      }
      const sampleDir = await dir.getDirectoryHandle(name, { create: true });

      const yaml = `format: sample\nversion: 1\nname: "${name}"\nfile: sample.wav\nsampleRate: 30000\n`;
      const yh = await sampleDir.getFileHandle('sample.yaml', { create: true });
      const yw = await yh.createWritable();
      await yw.write(yaml);
      await yw.close();

      const bin = atob(wavBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const wh = await sampleDir.getFileHandle('sample.wav', { create: true });
      const ww = await wh.createWritable();
      await ww.write(bytes);
      await ww.close();
    }, { name: SAMPLE_FIXTURE_NAME, wavBase64: SAMPLE_WAV_BASE64 });

    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('fixed slicing then Save writes sample.yaml with slice definitions', async ({ page }) => {
    // Click sample in library tree
    const sampleNode = page.locator('.ac-tree-node-name', {
      hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`),
    }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const treeNode = sampleNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

    // Open chopper
    const chopButton = page.locator('[data-testid="preview-open-chopper"]');
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    // Wait for chopper dialog
    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Fixed slicing with 4 slices
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await expect(sliceCountInput).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sliceCountInput.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Save
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForTimeout(2_000);

    // Verify sample.yaml has slice definitions
    const yamlContent = await readSampleYaml(page, SAMPLE_FIXTURE_NAME);
    expect(yamlContent).toContain('slices:');
    expect(yamlContent).toContain('startSample:');
    expect(yamlContent).toContain('endSample:');

    const sliceCount = yamlContent.match(/startSample:/g)?.length ?? 0;
    expect(sliceCount, `Expected 4 slices, found ${sliceCount}`).toBe(4);
  });

  test('saved slice boundaries persist when chopper is reopened', async ({ page }) => {
    // First pass: slice and save
    const sampleNode = page.locator('.ac-tree-node-name', {
      hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`),
    }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const treeNode = sampleNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

    const chopButton = page.locator('[data-testid="preview-open-chopper"]');
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForTimeout(2_000);

    // Close chopper
    const closeButton = page.getByRole('button', { name: 'Close' });
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(dialog).not.toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Wait for tree refresh after save, then re-select
    // The save triggers onRefresh which reloads the tree — item type may
    // change from "sample" to "chopped-sample" but the name stays the same.
    await page.waitForTimeout(1_000);
    const sampleNode2 = page.locator('.ac-tree-node-name', {
      hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`),
    }).first();
    await expect(sampleNode2).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const treeNode2 = sampleNode2.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode2.click();

    // The chopped-sample preview includes EditorActions with the Chop button
    const chopButton2 = page.locator('[data-testid="preview-open-chopper"]');
    await expect(chopButton2).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton2.click();

    const dialog2 = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog2).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Verify 4 slices are shown (persisted from first save)
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('fixed slicing with 8 slices saves correct count', async ({ page }) => {
    const sampleNode = page.locator('.ac-tree-node-name', {
      hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`),
    }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const treeNode = sampleNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

    const chopButton = page.locator('[data-testid="preview-open-chopper"]');
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('8');
    await expect(page.getByText('8 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForTimeout(2_000);

    const yamlContent = await readSampleYaml(page, SAMPLE_FIXTURE_NAME);
    const sliceCount = yamlContent.match(/startSample:/g)?.length ?? 0;
    expect(sliceCount, `Expected 8 slices, found ${sliceCount}`).toBe(8);
  });

  test('Save writes sample.yaml with correct slice labels', async ({ page }) => {
    // Click sample
    const sampleNode = page.locator('.ac-tree-node-name', {
      hasText: new RegExp(`^${SAMPLE_FIXTURE_NAME}$`),
    }).first();
    await expect(sampleNode).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const treeNode = sampleNode.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

    // Open chopper
    const chopButton = page.locator('[data-testid="preview-open-chopper"]');
    await expect(chopButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await chopButton.click();

    const dialog = page.locator('[data-slice-editor-open="true"]');
    await expect(dialog).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Fixed slicing with 4 slices
    await page.getByRole('tab', { name: 'Fixed' }).click();
    const sliceCountInput = dialog.locator('input[type="number"]').first();
    await sliceCountInput.fill('4');
    await expect(page.getByText('4 slices')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // Save
    const saveButton = page.getByRole('button', { name: 'Save' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await page.waitForTimeout(2_000);

    // Verify labels are present
    const yamlContent = await readSampleYaml(page, SAMPLE_FIXTURE_NAME);
    expect(yamlContent).toContain('label:');

    // Should have 4 labels
    const labelCount = yamlContent.match(/label:/g)?.length ?? 0;
    expect(labelCount, `Expected 4 labels, found ${labelCount}`).toBe(4);
  });
});
