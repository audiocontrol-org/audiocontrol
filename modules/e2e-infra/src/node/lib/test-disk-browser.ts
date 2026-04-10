/**
 * SCSI disk browser test — enumerate disks, read partitions, volumes, and files.
 *
 * Probes all SCSI IDs (0-7, excluding the sampler at ID 6) to find
 * Akai-formatted disks, then parses their partition/volume/file structure.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';
import { createScsiDiskClient } from '@audiocontrol/midi-core';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  parsePartitionTable,
  parseVolumeList,
  parseFileList,
  readFileData,
  parseSampleHeaderFromDisk,
  extractSampleAudio,
  akaiSampleToWav,
  akaiSampleToCommon,
  parseProgramFromDisk,
  akaiProgramToCommon,
  isAkaiSample,
  BLOCK_SIZE,
  FILE_TYPE_SAMPLE,
  FILE_TYPE_PROGRAM,
  FILE_TYPE_SAMPLE_S1000,
  FILE_TYPE_PROGRAM_S1000,
  type AkaiDiskSampleHeader,
} from '@audiocontrol/sampler-devices/s3k';
import { createNodeStorage } from '@audiocontrol/sampler-library/testing';
import { saveSample, type SampleSavePayload } from '@audiocontrol/sampler-library/browser';

const SAMPLER_ID = 6; // Skip the sampler — it's not a disk

export async function runDiskBrowserTests(ctx: TestContext): Promise<TestResult[]> {
  return [
    await testDiskEnumerate(ctx),
    await testDiskReadSample(ctx),
    await testDiskReadProgram(ctx),
    await testDiskSaveSampleToLibrary(ctx),
    await testDiskSaveProgramToLibrary(ctx),
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
    const found = await findDiskWithContent(ctx.bridgeUrl, ctx.log);
    if (!found) {
      return { name, status: 'SKIP', detail: 'No disk with programs found' };
    }

    const programFile = found.files.find(f => isProgram(f.type));
    if (!programFile) {
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

// ---------------------------------------------------------------------------
// Test: save disk sample to library as WAV
// ---------------------------------------------------------------------------

async function testDiskSaveSampleToLibrary(ctx: TestContext): Promise<TestResult> {
  const name = 'disk-save-sample';
  let tempDir: string | undefined;
  try {
    const found = await findDiskWithContent(ctx.bridgeUrl, ctx.log);
    if (!found) {
      return { name, status: 'SKIP', detail: 'No disk with samples found' };
    }

    const sampleFile = found.files.find(f => isSample(f.type));
    if (!sampleFile) {
      return { name, status: 'SKIP', detail: 'No sample files on disk' };
    }

    // Read and convert sample
    const fileData = readFileData(found.partitionData, sampleFile);
    const header = parseSampleHeaderFromDisk(fileData);
    const pcm = extractSampleAudio(fileData, header);
    const wav = akaiSampleToWav(header, pcm);
    const commonSample = akaiSampleToCommon(header);
    const sampleName = header.name.trim();
    commonSample.name = sampleName;

    ctx.log(`  Sample "${sampleName}": rate=${header.sampleRate}, length=${pcm.length}`);

    // Save to filesystem library
    tempDir = await mkdtemp(join(tmpdir(), 'e2e-disk-save-sample-'));
    const storageRoot = await createNodeStorage(tempDir);

    // Initialize common-area directory structure
    const libraryDir = await storageRoot.getDirectoryHandle('library', { create: true });
    const commonDir = await libraryDir.getDirectoryHandle('common', { create: true });
    await commonDir.getDirectoryHandle('samples', { create: true });

    await saveSample(storageRoot, {
      name: sampleName,
      yaml: commonSample as SampleSavePayload['yaml'],
      wavData: wav.buffer as ArrayBuffer,
    });

    // Verify: sample.yaml exists and has correct format
    const yamlPath = join(tempDir, 'library', 'common', 'samples', sampleName, 'sample.yaml');
    const yamlContent = await readFile(yamlPath, 'utf-8');
    const parsed = parseYaml(yamlContent) as Record<string, unknown>;

    ctx.log(`  Saved to: ${yamlPath}`);
    ctx.log(`  YAML format: "${parsed.format}", sampleRate: ${parsed.sampleRate}`);

    if (parsed.format !== 'sample') {
      return { name, status: 'FAIL', detail: `Expected format "sample", got "${parsed.format}"` };
    }

    // Verify: WAV file exists
    const wavPath = join(tempDir, 'library', 'common', 'samples', sampleName, 'sample.wav');
    const wavData = await readFile(wavPath);
    if (wavData.length < 44) {
      return { name, status: 'FAIL', detail: `WAV too short: ${wavData.length} bytes` };
    }
    // Check RIFF header
    if (wavData[0] !== 0x52 || wavData[1] !== 0x49) {
      return { name, status: 'FAIL', detail: 'WAV does not start with RIFF' };
    }

    ctx.log(`  WAV: ${wavData.length} bytes`);

    return {
      name,
      status: 'PASS',
      detail: `"${sampleName}" → ${wavData.length} byte WAV saved to common area`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Test: save disk program (with samples) to library
// ---------------------------------------------------------------------------

async function testDiskSaveProgramToLibrary(ctx: TestContext): Promise<TestResult> {
  const name = 'disk-save-program';
  let tempDir: string | undefined;
  try {
    const found = await findDiskWithContent(ctx.bridgeUrl, ctx.log);
    if (!found) {
      return { name, status: 'SKIP', detail: 'No disk with programs found' };
    }

    const programFile = found.files.find(f => isProgram(f.type));
    if (!programFile) {
      return { name, status: 'SKIP', detail: 'No program files on disk' };
    }

    // Parse program
    const fileData = readFileData(found.partitionData, programFile);
    const diskProgram = parseProgramFromDisk(fileData);
    const programName = diskProgram.name.trim();

    ctx.log(`  Program "${programName}": ${diskProgram.numKeygroups} keygroups`);

    // Collect sample names from keygroups
    const allSampleNames = new Set<string>();
    for (const kg of diskProgram.keygroups) {
      for (const sn of kg.sampleNames) {
        const trimmed = sn.trim();
        if (trimmed) allSampleNames.add(trimmed);
      }
    }
    ctx.log(`  Referenced samples: ${[...allSampleNames].join(', ')}`);

    // Setup filesystem library
    tempDir = await mkdtemp(join(tmpdir(), 'e2e-disk-save-program-'));
    const storageRoot = await createNodeStorage(tempDir);
    const libraryDir = await storageRoot.getDirectoryHandle('library', { create: true });
    const commonDir = await libraryDir.getDirectoryHandle('common', { create: true });
    await commonDir.getDirectoryHandle('samples', { create: true });

    // Save each referenced sample to common area
    const sampleHeaders = new Map<string, AkaiDiskSampleHeader>();
    let savedSamples = 0;
    for (const sampleName of allSampleNames) {
      const sf = found.files.find(f => isSample(f.type) && f.name.trim() === sampleName);
      if (!sf) {
        ctx.log(`    Sample "${sampleName}" not found on disk — skipping`);
        continue;
      }
      try {
        const sd = readFileData(found.partitionData, sf);
        const sh = parseSampleHeaderFromDisk(sd);
        const pcm = extractSampleAudio(sd, sh);
        const wav = akaiSampleToWav(sh, pcm);
        sampleHeaders.set(sampleName, sh);

        const cs = akaiSampleToCommon(sh);
        cs.name = sampleName;
        await saveSample(storageRoot, {
          name: sampleName,
          yaml: cs as SampleSavePayload['yaml'],
          wavData: wav.buffer as ArrayBuffer,
        });
        savedSamples++;
        ctx.log(`    Saved sample "${sampleName}" (${wav.length} bytes)`);
      } catch (err) {
        ctx.log(`    Failed to save "${sampleName}": ${err}`);
      }
    }

    // Save program.yaml to common area
    const commonProgram = akaiProgramToCommon(diskProgram, sampleHeaders);
    commonProgram.name = programName;

    const { stringify: stringifyYaml } = await import('yaml');
    const programDir = await (await (await storageRoot
      .getDirectoryHandle('library'))
      .getDirectoryHandle('common'))
      .getDirectoryHandle('samples')
      .then(d => d.getDirectoryHandle(programName, { create: true }));

    const fh = await programDir.getFileHandle('program.yaml', { create: true });
    const w = await fh.createWritable();
    await w.write(stringifyYaml(commonProgram, { indent: 2 }));
    await w.close();

    // Verify program.yaml
    const progYamlPath = join(tempDir, 'library', 'common', 'samples', programName, 'program.yaml');
    const progYaml = await readFile(progYamlPath, 'utf-8');
    const parsed = parseYaml(progYaml) as Record<string, unknown>;

    ctx.log(`  Program YAML: format="${parsed.format}", zones=${(parsed.zones as unknown[])?.length}`);

    if (parsed.format !== 'program') {
      return { name, status: 'FAIL', detail: `Expected format "program", got "${parsed.format}"` };
    }

    // Verify sample WAVs exist
    for (const sn of allSampleNames) {
      const wavPath = join(tempDir, 'library', 'common', 'samples', sn, 'sample.wav');
      try {
        const stat = await readFile(wavPath);
        if (stat.length < 44) {
          return { name, status: 'FAIL', detail: `Sample "${sn}" WAV too short: ${stat.length}` };
        }
      } catch {
        // Sample might not have been on disk — that's ok if we logged it
      }
    }

    return {
      name,
      status: 'PASS',
      detail: `"${programName}" + ${savedSamples} samples saved to common area (${commonProgram.zones.length} zones)`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  } finally {
    if (tempDir) await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
