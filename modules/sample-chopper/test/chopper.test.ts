/**
 * Sample chopper orchestrator unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  sliceAudio,
  analyzeForSlicing,
} from '@/chopper.js';

describe('sliceAudio', () => {
  it('should dispatch to fixed slicer', () => {
    const samples = new Int16Array(1000);

    const result = sliceAudio(samples, 1000, {
      method: 'fixed',
      count: 4,
    });

    expect(result.slices).toHaveLength(4);
  });

  it('should dispatch to silence slicer', () => {
    const samples = new Int16Array(1000);
    const result = sliceAudio(samples, 1000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
    });

    expect(result.slices).toHaveLength(0); // All silent
  });

  it('should dispatch to transient slicer', () => {
    const samples = new Int16Array(1000);
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

describe('analyzeForSlicing', () => {
  it('should calculate duration correctly', () => {
    const samples = new Int16Array(44100);

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.duration.ms).toBe(1000);
    expect(analysis.duration.samples).toBe(44100);
  });

  it('should find peak amplitude', () => {
    const samples = new Int16Array(100);
    samples[50] = 16384;

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.peakAmplitude).toBeCloseTo(0.5, 1);
  });

  it('should suggest transient threshold based on peak', () => {
    const samples = new Int16Array(100);
    samples[50] = 32767;

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.suggestedTransientThreshold).toBeCloseTo(0.3, 1);
  });

  it('should enforce minimum transient threshold', () => {
    const samples = new Int16Array(100);
    samples[50] = 1000;

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.suggestedTransientThreshold).toBeGreaterThanOrEqual(0.1);
  });

  it('should provide silence threshold suggestion', () => {
    const samples = new Int16Array(100);

    const analysis = analyzeForSlicing(samples, 44100);

    expect(analysis.suggestedSilenceThresholdDb).toBe(-40);
  });
});
