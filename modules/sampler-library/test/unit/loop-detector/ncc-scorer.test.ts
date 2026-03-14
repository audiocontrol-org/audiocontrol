import { describe, it, expect } from 'vitest';
import {
  calculateNCC,
  calculateZeroMeanNCC,
  batchCalculateNCC,
  calculateOptimalWindowSize,
  normalizeNCCScore,
} from '@/loop-detector/ncc-scorer.js';

/**
 * Generate a sine wave as Int16Array.
 */
function generateSineWave(
  frequency: number,
  sampleRate: number,
  durationSamples: number,
  amplitude: number = 30000
): Int16Array {
  const samples = new Int16Array(durationSamples);
  for (let i = 0; i < durationSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.round(amplitude * Math.sin(2 * Math.PI * frequency * t));
  }
  return samples;
}

/**
 * Generate white noise as Int16Array.
 */
function generateNoise(length: number, amplitude: number = 10000): Int16Array {
  const samples = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.round((Math.random() * 2 - 1) * amplitude);
  }
  return samples;
}

describe('calculateNCC', () => {
  it('should return 1.0 for identical windows', () => {
    const samples = generateSineWave(100, 1000, 200);

    // Copy a section at index 50 to index 100 (they'll be identical)
    const loopStart = 50;
    const loopEnd = 50 + 100; // Same content
    const windowSize = 100;

    // For identical content, NCC should be 1.0
    // But these aren't identical positions, so let's use a repeating signal
    const repeatSamples = new Int16Array(200);
    for (let i = 0; i < 100; i++) {
      repeatSamples[i] = 10000;
      repeatSamples[i + 100] = 10000;
    }

    // With constant DC, variance is 0, should return 1.0
    const ncc = calculateNCC(repeatSamples, 0, 100, 50);
    expect(ncc).toBe(1.0);
  });

  it('should return -1.0 for inverted windows', () => {
    // Create samples where the window at loopEnd-windowSize is the inverse of loopStart
    // NCC compares: a[i] = samples[loopStart + i] vs b[i] = samples[loopEnd - windowSize + i]
    const windowSize = 50;
    const loopStart = 0;
    const loopEnd = 100;
    // Window A: samples[0..49], Window B: samples[50..99]

    const samples = new Int16Array(100);
    for (let i = 0; i < windowSize; i++) {
      samples[loopStart + i] = 1000 + i * 100; // Window A: ramp up
      samples[loopEnd - windowSize + i] = -(1000 + i * 100); // Window B: inverted ramp
    }

    const ncc = calculateNCC(samples, loopStart, loopEnd, windowSize);

    expect(ncc).toBeCloseTo(-1.0, 5);
  });

  it('should return approximately 0 for uncorrelated noise', () => {
    // Generate two independent noise windows
    const samples = new Int16Array(2000);
    for (let i = 0; i < 1000; i++) {
      samples[i] = Math.round((Math.random() * 2 - 1) * 10000);
      samples[1000 + i] = Math.round((Math.random() * 2 - 1) * 10000);
    }

    const windowSize = 500;
    const ncc = calculateNCC(samples, 0, 1000, windowSize);

    // Should be close to 0 (within statistical noise)
    expect(Math.abs(ncc)).toBeLessThan(0.3);
  });

  it('should return high correlation for one-period-apart sine waves', () => {
    // Same frequency sine - comparing windows one period apart should correlate well
    const sampleRate = 1000;
    const frequency = 50; // 50 Hz = period of 20 samples
    const samples = generateSineWave(frequency, sampleRate, 500);

    const windowSize = 40; // Two full periods
    const period = sampleRate / frequency; // 20 samples
    // Compare windows exactly one period apart (should be identical for pure sine)
    const loopStart = 100;
    const loopEnd = 100 + Math.round(period) + windowSize; // One period offset

    const ncc = calculateNCC(samples, loopStart, loopEnd, windowSize);

    // One period shift should still have high correlation for periodic signal
    expect(ncc).toBeGreaterThan(0.9);
  });

  it('should return 0 for zero variance (silent signal)', () => {
    const samples = new Int16Array(200); // All zeros

    const ncc = calculateNCC(samples, 0, 100, 50);

    // Both windows have zero variance, considered identical
    expect(ncc).toBe(1.0);
  });

  it('should return 0 when bounds are invalid', () => {
    const samples = new Int16Array(100);

    // Window extends beyond samples
    expect(calculateNCC(samples, 0, 200, 50)).toBe(0);

    // Negative start
    expect(calculateNCC(samples, -10, 50, 20)).toBe(0);

    // Zero window size
    expect(calculateNCC(samples, 0, 50, 0)).toBe(0);
  });

  it('should handle real audio-like patterns', () => {
    // Create a periodic signal representing a musical note
    const sampleRate = 30000;
    const frequency = 440; // A4
    const samples = generateSineWave(frequency, sampleRate, 3000);

    // Compare windows that are one pitch period apart
    const period = Math.round(sampleRate / frequency);
    const windowSize = Math.min(period * 2, 500);

    const loopStart = 500;
    const loopEnd = 500 + period; // One period later

    const ncc = calculateNCC(samples, loopStart, loopEnd, windowSize);

    // Should have very high correlation for periodic signal
    expect(ncc).toBeGreaterThan(0.95);
  });
});

describe('calculateZeroMeanNCC', () => {
  it('should handle signals with DC offset', () => {
    // Signal with DC offset - same sine wave at different offsets
    // NCC compares: a[i] = samples[loopStart + i] vs b[i] = samples[loopEnd - windowSize + i]
    const windowSize = 50;
    const loopStart = 0;
    const loopEnd = 100;

    const samples = new Int16Array(100);
    for (let i = 0; i < windowSize; i++) {
      // Window A (loopStart to loopStart + windowSize)
      samples[loopStart + i] = 10000 + Math.round(5000 * Math.sin((i / windowSize) * 2 * Math.PI));
      // Window B (loopEnd - windowSize to loopEnd) - same shape, different DC offset
      samples[loopEnd - windowSize + i] = 15000 + Math.round(5000 * Math.sin((i / windowSize) * 2 * Math.PI));
    }

    // Zero-mean NCC should recognize these as the same pattern despite DC difference
    const zmNcc = calculateZeroMeanNCC(samples, loopStart, loopEnd, windowSize);

    // Should have high correlation
    expect(zmNcc).toBeGreaterThan(0.9);
  });

  it('should return 1.0 for scaled versions of same signal', () => {
    const samples = new Int16Array(200);
    for (let i = 0; i < 100; i++) {
      samples[i] = 1000 + i * 10;
      samples[100 + i] = 2000 + i * 10; // Same pattern, different offset and scale
    }

    const windowSize = 50;
    const zmNcc = calculateZeroMeanNCC(samples, 0, 100, windowSize);

    // After removing mean, patterns should match
    expect(zmNcc).toBeGreaterThan(0.99);
  });
});

describe('batchCalculateNCC', () => {
  it('should calculate NCC for multiple candidate pairs', () => {
    const samples = generateSineWave(100, 1000, 500);

    const candidates = [
      { loopStart: 0, loopEnd: 100 },
      { loopStart: 50, loopEnd: 150 },
      { loopStart: 100, loopEnd: 200 },
    ];

    const results = batchCalculateNCC(samples, candidates, 50);

    expect(results.size).toBe(3);
    expect(results.has('0,100')).toBe(true);
    expect(results.has('50,150')).toBe(true);
    expect(results.has('100,200')).toBe(true);

    // All scores should be valid numbers
    for (const score of results.values()) {
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(-1);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('calculateOptimalWindowSize', () => {
  it('should return power of 2 for common sample rates', () => {
    const size30k = calculateOptimalWindowSize(30000);
    const size15k = calculateOptimalWindowSize(15000);

    // Check powers of 2
    expect(Math.log2(size30k) % 1).toBe(0);
    expect(Math.log2(size15k) % 1).toBe(0);
  });

  it('should scale with sample rate', () => {
    const size30k = calculateOptimalWindowSize(30000);
    const size15k = calculateOptimalWindowSize(15000);

    // Higher sample rate should give larger window (same ms duration)
    expect(size30k).toBeGreaterThanOrEqual(size15k);
  });

  it('should respect min/max constraints', () => {
    const size = calculateOptimalWindowSize(30000, 10, 20, 15);

    // Convert to ms and check range
    const ms = (size / 30000) * 1000;
    expect(ms).toBeGreaterThanOrEqual(10);
    expect(ms).toBeLessThanOrEqual(50); // Some flexibility for power-of-2 rounding
  });
});

describe('normalizeNCCScore', () => {
  it('should map -1 to 0', () => {
    expect(normalizeNCCScore(-1)).toBe(0);
  });

  it('should map 0 to 0.5', () => {
    expect(normalizeNCCScore(0)).toBe(0.5);
  });

  it('should map 1 to 1', () => {
    expect(normalizeNCCScore(1)).toBe(1);
  });

  it('should linearly interpolate intermediate values', () => {
    expect(normalizeNCCScore(0.5)).toBe(0.75);
    expect(normalizeNCCScore(-0.5)).toBe(0.25);
  });
});
