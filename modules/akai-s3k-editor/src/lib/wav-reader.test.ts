import { describe, it, expect } from 'vitest';
import { parseWavFile } from '@/lib/wav-reader';

/**
 * Build a minimal valid WAV file buffer for testing.
 * Produces PCM WAV with the given parameters.
 */
function buildTestWav(options: {
  sampleRate?: number;
  bitsPerSample?: number;
  numChannels?: number;
  samples: number[]; // raw sample values (channel-interleaved if stereo)
  audioFormat?: number;
}): ArrayBuffer {
  const {
    sampleRate = 44100,
    bitsPerSample = 16,
    numChannels = 1,
    samples,
    audioFormat = 1,
  } = options;

  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * bytesPerSample;
  const fmtChunkSize = 16;
  // RIFF header (12) + fmt chunk (8 + 16) + data chunk (8 + dataSize)
  const fileSize = 12 + 8 + fmtChunkSize + 8 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  let offset = 0;

  // RIFF header
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, fileSize - 8, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;

  // fmt chunk
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, fmtChunkSize, true); offset += 4;
  view.setUint16(offset, audioFormat, true); offset += 2; // audio format
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  const byteRate = sampleRate * numChannels * bytesPerSample;
  view.setUint32(offset, byteRate, true); offset += 4;
  const blockAlign = numChannels * bytesPerSample;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, bitsPerSample, true); offset += 2;

  // data chunk
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  for (const sample of samples) {
    switch (bitsPerSample) {
      case 8:
        view.setUint8(offset, sample & 0xff);
        offset += 1;
        break;
      case 16:
        view.setInt16(offset, sample, true);
        offset += 2;
        break;
      case 24:
        // Little-endian: low, mid, high
        view.setUint8(offset, sample & 0xff);
        view.setUint8(offset + 1, (sample >> 8) & 0xff);
        view.setUint8(offset + 2, (sample >> 16) & 0xff);
        offset += 3;
        break;
      case 32:
        view.setInt32(offset, sample, true);
        offset += 4;
        break;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

describe('parseWavFile', () => {
  it('parses a 16-bit mono WAV file', () => {
    const samples = [0, 1000, -1000, 32767, -32768];
    const buffer = buildTestWav({ bitsPerSample: 16, numChannels: 1, samples });
    const result = parseWavFile(buffer);

    expect(result.sampleRate).toBe(44100);
    expect(result.bitsPerSample).toBe(16);
    expect(result.numChannels).toBe(1);
    expect(result.numSamples).toBe(5);
    expect(Array.from(result.samples)).toEqual(samples);
  });

  it('parses a 16-bit stereo WAV and downmixes to mono', () => {
    // Interleaved stereo: [L, R, L, R]
    const stereoSamples = [1000, 3000, -500, -1500];
    const buffer = buildTestWav({
      bitsPerSample: 16,
      numChannels: 2,
      samples: stereoSamples,
    });
    const result = parseWavFile(buffer);

    expect(result.numChannels).toBe(2);
    expect(result.numSamples).toBe(2);
    // Mono should be average: (1000+3000)/2=2000, (-500+-1500)/2=-1000
    expect(Array.from(result.samples)).toEqual([2000, -1000]);
  });

  it('parses an 8-bit WAV and converts to 16-bit signed', () => {
    // 8-bit WAV: unsigned, 128 = silence
    const samples = [128, 255, 0]; // silence, max positive, max negative
    const buffer = buildTestWav({
      bitsPerSample: 8,
      numChannels: 1,
      samples,
    });
    const result = parseWavFile(buffer);

    expect(result.bitsPerSample).toBe(8);
    // 128 -> (128-128)<<8 = 0
    // 255 -> (255-128)<<8 = 127*256 = 32512
    // 0 -> (0-128)<<8 = -128*256 = -32768
    expect(result.samples[0]).toBe(0);
    expect(result.samples[1]).toBe(32512);
    expect(result.samples[2]).toBe(-32768);
  });

  it('parses a 24-bit WAV and takes top 16 bits', () => {
    // 24-bit sample: 0x7F_FF_00 (big value). In little-endian bytes: 0x00, 0xFF, 0x7F
    // Top 16 bits = (0x7F << 8) | 0xFF = 0x7FFF = 32767
    const samples = [0x7FFF00];
    const buffer = buildTestWav({
      bitsPerSample: 24,
      numChannels: 1,
      samples,
    });
    const result = parseWavFile(buffer);

    expect(result.bitsPerSample).toBe(24);
    expect(result.samples[0]).toBe(32767);
  });

  it('parses a 32-bit WAV and takes top 16 bits', () => {
    // 32-bit sample: 0x7FFF0000 -> top 16 bits = 0x7FFF = 32767
    const samples = [0x7FFF0000];
    const buffer = buildTestWav({
      bitsPerSample: 32,
      numChannels: 1,
      samples,
    });
    const result = parseWavFile(buffer);

    expect(result.bitsPerSample).toBe(32);
    expect(result.samples[0]).toBe(32767);
  });

  it('respects custom sample rates', () => {
    const buffer = buildTestWav({
      sampleRate: 22050,
      samples: [0],
    });
    const result = parseWavFile(buffer);
    expect(result.sampleRate).toBe(22050);
  });

  it('throws for a buffer that is too small', () => {
    const buffer = new ArrayBuffer(10);
    expect(() => parseWavFile(buffer)).toThrow('too small');
  });

  it('throws for a non-RIFF file', () => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    writeString(view, 0, 'NOPE');
    expect(() => parseWavFile(buffer)).toThrow('expected "RIFF"');
  });

  it('throws for a RIFF file that is not WAVE', () => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36, true);
    writeString(view, 8, 'AVI ');
    expect(() => parseWavFile(buffer)).toThrow('expected "WAVE"');
  });

  it('throws for non-PCM audio format', () => {
    const buffer = buildTestWav({ audioFormat: 3, samples: [0] });
    expect(() => parseWavFile(buffer)).toThrow('Unsupported WAV format');
  });

  it('throws for empty data chunk', () => {
    // Build a WAV with 0 samples by creating a valid header with empty data
    const buffer = buildTestWav({ samples: [] });
    expect(() => parseWavFile(buffer)).toThrow('no sample data');
  });
});
