/**
 * Parser for Akai S1000/S3000 program files in on-disk binary format.
 *
 * On-disk format uses straight binary (1 byte = 1 byte), unlike the SysEx
 * nibble-encoded format used by the existing s3000xl.ts parsers. Field order
 * matches the S1000 SysEx spec but without nibble encoding.
 *
 * Each record (program header or keygroup) is RECORD_SIZE (192 / 0xC0) bytes.
 * The program header is the first record; keygroups follow consecutively.
 * This is NOT the same as BLOCK_SIZE (8192) which is the Akai disk allocation
 * unit. A program file's byte size from the FAT is record-aligned, not
 * block-aligned.
 *
 * Reference: akaitools-1.5 Synth/AkaiSample.pm save_program()
 */

import { akaiToAscii } from '@/devices/s3000xl/akai-disk-format.js';

// ---------------------------------------------------------------------------
// Program header field offsets (straight binary, within file data)
// ---------------------------------------------------------------------------

/**
 * Record size for on-disk programs and keygroups (192 bytes / 0xC0).
 * Both the program header and each keygroup occupy exactly one record.
 * NOT the same as BLOCK_SIZE (8192) which is the disk allocation unit.
 */
const RECORD_SIZE = 0xc0;

/** Program identifier byte (should be 1). */
const PRIDENT_OFFSET = 0;
const PRIDENT_VALUE = 1;

/** Program name: 12 bytes, Akai character encoding. */
const PRNAME_OFFSET = 3;
const PRNAME_LENGTH = 12;

/** MIDI program number (0-127). */
const PRGNUM_OFFSET = 15;

/** MIDI channel (0-15, 0xFF = OMNI). */
const PMCHAN_OFFSET = 16;

/** Polyphony (0-31, representing 1-32 voices). */
const POLYPH_OFFSET = 17;

/** Number of keygroups (1-99). Offset 0x2a per akaitools. */
const GROUPS_OFFSET = 0x2a;

// ---------------------------------------------------------------------------
// Keygroup field offsets (within a keygroup block)
// ---------------------------------------------------------------------------

/** Keygroup identifier byte (should be 2). */
const KGIDENT_OFFSET = 0;
const KGIDENT_VALUE = 2;

/** Low note of keygroup zone (MIDI note 24-127). */
const LONOTE_OFFSET = 3;

/** High note of keygroup zone (MIDI note 24-127). */
const HINOTE_OFFSET = 4;

/**
 * Velocity zone sample name offsets within a keygroup record.
 *
 * Zone 1 SNAME starts at offset 0x22 (34) per akaitools reference.
 * Each velocity zone block is 0x18 (24) bytes: 12-byte SNAME + control fields.
 * Subsequent zones follow at +24 byte intervals.
 *
 * Reference: akaitools-1.5 Synth/AkaiSample.pm — substr($keygroup, 0x22, 12)
 */
const ZONE_SNAME_BASE = 0x22;
const ZONE_BLOCK_SIZE = 0x18;
const ZONE_COUNT = 4;
const SNAME_LENGTH = 12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AkaiDiskProgram {
  name: string;
  midiProgramNumber: number;
  midiChannel: number;
  polyphony: number;
  numKeygroups: number;
  keygroups: AkaiDiskKeygroup[];
  rawProgramHeader: Uint8Array;
}

export interface AkaiDiskKeygroup {
  lowNote: number;
  highNote: number;
  sampleNames: string[];
  rawData: Uint8Array;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a program file from raw on-disk bytes.
 *
 * The bytes come from `readFileData()` -- the complete file contents as stored
 * on the Akai disk. The first block contains the program header; subsequent
 * blocks contain keygroup data (one block per keygroup).
 */
export function parseProgramFromDisk(fileData: Uint8Array): AkaiDiskProgram {
  if (fileData.length < RECORD_SIZE) {
    throw new Error(
      `Program file too small: ${fileData.length} bytes (minimum ${RECORD_SIZE})`,
    );
  }

  const ident = fileData[PRIDENT_OFFSET];
  if (ident !== PRIDENT_VALUE) {
    throw new Error(
      `Invalid program identifier: expected ${PRIDENT_VALUE}, got ${ident}`,
    );
  }

  const name = akaiToAscii(
    fileData.subarray(PRNAME_OFFSET, PRNAME_OFFSET + PRNAME_LENGTH),
  );
  const midiProgramNumber = fileData[PRGNUM_OFFSET];
  const midiChannel = fileData[PMCHAN_OFFSET];
  const polyphony = fileData[POLYPH_OFFSET];
  const numKeygroups = fileData[GROUPS_OFFSET];

  const rawProgramHeader = fileData.slice(0, RECORD_SIZE);

  const keygroups = parseKeygroups(fileData, numKeygroups);

  return {
    name,
    midiProgramNumber,
    midiChannel,
    polyphony,
    numKeygroups,
    keygroups,
    rawProgramHeader,
  };
}

/**
 * Parse keygroup records from the file data.
 *
 * Each keygroup occupies one RECORD_SIZE record starting after the program
 * header record.
 */
function parseKeygroups(
  fileData: Uint8Array,
  count: number,
): AkaiDiskKeygroup[] {
  const keygroups: AkaiDiskKeygroup[] = [];

  for (let i = 0; i < count; i++) {
    const recordOffset = (i + 1) * RECORD_SIZE;
    if (recordOffset + RECORD_SIZE > fileData.length) {
      break;
    }

    const kgData = fileData.subarray(recordOffset, recordOffset + RECORD_SIZE);

    const ident = kgData[KGIDENT_OFFSET];
    if (ident !== KGIDENT_VALUE) {
      break;
    }

    const lowNote = kgData[LONOTE_OFFSET];
    const highNote = kgData[HINOTE_OFFSET];
    const sampleNames = parseZoneSampleNames(kgData);

    keygroups.push({
      lowNote,
      highNote,
      sampleNames,
      rawData: fileData.slice(recordOffset, recordOffset + RECORD_SIZE),
    });
  }

  return keygroups;
}

/**
 * Extract velocity zone sample names from a keygroup block.
 *
 * Returns up to 4 sample names (one per velocity zone). Empty names
 * (all spaces) are included as empty strings.
 */
function parseZoneSampleNames(kgData: Uint8Array): string[] {
  const names: string[] = [];

  for (let zone = 0; zone < ZONE_COUNT; zone++) {
    const nameOffset = ZONE_SNAME_BASE + zone * ZONE_BLOCK_SIZE;
    if (nameOffset + SNAME_LENGTH > kgData.length) {
      break;
    }

    const nameBytes = kgData.subarray(nameOffset, nameOffset + SNAME_LENGTH);
    names.push(akaiToAscii(nameBytes));
  }

  return names;
}
