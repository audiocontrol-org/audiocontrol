/**
 * WAV conversion for Akai S3000 samples.
 *
 * Converts between Akai disk sample format (16-bit signed LE PCM)
 * and WAV format (RIFF/WAVE container with PCM data).
 */

import type { AkaiDiskSampleHeader } from '@/devices/s3000xl/akai-disk-sample.js';

/**
 * Convert Akai sample audio data to a WAV file as Uint8Array.
 * The result can be used to create a Blob for download or playback.
 */
export function akaiSampleToWav(header: AkaiDiskSampleHeader, pcmData: Int16Array): Uint8Array {
  const sampleRate = header.sampleRate;
  const numChannels = 1; // Akai samples are mono
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;

  // WAV file: RIFF header (44 bytes) + PCM data
  const wavSize = 44 + dataSize;
  const wav = new Uint8Array(wavSize);
  const view = new DataView(wav.buffer);

  // RIFF header
  writeString(wav, 0, 'RIFF');
  view.setUint32(4, wavSize - 8, true);     // file size - 8
  writeString(wav, 8, 'WAVE');

  // fmt sub-chunk
  writeString(wav, 12, 'fmt ');
  view.setUint32(16, 16, true);              // sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true);               // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(wav, 36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM data (16-bit signed LE — same as Akai native format)
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(44 + i * 2, pcmData[i], true);
  }

  return wav;
}

/**
 * Parse a WAV file and extract PCM audio data and sample rate.
 * Returns the data needed to create an Akai sample on disk.
 */
export function wavToAkaiSample(wavData: Uint8Array): {
  sampleRate: number;
  pcmData: Int16Array;
} {
  const view = new DataView(wavData.buffer, wavData.byteOffset, wavData.byteLength);

  // Validate RIFF header
  const riff = readString(wavData, 0, 4);
  if (riff !== 'RIFF') {
    throw new Error('Not a WAV file: missing RIFF header');
  }

  const wave = readString(wavData, 8, 4);
  if (wave !== 'WAVE') {
    throw new Error('Not a WAV file: missing WAVE marker');
  }

  // Find fmt and data chunks
  let sampleRate = 44100;
  let numChannels = 1;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset < wavData.length - 8) {
    const chunkId = readString(wavData, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      const audioFormat = view.getUint16(offset + 8, true);
      if (audioFormat !== 1) {
        throw new Error(`Unsupported WAV format: ${audioFormat} (only PCM/1 supported)`);
      }
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // padding byte
  }

  if (dataOffset < 0) {
    throw new Error('WAV file has no data chunk');
  }

  if (bitsPerSample !== 16) {
    throw new Error(`Unsupported bit depth: ${bitsPerSample} (only 16-bit supported)`);
  }

  // Extract PCM samples
  const sampleCount = dataSize / (numChannels * (bitsPerSample / 8));
  const pcmData = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    if (numChannels === 1) {
      pcmData[i] = view.getInt16(dataOffset + i * 2, true);
    } else {
      // Stereo → mono: average left and right channels
      const left = view.getInt16(dataOffset + i * 4, true);
      const right = view.getInt16(dataOffset + i * 4 + 2, true);
      pcmData[i] = Math.round((left + right) / 2);
    }
  }

  return { sampleRate, pcmData };
}

function writeString(buf: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

function readString(buf: Uint8Array, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += String.fromCharCode(buf[offset + i]);
  }
  return str;
}
