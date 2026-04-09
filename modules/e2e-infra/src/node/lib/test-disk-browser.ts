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
  BLOCK_SIZE,
} from '@audiocontrol/sampler-devices/s3k';

const SAMPLER_ID = 6; // Skip the sampler — it's not a disk

export async function runDiskBrowserTests(ctx: TestContext): Promise<TestResult[]> {
  return [await testDiskEnumerate(ctx)];
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
        const readBlocks = Math.min(part0.sizeInBlocks, 512);
        const partData = await disk.readBlocks(target.id, part0.offsetInBlocks, readBlocks);
        const volumes = parseVolumeList(partData);
        totalVolumes += volumes.length;

        ctx.log(`    ${volumes.length} volume(s) in partition 0`);

        for (const vol of volumes) {
          ctx.log(`      "${vol.name}" (type=${vol.type})`);
          if (!firstVolumeName) firstVolumeName = vol.name;

          // Parse files in this volume
          const files = parseFileList(partData, vol.startBlock);
          totalFiles += files.length;

          const samples = files.filter(f => f.type === 's').length;
          const programs = files.filter(f => f.type === 'p').length;
          ctx.log(`        ${files.length} files (${samples} samples, ${programs} programs)`);
        }

        // Only need one disk with data to pass
        break;
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
