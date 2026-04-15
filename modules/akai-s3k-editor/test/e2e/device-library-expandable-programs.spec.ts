/**
 * E2E test for expandable S3K programs in the library tree.
 *
 * After exporting a program from the device to the S3K library, the program
 * should appear as an expandable tree node showing its constituent samples
 * as children.
 *
 * Requires: Pi + S3000XL via SCSI bridge, at least one program loaded.
 * Run via: make test-e2e-s3k-device-library ARGS="--grep expandable"
 */

import { test, expect, type Page } from '@playwright/test';

import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
  navigateToLibrary,
  connectToOPFS,
} from '@audiocontrol/e2e-infra/helpers/connection-helper';

import {
  cleanupOPFS,
  initializeS3kOPFS,
} from '@audiocontrol/e2e-infra/helpers/library-ui-helpers';

import { createScsiMidiTransport } from '@audiocontrol/midi-core';
import { createS3000xlClient } from '@audiocontrol/sampler-devices/s3k';

// ---------------------------------------------------------------------------
// Environment guard
// ---------------------------------------------------------------------------

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
if (!BRIDGE_URL) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. Run via: make test-e2e-s3k-device-library',
  );
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const EDITOR_BASE_PATH = '/akai/s3000xl/editor';
const UI_TIMEOUT_MS = 10_000;
const TRANSFER_TIMEOUT_MS = 90_000;

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, '/scsi-bridge');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function attachConsoleDebugListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    console.log(`BROWSER [${msg.type()}]:`, msg.text());
  });
}

/** List program directories in OPFS S3K area. */
async function listS3kPrograms(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    try {
      const lib = await root.getDirectoryHandle('library');
      const s3k = await lib.getDirectoryHandle('s3k');
      const programs = await s3k.getDirectoryHandle('programs');
      const names: string[] = [];
      for await (const entry of (programs as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }).values()) {
        if (entry.kind === 'directory') names.push(entry.name);
      }
      return names;
    } catch {
      return [];
    }
  });
}

/**
 * Count WAV files in the samples/ subdirectory of a program in OPFS.
 * Returns the count, or 0 if the samples directory does not exist.
 */
async function countProgramSamplesInOPFS(
  page: Page,
  programDirName: string,
): Promise<number> {
  return page.evaluate(async (dirName: string) => {
    const root = await navigator.storage.getDirectory();
    const lib = await root.getDirectoryHandle('library');
    const s3k = await lib.getDirectoryHandle('s3k');
    const programs = await s3k.getDirectoryHandle('programs');
    const programDir = await programs.getDirectoryHandle(dirName);
    try {
      const samplesDir = await programDir.getDirectoryHandle('samples');
      let count = 0;
      for await (const entry of (samplesDir as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }).values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.wav')) count++;
      }
      return count;
    } catch {
      return 0;
    }
  }, programDirName);
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('S3K Library Expandable Programs', () => {
  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);

    // Navigate to editor with SCSI bridge params
    await page.goto(url(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);

    // Preflight: verify the Vite proxy can reach the SCSI bridge
    const proxyCheck = await page.evaluate(async () => {
      try {
        const res = await fetch('/scsi-bridge/status');
        const text = await res.text();
        return { ok: res.ok, status: res.status, body: text.substring(0, 200) };
      } catch (err) {
        return { ok: false, status: 0, body: String(err) };
      }
    });
    console.log('Vite proxy -> SCSI bridge preflight:', proxyCheck);
    if (!proxyCheck.ok) {
      throw new Error(
        `Vite proxy cannot reach SCSI bridge at /scsi-bridge/status. ` +
        `Status: ${proxyCheck.status}, Body: ${proxyCheck.body}`,
      );
    }

    // Connect to device via SCSI bridge
    await connectToDevice(page);

    // Navigate to library page
    await navigateToLibrary(page);

    // Clean OPFS and set up S3K directory structure
    await cleanupOPFS(page);
    await initializeS3kOPFS(page);

    // Connect to OPFS so the library page fully renders
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('exported program is expandable and shows samples', async ({ page }) => {
    // Step 1: Wait for device panel to show programs
    const devicePrograms = page.locator('[data-testid^="device-program-"]');
    await expect(devicePrograms.first()).toBeVisible({ timeout: 30_000 });

    const programCount = await devicePrograms.count();
    console.log(`Device has ${programCount} programs loaded`);
    expect(
      programCount,
      'Device must have at least one program loaded for this test. ' +
      'Load a program on the S3000XL before running.',
    ).toBeGreaterThan(0);

    // Step 2: Select the first program on the device
    const firstProgram = page.locator('[data-testid="device-program-0"]');
    await firstProgram.click();

    // Step 3: Click "Save to Library" for the program
    const saveProgramButton = page.locator(
      '[data-testid="preview-save-program-to-library"]',
    );
    await expect(saveProgramButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveProgramButton.click();

    // Step 4: SteppedProgressDrawer auto-starts -- wait for "Done" button
    console.log('Waiting for program export from device...');
    const doneButton = page.locator('[role="dialog"] button', { hasText: 'Done' });
    const deadline = Date.now() + TRANSFER_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await doneButton.isVisible()) break;
      // Feed the watchdog with a heartbeat assertion
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 3_000 });
      await page.waitForTimeout(500);
    }
    await expect(doneButton).toBeVisible({ timeout: 3_000 });
    await doneButton.click();

    // Step 5: Wait for library tree to refresh after export
    await page.waitForTimeout(2_000);

    // Step 6: Verify program appeared in OPFS
    const programs = await listS3kPrograms(page);
    console.log('Programs in S3K library after export:', programs);
    expect(
      programs.length,
      'Expected at least one program in S3K library after export',
    ).toBeGreaterThanOrEqual(1);

    const exportedDirName = programs[0];

    // Step 7: Find the exported program in the library tree
    // The tree shows the name from the YAML, which may differ from the dir name.
    const candidates = [exportedDirName, exportedDirName.replace(/_/g, ' ').trim()];
    let programTreeNode: ReturnType<Page['locator']> | null = null;
    for (const name of candidates) {
      const node = page.locator('.ac-tree-node-name', { hasText: name }).first();
      if (await node.isVisible({ timeout: 5_000 }).catch(() => false)) {
        programTreeNode = node;
        console.log(`Found exported program in tree as "${name}"`);
        break;
      }
    }
    if (!programTreeNode) {
      const treeNames = await page.locator('.ac-tree-node-name').allTextContents();
      console.log('Tree node names:', treeNames);
      throw new Error(
        `Exported program not found in tree. Dir: "${exportedDirName}", ` +
        `tried: [${candidates.join(', ')}]. Tree nodes: [${treeNames.join(', ')}]`,
      );
    }

    // Step 8: Verify expandability -- the program's tree row should have a chevron
    // Navigate up from the name to the row element to find the chevron button
    const programRow = programTreeNode.locator('..').locator('..');
    const chevron = programRow.locator('.ac-tree-chevron-btn').first();

    // The chevron may also be a sibling of the tree node name container
    const altChevron = page.locator('.ac-tree-node', { has: programTreeNode })
      .first()
      .locator('.ac-tree-chevron-btn');

    const chevronLocator = chevron.or(altChevron).first();
    await expect(chevronLocator).toBeVisible({ timeout: UI_TIMEOUT_MS });
    console.log('Chevron/expand button found -- program is expandable');

    // Step 9: Click the chevron to expand the program
    await chevronLocator.click();
    await page.waitForTimeout(1_000);

    // Step 10: Verify children appear after expanding
    // Child nodes should be nested under the expanded program node
    const expandedProgram = page.locator('.ac-tree-node', { has: programTreeNode }).first();
    const childNodes = expandedProgram.locator('.ac-tree-node');
    const childCount = await childNodes.count();
    console.log(`Expanded program shows ${childCount} child nodes`);

    expect(
      childCount,
      'Expected at least one child node (sample) after expanding program',
    ).toBeGreaterThan(0);

    // Step 11: Verify via OPFS that samples/ directory exists with WAV files
    const sampleCount = await countProgramSamplesInOPFS(page, exportedDirName);
    console.log(`OPFS verification: ${sampleCount} WAV file(s) in samples/ directory`);

    expect(
      sampleCount,
      `Expected at least one WAV file in library/s3k/programs/${exportedDirName}/samples/`,
    ).toBeGreaterThan(0);
  });
});
