/**
 * WAV import for the library common area.
 *
 * Imports a raw WAV file into `library/common/samples/` by:
 * 1. Extracting the sample rate from the WAV RIFF header
 * 2. Generating a SampleYaml descriptor with sensible defaults
 * 3. Writing both the YAML and WAV files via the File System Access API
 *
 * @packageDocumentation
 */

import { stringify as stringifyYaml } from 'yaml';

import type { SampleYaml } from '@/schemas/index.js';
import { getNestedDirectory } from '@/library-fs.js';

// =========================================================================
// Constants
// =========================================================================

/** Maximum length for a sample name. */
const MAX_NAME_LENGTH = 128;

/** Regex matching characters forbidden in filenames across platforms. */
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*]/g;

/** Byte offset of the sample rate field in a standard WAV RIFF header. */
const SAMPLE_RATE_OFFSET = 24;

/** Minimum size for a valid WAV header (RIFF + fmt chunk header). */
const MIN_WAV_HEADER_SIZE = 28;

// =========================================================================
// WAV header parsing
// =========================================================================

/**
 * Extract the sample rate from a standard WAV RIFF header.
 *
 * Reads the little-endian uint32 at bytes 24-27, which is the
 * `nSamplesPerSec` field of the `fmt ` chunk in canonical WAV layout.
 *
 * Throws if the data is too short or the RIFF/WAVE signatures are missing.
 */
export function extractWavSampleRate(data: Uint8Array): number {
  if (data.length < MIN_WAV_HEADER_SIZE) {
    throw new Error(
      `WAV data too short: expected at least ${MIN_WAV_HEADER_SIZE} bytes, got ${data.length}`,
    );
  }

  // Validate RIFF header signature (bytes 0-3)
  if (
    data[0] !== 0x52 || // R
    data[1] !== 0x49 || // I
    data[2] !== 0x46 || // F
    data[3] !== 0x46    // F
  ) {
    throw new Error('Invalid WAV file: missing RIFF header');
  }

  // Validate WAVE format marker (bytes 8-11)
  if (
    data[8] !== 0x57 ||  // W
    data[9] !== 0x41 ||  // A
    data[10] !== 0x56 || // V
    data[11] !== 0x45    // E
  ) {
    throw new Error('Invalid WAV file: missing WAVE format marker');
  }

  // Read sample rate as little-endian uint32 at offset 24
  const sampleRate =
    data[SAMPLE_RATE_OFFSET] |
    (data[SAMPLE_RATE_OFFSET + 1] << 8) |
    (data[SAMPLE_RATE_OFFSET + 2] << 16) |
    (data[SAMPLE_RATE_OFFSET + 3] << 24);

  // Use unsigned interpretation (>>> 0 converts to uint32)
  const unsignedRate = sampleRate >>> 0;

  if (unsignedRate === 0) {
    throw new Error('Invalid WAV file: sample rate is zero');
  }

  return unsignedRate;
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
  rootHandle: FileSystemDirectoryHandle,
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
