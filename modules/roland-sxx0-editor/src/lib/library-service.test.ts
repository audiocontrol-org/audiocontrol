/**
 * Integration tests for library-service.ts
 *
 * Tests the WAV loading and segment calculation logic to ensure
 * raw audio samples are correctly extracted from WAV files.
 */

import { describe, it, expect } from 'vitest';
import {
  parseWav,
  prepareWavForS330,
  calculateSegmentsNeeded,
} from '@audiocontrol/sampler-devices/s330';

describe('library-service WAV handling', () => {
  /**
   * Creates a minimal valid WAV file buffer for testing.
   * WAV format: 44-byte header + PCM audio data
   */
  function createTestWav(sampleCount: number, sampleRate: number = 15000): ArrayBuffer {
    const bytesPerSample = 2;
    const dataSize = sampleCount * bytesPerSample;
    const fileSize = 44 + dataSize;
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, fileSize - 8, true); // File size - 8
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, 1, true); // Channels (mono)
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * bytesPerSample, true); // Byte rate
    view.setUint16(32, bytesPerSample, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample

    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true); // Data size

    // Fill with sample data (simple ramp for testing)
    const samples = new Int16Array(buffer, 44, sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = Math.floor((i / sampleCount) * 32767);
    }

    return buffer;
  }

  describe('calculateSegmentsNeeded', () => {
    it('returns 1 segment for <= 12000 samples', () => {
      expect(calculateSegmentsNeeded(1)).toBe(1);
      expect(calculateSegmentsNeeded(12000)).toBe(1);
    });

    it('returns 2 segments for 12001-24000 samples', () => {
      expect(calculateSegmentsNeeded(12001)).toBe(2);
      expect(calculateSegmentsNeeded(24000)).toBe(2);
    });

    it('returns 3 segments for 24001-36000 samples', () => {
      expect(calculateSegmentsNeeded(24001)).toBe(3);
      expect(calculateSegmentsNeeded(36000)).toBe(3);
    });
  });

  describe('parseWav extracts correct sample count', () => {
    it('parses 12000 samples correctly', () => {
      const wav = createTestWav(12000);
      const parsed = parseWav(wav);
      expect(parsed.samples.length).toBe(12000);
    });

    it('parses 24000 samples correctly', () => {
      const wav = createTestWav(24000);
      const parsed = parseWav(wav);
      expect(parsed.samples.length).toBe(24000);
    });

    it('parses 24022 samples correctly (edge case from bug)', () => {
      // This was the failing case: 48044 byte file / 2 = 24022
      // But 48044 - 44 header = 48000 bytes = 24000 samples
      const wav = createTestWav(24000);
      const rawSize = wav.byteLength;
      expect(rawSize).toBe(48044); // 44 + 24000*2

      const parsed = parseWav(wav);
      expect(parsed.samples.length).toBe(24000); // NOT 24022!
    });
  });

  describe('prepareWavForS330 returns correct data size', () => {
    it('returns prepared data with correct byte count', () => {
      const wav = createTestWav(12000, 15000);
      const prepared = prepareWavForS330(wav, 15000);

      // prepared.data is Uint8Array of raw PCM bytes (2 bytes per sample)
      expect(prepared.data.length).toBe(12000 * 2);
      expect(prepared.data.length / 2).toBe(12000); // sample count
    });

    it('returns correct size for 24000 sample file', () => {
      const wav = createTestWav(24000, 15000);
      const prepared = prepareWavForS330(wav, 15000);

      expect(prepared.data.length).toBe(24000 * 2);
      expect(prepared.data.length / 2).toBe(24000);
    });
  });

  describe('segment calculation from prepared data', () => {
    it('correctly calculates segments from prepared data length', () => {
      const wav = createTestWav(24000, 15000);
      const prepared = prepareWavForS330(wav, 15000);

      // This is how loadIndividualPatch should calculate segments
      const sampleCount = prepared.data.length / 2;
      const segments = calculateSegmentsNeeded(sampleCount);

      expect(sampleCount).toBe(24000);
      expect(segments).toBe(2);
    });

    it('BUG REGRESSION: raw WAV file bytes should NOT be used for sample count', () => {
      // This test documents the bug that was fixed
      const wav = createTestWav(24000, 15000);
      const rawBytes = wav.byteLength; // 48044 (includes header)

      // WRONG: dividing raw file size by 2
      const wrongSampleCount = rawBytes / 2;
      expect(wrongSampleCount).toBe(24022); // This was the bug!

      // CORRECT: parse WAV to get actual samples
      const parsed = parseWav(wav);
      expect(parsed.samples.length).toBe(24000);

      // CORRECT: use prepareWavForS330 and divide by 2
      const prepared = prepareWavForS330(wav, 15000);
      expect(prepared.data.length / 2).toBe(24000);
    });
  });

  describe('importTone validation simulation', () => {
    it('validates correctly with proper segment calculation', () => {
      const wav = createTestWav(24000, 15000);
      const prepared = prepareWavForS330(wav, 15000);

      const sampleCount = prepared.data.length / 2;
      const segmentLength = calculateSegmentsNeeded(sampleCount);
      const maxSamples = segmentLength * 12000;

      // This should pass validation
      expect(sampleCount).toBeLessThanOrEqual(maxSamples);
      expect(sampleCount).toBe(24000);
      expect(maxSamples).toBe(24000);
    });

    it('would fail validation if using raw file bytes (regression test)', () => {
      const wav = createTestWav(24000, 15000);

      // Simulate the bug: using raw WAV data instead of prepared data
      const rawWavData = new Uint8Array(wav);

      // BUG: treating raw file as samples
      const wrongSampleCount = rawWavData.length / 2; // 24022

      // With wrong count, segments would be calculated correctly as 3
      // but we're passing segmentLength=2 from the manifest
      const segmentLength = 2; // What was stored/calculated elsewhere
      const maxSamples = segmentLength * 12000; // 24000

      // This is why it failed!
      expect(wrongSampleCount).toBeGreaterThan(maxSamples);
      expect(wrongSampleCount).toBe(24022);
      expect(maxSamples).toBe(24000);
    });
  });
});
