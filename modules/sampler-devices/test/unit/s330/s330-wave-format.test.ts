/**
 * Unit tests for S330 wave format conversion functions.
 *
 * These tests verify the resampling, bit depth conversion, and encoding
 * used when converting WAV files to S-330 format.
 */

import { describe, it, expect } from 'vitest';
import {
  resample,
  parseWav,
  wavToS330,
  s330ToWav,
  prepareWavForS330,
  createWav,
} from '../../../src/devices/s330/s330-wave-format.js';

describe('resample', () => {
  it('returns same array when rates are equal', () => {
    const source = new Int16Array([100, 200, 300, 400, 500]);
    const result = resample(source, 44100, 44100);
    expect(result).toBe(source); // Same reference
  });

  it('downsamples 44100 Hz to 15000 Hz', () => {
    // Create 1 second of 44.1kHz samples (silence with markers)
    const source = new Int16Array(44100);
    // Put markers at regular intervals
    for (let i = 0; i < source.length; i += 4410) {
      source[i] = 1000;
    }

    const result = resample(source, 44100, 15000);

    // Should produce ~15000 samples (1 second at 15kHz)
    expect(result.length).toBe(15000);

    // Duration should be preserved: 1 second in = 1 second out
    const sourceDuration = source.length / 44100;
    const resultDuration = result.length / 15000;
    expect(resultDuration).toBeCloseTo(sourceDuration, 2);
  });

  it('downsamples 44100 Hz to 30000 Hz', () => {
    const source = new Int16Array(44100);
    const result = resample(source, 44100, 30000);

    expect(result.length).toBe(30000);

    // Duration preserved
    const sourceDuration = source.length / 44100;
    const resultDuration = result.length / 30000;
    expect(resultDuration).toBeCloseTo(sourceDuration, 2);
  });

  it('downsamples 48000 Hz to 15000 Hz', () => {
    const source = new Int16Array(48000); // 1 second at 48kHz
    const result = resample(source, 48000, 15000);

    expect(result.length).toBe(15000);
  });

  it('upsamples 15000 Hz to 30000 Hz', () => {
    const source = new Int16Array(15000);
    const result = resample(source, 15000, 30000);

    expect(result.length).toBe(30000);
  });

  it('preserves sample values through interpolation', () => {
    // Simple 2:1 downsampling should average adjacent samples
    const source = new Int16Array([1000, 1000, -1000, -1000]);
    const result = resample(source, 4, 2);

    expect(result.length).toBe(2);
    // Linear interpolation at positions 0 and 2
    expect(result[0]).toBe(1000); // Position 0
    expect(result[1]).toBe(-1000); // Position 2
  });

  it('handles short samples', () => {
    // 2 samples at 44.1kHz = 0.000045 seconds
    // At 15kHz, that's 0.68 samples, which rounds to 0
    // This is mathematically correct - the resample function preserves duration
    const source = new Int16Array([32767, -32768]);
    const result = resample(source, 44100, 15000);

    // For such a tiny duration, 0 samples is mathematically correct
    // newLength = floor(2 / (44100/15000)) = floor(0.68) = 0
    expect(result.length).toBe(0);
  });

  it('handles minimum viable sample length', () => {
    // Need at least 3 samples at 44.1kHz to get 1 sample at 15kHz
    // newLength = floor(3 / 2.94) = floor(1.02) = 1
    const source = new Int16Array([32767, 0, -32768]);
    const result = resample(source, 44100, 15000);

    expect(result.length).toBe(1);
  });

  it('maintains correct ratio for arbitrary lengths', () => {
    // 0.92 seconds at 44.1kHz (like the KICK sample)
    const sourceSamples = Math.floor(0.92 * 44100); // 40572 samples
    const source = new Int16Array(sourceSamples);

    const result = resample(source, 44100, 15000);

    // Expected: 40572 * (15000/44100) = 13802 samples
    const expectedSamples = Math.floor(sourceSamples * (15000 / 44100));
    expect(result.length).toBe(expectedSamples);

    // Verify duration is preserved
    const sourceDuration = sourceSamples / 44100;
    const resultDuration = result.length / 15000;
    expect(resultDuration).toBeCloseTo(sourceDuration, 2);
  });
});

describe('parseWav', () => {
  function createTestWav(
    sampleRate: number,
    bitsPerSample: number,
    samples: number[],
    channels = 1
  ): ArrayBuffer {
    const bytesPerSample = bitsPerSample / 8;
    const dataSize = samples.length * bytesPerSample;
    const headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    view.setUint32(4, headerSize + dataSize - 8, true);
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));

    // fmt chunk
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * bytesPerSample, true);
    view.setUint16(32, channels * bytesPerSample, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataSize, true);

    // Sample data
    for (let i = 0; i < samples.length; i++) {
      if (bitsPerSample === 16) {
        view.setInt16(44 + i * 2, samples[i]!, true);
      } else if (bitsPerSample === 24) {
        const sample = samples[i]!;
        view.setUint8(44 + i * 3, sample & 0xff);
        view.setUint8(44 + i * 3 + 1, (sample >> 8) & 0xff);
        view.setInt8(44 + i * 3 + 2, sample >> 16);
      }
    }

    return buffer;
  }

  it('parses 16-bit WAV correctly', () => {
    const wav = createTestWav(44100, 16, [0, 16384, 32767, -32768, -16384]);
    const result = parseWav(wav);

    expect(result.sampleRate).toBe(44100);
    expect(result.bitsPerSample).toBe(16);
    expect(result.channels).toBe(1);
    expect(result.samples.length).toBe(5);
    expect(result.samples[0]).toBe(0);
    expect(result.samples[2]).toBe(32767);
    expect(result.samples[3]).toBe(-32768);
  });

  it('parses 24-bit WAV and scales to 16-bit', () => {
    // 24-bit max positive: 8388607, scaled to 16-bit: 32767
    const wav = createTestWav(44100, 24, [0, 8388607, -8388608]);
    const result = parseWav(wav);

    expect(result.sampleRate).toBe(44100);
    expect(result.bitsPerSample).toBe(24);
    expect(result.samples.length).toBe(3);
    // 24-bit samples are scaled down by >> 8
    expect(result.samples[1]).toBe(32767);
    expect(result.samples[2]).toBe(-32768);
  });

  it('reads sample rate correctly', () => {
    const wav44 = createTestWav(44100, 16, [0]);
    const wav48 = createTestWav(48000, 16, [0]);
    const wav96 = createTestWav(96000, 16, [0]);

    expect(parseWav(wav44).sampleRate).toBe(44100);
    expect(parseWav(wav48).sampleRate).toBe(48000);
    expect(parseWav(wav96).sampleRate).toBe(96000);
  });
});

describe('wavToS330', () => {
  it('resamples and encodes to 12-bit', () => {
    const wavData = {
      sampleRate: 44100,
      channels: 1,
      bitsPerSample: 16,
      samples: new Int16Array(44100), // 1 second of silence
    };

    const result = wavToS330(wavData, 15000);

    expect(result.sampleRate).toBe(15000);
    expect(result.sampleCount).toBe(15000);
    expect(result.data.length).toBe(15000 * 2); // 2 bytes per sample
  });

  it('encodes samples as 7-bit MIDI-safe bytes', () => {
    const wavData = {
      sampleRate: 15000,
      channels: 1,
      bitsPerSample: 16,
      samples: new Int16Array([32767, -32768, 0]), // Max, min, zero
    };

    const result = wavToS330(wavData, 15000);

    // All bytes should be < 128 (MIDI safe)
    for (let i = 0; i < result.data.length; i++) {
      expect(result.data[i]).toBeLessThan(128);
    }
  });
});

describe('s330ToWav round-trip', () => {
  it('preserves sample structure through encode/decode', () => {
    const original = {
      sampleRate: 15000 as const,
      channels: 1,
      bitsPerSample: 16,
      samples: new Int16Array([0, 4096, 8192, -4096, -8192]),
    };

    const encoded = wavToS330(original, 15000);
    const decoded = s330ToWav(encoded.data, 15000);

    expect(decoded.length).toBe(original.samples.length);

    // Values should be close (12-bit precision loss is expected)
    for (let i = 0; i < original.samples.length; i++) {
      // 12-bit has ~16x less precision than 16-bit
      expect(Math.abs(decoded[i]! - original.samples[i]!)).toBeLessThan(32);
    }
  });
});

describe('prepareWavForS330', () => {
  function createSimpleWav(sampleRate: number, sampleCount: number): ArrayBuffer {
    const samples = new Int16Array(sampleCount);
    return createWav(samples, sampleRate);
  }

  it('converts 44.1kHz WAV to 15kHz S330 format', () => {
    const wav = createSimpleWav(44100, 44100); // 1 second
    const result = prepareWavForS330(wav, 15000);

    expect(result.sampleRate).toBe(15000);
    expect(result.sampleCount).toBe(15000);
    expect(result.data.length).toBe(15000 * 2);
    expect(result.segmentLength).toBe(2); // 15000 samples = 2 segments (12000 each)

    // Source info should be captured
    expect(result.source.sampleRate).toBe(44100);
    expect(result.source.sampleCount).toBe(44100);
    expect(result.source.duration).toBeCloseTo(1.0, 2);
  });

  it('converts 44.1kHz WAV to 30kHz S330 format', () => {
    const wav = createSimpleWav(44100, 44100);
    const result = prepareWavForS330(wav, 30000);

    expect(result.sampleRate).toBe(30000);
    expect(result.sampleCount).toBe(30000);
  });

  it('preserves duration for realistic drum sample', () => {
    // Simulate KICK 01.wav: 44100 Hz, 0.92s duration
    const sourceSamples = Math.floor(44100 * 0.92); // 40572
    const wav = createSimpleWav(44100, sourceSamples);
    const result = prepareWavForS330(wav, 15000);

    // Duration should be preserved
    const sourceDuration = sourceSamples / 44100;
    const resultDuration = result.sampleCount / 15000;
    expect(resultDuration).toBeCloseTo(sourceDuration, 2);

    // Source info captured
    expect(result.source.sampleRate).toBe(44100);
    expect(result.source.sampleCount).toBe(sourceSamples);
  });

  it('calculates correct segment count', () => {
    // 12000 samples per segment
    const wav1 = createSimpleWav(15000, 12000); // Exactly 1 segment
    const wav2 = createSimpleWav(15000, 12001); // Just over 1 segment
    const wav3 = createSimpleWav(15000, 24000); // Exactly 2 segments

    expect(prepareWavForS330(wav1, 15000).segmentLength).toBe(1);
    expect(prepareWavForS330(wav2, 15000).segmentLength).toBe(2);
    expect(prepareWavForS330(wav3, 15000).segmentLength).toBe(2);
  });
});
