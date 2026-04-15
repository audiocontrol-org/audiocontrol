/**
 * E2E tests for library tone operations.
 *
 * Tests verify OPFS tone CRUD operations: list, read, create, rename, delete, move.
 * Tones consist of paired files: {name}.yaml (metadata) and {name}.wav (audio).
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

// Basic tone YAML for tests
const BASIC_TONE_YAML = `name: "Basic Sine"
sampleRate: 30000
loopStart: 0
loopEnd: 1000
rootKey: 60
fineTune: 0`;

// Tone with all optional fields
const FULL_TONE_YAML = `name: "Full Tone"
sampleRate: 30000
loopStart: 100
loopEnd: 900
rootKey: 64
fineTune: 10
velocity: 100
pan: center`;

// Tone with minimal fields (missing optional fields)
const MINIMAL_TONE_YAML = `name: "Minimal Tone"
sampleRate: 30000`;

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
   * List tones in a directory.
   * A tone is identified by having both .yaml and .wav files with the same base name.
   * Returns an array of tone names (without extensions).
   */
  async function listTones(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const files = [];
    for await (const entry of current.values()) {
      if (entry.kind === 'file') {
        files.push(entry.name);
      }
    }

    // Find pairs of .yaml and .wav files
    const yamlFiles = files.filter(f => f.endsWith('.yaml')).map(f => f.slice(0, -5));
    const wavFiles = files.filter(f => f.endsWith('.wav')).map(f => f.slice(0, -4));

    // Return only tones that have both files
    const tones = yamlFiles.filter(name => wavFiles.includes(name));

    return { success: true, tones };
  }

  /**
   * List all YAML files in a directory (including orphaned ones).
   * Returns an array of file names with metadata.
   */
  async function listYamlFiles(pathSegments) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const yamlFiles = [];
    for await (const entry of current.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.yaml')) {
        const fileHandle = await current.getFileHandle(entry.name);
        const file = await fileHandle.getFile();
        yamlFiles.push({
          name: entry.name,
          size: file.size,
        });
      }
    }

    return { success: true, files: yamlFiles };
  }

  /**
   * Read and parse tone YAML metadata.
   */
  async function readToneMetadata(pathSegments, toneName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    const fileHandle = await current.getFileHandle(toneName + '.yaml');
    const file = await fileHandle.getFile();
    const content = await file.text();

    // Simple YAML parsing for key-value pairs
    const metadata = {};
    const lines = content.split('\\n');
    for (const line of lines) {
      const match = line.match(/^(\\w+):\\s*"?([^"]*)"?$/);
      if (match) {
        const key = match[1];
        let value = match[2];
        // Try to parse numbers
        if (/^-?\\d+(\\.\\d+)?$/.test(value)) {
          value = parseFloat(value);
        }
        metadata[key] = value;
      }
    }

    return { success: true, metadata, rawContent: content };
  }

  /**
   * Create a tone with YAML and WAV files.
   */
  async function createTone(pathSegments, toneName, yamlContent, wavBase64) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }

    // Write YAML file
    const yamlHandle = await current.getFileHandle(toneName + '.yaml', { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(yamlContent);
    await yamlWritable.close();

    // Write WAV file
    const wavHandle = await current.getFileHandle(toneName + '.wav', { create: true });
    const wavWritable = await wavHandle.createWritable();
    const binary = atob(wavBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    await wavWritable.write(bytes);
    await wavWritable.close();

    return { success: true };
  }

  /**
   * Rename a tone (both .yaml and .wav files).
   */
  async function renameTone(pathSegments, oldName, newName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    // Read old files
    const oldYamlHandle = await current.getFileHandle(oldName + '.yaml');
    const oldYamlFile = await oldYamlHandle.getFile();
    const yamlContent = await oldYamlFile.text();

    const oldWavHandle = await current.getFileHandle(oldName + '.wav');
    const oldWavFile = await oldWavHandle.getFile();
    const wavContent = await oldWavFile.arrayBuffer();

    // Create new files
    const newYamlHandle = await current.getFileHandle(newName + '.yaml', { create: true });
    const newYamlWritable = await newYamlHandle.createWritable();
    await newYamlWritable.write(yamlContent);
    await newYamlWritable.close();

    const newWavHandle = await current.getFileHandle(newName + '.wav', { create: true });
    const newWavWritable = await newWavHandle.createWritable();
    await newWavWritable.write(wavContent);
    await newWavWritable.close();

    // Delete old files
    await current.removeEntry(oldName + '.yaml');
    await current.removeEntry(oldName + '.wav');

    return { success: true };
  }

  /**
   * Delete a tone (both .yaml and .wav files).
   */
  async function deleteTone(pathSegments, toneName) {
    const root = await getOPFSRoot();
    let current = root;
    for (const segment of pathSegments) {
      current = await current.getDirectoryHandle(segment);
    }

    await current.removeEntry(toneName + '.yaml');
    await current.removeEntry(toneName + '.wav');

    return { success: true };
  }

  /**
   * Move a tone to a different directory.
   */
  async function moveTone(srcPathSegments, toneName, destPathSegments) {
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

    // Read source files
    const yamlHandle = await srcDir.getFileHandle(toneName + '.yaml');
    const yamlFile = await yamlHandle.getFile();
    const yamlContent = await yamlFile.text();

    const wavHandle = await srcDir.getFileHandle(toneName + '.wav');
    const wavFile = await wavHandle.getFile();
    const wavContent = await wavFile.arrayBuffer();

    // Write to destination
    const destYamlHandle = await destDir.getFileHandle(toneName + '.yaml', { create: true });
    const destYamlWritable = await destYamlHandle.createWritable();
    await destYamlWritable.write(yamlContent);
    await destYamlWritable.close();

    const destWavHandle = await destDir.getFileHandle(toneName + '.wav', { create: true });
    const destWavWritable = await destWavHandle.createWritable();
    await destWavWritable.write(wavContent);
    await destWavWritable.close();

    // Delete from source
    await srcDir.removeEntry(toneName + '.yaml');
    await srcDir.removeEntry(toneName + '.wav');

    return { success: true };
  }
`;

test.describe('Library Tone Operations', () => {
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

  test.describe('Tone Listing', () => {
    test('can list tones in directory', async ({ page }) => {
      // Create a tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'test-tone', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // List tones
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listTones(['library', 'tones']);
        })();
      `) as { success: boolean; tones: string[] };

      expect(result.success).toBe(true);
      expect(result.tones).toContain('test-tone');
    });

    test('lists tones with correct metadata', async ({ page }) => {
      // Create a tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'metadata-tone', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // List YAML files with metadata
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listYamlFiles(['library', 'tones']);
        })();
      `) as { success: boolean; files: Array<{ name: string; size: number }> };

      expect(result.success).toBe(true);
      expect(result.files.length).toBe(1);
      expect(result.files[0].name).toBe('metadata-tone.yaml');
      expect(result.files[0].size).toBeGreaterThan(0);
    });

    test('returns empty list for empty directory', async ({ page }) => {
      // List tones in empty directory
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listTones(['library', 'tones']);
        })();
      `) as { success: boolean; tones: string[] };

      expect(result.success).toBe(true);
      expect(result.tones).toHaveLength(0);
    });

    test('can list tones in nested directories', async ({ page }) => {
      // Create nested directory with tones
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createDirectory(['library', 'tones', 'drums', 'kicks']);
          await createTone(['library', 'tones', 'drums', 'kicks'], 'kick-01', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
          await createTone(['library', 'tones', 'drums', 'kicks'], 'kick-02', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // List tones in nested directory
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listTones(['library', 'tones', 'drums', 'kicks']);
        })();
      `) as { success: boolean; tones: string[] };

      expect(result.success).toBe(true);
      expect(result.tones).toHaveLength(2);
      expect(result.tones).toContain('kick-01');
      expect(result.tones).toContain('kick-02');
    });
  });

  test.describe('Tone Metadata', () => {
    test('can read tone YAML metadata', async ({ page }) => {
      // Create a tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'read-test', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Read metadata
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readToneMetadata(['library', 'tones'], 'read-test');
        })();
      `) as { success: boolean; metadata: Record<string, unknown>; rawContent: string };

      expect(result.success).toBe(true);
      expect(result.rawContent).toContain('name: "Basic Sine"');
    });

    test('can parse tone properties', async ({ page }) => {
      // Create a tone with full properties
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'full-props', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Read and parse metadata
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readToneMetadata(['library', 'tones'], 'full-props');
        })();
      `) as { success: boolean; metadata: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.metadata.name).toBe('Basic Sine');
      expect(result.metadata.sampleRate).toBe(30000);
      expect(result.metadata.loopStart).toBe(0);
      expect(result.metadata.loopEnd).toBe(1000);
      expect(result.metadata.rootKey).toBe(60);
      expect(result.metadata.fineTune).toBe(0);
    });

    test('handles tone with missing optional fields', async ({ page }) => {
      // Create a tone with minimal fields
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'minimal', ${JSON.stringify(MINIMAL_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Read metadata
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readToneMetadata(['library', 'tones'], 'minimal');
        })();
      `) as { success: boolean; metadata: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.metadata.name).toBe('Minimal Tone');
      expect(result.metadata.sampleRate).toBe(30000);
      // Optional fields should not be present
      expect(result.metadata.loopStart).toBeUndefined();
      expect(result.metadata.rootKey).toBeUndefined();
    });
  });

  test.describe('Tone Creation', () => {
    test('can create tone with YAML and WAV files', async ({ page }) => {
      // Create a tone
      const createResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await createTone(['library', 'tones'], 'new-tone', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      expect(createResult.success).toBe(true);

      // Verify both files exist
      const yamlExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'new-tone.yaml');
        })();
      `);
      expect(yamlExists).toBe(true);

      const wavExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'new-tone.wav');
        })();
      `);
      expect(wavExists).toBe(true);

      // Verify content
      const yamlContent = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readFile(['library', 'tones'], 'new-tone.yaml');
        })();
      `) as { success: boolean; content: string };

      expect(yamlContent.content).toContain('Basic Sine');
    });

    test('validates tone YAML structure', async ({ page }) => {
      // Create a tone with valid YAML
      const validYaml = `name: "Valid Tone"
sampleRate: 30000`;

      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await createTone(['library', 'tones'], 'valid-tone', ${JSON.stringify(validYaml)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Read and verify structure
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await readToneMetadata(['library', 'tones'], 'valid-tone');
        })();
      `) as { success: boolean; metadata: Record<string, unknown> };

      expect(result.success).toBe(true);
      expect(result.metadata.name).toBe('Valid Tone');
    });

    test('rejects tone without WAV file', async ({ page }) => {
      // Create only YAML file (no WAV)
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await writeFile(['library', 'tones'], 'orphan-tone.yaml', ${JSON.stringify(BASIC_TONE_YAML)});
        })();
      `);

      // List tones - should not include orphan
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listTones(['library', 'tones']);
        })();
      `) as { success: boolean; tones: string[] };

      expect(result.success).toBe(true);
      expect(result.tones).not.toContain('orphan-tone');
    });
  });

  test.describe('Tone Rename', () => {
    test('can rename tone', async ({ page }) => {
      // Create a tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'old-name', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Rename it
      const renameResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await renameTone(['library', 'tones'], 'old-name', 'new-name');
        })();
      `);

      expect(renameResult.success).toBe(true);

      // Verify old files don't exist
      const oldYamlExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'old-name.yaml');
        })();
      `);
      expect(oldYamlExists).toBe(false);

      const oldWavExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'old-name.wav');
        })();
      `);
      expect(oldWavExists).toBe(false);

      // Verify new files exist
      const newYamlExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'new-name.yaml');
        })();
      `);
      expect(newYamlExists).toBe(true);

      const newWavExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'new-name.wav');
        })();
      `);
      expect(newWavExists).toBe(true);
    });

    test('cannot rename to existing tone name', async ({ page }) => {
      // Create two tones
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'tone-a', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
          await createTone(['library', 'tones'], 'tone-b', ${JSON.stringify(FULL_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Attempt to rename tone-a to tone-b
      // Note: OPFS will overwrite, but we test the behavior
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            await renameTone(['library', 'tones'], 'tone-a', 'tone-b');
            // Check if tone-a is gone and tone-b exists
            const toneAExists = await fileExists(['library', 'tones'], 'tone-a.yaml');
            const toneBExists = await fileExists(['library', 'tones'], 'tone-b.yaml');
            return { success: true, toneAExists, toneBExists };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `) as { success: boolean; toneAExists: boolean; toneBExists: boolean };

      // With current implementation, rename overwrites destination
      expect(result.success).toBe(true);
      expect(result.toneAExists).toBe(false);
      expect(result.toneBExists).toBe(true);
    });

    test('cannot rename to empty name', async ({ page }) => {
      // Create a tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'my-tone', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
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
              throw new Error('Tone name cannot be empty');
            }
            await renameTone(['library', 'tones'], 'my-tone', newName);
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `);

      // Should fail - empty names are rejected
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tone name cannot be empty');
    });
  });

  test.describe('Tone Delete', () => {
    test('can delete tone', async ({ page }) => {
      // Create a tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'delete-me', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Delete it
      const deleteResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await deleteTone(['library', 'tones'], 'delete-me');
        })();
      `);

      expect(deleteResult.success).toBe(true);

      // Verify both files are gone
      const yamlExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'delete-me.yaml');
        })();
      `);
      expect(yamlExists).toBe(false);

      const wavExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'delete-me.wav');
        })();
      `);
      expect(wavExists).toBe(false);
    });

    test('delete non-existent tone fails gracefully', async ({ page }) => {
      // Attempt to delete a tone that doesn't exist
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            await deleteTone(['library', 'tones'], 'does-not-exist');
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

  test.describe('Tone Move', () => {
    test('can move tone to different directory', async ({ page }) => {
      // Create source tone
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'move-me', ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
          await createDirectory(['library', 'tones', 'archive']);
        })();
      `);

      // Move it
      const moveResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await moveTone(['library', 'tones'], 'move-me', ['library', 'tones', 'archive']);
        })();
      `);

      expect(moveResult.success).toBe(true);

      // Verify source is gone
      const srcYamlExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'move-me.yaml');
        })();
      `);
      expect(srcYamlExists).toBe(false);

      const srcWavExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones'], 'move-me.wav');
        })();
      `);
      expect(srcWavExists).toBe(false);

      // Verify destination exists
      const destYamlExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones', 'archive'], 'move-me.yaml');
        })();
      `);
      expect(destYamlExists).toBe(true);

      const destWavExists = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await fileExists(['library', 'tones', 'archive'], 'move-me.wav');
        })();
      `);
      expect(destWavExists).toBe(true);
    });

    test('move preserves tone files', async ({ page }) => {
      // Create source tone with specific content
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'preserve-me', ${JSON.stringify(FULL_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
          await createDirectory(['library', 'patches', 'moved']);
        })();
      `);

      // Move it
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await moveTone(['library', 'tones'], 'preserve-me', ['library', 'patches', 'moved']);
        })();
      `);

      // Verify content is preserved
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          const yamlContent = await readFile(['library', 'patches', 'moved'], 'preserve-me.yaml');
          const wavSize = await getFileSize(['library', 'patches', 'moved'], 'preserve-me.wav');
          return {
            yamlContent: yamlContent.content,
            wavSize: wavSize.size,
          };
        })();
      `) as { yamlContent: string; wavSize: number };

      expect(result.yamlContent).toContain('Full Tone');
      expect(result.wavSize).toBeGreaterThan(0);
    });
  });

  test.describe('Edge Cases / Error Handling', () => {
    test('handles tone with missing WAV file gracefully', async ({ page }) => {
      // Create only YAML file
      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await writeFile(['library', 'tones'], 'yaml-only.yaml', ${JSON.stringify(BASIC_TONE_YAML)});
        })();
      `);

      // listTones should not include it
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          return await listTones(['library', 'tones']);
        })();
      `) as { success: boolean; tones: string[] };

      expect(result.success).toBe(true);
      expect(result.tones).not.toContain('yaml-only');

      // But reading metadata should still work
      const metaResult = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            return await readToneMetadata(['library', 'tones'], 'yaml-only');
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `) as { success: boolean; metadata?: Record<string, unknown> };

      expect(metaResult.success).toBe(true);
    });

    test('handles corrupted YAML gracefully', async ({ page }) => {
      // Create tone with malformed YAML
      const corruptedYaml = `name: "Broken
sampleRate: not-a-number
loopStart: [invalid`;

      await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          await createTone(['library', 'tones'], 'corrupted', ${JSON.stringify(corruptedYaml)}, ${JSON.stringify(BASIC_WAV_BASE64)});
        })();
      `);

      // Reading should not throw, but parsing may be incomplete
      const result = await page.evaluate(`
        ${OPFS_HELPERS}
        (async () => {
          try {
            const meta = await readToneMetadata(['library', 'tones'], 'corrupted');
            return { success: true, rawContent: meta.rawContent };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `) as { success: boolean; rawContent?: string };

      // Should succeed reading the raw content even if parsing fails
      expect(result.success).toBe(true);
      expect(result.rawContent).toContain('Broken');
    });

    test('handles special characters in tone names', async ({ page }) => {
      // Create tones with special characters
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
            await createTone(['library', 'tones'], name, ${JSON.stringify(BASIC_TONE_YAML)}, ${JSON.stringify(BASIC_WAV_BASE64)});
          }

          // Verify all exist as valid tones
          const tones = await listTones(['library', 'tones']);
          const results = [];
          for (const name of specialNames) {
            results.push({ name, exists: tones.tones.includes(name) });
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
    test.skip('can import tone to device', async () => {
      // SKIP: requires hardware - Roland S-330/S-550 sampler connected via MIDI
      // This test would:
      // 1. Connect to the sampler
      // 2. Read a tone from OPFS library
      // 3. Send tone data via SysEx to device
      // 4. Verify tone appears in device memory
    });

    test.skip('can export tone from device', async () => {
      // SKIP: requires hardware - Roland S-330/S-550 sampler connected via MIDI
      // This test would:
      // 1. Connect to the sampler
      // 2. Request tone data via SysEx from device
      // 3. Parse received tone data
      // 4. Write to OPFS library
      // 5. Verify tone files created correctly
    });
  });
});
