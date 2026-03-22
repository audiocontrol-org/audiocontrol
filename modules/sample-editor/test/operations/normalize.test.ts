import { describe, it, expect } from 'vitest';
import { normalize, applyGain } from '@/operations/normalize';

describe('normalize', () => {
  it('scales quiet sample to full range', () => {
    // Peak at ~50% of full scale
    const samples = new Int16Array([0, 16384, -16384, 8000, -8000]);
    const result = normalize(samples);
    // After normalization, peak should be at 32767
    const peak = Math.max(...Array.from(result).map(Math.abs));
    expect(peak).toBe(32767);
  });

  it('does not change already-normalized sample', () => {
    const samples = new Int16Array([0, 32767, -16000, 8000]);
    const result = normalize(samples);
    // Peak is already at 32767, so scale factor is 1
    expect(result[1]).toBe(32767);
  });

  it('handles silence (no division by zero)', () => {
    const samples = new Int16Array([0, 0, 0, 0]);
    const result = normalize(samples);
    expect(Array.from(result)).toEqual([0, 0, 0, 0]);
  });

  it('handles empty input', () => {
    const result = normalize(new Int16Array(0));
    expect(result.length).toBe(0);
  });

  it('normalizes to a target below 0dB', () => {
    const samples = new Int16Array([0, 32767, -32768]);
    const result = normalize(samples, -6);
    // -6dB ~ 0.5x, so peak should be roughly 32767 * 0.5 ≈ 16384
    const peak = Math.max(...Array.from(result).map(Math.abs));
    expect(peak).toBeGreaterThan(15000);
    expect(peak).toBeLessThan(17000);
  });
});

describe('applyGain', () => {
  it('positive dB increases amplitude', () => {
    const samples = new Int16Array([1000, -1000]);
    const result = applyGain(samples, 6); // ~2x
    expect(Math.abs(result[0])).toBeGreaterThan(Math.abs(samples[0]));
  });

  it('negative dB decreases amplitude', () => {
    const samples = new Int16Array([10000, -10000]);
    const result = applyGain(samples, -6); // ~0.5x
    expect(Math.abs(result[0])).toBeLessThan(Math.abs(samples[0]));
  });

  it('clamps to Int16 range', () => {
    const samples = new Int16Array([30000, -30000]);
    const result = applyGain(samples, 12); // ~4x, would exceed range
    expect(result[0]).toBe(32767);
    expect(result[1]).toBe(-32768);
  });

  it('handles empty input', () => {
    const result = applyGain(new Int16Array(0), 6);
    expect(result.length).toBe(0);
  });
});
