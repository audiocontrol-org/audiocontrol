/**
 * Sample chopper orchestrator unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  sliceAudio,
  slicesToDrumKit,
  analyzeForSlicing,
} from '@/sample-chopper/chopper.js';
import type { SliceConfig, SliceResult } from '@/sample-chopper/types.js';

describe('sliceAudio', () => {
  it('should dispatch to fixed slicer', () => {
    const samples = new Int16Array(1000);

    const result = sliceAudio(samples, 1000, {
      method: 'fixed',
      intervalMs: 250,
    });

    expect(result.slices).toHaveLength(4);
  });

  it('should dispatch to silence slicer', () => {
    const samples = new Int16Array(1000);
    // Create silent signal
    const result = sliceAudio(samples, 1000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
    });

    expect(result.slices).toHaveLength(0); // All silent
  });

  it('should dispatch to transient slicer', () => {
    const samples = new Int16Array(1000);
    // Silent signal = no transients = returns whole audio as one slice
    const result = sliceAudio(samples, 1000, {
      method: 'transient',
      threshold: 0.3,
      minGapMs: 100,
    });

    expect(result.slices).toHaveLength(1);
    expect(result.slices[0]?.samples.length).toBe(1000);
  });

  it('should dispatch to manual slicer', () => {
    const samples = new Int16Array(1000);

    const result = sliceAudio(samples, 1000, {
      method: 'manual',
      regions: [
        { start: 0, end: 500 },
        { start: 500, end: 1000 },
      ],
    });

    expect(result.slices).toHaveLength(2);
  });
});

describe('slicesToDrumKit', () => {
  /**
   * Create a mock slice result for testing.
   */
  function createMockSliceResult(sliceCount: number): SliceResult {
    const slices = [];
    for (let i = 0; i < sliceCount; i++) {
      slices.push({
        index: i,
        startSample: i * 100,
        endSample: (i + 1) * 100,
        samples: new Int16Array(100),
        durationMs: 100,
      });
    }
    return {
      slices,
      sampleRate: 1000,
      totalDurationMs: sliceCount * 100,
    };
  }

  it('should create drum kit from 4 slices', () => {
    const sliceResult = createMockSliceResult(4);

    const kit = slicesToDrumKit(sliceResult, {
      name: 'TEST-KIT',
      sampleRate: 15000,
    });

    expect(kit.name).toBe('TEST-KIT');
    expect(kit.sampleRate).toBe(15000);
    expect(kit.baseNote).toBe(36); // Default C2
    expect(kit.totalSamples).toBe(4);
    expect(kit.allComplete).toBe(true);
    expect(kit.kits).toHaveLength(1);

    // Check kit structure
    const firstKit = kit.kits[0]!;
    expect(firstKit.kitNumber).toBe(1);
    expect(firstKit.isComplete).toBe(true);
    expect(firstKit.samples.kick).toBe('01 KICK.wav');
    expect(firstKit.samples.snare).toBe('01 SNARE.wav');
    expect(firstKit.samples.hhClosed).toBe('01 HHC.wav');
    expect(firstKit.samples.hhOpen).toBe('01 HHO.wav');

    // Check MIDI notes
    expect(firstKit.midiNotes.kick).toBe(36);
    expect(firstKit.midiNotes.snare).toBe(37);
    expect(firstKit.midiNotes.hhClosed).toBe(38);
    expect(firstKit.midiNotes.hhOpen).toBe(39);
  });

  it('should create multiple kits from 8 slices', () => {
    const sliceResult = createMockSliceResult(8);

    const kit = slicesToDrumKit(sliceResult, {
      name: 'TEST-KIT',
      sampleRate: 15000,
    });

    expect(kit.totalSamples).toBe(8);
    expect(kit.kits).toHaveLength(2);

    // Second kit samples
    expect(kit.kits[1]?.samples.kick).toBe('02 KICK.wav');
    expect(kit.kits[1]?.samples.snare).toBe('02 SNARE.wav');

    // Second kit MIDI notes should start at baseNote + 4
    expect(kit.kits[1]?.midiNotes.kick).toBe(40);
    expect(kit.kits[1]?.midiNotes.snare).toBe(41);
  });

  it('should handle incomplete kit (3 slices)', () => {
    const sliceResult = createMockSliceResult(3);

    const kit = slicesToDrumKit(sliceResult, {
      name: 'TEST-KIT',
      sampleRate: 15000,
    });

    expect(kit.totalSamples).toBe(3);
    expect(kit.kits).toHaveLength(1);
    expect(kit.kits[0]?.isComplete).toBe(false);
    expect(kit.allComplete).toBe(false);

    expect(kit.kits[0]?.samples.kick).toBe('01 KICK.wav');
    expect(kit.kits[0]?.samples.snare).toBe('01 SNARE.wav');
    expect(kit.kits[0]?.samples.hhClosed).toBe('01 HHC.wav');
    expect(kit.kits[0]?.samples.hhOpen).toBeUndefined();
  });

  it('should use custom base note', () => {
    const sliceResult = createMockSliceResult(4);

    const kit = slicesToDrumKit(sliceResult, {
      name: 'TEST-KIT',
      sampleRate: 15000,
      baseNote: 48, // C3
    });

    expect(kit.baseNote).toBe(48);
    expect(kit.kits[0]?.midiNotes.kick).toBe(48);
    expect(kit.kits[0]?.midiNotes.snare).toBe(49);
  });

  it('should use custom drum type labels', () => {
    const sliceResult = createMockSliceResult(4);

    const kit = slicesToDrumKit(sliceResult, {
      name: 'TEST-KIT',
      sampleRate: 15000,
      drumTypes: ['BD', 'SD', 'HH', 'OH'],
    });

    expect(kit.kits[0]?.samples.kick).toBe('01 BD.wav');
    expect(kit.kits[0]?.samples.snare).toBe('01 SD.wav');
    expect(kit.kits[0]?.samples.hhClosed).toBe('01 HH.wav');
    expect(kit.kits[0]?.samples.hhOpen).toBe('01 OH.wav');
  });

  it('should use 30000 Hz sample rate when specified', () => {
    const sliceResult = createMockSliceResult(4);

    const kit = slicesToDrumKit(sliceResult, {
      name: 'TEST-KIT',
      sampleRate: 30000,
    });

    expect(kit.sampleRate).toBe(30000);
  });
});

describe('analyzeForSlicing', () => {
  it('should calculate duration correctly', () => {
    const samples = new Int16Array(44100); // 1 second at 44.1kHz

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.duration.ms).toBe(1000);
    expect(analysis.duration.samples).toBe(44100);
  });

  it('should find peak amplitude', () => {
    const samples = new Int16Array(100);
    samples[50] = 16384; // ~50% amplitude

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.peakAmplitude).toBeCloseTo(0.5, 1);
  });

  it('should suggest transient threshold based on peak', () => {
    const samples = new Int16Array(100);
    samples[50] = 32767; // Full amplitude

    const analysis = analyzeForSlicing(samples, 44100);

    // Should suggest ~30% of peak
    expect(analysis.suggestedTransientThreshold).toBeCloseTo(0.3, 1);
  });

  it('should enforce minimum transient threshold', () => {
    const samples = new Int16Array(100);
    samples[50] = 1000; // Very quiet

    const analysis = analyzeForSlicing(samples, 44100);

    // Should be at least 0.1
    expect(analysis.suggestedTransientThreshold).toBeGreaterThanOrEqual(0.1);
  });

  it('should provide silence threshold suggestion', () => {
    const samples = new Int16Array(100);

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.suggestedSilenceThresholdDb).toBe(-40);
  });
});
