/**
 * Helpers for device-library roundtrip e2e tests.
 *
 * Contains OPFS fixture management functions (browser-context) and
 * a minimal WAV generator for creating test audio fixtures.
 */

import type { Page } from '@playwright/test';

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
// OPFS Helpers (all run in browser context via page.evaluate)
// ---------------------------------------------------------------------------

/**
 * Write a tone fixture (YAML + WAV) to OPFS.
 * Must be called BEFORE connectToOPFS -- the app reads library on connect.
 */
export async function writeToneFixtureToOPFS(
  page: Page,
  deviceType: string,
  fixtureName: string,
  yaml: string,
  wavBase64: string
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
      const tones = await deviceDir.getDirectoryHandle('tones', {
        create: true,
      });

      // Write YAML
      const yamlHandle = await tones.getFileHandle(`${fixtureName}.yaml`, {
        create: true,
      });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(yaml);
      await yamlWriter.close();

      // Write WAV from base64
      const binaryString = atob(wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await tones.getFileHandle(`${fixtureName}.wav`, {
        create: true,
      });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();
    },
    { yaml, wavBase64, device: deviceType, fixtureName }
  );
}

/**
 * Initialize a clean OPFS library directory structure.
 * Deletes all existing contents, then creates the standard layout.
 */
export async function initializeCleanOPFS(
  page: Page,
  deviceType: string
): Promise<void> {
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
    const deviceDir = await lib.getDirectoryHandle(device, { create: true });
    await deviceDir.getDirectoryHandle('tones', { create: true });
    await deviceDir.getDirectoryHandle('patches', { create: true });
    await deviceDir.getDirectoryHandle('sets', { create: true });
  }, deviceType);
}

/**
 * Clean up all OPFS contents.
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
 * List tone YAML files in the OPFS library, returning names without extension.
 */
export async function listExportedTones(
  page: Page,
  deviceType: string
): Promise<string[]> {
  return page.evaluate(async (device: string) => {
    const root = await navigator.storage.getDirectory();
    const lib = await root.getDirectoryHandle('library');
    const deviceDir = await lib.getDirectoryHandle(device);
    const tones = await deviceDir.getDirectoryHandle('tones');

    const yamlFiles: string[] = [];
    for await (const handle of (
      tones as unknown as {
        values(): AsyncIterableIterator<FileSystemHandle>;
      }
    ).values()) {
      if (handle.kind === 'file' && handle.name.endsWith('.yaml')) {
        yamlFiles.push(handle.name.replace(/\.yaml$/, ''));
      }
    }
    return yamlFiles;
  }, deviceType);
}

/**
 * Read a tone YAML file from OPFS and return its text content.
 */
export async function readExportedToneYaml(
  page: Page,
  deviceType: string,
  toneName: string
): Promise<string> {
  return page.evaluate(
    async ({ device, name }: { device: string; name: string }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library');
      const deviceDir = await lib.getDirectoryHandle(device);
      const tones = await deviceDir.getDirectoryHandle('tones');
      const handle = await tones.getFileHandle(`${name}.yaml`);
      const file = await handle.getFile();
      return file.text();
    },
    { device: deviceType, name: toneName }
  );
}

/**
 * Check if a WAV file exists for a given tone name.
 */
export async function exportedToneHasWav(
  page: Page,
  deviceType: string,
  toneName: string
): Promise<boolean> {
  return page.evaluate(
    async ({ device, name }: { device: string; name: string }) => {
      const root = await navigator.storage.getDirectory();
      try {
        const lib = await root.getDirectoryHandle('library');
        const deviceDir = await lib.getDirectoryHandle(device);
        const tones = await deviceDir.getDirectoryHandle('tones');
        await tones.getFileHandle(`${name}.wav`);
        return true;
      } catch {
        return false;
      }
    },
    { device: deviceType, name: toneName }
  );
}

// ---------------------------------------------------------------------------
// Patch OPFS Helpers
// ---------------------------------------------------------------------------

interface ToneFixtureEntry {
  slotLabel: string;
  yaml: string;
  wavBase64: string;
}

/**
 * Write a patch fixture (directory bundle) to OPFS.
 * Creates: library/{device}/patches/{patchName}/patch.yaml
 *          library/{device}/patches/{patchName}/tones/{slotLabel}.yaml + .wav
 */
export async function writePatchFixtureToOPFS(
  page: Page,
  deviceType: string,
  patchName: string,
  patchYaml: string,
  tones: ReadonlyArray<ToneFixtureEntry>
): Promise<void> {
  await page.evaluate(
    async ({
      patchYaml,
      tones,
      device,
      patchName,
    }: {
      patchYaml: string;
      tones: ReadonlyArray<ToneFixtureEntry>;
      device: string;
      patchName: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const deviceDir = await lib.getDirectoryHandle(device, { create: true });
      const patches = await deviceDir.getDirectoryHandle('patches', {
        create: true,
      });
      const patchDir = await patches.getDirectoryHandle(patchName, {
        create: true,
      });

      // Write patch.yaml
      const yamlHandle = await patchDir.getFileHandle('patch.yaml', {
        create: true,
      });
      const yamlWriter = await yamlHandle.createWritable();
      await yamlWriter.write(patchYaml);
      await yamlWriter.close();

      // Write dependent tones
      const tonesDir = await patchDir.getDirectoryHandle('tones', {
        create: true,
      });
      for (const tone of tones) {
        const toneYamlHandle = await tonesDir.getFileHandle(
          `${tone.slotLabel}.yaml`,
          { create: true }
        );
        const toneYamlWriter = await toneYamlHandle.createWritable();
        await toneYamlWriter.write(tone.yaml);
        await toneYamlWriter.close();

        const binaryString = atob(tone.wavBase64);
        const wavBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          wavBytes[i] = binaryString.charCodeAt(i);
        }
        const wavHandle = await tonesDir.getFileHandle(
          `${tone.slotLabel}.wav`,
          { create: true }
        );
        const wavWriter = await wavHandle.createWritable();
        await wavWriter.write(wavBytes);
        await wavWriter.close();
      }
    },
    { patchYaml, tones: [...tones], device: deviceType, patchName }
  );
}

/**
 * List patch subdirectory names in the OPFS library.
 */
export async function listExportedPatches(
  page: Page,
  deviceType: string
): Promise<string[]> {
  return page.evaluate(async (device: string) => {
    const root = await navigator.storage.getDirectory();
    const lib = await root.getDirectoryHandle('library');
    const deviceDir = await lib.getDirectoryHandle(device);
    const patches = await deviceDir.getDirectoryHandle('patches');

    const dirs: string[] = [];
    for await (const handle of (
      patches as unknown as {
        values(): AsyncIterableIterator<FileSystemHandle>;
      }
    ).values()) {
      if (handle.kind === 'directory') {
        dirs.push(handle.name);
      }
    }
    return dirs;
  }, deviceType);
}

/**
 * Read a patch's patch.yaml from OPFS and return its text content.
 */
export async function readExportedPatchYaml(
  page: Page,
  deviceType: string,
  patchName: string
): Promise<string> {
  return page.evaluate(
    async ({ device, name }: { device: string; name: string }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library');
      const deviceDir = await lib.getDirectoryHandle(device);
      const patches = await deviceDir.getDirectoryHandle('patches');
      const patchDir = await patches.getDirectoryHandle(name);
      const handle = await patchDir.getFileHandle('patch.yaml');
      const file = await handle.getFile();
      return file.text();
    },
    { device: deviceType, name: patchName }
  );
}

// ---------------------------------------------------------------------------
// Simple YAML Field Extractor
// ---------------------------------------------------------------------------

/**
 * Extract top-level and nested scalar fields from a YAML string.
 *
 * This is intentionally simple -- it handles the flat and single-nested
 * structure used by sampler-tone YAML files without pulling in a full
 * YAML parser dependency.
 */
export function extractYamlFields(
  yaml: string
): Record<string, string | Record<string, string>> {
  const result: Record<string, string | Record<string, string>> = {};
  let currentSection: string | null = null;

  for (const line of yaml.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    // Top-level key (no leading whitespace)
    const topMatch = /^(\w[\w.]*)\s*:\s*(.*)/.exec(line);
    if (topMatch) {
      const key = topMatch[1];
      const value = topMatch[2].trim();
      if (value === '' || value === '|') {
        currentSection = key;
        result[key] = {};
      } else {
        currentSection = null;
        result[key] = value.replace(/^["']|["']$/g, '');
      }
      continue;
    }

    // Nested key (indented)
    if (currentSection) {
      const nestedMatch = /^\s+(\w[\w.]*)\s*:\s*(.+)/.exec(line);
      if (nestedMatch) {
        const section = result[currentSection];
        if (typeof section === 'object') {
          section[nestedMatch[1]] = nestedMatch[2]
            .trim()
            .replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return result;
}
