import { describe, it, expect } from 'vitest';
import {
  BLOCK_SIZE, PART_TABLE_OFFSET, PART_END_MARK,
  DIR_ENTRY_OFFSET, DIR_ENTRY_SIZE,
  FAT_OFFSET, FAT_MARK_END, FAT_MARK_RESERVED,
  TYPE_DIR_S3000, asciiToAkai,
} from '@/devices/s3000xl/akai-disk-format';
import {
  parsePartitionTable,
  parseVolumeList,
  parseFileList,
  readFatChain,
  readFileData,
} from '@/devices/s3000xl/akai-disk-parser';

function makePartitionTable(sizes: number[]): Uint8Array {
  // Minimum disk data: partition size at byte 0 + partition table at 0x4500
  const data = new Uint8Array(PART_TABLE_OFFSET + 256);

  // First partition size as u16 LE at byte 0
  if (sizes.length > 0) {
    data[0] = sizes[0] & 0xff;
    data[1] = (sizes[0] >> 8) & 0xff;
  }

  // Partition table at 0x4500: count, flag, then sizes
  data[PART_TABLE_OFFSET] = sizes.length;
  data[PART_TABLE_OFFSET + 1] = 0x01;
  let offset = PART_TABLE_OFFSET + 2;
  for (const size of sizes) {
    data[offset] = size & 0xff;
    data[offset + 1] = (size >> 8) & 0xff;
    offset += 2;
  }
  // Total
  const total = sizes.reduce((a, b) => a + b, 0);
  data[offset] = total & 0xff;
  data[offset + 1] = (total >> 8) & 0xff;

  return data;
}

function makePartitionWithVolume(volumeName: string, volumeStartBlock: number): Uint8Array {
  const data = new Uint8Array(BLOCK_SIZE * 4); // 4 Akai blocks

  // Partition size at byte 0
  const partSize = 100; // 100 blocks
  data[0] = partSize & 0xff;
  data[1] = (partSize >> 8) & 0xff;

  // Volume directory entry at DIR_ENTRY_OFFSET
  const nameBytes = asciiToAkai(volumeName);
  const entryOffset = DIR_ENTRY_OFFSET;
  data.set(nameBytes, entryOffset);
  // Type (u16 LE) = TYPE_DIR_S3000 (3)
  data[entryOffset + 12] = TYPE_DIR_S3000;
  data[entryOffset + 13] = 0;
  // Start block (u16 LE)
  data[entryOffset + 14] = volumeStartBlock & 0xff;
  data[entryOffset + 15] = (volumeStartBlock >> 8) & 0xff;

  // FAT: mark the volume's start block as reserved (S3000)
  const fatBase = FAT_OFFSET;
  // Block 0-2: reserved
  for (let i = 0; i < 3; i++) {
    data[fatBase + i * 2] = FAT_MARK_RESERVED & 0xff;
    data[fatBase + i * 2 + 1] = (FAT_MARK_RESERVED >> 8) & 0xff;
  }
  // Volume start block: second block for S3000 file entries
  const secondBlock = volumeStartBlock + 1;
  data[fatBase + volumeStartBlock * 2] = secondBlock & 0xff;
  data[fatBase + volumeStartBlock * 2 + 1] = (secondBlock >> 8) & 0xff;
  // Second block: reserved2
  data[fatBase + secondBlock * 2] = 0x00;
  data[fatBase + secondBlock * 2 + 1] = 0x80; // FAT_MARK_RESERVED2

  return data;
}

describe('parsePartitionTable', () => {
  it('parses single partition', () => {
    const data = makePartitionTable([3840]); // 3840 blocks = 30MB
    const partitions = parsePartitionTable(data);
    expect(partitions.length).toBe(1);
    expect(partitions[0].sizeInBlocks).toBe(3840);
    expect(partitions[0].offsetInBlocks).toBe(0);
  });

  it('parses multiple partitions with cumulative offsets', () => {
    const data = makePartitionTable([3840, 3840]);
    const partitions = parsePartitionTable(data);
    expect(partitions.length).toBe(2);
    expect(partitions[0].offsetInBlocks).toBe(0);
    expect(partitions[1].offsetInBlocks).toBe(3840);
  });

  it('returns empty for end-mark partition', () => {
    const data = new Uint8Array(PART_TABLE_OFFSET + 10);
    // Set partition size to PART_END_MARK
    data[0] = PART_END_MARK & 0xff;
    data[1] = (PART_END_MARK >> 8) & 0xff;
    const partitions = parsePartitionTable(data);
    expect(partitions.length).toBe(0);
  });
});

describe('parseVolumeList', () => {
  it('parses a single volume', () => {
    const data = makePartitionWithVolume('TEST VOL', 3);
    const volumes = parseVolumeList(data);
    expect(volumes.length).toBe(1);
    expect(volumes[0].name).toBe('TEST VOL');
    expect(volumes[0].type).toBe(TYPE_DIR_S3000);
    expect(volumes[0].startBlock).toBe(3);
  });

  it('skips free entries', () => {
    const data = makePartitionWithVolume('VOL1', 3);
    // Second entry is all zeros (free)
    const volumes = parseVolumeList(data);
    expect(volumes.length).toBe(1);
  });
});

describe('readFatChain', () => {
  it('follows a simple chain', () => {
    // Need at least 7 blocks worth of data so block 6 is within bounds
    const data = new Uint8Array(BLOCK_SIZE * 8);
    // FAT: block 5 -> block 6 -> END
    const fatBase = FAT_OFFSET;
    data[fatBase + 5 * 2] = 6;
    data[fatBase + 5 * 2 + 1] = 0;
    data[fatBase + 6 * 2] = FAT_MARK_END & 0xff;
    data[fatBase + 6 * 2 + 1] = (FAT_MARK_END >> 8) & 0xff;

    const chain = readFatChain(data, 5);
    expect(chain).toEqual([5, 6]);
  });
});
