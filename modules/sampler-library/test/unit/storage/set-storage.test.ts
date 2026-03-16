import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import { SetStorage } from '@/storage/set-storage.js';
import * as libraryPaths from '@/storage/library-paths.js';
import type { SetYaml, ToneYaml, PatchYaml } from '@/schemas/index.js';

describe('SetStorage', () => {
  let tempDir: string;
  let storage: SetStorage;

  // Sample set manifest
  const sampleManifest: SetYaml = {
    format: 'sampler-set',
    device: 's330',
    version: 1,
    name: 'TestSet',
    description: 'A test set for unit testing',
    tones: [],
    patches: [],
  };

  // Sample tone YAML
  const sampleTone: ToneYaml = {
    format: 'sampler-tone',
    device: 's330',
    version: 1,
    name: 'TestTone',
    wave: {
      file: 'T01.wav',
      sampleRate: 30000,
      loopMode: 'forward',
      loopPoint: 0,
    },
    s330: {
      originalKey: 60,
      outputAssign: 0,
      transpose: 0,
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

  // Sample PCM data
  const samplePcmData = new Uint8Array(200);

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sampler-library-set-test-'));
    storage = new SetStorage();

    // Mock the library paths to use temp directory
    vi.spyOn(libraryPaths, 'getDeviceLibraryPath').mockImplementation(
      (device) => join(tempDir, device)
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('createSet', () => {
    it('should create set directory structure', async () => {
      await storage.createSet('s330', sampleManifest);

      const setDir = join(tempDir, 's330', 'sets', 'TestSet');
      expect(existsSync(setDir)).toBe(true);
      expect(existsSync(join(setDir, 'tones'))).toBe(true);
      expect(existsSync(join(setDir, 'patches'))).toBe(true);
      expect(existsSync(join(setDir, 'set.yaml'))).toBe(true);
    });

    it('should write valid manifest file', async () => {
      await storage.createSet('s330', sampleManifest);

      const manifestPath = join(tempDir, 's330', 'sets', 'TestSet', 'set.yaml');
      const content = await readFile(manifestPath, 'utf-8');
      const parsed = parseYaml(content);

      expect(parsed.format).toBe('sampler-set');
      expect(parsed.name).toBe('TestSet');
      expect(parsed.description).toBe('A test set for unit testing');
    });

    it('should throw if set already exists', async () => {
      await storage.createSet('s330', sampleManifest);

      await expect(storage.createSet('s330', sampleManifest)).rejects.toThrow(
        'already exists'
      );
    });
  });

  describe('loadSetManifest', () => {
    it('should load existing manifest', async () => {
      await storage.createSet('s330', sampleManifest);

      const loaded = await storage.loadSetManifest('s330', 'TestSet');

      expect(loaded.format).toBe('sampler-set');
      expect(loaded.name).toBe('TestSet');
      expect(loaded.description).toBe('A test set for unit testing');
    });

    it('should throw for non-existent set', async () => {
      await expect(storage.loadSetManifest('s330', 'NonExistent')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('updateSetManifest', () => {
    it('should update manifest with new data', async () => {
      await storage.createSet('s330', sampleManifest);

      const updated: SetYaml = {
        ...sampleManifest,
        description: 'Updated description',
      };

      await storage.updateSetManifest('s330', 'TestSet', updated);

      const loaded = await storage.loadSetManifest('s330', 'TestSet');
      expect(loaded.description).toBe('Updated description');
      expect(loaded.modifiedAt).toBeDefined();
    });
  });

  describe('deleteSet', () => {
    it('should delete set directory', async () => {
      await storage.createSet('s330', sampleManifest);
      const setDir = join(tempDir, 's330', 'sets', 'TestSet');
      expect(existsSync(setDir)).toBe(true);

      await storage.deleteSet('s330', 'TestSet');

      expect(existsSync(setDir)).toBe(false);
    });

    it('should not throw for non-existent set', async () => {
      await expect(storage.deleteSet('s330', 'NonExistent')).resolves.not.toThrow();
    });
  });

  describe('listSets', () => {
    it('should return empty array when no sets exist', async () => {
      const sets = await storage.listSets('s330');
      expect(sets).toEqual([]);
    });

    it('should list all sets', async () => {
      await storage.createSet('s330', { ...sampleManifest, name: 'SetA' });
      await storage.createSet('s330', { ...sampleManifest, name: 'SetB' });

      const sets = await storage.listSets('s330');

      expect(sets).toHaveLength(2);
      expect(sets.map((s) => s.name)).toContain('SetA');
      expect(sets.map((s) => s.name)).toContain('SetB');
    });

    it('should include set info in listing', async () => {
      const manifest: SetYaml = {
        ...sampleManifest,
        tones: [{ slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 2 } }],
        patches: [{ slot: 0, file: 'P01' }],
      };
      await storage.createSet('s330', manifest);

      const sets = await storage.listSets('s330');

      expect(sets[0]?.toneCount).toBe(1);
      expect(sets[0]?.patchCount).toBe(1);
    });
  });

  describe('setExists', () => {
    it('should return false for non-existent set', () => {
      expect(storage.setExists('s330', 'NonExistent')).toBe(false);
    });

    it('should return true for existing set', async () => {
      await storage.createSet('s330', sampleManifest);
      expect(storage.setExists('s330', 'TestSet')).toBe(true);
    });
  });

  describe('saveToneToSet', () => {
    it('should save tone and wave files', async () => {
      await storage.createSet('s330', sampleManifest);

      await storage.saveToneToSet(
        's330',
        'TestSet',
        0,
        sampleTone,
        samplePcmData,
        30000,
        { bank: 0, segmentTop: 0, segmentLength: 2 }
      );

      const tonesDir = join(tempDir, 's330', 'sets', 'TestSet', 'tones');
      expect(existsSync(join(tonesDir, 'T01.yaml'))).toBe(true);
      expect(existsSync(join(tonesDir, 'T01.wav'))).toBe(true);
    });

    it('should update manifest with tone entry', async () => {
      await storage.createSet('s330', sampleManifest);

      await storage.saveToneToSet(
        's330',
        'TestSet',
        0,
        sampleTone,
        samplePcmData,
        30000,
        { bank: 0, segmentTop: 0, segmentLength: 2 }
      );

      const manifest = await storage.loadSetManifest('s330', 'TestSet');
      expect(manifest.tones).toHaveLength(1);
      expect(manifest.tones[0]?.slot).toBe(0);
      expect(manifest.tones[0]?.file).toBe('T01');
    });
  });

  describe('loadToneFromSet', () => {
    it('should load tone with allocation info', async () => {
      await storage.createSet('s330', sampleManifest);
      await storage.saveToneToSet(
        's330',
        'TestSet',
        0,
        sampleTone,
        samplePcmData,
        30000,
        { bank: 0, segmentTop: 0, segmentLength: 2 }
      );

      const result = await storage.loadToneFromSet('s330', 'TestSet', 0);

      expect(result.yaml.name).toBe('TestTone');
      expect(result.allocation.bank).toBe(0);
      expect(result.allocation.segmentLength).toBe(2);
    });

    it('should throw for non-existent tone', async () => {
      await storage.createSet('s330', sampleManifest);

      await expect(storage.loadToneFromSet('s330', 'TestSet', 99)).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('savePatchToSet', () => {
    it('should save patch file', async () => {
      await storage.createSet('s330', sampleManifest);

      await storage.savePatchToSet('s330', 'TestSet', 0, samplePatch);

      const patchPath = join(tempDir, 's330', 'sets', 'TestSet', 'patches', 'P01.yaml');
      expect(existsSync(patchPath)).toBe(true);
    });

    it('should update manifest with patch entry', async () => {
      await storage.createSet('s330', sampleManifest);

      await storage.savePatchToSet('s330', 'TestSet', 0, samplePatch);

      const manifest = await storage.loadSetManifest('s330', 'TestSet');
      expect(manifest.patches).toHaveLength(1);
      expect(manifest.patches[0]?.slot).toBe(0);
    });
  });

  describe('loadPatchFromSet', () => {
    it('should load patch data', async () => {
      await storage.createSet('s330', sampleManifest);
      await storage.savePatchToSet('s330', 'TestSet', 0, samplePatch);

      const result = await storage.loadPatchFromSet('s330', 'TestSet', 0);

      expect(result.name).toBe('TestPatch');
      expect(result.level).toBe(100);
    });

    it('should throw for non-existent patch', async () => {
      await storage.createSet('s330', sampleManifest);

      await expect(storage.loadPatchFromSet('s330', 'TestSet', 99)).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('removeToneFromSet', () => {
    it('should remove tone files and update manifest', async () => {
      await storage.createSet('s330', sampleManifest);
      await storage.saveToneToSet(
        's330',
        'TestSet',
        0,
        sampleTone,
        samplePcmData,
        30000,
        { bank: 0, segmentTop: 0, segmentLength: 2 }
      );

      await storage.removeToneFromSet('s330', 'TestSet', 0);

      const tonesDir = join(tempDir, 's330', 'sets', 'TestSet', 'tones');
      expect(existsSync(join(tonesDir, 'T01.yaml'))).toBe(false);
      expect(existsSync(join(tonesDir, 'T01.wav'))).toBe(false);

      const manifest = await storage.loadSetManifest('s330', 'TestSet');
      expect(manifest.tones).toHaveLength(0);
    });
  });

  describe('removePatchFromSet', () => {
    it('should remove patch file and update manifest', async () => {
      await storage.createSet('s330', sampleManifest);
      await storage.savePatchToSet('s330', 'TestSet', 0, samplePatch);

      await storage.removePatchFromSet('s330', 'TestSet', 0);

      const patchPath = join(tempDir, 's330', 'sets', 'TestSet', 'patches', 'P01.yaml');
      expect(existsSync(patchPath)).toBe(false);

      const manifest = await storage.loadSetManifest('s330', 'TestSet');
      expect(manifest.patches).toHaveLength(0);
    });
  });

  describe('loadSet', () => {
    it('should load complete set data', async () => {
      await storage.createSet('s330', sampleManifest);
      await storage.saveToneToSet(
        's330',
        'TestSet',
        0,
        sampleTone,
        samplePcmData,
        30000,
        { bank: 0, segmentTop: 0, segmentLength: 2 }
      );
      await storage.savePatchToSet('s330', 'TestSet', 0, samplePatch);

      const setData = await storage.loadSet('s330', 'TestSet');

      expect(setData.manifest.name).toBe('TestSet');
      expect(setData.tones.size).toBe(1);
      expect(setData.patches.size).toBe(1);
      expect(setData.tones.get(0)?.yamlPath).toContain('T01.yaml');
      expect(setData.patches.get(0)?.yamlPath).toContain('P01.yaml');
    });
  });
});

describe('set-paths', () => {
  it('should generate correct tone filenames', async () => {
    const { getToneFilename } = await import('@/storage/set-paths.js');

    expect(getToneFilename(0)).toBe('T01');
    expect(getToneFilename(9)).toBe('T10');
    expect(getToneFilename(31)).toBe('T32');
  });

  it('should throw for invalid tone slot', async () => {
    const { getToneFilename } = await import('@/storage/set-paths.js');

    expect(() => getToneFilename(-1)).toThrow();
    expect(() => getToneFilename(64)).toThrow();
  });

  it('should generate correct patch filenames', async () => {
    const { getPatchFilename } = await import('@/storage/set-paths.js');

    expect(getPatchFilename(0)).toBe('P01');
    expect(getPatchFilename(9)).toBe('P10');
    expect(getPatchFilename(15)).toBe('P16');
  });

  it('should parse tone filenames correctly', async () => {
    const { parseToneFilename } = await import('@/storage/set-paths.js');

    expect(parseToneFilename('T01')).toBe(0);
    expect(parseToneFilename('T01.yaml')).toBe(0);
    expect(parseToneFilename('T32')).toBe(31);
    expect(parseToneFilename('invalid')).toBe(null);
    expect(parseToneFilename('T00')).toBe(null);
    expect(parseToneFilename('T33')).toBe(null);
  });

  it('should parse patch filenames correctly', async () => {
    const { parsePatchFilename } = await import('@/storage/set-paths.js');

    expect(parsePatchFilename('P01')).toBe(0);
    expect(parsePatchFilename('P01.yaml')).toBe(0);
    expect(parsePatchFilename('P16')).toBe(15);
    expect(parsePatchFilename('invalid')).toBe(null);
    expect(parsePatchFilename('P00')).toBe(null);
    expect(parsePatchFilename('P17')).toBe(null);
  });
});
