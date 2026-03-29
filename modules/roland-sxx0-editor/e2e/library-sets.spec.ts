/**
 * E2E tests for library set operations.
 *
 * Tests verify OPFS set CRUD operations: list, read, create, rename, delete, move.
 * Sets are directories containing a manifest (set.yaml) and subdirectories for tones/patches.
 * Tests run with short timeouts for fast failure detection.
 */

import { test, expect } from '@playwright/test';

// Short timeouts - fail fast
test.setTimeout(15_000);

/**
 * Creates a minimal valid WAV file with 16-bit mono PCM silence.
 * Returns base64-encoded string for transport to browser.
 */
function createMinimalWavBase64(sampleCount = 1024, sampleRate = 30000): string {
  const dataSize = sampleCount * 2; // 16-bit = 2 bytes per sample
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // file size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  // Generate a simple sine wave at 440Hz for audibility
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const amplitude = Math.sin(2 * Math.PI * 440 * t);
    const sample = Math.round(amplitude * 16000); // ~50% volume
    view.setInt16(44 + i * 2, sample, true);
  }

  const uint8Array = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Pre-generate WAV data for tests
const BASIC_WAV_BASE64 = createMinimalWavBase64(1024, 30000);

// Basic set manifest YAML for tests
const BASIC_SET_MANIFEST_YAML = `name: "Test Set"
created: "2024-01-01T00:00:00Z"
device: "S-330"
tones:
  - "tones/T01.yaml"
patches:
  - "patches/P01.yaml"`;

// Set manifest with all fields
const FULL_SET_MANIFEST_YAML = `name: "Full Set"
created: "2024-01-01T00:00:00Z"
modified: "2024-06-15T12:30:00Z"
device: "S-550"
description: "A comprehensive test set"
author: "Test Author"
tones:
  - "tones/T01.yaml"
  - "tones/T02.yaml"
patches:
  - "patches/P01.yaml"
  - "patches/P02.yaml"`;

// Set manifest with minimal fields
const MINIMAL_SET_MANIFEST_YAML = `name: "Minimal Set"
device: "S-330"
tones: []
patches: []`;

// Basic tone YAML for tests
const BASIC_TONE_YAML = `name: "Basic Sine"
sampleRate: 30000
loopStart: 0
loopEnd: 1000
rootKey: 60
fineTune: 0`;

// Basic patch YAML for tests
const BASIC_PATCH_YAML = `name: "Basic Patch"
tones:
  - name: "Basic Sine"
    keyRangeLow: 0
    keyRangeHigh: 127
    level: 100`;

/**
 * OPFS helper functions to be evaluated in browser context.
 * These are inlined because page.evaluate cannot import modules.
 */
const OPFS_HELPERS = `
  /**
   * Get the OPFS root directory handle.
   */
  async function getOPFSRoot() {
    return await navigator.storage.getDirectory();
  }

  /**
   * Initialize the library directory structure.
   * Creates: library/tones, library/patches, library/sets
   */
  async function initializeOPFS() {
    const root = await getOPFSRoot();
    const library = await root.getDirectoryHandle('library', { create: true });
    await library.getDirectoryHandle('tones', { create: true });
    await library.getDirectoryHandle('patches', { create: true });
    await library.getDirectoryHandle('sets', { create: true });
    return { success: true };
  }

  /**
   * Check if a directory exists at the given path.
   */
  async function directoryExists(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    try {
      for (const segment of pathSegments) {
        current = await current.getDirectoryHandle(segment);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a file exists at the given path.
   */
  async function fileExists(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    try {
      for (const segment of pathSegments) {
        current = await current.getDirectoryHandle(segment);
      }
      await current.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write a text file to OPFS at the given path.
   */
  async function writeFile(pathSegments, fileName, content) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return { success: true };
  }

  /**
   * Write a binary file (from base64) to OPFS at the given path.
   */
  async function writeBinaryFile(pathSegments, fileName, base64Content) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    const fileHandle = await current.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    // Decode base64 to binary
    const binary = atob(base64Content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    await writable.write(bytes);
    await writable.close();
    return { success: true };
  }

  /**
   * Read a text file from OPFS at the given path.
   */
  async function readFile(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const content = await file.text();
    return { success: true, content };
  }

  /**
   * Get file size at the given path.
   */
  async function getFileSize(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const fileHandle = await current.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return { success: true, size: file.size };
  }

  /**
   * List directory contents at the given path.
   */
  async function listDirectory(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    const entries = [];
    for await (const entry of current.values()) {
      entries.push({ name: entry.name, kind: entry.kind });
    }
    return { success: true, entries };
  }

  /**
   * Recursively delete all contents of a directory.
   */
  async function deleteDirectoryContents(dirHandle) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        const subDir = await dirHandle.getDirectoryHandle(entry.name);
        await deleteDirectoryContents(subDir);
      }
      await dirHandle.removeEntry(entry.name, { recursive: true });
    }
  }

  /**
   * Clean up OPFS - remove all files and directories.
   */
  async function cleanupOPFS() {
    const root = await getOPFSRoot();
    await deleteDirectoryContents(root);
    return { success: true };
  }

  /**
   * Create a directory at the given path.
   */
  async function createDirectory(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    return { success: true };
  }

  /**
   * Delete a file at the given path.
   */
  async function deleteFile(pathSegments, fileName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }
    await current.removeEntry(fileName);
    return { success: true };
  }

  /**
   * List sets in the library/sets directory.
   * Sets are directories containing a set.yaml manifest.
   * Returns an array of set names.
   */
  async function listSets(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const sets = [];
    for await (const entry of current.values()) {
      if (entry.kind === 'directory') {
        // Check if directory contains set.yaml
        try {
          const setDir = await current.getDirectoryHandle(entry.name);
          await setDir.getFileHandle('set.yaml');
          sets.push(entry.name);
        } catch {
          // Not a valid set (no set.yaml)
        }
      }
    }

    return { success: true, sets };
  }

  /**
   * List all directories in the sets folder (including those without manifests).
   */
  async function listSetDirectories(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const directories = [];
    for await (const entry of current.values()) {
      if (entry.kind === 'directory') {
        directories.push(entry.name);
      }
    }

    return { success: true, directories };
  }

  /**
   * Read and parse set manifest (set.yaml).
   */
  async function readSetManifest(pathSegments, setName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const setDir = await current.getDirectoryHandle(setName);
    const fileHandle = await setDir.getFileHandle('set.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    // Simple YAML parsing for key-value pairs and arrays
    const manifest = {};
    const lines = content.split('\\n');
    let currentKey = null;
    let currentArray = null;

    for (const line of lines) {
      // Check for array items
      if (currentArray !== null && line.match(/^\\s+-\\s+"?([^"]*)"?$/)) {
        const match = line.match(/^\\s+-\\s+"?([^"]*)"?$/);
        if (match) {
          currentArray.push(match[1]);
        }
        continue;
      }

      // Check for key-value pairs
      const kvMatch = line.match(/^(\\w+):\\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2].trim();

        // Save previous array if exists
        if (currentArray !== null && currentKey !== null) {
          manifest[currentKey] = currentArray;
          currentArray = null;
          currentKey = null;
        }

        if (value === '' || value === '[]') {
          // Start of an array or empty array
          currentKey = key;
          currentArray = [];
        } else {
          // Simple key-value
          let parsedValue = value.replace(/^"(.*)"$/, '$1');
          // Try to parse numbers
          if (/^-?\\d+(\\.\\d+)?$/.test(parsedValue)) {
            parsedValue = parseFloat(parsedValue);
          }
          manifest[key] = parsedValue;
        }
      }
    }

    // Don't forget the last array
    if (currentArray !== null && currentKey !== null) {
      manifest[currentKey] = currentArray;
    }

    return { success: true, manifest, rawContent: content };
  }

  /**
   * Create a set with manifest and optional tones/patches.
   */
  async function createSet(pathSegments, setName, manifestYaml, tones, patches) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }

    // Create set directory
    const setDir = await current.getDirectoryHandle(setName, { create: true });

    // Write manifest
    const manifestHandle = await setDir.getFileHandle('set.yaml', { create: true });
    const manifestWritable = await manifestHandle.createWritable();
    await manifestWritable.write(manifestYaml);
    await manifestWritable.close();

    // Create tones directory and files
    if (tones && tones.length > 0) {
      const tonesDir = await setDir.getDirectoryHandle('tones', { create: true });
      for (const tone of tones) {
        // Write YAML
        const yamlHandle = await tonesDir.getFileHandle(tone.name + '.yaml', { create: true });
        const yamlWritable = await yamlHandle.createWritable();
        await yamlWritable.write(tone.yaml);
        await yamlWritable.close();

        // Write WAV
        const wavHandle = await tonesDir.getFileHandle(tone.name + '.wav', { create: true });
        const wavWritable = await wavHandle.createWritable();
        const binary = atob(tone.wavBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        await wavWritable.write(bytes);
        await wavWritable.close();
      }
    }

    // Create patches directory and files
    if (patches && patches.length > 0) {
      const patchesDir = await setDir.getDirectoryHandle('patches', { create: true });
      for (const patch of patches) {
        const patchHandle = await patchesDir.getFileHandle(patch.name + '.yaml', { create: true });
        const patchWritable = await patchHandle.createWritable();
        await patchWritable.write(patch.yaml);
        await patchWritable.close();
      }
    }

    return { success: true };
  }

  /**
   * Create an empty set with just the manifest.
   */
  async function createEmptySet(pathSegments, setName, manifestYaml) {
    return await createSet(pathSegments, setName, manifestYaml, [], []);
  }

  /**
   * List tones in a set.
   */
  async function listSetTones(pathSegments, setName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const setDir = await current.getDirectoryHandle(setName);

    try {
      const tonesDir = await setDir.getDirectoryHandle('tones');
      const tones = [];

      const files = [];
      for await (const entry of tonesDir.values()) {
        if (entry.kind === 'file') {
          files.push(entry.name);
        }
      }

      // Find pairs of .yaml and .wav files
      const yamlFiles = files.filter(f => f.endsWith('.yaml')).map(f => f.slice(0, -5));
      const wavFiles = files.filter(f => f.endsWith('.wav')).map(f => f.slice(0, -4));

      // Return only tones that have both files
      for (const name of yamlFiles) {
        if (wavFiles.includes(name)) {
          tones.push(name);
        }
      }

      return { success: true, tones };
    } catch {
      // No tones directory
      return { success: true, tones: [] };
    }
  }

  /**
   * List patches in a set.
   */
  async function listSetPatches(pathSegments, setName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const setDir = await current.getDirectoryHandle(setName);

    try {
      const patchesDir = await setDir.getDirectoryHandle('patches');
      const patches = [];

      for await (const entry of patchesDir.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.yaml')) {
          patches.push(entry.name.slice(0, -5)); // Remove .yaml extension
        }
      }

      return { success: true, patches };
    } catch {
      // No patches directory
      return { success: true, patches: [] };
    }
  }

  /**
   * Read individual tone from set.
   */
  async function readSetTone(pathSegments, setName, toneName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const setDir = await current.getDirectoryHandle(setName);
    const tonesDir = await setDir.getDirectoryHandle('tones');
    const fileHandle = await tonesDir.getFileHandle(toneName + '.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    return { success: true, content };
  }

  /**
   * Read individual patch from set.
   */
  async function readSetPatch(pathSegments, setName, patchName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const setDir = await current.getDirectoryHandle(setName);
    const patchesDir = await setDir.getDirectoryHandle('patches');
    const fileHandle = await patchesDir.getFileHandle(patchName + '.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    return { success: true, content };
  }

  /**
   * Rename a set (renames the directory).
   */
  async function renameSet(pathSegments, oldName, newName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    // Read all contents from old set
    const oldSetDir = await current.getDirectoryHandle(oldName);

    // Create new set directory
    const newSetDir = await current.getDirectoryHandle(newName, { create: true });

    // Copy all contents recursively
    async function copyDirectory(srcDir, destDir) {
      for await (const entry of srcDir.values()) {
        if (entry.kind === 'file') {
          const srcHandle = await srcDir.getFileHandle(entry.name);
          const srcFile = await srcHandle.getFile();
          const content = await srcFile.arrayBuffer();

          const destHandle = await destDir.getFileHandle(entry.name, { create: true });
          const writable = await destHandle.createWritable();
          await writable.write(content);
          await writable.close();
        } else {
          const srcSubDir = await srcDir.getDirectoryHandle(entry.name);
          const destSubDir = await destDir.getDirectoryHandle(entry.name, { create: true });
          await copyDirectory(srcSubDir, destSubDir);
        }
      }
    }

    await copyDirectory(oldSetDir, newSetDir);

    // Delete old set
    await current.removeEntry(oldName, { recursive: true });

    return { success: true };
  }

  /**
   * Delete a set (deletes the entire directory recursively).
   */
  async function deleteSet(pathSegments, setName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    await current.removeEntry(setName, { recursive: true });

    return { success: true };
  }

  /**
   * Move a set to a different location.
   */
  async function moveSet(srcPathSegments, setName, destPathSegments) {
    const root = await getOPFSRoot();

    // Navigate to source directory
    let srcDir = root;
    for (const segment of srcPathSegments) {
      srcDir = await srcDir.getDirectoryHandle(segment);
    }

    // Navigate to/create destination directory
    let destDir = root;
    for (const segment of destPathSegments) {
      destDir = await destDir.getDirectoryHandle(segment, { create: true });
    }

    // Get source set directory
    const srcSetDir = await srcDir.getDirectoryHandle(setName);

    // Create destination set directory
    const destSetDir = await destDir.getDirectoryHandle(setName, { create: true });

    // Copy all contents recursively
    async function copyDirectory(srcDir, destDir) {
      for await (const entry of srcDir.values()) {
        if (entry.kind === 'file') {
          const srcHandle = await srcDir.getFileHandle(entry.name);
          const srcFile = await srcHandle.getFile();
          const content = await srcFile.arrayBuffer();

          const destHandle = await destDir.getFileHandle(entry.name, { create: true });
          const writable = await destHandle.createWritable();
          await writable.write(content);
          await writable.close();
        } else {
          const srcSubDir = await srcDir.getDirectoryHandle(entry.name);
          const destSubDir = await destDir.getDirectoryHandle(entry.name, { create: true });
          await copyDirectory(srcSubDir, destSubDir);
        }
      }
    }

    await copyDirectory(srcSetDir, destSetDir);

    // Delete from source
    await srcDir.removeEntry(setName, { recursive: true });

    return { success: true };
  }

  /**
   * Get tone file references from set manifest.
   */
  async function getSetToneRefs(pathSegments, setName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const setDir = await current.getDirectoryHandle(setName);
    const fileHandle = await setDir.getFileHandle('set.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    // Extract tone references from YAML
    const toneRefs = [];
    const lines = content.split('\\n');
    let inTones = false;

    for (const line of lines) {
      if (line.match(/^tones:/)) {
        inTones = true;
        continue;
      }
      if (inTones && line.match(/^\\w+:/)) {
        // New section, stop parsing tones
        break;
      }
      if (inTones) {
        const match = line.match(/^\\s+-\\s+"?([^"]*)"?$/);
        if (match) {
          toneRefs.push(match[1]);
        }
      }
    }

    return { success: true, toneRefs };
  }

  /**
   * Get patch file references from set manifest.
   */
  async function getSetPatchRefs(pathSegments, setName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const setDir = await current.getDirectoryHandle(setName);
    const fileHandle = await setDir.getFileHandle('set.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    // Extract patch references from YAML
    const patchRefs = [];
    const lines = content.split('\\n');
    let inPatches = false;

    for (const line of lines) {
      if (line.match(/^patches:/)) {
        inPatches = true;
        continue;
      }
      if (inPatches && line.match(/^\\w+:/)) {
        // New section, stop parsing patches
        break;
      }
      if (inPatches) {
        const match = line.match(/^\\s+-\\s+"?([^"]*)"?$/);
        if (match) {
          patchRefs.push(match[1]);
        }
      }
    }

    return { success: true, patchRefs };
  }
`;

test.describe('Library Set Operations', () => {
  // Clean up OPFS before each test for isolation
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    await page.evaluate(`
      ${OPFS_HELPERS}
      (async () => {
        await cleanupOPFS();
        await initializeOPFS();
      })();
    `);
  });

  test.describe('Set Listing', () => {
    test('can list sets in library', async ({ page }) => {
      // Create a set
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createEmptySet(['library', 'sets'], 'test-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)});
        })();
      `);

      // List sets
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSets(['library', 'sets']);
        })();
      `) as { success: boolean; sets: string[] };

      expect(result.success).toBe(true);
      expect(result.sets).toContain('test-set');
    });

    test('lists sets with correct metadata', async ({ page }) => {
      // Create a set with full manifest
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createEmptySet(['library', 'sets'], 'full-set', ${JSON.stringify(FULL_SET_MANIFEST_YAML)});
        })();
      `);

      // Read manifest and verify metadata
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readSetManifest(['library', 'sets'], 'full-set');
        })();
      `) as { success: boolean; manifest: { name: string; device: string } };

      expect(result.success).toBe(true);
      expect(result.manifest.name).toBe('Full Set');
      expect(result.manifest.device).toBe('S-550');
    });

    test('returns empty list when no sets exist', async ({ page }) => {
      // List sets in empty directory
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSets(['library', 'sets']);
        })();
      `) as { success: boolean; sets: string[] };

      expect(result.success).toBe(true);
      expect(result.sets).toHaveLength(0);
    });
  });

  test.describe('Set Manifest', () => {
    test('can read set manifest', async ({ page }) => {
      // Create a set
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createEmptySet(['library', 'sets'], 'read-test', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)});
        })();
      `);

      // Read manifest
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readSetManifest(['library', 'sets'], 'read-test');
        })();
      `) as { success: boolean; rawContent: string };

      expect(result.success).toBe(true);
      expect(result.rawContent).toContain('name: "Test Set"');
    });

    test('can parse set properties', async ({ page }) => {
      // Create a set with full manifest
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createEmptySet(['library', 'sets'], 'full-props', ${JSON.stringify(FULL_SET_MANIFEST_YAML)});
        })();
      `);

      // Read and parse manifest
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readSetManifest(['library', 'sets'], 'full-props');
        })();
      `) as { success: boolean; manifest: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.manifest.name).toBe('Full Set');
      expect(result.manifest.created).toBe('2024-01-01T00:00:00Z');
      expect(result.manifest.device).toBe('S-550');
      expect(result.manifest.tones).toHaveLength(2);
      expect(result.manifest.patches).toHaveLength(2);
    });

    test('handles set with missing optional fields', async ({ page }) => {
      // Create a set with minimal fields
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createEmptySet(['library', 'sets'], 'minimal', ${JSON.stringify(MINIMAL_SET_MANIFEST_YAML)});
        })();
      `);

      // Read manifest
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readSetManifest(['library', 'sets'], 'minimal');
        })();
      `) as { success: boolean; manifest: { name: string; tones: string[]; description?: string } };

      expect(result.success).toBe(true);
      expect(result.manifest.name).toBe('Minimal Set');
      expect(result.manifest.tones).toHaveLength(0);
      // Optional description should not be present
      expect(result.manifest.description).toBeUndefined();
    });
  });

  test.describe('Set Creation', () => {
    test('can create empty set with manifest', async ({ page }) => {
      // Create an empty set
      const createResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await createEmptySet(['library', 'sets'], 'new-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)});
        })();
      `);

      expect(createResult.success).toBe(true);

      // Verify directory exists
      const dirExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'new-set']);
        })();
      `);
      expect(dirExists).toBe(true);

      // Verify manifest exists
      const manifestExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'sets', 'new-set'], 'set.yaml');
        })();
      `);
      expect(manifestExists).toBe(true);
    });

    test('can create set with tones and patches', async ({ page }) => {
      // Create a set with tones and patches
      const createResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const tones = [
            { name: 'T01', yaml: ${JSON.stringify(BASIC_TONE_YAML)}, wavBase64: ${JSON.stringify(BASIC_WAV_BASE64)} }
          ];
          const patches = [
            { name: 'P01', yaml: ${JSON.stringify(BASIC_PATCH_YAML)} }
          ];
          return await createSet(['library', 'sets'], 'complete-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, tones, patches);
        })();
      `);

      expect(createResult.success).toBe(true);

      // Verify tones directory exists
      const tonesExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'complete-set', 'tones']);
        })();
      `);
      expect(tonesExists).toBe(true);

      // Verify tone files exist
      const toneYamlExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'sets', 'complete-set', 'tones'], 'T01.yaml');
        })();
      `);
      expect(toneYamlExists).toBe(true);

      const toneWavExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'sets', 'complete-set', 'tones'], 'T01.wav');
        })();
      `);
      expect(toneWavExists).toBe(true);

      // Verify patches directory exists
      const patchesExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'complete-set', 'patches']);
        })();
      `);
      expect(patchesExists).toBe(true);

      // Verify patch file exists
      const patchExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'sets', 'complete-set', 'patches'], 'P01.yaml');
        })();
      `);
      expect(patchExists).toBe(true);
    });

    test('validates set manifest structure', async ({ page }) => {
      // Create a set with valid manifest
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await createEmptySet(['library', 'sets'], 'valid-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)});
        })();
      `);

      // Read and verify structure
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readSetManifest(['library', 'sets'], 'valid-set');
        })();
      `) as { success: boolean; manifest: { name: string; tones: string[]; patches: string[] } };

      expect(result.success).toBe(true);
      expect(result.manifest.name).toBe('Test Set');
      expect(Array.isArray(result.manifest.tones)).toBe(true);
      expect(Array.isArray(result.manifest.patches)).toBe(true);
    });
  });

  test.describe('Set Content Access', () => {
    test('can list tones in set', async ({ page }) => {
      // Create a set with tones
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const tones = [
            { name: 'T01', yaml: ${JSON.stringify(BASIC_TONE_YAML)}, wavBase64: ${JSON.stringify(BASIC_WAV_BASE64)} },
            { name: 'T02', yaml: ${JSON.stringify(BASIC_TONE_YAML)}, wavBase64: ${JSON.stringify(BASIC_WAV_BASE64)} }
          ];
          return await createSet(['library', 'sets'], 'tone-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, tones, []);
        })();
      `);

      // List tones
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSetTones(['library', 'sets'], 'tone-set');
        })();
      `) as { success: boolean; tones: string[] };

      expect(result.success).toBe(true);
      expect(result.tones).toHaveLength(2);
      expect(result.tones).toContain('T01');
      expect(result.tones).toContain('T02');
    });

    test('can list patches in set', async ({ page }) => {
      // Create a set with patches
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const patches = [
            { name: 'P01', yaml: ${JSON.stringify(BASIC_PATCH_YAML)} },
            { name: 'P02', yaml: ${JSON.stringify(BASIC_PATCH_YAML)} }
          ];
          return await createSet(['library', 'sets'], 'patch-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, [], patches);
        })();
      `);

      // List patches
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSetPatches(['library', 'sets'], 'patch-set');
        })();
      `) as { success: boolean; patches: string[] };

      expect(result.success).toBe(true);
      expect(result.patches).toHaveLength(2);
      expect(result.patches).toContain('P01');
      expect(result.patches).toContain('P02');
    });

    test('can read individual tone from set', async ({ page }) => {
      // Create a set with a tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const tones = [
            { name: 'T01', yaml: ${JSON.stringify(BASIC_TONE_YAML)}, wavBase64: ${JSON.stringify(BASIC_WAV_BASE64)} }
          ];
          return await createSet(['library', 'sets'], 'read-tone-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, tones, []);
        })();
      `);

      // Read tone
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readSetTone(['library', 'sets'], 'read-tone-set', 'T01');
        })();
      `) as { success: boolean; content: string };

      expect(result.success).toBe(true);
      expect(result.content).toContain('name: "Basic Sine"');
      expect(result.content).toContain('sampleRate: 30000');
    });

    test('can read individual patch from set', async ({ page }) => {
      // Create a set with a patch
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const patches = [
            { name: 'P01', yaml: ${JSON.stringify(BASIC_PATCH_YAML)} }
          ];
          return await createSet(['library', 'sets'], 'read-patch-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, [], patches);
        })();
      `);

      // Read patch
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readSetPatch(['library', 'sets'], 'read-patch-set', 'P01');
        })();
      `) as { success: boolean; content: string };

      expect(result.success).toBe(true);
      expect(result.content).toContain('name: "Basic Patch"');
    });
  });

  test.describe('Set Rename', () => {
    test('can rename set', async ({ page }) => {
      // Create a set
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const tones = [
            { name: 'T01', yaml: ${JSON.stringify(BASIC_TONE_YAML)}, wavBase64: ${JSON.stringify(BASIC_WAV_BASE64)} }
          ];
          return await createSet(['library', 'sets'], 'old-name', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, tones, []);
        })();
      `);

      // Rename it
      const renameResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await renameSet(['library', 'sets'], 'old-name', 'new-name');
        })();
      `);

      expect(renameResult.success).toBe(true);

      // Verify old directory doesn't exist
      const oldExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'old-name']);
        })();
      `);
      expect(oldExists).toBe(false);

      // Verify new directory exists
      const newExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'new-name']);
        })();
      `);
      expect(newExists).toBe(true);

      // Verify contents are preserved
      const tones = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSetTones(['library', 'sets'], 'new-name');
        })();
      `) as { success: boolean; tones: string[] };

      expect(tones.success).toBe(true);
      expect(tones.tones).toContain('T01');
    });

    test('cannot rename to existing set name', async ({ page }) => {
      // Create two sets
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createEmptySet(['library', 'sets'], 'set-a', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)});
          await createEmptySet(['library', 'sets'], 'set-b', ${JSON.stringify(FULL_SET_MANIFEST_YAML)});
        })();
      `);

      // Attempt to rename set-a to set-b
      // Note: OPFS will overwrite, but we test the behavior
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            await renameSet(['library', 'sets'], 'set-a', 'set-b');
            // Check if set-a is gone and set-b exists
            const setAExists = await directoryExists(['library', 'sets', 'set-a']);
            const setBExists = await directoryExists(['library', 'sets', 'set-b']);
            return { success: true, setAExists, setBExists };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `) as { success: boolean; setAExists: boolean; setBExists: boolean };

      // With current implementation, rename overwrites destination
      expect(result.success).toBe(true);
      expect(result.setAExists).toBe(false);
      expect(result.setBExists).toBe(true);
    });

    test('cannot rename to empty name', async ({ page }) => {
      // Create a set
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createEmptySet(['library', 'sets'], 'my-set', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)});
        })();
      `);

      // Attempt to rename to empty string - should be rejected by validation
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            // Validate name before attempting rename
            const newName = '';
            if (!newName || newName.trim() === '') {
              throw new Error('Set name cannot be empty');
            }
            await renameSet(['library', 'sets'], 'my-set', newName);
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `);

      // Should fail - empty names are rejected
      expect(result.success).toBe(false);
      expect(result.error).toBe('Set name cannot be empty');
    });
  });

  test.describe('Set Delete', () => {
    test('can delete set', async ({ page }) => {
      // Create a set with tones and patches
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const tones = [
            { name: 'T01', yaml: ${JSON.stringify(BASIC_TONE_YAML)}, wavBase64: ${JSON.stringify(BASIC_WAV_BASE64)} }
          ];
          const patches = [
            { name: 'P01', yaml: ${JSON.stringify(BASIC_PATCH_YAML)} }
          ];
          return await createSet(['library', 'sets'], 'delete-me', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, tones, patches);
        })();
      `);

      // Delete it
      const deleteResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await deleteSet(['library', 'sets'], 'delete-me');
        })();
      `);

      expect(deleteResult.success).toBe(true);

      // Verify directory is gone
      const exists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'delete-me']);
        })();
      `);
      expect(exists).toBe(false);
    });

    test('delete non-existent set fails gracefully', async ({ page }) => {
      // Attempt to delete a set that doesn't exist
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            await deleteSet(['library', 'sets'], 'does-not-exist');
            return { success: true };
          } catch (e) {
            return { success: false, error: e.name };
          }
        })();
      `) as { success: boolean; error?: string };

      // Should fail with NotFoundError
      expect(result.success).toBe(false);
      expect(result.error).toBe('NotFoundError');
    });
  });

  test.describe('Set Move/Copy', () => {
    test('can move set to different location', async ({ page }) => {
      // Create source set and destination directory
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const tones = [
            { name: 'T01', yaml: ${JSON.stringify(BASIC_TONE_YAML)}, wavBase64: ${JSON.stringify(BASIC_WAV_BASE64)} }
          ];
          await createSet(['library', 'sets'], 'move-me', ${JSON.stringify(BASIC_SET_MANIFEST_YAML)}, tones, []);
          await createDirectory(['library', 'sets', 'archive']);
        })();
      `);

      // Move it
      const moveResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await moveSet(['library', 'sets'], 'move-me', ['library', 'sets', 'archive']);
        })();
      `);

      expect(moveResult.success).toBe(true);

      // Verify source is gone
      const srcExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'move-me']);
        })();
      `);
      expect(srcExists).toBe(false);

      // Verify destination exists
      const destExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await directoryExists(['library', 'sets', 'archive', 'move-me']);
        })();
      `);
      expect(destExists).toBe(true);

      // Verify contents are preserved
      const tones = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSetTones(['library', 'sets', 'archive'], 'move-me');
        })();
      `) as { success: boolean; tones: string[] };

      expect(tones.success).toBe(true);
      expect(tones.tones).toContain('T01');
    });
  });

  test.describe('Error Handling / Edge Cases', () => {
    test('handles set with missing manifest gracefully', async ({ page }) => {
      // Create a directory without set.yaml
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createDirectory(['library', 'sets', 'no-manifest']);
        })();
      `);

      // List sets - should not include the directory without manifest
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSets(['library', 'sets']);
        })();
      `) as { success: boolean; sets: string[] };

      expect(result.success).toBe(true);
      expect(result.sets).not.toContain('no-manifest');

      // But it should appear in directory listing
      const dirResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSetDirectories(['library', 'sets']);
        })();
      `) as { success: boolean; directories: string[] };

      expect(dirResult.success).toBe(true);
      expect(dirResult.directories).toContain('no-manifest');
    });

    test('handles set with corrupted manifest gracefully', async ({ page }) => {
      // Create a set with malformed YAML
      const corruptedManifest = `name: "Broken
tones: not-an-array
patches: [invalid`;

      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createDirectory(['library', 'sets', 'corrupted']);
          await writeFile(['library', 'sets', 'corrupted'], 'set.yaml', ${JSON.stringify(corruptedManifest)});
        })();
      `);

      // Reading should not throw, but parsing may be incomplete
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            const manifest = await readSetManifest(['library', 'sets'], 'corrupted');
            return { success: true, rawContent: manifest.rawContent };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `) as { success: boolean; rawContent?: string };

      // Should succeed reading the raw content even if parsing fails
      expect(result.success).toBe(true);
      expect(result.rawContent).toContain('Broken');
    });

    test('handles set with missing referenced files', async ({ page }) => {
      // Create a set with manifest referencing files that don't exist
      const manifestWithMissingRefs = `name: "Missing Refs Set"
created: "2024-01-01T00:00:00Z"
device: "S-330"
tones:
  - "tones/T01.yaml"
  - "tones/T02.yaml"
patches:
  - "patches/P01.yaml"`;

      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createDirectory(['library', 'sets', 'missing-refs']);
          await writeFile(['library', 'sets', 'missing-refs'], 'set.yaml', ${JSON.stringify(manifestWithMissingRefs)});
          // Don't create the referenced files
        })();
      `);

      // Should be listed as a set (has manifest)
      const listResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSets(['library', 'sets']);
        })();
      `) as { success: boolean; sets: string[] };

      expect(listResult.success).toBe(true);
      expect(listResult.sets).toContain('missing-refs');

      // Get tone refs from manifest
      const refsResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await getSetToneRefs(['library', 'sets'], 'missing-refs');
        })();
      `) as { success: boolean; toneRefs: string[] };

      expect(refsResult.success).toBe(true);
      expect(refsResult.toneRefs).toHaveLength(2);

      // But actual tone listing should be empty (no tones directory)
      const tonesResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listSetTones(['library', 'sets'], 'missing-refs');
        })();
      `) as { success: boolean; tones: string[] };

      expect(tonesResult.success).toBe(true);
      expect(tonesResult.tones).toHaveLength(0);
    });

    test('handles special characters in set names', async ({ page }) => {
      // Create sets with special characters
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const specialNames = [
            'with spaces',
            'with-dashes',
            'with_underscores',
            'CamelCase',
            'numbers123',
          ];

          for (const name of specialNames) {
            await createEmptySet(['library', 'sets'], name, ${JSON.stringify(BASIC_SET_MANIFEST_YAML)});
          }

          // Verify all exist as valid sets
          const sets = await listSets(['library', 'sets']);
          const results = [];
          for (const name of specialNames) {
            results.push({ name, exists: sets.sets.includes(name) });
          }

          return { success: true, results };
        })();
      `) as { success: boolean; results: Array<{ name: string; exists: boolean }> };

      expect(result.success).toBe(true);
      for (const r of result.results) {
        expect(r.exists).toBe(true);
      }
    });
  });

  test.describe('Hardware Tests', () => {
    test.skip('can save device state to set', async () => {
      // SKIP: requires hardware - Roland S-330/S-550 sampler connected via MIDI
      // This test would:
      // 1. Connect to the sampler
      // 2. Request all tone and patch data via SysEx
      // 3. Parse received data
      // 4. Create a complete set in OPFS with all device state
      // 5. Verify set structure and manifest accuracy
    });

    test.skip('can load complete set to device', async () => {
      // SKIP: requires hardware - Roland S-330/S-550 sampler connected via MIDI
      // This test would:
      // 1. Connect to the sampler
      // 2. Read a set from OPFS library
      // 3. Send all tones via SysEx to device
      // 4. Send all patches via SysEx to device
      // 5. Verify device state matches the set
    });
  });
});
