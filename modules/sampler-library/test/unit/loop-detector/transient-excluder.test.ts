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
