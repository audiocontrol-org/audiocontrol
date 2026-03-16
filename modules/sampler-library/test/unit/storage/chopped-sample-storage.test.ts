import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { ChoppedSampleStorage } from '@/storage/chopped-sample-storage.js';
import * as libraryPaths from '@/storage/library-paths.js';
import type { GenericChoppedSample, DrumKitChoppedSample } from '@/schemas/chopped-sample-schema.js';

describe('ChoppedSampleStorage', () => {
  let tempDir: string;
  let storage: ChoppedSampleStorage;

  const genericManifest: GenericChoppedSample = {
    format: 'chopped-sample',
    version: 1,
    variant: 'generic',
    name: 'TestSample',
    source: 'source.wav',
    sampleRate: 44100,
    slices: [
      { label: 'hit-1', startSample: 0, endSample: 22050 },
      { label: 'hit-2', startSample: 22050, endSample: 44100 },
    ],
  };

  const drumKitManifest: DrumKitChoppedSample = {
    format: 'chopped-sample',
    version: 1,
    variant: 'drum-kit',
    name: 'TestKit',
    source: 'source.wav',
    sampleRate: 30000,
    slices: [
      { label: 'kick', startSample: 0, endSample: 15000 },
      { label: 'snare', startSample: 15000, endSample: 30000 },
    ],
    drumKit: {
      baseNote: 'C2',
      transpose: 0,
      velocitySensitivity: 2,
    },
  };

  const samplePcmData = new Uint8Array(100);

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'chopped-sample-test-'));
    vi.spyOn(libraryPaths, 'getLibraryRoot').mockReturnValue(tempDir);
    storage = new ChoppedSampleStorage();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('should save a generic chopped sample', async () => {
      await storage.save(genericManifest, samplePcmData);

      expect(storage.exists('TestSample')).toBe(true);

      const sampleDir = join(tempDir, 'chopped-samples', 'TestSample');
      expect(existsSync(join(sampleDir, 'manifest.yaml'))).toBe(true);
      expect(existsSync(join(sampleDir, 'source.wav'))).toBe(true);
    });

    it('should save a drum-kit chopped sample', async () => {
      await storage.save(drumKitManifest, samplePcmData);

      expect(storage.exists('TestKit')).toBe(true);
    });

    it('should set timestamps on save', async () => {
      await storage.save(genericManifest, samplePcmData);

      const { manifest } = await storage.load('TestSample');
      expect(manifest.createdAt).toBeDefined();
      expect(manifest.modifiedAt).toBeDefined();
    });

    it('should throw if sample already exists', async () => {
      await storage.save(genericManifest, samplePcmData);
      await expect(storage.save(genericManifest, samplePcmData)).rejects.toThrow(
        'already exists'
      );
    });

    it('should write a valid WAV file', async () => {
      await storage.save(genericManifest, samplePcmData);

      const wavPath = join(tempDir, 'chopped-samples', 'TestSample', 'source.wav');
      const wavData = await readFile(wavPath);

      // Check RIFF header
      expect(String.fromCharCode(...wavData.slice(0, 4))).toBe('RIFF');
      expect(String.fromCharCode(...wavData.slice(8, 12))).toBe('WAVE');
    });

    it('should reject invalid manifest', async () => {
      const invalid = { ...genericManifest, format: 'wrong' as 'chopped-sample' };
      await expect(storage.save(invalid, samplePcmData)).rejects.toThrow('Invalid');
    });
  });

  describe('load', () => {
    it('should load a saved generic sample', async () => {
      await storage.save(genericManifest, samplePcmData);

      const { manifest, sourcePath } = await storage.load('TestSample');
      expect(manifest.variant).toBe('generic');
      expect(manifest.name).toBe('TestSample');
      expect(manifest.slices).toHaveLength(2);
      expect(sourcePath).toContain('source.wav');
    });

    it('should load a saved drum-kit sample', async () => {
      await storage.save(drumKitManifest, samplePcmData);

      const { manifest } = await storage.load('TestKit');
      expect(manifest.variant).toBe('drum-kit');
      if (manifest.variant === 'drum-kit') {
        expect(manifest.drumKit.baseNote).toBe('C2');
      }
    });

    it('should throw for non-existent sample', async () => {
      await expect(storage.load('NonExistent')).rejects.toThrow('not found');
    });
  });

  describe('list', () => {
    it('should return empty array when no samples exist', async () => {
      const result = await storage.list();
      expect(result).toEqual([]);
    });

    it('should list saved samples sorted by name', async () => {
      await storage.save(genericManifest, samplePcmData);
      await storage.save(drumKitManifest, samplePcmData);

      const result = await storage.list();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('TestKit');
      expect(result[0].variant).toBe('drum-kit');
      expect(result[0].sliceCount).toBe(2);
      expect(result[1].name).toBe('TestSample');
      expect(result[1].variant).toBe('generic');
    });
  });

  describe('update', () => {
    it('should update manifest without replacing WAV', async () => {
      await storage.save(genericManifest, samplePcmData);

      const updated: GenericChoppedSample = {
        ...genericManifest,
        description: 'Updated description',
      };

      await storage.update('TestSample', updated);

      const { manifest } = await storage.load('TestSample');
      expect(manifest.description).toBe('Updated description');
      expect(manifest.modifiedAt).toBeDefined();
    });

    it('should throw for non-existent sample', async () => {
      await expect(storage.update('NonExistent', genericManifest)).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('delete', () => {
    it('should delete a saved sample', async () => {
      await storage.save(genericManifest, samplePcmData);
      expect(storage.exists('TestSample')).toBe(true);

      await storage.delete('TestSample');
      expect(storage.exists('TestSample')).toBe(false);
    });

    it('should not throw when deleting non-existent sample', async () => {
      await expect(storage.delete('NonExistent')).resolves.not.toThrow();
    });
  });

  describe('exists', () => {
    it('should return false for non-existent sample', () => {
      expect(storage.exists('NonExistent')).toBe(false);
    });

    it('should return true for existing sample', async () => {
      await storage.save(genericManifest, samplePcmData);
      expect(storage.exists('TestSample')).toBe(true);
    });
  });

  describe('round-trip', () => {
    it('should round-trip: save → list → load → update → delete', async () => {
      // Save
      await storage.save(genericManifest, samplePcmData);

      // List
      const listed = await storage.list();
      expect(listed).toHaveLength(1);
      expect(listed[0].name).toBe('TestSample');

      // Load
      const { manifest } = await storage.load('TestSample');
      expect(manifest.slices).toHaveLength(2);

      // Update
      const updated: GenericChoppedSample = {
        ...manifest,
        variant: 'generic',
        description: 'Round-trip test',
      };
      await storage.update('TestSample', updated);
      const { manifest: reloaded } = await storage.load('TestSample');
      expect(reloaded.description).toBe('Round-trip test');

      // Delete
      await storage.delete('TestSample');
      expect(storage.exists('TestSample')).toBe(false);
      const afterDelete = await storage.list();
      expect(afterDelete).toHaveLength(0);
    });
  });
});
