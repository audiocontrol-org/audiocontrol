/**
 * Drum kit parser unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  parseDrumFilename,
  parseDrumKitDirectory,
  resolveMidiNotes,
  midiNoteToName,
  loadDrumKitBundle,
} from '@/drum-kits/drum-kit-parser.js';
import type { DrumKitBundle } from '@/schemas/drum-kit-bundle-schema.js';

describe('parseDrumFilename', () => {
  describe('preferred format: number first', () => {
    it('should parse "01 KICK.wav"', () => {
      const result = parseDrumFilename('01 KICK.wav');
      expect(result).toEqual({
        type: 'kick',
        kitNumber: 1,
        filename: '01 KICK.wav',
      });
    });

    it('should parse "02_SNARE.wav"', () => {
      const result = parseDrumFilename('02_SNARE.wav');
      expect(result).toEqual({
        type: 'snare',
        kitNumber: 2,
        filename: '02_SNARE.wav',
      });
    });

    it('should parse "03-HHC.wav"', () => {
      const result = parseDrumFilename('03-HHC.wav');
      expect(result).toEqual({
        type: 'hhClosed',
        kitNumber: 3,
        filename: '03-HHC.wav',
      });
    });

    it('should parse "04HHO.wav" (no separator)', () => {
      const result = parseDrumFilename('04HHO.wav');
      expect(result).toEqual({
        type: 'hhOpen',
        kitNumber: 4,
        filename: '04HHO.wav',
      });
    });
  });

  describe('legacy format: name first', () => {
    it('should parse "KICK 01.wav"', () => {
      const result = parseDrumFilename('KICK 01.wav');
      expect(result).toEqual({
        type: 'kick',
        kitNumber: 1,
        filename: 'KICK 01.wav',
      });
    });

    it('should parse "SNARE_02.wav"', () => {
      const result = parseDrumFilename('SNARE_02.wav');
      expect(result).toEqual({
        type: 'snare',
        kitNumber: 2,
        filename: 'SNARE_02.wav',
      });
    });

    it('should parse "HHC-03.wav"', () => {
      const result = parseDrumFilename('HHC-03.wav');
      expect(result).toEqual({
        type: 'hhClosed',
        kitNumber: 3,
        filename: 'HHC-03.wav',
      });
    });

    it('should parse "HHO04.wav" (no separator)', () => {
      const result = parseDrumFilename('HHO04.wav');
      expect(result).toEqual({
        type: 'hhOpen',
        kitNumber: 4,
        filename: 'HHO04.wav',
      });
    });
  });

  describe('case insensitivity', () => {
    it('should parse lowercase "01 kick.wav"', () => {
      const result = parseDrumFilename('01 kick.wav');
      expect(result).toEqual({
        type: 'kick',
        kitNumber: 1,
        filename: '01 kick.wav',
      });
    });

    it('should parse mixed case "01 Snare.wav"', () => {
      const result = parseDrumFilename('01 Snare.wav');
      expect(result).toEqual({
        type: 'snare',
        kitNumber: 1,
        filename: '01 Snare.wav',
      });
    });
  });

  describe('unrecognized filenames', () => {
    it('should return null for "random.wav"', () => {
      expect(parseDrumFilename('random.wav')).toBeNull();
    });

    it('should return null for "tom 01.wav"', () => {
      expect(parseDrumFilename('tom 01.wav')).toBeNull();
    });
  });
});

describe('parseDrumKitDirectory', () => {
  it('should group samples by kit number (number-first format)', () => {
    const files = [
      '01 KICK.wav',
      '01 SNARE.wav',
      '01 HHC.wav',
      '01 HHO.wav',
      '02 KICK.wav',
      '02 SNARE.wav',
    ];

    const kits = parseDrumKitDirectory(files, 36);

    expect(kits).toHaveLength(2);

    expect(kits[0]).toMatchObject({
      kitNumber: 1,
      samples: {
        kick: '01 KICK.wav',
        snare: '01 SNARE.wav',
        hhClosed: '01 HHC.wav',
        hhOpen: '01 HHO.wav',
      },
      isComplete: true,
    });

    expect(kits[1]).toMatchObject({
      kitNumber: 2,
      samples: {
        kick: '02 KICK.wav',
        snare: '02 SNARE.wav',
      },
      isComplete: false,
    });
  });

  it('should group samples by kit number (name-first format)', () => {
    const files = [
      'KICK 01.wav',
      'SNARE 01.wav',
      'HHC 01.wav',
      'HHO 01.wav',
    ];

    const kits = parseDrumKitDirectory(files, 36);

    expect(kits).toHaveLength(1);
    expect(kits[0]).toMatchObject({
      kitNumber: 1,
      samples: {
        kick: 'KICK 01.wav',
        snare: 'SNARE 01.wav',
        hhClosed: 'HHC 01.wav',
        hhOpen: 'HHO 01.wav',
      },
      isComplete: true,
    });
  });
});

describe('resolveMidiNotes', () => {
  it('should return correct MIDI notes for first kit', () => {
    const notes = resolveMidiNotes(36, 0);
    expect(notes).toEqual({
      kick: 36,
      snare: 37,
      hhClosed: 38,
      hhOpen: 39,
    });
  });

  it('should return correct MIDI notes for second kit', () => {
    const notes = resolveMidiNotes(36, 1);
    expect(notes).toEqual({
      kick: 40,
      snare: 41,
      hhClosed: 42,
      hhOpen: 43,
    });
  });
});

describe('midiNoteToName', () => {
  it('should convert C2 (36) correctly', () => {
    expect(midiNoteToName(36)).toBe('C2');
  });

  it('should convert middle C (60) correctly', () => {
    expect(midiNoteToName(60)).toBe('C4');
  });

  it('should convert F#3 (54) correctly', () => {
    expect(midiNoteToName(54)).toBe('F#3');
  });
});

describe('loadDrumKitBundle', () => {
  describe('version 1 format (individual WAV files)', () => {
    it('should auto-detect kits from filenames when no YAML provided', () => {
      const files = [
        '01 KICK.wav',
        '01 SNARE.wav',
        '01 HHC.wav',
        '01 HHO.wav',
      ];

      const bundle = loadDrumKitBundle(null, files, 'MY-KIT');

      expect(bundle.name).toBe('MY-KIT');
      expect(bundle.sampleRate).toBe(15000);
      expect(bundle.baseNote).toBe(36); // C2
      expect(bundle.kits).toHaveLength(1);
      expect(bundle.source).toBeUndefined();
      expect(bundle.slices).toBeUndefined();
    });

    it('should use YAML configuration when provided', () => {
      const yaml: DrumKitBundle = {
        format: 'drum-kit-bundle',
        version: 1,
        name: 'CUSTOM-KIT',
        sampleRate: 30000,
        baseNote: 48,
        transpose: -12,
      };

      const files = ['01 KICK.wav', '01 SNARE.wav'];

      const bundle = loadDrumKitBundle(yaml, files, 'dir-name');

      expect(bundle.name).toBe('CUSTOM-KIT');
      expect(bundle.sampleRate).toBe(30000);
      expect(bundle.baseNote).toBe(48);
      expect(bundle.transpose).toBe(-12);
    });
  });

  describe('version 2 format (source + slices)', () => {
    it('should parse v2 format with source and slices', () => {
      const yaml: DrumKitBundle = {
        format: 'drum-kit-bundle',
        version: 2,
        name: 'CHOPPED-KIT',
        sampleRate: 15000,
        baseNote: 36,
        transpose: -24,
        source: 'source.wav',
        slices: [
          { label: 'kick', startSample: 0, endSample: 1000 },
          { label: 'snare', startSample: 1500, endSample: 2500 },
          { label: 'hhc', startSample: 3000, endSample: 3800 },
          { label: 'hho', startSample: 4000, endSample: 5000 },
        ],
      };

      const files = ['source.wav'];

      const bundle = loadDrumKitBundle(yaml, files, 'chopped');

      expect(bundle.name).toBe('CHOPPED-KIT');
      expect(bundle.sampleRate).toBe(15000);
      expect(bundle.transpose).toBe(-24);
      expect(bundle.source).toBe('source.wav');
      expect(bundle.slices).toHaveLength(4);
      expect(bundle.slices![0]).toEqual({
        label: 'kick',
        startSample: 0,
        endSample: 1000,
      });
    });

    it('should build kits from slices for backward compatibility', () => {
      const yaml: DrumKitBundle = {
        format: 'drum-kit-bundle',
        version: 2,
        name: 'CHOPPED-KIT',
        sampleRate: 15000,
        baseNote: 36,
        source: 'source.wav',
        slices: [
          { label: 'kick', startSample: 0, endSample: 1000 },
          { label: 'snare', startSample: 1500, endSample: 2500 },
          { label: 'hhc', startSample: 3000, endSample: 3800 },
          { label: 'hho', startSample: 4000, endSample: 5000 },
        ],
      };

      const bundle = loadDrumKitBundle(yaml, ['source.wav'], 'chopped');

      // Should create one kit from 4 slices
      expect(bundle.kits).toHaveLength(1);
      expect(bundle.kits[0]?.kitNumber).toBe(1);
      expect(bundle.kits[0]?.isComplete).toBe(true);
      expect(bundle.kits[0]?.midiNotes).toEqual({
        kick: 36,
        snare: 37,
        hhClosed: 38,
        hhOpen: 39,
      });
    });

    it('should create multiple kits from 8 slices', () => {
      const yaml: DrumKitBundle = {
        format: 'drum-kit-bundle',
        version: 2,
        name: 'MULTI-KIT',
        sampleRate: 15000,
        baseNote: 36,
        source: 'source.wav',
        slices: [
          { label: 'kick', startSample: 0, endSample: 1000 },
          { label: 'snare', startSample: 1500, endSample: 2500 },
          { label: 'hhc', startSample: 3000, endSample: 3800 },
          { label: 'hho', startSample: 4000, endSample: 5000 },
          { label: 'kick', startSample: 6000, endSample: 7000 },
          { label: 'snare', startSample: 7500, endSample: 8500 },
          { label: 'hhc', startSample: 9000, endSample: 9800 },
          { label: 'hho', startSample: 10000, endSample: 11000 },
        ],
      };

      const bundle = loadDrumKitBundle(yaml, ['source.wav'], 'multi');

      expect(bundle.kits).toHaveLength(2);
      expect(bundle.kits[0]?.kitNumber).toBe(1);
      expect(bundle.kits[1]?.kitNumber).toBe(2);
      expect(bundle.totalSamples).toBe(8);
    });

    it('should report correct totalSamples from slices', () => {
      const yaml: DrumKitBundle = {
        format: 'drum-kit-bundle',
        version: 2,
        name: 'TEST-KIT',
        sampleRate: 15000,
        baseNote: 36,
        source: 'source.wav',
        slices: [
          { label: 'kick', startSample: 0, endSample: 1000 },
          { label: 'snare', startSample: 1500, endSample: 2500 },
          { label: 'hhc', startSample: 3000, endSample: 3800 },
        ],
      };

      const bundle = loadDrumKitBundle(yaml, ['source.wav'], 'test');

      expect(bundle.totalSamples).toBe(3); // 3 slices
      expect(bundle.kits[0]?.isComplete).toBe(false); // Only 3 samples
    });
  });
});
