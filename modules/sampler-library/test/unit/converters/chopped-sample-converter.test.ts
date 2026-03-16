import { describe, it, expect } from 'vitest';
import {
  drumKitBundleToChoppedSample,
  choppedSampleToDrumKitBundle,
  createGenericChoppedSample,
} from '@/converters/chopped-sample-converter.js';
import type { DrumKitBundle } from '@/schemas/drum-kit-bundle-schema.js';
import type { DrumKitChoppedSample } from '@/schemas/chopped-sample-schema.js';

describe('drumKitBundleToChoppedSample', () => {
  const v2Bundle: DrumKitBundle = {
    format: 'drum-kit-bundle',
    version: 2,
    name: 'Test Kit',
    description: 'A test drum kit',
    sampleRate: 30000,
    baseNote: 'C2',
    transpose: -12,
    velocitySensitivity: 3,
    source: 'source.wav',
    slices: [
      { label: 'kick', startSample: 0, endSample: 15000 },
      { label: 'snare', startSample: 15000, endSample: 30000 },
    ],
  };

  it('should convert v2 bundle to drum-kit chopped sample', () => {
    const result = drumKitBundleToChoppedSample(v2Bundle);

    expect(result.format).toBe('chopped-sample');
    expect(result.version).toBe(1);
    expect(result.variant).toBe('drum-kit');
    expect(result.name).toBe('Test Kit');
    expect(result.description).toBe('A test drum kit');
    expect(result.source).toBe('source.wav');
    expect(result.sampleRate).toBe(30000);
    expect(result.slices).toHaveLength(2);
    expect(result.slices[0].label).toBe('kick');
    expect(result.drumKit.baseNote).toBe('C2');
    expect(result.drumKit.transpose).toBe(-12);
    expect(result.drumKit.velocitySensitivity).toBe(3);
  });

  it('should use resolved base note when provided', () => {
    const result = drumKitBundleToChoppedSample(v2Bundle, 48);
    expect(result.drumKit.baseNote).toBe(48);
  });

  it('should throw for v1 bundle', () => {
    const v1Bundle: DrumKitBundle = {
      format: 'drum-kit-bundle',
      version: 1,
      name: 'V1 Kit',
      sampleRate: 15000,
      baseNote: 'C2',
    };

    expect(() => drumKitBundleToChoppedSample(v1Bundle)).toThrow('version 2');
  });

  it('should throw for bundle without slices', () => {
    const noSlices: DrumKitBundle = {
      ...v2Bundle,
      source: 'source.wav',
      slices: [],
    };

    expect(() => drumKitBundleToChoppedSample(noSlices)).toThrow('slices');
  });
});

describe('choppedSampleToDrumKitBundle', () => {
  const drumKitSample: DrumKitChoppedSample = {
    format: 'chopped-sample',
    version: 1,
    variant: 'drum-kit',
    name: 'Test Kit',
    description: 'Converted kit',
    source: 'source.wav',
    sampleRate: 44100,
    slices: [
      { label: 'kick', startSample: 0, endSample: 22050 },
      { label: 'snare', startSample: 22050, endSample: 44100 },
    ],
    drumKit: {
      baseNote: 'C2',
      transpose: -12,
      velocitySensitivity: 3,
    },
  };

  it('should convert drum-kit chopped sample to bundle', () => {
    const result = choppedSampleToDrumKitBundle(drumKitSample, 30000);

    expect(result.format).toBe('drum-kit-bundle');
    expect(result.version).toBe(2);
    expect(result.name).toBe('Test Kit');
    expect(result.description).toBe('Converted kit');
    expect(result.sampleRate).toBe(30000);
    expect(result.baseNote).toBe('C2');
    expect(result.transpose).toBe(-12);
    expect(result.velocitySensitivity).toBe(3);
    expect(result.source).toBe('source.wav');
    expect(result.slices).toHaveLength(2);
  });

  it('should use specified target sample rate', () => {
    const at15k = choppedSampleToDrumKitBundle(drumKitSample, 15000);
    expect(at15k.sampleRate).toBe(15000);

    const at30k = choppedSampleToDrumKitBundle(drumKitSample, 30000);
    expect(at30k.sampleRate).toBe(30000);
  });

  it('should throw for generic variant', () => {
    const generic = createGenericChoppedSample('Test', 44100, [
      { label: 'a', startSample: 0, endSample: 100 },
    ]);

    expect(() => choppedSampleToDrumKitBundle(generic, 30000)).toThrow('drum-kit variant');
  });
});

describe('round-trip conversion', () => {
  it('should round-trip DrumKitBundle → ChoppedSample → DrumKitBundle', () => {
    const original: DrumKitBundle = {
      format: 'drum-kit-bundle',
      version: 2,
      name: 'Round Trip Kit',
      sampleRate: 30000,
      baseNote: 'C2',
      transpose: -6,
      velocitySensitivity: 4,
      source: 'source.wav',
      slices: [
        { label: 'kick', startSample: 0, endSample: 15000 },
        { label: 'snare', startSample: 15000, endSample: 30000 },
        { label: 'hat', startSample: 30000, endSample: 37500 },
      ],
    };

    const chopped = drumKitBundleToChoppedSample(original);
    const roundTripped = choppedSampleToDrumKitBundle(chopped, 30000);

    expect(roundTripped.name).toBe(original.name);
    expect(roundTripped.sampleRate).toBe(original.sampleRate);
    expect(roundTripped.baseNote).toBe(original.baseNote);
    expect(roundTripped.transpose).toBe(original.transpose);
    expect(roundTripped.velocitySensitivity).toBe(original.velocitySensitivity);
    expect(roundTripped.slices).toHaveLength(3);
    expect(roundTripped.slices![0].label).toBe('kick');
    expect(roundTripped.slices![2].endSample).toBe(37500);
  });
});

describe('createGenericChoppedSample', () => {
  it('should create a generic chopped sample', () => {
    const result = createGenericChoppedSample('My Sample', 44100, [
      { label: 'a', startSample: 0, endSample: 22050 },
      { label: 'b', startSample: 22050, endSample: 44100 },
    ]);

    expect(result.format).toBe('chopped-sample');
    expect(result.version).toBe(1);
    expect(result.variant).toBe('generic');
    expect(result.name).toBe('My Sample');
    expect(result.source).toBe('source.wav');
    expect(result.sampleRate).toBe(44100);
    expect(result.slices).toHaveLength(2);
  });
});
