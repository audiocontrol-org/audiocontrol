/**
 * Tests for chopped-sample to sample+program migration converter.
 */

import { describe, it, expect } from 'vitest';

import { migrateChoppedSample } from '@/converters/chopped-sample-migration.js';
import { SampleYamlSchema } from '@/schemas/sample-schema.js';
import { ProgramYamlSchema } from '@/schemas/program-schema.js';
import type { ChoppedSample } from '@/schemas/chopped-sample-schema.js';

/** Helper to build a minimal generic chopped sample. */
function makeGenericChopped(overrides: Partial<ChoppedSample> = {}): ChoppedSample {
  return {
    format: 'chopped-sample',
    version: 1,
    variant: 'generic',
    name: 'test-sample',
    source: 'test.wav',
    sampleRate: 44100,
    slices: [
      { label: 'slice-a', startSample: 0, endSample: 10000 },
      { label: 'slice-b', startSample: 10000, endSample: 20000 },
      { label: 'slice-c', startSample: 20000, endSample: 30000 },
    ],
    description: 'A test chopped sample',
    createdAt: '2026-01-15T10:00:00Z',
    modifiedAt: '2026-03-18T12:00:00Z',
    ...overrides,
  } as ChoppedSample;
}

/** Helper to build a drum-kit chopped sample. */
function makeDrumKitChopped(
  baseNote: string | number,
  sliceCount: number,
  overrides: Partial<ChoppedSample> = {},
): ChoppedSample {
  const slices = Array.from({ length: sliceCount }, (_, i) => ({
    label: `drum-${i}`,
    startSample: i * 5000,
    endSample: (i + 1) * 5000,
  }));

  return {
    format: 'chopped-sample',
    version: 1,
    variant: 'drum-kit',
    name: 'drum-kit-sample',
    source: 'drums.wav',
    sampleRate: 48000,
    slices,
    drumKit: { baseNote },
    description: 'A drum kit',
    createdAt: '2026-02-01T08:00:00Z',
    modifiedAt: '2026-03-01T09:00:00Z',
    ...overrides,
  } as ChoppedSample;
}

describe('migrateChoppedSample', () => {
  describe('generic chopped sample migration', () => {
    it('produces a sample with correct fields', () => {
      const chopped = makeGenericChopped();
      const { sample } = migrateChoppedSample(chopped);

      expect(sample.format).toBe('sample');
      expect(sample.version).toBe(1);
      expect(sample.name).toBe('test-sample');
      expect(sample.file).toBe('test.wav');
      expect(sample.sampleRate).toBe(44100);
      expect(sample.loopMode).toBeUndefined();
      expect(sample.rootKey).toBeUndefined();
    });

    it('produces a program with 3 labeled zones and no keyRanges', () => {
      const chopped = makeGenericChopped();
      const { program } = migrateChoppedSample(chopped);

      expect(program.format).toBe('program');
      expect(program.version).toBe(1);
      expect(program.name).toBe('test-sample');
      expect(program.zones).toHaveLength(3);

      for (const zone of program.zones) {
        expect(zone.sample).toBe('test.wav');
        expect(zone.keyRange).toBeUndefined();
      }

      expect(program.zones[0]?.label).toBe('slice-a');
      expect(program.zones[1]?.label).toBe('slice-b');
      expect(program.zones[2]?.label).toBe('slice-c');
    });
  });

  describe('drum-kit chopped sample migration', () => {
    it('assigns keyRanges from string baseNote C2 (MIDI 36)', () => {
      const chopped = makeDrumKitChopped('C2', 4);
      const { program } = migrateChoppedSample(chopped);

      expect(program.zones).toHaveLength(4);
      expect(program.zones[0]?.keyRange).toEqual([36, 36]);
      expect(program.zones[1]?.keyRange).toEqual([37, 37]);
      expect(program.zones[2]?.keyRange).toEqual([38, 38]);
      expect(program.zones[3]?.keyRange).toEqual([39, 39]);
    });

    it('assigns keyRanges from numeric baseNote 48', () => {
      const chopped = makeDrumKitChopped(48, 3);
      const { program } = migrateChoppedSample(chopped);

      expect(program.zones).toHaveLength(3);
      expect(program.zones[0]?.keyRange).toEqual([48, 48]);
      expect(program.zones[1]?.keyRange).toEqual([49, 49]);
      expect(program.zones[2]?.keyRange).toEqual([50, 50]);
    });
  });

  describe('mute groups', () => {
    it('assigns non-zero mute groups and omits zero values', () => {
      const chopped = makeDrumKitChopped('C2', 4, {
        playback: {
          polyphony: 'poly',
          playbackMode: 'one-shot',
          muteGroups: [0, 0, 1, 1],
        },
      } as Partial<ChoppedSample>);

      const { program } = migrateChoppedSample(chopped);

      expect(program.zones[0]?.muteGroup).toBeUndefined();
      expect(program.zones[1]?.muteGroup).toBeUndefined();
      expect(program.zones[2]?.muteGroup).toBe(1);
      expect(program.zones[3]?.muteGroup).toBe(1);
    });
  });

  describe('playback configuration', () => {
    it('carries polyphony and playbackMode to the program', () => {
      const chopped = makeGenericChopped({
        playback: {
          polyphony: 'mono',
          playbackMode: 'gate',
          muteGroups: [0, 0, 0],
        },
      } as Partial<ChoppedSample>);

      const { program } = migrateChoppedSample(chopped);

      expect(program.polyphony).toBe('mono');
      expect(program.playbackMode).toBe('gate');
    });

    it('leaves polyphony and playbackMode undefined when no playback config', () => {
      const chopped = makeGenericChopped();
      const { program } = migrateChoppedSample(chopped);

      expect(program.polyphony).toBeUndefined();
      expect(program.playbackMode).toBeUndefined();
    });
  });

  describe('metadata preservation', () => {
    it('copies name, description, and timestamps to both outputs', () => {
      const chopped = makeGenericChopped();
      const { sample, program } = migrateChoppedSample(chopped);

      // Sample metadata
      expect(sample.name).toBe('test-sample');
      expect(sample.description).toBe('A test chopped sample');
      expect(sample.createdAt).toBe('2026-01-15T10:00:00Z');
      expect(sample.modifiedAt).toBe('2026-03-18T12:00:00Z');

      // Program metadata
      expect(program.name).toBe('test-sample');
      expect(program.description).toBe('A test chopped sample');
      expect(program.createdAt).toBe('2026-01-15T10:00:00Z');
      expect(program.modifiedAt).toBe('2026-03-18T12:00:00Z');
    });
  });

  describe('schema validation', () => {
    it('produces a valid SampleYaml document for generic variant', () => {
      const chopped = makeGenericChopped();
      const { sample } = migrateChoppedSample(chopped);

      const result = SampleYamlSchema.safeParse(sample);
      expect(result.success).toBe(true);
    });

    it('produces a valid ProgramYaml document for generic variant', () => {
      const chopped = makeGenericChopped();
      const { program } = migrateChoppedSample(chopped);

      const result = ProgramYamlSchema.safeParse(program);
      expect(result.success).toBe(true);
    });

    it('produces valid documents for drum-kit variant', () => {
      const chopped = makeDrumKitChopped('C2', 4, {
        playback: {
          polyphony: 'poly',
          playbackMode: 'one-shot',
          muteGroups: [0, 0, 1, 1],
        },
      } as Partial<ChoppedSample>);

      const { sample, program } = migrateChoppedSample(chopped);

      expect(SampleYamlSchema.safeParse(sample).success).toBe(true);
      expect(ProgramYamlSchema.safeParse(program).success).toBe(true);
    });
  });
});
