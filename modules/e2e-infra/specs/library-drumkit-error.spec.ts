/**
 * Drum kit error handling e2e tests.
 *
 * Parameterized via environment variables:
 *   E2E_LIBRARY_URL — full URL to the editor's library page
 *   E2E_BASE_URL    — any page URL that has OPFS access
 *   E2E_EDITOR_NAME — display name for test descriptions
 *   E2E_OPFS_INIT   — "roland" or "s3k" (default)
 *
 * Tests that the app handles missing WAV files gracefully when a drum kit
 * in the library references files that do not exist.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Deviation: relative import because e2e-infra/specs/ is outside src/
import {
  initializeS3kOPFS,
  initializeRolandOPFS,
  cleanupOPFS,
  connectToOPFS,
} from '../helpers/library-ui-helpers';

const LIBRARY_URL = process.env.E2E_LIBRARY_URL;
const BASE_URL = process.env.E2E_BASE_URL;
const EDITOR_NAME = process.env.E2E_EDITOR_NAME ?? 'Unknown';
const OPFS_INIT = process.env.E2E_OPFS_INIT ?? 's3k';

if (!LIBRARY_URL || !BASE_URL) {
  throw new Error('E2E_LIBRARY_URL and E2E_BASE_URL must be set');
}

const initializeOPFS = OPFS_INIT === 'roland' ? initializeRolandOPFS : initializeS3kOPFS;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UI_TIMEOUT_MS = 5_000;

const V2_FIXTURE_NAME = 'e2e-broken-v2';
const V1_FIXTURE_NAME = 'e2e-broken-v1';

/** V2 drum kit that references source.wav which we intentionally omit. */
const V2_KIT_YAML_MISSING_SOURCE = `format: sample
version: 1
name: "Broken Kit V2"
file: sample.wav
sampleRate: 30000
drumKit:
  baseNote: 36
slices:
  - label: "Kick"
    startSample: 0
    endSample: 15000
  - label: "Snare"
    startSample: 15000
    endSample: 30000
`;

/** V1 drum kit — sample.yaml only, no WAV file at all. */
const V1_KIT_YAML_NO_WAVS = `format: sample
version: 1
name: "Broken Kit V1"
file: sample.wav
sampleRate: 30000
drumKit:
  baseNote: 36
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a drum kit fixture with sample.yaml only (no WAV file). */
async function writeDrumKitYamlOnlyToOPFS(
  page: Page,
  kitName: string,
  kitYaml: string,
): Promise<void> {
  await page.evaluate(
    async ({
      kitName,
      kitYaml,
    }: {
      kitName: string;
      kitYaml: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      let dir = root;
      for (const segment of ['library', 'common', 'samples']) {
        dir = await dir.getDirectoryHandle(segment, { create: true });
      }
      const kitDir = await dir.getDirectoryHandle(kitName, { create: true });

      const yamlHandle = await kitDir.getFileHandle('sample.yaml', {
        create: true,
      });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(kitYaml);
      await yamlWriter.close();
    },
    { kitName, kitYaml },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe(`Drum Kit Error Handling — ${EDITOR_NAME} (12.6)`, () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`${LIBRARY_URL}?midi=mock`);
    await page.waitForLoadState('networkidle');
    await initializeOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('v2 drum kit with missing source.wav does not crash the app', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await writeDrumKitYamlOnlyToOPFS(
      page,
      V2_FIXTURE_NAME,
      V2_KIT_YAML_MISSING_SOURCE,
    );
    await connectToOPFS(page);

    // Find the broken kit in the tree and click it
    const kitNameSpan = page
      .locator('.ac-tree-node-name', {
        hasText: new RegExp(`^${V2_FIXTURE_NAME}$`),
      })
      .first();
    await expect(kitNameSpan).toBeVisible({ timeout: UI_TIMEOUT_MS });
    const treeNode = kitNameSpan.locator(
      'xpath=ancestor::div[contains(@class, "ac-tree-node")]',
    );
    await treeNode.click();

    // Wait for the preview panel to settle
    await page.waitForTimeout(2_000);

    // The app must not have crashed
    expect(
      pageErrors.length,
      `Page errors: ${pageErrors.join('; ')}`,
    ).toBe(0);

    // The library tree must still be functional
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('v1 drum kit with no WAV files does not crash the app', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await writeDrumKitYamlOnlyToOPFS(
      page,
      V1_FIXTURE_NAME,
      V1_KIT_YAML_NO_WAVS,
    );
    await connectToOPFS(page);

    // V1 kit with no WAVs may or may not appear in the tree (parser might filter it).
    // Either way, the app must not crash.
    await page.waitForTimeout(2_000);

    expect(
      pageErrors.length,
      `Page errors: ${pageErrors.join('; ')}`,
    ).toBe(0);

    // The page must still be functional
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: UI_TIMEOUT_MS });

    // If the kit appears, clicking it should not crash
    const kitNameSpan = page
      .locator('.ac-tree-node-name', {
        hasText: new RegExp(`^${V1_FIXTURE_NAME}$`),
      })
      .first();
    if (await kitNameSpan.isVisible()) {
      const treeNode = kitNameSpan.locator(
        'xpath=ancestor::div[contains(@class, "ac-tree-node")]',
      );
      await treeNode.click();
      await page.waitForTimeout(2_000);
      expect(
        pageErrors.length,
        `Page errors after click: ${pageErrors.join('; ')}`,
      ).toBe(0);
    }
  });
});
