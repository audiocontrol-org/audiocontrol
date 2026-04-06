/**
 * OPFS fixture helpers for library e2e tests.
 *
 * These functions manage OPFS state for tests that exercise the library UI
 * (e.g., library tree, chopper, preview panel). They wrap page.evaluate
 * calls to run OPFS operations in the browser context.
 *
 * Unlike roundtrip-helpers.ts, this file has NO dependency on device test
 * infrastructure (MIDI, device-state, connection-helper). It is safe to
 * use from library-only test specs that run without hardware.
 */

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Minimal WAV Generator
// ---------------------------------------------------------------------------

/**
 * Create a minimal mono PCM WAV file as a base64-encoded string.
 * The audio is silence (all zero samples).
 */
export function createMinimalWavBase64(
  sampleRate: number,
  durationSeconds: number
): string {
  const samples = Math.floor(sampleRate * durationSeconds);
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * channels * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  // Data bytes are already zeroed (silence)

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// OPFS Cleanup
// ---------------------------------------------------------------------------

/**
 * Delete all OPFS contents for a clean slate.
 */
export async function cleanupOPFS(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const entries: string[] = [];
    for await (const name of (
      root as unknown as { keys(): AsyncIterableIterator<string> }
    ).keys()) {
      entries.push(name);
    }
    for (const name of entries) {
      try {
        await root.removeEntry(name, { recursive: true });
      } catch {
        // ignore
      }
    }
  });
}

/**
 * Initialize a clean OPFS library directory structure for the given device.
 * Deletes all existing contents, then creates the standard layout including
 * common sample and device-specific directories.
 */
export async function initializeCleanOPFS(page: Page, device: string): Promise<void> {
  await page.evaluate(async (device: string) => {
    const root = await navigator.storage.getDirectory();

    // Delete everything first
    const entries: string[] = [];
    for await (const name of (
      root as unknown as { keys(): AsyncIterableIterator<string> }
    ).keys()) {
      entries.push(name);
    }
    for (const name of entries) {
      try {
        await root.removeEntry(name, { recursive: true });
      } catch {
        // ignore
      }
    }

    // Create clean structure
    const lib = await root.getDirectoryHandle('library', { create: true });
    const common = await lib.getDirectoryHandle('common', { create: true });
    await common.getDirectoryHandle('samples', { create: true });
    const deviceDir = await lib.getDirectoryHandle(device, { create: true });
    await deviceDir.getDirectoryHandle('tones', { create: true });
    await deviceDir.getDirectoryHandle('patches', { create: true });
    await deviceDir.getDirectoryHandle('sets', { create: true });
    await deviceDir.getDirectoryHandle('drum-kits', { create: true });
  }, device);
}

// ---------------------------------------------------------------------------
// Fixture Writers
// ---------------------------------------------------------------------------

/**
 * Write a common-area sample fixture to OPFS.
 *
 * Creates: library/common/samples/{name}/sample.yaml
 *          library/common/samples/{name}/sample.wav
 *
 * Must be called BEFORE connectToOPFSBackend -- the app reads library on connect.
 */
export async function writeSampleFixtureToOPFS(
  page: Page,
  sampleName: string,
  sampleRate: number,
  wavBase64: string,
): Promise<void> {
  await page.evaluate(
    async ({
      sampleName,
      sampleRate,
      wavBase64,
    }: {
      sampleName: string;
      sampleRate: number;
      wavBase64: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const common = await lib.getDirectoryHandle('common', { create: true });
      const samples = await common.getDirectoryHandle('samples', { create: true });
      const sampleDir = await samples.getDirectoryHandle(sampleName, { create: true });

      // Write sample.yaml
      const yaml = [
        'format: sample',
        'version: 1',
        `name: "${sampleName}"`,
        'file: sample.wav',
        `sampleRate: ${sampleRate}`,
      ].join('\n');

      const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();

      // Write sample.wav from base64
      const binaryString = atob(wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();
    },
    { sampleName, sampleRate, wavBase64 },
  );
}

/**
 * Write a tone fixture (YAML + WAV) to OPFS under library/{device}/tones/.
 *
 * Must be called BEFORE connectToOPFSBackend -- the app reads library on connect.
 */
export async function writeToneFixtureToOPFS(
  page: Page,
  device: string,
  fixtureName: string,
  yaml: string,
  wavBase64: string,
): Promise<void> {
  await page.evaluate(
    async ({
      yaml,
      wavBase64,
      device,
      fixtureName,
    }: {
      yaml: string;
      wavBase64: string;
      device: string;
      fixtureName: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const deviceDir = await lib.getDirectoryHandle(device, { create: true });
      const tones = await deviceDir.getDirectoryHandle('tones', { create: true });

      // Write YAML
      const yamlHandle = await tones.getFileHandle(`${fixtureName}.yaml`, { create: true });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();

      // Write WAV from base64
      const binaryString = atob(wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await tones.getFileHandle(`${fixtureName}.wav`, { create: true });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();
    },
    { yaml, wavBase64, device, fixtureName },
  );
}

// ---------------------------------------------------------------------------
// OPFS Readers
// ---------------------------------------------------------------------------

/**
 * Read sample.yaml from a common-area sample directory in OPFS.
 */
export async function readSampleYaml(
  page: Page,
  sampleName: string,
): Promise<string> {
  return page.evaluate(
    async (name: string) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library');
      const common = await lib.getDirectoryHandle('common');
      const samples = await common.getDirectoryHandle('samples');
      const sampleDir = await samples.getDirectoryHandle(name);
      const handle = await sampleDir.getFileHandle('sample.yaml');
      const file = await handle.getFile();
      return file.text();
    },
    sampleName,
  );
}

/**
 * Read kit.yaml from a drum kit directory in OPFS.
 * Returns null if the kit directory or kit.yaml doesn't exist.
 */
export async function readDrumKitYaml(
  page: Page,
  device: string,
  kitName: string,
): Promise<string | null> {
  return page.evaluate(
    async ({ kitName, device }: { kitName: string; device: string }) => {
      const root = await navigator.storage.getDirectory();
      try {
        const lib = await root.getDirectoryHandle('library');
        const deviceDir = await lib.getDirectoryHandle(device);
        const drumKitsDir = await deviceDir.getDirectoryHandle('drum-kits');
        const kitDir = await drumKitsDir.getDirectoryHandle(kitName);
        const handle = await kitDir.getFileHandle('kit.yaml');
        const file = await handle.getFile();
        return file.text();
      } catch {
        return null;
      }
    },
    { kitName, device },
  );
}

/**
 * List drum kit directory names in OPFS for a given device.
 */
export async function listDrumKitDirectories(
  page: Page,
  device: string,
): Promise<string[]> {
  return page.evaluate(
    async (device: string) => {
      const root = await navigator.storage.getDirectory();
      try {
        const lib = await root.getDirectoryHandle('library');
        const deviceDir = await lib.getDirectoryHandle(device);
        const drumKitsDir = await deviceDir.getDirectoryHandle('drum-kits');
        const dirs: string[] = [];
        for await (const handle of (
          drumKitsDir as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }
        ).values()) {
          if (handle.kind === 'directory') {
            dirs.push(handle.name);
          }
        }
        return dirs;
      } catch {
        return [];
      }
    },
    device,
  );
}

// ---------------------------------------------------------------------------
// Library Connection
// ---------------------------------------------------------------------------

/**
 * Connect to the OPFS library backend by clicking the UI button.
 *
 * The app reads library contents when this button is clicked, so OPFS
 * fixtures must be written BEFORE calling this function.
 */
export async function connectToOPFSBackend(
  page: Page,
  timeoutMs = 5_000,
): Promise<void> {
  const opfsButton = page.locator('[data-testid="library-backend-opfs"]');
  await expect(opfsButton).toBeVisible({ timeout: timeoutMs });
  await opfsButton.click();

  // Wait for connection status indicator to show connected state
  await expect(page.locator('.ac-library-connection-status')).toBeVisible({
    timeout: timeoutMs,
  });
}
