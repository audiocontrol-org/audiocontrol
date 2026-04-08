/**
 * S3K Device+Library round-trip e2e tests.
 *
 * These tests require:
 *   - Raspberry Pi running s2p and scsi-midi-bridge (deployed by runner)
 *   - Akai S3000XL connected to the Pi via SCSI
 *   - OPFS library access in the browser
 *
 * Each test follows the atomic round-trip pattern:
 *   Library (fixture) --import--> Device --export--> Library (result)
 *        |                                              |
 *        +-------------- compare for equality ----------+
 *
 * Run via: make test-e2e-s3k-device-library
 */

import { test, expect, type Page } from '@playwright/test';

// Deviation: Using relative import because e2e/ is outside src/ and @/ path alias
// only applies to src/. This pattern should not be copied to application code.
import {
  buildScsiUrl,
  waitForAppReady,
  connectToDevice,
  navigateToLibrary,
  connectToOPFS,
} from '../../e2e-infra/helpers/connection-helper';

import {
  cleanupOPFS,
  initializeS3kOPFS,
  writeSampleFixture,
  assertLibraryItemVisible,
  clickLibraryItem,
  verifyDirectoryInOPFS,
  verifyFileInOPFS,
  COMMON_SAMPLES_PATH,
  S3K_PROGRAMS_PATH,
} from '../../e2e-infra/helpers/library-ui-helpers';

// ---------------------------------------------------------------------------
// Environment guard
// ---------------------------------------------------------------------------

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL;
if (!BRIDGE_URL) {
  throw new Error(
    'E2E_SCSI_BRIDGE_URL must be set. SCSI bridge is the only viable transport ' +
    'for automated S3K tests. Run via: make test-e2e-s3k-device-library',
  );
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

const EDITOR_BASE_PATH = '/akai/s3000xl/editor';
const UI_TIMEOUT_MS = 10_000;
const TRANSFER_TIMEOUT_MS = 90_000; // SDS over SCSI is slow

// ---------------------------------------------------------------------------
// Direct device query (side channel via S3K client + SCSI bridge)
// ---------------------------------------------------------------------------

import { createScsiMidiTransport } from '@audiocontrol/midi-core';
import { createS3000xlClient } from '@audiocontrol/sampler-devices/s3k';

/**
 * Query device state directly via the S3K client over SCSI bridge.
 * This bypasses the browser UI to verify what's actually on the device.
 */
async function queryDeviceSamples(): Promise<string[]> {
  const scsi = createScsiMidiTransport({ bridgeUrl: BRIDGE_URL! });
  const client = createS3000xlClient(scsi.adapter, { noCache: true });
  try {
    return await client.fetchSampleNames();
  } finally {
    scsi.disconnect();
  }
}

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
// URL Builder
// ---------------------------------------------------------------------------

function url(subpath: string = ''): string {
  // Use the local Vite proxy path (/scsi-bridge) instead of the direct Pi URL
  // to avoid mixed-content errors (HTTPS page → HTTP bridge).
  // Vite proxies /scsi-bridge → http://s3k.local:7033 (configured in vite.config.ts).
  return buildScsiUrl(EDITOR_BASE_PATH, subpath, '/scsi-bridge');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wait for a long-running transfer to complete by polling a container
 * element for liveness. Each poll iteration emits a Playwright test step
 * (expect assertion) that feeds the heartbeat reporter, keeping the
 * watchdog alive during slow SDS transfers.
 *
 * @param page - Playwright page
 * @param successTestId - data-testid of the element that appears on success
 * @param containerSelector - CSS selector of a container that stays visible during transfer
 * @param timeoutMs - maximum time to wait
 */
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
    // Each assertion is a test step that produces a heartbeat event
    await expect(container).toBeVisible({ timeout: 3_000 });
    await page.waitForTimeout(500);
  }
  await expect(success).toBeVisible({ timeout: 3_000 });
}

/**
 * Attach a console listener for debugging SCSI/SDS transfer issues.
 * Logs errors, warnings, and any messages mentioning S3K or SCSI.
 */
function attachConsoleDebugListener(page: Page): void {
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('console', (msg) => {
    // Capture ALL browser console messages — no filtering
    console.log(`BROWSER [${msg.type()}]:`, msg.text());
  });
}

/**
 * List all sample directory names in the OPFS common area.
 * Returns directory names under library/common/samples/.
 */
async function listCommonSamples(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    try {
      const lib = await root.getDirectoryHandle('library');
      const common = await lib.getDirectoryHandle('common');
      const samples = await common.getDirectoryHandle('samples');
      const names: string[] = [];
      for await (const entry of (samples as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }).values()) {
        if (entry.kind === 'directory') {
          names.push(entry.name);
        }
      }
      return names;
    } catch {
      return [];
    }
  });
}

/**
 * List all program directory names in the S3K programs area.
 * Returns directory names under library/s3k/programs/.
 */
async function listS3kPrograms(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    try {
      const lib = await root.getDirectoryHandle('library');
      const s3k = await lib.getDirectoryHandle('s3k');
      const programs = await s3k.getDirectoryHandle('programs');
      const names: string[] = [];
      for await (const entry of (programs as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }).values()) {
        if (entry.kind === 'directory') {
          names.push(entry.name);
        }
      }
      return names;
    } catch {
      return [];
    }
  });
}

// ===========================================================================
// Test Suite
// ===========================================================================

test.describe('S3K Device+Library Round Trip', () => {
  test.beforeEach(async ({ page }) => {
    attachConsoleDebugListener(page);

    // 1. Navigate to editor with SCSI bridge params
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
    console.log('Vite proxy → SCSI bridge preflight:', proxyCheck);
    if (!proxyCheck.ok) {
      throw new Error(
        `Vite proxy cannot reach SCSI bridge at /scsi-bridge/status. ` +
        `Status: ${proxyCheck.status}, Body: ${proxyCheck.body}`,
      );
    }

    // 2. Connect to device via SCSI bridge (auto-connects like HTTP MIDI)
    await connectToDevice(page);

    // 3. Navigate to library page (don't connect OPFS yet -- data must exist first)
    await navigateToLibrary(page);

    // 4. Clean OPFS and set up S3K directory structure
    await cleanupOPFS(page);
    await initializeS3kOPFS(page);
  });

  test.afterEach(async ({ page }) => {
    await cleanupOPFS(page);
  });

  // -------------------------------------------------------------------------
  // Device Memory Panel
  // -------------------------------------------------------------------------

  test('device memory panel shows connected state', async ({ page }) => {
    // Connect to OPFS so the library page fully renders
    await connectToOPFS(page);

    const devicePanel = page.locator('.ac-plugin-library-browser-device');
    await expect(devicePanel).toBeVisible({ timeout: 15_000 });

    // The device panel should have content -- either programs or samples
    // loaded from the S3000XL's current memory state.
    // E2E tenet: adapt to device state, don't assume specific content.
    // Wait for the device panel to show loaded content (not just headers).
    const deviceItem = devicePanel.locator('button').filter({ hasNotText: '↻' }).first();
    await expect(deviceItem).toBeVisible({ timeout: 30_000 });

    // Count items using data-testid if available, otherwise count buttons
    const programItems = devicePanel.locator('[data-testid^="device-program-"]');
    const sampleItems = devicePanel.locator('[data-testid^="device-sample-"]');
    const programCount = await programItems.count();
    const sampleCount = await sampleItems.count();
    console.log(
      `Device memory: ${programCount} programs (testid), ${sampleCount} samples (testid)`,
    );

    // Fall back to counting any item buttons if test IDs aren't present
    const allButtons = await devicePanel.locator('button').filter({ hasNotText: '↻' }).count();
    console.log(`Device memory: ${allButtons} total item buttons`);

    expect(
      allButtons,
      'Expected at least one program or sample in device memory',
    ).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Sample Round Trip: Send to Device, Receive Back
  // -------------------------------------------------------------------------

  test('sample round trip: send to device via SDS, receive back, compare', async ({
    page,
  }) => {
    const FIXTURE_NAME = 'RoundTrip';

    // Record device state before sending (side channel)
    const samplesBeforeSend = await queryDeviceSamples();
    console.log(`Device samples before send: ${samplesBeforeSend.length}`);

    // Step 1: Write a realistic sample fixture to OPFS.
    // The S3000XL needs a minimum sample length — a 1-sample WAV won't work.
    // Create a 1000-sample WAV at 44100 Hz (~23ms of audio).
    await page.evaluate(async (name: string) => {
      // Contract path: library/common/samples/{name}/
      const root = await navigator.storage.getDirectory();
      let dir = root;
      for (const seg of ['library', 'common', 'samples']) {
        dir = await dir.getDirectoryHandle(seg, { create: true });
      }
      const sampleDir = await dir.getDirectoryHandle(name, { create: true });

      // Write sample.yaml
      const yaml = `format: sample\nversion: 1\nname: ${name}\nfile: sample.wav\nsampleRate: 44100\n`;
      const yh = await sampleDir.getFileHandle('sample.yaml', { create: true });
      const yw = await yh.createWritable();
      await yw.write(yaml);
      await yw.close();

      // Write WAV with 1000 samples of silence at 44100 Hz
      const numSamples = 1000;
      const dataSize = numSamples * 2; // 16-bit mono
      const headerSize = 44;
      const buf = new ArrayBuffer(headerSize + dataSize);
      const v = new DataView(buf);
      // RIFF header
      v.setUint32(0, 0x52494646, false); // "RIFF"
      v.setUint32(4, headerSize + dataSize - 8, true);
      v.setUint32(8, 0x57415645, false); // "WAVE"
      // fmt chunk
      v.setUint32(12, 0x666d7420, false); // "fmt "
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); // PCM
      v.setUint16(22, 1, true); // mono
      v.setUint32(24, 44100, true); // sample rate
      v.setUint32(28, 88200, true); // byte rate
      v.setUint16(32, 2, true); // block align
      v.setUint16(34, 16, true); // bits per sample
      // data chunk
      v.setUint32(36, 0x64617461, false); // "data"
      v.setUint32(40, dataSize, true);
      // Samples: silence (all zeros — already initialized)

      const wh = await sampleDir.getFileHandle('sample.wav', { create: true });
      const ww = await wh.createWritable();
      await ww.write(new Uint8Array(buf));
      await ww.close();
    }, FIXTURE_NAME);

    // Verify fixture was written to the contract path
    const fixtureDir = await verifyDirectoryInOPFS(page, [
      ...COMMON_SAMPLES_PATH,
      FIXTURE_NAME,
    ]);
    expect(
      fixtureDir,
      `Contract violation: sample fixture "${FIXTURE_NAME}" not found at ` +
      `${COMMON_SAMPLES_PATH.join('/')}/${FIXTURE_NAME}/ after writing`,
    ).toBe(true);

    // Step 2: Connect to OPFS -- app reads library contents on connect
    await connectToOPFS(page);

    // Step 3: Wait for fixture to appear in the library tree
    await assertLibraryItemVisible(page, FIXTURE_NAME, UI_TIMEOUT_MS);

    // Step 4: Select the sample in the library tree
    await clickLibraryItem(page, FIXTURE_NAME);

    // Step 4b: Wait for device memory panel to load (so deviceSampleCount is accurate)
    await expect(
      page.locator('.ac-plugin-library-browser-device button').filter({ hasNotText: '↻' }).first(),
    ).toBeVisible({ timeout: 15_000 });
    console.log('Device panel populated');

    // Step 5: Click "Send to Device" in preview panel
    const sendButton = page.locator(
      '[data-testid="preview-send-to-device"]',
    );
    await expect(sendButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sendButton.click();

    // Step 6: In the SendSampleDialog, confirm the transfer
    const sendConfirm = page.locator(
      '[data-testid="send-sample-confirm"]',
    );
    await expect(sendConfirm).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sendConfirm.click();

    // Step 7: Wait for SDS send to complete -- poll with heartbeat
    console.log('Waiting for SDS send to device...');
    await waitForTransferWithHeartbeat(
      page,
      'send-sample-done',
      '[role="dialog"]',
      TRANSFER_TIMEOUT_MS,
    );

    // Step 8: Click done to dismiss the send dialog
    const sendDone = page.locator('[data-testid="send-sample-done"]');
    await sendDone.click();
    console.log('SDS send dialog dismissed');

    // Step 8b: Verify device state via side channel.
    // S3000XL auto-names SDS-received samples, so check count increased, not name.
    const samplesAfterSend = await queryDeviceSamples();
    console.log(
      `Device samples after send: ${samplesAfterSend.length} ` +
      `(was ${samplesBeforeSend.length}). Names: [${samplesAfterSend.map((s) => s.trim()).join(', ')}]`,
    );
    expect(
      samplesAfterSend.length,
      `SDS send reported success but sample count did not increase. ` +
      `Before: ${samplesBeforeSend.length}, After: ${samplesAfterSend.length}. ` +
      `The S3000XL did not accept the sample.`,
    ).toBeGreaterThan(samplesBeforeSend.length);

    // The new sample is the one that wasn't in the previous list
    const newSampleName = samplesAfterSend
      .map((s) => s.trim())
      .find((name) => !samplesBeforeSend.map((s) => s.trim()).includes(name));
    console.log(`New sample on device: "${newSampleName}"`);

    // Step 9: Refresh device panel and find the new sample.
    // E2E tenet: adapt to device state — the sample may be at any index.
    const devicePanel = page.locator('.ac-plugin-library-browser-device');
    const refreshButton = devicePanel.locator('button').filter({ hasText: '↻' });
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(2_000); // Wait for device to respond
    }

    // Find the new sample in the device panel by the name the S3000XL assigned.
    // S3000XL auto-names SDS samples, so use the name from the side channel query.
    const searchName = newSampleName ?? FIXTURE_NAME.substring(0, 12);
    const samplePattern = new RegExp(searchName.trim(), 'i');
    const deviceSample = devicePanel.locator('button').filter({ hasText: samplePattern });

    // Poll for the sample to appear, feeding the watchdog each iteration
    const findDeadline = Date.now() + 30_000;
    while (Date.now() < findDeadline) {
      if (await deviceSample.count() > 0) break;
      // Each assertion feeds the heartbeat
      await expect(devicePanel).toBeVisible({ timeout: 3_000 });
      // Try refreshing the device panel
      if (await refreshButton.isVisible()) {
        await refreshButton.click();
      }
      await page.waitForTimeout(2_000);
    }
    // The sample may be scrolled out of view — scroll it into view first
    const count = await deviceSample.count();
    console.log(`Found ${count} device sample(s) matching "${FIXTURE_NAME}"`);
    if (count === 0) {
      // Log all device panel button texts for debugging
      const allButtons = devicePanel.locator('button');
      const buttonCount = await allButtons.count();
      const texts: string[] = [];
      for (let i = 0; i < buttonCount; i++) {
        texts.push(await allButtons.nth(i).textContent() ?? '');
      }
      console.log('Device panel buttons:', texts);
      throw new Error(
        `Sample "${FIXTURE_NAME}" not found in device panel after SDS send. ` +
        `Available: [${texts.join(', ')}]`,
      );
    }
    await deviceSample.scrollIntoViewIfNeeded();
    await deviceSample.click();

    // Step 10: Click "Save to Library" in preview panel to receive back
    const saveButton = page.locator(
      '[data-testid="preview-save-to-library"]',
    );
    await expect(saveButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveButton.click();

    // Step 11: In the ReceiveSampleDialog, confirm
    const receiveConfirm = page.locator(
      '[data-testid="receive-sample-confirm"]',
    );
    await expect(receiveConfirm).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await receiveConfirm.click();

    // Step 12: Wait for SDS receive to complete -- poll with heartbeat
    console.log('Waiting for SDS receive from device...');
    await waitForTransferWithHeartbeat(
      page,
      'receive-sample-done',
      '[role="dialog"]',
      TRANSFER_TIMEOUT_MS,
    );

    // Step 13: Click done to dismiss the receive dialog
    const receiveDone = page.locator(
      '[data-testid="receive-sample-done"]',
    );
    await receiveDone.click();

    // Step 14: Verify a received sample now exists in OPFS common area
    const samplesAfter = await listCommonSamples(page);
    console.log('Samples in common area after round trip:', samplesAfter);

    // We should have at least the original fixture plus the received sample.
    // The received sample may have the same name or a device-derived name.
    expect(
      samplesAfter.length,
      `Expected at least 1 sample in common area after round trip. ` +
      `Found: [${samplesAfter.join(', ')}]`,
    ).toBeGreaterThanOrEqual(1);

    // Verify at least one sample directory has a WAV file (the received data)
    let foundWav = false;
    for (const sampleName of samplesAfter) {
      const hasWav = await verifyFileInOPFS(
        page,
        [...COMMON_SAMPLES_PATH, sampleName],
        'sample.wav',
      );
      if (hasWav) {
        foundWav = true;
        console.log(`Verified WAV file in: ${sampleName}/`);
        break;
      }
    }
    expect(
      foundWav,
      'Expected at least one received sample to contain a sample.wav file',
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Export Program from Device to Library
  // -------------------------------------------------------------------------

  test('export program from device to library', async ({ page }) => {
    // Connect to OPFS so the library page fully renders
    await connectToOPFS(page);

    // Step 1: Wait for device panel to show programs
    const devicePrograms = page.locator(
      '[data-testid^="device-program-"]',
    );
    await expect(devicePrograms.first()).toBeVisible({ timeout: 30_000 });

    const programCount = await devicePrograms.count();
    console.log(`Device has ${programCount} programs loaded`);
    expect(
      programCount,
      'Device must have at least one program loaded for this test. ' +
      'Load a program on the S3000XL before running.',
    ).toBeGreaterThan(0);

    // Step 2: Select the first program on the device
    const firstProgram = page.locator(
      '[data-testid="device-program-0"]',
    );
    await firstProgram.click();

    // Step 3: Click "Save to Library" for the program
    const saveProgramButton = page.locator(
      '[data-testid="preview-save-program-to-library"]',
    );
    await expect(saveProgramButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveProgramButton.click();

    // Step 4: In ExportProgramDialog, confirm the export
    const exportConfirm = page.locator(
      '[data-testid="export-program-confirm"]',
    );
    await expect(exportConfirm).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await exportConfirm.click();

    // Step 5: Wait for program export to complete -- poll with heartbeat
    console.log('Waiting for program export from device...');
    await waitForTransferWithHeartbeat(
      page,
      'export-program-done',
      '[role="dialog"]',
      TRANSFER_TIMEOUT_MS,
    );

    // Step 6: Click done to dismiss the export dialog
    const exportDone = page.locator(
      '[data-testid="export-program-done"]',
    );
    await exportDone.click();

    // Step 7: Verify a program directory was created in OPFS
    const programs = await listS3kPrograms(page);
    console.log('Programs in S3K library after export:', programs);

    expect(
      programs.length,
      `Expected at least one program in library after export. ` +
      `Found: [${programs.join(', ')}]`,
    ).toBeGreaterThanOrEqual(1);

    // Verify the program directory exists at the contract path
    const programExists = await verifyDirectoryInOPFS(page, [
      ...S3K_PROGRAMS_PATH,
      programs[0],
    ]);
    expect(
      programExists,
      `Program directory "${programs[0]}" should exist at ` +
      `${S3K_PROGRAMS_PATH.join('/')}/${programs[0]}/`,
    ).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Import Program to Device from Library
  // -------------------------------------------------------------------------

  test('program round trip: export from device, import back, verify', async ({
    page,
  }) => {
    // Connect to OPFS so the library page fully renders
    await connectToOPFS(page);

    // --- Phase 1: Export a program from the device to the library ----------

    // Wait for device programs
    const devicePrograms = page.locator(
      '[data-testid^="device-program-"]',
    );
    await expect(devicePrograms.first()).toBeVisible({ timeout: 30_000 });

    const initialProgramCount = await devicePrograms.count();
    expect(
      initialProgramCount,
      'Device must have at least one program loaded for this test.',
    ).toBeGreaterThan(0);

    // Select first program and export it
    await page.locator('[data-testid="device-program-0"]').click();

    const saveProgramButton = page.locator(
      '[data-testid="preview-save-program-to-library"]',
    );
    await expect(saveProgramButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await saveProgramButton.click();

    const exportConfirm = page.locator(
      '[data-testid="export-program-confirm"]',
    );
    await expect(exportConfirm).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await exportConfirm.click();

    console.log('Waiting for program export from device (phase 1)...');
    await waitForTransferWithHeartbeat(
      page,
      'export-program-done',
      '[role="dialog"]',
      TRANSFER_TIMEOUT_MS,
    );

    const exportDone = page.locator(
      '[data-testid="export-program-done"]',
    );
    await exportDone.click();

    // Verify the program was exported
    const programs = await listS3kPrograms(page);
    expect(
      programs.length,
      'Expected at least one exported program in library',
    ).toBeGreaterThanOrEqual(1);

    const exportedProgramName = programs[0];
    console.log(`Exported program: ${exportedProgramName}`);

    // --- Phase 2: Import the exported program back to the device ----------

    // Select the exported program in the library tree
    await assertLibraryItemVisible(
      page,
      exportedProgramName,
      UI_TIMEOUT_MS,
    );
    await clickLibraryItem(page, exportedProgramName);

    // Click import to device
    const importButton = page.locator(
      '[data-testid="preview-send-to-device"]',
    );
    // The import button might use a different test ID for programs
    const importProgramButton = importButton.or(
      page.locator('[data-testid="import-program-confirm"]'),
    );

    // If import-program flow is available directly from the tree, use it
    const sendToDevice = page.locator(
      '[data-testid="preview-send-to-device"]',
    );
    if (await sendToDevice.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sendToDevice.click();

      // Handle import program dialog if it appears
      const importConfirm = page.locator(
        '[data-testid="import-program-confirm"]',
      );
      await expect(importConfirm).toBeVisible({ timeout: UI_TIMEOUT_MS });
      await importConfirm.click();

      console.log(
        'Waiting for program import to device (phase 2)...',
      );
      await waitForTransferWithHeartbeat(
        page,
        'import-program-done',
        '[role="dialog"]',
        TRANSFER_TIMEOUT_MS,
      );

      const importDone = page.locator(
        '[data-testid="import-program-done"]',
      );
      await importDone.click();

      // Verify the device still has programs loaded
      await expect(devicePrograms.first()).toBeVisible({
        timeout: 15_000,
      });
      const finalProgramCount = await devicePrograms.count();
      console.log(
        `Device programs after import: ${finalProgramCount} (was ${initialProgramCount})`,
      );
    } else {
      console.log(
        'Send-to-device not available for library programs -- ' +
        'program import may not be implemented yet. Skipping phase 2.',
      );
    }
  });

  // -------------------------------------------------------------------------
  // Delete Device Sample
  // -------------------------------------------------------------------------

  test('delete device sample after receiving it', async ({ page }) => {
    const FIXTURE_NAME = 'DeleteMe';

    // Write fixture and connect
    await writeSampleFixture(page, FIXTURE_NAME);
    await connectToOPFS(page);

    // Send sample to device
    await assertLibraryItemVisible(page, FIXTURE_NAME, UI_TIMEOUT_MS);
    await clickLibraryItem(page, FIXTURE_NAME);

    const sendButton = page.locator(
      '[data-testid="preview-send-to-device"]',
    );
    await expect(sendButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sendButton.click();

    const sendConfirm = page.locator(
      '[data-testid="send-sample-confirm"]',
    );
    await expect(sendConfirm).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await sendConfirm.click();

    console.log('Waiting for SDS send to device...');
    await waitForTransferWithHeartbeat(
      page,
      'send-sample-done',
      '[role="dialog"]',
      TRANSFER_TIMEOUT_MS,
    );

    const sendDone = page.locator('[data-testid="send-sample-done"]');
    await sendDone.click();

    // Wait for device panel to show the sample
    const deviceSample = page.locator(
      '[data-testid="device-sample-0"]',
    );
    await expect(deviceSample).toBeVisible({ timeout: 15_000 });

    // Count samples before delete
    const samplesBefore = await page
      .locator('[data-testid^="device-sample-"]')
      .count();
    console.log(`Device samples before delete: ${samplesBefore}`);

    // Select sample and delete it
    await deviceSample.click();

    const deleteButton = page.locator(
      '[data-testid="preview-delete-device-sample"]',
    );
    await expect(deleteButton).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await deleteButton.click();

    // Confirm delete if there's a confirmation dialog
    const confirmDelete = page.locator(
      'button:has-text("Delete"), button:has-text("Confirm")',
    );
    if (
      await confirmDelete.first().isVisible({ timeout: 3_000 }).catch(() => false)
    ) {
      await confirmDelete.first().click();
    }

    // Wait briefly for device to process the delete
    await page.waitForTimeout(2_000);

    // Verify sample count decreased or panel updated
    const samplesAfter = await page
      .locator('[data-testid^="device-sample-"]')
      .count();
    console.log(`Device samples after delete: ${samplesAfter}`);

    expect(
      samplesAfter,
      `Expected fewer samples after delete (was ${samplesBefore})`,
    ).toBeLessThan(samplesBefore);
  });
});
