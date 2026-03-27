import { describe, it, expect } from 'vitest';
import { fadeIn, fadeOut } from '@/operations/fade';

describe('fadeIn', () => {
  const sampleRate = 44100;

  it('starts at zero amplitude', () => {
    const samples = new Int16Array(44100).fill(10000);
    const result = fadeIn(samples, sampleRate, 100); // 100ms fade
    expect(result[0]).toBe(0);
  });

  it('reaches full amplitude after duration', () => {
    const samples = new Int16Array(44100).fill(10000);
    const result = fadeIn(samples, sampleRate, 100);
    const fadeSampleCount = Math.floor(0.1 * sampleRate);
    // Sample just past the fade region should be unchanged
    expect(result[fadeSampleCount]).toBe(10000);
  });

  it('preserves samples after fade region', () => {
    const samples = new Int16Array(44100).fill(10000);
    const result = fadeIn(samples, sampleRate, 100);
    // Last sample should be unchanged
    expect(result[result.length - 1]).toBe(10000);
  });

  it('equal-power curve maintains energy', () => {
    const samples = new Int16Array(44100).fill(10000);
    const result = fadeIn(samples, sampleRate, 100, 'equal-power');
    // Midpoint of equal-power fade should be ~0.707 * original
    const fadeSampleCount = Math.floor(0.1 * sampleRate);
    const midpoint = Math.floor(fadeSampleCount / 2);
    const expected = Math.round(10000 * Math.sin((0.5 * Math.PI) / 2));
    expect(Math.abs(result[midpoint] - expected)).toBeLessThan(2);
  });

  it('duration longer than sample does not crash', () => {
    const samples = new Int16Array([10000, 10000, 10000]);
    const result = fadeIn(samples, sampleRate, 10000); // 10 seconds on 3 samples
    expect(result.length).toBe(3);
    expect(result[0]).toBe(0);
  });
});

describe('fadeOut', () => {
  const sampleRate = 44100;

  it('ends at zero amplitude', () => {
    const samples = new Int16Array(44100).fill(10000);
    const result = fadeOut(samples, sampleRate, 100);
    expect(result[result.length - 1]).toBe(0);
  });

  it('preserves start', () => {
    const samples = new Int16Array(44100).fill(10000);
    const result = fadeOut(samples, sampleRate, 100);
    expect(result[0]).toBe(10000);
  });

  it('duration longer than sample does not crash', () => {
    const samples = new Int16Array([10000, 10000, 10000]);
    const result = fadeOut(samples, sampleRate, 10000);
    expect(result.length).toBe(3);
    expect(result[result.length - 1]).toBe(0);
  });

  it('logarithmic curve works', () => {
    const samples = new Int16Array(44100).fill(10000);
    const result = fadeOut(samples, sampleRate, 100, 'logarithmic');
    expect(result[result.length - 1]).toBe(0);
    expect(result[0]).toBe(10000);
  });
});
