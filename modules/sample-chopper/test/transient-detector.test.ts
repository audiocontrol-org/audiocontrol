/**
 * Transient detector unit tests.
 */

import { describe, it, expect } from 'vitest';
import { sliceByTransient, refineOnsetPosition } from '@/transient-detector.js';

/**
 * Create a test signal with transient attacks at specified positions.
 */
function createTransientSignal(
  sampleRate: number,
  durationMs: number,
  transients: Array<{ timeMs: number; amplitude: number; decayMs: number }>
): Int16Array {
  const totalSamples = Math.round((durationMs * sampleRate) / 1000);
  const samples = new Int16Array(totalSamples);

  for (const transient of transients) {
    const startSample = Math.round((transient.timeMs * sampleRate) / 1000);
    const decaySamples = Math.round((transient.decayMs * sampleRate) / 1000);
    const amplitude = Math.round(transient.amplitude * 32767);

    for (let i = 0; i < decaySamples && startSample + i < totalSamples; i++) {
      const decay = 1 - i / decaySamples;
      const existingValue = samples[startSample + i] ?? 0;
      samples[startSample + i] = Math.max(
        existingValue,
        Math.round(amplitude * decay)
      );
    }
  }

  return samples;
}

describe('sliceByTransient', () => {
  it('should detect transient onsets', () => {
    const samples = createTransientSignal(10000, 600, [
      { timeMs: 0, amplitude: 0.8, decayMs: 50 },
      { timeMs: 200, amplitude: 0.8, decayMs: 50 },
      { timeMs: 400, amplitude: 0.8, decayMs: 50 },
    ]);

    const result = sliceByTransient(samples, 10000, {
      method: 'transient',
      threshold: 0.3,
      minGapMs: 100,
    });

    expect(result.slices).toHaveLength(3);
    expect(result.sampleRate).toBe(10000);
    expect(result.totalDurationMs).toBe(600);

    expect(result.slices[0]?.startSample).toBeLessThan(100);
    expect(result.slices[1]?.startSample).toBeGreaterThan(1800);
    expect(result.slices[1]?.startSample).toBeLessThan(2200);
    expect(result.slices[2]?.startSample).toBeGreaterThan(3800);
    expect(result.slices[2]?.startSample).toBeLessThan(4200);
  });

  it('should respect minimum gap between transients', () => {
    const samples = createTransientSignal(10000, 300, [
      { timeMs: 0, amplitude: 0.8, decayMs: 30 },
      { timeMs: 50, amplitude: 0.8, decayMs: 30 },
      { timeMs: 200, amplitude: 0.8, decayMs: 30 },
    ]);

    const result = sliceByTransient(samples, 10000, {
      method: 'transient',
      threshold: 0.3,
      minGapMs: 100,
    });

    expect(result.slices).toHaveLength(2);
  });

  it('should handle different threshold levels', () => {
    const samples = createTransientSignal(10000, 500, [
      { timeMs: 0, amplitude: 0.8, decayMs: 50 },
      { timeMs: 200, amplitude: 0.2, decayMs: 50 },
      { timeMs: 400, amplitude: 0.8, decayMs: 50 },
    ]);

    const highThreshold = sliceByTransient(samples, 10000, {
      method: 'transient',
      threshold: 0.5,
      minGapMs: 50,
    });
    expect(highThreshold.slices).toHaveLength(2);

    const lowThreshold = sliceByTransient(samples, 10000, {
      method: 'transient',
      threshold: 0.1,
      minGapMs: 50,
    });
    expect(lowThreshold.slices).toHaveLength(3);
  });

  it('should return whole audio if no transients found', () => {
    const samples = new Int16Array(5000);

    const result = sliceByTransient(samples, 10000, {
      method: 'transient',
      threshold: 0.3,
      minGapMs: 100,
    });

    expect(result.slices).toHaveLength(1);
    expect(result.slices[0]?.samples.length).toBe(5000);
  });

  it('should include pre-pad before transients', () => {
    const samples = createTransientSignal(10000, 500, [
      { timeMs: 100, amplitude: 0.8, decayMs: 50 },
      { timeMs: 300, amplitude: 0.8, decayMs: 50 },
    ]);

    const result = sliceByTransient(samples, 10000, {
      method: 'transient',
      threshold: 0.3,
      minGapMs: 100,
      prePadMs: 20,
    });

    expect(result.slices).toHaveLength(2);
    expect(result.slices[0]?.startSample).toBeGreaterThan(600);
    expect(result.slices[0]?.startSample).toBeLessThan(1000);
  });

  it('should assign sequential indices', () => {
    const samples = createTransientSignal(10000, 400, [
      { timeMs: 0, amplitude: 0.8, decayMs: 50 },
      { timeMs: 150, amplitude: 0.8, decayMs: 50 },
      { timeMs: 300, amplitude: 0.8, decayMs: 50 },
    ]);

    const result = sliceByTransient(samples, 10000, {
      method: 'transient',
      threshold: 0.3,
      minGapMs: 50,
    });

    expect(result.slices[0]?.index).toBe(0);
    expect(result.slices[1]?.index).toBe(1);
    expect(result.slices[2]?.index).toBe(2);
  });
});

describe('refineOnsetPosition', () => {
  it('should find steepest rise in search range', () => {
    const samples = new Int16Array([
      0, 100, 200, 300, 400,
      500, 1000, 5000, 10000,
      10000, 9000, 8000,
    ]);

    const refined = refineOnsetPosition(samples, 7, 5);

    expect(refined).toBeGreaterThanOrEqual(5);
    expect(refined).toBeLessThanOrEqual(9);
  });

  it('should respect search range boundaries', () => {
    const samples = new Int16Array(100);
    samples[0] = 10000;

    const refined = refineOnsetPosition(samples, 2, 10);
    expect(refined).toBeGreaterThanOrEqual(0);
    expect(refined).toBeLessThanOrEqual(12);
  });
});
