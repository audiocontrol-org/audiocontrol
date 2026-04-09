/**
 * SCSI disk browser test — enumerate disks, read partitions, volumes, and files.
 *
 * Probes all SCSI IDs (0-7, excluding the sampler at ID 6) to find
 * Akai-formatted disks, then parses their partition/volume/file structure.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';
import { createScsiDiskClient } from '@audiocontrol/midi-core';
import {
  parsePartitionTable,
  parseVolumeList,
  parseFileList,
  readFileData,
  parseSampleHeaderFromDisk,
  extractSampleAudio,
  akaiSampleToWav,
  parseProgramFromDisk,
  akaiProgramToCommon,
  BLOCK_SIZE,
  FILE_TYPE_SAMPLE,
  FILE_TYPE_PROGRAM,
  FILE_TYPE_SAMPLE_S1000,
  FILE_TYPE_PROGRAM_S1000,
} from '@audiocontrol/sampler-devices/s3k';

const SAMPLER_ID = 6; // Skip the sampler — it's not a disk

export async function runDiskBrowserTests(ctx: TestContext): Promise<TestResult[]> {
  return [
    await testDiskEnumerate(ctx),
    await testDiskReadSample(ctx),
    await testDiskReadProgram(ctx),
  ];
}

async function testDiskEnumerate(ctx: TestContext): Promise<TestResult> {
  const name = 'disk-enumerate';
  try {
    const disk = createScsiDiskClient(ctx.bridgeUrl);

    // Step 1: Probe all SCSI IDs to find disks
    const diskTargets: { id: number; vendor: string; product: string }[] = [];
    for (let id = 0; id <= 7; id++) {
      if (id === SAMPLER_ID) continue;
      try {
        const info = await disk.inquiry(id);
        ctx.log(`  SCSI ${id}: ${info.vendor} ${info.product}`);
        diskTargets.push({ id, vendor: info.vendor, product: info.product });
      } catch {
        // No device at this ID
      }
    }

    if (diskTargets.length === 0) {
      return { name, status: 'SKIP', detail: 'No SCSI disks found (only sampler at ID 6)' };
    }

    ctx.log(`  Found ${diskTargets.length} disk(s)`);

    // Step 2: Find a disk with Akai partitions
    let foundPartitions = false;
    let totalVolumes = 0;
    let totalFiles = 0;
    let firstVolumeName = '';

    for (const target of diskTargets) {
      ctx.log(`  Probing disk ${target.id} (${target.product})...`);

      try {
        // Read first 256 blocks to get partition table
        const diskData = await disk.readBlocks(target.id, 0, 256);
        const partitions = parsePartitionTable(diskData);

        if (partitions.length === 0) {
          ctx.log(`    No Akai partitions`);
          continue;
        }

        ctx.log(`    ${partitions.length} partition(s)`);
        foundPartitions = true;

        // Read partition 0 to get volumes
        const part0 = partitions[0];
        const partData = await disk.readBlocks(target.id, part0.offsetInBlocks, part0.sizeInBlocks);
        const volumes = parseVolumeList(partData);
        totalVolumes += volumes.length;

        ctx.log(`    ${volumes.length} volume(s) in partition 0`);

        for (const vol of volumes) {
          ctx.log(`      "${vol.name}" (type=${vol.type})`);
          if (!firstVolumeName) firstVolumeName = vol.name;

          // Parse files in this volume
          const files = parseFileList(partData, vol.startBlock);
          totalFiles += files.length;

          const isSample = (t: number) => t === FILE_TYPE_SAMPLE || t === FILE_TYPE_SAMPLE_S1000;
          const isProgram = (t: number) => t === FILE_TYPE_PROGRAM || t === FILE_TYPE_PROGRAM_S1000;
          const samples = files.filter(f => isSample(f.type)).length;
          const programs = files.filter(f => isProgram(f.type)).length;
          ctx.log(`        ${files.length} files (${samples} samples, ${programs} programs)`);
        }

        // Continue scanning — check all disks
      } catch (err) {
        ctx.log(`    Error reading disk ${target.id}: ${err}`);
      }
    }

    if (!foundPartitions) {
      return {
        name,
        status: 'FAIL',
        detail: `Found ${diskTargets.length} SCSI disks but none had Akai partitions`,
      };
    }

    return {
      name,
      status: 'PASS',
      detail: `${diskTargets.length} disks, ${totalVolumes} volumes, ${totalFiles} files`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSample(t: number): boolean {
  return t === FILE_TYPE_SAMPLE || t === FILE_TYPE_SAMPLE_S1000;
}

function isProgram(t: number): boolean {
  return t === FILE_TYPE_PROGRAM || t === FILE_TYPE_PROGRAM_S1000;
}

/** Find a disk with Akai content. Returns partition data + file list, or null. */
async function findDiskWithContent(
  bridgeUrl: string,
  log: (msg: string) => void,
): Promise<{ targetId: number; partitionData: Uint8Array; files: ReturnType<typeof parseFileList> } | null> {
  const disk = createScsiDiskClient(bridgeUrl);

  for (let id = 0; id <= 7; id++) {
    if (id === SAMPLER_ID) continue;
    try {
      await disk.inquiry(id);
    } catch {
      continue;
    }
    try {
      const diskData = await disk.readBlocks(id, 0, 256);
      const partitions = parsePartitionTable(diskData);
      if (partitions.length === 0) continue;

      const part0 = partitions[0];
      const partitionData = await disk.readBlocks(id, part0.offsetInBlocks, part0.sizeInBlocks);
      const volumes = parseVolumeList(partitionData);
      if (volumes.length === 0) continue;

      const files = parseFileList(partitionData, volumes[0].startBlock);
      const samples = files.filter(f => isSample(f.type));
      const programs = files.filter(f => isProgram(f.type));

      if (samples.length > 0 || programs.length > 0) {
        log(`  Using disk ${id}: ${samples.length} samples, ${programs.length} programs`);
        return { targetId: id, partitionData, files };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Test: read a sample from disk and convert to WAV
// ---------------------------------------------------------------------------

async function testDiskReadSample(ctx: TestContext): Promise<TestResult> {
  const name = 'disk-read-sample';
  try {
    const found = await findDiskWithContent(ctx.bridgeUrl, ctx.log);
    if (!found) {
      return { name, status: 'SKIP', detail: 'No disk with samples found' };
    }

    const sampleFile = found.files.find(f => isSample(f.type));
    if (!sampleFile) {
      return { name, status: 'SKIP', detail: 'No sample files on disk' };
    }

    ctx.log(`  Reading sample "${sampleFile.name}" (${sampleFile.size} bytes)...`);
    const fileData = readFileData(found.partitionData, sampleFile);
    ctx.log(`  File data: ${fileData.length} bytes`);

    const header = parseSampleHeaderFromDisk(fileData);
    ctx.log(`  Sample: "${header.name}", rate=${header.sampleRate}, length=${header.sampleLength}`);

    const pcm = extractSampleAudio(fileData, header);
    ctx.log(`  PCM: ${pcm.length} samples`);

    const wav = akaiSampleToWav(header, pcm);
    ctx.log(`  WAV: ${wav.length} bytes`);

    // Verify WAV header
    if (wav[0] !== 0x52 || wav[1] !== 0x49 || wav[2] !== 0x46 || wav[3] !== 0x46) {
      return { name, status: 'FAIL', detail: 'WAV does not start with RIFF' };
    }
    if (wav.length < 44) {
      return { name, status: 'FAIL', detail: `WAV too short: ${wav.length} bytes` };
    }

    return {
      name,
      status: 'PASS',
      detail: `"${header.name}" → ${pcm.length} samples → ${wav.length} byte WAV`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Test: read a program from disk and convert to common area
// ---------------------------------------------------------------------------

async function testDiskReadProgram(ctx: TestContext): Promise<TestResult> {
  const name = 'disk-read-program';
  try {
    // Try all disks to find one with an S3000-format program
    const found = await findDiskWithContent(ctx.bridgeUrl, ctx.log);
    if (!found) {
      return { name, status: 'SKIP', detail: 'No disk with programs found' };
    }

    const programFile = found.files.find(f => isProgram(f.type) && f.size >= BLOCK_SIZE);
    if (!programFile) {
      // Try any program file
      const anyProgram = found.files.find(f => isProgram(f.type));
      if (anyProgram) {
        return { name, status: 'SKIP', detail: `Program "${anyProgram.name}" is ${anyProgram.size} bytes (S1000 format, parser needs S3000)` };
      }
      return { name, status: 'SKIP', detail: 'No program files on disk' };
    }

    ctx.log(`  Reading program "${programFile.name}" (${programFile.size} bytes)...`);
    const fileData = readFileData(found.partitionData, programFile);
    ctx.log(`  File data: ${fileData.length} bytes`);

    const diskProgram = parseProgramFromDisk(fileData);
    ctx.log(`  Program: "${diskProgram.name}", ${diskProgram.numKeygroups} keygroups, polyphony=${diskProgram.polyphony}`);

    for (let i = 0; i < diskProgram.keygroups.length; i++) {
      const kg = diskProgram.keygroups[i];
      ctx.log(`    KG ${i}: notes ${kg.lowNote}-${kg.highNote}, samples: ${kg.sampleNames.join(', ')}`);
    }

    // Convert to common-area format
    const commonProgram = akaiProgramToCommon(diskProgram);
    ctx.log(`  Common program: ${commonProgram.zones.length} zones`);

    if (commonProgram.zones.length === 0 && diskProgram.numKeygroups > 0) {
      return {
        name,
        status: 'FAIL',
        detail: `Conversion produced 0 zones from ${diskProgram.numKeygroups} keygroups`,
      };
    }

    return {
      name,
      status: 'PASS',
      detail: `"${diskProgram.name}" → ${diskProgram.numKeygroups} keygroups → ${commonProgram.zones.length} zones`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
