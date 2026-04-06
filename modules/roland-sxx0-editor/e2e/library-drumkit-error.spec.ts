/**
 * E2E tests for drum kit error handling when source WAV files are missing.
 *
 * Test case 12.6: Verifies the app handles missing WAV files gracefully
 * when a drum kit in the library references files that don't exist.
 *
 * These are library-only tests (no hardware required). They write
 * intentionally broken drum kit fixtures to OPFS and verify the app
 * displays an appropriate error or degraded state without crashing.
 *
 * Run via: make test-e2e-roland-library ARGS="--grep 'Drum Kit Error'"
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import {
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

/** V2 drum kit that references source.wav which we intentionally omit. */
const V2_KIT_YAML_MISSING_SOURCE = `format: drum-kit-bundle
version: 2
name: Broken Kit V2
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
`;

const V2_FIXTURE_NAME = 'e2e-broken-v2';

/** V1 drum kit with kit.yaml only — no individual WAV files. */
const V1_KIT_YAML_NO_WAVS = `format: drum-kit-bundle
version: 1
name: Broken Kit V1
sampleRate: 30000
baseNote: 36
`;

const V1_FIXTURE_NAME = 'e2e-broken-v1';

// ---------------------------------------------------------------------------
// OPFS Helpers
// ---------------------------------------------------------------------------

/** Write a drum kit fixture with kit.yaml only (no WAV files). */
async function writeDrumKitYamlOnlyToOPFS(
  page: Page,
  kitName: string,
  kitYaml: string,
  device: string,
): Promise<void> {
  await page.evaluate(
    async ({ kitName, kitYaml, device }: { kitName: string; kitYaml: string; device: string }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const deviceDir = await lib.getDirectoryHandle(device, { create: true });
      const drumKitsDir = await deviceDir.getDirectoryHandle('drum-kits', { create: true });
      const kitDir = await drumKitsDir.getDirectoryHandle(kitName, { create: true });

      const yamlHandle = await kitDir.getFileHandle('kit.yaml', { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(kitYaml);
      await yamlWriter.close();
    },
    { kitName, kitYaml, device },
  );
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Drum Kit Error Handling (12.6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roland/s330/editor/library?midi=mock');
    await page.waitForLoadState('networkidle');
    await initializeCleanOPFS(page, LIBRARY_DEVICE);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('v2 drum kit with missing source.wav does not crash the app', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await writeDrumKitYamlOnlyToOPFS(page, V2_FIXTURE_NAME, V2_KIT_YAML_MISSING_SOURCE, LIBRARY_DEVICE);
    await connectToOPFSBackend(page);

    // Find the broken kit in the tree and click it
    const kitNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${V2_FIXTURE_NAME}$`) }).first();
    await expect(kitNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const treeNode = kitNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
    await treeNode.click();

    // Wait for the preview panel to settle
    await page.waitForTimeout(2_000);

    // The app must not have crashed
    expect(pageErrors.length, `Page errors: ${pageErrors.join('; ')}`).toBe(0);

    // The library tree must still be functional
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('v1 drum kit with no WAV files does not crash the app', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await writeDrumKitYamlOnlyToOPFS(page, V1_FIXTURE_NAME, V1_KIT_YAML_NO_WAVS, LIBRARY_DEVICE);
    await connectToOPFSBackend(page);

    // V1 kit with no WAVs may or may not appear in the tree (parser might filter it).
    // Either way, the app must not crash.
    await page.waitForTimeout(2_000);

    expect(pageErrors.length, `Page errors: ${pageErrors.join('; ')}`).toBe(0);

    // The page must still be functional
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // If the kit appears, clicking it should not crash
    const kitNameSpan = page.locator('.ac-tree-node-name', { hasText: new RegExp(`^${V1_FIXTURE_NAME}$`) }).first();
    if (await kitNameSpan.isVisible()) {
      const treeNode = kitNameSpan.locator('xpath=ancestor::div[contains(@class, "ac-tree-node")]');
      await treeNode.click();
      await page.waitForTimeout(2_000);
      expect(pageErrors.length, `Page errors after click: ${pageErrors.join('; ')}`).toBe(0);
    }
  });
});
