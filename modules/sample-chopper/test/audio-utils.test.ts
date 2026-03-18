/**
 * Audio utilities unit tests.
 */

import { describe, it, expect } from 'vitest';
import {
  msToSamples,
  samplesToMs,
  calculateRms,
  calculatePeak,
  amplitudeToDb,
  dbToAmplitude,
  calculateRmsWindowed,
  findOnsetAboveThreshold,
  findSilenceStart,
} from '@/audio-utils.js';

describe('msToSamples', () => {
  it('should convert 1000ms to samples at 44100Hz', () => {
    expect(msToSamples(1000, 44100)).toBe(44100);
  });

  it('should convert 500ms to samples at 15000Hz', () => {
    expect(msToSamples(500, 15000)).toBe(7500);
  });

  it('should round to nearest sample', () => {
    expect(msToSamples(100, 44100)).toBe(4410);
  });

  it('should handle 0ms', () => {
    expect(msToSamples(0, 44100)).toBe(0);
  });
});

describe('samplesToMs', () => {
  it('should convert samples to ms at 44100Hz', () => {
    expect(samplesToMs(44100, 44100)).toBe(1000);
  });

  it('should convert samples to ms at 15000Hz', () => {
    expect(samplesToMs(7500, 15000)).toBe(500);
  });

  it('should handle 0 samples', () => {
    expect(samplesToMs(0, 44100)).toBe(0);
  });
});

describe('calculateRms', () => {
  it('should return 0 for silent samples', () => {
    const samples = new Int16Array(100);
    expect(calculateRms(samples, 0, 100)).toBe(0);
  });

  it('should return ~0.707 for full-scale sine wave', () => {
    const samples = new Int16Array(100);
    for (let i = 0; i < 100; i++) {
      samples[i] = 16384; // ~50% amplitude
    }
    const rms = calculateRms(samples, 0, 100);
    expect(rms).toBeCloseTo(0.5, 1);
  });

  it('should handle partial ranges', () => {
    const samples = new Int16Array(100);
    for (let i = 50; i < 100; i++) {
      samples[i] = 32767;
    }
    expect(calculateRms(samples, 0, 50)).toBe(0);
    expect(calculateRms(samples, 50, 50)).toBeCloseTo(1.0, 1);
  });

  it('should return 0 for empty length', () => {
    const samples = new Int16Array([32767]);
    expect(calculateRms(samples, 0, 0)).toBe(0);
  });
});

describe('calculatePeak', () => {
  it('should return 0 for silent samples', () => {
    const samples = new Int16Array(100);
    expect(calculatePeak(samples, 0, 100)).toBe(0);
  });

  it('should return peak amplitude for mixed samples', () => {
    const samples = new Int16Array([0, 16384, -8192, 24576, -32768]);
    const peak = calculatePeak(samples, 0, 5);
    expect(peak).toBeCloseTo(1.0, 1);
  });

  it('should find peak in specified range', () => {
    const samples = new Int16Array([32767, 0, 0, 16384, 0]);
    expect(calculatePeak(samples, 1, 4)).toBeCloseTo(0.5, 1);
  });
});

describe('amplitudeToDb', () => {
  it('should convert 1.0 to 0 dB', () => {
    expect(amplitudeToDb(1.0)).toBe(0);
  });

  it('should convert 0.5 to ~-6 dB', () => {
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.02, 1);
  });

  it('should convert 0.1 to ~-20 dB', () => {
    expect(amplitudeToDb(0.1)).toBeCloseTo(-20, 1);
  });

  it('should return -Infinity for 0', () => {
    expect(amplitudeToDb(0)).toBe(-Infinity);
  });
});

describe('dbToAmplitude', () => {
  it('should convert 0 dB to 1.0', () => {
    expect(dbToAmplitude(0)).toBe(1.0);
  });

  it('should convert -6 dB to ~0.5', () => {
    expect(dbToAmplitude(-6)).toBeCloseTo(0.5, 1);
  });

  it('should convert -20 dB to ~0.1', () => {
    expect(dbToAmplitude(-20)).toBeCloseTo(0.1, 1);
  });

  it('should return 0 for -Infinity', () => {
    expect(dbToAmplitude(-Infinity)).toBe(0);
  });
});

describe('calculateRmsWindowed', () => {
  it('should return array of RMS values', () => {
    const samples = new Int16Array(1000);
    for (let i = 0; i < 500; i++) {
      samples[i] = 16384;
    }

    const rmsValues = calculateRmsWindowed(samples, 100, 100);

    expect(rmsValues.length).toBe(10);
    expect(rmsValues[0]).toBeGreaterThan(0.4);
    expect(rmsValues[4]).toBeGreaterThan(0.4);
    expect(rmsValues[5]).toBe(0);
    expect(rmsValues[9]).toBe(0);
  });

  it('should handle overlapping windows', () => {
    const samples = new Int16Array(200);
    const rmsValues = calculateRmsWindowed(samples, 100, 50);
    expect(rmsValues.length).toBe(3);
  });
});

describe('findOnsetAboveThreshold', () => {
  it('should find first sample above threshold', () => {
    const samples = new Int16Array([0, 0, 0, 16384, 16384, 0]);
    const onset = findOnsetAboveThreshold(samples, 0.5, 0);
    expect(onset).toBe(3);
  });

  it('should return -1 if no onset found', () => {
    const samples = new Int16Array([0, 0, 0, 0]);
    const onset = findOnsetAboveThreshold(samples, 0.5, 0);
    expect(onset).toBe(-1);
  });

  it('should start from specified index', () => {
    const samples = new Int16Array([16384, 0, 0, 16384]);
    const onset = findOnsetAboveThreshold(samples, 0.5, 2);
    expect(onset).toBe(3);
  });

  it('should detect negative peaks', () => {
    const samples = new Int16Array([0, 0, -16384, 0]);
    const onset = findOnsetAboveThreshold(samples, 0.5, 0);
    expect(onset).toBe(2);
  });
});

describe('findSilenceStart', () => {
  it('should find where signal drops below threshold', () => {
    const samples = new Int16Array(100);
    for (let i = 0; i < 50; i++) {
      samples[i] = 16384;
    }

    const silenceStart = findSilenceStart(samples, 0.5, 0, 1);
    expect(silenceStart).toBe(50);
  });

  it('should require minimum duration below threshold', () => {
    const samples = new Int16Array([16384, 0, 16384, 0, 0, 0, 0, 0]);
    const silenceStart = findSilenceStart(samples, 0.5, 0, 5);
    expect(silenceStart).toBe(3);
  });

  it('should return samples.length if no silence found', () => {
    const samples = new Int16Array(100);
    for (let i = 0; i < 100; i++) {
      samples[i] = 16384;
    }
    const silenceStart = findSilenceStart(samples, 0.5, 0, 1);
    expect(silenceStart).toBe(100);
  });
});
