import { describe, it, expect } from 'vitest';

import {
  extractWavSampleRate,
  deriveSampleName,
  sanitizeForFilename,
  buildSampleYaml,
} from '@/common-area/import.js';

// =========================================================================
// WAV header test fixtures
// =========================================================================

/**
 * Build a minimal valid WAV header with the given sample rate.
 * Only includes RIFF + WAVE + fmt chunk header with sample rate.
 */
function makeWavHeader(sampleRate: number): Uint8Array {
  const header = new Uint8Array(44);

  // RIFF header
  header[0] = 0x52; // R
  header[1] = 0x49; // I
  header[2] = 0x46; // F
  header[3] = 0x46; // F

  // File size (placeholder)
  header[4] = 0x24;
  header[5] = 0x00;
  header[6] = 0x00;
  header[7] = 0x00;

  // WAVE marker
  header[8] = 0x57;  // W
  header[9] = 0x41;  // A
  header[10] = 0x56; // V
  header[11] = 0x45; // E

  // fmt subchunk ID
  header[12] = 0x66; // f
  header[13] = 0x6d; // m
  header[14] = 0x74; // t
  header[15] = 0x20; // (space)

  // fmt chunk size (16 for PCM)
  header[16] = 16;
  header[17] = 0;
  header[18] = 0;
  header[19] = 0;

  // Audio format (1 = PCM)
  header[20] = 1;
  header[21] = 0;

  // Number of channels (1 = mono)
  header[22] = 1;
  header[23] = 0;

  // Sample rate (little-endian)
  header[24] = sampleRate & 0xff;
  header[25] = (sampleRate >> 8) & 0xff;
  header[26] = (sampleRate >> 16) & 0xff;
  header[27] = (sampleRate >> 24) & 0xff;

  return header;
}

// =========================================================================
// extractWavSampleRate
// =========================================================================

describe('extractWavSampleRate', () => {
  it('reads 44100 Hz from a valid WAV header', () => {
    const data = makeWavHeader(44100);
    expect(extractWavSampleRate(data)).toBe(44100);
  });

  it('reads 48000 Hz from a valid WAV header', () => {
    const data = makeWavHeader(48000);
    expect(extractWavSampleRate(data)).toBe(48000);
  });

  it('reads 22050 Hz from a valid WAV header', () => {
    const data = makeWavHeader(22050);
    expect(extractWavSampleRate(data)).toBe(22050);
  });

  it('reads 96000 Hz from a valid WAV header', () => {
    const data = makeWavHeader(96000);
    expect(extractWavSampleRate(data)).toBe(96000);
  });

  it('throws on data shorter than minimum size', () => {
    const data = new Uint8Array(10);
    expect(() => extractWavSampleRate(data)).toThrow('WAV data too short');
  });

  it('throws on missing RIFF signature', () => {
    const data = makeWavHeader(44100);
    data[0] = 0x00; // corrupt RIFF
    expect(() => extractWavSampleRate(data)).toThrow('missing RIFF header');
  });

  it('throws on missing WAVE marker', () => {
    const data = makeWavHeader(44100);
    data[8] = 0x00; // corrupt WAVE
    expect(() => extractWavSampleRate(data)).toThrow('missing WAVE format marker');
  });

  it('throws when sample rate is zero', () => {
    const data = makeWavHeader(0);
    expect(() => extractWavSampleRate(data)).toThrow('sample rate is zero');
  });

  it('finds fmt chunk after a JUNK chunk', () => {
    // RIFF header (12 bytes) + JUNK chunk (8 header + 4 payload) + fmt chunk
    const junkPayload = 4;
    const totalSize = 12 + 8 + junkPayload + 44 - 12; // RIFF header + JUNK + fmt data
    const data = new Uint8Array(totalSize);

    // RIFF header
    data.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    data.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE

    // JUNK chunk at offset 12
    data.set([0x4A, 0x55, 0x4E, 0x4B], 12); // JUNK
    data[16] = junkPayload; // chunk size = 4

    // fmt chunk at offset 24 (12 + 8 + 4)
    const fmtOffset = 24;
    data.set([0x66, 0x6D, 0x74, 0x20], fmtOffset); // "fmt "
    data[fmtOffset + 4] = 16; // chunk size
    data[fmtOffset + 8] = 1;  // audio format (PCM)
    data[fmtOffset + 10] = 1; // channels
    // sample rate at fmtOffset + 12
    const sr = 44100;
    data[fmtOffset + 12] = sr & 0xff;
    data[fmtOffset + 13] = (sr >> 8) & 0xff;
    data[fmtOffset + 14] = (sr >> 16) & 0xff;
    data[fmtOffset + 15] = (sr >> 24) & 0xff;

    expect(extractWavSampleRate(data)).toBe(44100);
  });

  it('handles odd-sized chunks with padding', () => {
    // RIFF header + JUNK chunk with odd size (5 bytes payload, padded to 6)
    const junkPayload = 5;
    const paddedJunk = 6; // padded to even
    const totalSize = 12 + 8 + paddedJunk + 32;
    const data = new Uint8Array(totalSize);

    data.set([0x52, 0x49, 0x46, 0x46], 0);
    data.set([0x57, 0x41, 0x56, 0x45], 8);

    // JUNK chunk with odd size
    data.set([0x4A, 0x55, 0x4E, 0x4B], 12);
    data[16] = junkPayload;

    // fmt chunk after padded JUNK
    const fmtOffset = 12 + 8 + paddedJunk;
    data.set([0x66, 0x6D, 0x74, 0x20], fmtOffset);
    data[fmtOffset + 4] = 16;
    data[fmtOffset + 8] = 1;
    data[fmtOffset + 10] = 1;
    const sr = 48000;
    data[fmtOffset + 12] = sr & 0xff;
    data[fmtOffset + 13] = (sr >> 8) & 0xff;

    expect(extractWavSampleRate(data)).toBe(48000);
  });

  it('throws when fmt chunk is missing', () => {
    const data = new Uint8Array(28);
    data.set([0x52, 0x49, 0x46, 0x46], 0);
    data.set([0x57, 0x41, 0x56, 0x45], 8);
    // data chunk instead of fmt
    data.set([0x64, 0x61, 0x74, 0x61], 12); // "data"
    data[16] = 4; // chunk size
    expect(() => extractWavSampleRate(data)).toThrow('fmt chunk not found');
  });
});

// =========================================================================
// deriveSampleName
// =========================================================================

describe('deriveSampleName', () => {
  it('strips .wav extension', () => {
    expect(deriveSampleName('kick.wav')).toBe('kick');
  });

  it('strips .WAV extension (case-insensitive)', () => {
    expect(deriveSampleName('SNARE.WAV')).toBe('SNARE');
  });

  it('handles filename without extension', () => {
    expect(deriveSampleName('mysample')).toBe('mysample');
  });

  it('preserves non-.wav extensions', () => {
    expect(deriveSampleName('sound.aiff')).toBe('sound.aiff');
  });

  it('sanitizes unsafe characters', () => {
    expect(deriveSampleName('my<file>:name.wav')).toBe('my_file__name');
  });

  it('truncates to 128 characters', () => {
    const longName = 'a'.repeat(200) + '.wav';
    expect(deriveSampleName(longName).length).toBe(128);
  });
});

// =========================================================================
// sanitizeForFilename
// =========================================================================

describe('sanitizeForFilename', () => {
  it('replaces angle brackets', () => {
    expect(sanitizeForFilename('a<b>c')).toBe('a_b_c');
  });

  it('replaces colons', () => {
    expect(sanitizeForFilename('a:b')).toBe('a_b');
  });

  it('replaces double quotes', () => {
    expect(sanitizeForFilename('a"b')).toBe('a_b');
  });

  it('replaces slashes and backslashes', () => {
    expect(sanitizeForFilename('a/b\\c')).toBe('a_b_c');
  });

  it('replaces pipes and question marks', () => {
    expect(sanitizeForFilename('a|b?c')).toBe('a_b_c');
  });

  it('replaces asterisks', () => {
    expect(sanitizeForFilename('a*b')).toBe('a_b');
  });

  it('leaves safe characters untouched', () => {
    expect(sanitizeForFilename('hello-world_01.wav')).toBe('hello-world_01.wav');
  });
});

// =========================================================================
// buildSampleYaml
// =========================================================================

describe('buildSampleYaml', () => {
  it('generates a valid SampleYaml with defaults', () => {
    const yaml = buildSampleYaml('kick.wav', 44100);

    expect(yaml).toEqual({
      format: 'sample',
      version: 1,
      name: 'kick',
      file: 'sample.wav', // Always sample.wav for directory bundles
      sampleRate: 44100,
    });
  });

  it('uses provided name from options', () => {
    const yaml = buildSampleYaml('kick.wav', 44100, { name: 'Bass Kick' });
    expect(yaml.name).toBe('Bass Kick');
  });

  it('includes tags when provided', () => {
    const yaml = buildSampleYaml('kick.wav', 44100, { tags: ['drums', 'bass'] });
    expect(yaml.tags).toEqual(['drums', 'bass']);
  });

  it('omits tags when empty array provided', () => {
    const yaml = buildSampleYaml('kick.wav', 44100, { tags: [] });
    expect(yaml.tags).toBeUndefined();
  });

  it('includes description when provided', () => {
    const yaml = buildSampleYaml('kick.wav', 44100, {
      description: 'A punchy kick drum',
    });
    expect(yaml.description).toBe('A punchy kick drum');
  });

  it('omits loopMode (one-shot default)', () => {
    const yaml = buildSampleYaml('kick.wav', 44100);
    expect(yaml.loopMode).toBeUndefined();
  });

  it('omits rootKey', () => {
    const yaml = buildSampleYaml('kick.wav', 44100);
    expect(yaml.rootKey).toBeUndefined();
  });

  it('derives name from filename when no name option given', () => {
    const yaml = buildSampleYaml('My Cool Sample.wav', 48000);
    expect(yaml.name).toBe('My Cool Sample');
  });
});
