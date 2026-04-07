/**
 * Parser for the Akai S3000 disk format.
 *
 * All functions operate on in-memory Uint8Array slices. Partition-level
 * functions expect data starting at the partition's byte offset (i.e., the
 * caller slices the disk image to the correct partition first).
 *
 * Based on the akaitools Perl source.
 */

import {
  BLOCK_SIZE,
  PART_TABLE_OFFSET,
  PART_END_MARK,
  DIR_ENTRY_OFFSET,
  DIR_ENTRY_SIZE,
  MAX_DIR_ENTRIES,
  FILE_ENTRY_SIZE,
  MAX_FILE_ENTRIES_S3000,
  MAX_FILE_ENTRIES_S1000,
  FAT_OFFSET,
  FAT_MARK_RESERVED,
  FAT_MARK_END,
  FAT_MARK_FREE,
  TYPE_FREE,
  akaiToAscii,
  type AkaiDiskPartitionEntry,
  type AkaiDiskVolumeEntry,
  type AkaiDiskFileEntry,
} from '@/devices/s3000xl/akai-disk-format.js';

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/** Read a little-endian unsigned 16-bit integer from `data` at `offset`. */
export function readU16LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8);
}

/**
 * Read a little-endian unsigned 24-bit integer from `data` at `offset`.
 * Used for file sizes in file entries.
 */
function readU24LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16);
}

// ---------------------------------------------------------------------------
// Partition table
// ---------------------------------------------------------------------------

/**
 * Parse the disk-level partition table.
 *
 * @param diskData - Raw bytes starting from disk offset 0. At least the first
 *   `PART_TABLE_OFFSET + 256` bytes are needed.
 * @returns Array of partition entries with sizes and cumulative byte offsets.
 */
export function parsePartitionTable(
  diskData: Uint8Array,
): AkaiDiskPartitionEntry[] {
  const partCount = diskData[PART_TABLE_OFFSET];
  if (partCount === 0) {
    return [];
  }

  const partitions: AkaiDiskPartitionEntry[] = [];
  let cumulativeBlocks = 0;

  for (let i = 0; i < partCount; i++) {
    const sizeInBlocks = readU16LE(
      diskData,
      PART_TABLE_OFFSET + 2 + i * 2,
    );

    // Validate: read the first two bytes of the partition. If they equal
    // PART_END_MARK, there are no more partitions on disk.
    const partByteOffset = cumulativeBlocks * BLOCK_SIZE;
    if (partByteOffset + 1 < diskData.length) {
      const marker = readU16LE(diskData, partByteOffset);
      if (marker === PART_END_MARK) {
        break;
      }
    }

    partitions.push({
      sizeInBlocks,
      offsetInBlocks: cumulativeBlocks,
    });

    cumulativeBlocks += sizeInBlocks;
  }

  return partitions;
}

// ---------------------------------------------------------------------------
// Volume (directory) list
// ---------------------------------------------------------------------------

/**
 * Parse the volume list within a single partition.
 *
 * @param partitionData - Raw bytes of one partition, starting at offset 0 of
 *   the partition.
 * @returns Array of non-free volume entries.
 */
export function parseVolumeList(
  partitionData: Uint8Array,
): AkaiDiskVolumeEntry[] {
  const volumes: AkaiDiskVolumeEntry[] = [];

  for (let i = 0; i < MAX_DIR_ENTRIES; i++) {
    const entryOffset = DIR_ENTRY_OFFSET + i * DIR_ENTRY_SIZE;
    if (entryOffset + DIR_ENTRY_SIZE > partitionData.length) {
      break;
    }

    const nameBytes = partitionData.slice(entryOffset, entryOffset + 12);
    const type = readU16LE(partitionData, entryOffset + 12);
    const startBlock = readU16LE(partitionData, entryOffset + 14);

    if (type === TYPE_FREE) {
      continue;
    }

    volumes.push({
      name: akaiToAscii(nameBytes),
      type,
      startBlock,
    });
  }

  return volumes;
}

// ---------------------------------------------------------------------------
// File list
// ---------------------------------------------------------------------------

/**
 * Read a single FAT entry for a given block number.
 */
function readFatEntry(partitionData: Uint8Array, block: number): number {
  return readU16LE(partitionData, FAT_OFFSET + block * 2);
}

/**
 * Parse the file list within a volume.
 *
 * @param partitionData - Raw bytes of the partition containing the volume.
 * @param volumeStartBlock - The volume's starting block number within the
 *   partition (from AkaiDiskVolumeEntry.startBlock).
 * @returns Array of non-free file entries.
 */
export function parseFileList(
  partitionData: Uint8Array,
  volumeStartBlock: number,
): AkaiDiskFileEntry[] {
  // Determine S1000 vs S3000 format by checking the FAT entry for the
  // volume's start block. S1000 marks it as FAT_MARK_RESERVED.
  const fatEntry = readFatEntry(partitionData, volumeStartBlock);
  const isS1000 = fatEntry === FAT_MARK_RESERVED;
  const maxEntries = isS1000
    ? MAX_FILE_ENTRIES_S1000
    : MAX_FILE_ENTRIES_S3000;

  // Collect all blocks belonging to this volume directory.
  // For S1000, only the start block is used. For S3000, follow the FAT chain.
  const dirBlocks: number[] = [];
  if (isS1000) {
    dirBlocks.push(volumeStartBlock);
  } else {
    dirBlocks.push(...readFatChain(partitionData, volumeStartBlock));
  }

  // Read all raw file entry bytes across the directory blocks.
  const rawEntries = concatenateBlocks(partitionData, dirBlocks);

  const files: AkaiDiskFileEntry[] = [];
  let entryIndex = 0;

  for (
    let offset = 0;
    offset + FILE_ENTRY_SIZE <= rawEntries.length && entryIndex < maxEntries;
    offset += FILE_ENTRY_SIZE, entryIndex++
  ) {
    const entryType = rawEntries[offset + 16]; // byte after 12-name + 4-pad
    if (entryType === TYPE_FREE) {
      continue;
    }

    const nameBytes = rawEntries.slice(offset, offset + 12);
    const size = readU24LE(rawEntries, offset + 17);
    const startBlock = readU16LE(rawEntries, offset + 20);

    files.push({
      name: akaiToAscii(nameBytes),
      type: entryType,
      size,
      startBlock,
      entryIndex,
    });
  }

  return files;
}

// ---------------------------------------------------------------------------
// FAT chain traversal
// ---------------------------------------------------------------------------

/**
 * Follow the FAT chain starting from `startBlock`.
 *
 * @param partitionData - Raw bytes of the partition.
 * @param startBlock - First block in the chain.
 * @returns Ordered array of block numbers in the chain (including startBlock).
 * @throws Error if the chain contains a cycle or exceeds a safety limit.
 */
export function readFatChain(
  partitionData: Uint8Array,
  startBlock: number,
): number[] {
  const maxBlocks = partitionData.length / BLOCK_SIZE;
  const chain: number[] = [startBlock];
  const visited = new Set<number>([startBlock]);

  let current = startBlock;
  for (;;) {
    const next = readFatEntry(partitionData, current);

    if (next === FAT_MARK_END || next === FAT_MARK_FREE) {
      break;
    }

    // Safety: treat reserved marks as chain terminators.
    if (next === FAT_MARK_RESERVED) {
      break;
    }

    // The low bits of the FAT entry are the next block number. Values
    // with the high bit set (>= 0x4000) are markers, not block refs.
    if (next >= 0x4000) {
      break;
    }

    if (next >= maxBlocks) {
      throw new Error(
        `FAT chain references block ${next} beyond partition size ${maxBlocks}`,
      );
    }

    if (visited.has(next)) {
      throw new Error(
        `FAT chain cycle detected at block ${next}`,
      );
    }

    visited.add(next);
    chain.push(next);
    current = next;
  }

  return chain;
}

// ---------------------------------------------------------------------------
// File data extraction
// ---------------------------------------------------------------------------

/**
 * Concatenate the contents of the given blocks into a single Uint8Array.
 */
function concatenateBlocks(
  partitionData: Uint8Array,
  blocks: number[],
): Uint8Array {
  const result = new Uint8Array(blocks.length * BLOCK_SIZE);
  for (let i = 0; i < blocks.length; i++) {
    const blockOffset = blocks[i] * BLOCK_SIZE;
    const blockEnd = Math.min(blockOffset + BLOCK_SIZE, partitionData.length);
    result.set(
      partitionData.subarray(blockOffset, blockEnd),
      i * BLOCK_SIZE,
    );
  }
  return result;
}

/**
 * Read the raw bytes of a file from the partition.
 *
 * @param partitionData - Raw bytes of the partition containing the file.
 * @param fileEntry - Parsed file entry with startBlock and size.
 * @returns The file's raw bytes, truncated to the declared file size.
 */
export function readFileData(
  partitionData: Uint8Array,
  fileEntry: AkaiDiskFileEntry,
): Uint8Array {
  const chain = readFatChain(partitionData, fileEntry.startBlock);
  const raw = concatenateBlocks(partitionData, chain);
  return raw.slice(0, fileEntry.size);
}
