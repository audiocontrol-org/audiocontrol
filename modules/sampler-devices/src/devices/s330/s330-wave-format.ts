/**
 * S-330 wave data format encoding/decoding.
 *
 * The S-330 uses 12-bit linear PCM samples, transmitted over MIDI as
 * 2 bytes per sample in a 7-bit safe encoding:
 *
 * - Byte 0: 0aaa aaaa - upper 7 bits of the 12-bit sample
 * - Byte 1: 0bbb bb00 - lower 5 bits, left-shifted by 2
 *
 * Both bytes are always < 128, making them MIDI-safe without nibblization.
 *
 * @packageDocumentation
 */

/**
 * S-330 sample rate options.
 */
export type S330WaveSampleRate = 15000 | 30000;

/**
 * Parsed WAV file data.
 */
export interface WavData {
  /** Sample rate in Hz */
  sampleRate: number;
  /** Number of channels (1=mono, 2=stereo) */
  channels: number;
  /** Bits per sample (8, 16, 24, 32) */
  bitsPerSample: number;
  /** Raw sample data as signed 16-bit integers (normalized from source format) */
  samples: Int16Array;
}

/**
 * S-330 wave data ready for transmission.
 */
export interface S330WaveData {
  /** Encoded wave bytes (2 bytes per 12-bit sample, 7-bit MIDI safe) */
  data: Uint8Array;
  /** Sample rate */
  sampleRate: S330WaveSampleRate;
  /** Number of samples */
  sampleCount: number;
}

/**
 * Parse a WAV file buffer into sample data.
 *
 * Supports 8-bit, 16-bit, 24-bit PCM, 32-bit PCM, and 32-bit float WAV files.
 * Stereo files are converted to mono by averaging channels.
 */
export function parseWav(buffer: ArrayBuffer): WavData {
  const view = new DataView(buffer);

  // Validate RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') {
    throw new Error('Invalid WAV file: missing RIFF header');
  }

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') {
    throw new Error('Invalid WAV file: missing WAVE format');
  }

  // Find fmt and data chunks
  let offset = 12;
  let fmtChunk: {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
  } | null = null;
  let dataStart = 0;
  let dataSize = 0;

  while (offset < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      const audioFormat = view.getUint16(offset + 8, true);
      // audioFormat 1 = PCM, 3 = IEEE float
      if (audioFormat !== 1 && audioFormat !== 3) {
        throw new Error(`Unsupported WAV format: ${audioFormat} (only PCM and float supported)`);
      }
      fmtChunk = {
        audioFormat,
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      };
    } else if (chunkId === 'data') {
      dataStart = offset + 8;
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
    // Chunks must be word-aligned
    if (chunkSize % 2 !== 0) offset++;
  }

  if (!fmtChunk) {
    throw new Error('Invalid WAV file: missing fmt chunk');
  }
  if (dataStart === 0) {
    throw new Error('Invalid WAV file: missing data chunk');
  }

  const { audioFormat, channels, sampleRate, bitsPerSample } = fmtChunk;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * channels));

  // Convert to mono 16-bit
  const samples = new Int16Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;

    for (let ch = 0; ch < channels; ch++) {
      const sampleOffset = dataStart + (i * channels + ch) * bytesPerSample;
      let sample: number;

      if (audioFormat === 3) {
        // IEEE float format
        const floatSample = view.getFloat32(sampleOffset, true);
        // Clamp to -1..1 and scale to 16-bit
        sample = Math.round(Math.max(-1, Math.min(1, floatSample)) * 32767);
      } else {
        // PCM format
        switch (bitsPerSample) {
          case 8:
            // 8-bit WAV is unsigned
            sample = (view.getUint8(sampleOffset) - 128) * 256;
            break;
          case 16:
            sample = view.getInt16(sampleOffset, true);
            break;
          case 24:
            // 24-bit: read 3 bytes, sign-extend
            sample = view.getUint8(sampleOffset) |
              (view.getUint8(sampleOffset + 1) << 8) |
              (view.getInt8(sampleOffset + 2) << 16);
            sample = sample >> 8; // Scale to 16-bit
            break;
          case 32:
            sample = view.getInt32(sampleOffset, true) >> 16; // Scale to 16-bit
            break;
          default:
            throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
        }
      }

      sum += sample;
    }

    // Average channels for mono conversion
    samples[i] = Math.round(sum / channels);
  }

  return { sampleRate, channels, bitsPerSample, samples };
}

/**
 * Create a WAV file buffer from sample data.
 */
export function createWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, fileSize - 8, true);
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
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataSize, true);

  // Sample data
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  return buffer;
}

/**
 * Simple linear resampling.
 */
function resample(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.floor(samples.length / ratio);
  const result = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
    const fraction = srcIndex - srcIndexFloor;

    // Linear interpolation
    result[i] = Math.round(
      samples[srcIndexFloor] * (1 - fraction) + samples[srcIndexCeil] * fraction
    );
  }

  return result;
}

/**
 * Convert WAV data to S-330 wave format.
 *
 * @param wav - Parsed WAV data
 * @param targetSampleRate - Target S-330 sample rate (15000 or 30000)
 * @returns S-330 encoded wave data
 */
export function wavToS330(wav: WavData, targetSampleRate: S330WaveSampleRate): S330WaveData {
  // Resample if needed
  const resampled = resample(wav.samples, wav.sampleRate, targetSampleRate);

  // Convert 16-bit samples to 12-bit, then encode as 7-bit MIDI bytes
  const sampleCount = resampled.length;
  const data = new Uint8Array(sampleCount * 2);

  for (let i = 0; i < sampleCount; i++) {
    // Scale 16-bit to 12-bit (divide by 16, maintaining sign)
    const sample16 = resampled[i];
    let sample12 = sample16 >> 4;

    // Clamp to 12-bit range (-2048 to 2047)
    sample12 = Math.max(-2048, Math.min(2047, sample12));

    // Convert to unsigned 12-bit for encoding
    const unsigned12 = sample12 < 0 ? sample12 + 0x1000 : sample12;

    // Encode as 2 bytes (7-bit MIDI safe):
    // Byte 0: 0aaa aaaa - upper 7 bits of 12-bit sample
    // Byte 1: 0bbb bb00 - lower 5 bits, left-shifted by 2
    data[i * 2] = (unsigned12 >> 5) & 0x7f;
    data[i * 2 + 1] = (unsigned12 << 2) & 0x7c;
  }

  return { data, sampleRate: targetSampleRate, sampleCount };
}

/**
 * Convert S-330 wave data to 16-bit PCM samples.
 *
 * @param s330Data - S-330 encoded wave bytes
 * @param sampleRate - Sample rate (15000 or 30000)
 * @returns 16-bit PCM samples
 */
export function s330ToWav(s330Data: Uint8Array, sampleRate: S330WaveSampleRate): Int16Array {
  const sampleCount = Math.floor(s330Data.length / 2);
  const samples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const byte0 = s330Data[i * 2];
    const byte1 = s330Data[i * 2 + 1];

    // Decode: upper 7 bits << 5, lower 5 bits >> 2
    const sample12bit = (byte0 << 5) | (byte1 >> 2);

    // Sign extend from 12-bit 2's complement
    let signedSample: number;
    if (sample12bit & 0x800) {
      signedSample = sample12bit - 0x1000;
    } else {
      signedSample = sample12bit;
    }

    // Scale to 16-bit
    samples[i] = signedSample << 4;
  }

  return samples;
}

/**
 * Calculate how many segments are needed for a given number of samples.
 *
 * Each S-330 segment holds 12,000 samples.
 */
export function calculateSegmentsNeeded(sampleCount: number): number {
  const SAMPLES_PER_SEGMENT = 12000;
  return Math.ceil(sampleCount / SAMPLES_PER_SEGMENT);
}

/**
 * Check if wave data will fit in the specified segments.
 */
export function validateWaveDataFits(
  sampleCount: number,
  segmentLength: number
): { fits: boolean; neededSegments: number; availableSamples: number } {
  const SAMPLES_PER_SEGMENT = 12000;
  const availableSamples = segmentLength * SAMPLES_PER_SEGMENT;
  const neededSegments = calculateSegmentsNeeded(sampleCount);
  return {
    fits: sampleCount <= availableSamples,
    neededSegments,
    availableSamples,
  };
}
