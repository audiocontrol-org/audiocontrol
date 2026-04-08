/**
 * Writer for the Akai S3000 disk format.
 *
 * All functions operate on mutable Uint8Array partition data, following
 * the same pattern as akai-disk-parser.ts. The caller provides partition
 * data (which is mutated in-place) and is responsible for writing modified
 * blocks back to the SCSI disk.
 *
 * Based on the akaitools Perl source and the parser's read functions.
 */

import {
  BLOCK_SIZE,
  FAT_OFFSET,
  FAT_MARK_FREE,
  FAT_MARK_END,
  FILE_ENTRY_SIZE,
  FILE_TYPE_PROGRAM_S3000,
  FILE_TYPE_SAMPLE_S3000,
  asciiToAkai,
} from '@/devices/s3000xl/akai-disk-format.js';
import { readFatChain } from '@/devices/s3000xl/akai-disk-parser.js';

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/** Write a little-endian unsigned 16-bit integer into `buf` at `offset`. */
export function writeU16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
}

/** Write a little-endian unsigned 24-bit integer into `buf` at `offset`. */
export function writeU24LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
}

// ---------------------------------------------------------------------------
// FAT operations
// ---------------------------------------------------------------------------

/** Read the FAT as a Uint16Array for easier manipulation. */
export function readFat(partitionData: Uint8Array, maxBlocks: number): Uint16Array {
  const fat = new Uint16Array(maxBlocks);
  for (let i = 0; i < maxBlocks; i++) {
    const offset = FAT_OFFSET + i * 2;
    if (offset + 1 < partitionData.length) {
      fat[i] = partitionData[offset] | (partitionData[offset + 1] << 8);
    }
  }
  return fat;
}

/** Write the FAT array back into partition data. */
export function writeFat(partitionData: Uint8Array, fat: Uint16Array): void {
  for (let i = 0; i < fat.length; i++) {
    writeU16LE(partitionData, FAT_OFFSET + i * 2, fat[i]);
  }
}

/**
 * Allocate `count` free blocks in the FAT, chaining them together.
 * Returns the start block number. Throws if not enough free blocks.
 */
export function allocateBlocks(fat: Uint16Array, count: number): number {
  const allocated: number[] = [];

  for (let i = 0; i < fat.length && allocated.length < count; i++) {
    if (fat[i] === FAT_MARK_FREE) {
      allocated.push(i);
    }
  }

  if (allocated.length < count) {
    throw new Error(
      `not enough free blocks: need ${count}, found ${allocated.length}`,
    );
  }

  // Chain the allocated blocks
  for (let i = 0; i < allocated.length - 1; i++) {
    fat[allocated[i]] = allocated[i + 1];
  }
  fat[allocated[allocated.length - 1]] = FAT_MARK_END;

  return allocated[0];
}

/**
 * Free all blocks in a FAT chain starting from `startBlock`.
 */
export function freeChain(fat: Uint16Array, startBlock: number): void {
  let current = startBlock;
  const maxIter = fat.length;

  for (let i = 0; i < maxIter; i++) {
    const next = fat[current];
    fat[current] = FAT_MARK_FREE;

    if (next === FAT_MARK_END || next === FAT_MARK_FREE || next >= 0x4000) {
      break;
    }
    current = next;
  }
}

// ---------------------------------------------------------------------------
// Block-level write
// ---------------------------------------------------------------------------

/**
 * Write file data into the allocated blocks of a partition.
 * Follows the FAT chain from `startBlock` and copies data block by block.
 */
export function writeFileBlocks(
  partitionData: Uint8Array,
  fat: Uint16Array,
  startBlock: number,
  fileData: Uint8Array,
): void {
  let current = startBlock;
  let bytesWritten = 0;

  while (bytesWritten < fileData.length) {
    const blockOffset = current * BLOCK_SIZE;
    const remaining = fileData.length - bytesWritten;
    const chunkSize = Math.min(remaining, BLOCK_SIZE);

    partitionData.set(
      fileData.subarray(bytesWritten, bytesWritten + chunkSize),
      blockOffset,
    );

    // Zero-fill remainder of last block
    if (chunkSize < BLOCK_SIZE) {
      partitionData.fill(0, blockOffset + chunkSize, blockOffset + BLOCK_SIZE);
    }

    bytesWritten += chunkSize;

    const next = fat[current];
    if (next === FAT_MARK_END || next >= 0x4000) {
      break;
    }
    current = next;
  }
}

// ---------------------------------------------------------------------------
// Directory operations
// ---------------------------------------------------------------------------

/**
 * Build a 24-byte file entry for a volume's file list.
 *
 * Layout (from akaitools):
 *   0-11:  name (12 bytes, Akai encoding)
 *   12-15: padding (zeros)
 *   16:    type code
 *   17-19: size (u24 LE)
 *   20-21: start block (u16 LE)
 *   22-23: padding (zeros)
 */
export function buildFileEntry(
  name: string,
  type: number,
  startBlock: number,
  size: number,
): Uint8Array {
  const entry = new Uint8Array(FILE_ENTRY_SIZE);
  const nameBytes = asciiToAkai(name);
  entry.set(nameBytes, 0);
  entry[16] = type;
  writeU24LE(entry, 17, size);
  writeU16LE(entry, 20, startBlock);
  return entry;
}

/**
 * Add a file entry to a volume's directory.
 * Finds the first free entry slot and writes the entry there.
 * Returns the entry index. Throws if the directory is full.
 */
export function addFileEntry(
  partitionData: Uint8Array,
  volumeStartBlock: number,
  entry: Uint8Array,
): number {
  // Get directory blocks (follow FAT chain from volume start)
  const dirBlocks = readFatChain(partitionData, volumeStartBlock);

  for (let blockIdx = 0; blockIdx < dirBlocks.length; blockIdx++) {
    const blockOffset = dirBlocks[blockIdx] * BLOCK_SIZE;

    for (let slotOffset = 0; slotOffset + FILE_ENTRY_SIZE <= BLOCK_SIZE; slotOffset += FILE_ENTRY_SIZE) {
      const absOffset = blockOffset + slotOffset;
      const slotType = partitionData[absOffset + 16];

      if (slotType === 0) {
        // Free slot — write the entry here
        partitionData.set(entry, absOffset);
        return blockIdx * (BLOCK_SIZE / FILE_ENTRY_SIZE) + (slotOffset / FILE_ENTRY_SIZE);
      }
    }
  }

  throw new Error('volume directory is full');
}

// ---------------------------------------------------------------------------
// High-level write
// ---------------------------------------------------------------------------

/**
 * Write a complete file to a volume. Allocates blocks, writes data,
 * creates the directory entry, and flushes the FAT.
 *
 * @param partitionData - Mutable partition bytes (modified in-place).
 * @param volumeStartBlock - Start block of the target volume.
 * @param name - File name (max 12 chars, will be Akai-encoded).
 * @param type - File type code (FILE_TYPE_PROGRAM_S3000 or FILE_TYPE_SAMPLE_S3000).
 * @param fileData - Raw file bytes to write.
 * @returns List of Akai block numbers that were modified (for selective SCSI writes).
 */
export function writeFileToVolume(
  partitionData: Uint8Array,
  volumeStartBlock: number,
  name: string,
  type: number,
  fileData: Uint8Array,
): number[] {
  const blocksNeeded = Math.ceil(fileData.length / BLOCK_SIZE);
  const maxBlocks = Math.floor(partitionData.length / BLOCK_SIZE);
  const fat = readFat(partitionData, maxBlocks);

  const startBlock = allocateBlocks(fat, blocksNeeded);
  writeFileBlocks(partitionData, fat, startBlock, fileData);

  const entry = buildFileEntry(name, type, startBlock, fileData.length);
  addFileEntry(partitionData, volumeStartBlock, entry);

  writeFat(partitionData, fat);

  // Return all modified blocks: FAT block(s), directory blocks, and data blocks
  const dataBlocks = readFatChain(partitionData, startBlock);
  const dirBlocks = readFatChain(partitionData, volumeStartBlock);
  const fatBlockStart = Math.floor(FAT_OFFSET / BLOCK_SIZE);

  const modified = new Set<number>();
  modified.add(fatBlockStart);
  for (const b of dataBlocks) modified.add(b);
  for (const b of dirBlocks) modified.add(b);

  return [...modified].sort((a, b) => a - b);
}
