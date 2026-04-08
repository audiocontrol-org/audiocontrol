import { describe, it, expect } from 'vitest';
import {
  BLOCK_SIZE, FAT_OFFSET, FAT_MARK_FREE, FAT_MARK_END,
  FAT_MARK_RESERVED, FILE_TYPE_PROGRAM_S3000, FILE_TYPE_SAMPLE_S3000,
  DIR_ENTRY_OFFSET, DIR_ENTRY_SIZE, TYPE_DIR_S3000,
  asciiToAkai,
} from '@/devices/s3000xl/akai-disk-format';
import { readFatChain, readFileData, parseFileList } from '@/devices/s3000xl/akai-disk-parser';
import {
  writeU16LE, writeU24LE,
  readFat, writeFat, allocateBlocks, freeChain,
  writeFileBlocks, buildFileEntry, addFileEntry,
  writeFileToVolume,
} from '@/devices/s3000xl/akai-disk-writer';

/** Create partition data with a volume at the given start block. */
function makePartition(blockCount: number, volumeStartBlock: number): Uint8Array {
  const data = new Uint8Array(blockCount * BLOCK_SIZE);

  // Volume directory entry at DIR_ENTRY_OFFSET
  const nameBytes = asciiToAkai('TESTVOL');
  data.set(nameBytes, DIR_ENTRY_OFFSET);
  writeU16LE(data, DIR_ENTRY_OFFSET + 12, TYPE_DIR_S3000);
  writeU16LE(data, DIR_ENTRY_OFFSET + 14, volumeStartBlock);

  // Mark blocks 0-2 as reserved (system area)
  for (let i = 0; i < 3; i++) {
    writeU16LE(data, FAT_OFFSET + i * 2, FAT_MARK_RESERVED);
  }

  // Volume start block: chain to next block (S3000 directory needs ≥2 blocks)
  writeU16LE(data, FAT_OFFSET + volumeStartBlock * 2, volumeStartBlock + 1);
  writeU16LE(data, FAT_OFFSET + (volumeStartBlock + 1) * 2, FAT_MARK_END);

  return data;
}

describe('writeU16LE / writeU24LE', () => {
  it('writes u16 correctly', () => {
    const buf = new Uint8Array(4);
    writeU16LE(buf, 0, 0x1234);
    expect(buf[0]).toBe(0x34);
    expect(buf[1]).toBe(0x12);
  });

  it('writes u24 correctly', () => {
    const buf = new Uint8Array(4);
    writeU24LE(buf, 0, 0x123456);
    expect(buf[0]).toBe(0x56);
    expect(buf[1]).toBe(0x34);
    expect(buf[2]).toBe(0x12);
  });

  it('handles boundary values', () => {
    const buf = new Uint8Array(4);
    writeU16LE(buf, 0, 0);
    expect(buf[0]).toBe(0);
    expect(buf[1]).toBe(0);

    writeU16LE(buf, 0, 0xFFFF);
    expect(buf[0]).toBe(0xFF);
    expect(buf[1]).toBe(0xFF);
  });
});

describe('allocateBlocks', () => {
  it('allocates a single block', () => {
    const fat = new Uint16Array(10);
    // Mark blocks 0-2 as reserved
    fat[0] = FAT_MARK_RESERVED;
    fat[1] = FAT_MARK_RESERVED;
    fat[2] = FAT_MARK_RESERVED;

    const start = allocateBlocks(fat, 1);
    expect(start).toBe(3);
    expect(fat[3]).toBe(FAT_MARK_END);
  });

  it('chains multiple blocks', () => {
    const fat = new Uint16Array(10);
    fat[0] = FAT_MARK_RESERVED;
    fat[1] = FAT_MARK_RESERVED;
    fat[2] = FAT_MARK_RESERVED;

    const start = allocateBlocks(fat, 3);
    expect(start).toBe(3);
    expect(fat[3]).toBe(4);
    expect(fat[4]).toBe(5);
    expect(fat[5]).toBe(FAT_MARK_END);
  });

  it('skips non-free blocks in fragmented FAT', () => {
    const fat = new Uint16Array(10);
    fat[0] = FAT_MARK_RESERVED;
    fat[1] = FAT_MARK_RESERVED;
    fat[2] = FAT_MARK_RESERVED;
    fat[3] = FAT_MARK_RESERVED; // occupied
    fat[5] = FAT_MARK_RESERVED; // occupied

    const start = allocateBlocks(fat, 2);
    expect(start).toBe(4);
    expect(fat[4]).toBe(6); // skipped block 5
    expect(fat[6]).toBe(FAT_MARK_END);
  });

  it('throws when not enough free blocks', () => {
    const fat = new Uint16Array(3);
    fat[0] = FAT_MARK_RESERVED;
    fat[1] = FAT_MARK_RESERVED;
    fat[2] = FAT_MARK_RESERVED;

    expect(() => allocateBlocks(fat, 1)).toThrow('not enough free blocks');
  });
});

describe('freeChain', () => {
  it('frees a chain of blocks', () => {
    const fat = new Uint16Array(10);
    fat[3] = 4;
    fat[4] = 5;
    fat[5] = FAT_MARK_END;

    freeChain(fat, 3);
    expect(fat[3]).toBe(FAT_MARK_FREE);
    expect(fat[4]).toBe(FAT_MARK_FREE);
    expect(fat[5]).toBe(FAT_MARK_FREE);
  });
});

describe('writeFileBlocks', () => {
  it('writes data across blocks', () => {
    const data = new Uint8Array(6 * BLOCK_SIZE);
    const fat = new Uint16Array(10);
    // Chain: block 3 → 4 → END
    fat[3] = 4;
    fat[4] = FAT_MARK_END;

    const fileData = new Uint8Array(BLOCK_SIZE + 100);
    fileData.fill(0xAA, 0, BLOCK_SIZE);
    fileData.fill(0xBB, BLOCK_SIZE, BLOCK_SIZE + 100);

    writeFileBlocks(data, fat, 3, fileData);

    // First block should be 0xAA
    expect(data[3 * BLOCK_SIZE]).toBe(0xAA);
    expect(data[3 * BLOCK_SIZE + BLOCK_SIZE - 1]).toBe(0xAA);

    // Second block should start with 0xBB then zeros
    expect(data[4 * BLOCK_SIZE]).toBe(0xBB);
    expect(data[4 * BLOCK_SIZE + 99]).toBe(0xBB);
    expect(data[4 * BLOCK_SIZE + 100]).toBe(0); // zero-filled
  });
});

describe('buildFileEntry', () => {
  it('builds a valid 24-byte entry', () => {
    const entry = buildFileEntry('TEST PROG', FILE_TYPE_PROGRAM_S3000, 5, 16384);

    expect(entry.length).toBe(24);
    // Type at byte 16
    expect(entry[16]).toBe(FILE_TYPE_PROGRAM_S3000);
    // Size at bytes 17-19 (u24 LE): 16384 = 0x004000
    expect(entry[17]).toBe(0x00);
    expect(entry[18]).toBe(0x40);
    expect(entry[19]).toBe(0x00);
    // Start block at bytes 20-21 (u16 LE): 5
    expect(entry[20]).toBe(5);
    expect(entry[21]).toBe(0);
  });
});

describe('writeFileToVolume round-trip', () => {
  it('writes a file and reads it back with matching bytes', () => {
    const volumeStart = 3;
    const data = makePartition(20, volumeStart);

    const fileBytes = new Uint8Array(1000);
    for (let i = 0; i < fileBytes.length; i++) {
      fileBytes[i] = i & 0xFF;
    }

    writeFileToVolume(data, volumeStart, 'ROUNDTRIP', FILE_TYPE_SAMPLE_S3000, fileBytes);

    // Parse the file list and find our file
    const files = parseFileList(data, volumeStart);
    const found = files.find(f => f.name === 'ROUNDTRIP');
    expect(found).toBeDefined();
    expect(found!.type).toBe(FILE_TYPE_SAMPLE_S3000);
    expect(found!.size).toBe(1000);

    // Read the file data back
    const readBack = readFileData(data, found!);
    expect(readBack.length).toBe(1000);
    expect(readBack).toEqual(fileBytes);
  });

  it('can write multiple files to the same volume', () => {
    const volumeStart = 3;
    const data = makePartition(30, volumeStart);

    const file1 = new Uint8Array(500).fill(0x11);
    const file2 = new Uint8Array(500).fill(0x22);

    writeFileToVolume(data, volumeStart, 'FILE ONE', FILE_TYPE_PROGRAM_S3000, file1);
    writeFileToVolume(data, volumeStart, 'FILE TWO', FILE_TYPE_SAMPLE_S3000, file2);

    const files = parseFileList(data, volumeStart);
    expect(files.length).toBe(2);
    expect(files[0].name).toBe('FILE ONE');
    expect(files[1].name).toBe('FILE TWO');

    const readBack1 = readFileData(data, files[0]);
    const readBack2 = readFileData(data, files[1]);
    expect(readBack1).toEqual(file1);
    expect(readBack2).toEqual(file2);
  });
});
