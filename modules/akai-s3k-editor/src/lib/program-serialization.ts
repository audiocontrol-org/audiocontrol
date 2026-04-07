/**
 * S3000XL program serialization and deserialization.
 *
 * Serializes a complete program (header + all keygroups) to a YAML
 * format suitable for library storage, and deserializes back for
 * import to the device.
 *
 * Raw SysEx bytes are preserved as base64 to ensure exact round-trip
 * fidelity. Not all S3000XL fields have generated writers, so
 * reconstructing from field values alone would lose data.
 *
 * Human-readable field values are also included for inspection and
 * future use (e.g., cross-device translation).
 */

import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import type { ProgramHeader, KeygroupHeader, AkaiDiskProgram } from '@audiocontrol/sampler-devices/s3k';

// =========================================================================
// Types
// =========================================================================

/** Serialized program format stored as YAML in the library. */
export interface SerializedProgram {
  format: 's3000xl-program';
  version: 1;
  name: string;
  keygroupCount: number;
  sampleReferences: string[];
  programRaw: string;
  keygroupsRaw: string[];
  /** Human-readable program fields (informational, not used for import) */
  program: Record<string, unknown>;
  /** Human-readable keygroup fields (informational, not used for import) */
  keygroups: Record<string, unknown>[];
}

// =========================================================================
// Helpers
// =========================================================================

/** Fields to exclude from the human-readable snapshot. */
const EXCLUDED_SUFFIXES = ['Label'];
const EXCLUDED_FIELDS = new Set(['raw']);

/** Base64-encode a number array (SysEx nibble data). */
function encodeRaw(raw: number[]): string {
  const bytes = new Uint8Array(raw);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode base64 back to a number array. */
function decodeRaw(b64: string): number[] {
  const binary = atob(b64);
  const result: number[] = new Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

/**
 * Extract human-readable fields from a header object.
 * Strips `raw`, `*Label`, and internal-use fields.
 */
function extractFields(header: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(header)) {
    if (EXCLUDED_FIELDS.has(key)) continue;
    if (EXCLUDED_SUFFIXES.some((s) => key.endsWith(s))) continue;
    result[key] = value;
  }
  return result;
}

/** Extract sample names from keygroup SNAME1-4 fields. */
export function extractSampleReferences(keygroups: KeygroupHeader[]): string[] {
  const names = new Set<string>();
  for (const kg of keygroups) {
    for (const field of ['SNAME1', 'SNAME2', 'SNAME3', 'SNAME4'] as const) {
      const name = kg[field]?.trim();
      if (name && name.length > 0) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

// =========================================================================
// Public API
// =========================================================================

/**
 * Serialize a program header and its keygroups to YAML for library storage.
 */
export function serializeProgram(
  programHeader: ProgramHeader,
  keygroupHeaders: KeygroupHeader[],
): string {
  const serialized: SerializedProgram = {
    format: 's3000xl-program',
    version: 1,
    name: programHeader.PRNAME.trim(),
    keygroupCount: keygroupHeaders.length,
    sampleReferences: extractSampleReferences(keygroupHeaders),
    programRaw: encodeRaw(programHeader.raw),
    keygroupsRaw: keygroupHeaders.map((kg) => encodeRaw(kg.raw)),
    program: extractFields(programHeader as unknown as Record<string, unknown>),
    keygroups: keygroupHeaders.map(
      (kg) => extractFields(kg as unknown as Record<string, unknown>),
    ),
  };

  return stringifyYaml(serialized, { indent: 2, lineWidth: 120 });
}

/**
 * Deserialize a YAML string back to a SerializedProgram.
 *
 * Validates the format identifier and version. Returns the structured
 * data including decoded raw bytes ready for device import.
 */
export function deserializeProgram(yamlContent: string): SerializedProgram {
  const parsed = parseYaml(yamlContent) as Record<string, unknown>;

  if (parsed.format !== 's3000xl-program') {
    throw new Error(
      `Invalid program format: expected "s3000xl-program", got "${String(parsed.format)}"`,
    );
  }
  if (parsed.version !== 1) {
    throw new Error(
      `Unsupported program version: expected 1, got ${String(parsed.version)}`,
    );
  }
  if (typeof parsed.programRaw !== 'string') {
    throw new Error('Missing programRaw field in serialized program');
  }
  if (!Array.isArray(parsed.keygroupsRaw)) {
    throw new Error('Missing keygroupsRaw field in serialized program');
  }

  return {
    format: 's3000xl-program',
    version: 1,
    name: String(parsed.name ?? ''),
    keygroupCount: Number(parsed.keygroupCount ?? 0),
    sampleReferences: Array.isArray(parsed.sampleReferences)
      ? (parsed.sampleReferences as string[])
      : [],
    programRaw: parsed.programRaw,
    keygroupsRaw: parsed.keygroupsRaw as string[],
    program: (parsed.program ?? {}) as Record<string, unknown>,
    keygroups: Array.isArray(parsed.keygroups)
      ? (parsed.keygroups as Record<string, unknown>[])
      : [],
  };
}

/**
 * Decode the raw SysEx bytes from a serialized program.
 *
 * Returns the program header raw bytes and an array of keygroup raw bytes,
 * ready to be sent to the device via writeProgramHeader/writeKeygroupHeader.
 */
export function decodeSerializedRaw(serialized: SerializedProgram): {
  programRaw: number[];
  keygroupsRaw: number[][];
} {
  return {
    programRaw: decodeRaw(serialized.programRaw),
    keygroupsRaw: serialized.keygroupsRaw.map(decodeRaw),
  };
}

// =========================================================================
// Disk-origin serialization
// =========================================================================

/** Serialized disk-origin program stored as YAML in the S3K library. */
export interface SerializedDiskProgram {
  format: 's3000xl-disk-program';
  version: 1;
  name: string;
  keygroupCount: number;
  sampleReferences: string[];
  /** Raw on-disk file bytes (program header + keygroups), base64 */
  fileRaw: string;
  /** Human-readable parsed fields (informational) */
  program: Record<string, unknown>;
  keygroups: Record<string, unknown>[];
}

/** Base64-encode a Uint8Array. */
function encodeBytes(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

/** Decode base64 to Uint8Array. */
function decodeBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    result[i] = binary.charCodeAt(i);
  }
  return result;
}

/**
 * Serialize a disk-origin program to YAML for S3K library storage.
 *
 * Stores the complete raw file bytes (as read from disk via readFileData)
 * so they can be written back to any Akai disk without loss.
 */
export function serializeDiskProgram(diskProgram: AkaiDiskProgram, fileData: Uint8Array): string {
  const sampleNames = new Set<string>();
  for (const kg of diskProgram.keygroups) {
    for (const name of kg.sampleNames) {
      const trimmed = name.trim();
      if (trimmed.length > 0) {
        sampleNames.add(trimmed);
      }
    }
  }

  const serialized: SerializedDiskProgram = {
    format: 's3000xl-disk-program',
    version: 1,
    name: diskProgram.name,
    keygroupCount: diskProgram.numKeygroups,
    sampleReferences: [...sampleNames].sort(),
    fileRaw: encodeBytes(fileData),
    program: {
      name: diskProgram.name,
      midiProgramNumber: diskProgram.midiProgramNumber,
      midiChannel: diskProgram.midiChannel,
      polyphony: diskProgram.polyphony,
      numKeygroups: diskProgram.numKeygroups,
    },
    keygroups: diskProgram.keygroups.map((kg) => ({
      lowNote: kg.lowNote,
      highNote: kg.highNote,
      sampleNames: kg.sampleNames,
    })),
  };

  return stringifyYaml(serialized, { indent: 2, lineWidth: 120 });
}

/**
 * Deserialize a disk-origin program YAML back to structured data.
 */
export function deserializeDiskProgram(yamlContent: string): SerializedDiskProgram {
  const parsed = parseYaml(yamlContent) as Record<string, unknown>;

  if (parsed.format !== 's3000xl-disk-program') {
    throw new Error(
      `Invalid format: expected "s3000xl-disk-program", got "${String(parsed.format)}"`,
    );
  }
  if (parsed.version !== 1) {
    throw new Error(`Unsupported version: expected 1, got ${String(parsed.version)}`);
  }
  if (typeof parsed.fileRaw !== 'string') {
    throw new Error('Missing fileRaw field');
  }

  return {
    format: 's3000xl-disk-program',
    version: 1,
    name: String(parsed.name ?? ''),
    keygroupCount: Number(parsed.keygroupCount ?? 0),
    sampleReferences: Array.isArray(parsed.sampleReferences)
      ? (parsed.sampleReferences as string[])
      : [],
    fileRaw: parsed.fileRaw,
    program: (parsed.program ?? {}) as Record<string, unknown>,
    keygroups: Array.isArray(parsed.keygroups)
      ? (parsed.keygroups as Record<string, unknown>[])
      : [],
  };
}

/**
 * Decode the raw file bytes from a serialized disk-origin program.
 * Returns the complete on-disk file data ready to write back to an Akai disk.
 */
export function decodeDiskProgramRaw(serialized: SerializedDiskProgram): Uint8Array {
  return decodeBytes(serialized.fileRaw);
}

/**
 * Determine whether a serialized YAML is SysEx-origin or disk-origin
 * by quick-scanning for the format field.
 */
export function detectProgramFormat(yamlContent: string): 's3000xl-program' | 's3000xl-disk-program' | 'unknown' {
  if (yamlContent.includes('format: s3000xl-disk-program')) {
    return 's3000xl-disk-program';
  }
  if (yamlContent.includes('format: s3000xl-program')) {
    return 's3000xl-program';
  }
  return 'unknown';
}
