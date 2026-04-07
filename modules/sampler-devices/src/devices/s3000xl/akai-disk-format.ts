/**
 * Constants and types for the Akai S3000 disk format.
 *
 * Based on the akaitools Perl source. All multi-byte values are little-endian.
 * Block size is 8192 bytes (0x2000). Offsets marked "within partition" are
 * relative to the start of a partition, not to the start of the disk image.
 */

// ---------------------------------------------------------------------------
// Block geometry
// ---------------------------------------------------------------------------

/** Akai disk block size in bytes. */
export const BLOCK_SIZE = 0x2000;

// ---------------------------------------------------------------------------
// Partition table (global offsets from disk start)
// ---------------------------------------------------------------------------

/** Byte offset of the partition header from the start of the disk. */
export const PART_HEADER_OFFSET = 0x4400;

/** Byte offset of the partition table from the start of the disk. */
export const PART_TABLE_OFFSET = 0x4500;

/**
 * u16 LE sentinel at byte 0 of a partition. When the first two bytes of a
 * partition equal this value, no more partitions follow.
 */
export const PART_END_MARK = 0x8000;

// ---------------------------------------------------------------------------
// Root directory / volume list (offsets within a partition)
// ---------------------------------------------------------------------------

/** Byte offset within a partition where volume directory entries begin. */
export const DIR_ENTRY_OFFSET = 0xca;

/** Size in bytes of a single volume directory entry. */
export const DIR_ENTRY_SIZE = 16;

/** Maximum number of volumes per partition. */
export const MAX_DIR_ENTRIES = 100;

// ---------------------------------------------------------------------------
// File entries (within a volume's data block)
// ---------------------------------------------------------------------------

/** Size in bytes of a single file entry. */
export const FILE_ENTRY_SIZE = 24;

/** Maximum file entries for S3000-series disks. */
export const MAX_FILE_ENTRIES_S3000 = 509;

/** Maximum file entries for S1000-series disks. */
export const MAX_FILE_ENTRIES_S1000 = 125;

// ---------------------------------------------------------------------------
// FAT (File Allocation Table, offset within a partition)
// ---------------------------------------------------------------------------

/** Byte offset within a partition where the FAT begins. */
export const FAT_OFFSET = 0x70a;

/** FAT entry value: block is reserved (S1000 indicator). */
export const FAT_MARK_RESERVED = 0x4000;

/** FAT entry value: block is reserved (alternate). */
export const FAT_MARK_RESERVED2 = 0x8000;

/** FAT entry value: block is free. */
export const FAT_MARK_FREE = 0x0000;

/** FAT entry value: last block in a chain. */
export const FAT_MARK_END = 0xc000;

// ---------------------------------------------------------------------------
// Directory / file type codes
// ---------------------------------------------------------------------------

/** Directory entry type: slot is unused. */
export const TYPE_FREE = 0;

/** Directory entry type: S1000-series volume. */
export const TYPE_DIR_S1000 = 1;

/** Directory entry type: S3000-series volume. */
export const TYPE_DIR_S3000 = 3;

/** File entry type: program file. */
export const FILE_TYPE_PROGRAM = 0x70;

/** File entry type: sample file. */
export const FILE_TYPE_SAMPLE = 0x73;

// ---------------------------------------------------------------------------
// Akai character encoding
// ---------------------------------------------------------------------------

const AKAI_CHAR_MAP = '0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ#+-.';

/** Index of the space character in the Akai character map. */
const AKAI_SPACE = 10;

/**
 * Convert an Akai-encoded byte sequence to an ASCII string.
 * Trailing spaces are trimmed.
 */
export function akaiToAscii(bytes: Uint8Array): string {
  const chars: string[] = [];
  for (const b of bytes) {
    chars.push(b < AKAI_CHAR_MAP.length ? AKAI_CHAR_MAP[b] : ' ');
  }
  return chars.join('').trimEnd();
}

/**
 * Convert an ASCII string to a 12-byte Akai-encoded byte sequence.
 * The string is uppercased and right-padded with spaces.
 */
export function asciiToAkai(str: string): Uint8Array {
  const padded = str.toUpperCase().padEnd(12, ' ');
  const bytes = new Uint8Array(12);
  for (let i = 0; i < 12; i++) {
    const idx = AKAI_CHAR_MAP.indexOf(padded[i]);
    bytes[i] = idx >= 0 ? idx : AKAI_SPACE;
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Parsed types
// ---------------------------------------------------------------------------

/** A partition entry from the disk-level partition table. */
export interface AkaiDiskPartitionEntry {
  /** Size of the partition measured in BLOCK_SIZE blocks. */
  sizeInBlocks: number;
  /** Byte offset of the partition from the start of the disk. */
  offsetInBlocks: number;
}

/** A volume (directory) entry within a partition. */
export interface AkaiDiskVolumeEntry {
  /** Akai-decoded volume name. */
  name: string;
  /** Volume type code (TYPE_DIR_S1000 or TYPE_DIR_S3000). */
  type: number;
  /** Starting block number within the partition. */
  startBlock: number;
}

/** A file entry within a volume. */
export interface AkaiDiskFileEntry {
  /** Akai-decoded file name. */
  name: string;
  /** File type code (FILE_TYPE_PROGRAM or FILE_TYPE_SAMPLE). */
  type: number;
  /** File size in bytes. */
  size: number;
  /** Starting block number within the partition. */
  startBlock: number;
  /** Position of this entry in the volume's file list (for writes). */
  entryIndex: number;
}
