/**
 * Browser-safe WAV file builder for 16-bit mono PCM data.
 *
 * Produces a standard RIFF/WAVE file with a 44-byte header followed by raw
 * little-endian Int16 sample data.
 */

const RIFF_HEADER_SIZE = 44;
const PCM_FORMAT = 1;
const MONO_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

/** Build a WAV file as an ArrayBuffer from 16-bit mono PCM data. */
export function buildWavFile(
  samples: Int16Array,
  sampleRate: number,
): ArrayBuffer {
  const dataSize = samples.length * BYTES_PER_SAMPLE;
  const fileSize = RIFF_HEADER_SIZE + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const byteRate = sampleRate * MONO_CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = MONO_CHANNELS * BYTES_PER_SAMPLE;

  let offset = 0;

  // RIFF chunk descriptor
  offset = writeString(view, offset, 'RIFF');
  view.setUint32(offset, fileSize - 8, true); // ChunkSize = file size - 8
  offset += 4;
  offset = writeString(view, offset, 'WAVE');

  // fmt sub-chunk
  offset = writeString(view, offset, 'fmt ');
  view.setUint32(offset, 16, true); // Subchunk1Size (PCM = 16)
  offset += 4;
  view.setUint16(offset, PCM_FORMAT, true); // AudioFormat
  offset += 2;
  view.setUint16(offset, MONO_CHANNELS, true); // NumChannels
  offset += 2;
  view.setUint32(offset, sampleRate, true); // SampleRate
  offset += 4;
  view.setUint32(offset, byteRate, true); // ByteRate
  offset += 4;
  view.setUint16(offset, blockAlign, true); // BlockAlign
  offset += 2;
  view.setUint16(offset, BITS_PER_SAMPLE, true); // BitsPerSample
  offset += 2;

  // data sub-chunk
  offset = writeString(view, offset, 'data');
  view.setUint32(offset, dataSize, true); // Subchunk2Size
  offset += 4;

  // PCM sample data — write each Int16 in little-endian order
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
  return offset + str.length;
}
