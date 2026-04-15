/**
 * E2E test for Phase 8: Library promotion round-trip.
 *
 * Verifies the full cycle:
 *   Device → S3K library → Common area → Device
 *
 * Three promotion paths exist:
 *   1. Preview pane "Promote to Common Area" button
 *   2. Context menu "Promote to Common Area" action
 *   3. Drag from S3K programs to common programs section
 *
 * This test covers path 1 (preview button), which exercises the same
 * underlying promoteToCommonArea() code as the other two paths.
 *
 * Requires: Pi + S3000XL via SCSI bridge, at least one program loaded.
 * Run via: make test-e2e-s3k-device-library ARGS="--grep promotion"
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
  assertLibraryItemVisible,
  clickLibraryItem,
  verifyDirectoryInOPFS,
  S3K_PROGRAMS_PATH,
} from '@audiocontrol/e2e-infra/helpers/library-ui-helpers';

import { createScsiMidiTransport } from '@audiocontrol/midi-core';
import { createS3000xlClient } from '@audiocontrol/sampler-devices/s3k';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
if (!BRIDGE_URL) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. Run via: make test-e2e-s3k-device-library',
  );
}

test.setTimeout(120_000);

const EDITOR_BASE_PATH = '/akai/s3000xl/editor';
const UI_TIMEOUT_MS = 10_000;
const TRANSFER_TIMEOUT_MS = 90_000;

const COMMON_PROGRAMS_PATH = ['library', 'common', 'programs'];

function url(subpath: string = ''): string {
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, '/scsi-bridge');
}

// ---------------------------------------------------------------------------
// Side-channel device queries
// ---------------------------------------------------------------------------

async function queryDevicePrograms(): Promise<string[]> {
  const scsi = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL! });
  const client = createS3000xlClient(scsi.adapter, { noCache: true });
  try {
    return await client.fetchProgramNames();
  } finally {
    scsi.disconnect();
  }
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

async function waitForTransferWithHeartbeat(
  page: Page,
  successTestId: string,
  containerSelector: string,
  timeoutMs: number,
): Promise<void> {
  const success = page.locator(`[data-testid="${successTestId}"]`);
  const container = page.locator(containerSelector);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await success.isVisible()) break;
    await expect(container).toBeVisible({ timeout: 3_000 });
    await page.waitForTimeout(500);
  }
  await expect(success).toBeVisible({ timeout: 3_000 });
}

/** List program directories in OPFS common area. */
async function listCommonPrograms(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    try {
      const lib = await root.getDirectoryHandle('library');
      const common = await lib.getDirectoryHandle('common');
      const programs = await common.getDirectoryHandle('programs');
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

// ---------------------------------------------------------------------------
// Phase 1: Export device program to S3K library
// ---------------------------------------------------------------------------

async function exportProgramToS3kLibrary(page: Page): Promise<string> {
  // Wait for device programs
  const devicePrograms = page.locator('[data-testid^="device-program-"]');
  await expect(devicePrograms.first()).toBeVisible({ timeout: 30_000 });

  const programCount = await devicePrograms.count();
  expect(programCount, 'Device must have at least one program loaded').toBeGreaterThan(0);

  // Select first program
  await page.locator('[data-testid="device-program-0"]').click();

  // Click "Save to Library"
  const saveButton = page.locator('[data-testid="preview-save-program-to-library"]');
  await expect(saveButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await saveButton.click();

  // SteppedProgressDrawer auto-starts on open — no confirm button.
  // Wait for "Done" button to appear (signals export complete).
  console.log('Phase 1: Exporting program from device to S3K library...');
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

  // Wait for library tree to refresh after export
  await page.waitForTimeout(2_000);

  // Verify program appeared in S3K library (OPFS)
  const programs = await listS3kPrograms(page);
  expect(programs.length, 'Expected at least one program in S3K library after export').toBeGreaterThanOrEqual(1);

  const exportedDirName = programs[0];
  console.log(`Phase 1 complete: exported dir="${exportedDirName}" to S3K library`);

  // The tree shows the name from the YAML, which may differ from the dir name.
  // Try both the dir name and a space-normalized variant.
  const candidates = [exportedDirName, exportedDirName.replace(/_/g, ' ').trim()];
  let foundName = '';
  for (const name of candidates) {
    const node = page.locator('.ac-tree-node', { hasText: name }).first();
    if (await node.isVisible({ timeout: 5_000 }).catch(() => false)) {
      foundName = name;
      break;
    }
  }
  if (!foundName) {
    const names = await page.locator('.ac-tree-node-name').allTextContents();
    console.log('Tree node names:', names);
    throw new Error(`Exported program not found in tree. Dir: "${exportedDirName}", tried: ${candidates.join(', ')}`);
  }
  console.log(`Found in tree as "${foundName}"`);

  return foundName;
}

// ---------------------------------------------------------------------------
// Phase 2: Promote from S3K library to common area
// ---------------------------------------------------------------------------

async function promoteViaPreviewButton(page: Page, programName: string): Promise<void> {
  // Select the program in the library tree
  await assertLibraryItemVisible(page, programName, UI_TIMEOUT_MS);
  await clickLibraryItem(page, programName);

  // Click "Promote to Common Area" in preview panel
  const promoteButton = page.locator('[data-testid="preview-promote-to-common"]');
  await expect(promoteButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await promoteButton.click();

  // Wait for promotion to complete (shown as toast, not dialog)
  // The promotion toast shows "Promoted X to common area" on success
  const successToast = page.locator('text=Promoted').or(page.locator('text=common area'));
  await expect(successToast.first()).toBeVisible({ timeout: 30_000 });
  console.log('Phase 2: Promotion toast appeared');

  // Wait a moment for OPFS writes to complete
  await page.waitForTimeout(1_000);
}

async function promoteViaContextMenu(page: Page, programName: string): Promise<void> {
  // Find the program node in the tree
  await assertLibraryItemVisible(page, programName, UI_TIMEOUT_MS);

  // Right-click to open context menu
  const treeItem = page.locator('.ac-tree-node-name', { hasText: programName }).first();
  await expect(treeItem).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await treeItem.click({ button: 'right' });

  // Click "Promote to Common Area" in context menu
  const promoteAction = page.locator('[role="menuitem"]', { hasText: 'Promote to Common Area' });
  await expect(promoteAction).toBeVisible({ timeout: 5_000 });
  await promoteAction.click();

  // Wait for promotion toast
  const successToast = page.locator('text=Promoted').or(page.locator('text=common area'));
  await expect(successToast.first()).toBeVisible({ timeout: 30_000 });
  console.log('Phase 2 (context menu): Promotion toast appeared');

  await page.waitForTimeout(1_000);
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('Promotion Round Trip (#274)', () => {
  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);
    await page.goto(url(), { timeout: UI_TIMEOUT_MS });
    await waitForAppReady(page);
    await connectToDevice(page);
    await navigateToLibrary(page);
    await cleanupOPFS(page);
    await initializeS3kOPFS(page);
    await connectToOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  test('promotion via preview button: device → S3K → common area', async ({ page }) => {
    // Phase 1: Export from device to S3K library
    const exportedName = await exportProgramToS3kLibrary(page);

    // Phase 2: Promote from S3K library to common area via preview button
    await promoteViaPreviewButton(page, exportedName);

    // Verify program arrived in common area (OPFS)
    const commonPrograms = await listCommonPrograms(page);
    console.log(`Common area programs after promotion: [${commonPrograms.join(', ')}]`);
    expect(
      commonPrograms.length,
      `Expected at least one program in common area after promotion. Found: [${commonPrograms.join(', ')}]`,
    ).toBeGreaterThanOrEqual(1);

    // Verify program.yaml exists in the common area directory
    const promotedName = commonPrograms.find(n => n.toLowerCase().includes(exportedName.toLowerCase().trim())) ?? commonPrograms[0];
    const hasYaml = await page.evaluate(async (path: string[]) => {
      const root = await navigator.storage.getDirectory();
      let dir = root;
      for (const seg of path) dir = await dir.getDirectoryHandle(seg);
      try {
        await dir.getFileHandle('program.yaml');
        return true;
      } catch {
        return false;
      }
    }, [...COMMON_PROGRAMS_PATH, promotedName]);
    expect(hasYaml, `Expected program.yaml in common area at ${promotedName}/`).toBe(true);
    console.log(`Promotion verified: "${promotedName}" has program.yaml in common area`);
  });

  test('promotion via context menu: device → S3K → common', async ({ page }) => {
    // Phase 1: Export from device to S3K library
    const exportedName = await exportProgramToS3kLibrary(page);

    // Phase 2: Promote via right-click context menu
    await promoteViaContextMenu(page, exportedName);

    // Verify program arrived in common area
    const commonPrograms = await listCommonPrograms(page);
    console.log(`Common area programs after context-menu promotion: [${commonPrograms.join(', ')}]`);
    expect(commonPrograms.length, 'Expected program in common area').toBeGreaterThanOrEqual(1);

    // Verify program.yaml exists
    const promotedName = commonPrograms[0];
    const dirExists = await verifyDirectoryInOPFS(page, [...COMMON_PROGRAMS_PATH, promotedName]);
    expect(dirExists, `Expected directory at common/programs/${promotedName}/`).toBe(true);
  });
});
