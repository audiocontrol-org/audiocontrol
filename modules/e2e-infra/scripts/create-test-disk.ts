#!/usr/bin/env tsx
/**
 * Create a minimal Akai-formatted test disk image for e2e testing.
 *
 * Produces an .hds file with:
 *   - 1 partition (60MB / 3840 blocks)
 *   - 1 volume ("E2ETEST") with a small sample file
 *   - Remaining blocks free for write testing
 *
 * Usage: tsx create-test-disk.ts <output-path>
 */

import { writeFileSync } from 'fs';
import {
  BLOCK_SIZE,
  PART_TABLE_OFFSET,
  DIR_ENTRY_OFFSET,
  DIR_ENTRY_SIZE,
  FAT_OFFSET,
  FAT_MARK_END,
  FILE_ENTRY_SIZE,
  TYPE_DIR_S3000,
  FILE_TYPE_SAMPLE_S3000,
  asciiToAkai,
} from '@audiocontrol/sampler-devices/s3k';
import {
  writeU16LE,
  writeU24LE,
  writeFileToVolume,
} from '@audiocontrol/sampler-devices/s3k';

const PARTITION_BLOCKS = 480; // 480 × 8192 = ~3.75MB (small for fast tests)
const PARTITION_BYTES = PARTITION_BLOCKS * BLOCK_SIZE;

const outputPath = process.argv[2];
if (!outputPath) {
  console.error('Usage: tsx create-test-disk.ts <output-path>');
  process.exit(1);
}

// Create the disk image
const disk = new Uint8Array(PARTITION_BYTES + PART_TABLE_OFFSET + 256);

// Partition table at PART_TABLE_OFFSET
disk[PART_TABLE_OFFSET] = 1; // 1 partition
disk[PART_TABLE_OFFSET + 1] = 0x01; // flag
writeU16LE(disk, PART_TABLE_OFFSET + 2, PARTITION_BLOCKS); // partition size
writeU16LE(disk, PART_TABLE_OFFSET + 4, PARTITION_BLOCKS); // total

// Partition starts at offset 0 — write partition header
// First 2 bytes = partition size
writeU16LE(disk, 0, PARTITION_BLOCKS);

// Volume directory at DIR_ENTRY_OFFSET: one volume "E2ETEST"
const volumeStartBlock = 3; // blocks 0-2 are system/FAT area
const volName = asciiToAkai('E2ETEST');
disk.set(volName, DIR_ENTRY_OFFSET);
writeU16LE(disk, DIR_ENTRY_OFFSET + 12, TYPE_DIR_S3000);
writeU16LE(disk, DIR_ENTRY_OFFSET + 14, volumeStartBlock);

// FAT: mark blocks 0-2 as used (system), volume start block chains
// Block 0: system (partition header)
writeU16LE(disk, FAT_OFFSET + 0 * 2, FAT_MARK_END);
writeU16LE(disk, FAT_OFFSET + 1 * 2, FAT_MARK_END);
writeU16LE(disk, FAT_OFFSET + 2 * 2, FAT_MARK_END);
// Volume directory: block 3 → block 4 → END
writeU16LE(disk, FAT_OFFSET + 3 * 2, 4);
writeU16LE(disk, FAT_OFFSET + 4 * 2, FAT_MARK_END);
// Blocks 5+ are free (already 0x0000)

// Write a small test sample to the volume
const sampleData = new Uint8Array(512);
// Minimal sample: header + a few bytes of PCM
sampleData[0] = 0x03; // SHIDENT placeholder
for (let i = 100; i < 512; i++) {
  sampleData[i] = (i * 7) & 0xFF; // deterministic test pattern
}

const partData = disk.subarray(0, PARTITION_BYTES);
writeFileToVolume(partData, volumeStartBlock, 'TESTSAMPLE', FILE_TYPE_SAMPLE_S3000, sampleData);

writeFileSync(outputPath, disk);
console.log(`Created test disk: ${outputPath} (${disk.length} bytes, ${PARTITION_BLOCKS} blocks)`);
console.log(`  Volume: E2ETEST at block ${volumeStartBlock}`);
console.log(`  Sample: TESTSAMPLE (${sampleData.length} bytes)`);
