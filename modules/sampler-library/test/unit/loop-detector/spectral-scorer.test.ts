import { describe, it, expect } from 'vitest';
import {
  createHannWindow,
  computeLogMagnitudeSpectrum,
  calculateSpectralDistance,
  scoreSpectralSimilarity,
  normalizeSpectralDistance,
  calculateOptimalFFTSize,
} from '@/loop-detector/spectral-scorer.js';

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

describe('createHannWindow', () => {
  it('should create a window of specified size', () => {
    const window = createHannWindow(512);
    expect(window.length).toBe(512);
  });

  it('should have zero at endpoints', () => {
    const window = createHannWindow(1024);
    expect(window[0]).toBeCloseTo(0, 5);
    expect(window[1023]).toBeCloseTo(0, 5);
  });

  it('should have maximum at center', () => {
    const window = createHannWindow(1024);
    const center = Math.floor(1024 / 2);

    // Center should be maximum
    expect(window[center]).toBeCloseTo(1, 5);

    // Center should be greater than edges
    expect(window[center]).toBeGreaterThan(window[100]);
    expect(window[center]).toBeGreaterThan(window[900]);
  });

  it('should be symmetric', () => {
    const window = createHannWindow(1024);

    for (let i = 0; i < 512; i++) {
      expect(window[i]).toBeCloseTo(window[1023 - i], 10);
    }
  });
});

describe('computeLogMagnitudeSpectrum', () => {
  it('should return spectrum of correct length', () => {
    const samples = generateSineWave(440, 44100, 2048);
    const spectrum = computeLogMagnitudeSpectrum(samples, 1024, 1024);

    // FFT of size N gives N/2 + 1 unique frequency bins
    expect(spectrum.length).toBe(1024 / 2 + 1);
  });

  it('should detect frequency content at correct bin', () => {
    const sampleRate = 30000;
    const frequency = 1000;
    const samples = generateSineWave(frequency, sampleRate, 4096);

    const fftSize = 1024;
    const spectrum = computeLogMagnitudeSpectrum(samples, 2048, fftSize);

    // Frequency bin = frequency * fftSize / sampleRate
    const expectedBin = Math.round((frequency * fftSize) / sampleRate);

    // Find maximum bin
    let maxBin = 0;
    let maxValue = spectrum[0];
    for (let i = 1; i < spectrum.length; i++) {
      if (spectrum[i] > maxValue) {
        maxValue = spectrum[i];
        maxBin = i;
      }
    }

    // Maximum should be near expected frequency bin (allow some tolerance for windowing)
    expect(Math.abs(maxBin - expectedBin)).toBeLessThan(3);
  });

  it('should handle out-of-bounds center index by zero-padding', () => {
    const samples = new Int16Array(100);
    samples.fill(10000);

    // Center near start - will need zero padding at left
    const spectrum1 = computeLogMagnitudeSpectrum(samples, 10, 512);
    expect(spectrum1.length).toBe(512 / 2 + 1);

    // Center near end - will need zero padding at right
    const spectrum2 = computeLogMagnitudeSpectrum(samples, 90, 512);
    expect(spectrum2.length).toBe(512 / 2 + 1);
  });
});

describe('calculateSpectralDistance', () => {
  it('should return 0 for identical spectra', () => {
    const spectrum = new Float32Array([1, 2, 3, 4, 5]);
    const distance = calculateSpectralDistance(spectrum, spectrum);
    expect(distance).toBe(0);
  });

  it('should return correct L2 distance', () => {
    const spectrum1 = new Float32Array([1, 0, 0]);
    const spectrum2 = new Float32Array([0, 0, 0]);

    const distance = calculateSpectralDistance(spectrum1, spectrum2);
    expect(distance).toBe(1);
  });

  it('should throw for different length spectra', () => {
    const spectrum1 = new Float32Array([1, 2, 3]);
    const spectrum2 = new Float32Array([1, 2]);

    expect(() => calculateSpectralDistance(spectrum1, spectrum2)).toThrow();
  });

  it('should be symmetric', () => {
    const spectrum1 = new Float32Array([1, 2, 3, 4]);
    const spectrum2 = new Float32Array([4, 3, 2, 1]);

    const dist12 = calculateSpectralDistance(spectrum1, spectrum2);
    const dist21 = calculateSpectralDistance(spectrum2, spectrum1);

    expect(dist12).toBe(dist21);
  });
});

describe('scoreSpectralSimilarity', () => {
  it('should return high score for same frequency content', () => {
    const sampleRate = 30000;
    const frequency = 440;
    const samples = generateSineWave(frequency, sampleRate, 4096);

    // Compare two nearby regions (should have same spectral content)
    const score = scoreSpectralSimilarity(samples, 1000, 2000, 512);

    // Same frequency throughout - should have high similarity
    expect(score).toBeGreaterThan(0.8);
  });

  it('should return lower score for different frequency content', () => {
    const sampleRate = 30000;
    const samples = new Int16Array(4096);

    // First half: 440 Hz
    for (let i = 0; i < 2048; i++) {
      const t = i / sampleRate;
      samples[i] = Math.round(20000 * Math.sin(2 * Math.PI * 440 * t));
    }

    // Second half: 880 Hz (octave higher)
    for (let i = 2048; i < 4096; i++) {
      const t = i / sampleRate;
      samples[i] = Math.round(20000 * Math.sin(2 * Math.PI * 880 * t));
    }

    // Compare regions with different frequencies
    const score = scoreSpectralSimilarity(samples, 1000, 3000, 512);

    // Different frequencies - should have lower similarity
    expect(score).toBeLessThan(0.7);
  });
});

describe('normalizeSpectralDistance', () => {
  it('should return 1.0 for zero distance', () => {
    expect(normalizeSpectralDistance(0)).toBe(1.0);
  });

  it('should return values approaching 0 for large distances', () => {
    expect(normalizeSpectralDistance(50)).toBeLessThan(0.01);
    expect(normalizeSpectralDistance(100)).toBeLessThan(0.0001);
  });

  it('should return intermediate values for typical distances', () => {
    const score5 = normalizeSpectralDistance(5);
    const score10 = normalizeSpectralDistance(10);
    const score20 = normalizeSpectralDistance(20);

    // Should decrease monotonically
    expect(score5).toBeGreaterThan(score10);
    expect(score10).toBeGreaterThan(score20);

    // Should be in reasonable range
    expect(score5).toBeGreaterThan(0.5);
    expect(score5).toBeLessThan(0.8);
  });
});

describe('calculateOptimalFFTSize', () => {
  it('should return power of 2', () => {
    const sizes = [
      calculateOptimalFFTSize(30000),
      calculateOptimalFFTSize(15000),
      calculateOptimalFFTSize(44100),
    ];

    for (const size of sizes) {
      expect(Math.log2(size) % 1).toBe(0);
    }
  });

  it('should be within expected range', () => {
    const size = calculateOptimalFFTSize(30000);

    // Should be between 512 and 4096 based on implementation
    expect(size).toBeGreaterThanOrEqual(512);
    expect(size).toBeLessThanOrEqual(4096);
  });

  it('should respect frequency resolution parameter', () => {
    // Higher frequency resolution requires larger FFT
    const lowRes = calculateOptimalFFTSize(30000, 100);
    const highRes = calculateOptimalFFTSize(30000, 25);

    expect(highRes).toBeGreaterThanOrEqual(lowRes);
  });
});
