/**
 * SCSI disk write round-trip tests.
 *
 * Verifies that the disk writer (FAT allocation, directory updates, block
 * writes) works end-to-end against real Akai disk images served by s2p.
 *
 * Test flow:
 *   1. Read partition/volume/file structure from disk
 *   2. Read a known file's raw bytes
 *   3. Write that file to the same volume under a different name
 *   4. Read it back
 *   5. Compare bytes — must match
 *   6. Clean up (free the blocks, remove directory entry)
 */

import type { TestContext, TestResult } from '#node/lib/test-types.js';
import { createScsiDiskClient, type ScsiDiskClient } from '@audiocontrol/midi-core';
import {
  parsePartitionTable,
  parseVolumeList,
  parseFileList,
  readFileData,
  readFatChain,
  writeFileToVolume,
  readFat,
  writeFat,
  freeChain,
  writeU16LE,
  BLOCK_SIZE,
  FAT_OFFSET,
  FILE_ENTRY_SIZE,
  isAkaiSample,
  isAkaiProgram,
  type AkaiDiskFileEntry,
} from '@audiocontrol/sampler-devices/s3k';

export async function runDiskWriteTests(ctx: TestContext): Promise<TestResult[]> {
  return [
    await testDiskReadWrite(ctx),
  ];
}

/**
 * Read a file from disk, write a copy to the same volume, read the copy
 * back, compare bytes, then clean up.
 */
async function testDiskReadWrite(ctx: TestContext): Promise<TestResult> {
  const name = 'disk-write-round-trip';
  try {
    const diskClient = createScsiDiskClient(ctx.bridgeUrl);

    // Find a disk target with files on it
    const { targetId, partData, partOffset, volume, sourceFile } =
      await findTestTarget(diskClient, ctx.log);

    if (!sourceFile) {
      return { name, status: 'SKIP', detail: 'no suitable disk file found for testing' };
    }

    ctx.log(`  Source: "${sourceFile.name}" (${sourceFile.size} bytes) on volume "${volume.name}" at SCSI ID ${targetId}`);

    // Step 1: Read the source file's raw bytes
    const originalBytes = readFileData(partData, sourceFile);
    ctx.log(`  Read ${originalBytes.length} bytes from disk`);

    // Step 2: Write a copy under a test name
    const testName = 'E2E-TEST';
    const workingCopy = partData.slice(); // mutable copy
    const modifiedBlocks = writeFileToVolume(
      workingCopy,
      volume.startBlock,
      testName,
      sourceFile.type,
      originalBytes,
    );
    ctx.log(`  writeFileToVolume: ${modifiedBlocks.length} blocks modified`);

    // Step 3: Write modified blocks back to disk via SCSI
    for (const akaiBlock of modifiedBlocks) {
      const blockOffset = akaiBlock * BLOCK_SIZE;
      const lba = (partOffset + blockOffset) / 512;
      const blockData = workingCopy.subarray(blockOffset, blockOffset + BLOCK_SIZE);
      await diskClient.writeBlocks(targetId, lba, blockData);
    }
    ctx.log(`  Wrote ${modifiedBlocks.length} blocks to SCSI disk`);

    // Step 4: Re-read the blocks we wrote plus the FAT/directory blocks
    // to verify. Read the full partition to ensure consistency.
    const totalSectors = Math.ceil(partData.length / 512);
    const partLba = partOffset / 512;
    const freshPartData = await diskClient.readBlocks(targetId, partLba, totalSectors);

    // Step 5: Find our test file and read it back
    const files = parseFileList(freshPartData, volume.startBlock);
    const testFile = files.find(f => f.name.trim() === testName);

    if (!testFile) {
      return { name, status: 'FAIL', detail: `test file "${testName}" not found after write` };
    }

    const readBackBytes = readFileData(freshPartData, testFile);
    ctx.log(`  Read back ${readBackBytes.length} bytes`);

    // Step 6: Compare
    if (readBackBytes.length !== originalBytes.length) {
      // Clean up before reporting failure
      await cleanupTestFile(diskClient, targetId, partOffset, freshPartData, volume.startBlock, testFile);
      return {
        name,
        status: 'FAIL',
        detail: `size mismatch: original ${originalBytes.length}, read back ${readBackBytes.length}`,
      };
    }

    let mismatches = 0;
    for (let i = 0; i < originalBytes.length; i++) {
      if (readBackBytes[i] !== originalBytes[i]) {
        mismatches++;
        if (mismatches <= 3) {
          ctx.log(`    Byte mismatch at offset ${i}: expected 0x${originalBytes[i].toString(16)}, got 0x${readBackBytes[i].toString(16)}`);
        }
      }
    }

    // Step 7: Clean up test file from disk
    await cleanupTestFile(diskClient, targetId, partOffset, freshPartData, volume.startBlock, testFile);
    ctx.log(`  Cleaned up test file`);

    if (mismatches > 0) {
      return {
        name,
        status: 'FAIL',
        detail: `${mismatches} byte mismatches in ${originalBytes.length} bytes`,
      };
    }

    return {
      name,
      status: 'PASS',
      detail: `${originalBytes.length} bytes round-tripped, ${modifiedBlocks.length} blocks written`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

/** Find a disk target with at least one file we can copy. */
async function findTestTarget(
  diskClient: ScsiDiskClient,
  log: (msg: string) => void,
): Promise<{
  targetId: number;
  partData: Uint8Array;
  partOffset: number;
  volume: { name: string; startBlock: number };
  sourceFile: AkaiDiskFileEntry | null;
}> {
  for (let id = 0; id <= 5; id++) {
    try {
      const inquiry = await diskClient.inquiry(id);
      if (!inquiry.vendor.trim()) continue;

      const capacity = await diskClient.readCapacity(id);
      // Read enough of the partition to cover the FAT plus a reasonable number
      // of data blocks. 5MB = ~610 Akai blocks. For heavily-used disks this
      // might still not find free space; the test will SKIP gracefully.
      const bytesToRead = Math.min(capacity.blockCount * capacity.blockSize, 5 * 1024 * 1024);
      const sectorsToRead = Math.ceil(bytesToRead / 512);
      const diskData = await diskClient.readBlocks(id, 0, sectorsToRead);

      const partitions = parsePartitionTable(diskData);
      for (const partition of partitions) {
        const partStart = partition.offsetInBlocks * BLOCK_SIZE;
        if (partStart + BLOCK_SIZE > diskData.length) continue;

        const partData = diskData.subarray(partStart, partStart + Math.min(
          partition.sizeInBlocks * BLOCK_SIZE,
          diskData.length - partStart,
        ));
        const volumes = parseVolumeList(partData);

        for (const vol of volumes) {
          try {
            const files = parseFileList(partData, vol.startBlock);
            // Find a small file (< 32KB) on a volume that has free blocks
            // Only count free blocks within the data we actually loaded
            // (blocks beyond our buffer can't be written to)
            const loadedBlocks = Math.floor(partData.length / BLOCK_SIZE);
            const fat = readFat(partData, loadedBlocks);
            let freeBlocks = 0;
            for (let b = 0; b < loadedBlocks; b++) {
              if (fat[b] === 0) freeBlocks++;
            }

            log(`  Volume "${vol.name}": ${loadedBlocks} loaded blocks, ${freeBlocks} free in loaded range`);
            if (freeBlocks < 2) {
              continue;
            }

            const candidate = files.find(
              f => (isAkaiSample(f.type) || isAkaiProgram(f.type)) && f.size > 0 && f.size < 32768,
            );
            if (candidate) {
              log(`  Volume has ${freeBlocks} free blocks`);
              log(`  Found test target: SCSI ID ${id}, volume "${vol.name}", file "${candidate.name}"`);
              return {
                targetId: id,
                partData,
                partOffset: partStart,
                volume: { name: vol.name, startBlock: vol.startBlock },
                sourceFile: candidate,
              };
            }
          } catch {
            // Volume parse error, try next
          }
        }
      }
    } catch {
      // Target not present, try next
    }
  }

  return {
    targetId: 0,
    partData: new Uint8Array(0),
    partOffset: 0,
    volume: { name: '', startBlock: 0 },
    sourceFile: null,
  };
}

/** Remove a test file from disk by freeing its FAT chain and clearing its directory entry. */
async function cleanupTestFile(
  diskClient: ScsiDiskClient,
  targetId: number,
  partOffset: number,
  partData: Uint8Array,
  volumeStartBlock: number,
  testFile: AkaiDiskFileEntry,
): Promise<void> {
  const workingCopy = partData.slice();
  const maxBlocks = Math.floor(workingCopy.length / BLOCK_SIZE);
  const fat = readFat(workingCopy, maxBlocks);

  // Free the file's block chain
  freeChain(fat, testFile.startBlock);
  writeFat(workingCopy, fat);

  // Clear the directory entry by zeroing the type byte
  const dirBlocks = readFatChain(workingCopy, volumeStartBlock);
  let entryIdx = 0;
  for (const blockNum of dirBlocks) {
    const blockOffset = blockNum * BLOCK_SIZE;
    for (let slotOffset = 0; slotOffset + FILE_ENTRY_SIZE <= BLOCK_SIZE; slotOffset += FILE_ENTRY_SIZE) {
      if (entryIdx === testFile.entryIndex) {
        // Zero out the entry
        workingCopy.fill(0, blockOffset + slotOffset, blockOffset + slotOffset + FILE_ENTRY_SIZE);
        // Write this block and the FAT block back to disk
        const fatBlockStart = Math.floor(FAT_OFFSET / BLOCK_SIZE);

        const modifiedBlocks = new Set([blockNum, fatBlockStart]);
        for (const b of modifiedBlocks) {
          const bOffset = b * BLOCK_SIZE;
          const lba = (partOffset + bOffset) / 512;
          const bData = workingCopy.subarray(bOffset, bOffset + BLOCK_SIZE);
          await diskClient.writeBlocks(targetId, lba, bData);
        }
        return;
      }
      entryIdx++;
    }
  }
}
