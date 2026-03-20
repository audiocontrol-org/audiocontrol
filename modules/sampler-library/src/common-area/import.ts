/**
 * WAV import for the library common area.
 *
 * Imports a raw WAV file into `library/common/samples/` by:
 * 1. Extracting the sample rate from the WAV RIFF header
 * 2. Generating a SampleYaml descriptor with sensible defaults
 * 3. Writing both the YAML and WAV files via a StorageDirectoryHandle
 *
 * @packageDocumentation
 */

import { stringify as stringifyYaml } from 'yaml';

import type { SampleYaml } from '@/schemas/index.js';
import type { StorageDirectoryHandle } from '@/storage-handles.js';
import { getNestedDirectory } from '@/library-fs.js';

// =========================================================================
// Constants
// =========================================================================

/** Maximum length for a sample name. */
const MAX_NAME_LENGTH = 128;

/** Regex matching characters forbidden in filenames across platforms. */
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/** Minimum size for a valid WAV file (RIFF header + one chunk header). */
const MIN_WAV_SIZE = 20;

/** Size of a RIFF chunk header (4-byte ID + 4-byte size). */
const CHUNK_HEADER_SIZE = 8;

/** Minimum fmt chunk payload size (enough to contain sample rate). */
const MIN_FMT_SIZE = 8;

// =========================================================================
// WAV header parsing
//
// Lightweight RIFF chunk scanner that extracts only the sample rate.
// A full WAV decoder (samples, channels, bit depth) lives in
// sampler-devices: s-series-wave-format.ts — these are kept separate
// due to a circular dependency between sampler-library and
// sampler-devices. If the dep cycle is resolved, consolidate into
// a shared module.
// =========================================================================

/** Read a little-endian uint32 from a Uint8Array at the given offset. */
function readUint32LE(data: Uint8Array, offset: number): number {
  return (
    (data[offset]) |
    (data[offset + 1] << 8) |
    (data[offset + 2] << 16) |
    (data[offset + 3] << 24)
  ) >>> 0;
}

/** Check if 4 bytes at offset match an ASCII tag. */
function matchTag(data: Uint8Array, offset: number, tag: string): boolean {
  return (
    data[offset] === tag.charCodeAt(0) &&
    data[offset + 1] === tag.charCodeAt(1) &&
    data[offset + 2] === tag.charCodeAt(2) &&
    data[offset + 3] === tag.charCodeAt(3)
  );
}

/**
 * Extract the sample rate from a WAV RIFF header.
 *
 * Scans RIFF chunks to find the `fmt ` chunk, then reads the
 * `nSamplesPerSec` field (little-endian uint32 at byte 4 of the
 * fmt payload). Handles non-canonical chunk ordering (e.g., `JUNK`
 * or `bext` chunks before `fmt `).
 *
 * Throws if the file is not a valid WAV or the `fmt ` chunk is missing.
 */
export function extractWavSampleRate(data: Uint8Array): number {
  if (data.length < MIN_WAV_SIZE) {
    throw new Error(
      `WAV data too short: expected at least ${MIN_WAV_SIZE} bytes, got ${data.length}`,
    );
  }

  // Validate RIFF header signature (bytes 0-3)
  if (!matchTag(data, 0, 'RIFF')) {
    throw new Error('Invalid WAV file: missing RIFF header');
  }

  // Validate WAVE format marker (bytes 8-11)
  if (!matchTag(data, 8, 'WAVE')) {
    throw new Error('Invalid WAV file: missing WAVE format marker');
  }

  // Scan chunks starting after the RIFF/WAVE header (byte 12)
  let offset = 12;
  while (offset + CHUNK_HEADER_SIZE <= data.length) {
    const chunkSize = readUint32LE(data, offset + 4);

    if (matchTag(data, offset, 'fmt ')) {
      // fmt chunk found — sample rate is at byte 4 of the payload
      // (after audioFormat u16 and numChannels u16)
      const payloadStart = offset + CHUNK_HEADER_SIZE;
      if (payloadStart + MIN_FMT_SIZE > data.length) {
        throw new Error('Invalid WAV file: fmt chunk truncated');
      }
      const sampleRate = readUint32LE(data, payloadStart + 4);
      if (sampleRate === 0) {
        throw new Error('Invalid WAV file: sample rate is zero');
      }
      return sampleRate;
    }

    // Advance to next chunk (chunk sizes are padded to even boundaries)
    const paddedSize = chunkSize + (chunkSize % 2);
    offset += CHUNK_HEADER_SIZE + paddedSize;
  }

  throw new Error('Invalid WAV file: fmt chunk not found');
}

// =========================================================================
// Name utilities
// =========================================================================

/**
 * Sanitize a string for use as a filename by replacing unsafe characters
 * with underscores.
 */
export function sanitizeForFilename(input: string): string {
  return input.replace(UNSAFE_FILENAME_CHARS, '_');
}

/**
 * Derive a sample name from a WAV filename.
 *
 * Strips the `.wav` extension (case-insensitive), sanitizes unsafe
 * characters, and truncates to {@link MAX_NAME_LENGTH} characters.
 */
export function deriveSampleName(wavFilename: string): string {
  const withoutExtension = wavFilename.replace(/\.wav$/i, '');
  const sanitized = sanitizeForFilename(withoutExtension);
  return sanitized.slice(0, MAX_NAME_LENGTH);
}

// =========================================================================
// YAML generation
// =========================================================================

/**
 * Build a {@link SampleYaml} object from WAV data and optional metadata.
 *
 * The returned object has `format: 'sample'` and `version: 1`.
 * Loop mode and root key are intentionally omitted (one-shot default).
 */
export function buildSampleYaml(
  wavFilename: string,
  sampleRate: number,
  options?: ImportOptions,
): SampleYaml {
  const name = options?.name ?? deriveSampleName(wavFilename);

  const yaml: SampleYaml = {
    format: 'sample',
    version: 1,
    name,
    file: wavFilename,
    sampleRate,
  };

  if (options?.tags && options.tags.length > 0) {
    yaml.tags = options.tags;
  }

  if (options?.description) {
    yaml.description = options.description;
  }

  return yaml;
}

// =========================================================================
// Import options
// =========================================================================

export interface ImportOptions {
  /** Display name for the sample. Defaults to filename without extension. */
  name?: string;
  /** Freeform tags for organization. */
  tags?: string[];
  /** Human-readable description. */
  description?: string;
  /** Subdirectory path within `library/common/samples/`. */
  targetPath?: string[];
}

// =========================================================================
// Main import function
// =========================================================================

/**
 * Import a WAV file into the library common area.
 *
 * Writes a YAML descriptor and the WAV file to
 * `{rootHandle}/library/common/samples/{targetPath}/`.
 *
 * @param rootHandle - Root directory handle for the library
 * @param wavFilename - Original filename of the WAV (e.g. `"kick.wav"`)
 * @param wavData - Raw bytes of the WAV file
 * @param options - Optional metadata and target path
 * @returns The generated {@link SampleYaml} object
 */
export async function importWavToCommonArea(
  rootHandle: StorageDirectoryHandle,
  wavFilename: string,
  wavData: Uint8Array,
  options?: ImportOptions,
): Promise<SampleYaml> {
  const sampleRate = extractWavSampleRate(wavData);
  const sampleYaml = buildSampleYaml(wavFilename, sampleRate, options);

  // Navigate to target directory
  const basePath = ['library', 'common', 'samples'];
  const fullPath = options?.targetPath
    ? [...basePath, ...options.targetPath]
    : basePath;

  const targetDir = await getNestedDirectory(rootHandle, fullPath);

  // Derive the YAML filename from the sample name
  const yamlFilename = `${sanitizeForFilename(sampleYaml.name)}.yaml`;

  // Write YAML file
  const yamlContent = stringifyYaml(sampleYaml);
  const yamlHandle = await targetDir.getFileHandle(yamlFilename, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  // Write WAV file — extract ArrayBuffer slice for FSAA type compatibility
  // (Uint8Array<ArrayBufferLike> is not directly assignable to BlobPart
  // due to SharedArrayBuffer variance in strict DOM lib types)
  const wavBuffer = wavData.buffer.slice(
    wavData.byteOffset,
    wavData.byteOffset + wavData.byteLength,
  ) as ArrayBuffer;
  const wavHandle = await targetDir.getFileHandle(wavFilename, { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(wavBuffer);
  await wavWritable.close();

  return sampleYaml;
}
