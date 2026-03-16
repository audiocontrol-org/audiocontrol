/**
 * Fixed interval slicer unit tests.
 */

import { describe, it, expect } from 'vitest';
import { sliceByFixedInterval } from '@/fixed-slicer.js';

describe('sliceByFixedInterval', () => {
  it('should slice audio into equal intervals', () => {
    const samples = new Int16Array(1000);
    for (let i = 0; i < 1000; i++) {
      samples[i] = i;
    }

    const result = sliceByFixedInterval(samples, 1000, {
      method: 'fixed',
      intervalMs: 250,
    });

    expect(result.slices).toHaveLength(4);
    expect(result.sampleRate).toBe(1000);
    expect(result.totalDurationMs).toBe(1000);

    expect(result.slices[0]?.samples.length).toBe(250);
    expect(result.slices[0]?.startSample).toBe(0);
    expect(result.slices[0]?.endSample).toBe(250);
    expect(result.slices[0]?.durationMs).toBe(250);

    expect(result.slices[1]?.samples.length).toBe(250);
    expect(result.slices[1]?.startSample).toBe(250);
    expect(result.slices[1]?.endSample).toBe(500);

    expect(result.slices[3]?.startSample).toBe(750);
    expect(result.slices[3]?.endSample).toBe(1000);
  });

  it('should handle partial final slice', () => {
    const samples = new Int16Array(900);

    const result = sliceByFixedInterval(samples, 1000, {
      method: 'fixed',
      intervalMs: 250,
    });

    expect(result.slices).toHaveLength(4);
    expect(result.slices[3]?.samples.length).toBe(150);
    expect(result.slices[3]?.durationMs).toBe(150);
  });

  it('should validate count if specified', () => {
    const samples = new Int16Array(1000);

    const result = sliceByFixedInterval(samples, 1000, {
      method: 'fixed',
      intervalMs: 250,
      count: 4,
    });
    expect(result.slices).toHaveLength(4);

    expect(() =>
      sliceByFixedInterval(samples, 1000, {
        method: 'fixed',
        intervalMs: 250,
        count: 5,
      })
    ).toThrow(/Expected 5 slices/);
  });

  it('should throw for invalid interval', () => {
    const samples = new Int16Array(1000);

    expect(() =>
      sliceByFixedInterval(samples, 1000, {
        method: 'fixed',
        intervalMs: 0,
      })
    ).toThrow(/Invalid interval/);
  });

  it('should preserve sample values', () => {
    const samples = new Int16Array([100, 200, 300, 400, 500, 600]);

    const result = sliceByFixedInterval(samples, 1000, {
      method: 'fixed',
      intervalMs: 3,
    });

    expect(result.slices[0]?.samples).toEqual(new Int16Array([100, 200, 300]));
    expect(result.slices[1]?.samples).toEqual(new Int16Array([400, 500, 600]));
  });

  it('should assign sequential indices', () => {
    const samples = new Int16Array(100);

    const result = sliceByFixedInterval(samples, 1000, {
      method: 'fixed',
      intervalMs: 25,
    });

    expect(result.slices[0]?.index).toBe(0);
    expect(result.slices[1]?.index).toBe(1);
    expect(result.slices[2]?.index).toBe(2);
    expect(result.slices[3]?.index).toBe(3);
  });
});
