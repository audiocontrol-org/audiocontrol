import { describe, it, expect } from 'vitest';
import { findSustainStart, analyzeAttack } from '@/loop-detector/transient-excluder.js';
import { msToSamples } from '@/sample-chopper/audio-utils.js';

/**
 * Generate a sample with attack and sustain phases.
 */
function generateAttackSustain(
  attackMs: number,
  sustainMs: number,
  sampleRate: number
): Int16Array {
  const attackSamples = msToSamples(attackMs, sampleRate);
  const sustainSamples = msToSamples(sustainMs, sampleRate);
  const totalSamples = attackSamples + sustainSamples;

  const samples = new Int16Array(totalSamples);

  // Attack phase: ramp up
  for (let i = 0; i < attackSamples; i++) {
    const progress = i / attackSamples;
    const envelope = Math.sin((progress * Math.PI) / 2); // Smooth ramp
    samples[i] = Math.round(30000 * envelope);
  }

  // Sustain phase: constant amplitude
  for (let i = attackSamples; i < totalSamples; i++) {
    samples[i] = 30000;
  }

  return samples;
}

/**
 * Generate a percussive sample (sharp attack, fast decay).
 */
function generatePercussive(sampleRate: number, durationMs: number): Int16Array {
  const samples = new Int16Array(msToSamples(durationMs, sampleRate));

  for (let i = 0; i < samples.length; i++) {
    const progress = i / samples.length;
    // Sharp attack, exponential decay
    const envelope = Math.exp(-progress * 10);
    samples[i] = Math.round(30000 * envelope * Math.sin(progress * 100));
  }

  return samples;
}

/**
 * Generate a sustained sine wave at a specific frequency.
 * Simulates low-frequency bass sounds that previously caused sustain detection issues.
 */
function generateSustainedSine(
  frequencyHz: number,
  durationMs: number,
  sampleRate: number
): Int16Array {
  const samples = new Int16Array(msToSamples(durationMs, sampleRate));

  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    samples[i] = Math.round(25000 * Math.sin(2 * Math.PI * frequencyHz * t));
  }

  return samples;
}

/**
 * Generate a low-frequency sine with an attack envelope.
 * The amplitude ramps up over attackMs, then sustains.
 */
function generateLowFreqWithAttack(
  frequencyHz: number,
  attackMs: number,
  sustainMs: number,
  sampleRate: number
): Int16Array {
  const attackSamples = msToSamples(attackMs, sampleRate);
  const totalSamples = attackSamples + msToSamples(sustainMs, sampleRate);
  const samples = new Int16Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const sineValue = Math.sin(2 * Math.PI * frequencyHz * t);

    // Apply attack envelope
    let envelope = 1.0;
    if (i < attackSamples) {
      envelope = i / attackSamples;
    }

    samples[i] = Math.round(25000 * envelope * sineValue);
  }

  return samples;
}

describe('findSustainStart', () => {
  it('should find sustain region in attack-sustain signal', () => {
    const sampleRate = 30000;
    const attackMs = 50;
    const samples = generateAttackSustain(attackMs, 200, sampleRate);

    const sustainStart = findSustainStart(samples, sampleRate);

    // Should be near the end of attack phase (with some tolerance for algorithm)
    const expectedMin = msToSamples(attackMs * 0.5, sampleRate);
    const expectedMax = msToSamples(attackMs * 2, sampleRate);

    expect(sustainStart).toBeGreaterThanOrEqual(expectedMin);
    expect(sustainStart).toBeLessThanOrEqual(expectedMax);
  });

  it('should respect minimum sustain offset', () => {
    const sampleRate = 30000;
    const minOffsetMs = 100;
    const samples = generateAttackSustain(10, 200, sampleRate);

    const sustainStart = findSustainStart(samples, sampleRate, {
      minSustainOffsetMs: minOffsetMs,
    });

    const minOffsetSamples = msToSamples(minOffsetMs, sampleRate);
    expect(sustainStart).toBeGreaterThanOrEqual(minOffsetSamples);
  });

  it('should return minimum offset for silent sample', () => {
    const sampleRate = 30000;
    const samples = new Int16Array(1000); // All zeros
    const minOffsetMs = 50;

    const sustainStart = findSustainStart(samples, sampleRate, {
      minSustainOffsetMs: minOffsetMs,
    });

    const minOffsetSamples = msToSamples(minOffsetMs, sampleRate);
    expect(sustainStart).toBe(Math.min(minOffsetSamples, samples.length));
  });

  it('should handle very short samples', () => {
    const sampleRate = 30000;
    const samples = new Int16Array(10);
    samples.fill(1000);

    // Should not crash
    const sustainStart = findSustainStart(samples, sampleRate);

    expect(sustainStart).toBeGreaterThanOrEqual(0);
    expect(sustainStart).toBeLessThanOrEqual(samples.length);
  });

  it('should find sustain in percussive sample', () => {
    const sampleRate = 30000;
    const samples = generatePercussive(sampleRate, 500);

    const sustainStart = findSustainStart(samples, sampleRate);

    // Should be past the initial transient
    expect(sustainStart).toBeGreaterThan(0);
  });

  it('should handle constant amplitude signal', () => {
    const sampleRate = 30000;
    const samples = new Int16Array(3000);
    samples.fill(20000);

    const sustainStart = findSustainStart(samples, sampleRate, {
      minSustainOffsetMs: 50,
    });

    // Constant signal has no attack, should return minimum offset
    const minOffsetSamples = msToSamples(50, sampleRate);
    expect(sustainStart).toBe(minOffsetSamples);
  });

  describe('low-frequency bass sounds', () => {
    it('should detect sustain early for 130Hz sustained sine (C3 bass)', () => {
      const sampleRate = 30000;
      // 130Hz = ~7.7ms per cycle, need 500ms+ for meaningful test
      const samples = generateSustainedSine(130, 1000, sampleRate);

      const sustainStart = findSustainStart(samples, sampleRate);

      // Sustain should be detected early (within first 25% of sample)
      const maxSustainPosition = samples.length * 0.25;
      expect(sustainStart).toBeLessThanOrEqual(maxSustainPosition);
    });

    it('should detect sustain early for 40Hz sustained sine (sub-bass)', () => {
      const sampleRate = 30000;
      // 40Hz = 25ms per cycle, very low frequency
      const samples = generateSustainedSine(40, 1000, sampleRate);

      const sustainStart = findSustainStart(samples, sampleRate);

      // Sub-bass should also be detected as stable early
      const maxSustainPosition = samples.length * 0.25;
      expect(sustainStart).toBeLessThanOrEqual(maxSustainPosition);
    });

    it('should detect attack correctly for low-freq with envelope', () => {
      const sampleRate = 30000;
      const attackMs = 80;
      // 130Hz bass with attack phase
      const samples = generateLowFreqWithAttack(130, attackMs, 500, sampleRate);

      const sustainStart = findSustainStart(samples, sampleRate);

      // Should detect sustain after the attack but within reasonable bounds
      const minSustainOffset = msToSamples(50, sampleRate);
      const maxSustainPosition = samples.length * 0.25;

      expect(sustainStart).toBeGreaterThanOrEqual(minSustainOffset);
      expect(sustainStart).toBeLessThanOrEqual(maxSustainPosition);
    });

    it('should respect maxSustainPositionRatio config', () => {
      const sampleRate = 30000;
      const samples = generateSustainedSine(130, 1000, sampleRate);

      // Test with different cap ratios
      const sustainWith10Percent = findSustainStart(samples, sampleRate, {
        maxSustainPositionRatio: 0.10,
      });
      const sustainWith50Percent = findSustainStart(samples, sampleRate, {
        maxSustainPositionRatio: 0.50,
      });

      // With 10% cap, sustain should be at most 10% into sample
      expect(sustainWith10Percent).toBeLessThanOrEqual(samples.length * 0.10);

      // Both should respect their respective caps
      expect(sustainWith50Percent).toBeLessThanOrEqual(samples.length * 0.50);
    });

    it('should use stableEnvelopeVarianceThreshold for sustained signals', () => {
      const sampleRate = 30000;
      const samples = generateSustainedSine(130, 1000, sampleRate);
      const minOffsetSamples = msToSamples(50, sampleRate);

      // With a high variance threshold, stable samples should return early
      const sustainWithHighThreshold = findSustainStart(samples, sampleRate, {
        stableEnvelopeVarianceThreshold: 0.5, // Very permissive
        minSustainOffsetMs: 50,
      });

      // Should return minimum offset for stable sample
      expect(sustainWithHighThreshold).toBe(minOffsetSamples);

      // With a very low threshold, stable check won't trigger
      // (but sanity cap will still apply)
      const sustainWithLowThreshold = findSustainStart(samples, sampleRate, {
        stableEnvelopeVarianceThreshold: 0.0001, // Very strict
        maxSustainPositionRatio: 0.25,
      });

      // Should still be capped at 25%
      expect(sustainWithLowThreshold).toBeLessThanOrEqual(samples.length * 0.25);
    });
  });
});

describe('analyzeAttack', () => {
  it('should detect attack in attack-sustain signal', () => {
    const sampleRate = 30000;
    const attackMs = 50;
    const samples = generateAttackSustain(attackMs, 200, sampleRate);

    const analysis = analyzeAttack(samples, sampleRate);

    expect(analysis.hasDetectedAttack).toBe(true);
    expect(analysis.attackDurationMs).toBeGreaterThan(0);
    expect(analysis.peakRms).toBeGreaterThan(0);
  });

  it('should find peak in attack signal', () => {
    const sampleRate = 30000;
    const samples = generateAttackSustain(50, 200, sampleRate);

    const analysis = analyzeAttack(samples, sampleRate);

    // Peak should be after attack phase
    const attackSamples = msToSamples(50, sampleRate);
    expect(analysis.peakIndex).toBeGreaterThanOrEqual(attackSamples * 0.5);
  });

  it('should return sustain start index', () => {
    const sampleRate = 30000;
    const samples = generateAttackSustain(50, 200, sampleRate);

    const analysis = analyzeAttack(samples, sampleRate);

    expect(analysis.sustainStartIndex).toBeGreaterThan(0);
    expect(analysis.sustainStartIndex).toBeLessThan(samples.length);
  });

  it('should handle empty sample', () => {
    const sampleRate = 30000;
    const samples = new Int16Array(0);

    const analysis = analyzeAttack(samples, sampleRate);

    expect(analysis.hasDetectedAttack).toBe(false);
    expect(analysis.peakRms).toBe(0);
    expect(analysis.attackDurationMs).toBe(0);
  });

  it('should handle silent sample', () => {
    const sampleRate = 30000;
    const samples = new Int16Array(3000); // All zeros

    const analysis = analyzeAttack(samples, sampleRate);

    expect(analysis.peakRms).toBe(0);
  });

  it('should calculate attack duration correctly', () => {
    const sampleRate = 30000;
    const attackMs = 100;
    const samples = generateAttackSustain(attackMs, 200, sampleRate);

    const analysis = analyzeAttack(samples, sampleRate);

    // Attack duration should be roughly equal to attack length
    // (with tolerance for algorithm differences)
    expect(analysis.attackDurationMs).toBeGreaterThan(attackMs * 0.3);
    expect(analysis.attackDurationMs).toBeLessThan(attackMs * 3);
  });
});
