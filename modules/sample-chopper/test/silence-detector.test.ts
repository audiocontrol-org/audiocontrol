/**
 * Silence detector unit tests.
 */

import { describe, it, expect } from 'vitest';
import { sliceBySilence, trimSilence } from '@/silence-detector.js';

/**
 * Create a test signal with alternating sound and silence regions.
 */
function createTestSignal(
  sampleRate: number,
  regions: Array<{ durationMs: number; amplitude: number }>
): Int16Array {
  let totalSamples = 0;
  for (const region of regions) {
    totalSamples += Math.round((region.durationMs * sampleRate) / 1000);
  }

  const samples = new Int16Array(totalSamples);
  let offset = 0;

  for (const region of regions) {
    const regionSamples = Math.round((region.durationMs * sampleRate) / 1000);
    const amplitude = Math.round(region.amplitude * 32767);
    for (let i = 0; i < regionSamples; i++) {
      samples[offset + i] = amplitude;
    }
    offset += regionSamples;
  }

  return samples;
}

describe('sliceBySilence', () => {
  it('should detect silence gaps and split into regions', () => {
    const samples = createTestSignal(10000, [
      { durationMs: 100, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },
      { durationMs: 100, amplitude: 0.5 },
    ]);

    const result = sliceBySilence(samples, 10000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
    });

    expect(result.slices).toHaveLength(2);
    expect(result.sampleRate).toBe(10000);
    expect(result.totalDurationMs).toBe(300);

    expect(result.slices[0]?.durationMs).toBeCloseTo(100, -1);
    expect(result.slices[1]?.durationMs).toBeCloseTo(100, -1);
  });

  it('should ignore short silence gaps', () => {
    const samples = createTestSignal(10000, [
      { durationMs: 100, amplitude: 0.5 },
      { durationMs: 20, amplitude: 0 },
      { durationMs: 100, amplitude: 0.5 },
    ]);

    const result = sliceBySilence(samples, 10000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
    });

    expect(result.slices).toHaveLength(1);
    expect(result.slices[0]?.durationMs).toBeCloseTo(220, -1);
  });

  it('should filter out short samples', () => {
    const samples = createTestSignal(10000, [
      { durationMs: 5, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },
      { durationMs: 100, amplitude: 0.5 },
    ]);

    const result = sliceBySilence(samples, 10000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
      minSampleMs: 50,
    });

    expect(result.slices).toHaveLength(1);
    expect(result.slices[0]?.durationMs).toBeGreaterThan(80);
    expect(result.slices[0]?.durationMs).toBeLessThan(120);
  });

  it('should handle signal with no silence', () => {
    const samples = createTestSignal(10000, [{ durationMs: 500, amplitude: 0.5 }]);

    const result = sliceBySilence(samples, 10000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
    });

    expect(result.slices).toHaveLength(1);
    expect(result.slices[0]?.durationMs).toBeCloseTo(500, -1);
  });

  it('should handle completely silent signal', () => {
    const samples = new Int16Array(5000);

    const result = sliceBySilence(samples, 10000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
    });

    expect(result.slices).toHaveLength(0);
  });

  it('should assign sequential indices', () => {
    const samples = createTestSignal(10000, [
      { durationMs: 100, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },
      { durationMs: 100, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },
      { durationMs: 100, amplitude: 0.5 },
    ]);

    const result = sliceBySilence(samples, 10000, {
      method: 'silence',
      thresholdDb: -40,
      minSilenceMs: 50,
    });

    expect(result.slices).toHaveLength(3);
    expect(result.slices[0]?.index).toBe(0);
    expect(result.slices[1]?.index).toBe(1);
    expect(result.slices[2]?.index).toBe(2);
  });
});

describe('trimSilence', () => {
  it('should find start and end of non-silent content', () => {
    const samples = createTestSignal(10000, [
      { durationMs: 100, amplitude: 0 },
      { durationMs: 200, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },
    ]);

    const { start, end } = trimSilence(samples, 10000, -40);

    expect(start).toBeCloseTo(1000, -2);
    expect(end).toBeCloseTo(3000, -2);
  });

  it('should handle signal with no leading silence', () => {
    const samples = createTestSignal(10000, [
      { durationMs: 200, amplitude: 0.5 },
      { durationMs: 100, amplitude: 0 },
    ]);

    const { start, end } = trimSilence(samples, 10000, -40);

    expect(start).toBe(0);
    expect(end).toBeCloseTo(2000, -2);
  });

  it('should handle signal with no trailing silence', () => {
    const samples = createTestSignal(10000, [
      { durationMs: 100, amplitude: 0 },
      { durationMs: 200, amplitude: 0.5 },
    ]);

    const { start, end } = trimSilence(samples, 10000, -40);

    expect(start).toBeCloseTo(1000, -2);
    expect(end).toBe(3000);
  });
});
