/**
 * Parser for Akai S3000 sample files in on-disk binary format.
 *
 * On-disk format uses straight binary (1 byte = 1 byte), unlike the SysEx
 * nibble-encoded format. The sample file consists of a header followed by
 * raw 16-bit signed PCM audio data.
 */

import { akaiToAscii } from '@/devices/s3000xl/akai-disk-format.js';

// ---------------------------------------------------------------------------
// Sample header field offsets (straight binary, within file data)
// ---------------------------------------------------------------------------

/** Sample identifier byte (should be 3). */
const SHIDENT_OFFSET = 0;
const SHIDENT_VALUE = 3;

/** Bandwidth: 0 = 10kHz, 1 = 20kHz (affects default sample rate). */
const SBANDW_OFFSET = 1;

/** Original pitch (MIDI note 24-127). */
const SPITCH_OFFSET = 2;

/** Sample name: 12 bytes, Akai character encoding. */
const SHNAME_OFFSET = 3;
const SHNAME_LENGTH = 12;

/** Sample rate validity flag: 0x80 means SSRATE field is valid. */
const SSRVLD_OFFSET = 15;
const SSRVLD_VALID = 0x80;

/** Number of loops (0-4). */
const SLOOPS_OFFSET = 16;

/** Playback type: 0 = normal, 1 = loop until release, etc. */
const SPTYPE_OFFSET = 19;

/** Data length in samples (u32 LE). */
const SLNGTH_OFFSET = 26;

/** Play start relative to data start (u32 LE). */
const SSTART_OFFSET = 30;

/** Play end relative to data start (u32 LE). */
const SMPEND_OFFSET = 34;

/**
 * Loop data begins at offset 38. Each loop entry contains:
 *   - LOOPAT: u32 LE (loop start point, 4 bytes)
 *   - LLNGTH: 6 bytes (u48 LE, loop length -- high precision)
 *   - LDWELL: u16 LE (loop dwell time, 2 bytes)
 * Total: 12 bytes per loop, 4 loops = 48 bytes.
 */
const LOOP_DATA_OFFSET = 38;
const LOOP_ENTRY_SIZE = 12;
const LOOP_COUNT = 4;

/**
 * After the 4 loop entries (48 bytes from offset 38 = offset 86):
 *   - SSPARE: 2 bytes (offset 86)
 *   - SSPAIR: 2 bytes (offset 88, stereo pair pointer)
 *   - SSRATE: u16 LE (offset 90, sample rate in Hz)
 *   - SHLTO: various additional fields
 *
 * Total header size is approximately 140-160 bytes. We use 150 as a
 * conservative boundary; audio data follows immediately after.
 */
const SSRATE_OFFSET = 90;

/**
 * Fixed header size in bytes.
 *
 * The exact header size for S1000/S3000 on-disk samples is 150 bytes based
 * on the field layout. Audio PCM data starts immediately after this offset.
 */
const SAMPLE_HEADER_SIZE = 150;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AkaiDiskSampleHeader {
  name: string;
  bandwidth: number;
  originalPitch: number;
  sampleRate: number;
  sampleLength: number;
  playStart: number;
  playEnd: number;
  loopCount: number;
  playbackType: number;
  rawHeader: Uint8Array;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a little-endian unsigned 16-bit integer. */
function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/** Read a little-endian unsigned 32-bit integer. */
function readU32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset]) |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    ((data[offset + 3] << 24) >>> 0)  // >>> 0 to treat as unsigned
  );
}

/** Default sample rates derived from bandwidth setting. */
const BANDWIDTH_SAMPLE_RATES: Record<number, number> = {
  0: 22050,  // 10kHz bandwidth
  1: 44100,  // 20kHz bandwidth
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a sample header from raw on-disk bytes.
 *
 * The bytes come from `readFileData()` -- the complete file contents as stored
 * on the Akai disk. Only the header portion is interpreted; the remaining
 * bytes are PCM audio data.
 */
export function parseSampleHeaderFromDisk(
  fileData: Uint8Array,
): AkaiDiskSampleHeader {
  if (fileData.length < SAMPLE_HEADER_SIZE) {
    throw new Error(
      `Sample file too small: ${fileData.length} bytes (minimum ${SAMPLE_HEADER_SIZE})`,
    );
  }

  const ident = fileData[SHIDENT_OFFSET];
  if (ident !== SHIDENT_VALUE) {
    throw new Error(
      `Invalid sample identifier: expected ${SHIDENT_VALUE}, got ${ident}`,
    );
  }

  const name = akaiToAscii(
    fileData.subarray(SHNAME_OFFSET, SHNAME_OFFSET + SHNAME_LENGTH),
  );
  const bandwidth = fileData[SBANDW_OFFSET];
  const originalPitch = fileData[SPITCH_OFFSET];
  const loopCount = fileData[SLOOPS_OFFSET];
  const playbackType = fileData[SPTYPE_OFFSET];

  const sampleLength = readU32LE(fileData, SLNGTH_OFFSET);
  const playStart = readU32LE(fileData, SSTART_OFFSET);
  const playEnd = readU32LE(fileData, SMPEND_OFFSET);

  // Determine sample rate: use SSRATE if the validity flag is set and
  // the value is non-zero, otherwise fall back to bandwidth-derived default.
  const sampleRateValid = fileData[SSRVLD_OFFSET] === SSRVLD_VALID;
  const ssrate = sampleRateValid ? readU16LE(fileData, SSRATE_OFFSET) : 0;
  const sampleRate = ssrate > 0
    ? ssrate
    : (BANDWIDTH_SAMPLE_RATES[bandwidth] ?? 44100);

  const rawHeader = fileData.slice(0, SAMPLE_HEADER_SIZE);

  return {
    name,
    bandwidth,
    originalPitch,
    sampleRate,
    sampleLength,
    playStart,
    playEnd,
    loopCount,
    playbackType,
    rawHeader,
  };
}

/**
 * Extract raw 16-bit signed PCM audio data from a sample file.
 *
 * The audio is 16-bit signed little-endian, stored as straight binary (not
 * 7-bit encoded like SDS transfers). The header occupies the first
 * `SAMPLE_HEADER_SIZE` bytes; PCM data follows immediately after.
 *
 * @param fileData - Complete file bytes from `readFileData()`.
 * @param header - Parsed sample header (used for sample count).
 * @returns Int16Array of PCM samples.
 */
export function extractSampleAudio(
  fileData: Uint8Array,
  header: AkaiDiskSampleHeader,
): Int16Array {
  const audioByteCount = header.sampleLength * 2;
  const audioStartOffset = SAMPLE_HEADER_SIZE;

  if (audioStartOffset + audioByteCount > fileData.length) {
    throw new Error(
      `Sample audio extends beyond file data: need ${audioStartOffset + audioByteCount} bytes, ` +
      `file is ${fileData.length} bytes`,
    );
  }

  const audioBytes = fileData.subarray(
    audioStartOffset,
    audioStartOffset + audioByteCount,
  );

  // Convert raw bytes to Int16Array. We cannot use a typed array view
  // directly because the source buffer may not be aligned and the host
  // platform may not be little-endian.
  const samples = new Int16Array(header.sampleLength);
  for (let i = 0; i < header.sampleLength; i++) {
    const byteOffset = i * 2;
    const unsigned = audioBytes[byteOffset] | (audioBytes[byteOffset + 1] << 8);
    // Convert unsigned u16 to signed i16
    samples[i] = unsigned > 0x7fff ? unsigned - 0x10000 : unsigned;
  }

  return samples;
}
