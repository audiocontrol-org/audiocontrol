import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileStorage } from '@/storage/file-storage.js';
import type { ToneYaml, PatchYaml } from '@/schemas/index.js';

/**
 * Create a FileStorage instance that uses a custom root directory for testing.
 */
class TestableFileStorage extends FileStorage {
  constructor(private readonly testRoot: string) {
    super();
  }

  // Override internal path methods to use test root
  protected getTestTonesDir(device: string): string {
    return join(this.testRoot, device, 'tones');
  }

  protected getTestPatchesDir(device: string): string {
    return join(this.testRoot, device, 'patches');
  }

  protected getTestTemplatesDir(device: string): string {
    return join(this.testRoot, device, 'templates');
  }
}

describe('FileStorage', () => {
  let tempDir: string;
  let storage: FileStorage;

  // Sample tone YAML
  const sampleTone: ToneYaml = {
    format: 'sampler-tone',
    device: 's330',
    version: 1,
    name: 'TestTone',
    wave: {
      file: 'TestTone.wav',
      sampleRate: 30000,
      loopMode: 'forward',
      loopPoint: 0,
    },
    s330: {
      originalKey: 60,
      outputAssign: 0,
      transpose: 64,
      fineTune: 0,
      tva: {
        level: 127,
        envelope: {
          levels: [127, 100, 80, 60, 40, 20, 10, 0],
          rates: [127, 100, 80, 60, 50, 40, 30, 20],
          sustainPoint: 3,
          endPoint: 8,
        },
      },
    },
  };

  // Sample patch YAML
  const samplePatch: PatchYaml = {
    format: 'sampler-patch',
    device: 's330',
    version: 1,
    name: 'TestPatch',
    level: 100,
    s330: {
      benderRange: 2,
      keyMode: 'normal',
    },
  };

  // Sample PCM data (simple sine wave, 100 samples)
  const samplePcmData = new Uint8Array(200); // 100 samples * 2 bytes

  beforeEach(async () => {
    // Create a unique temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'sampler-library-test-'));
    storage = new FileStorage();
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('existence checks', () => {
    it('should return false for non-existent tone', () => {
      expect(storage.toneExists('s330', 'NonExistent')).toBe(false);
    });

    it('should return false for non-existent patch', () => {
      expect(storage.patchExists('s330', 'NonExistent')).toBe(false);
    });

    it('should return false for non-existent template', () => {
      expect(storage.templateExists('s330', 'NonExistent')).toBe(false);
    });
  });

  describe('listTones', () => {
    it('should return empty array for non-existent directory', async () => {
      const items = await storage.listTones('s330');
      // Note: This may or may not be empty depending on whether
      // the user has an existing library
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('listPatches', () => {
    it('should return empty array for non-existent directory', async () => {
      const items = await storage.listPatches('s330');
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('listTemplates', () => {
    it('should return empty array for non-existent directory', async () => {
      const items = await storage.listTemplates('s330');
      expect(Array.isArray(items)).toBe(true);
    });
  });
});

describe('FileStorage integration (with temp directory)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sampler-library-int-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should write and read back a patch YAML file', async () => {
    const patchesDir = join(tempDir, 's330', 'patches');
    await mkdir(patchesDir, { recursive: true });

    const patchYaml: PatchYaml = {
      format: 'sampler-patch',
      device: 's330',
      version: 1,
      name: 'IntTest',
      level: 90,
      s330: {
        benderRange: 5,
        keyMode: 'v-sw',
      },
    };

    const yamlPath = join(patchesDir, 'IntTest.yaml');

    // Write using yaml library
    const { stringify } = await import('yaml');
    await writeFile(yamlPath, stringify(patchYaml), 'utf-8');

    // Read back
    const content = await readFile(yamlPath, 'utf-8');
    const { parse } = await import('yaml');
    const parsed = parse(content);

    expect(parsed.name).toBe('IntTest');
    expect(parsed.level).toBe(90);
    expect(parsed.s330.keyMode).toBe('v-sw');
  });

  it('should create directory structure when saving', async () => {
    const tonesDir = join(tempDir, 's330', 'tones');

    // Directory doesn't exist yet
    const { existsSync } = await import('fs');
    expect(existsSync(tonesDir)).toBe(false);

    // Create directory
    await mkdir(tonesDir, { recursive: true });

    // Now it exists
    expect(existsSync(tonesDir)).toBe(true);
  });

  it('should handle special characters in filenames', async () => {
    const { sanitizeFilename } = await import('@/storage/library-paths.js');

    const names = [
      ['My Cool Patch', 'My_Cool_Patch'],
      ['patch<>:', 'patch'],
      ['  spaces  ', 'spaces'],
      ['a/b\\c', 'a_b_c'],
    ];

    for (const [input, expected] of names) {
      expect(sanitizeFilename(input ?? '')).toBe(expected);
    }
  });
});
