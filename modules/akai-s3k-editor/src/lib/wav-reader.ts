import type { WavFileMetadata } from '@audiocontrol/editor-core';

export interface WavFileInfo extends WavFileMetadata {
  samples: Int16Array; // mono, 16-bit
}

/**
 * Parse a WAV file ArrayBuffer into sample data.
 * Supports PCM 8/16/24/32-bit, mono and stereo (stereo is downmixed to mono).
 * Throws on invalid or unsupported formats.
 */
export function parseWavFile(buffer: ArrayBuffer): WavFileInfo {
  const view = new DataView(buffer);

  if (buffer.byteLength < 44) {
    throw new Error('WAV file too small: must be at least 44 bytes');
  }

  // RIFF header
  const riffTag = readFourCC(view, 0);
  if (riffTag !== 'RIFF') {
    throw new Error(`Invalid WAV file: expected "RIFF" header, got "${riffTag}"`);
  }

  const waveTag = readFourCC(view, 8);
  if (waveTag !== 'WAVE') {
    throw new Error(`Invalid WAV file: expected "WAVE" format, got "${waveTag}"`);
  }

  // Find fmt and data chunks by scanning
  const fmtChunk = findChunk(view, 'fmt ');
  if (!fmtChunk) {
    throw new Error('Invalid WAV file: missing "fmt " chunk');
  }

  const audioFormat = view.getUint16(fmtChunk.dataOffset, true);
  if (audioFormat !== 1) {
    throw new Error(
      `Unsupported WAV format: expected PCM (1), got ${audioFormat}. Compressed WAV files are not supported.`,
    );
  }

  const channels = view.getUint16(fmtChunk.dataOffset + 2, true);
  const sampleRate = view.getUint32(fmtChunk.dataOffset + 4, true);
  const bitsPerSample = view.getUint16(fmtChunk.dataOffset + 14, true);

  if (channels < 1 || channels > 2) {
    throw new Error(
      `Unsupported channel count: ${channels}. Only mono and stereo WAV files are supported.`,
    );
  }

  if (![8, 16, 24, 32].includes(bitsPerSample)) {
    throw new Error(
      `Unsupported bit depth: ${bitsPerSample}. Supported: 8, 16, 24, 32.`,
    );
  }

  const dataChunk = findChunk(view, 'data');
  if (!dataChunk) {
    throw new Error('Invalid WAV file: missing "data" chunk');
  }

  const bytesPerSample = bitsPerSample / 8;
  const bytesPerFrame = bytesPerSample * channels;
  const sampleCount = Math.floor(dataChunk.size / bytesPerFrame);

  if (sampleCount === 0) {
    throw new Error('WAV file contains no sample data');
  }

  const rawSamples = readRawSamples(
    view,
    dataChunk.dataOffset,
    sampleCount,
    channels,
    bitsPerSample,
  );

  const monoSamples =
    channels === 2 ? downmixToMono(rawSamples, sampleCount) : rawSamples;

  return {
    sampleRate,
    bitsPerSample,
    channels,
    sampleCount,
    samples: monoSamples,
  };
}

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

interface ChunkInfo {
  dataOffset: number;
  size: number;
}

function findChunk(view: DataView, id: string): ChunkInfo | null {
  let offset = 12; // Skip RIFF header (4 + 4 + 4)
  const end = view.byteLength;

  while (offset + 8 <= end) {
    const chunkId = readFourCC(view, offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;

    if (chunkId === id) {
      return { dataOffset, size: chunkSize };
    }

    // Move to next chunk (chunks are 2-byte aligned)
    offset = dataOffset + chunkSize;
    if (offset % 2 !== 0) {
      offset += 1;
    }
  }

  return null;
}

/**
 * Read raw PCM samples from the data chunk, converting all bit depths to 16-bit signed.
 * For stereo files, returns interleaved [L, R, L, R, ...] samples.
 */
function readRawSamples(
  view: DataView,
  dataOffset: number,
  sampleCount: number,
  channels: number,
  bitsPerSample: number,
): Int16Array {
  const totalSampleValues = sampleCount * channels;
  const result = new Int16Array(totalSampleValues);
  const bytesPerSample = bitsPerSample / 8;

  for (let i = 0; i < totalSampleValues; i++) {
    const byteOffset = dataOffset + i * bytesPerSample;

    switch (bitsPerSample) {
      case 8: {
        // 8-bit WAV is unsigned (0-255), center is 128
        const unsigned = view.getUint8(byteOffset);
        result[i] = (unsigned - 128) << 8;
        break;
      }
      case 16: {
        result[i] = view.getInt16(byteOffset, true);
        break;
      }
      case 24: {
        // Take top 16 bits of 24-bit sample (little-endian: bytes are [low, mid, high])
        const mid = view.getUint8(byteOffset + 1);
        const high = view.getInt8(byteOffset + 2);
        result[i] = (high << 8) | mid;
        break;
      }
      case 32: {
        // Take top 16 bits of 32-bit sample
        const hi16 = view.getInt16(byteOffset + 2, true);
        result[i] = hi16;
        break;
      }
    }
  }

  return result;
}

/** Downmix interleaved stereo [L, R, L, R, ...] to mono by averaging pairs. */
function downmixToMono(stereo: Int16Array, sampleCount: number): Int16Array {
  const mono = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const left = stereo[i * 2];
    const right = stereo[i * 2 + 1];
    mono[i] = Math.round((left + right) / 2);
  }
  return mono;
}
