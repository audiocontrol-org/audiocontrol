import { describe, it, expect } from 'vitest';
import { trimSamples, trimSilence } from '@/operations/trim';

describe('trimSamples', () => {
  it('returns correct subarray', () => {
    const samples = new Int16Array([100, 200, 300, 400, 500]);
    const result = trimSamples(samples, 1, 4);
    expect(Array.from(result)).toEqual([200, 300, 400]);
  });

  it('handles full range (no-op)', () => {
    const samples = new Int16Array([100, 200, 300]);
    const result = trimSamples(samples, 0, 3);
    expect(Array.from(result)).toEqual([100, 200, 300]);
  });

  it('handles empty result', () => {
    const samples = new Int16Array([100, 200, 300]);
    const result = trimSamples(samples, 2, 2);
    expect(result.length).toBe(0);
  });

  it('clamps start and end to valid range', () => {
    const samples = new Int16Array([100, 200, 300]);
    const result = trimSamples(samples, -5, 100);
    expect(Array.from(result)).toEqual([100, 200, 300]);
  });
});

describe('trimSilence', () => {
  const sampleRate = 44100;

  function makeSilentSamples(count: number): Int16Array {
    return new Int16Array(count); // all zeros
  }

  function makeLoudSamples(count: number, amplitude: number): Int16Array {
    const samples = new Int16Array(count);
    for (let i = 0; i < count; i++) {
      samples[i] = amplitude;
    }
    return samples;
  }

  it('removes leading silence', () => {
    // Use window-aligned boundaries: 10ms window at 44100Hz = 441 samples
    // 5 windows of silence + 5 windows of loud = 2205 + 2205
    const windowSize = Math.floor(sampleRate * 0.01); // 441
    const silentCount = windowSize * 5;
    const loudCount = windowSize * 5;
    const combined = new Int16Array(silentCount + loudCount);
    for (let i = silentCount; i < combined.length; i++) {
      combined[i] = 10000;
    }

    const result = trimSilence(combined, sampleRate);
    // Result should be shorter than original (leading silence removed)
    expect(result.length).toBeLessThan(combined.length);
    expect(result.length).toBe(loudCount);
    // All remaining samples should be from the loud portion
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(10000);
    }
  });

  it('removes trailing silence', () => {
    const windowSize = Math.floor(sampleRate * 0.01);
    const loudCount = windowSize * 5;
    const silentCount = windowSize * 5;
    const combined = new Int16Array(loudCount + silentCount);
    for (let i = 0; i < loudCount; i++) {
      combined[i] = 10000;
    }

    const result = trimSilence(combined, sampleRate);
    expect(result.length).toBeLessThan(combined.length);
    expect(result.length).toBe(loudCount);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(10000);
    }
  });

  it('keeps non-silent samples', () => {
    const windowSize = Math.floor(sampleRate * 0.01);
    const loud = makeLoudSamples(windowSize * 5, 10000);
    const result = trimSilence(loud, sampleRate);
    expect(result.length).toBe(loud.length);
  });

  it('with all silence returns empty', () => {
    const windowSize = Math.floor(sampleRate * 0.01);
    const silent = makeSilentSamples(windowSize * 5);
    const result = trimSilence(silent, sampleRate);
    expect(result.length).toBe(0);
  });

  it('handles empty input', () => {
    const result = trimSilence(new Int16Array(0), sampleRate);
    expect(result.length).toBe(0);
  });
});
