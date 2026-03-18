import { describe, it, expect } from 'vitest';
import {
  detectZeroCrossings,
  filterByPolarity,
  matchBySlope,
  findMatchingCrossings,
  calculateSlopeScore,
  generateCandidatePairs,
  snapToWordBoundary,
} from '@/loop-detector/zero-crossing-detector.js';
import { HARDWARE_CONSTRAINTS, type ZeroCrossing } from '@/loop-detector/types.js';

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

describe('snapToWordBoundary', () => {
  it('should return even numbers unchanged', () => {
    expect(snapToWordBoundary(0)).toBe(0);
    expect(snapToWordBoundary(2)).toBe(2);
    expect(snapToWordBoundary(100)).toBe(100);
    expect(snapToWordBoundary(1024)).toBe(1024);
  });

  it('should round odd numbers down to even', () => {
    expect(snapToWordBoundary(1)).toBe(0);
    expect(snapToWordBoundary(3)).toBe(2);
    expect(snapToWordBoundary(101)).toBe(100);
    expect(snapToWordBoundary(1025)).toBe(1024);
  });
});

describe('detectZeroCrossings', () => {
  it('should find zero crossings in a sine wave at expected positions', () => {
    // 100 Hz sine wave at 1000 Hz sample rate = 10 samples per cycle
    // Zero crossings at indices 0, 5, 10, 15, ... (every half period)
    const sampleRate = 1000;
    const frequency = 100;
    const samples = generateSineWave(frequency, sampleRate, 100);

    const crossings = detectZeroCrossings(samples, 0, samples.length);

    // Should have roughly 20 zero crossings in 10 cycles
    expect(crossings.length).toBeGreaterThan(15);
    expect(crossings.length).toBeLessThan(25);

    // All indices should be even (word-aligned)
    for (const crossing of crossings) {
      expect(crossing.index % 2).toBe(0);
    }
  });

  it('should detect positive-going crossings', () => {
    // Manually create a simple signal with known crossings
    const samples = new Int16Array(10);
    samples[0] = -1000;
    samples[1] = -500;
    samples[2] = 500; // Positive-going crossing at index 2
    samples[3] = 1000;
    samples[4] = 500;
    samples[5] = -500; // Negative-going crossing at index 5
    samples[6] = -1000;
    samples[7] = -500;
    samples[8] = 500; // Positive-going crossing at index 8
    samples[9] = 1000;

    const crossings = detectZeroCrossings(samples, 0, samples.length);

    // Should find 3 crossings
    expect(crossings.length).toBe(3);

    // First should be positive at index 2
    expect(crossings[0].index).toBe(2);
    expect(crossings[0].polarity).toBe('positive');

    // Second should be negative (at index 5, but snapped to 4)
    expect(crossings[1].polarity).toBe('negative');

    // Third should be positive at index 8
    expect(crossings[2].index).toBe(8);
    expect(crossings[2].polarity).toBe('positive');
  });

  it('should respect start and end index boundaries', () => {
    const samples = generateSineWave(100, 1000, 100);

    const crossings = detectZeroCrossings(samples, 20, 40);

    // All crossings should be within the specified range
    for (const crossing of crossings) {
      expect(crossing.index).toBeGreaterThanOrEqual(20);
      expect(crossing.index).toBeLessThan(40);
    }
  });

  it('should return empty array for silent signal', () => {
    const samples = new Int16Array(100); // All zeros

    const crossings = detectZeroCrossings(samples, 0, samples.length);

    expect(crossings.length).toBe(0);
  });

  it('should return empty array for DC signal', () => {
    const samples = new Int16Array(100);
    samples.fill(1000); // Constant positive value

    const crossings = detectZeroCrossings(samples, 0, samples.length);

    expect(crossings.length).toBe(0);
  });
});

describe('filterByPolarity', () => {
  it('should filter positive-going crossings', () => {
    const crossings: ZeroCrossing[] = [
      { index: 0, polarity: 'positive', slope: 0.5 },
      { index: 10, polarity: 'negative', slope: -0.5 },
      { index: 20, polarity: 'positive', slope: 0.5 },
      { index: 30, polarity: 'negative', slope: -0.5 },
    ];

    const positive = filterByPolarity(crossings, 'positive');

    expect(positive.length).toBe(2);
    expect(positive[0].index).toBe(0);
    expect(positive[1].index).toBe(20);
  });

  it('should filter negative-going crossings', () => {
    const crossings: ZeroCrossing[] = [
      { index: 0, polarity: 'positive', slope: 0.5 },
      { index: 10, polarity: 'negative', slope: -0.5 },
      { index: 20, polarity: 'positive', slope: 0.5 },
    ];

    const negative = filterByPolarity(crossings, 'negative');

    expect(negative.length).toBe(1);
    expect(negative[0].index).toBe(10);
  });
});

describe('matchBySlope', () => {
  it('should filter crossings within slope tolerance', () => {
    const crossings: ZeroCrossing[] = [
      { index: 0, polarity: 'positive', slope: 0.5 },
      { index: 10, polarity: 'positive', slope: 0.45 },
      { index: 20, polarity: 'positive', slope: 0.1 },
      { index: 30, polarity: 'positive', slope: 0.55 },
    ];

    const matched = matchBySlope(crossings, 0.5, 0.1);

    expect(matched.length).toBe(3);
    expect(matched.map((c) => c.index)).toEqual([0, 10, 30]);
  });

  it('should return empty array when no crossings match', () => {
    const crossings: ZeroCrossing[] = [
      { index: 0, polarity: 'positive', slope: 0.5 },
      { index: 10, polarity: 'positive', slope: 0.6 },
    ];

    const matched = matchBySlope(crossings, 0.1, 0.05);

    expect(matched.length).toBe(0);
  });
});

describe('findMatchingCrossings', () => {
  it('should find crossings matching both polarity and slope', () => {
    const crossings: ZeroCrossing[] = [
      { index: 0, polarity: 'positive', slope: 0.5 },
      { index: 10, polarity: 'negative', slope: 0.5 },
      { index: 20, polarity: 'positive', slope: 0.1 },
      { index: 30, polarity: 'positive', slope: 0.48 },
    ];

    const reference: ZeroCrossing = { index: 100, polarity: 'positive', slope: 0.5 };

    const matched = findMatchingCrossings(crossings, reference, 0.1);

    expect(matched.length).toBe(2);
    expect(matched[0].index).toBe(0);
    expect(matched[1].index).toBe(30);
  });
});

describe('calculateSlopeScore', () => {
  it('should return 1.0 for identical slopes', () => {
    const c1: ZeroCrossing = { index: 0, polarity: 'positive', slope: 0.5 };
    const c2: ZeroCrossing = { index: 100, polarity: 'positive', slope: 0.5 };

    expect(calculateSlopeScore(c1, c2)).toBe(1.0);
  });

  it('should return 0.0 for maximum slope difference', () => {
    const c1: ZeroCrossing = { index: 0, polarity: 'positive', slope: 1.0 };
    const c2: ZeroCrossing = { index: 100, polarity: 'negative', slope: -1.0 };

    expect(calculateSlopeScore(c1, c2)).toBe(0.0);
  });

  it('should return 0.5 for half-maximum slope difference', () => {
    const c1: ZeroCrossing = { index: 0, polarity: 'positive', slope: 0.5 };
    const c2: ZeroCrossing = { index: 100, polarity: 'positive', slope: -0.5 };

    expect(calculateSlopeScore(c1, c2)).toBe(0.5);
  });
});

describe('generateCandidatePairs', () => {
  it('should generate pairs matching polarity', () => {
    const startCrossings: ZeroCrossing[] = [
      { index: 0, polarity: 'positive', slope: 0.5 },
      { index: 10, polarity: 'negative', slope: -0.5 },
    ];

    const endCrossings: ZeroCrossing[] = [
      { index: 100, polarity: 'positive', slope: 0.5 },
      { index: 110, polarity: 'negative', slope: -0.5 },
    ];

    const pairs = generateCandidatePairs(startCrossings, endCrossings);

    // Should generate 2 pairs (positive matches positive, negative matches negative)
    expect(pairs.length).toBe(2);
    expect(pairs[0].loopStart).toBe(0);
    expect(pairs[0].loopEnd).toBe(100);
    expect(pairs[1].loopStart).toBe(10);
    expect(pairs[1].loopEnd).toBe(110);
  });

  it('should enforce minimum loop length', () => {
    const startCrossings: ZeroCrossing[] = [{ index: 90, polarity: 'positive', slope: 0.5 }];

    const endCrossings: ZeroCrossing[] = [{ index: 100, polarity: 'positive', slope: 0.5 }];

    // Loop length of 10 is less than minimum of 32
    const pairs = generateCandidatePairs(startCrossings, endCrossings, HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH);

    expect(pairs.length).toBe(0);
  });

  it('should filter by slope tolerance when specified', () => {
    const startCrossings: ZeroCrossing[] = [
      { index: 0, polarity: 'positive', slope: 0.5 },
      { index: 10, polarity: 'positive', slope: 0.1 },
    ];

    const endCrossings: ZeroCrossing[] = [{ index: 100, polarity: 'positive', slope: 0.48 }];

    const pairs = generateCandidatePairs(startCrossings, endCrossings, 32, 0.1);

    // Only first start crossing matches within tolerance
    expect(pairs.length).toBe(1);
    expect(pairs[0].loopStart).toBe(0);
  });
});
