/**
 * Tests for S3K program promotion (device-specific library -> common area).
 *
 * Uses InMemoryDirectoryHandle from sampler-library/testing to simulate
 * filesystem operations without OPFS or local FS.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryDirectoryHandle } from '@audiocontrol/sampler-library/testing';
import { promoteToCommonArea } from '@/lib/program-promotion';
import { serializeDiskProgram } from '@/lib/program-serialization';
import type { AkaiDiskProgram } from '@audiocontrol/sampler-devices/s3k';

// =========================================================================
// Test helpers
// =========================================================================

function makeDiskProgram(name: string, sampleNames: string[]): AkaiDiskProgram {
  return {
    name,
    midiProgramNumber: 0,
    midiChannel: 0,
    polyphony: 6,
    numKeygroups: 1,
    keygroups: [{
      lowNote: 36,
      highNote: 72,
      sampleNames,
      rawData: new Uint8Array(0),
    }],
    rawProgramHeader: new Uint8Array(0),
  };
}

/**
 * Seed an in-memory library root with an S3K program directory bundle.
 * Creates: library/s3k/programs/{dirName}/program.s3k.yaml
 */
async function seedS3kProgram(
  root: InMemoryDirectoryHandle,
  dirName: string,
  diskProgram: AkaiDiskProgram,
  fileData: Uint8Array = new Uint8Array([0xDE, 0xAD]),
): Promise<void> {
  const library = await root.getDirectoryHandle('library', { create: true });
  const s3k = await library.getDirectoryHandle('s3k', { create: true });
  const programs = await s3k.getDirectoryHandle('programs', { create: true });
  const programDir = await programs.getDirectoryHandle(dirName, { create: true });

  const yaml = serializeDiskProgram(diskProgram, fileData);
  const fh = await programDir.getFileHandle('program.s3k.yaml', { create: true });
  const writable = await fh.createWritable();
  await writable.write(yaml);
  await writable.close();
}

/**
 * Seed a sample WAV in the S3K program bundle.
 * Creates: library/s3k/programs/{dirName}/samples/{sampleName}.wav
 */
async function seedSample(
  root: InMemoryDirectoryHandle,
  dirName: string,
  sampleName: string,
  wavBytes: number[] = [0x52, 0x49, 0x46, 0x46], // "RIFF" stub
): Promise<void> {
  const library = await root.getDirectoryHandle('library', { create: true });
  const s3k = await library.getDirectoryHandle('s3k', { create: true });
  const programs = await s3k.getDirectoryHandle('programs', { create: true });
  const programDir = await programs.getDirectoryHandle(dirName, { create: true });
  const samples = await programDir.getDirectoryHandle('samples', { create: true });

  const fh = await samples.getFileHandle(`${sampleName}.wav`, { create: true });
  const writable = await fh.createWritable();
  await writable.write(new Uint8Array(wavBytes).buffer);
  await writable.close();
}

// =========================================================================
// Tests
// =========================================================================

describe('promoteToCommonArea', () => {
  it('creates a common-area program from a disk-origin S3K program', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const program = makeDiskProgram('PIANO', ['PIANO_C3', 'PIANO_C4']);
    await seedS3kProgram(root, 'PIANO', program);

    const result = await promoteToCommonArea(root, 'PIANO');

    expect(result).toBeDefined();
    expect(result.name).toBe('PIANO');

    // Verify the common-area program.yaml was created
    const commonDir = await root.getDirectoryHandle('library');
    const common = await commonDir.getDirectoryHandle('common');
    const commonPrograms = await common.getDirectoryHandle('programs');
    const programDir = await commonPrograms.getDirectoryHandle('PIANO');
    const yamlHandle = await programDir.getFileHandle('program.yaml');
    const file = await yamlHandle.getFile();
    const content = await file.text();

    expect(content).toContain('name: PIANO');
    expect(content).toContain('zones');
  });

  it('copies sample WAV files from S3K bundle to common area', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const program = makeDiskProgram('BASS', ['BASS_E1']);
    await seedS3kProgram(root, 'BASS', program);
    const wavBytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x01];
    await seedSample(root, 'BASS', 'BASS_E1', wavBytes);

    await promoteToCommonArea(root, 'BASS');

    // Verify the sample was copied
    const commonDir = await root.getDirectoryHandle('library');
    const common = await commonDir.getDirectoryHandle('common');
    const commonPrograms = await common.getDirectoryHandle('programs');
    const programDir = await commonPrograms.getDirectoryHandle('BASS');
    const sampleHandle = await programDir.getFileHandle('BASS_E1.wav');
    const sampleFile = await sampleHandle.getFile();
    const copied = new Uint8Array(await sampleFile.arrayBuffer());

    expect(Array.from(copied)).toEqual(wavBytes);
  });

  it('succeeds when S3K bundle has no samples directory', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const program = makeDiskProgram('EMPTY', []);
    await seedS3kProgram(root, 'EMPTY', program);

    // Should not throw -- missing samples dir is expected
    const result = await promoteToCommonArea(root, 'EMPTY');
    expect(result).toBeDefined();
  });

  it('throws with descriptive error when program directory does not exist', async () => {
    const root = new InMemoryDirectoryHandle('root');

    await expect(promoteToCommonArea(root, 'NONEXISTENT'))
      .rejects.toThrow(/Cannot load program "NONEXISTENT"/);
  });

  it('uses targetName when provided', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const program = makeDiskProgram('ORIG', []);
    await seedS3kProgram(root, 'ORIG', program);

    const result = await promoteToCommonArea(root, 'ORIG', 'RENAMED');

    // Verify the common-area directory uses the target name
    const commonDir = await root.getDirectoryHandle('library');
    const common = await commonDir.getDirectoryHandle('common');
    const commonPrograms = await common.getDirectoryHandle('programs');
    const programDir = await commonPrograms.getDirectoryHandle('RENAMED');
    const yamlHandle = await programDir.getFileHandle('program.yaml');
    const file = await yamlHandle.getFile();
    const content = await file.text();

    expect(content).toContain('name: RENAMED');
    expect(result).toBeDefined();
  });

  it('handles missing sample in bundle without throwing', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const program = makeDiskProgram('PAD', ['PAD_C3']);
    await seedS3kProgram(root, 'PAD', program);
    // Note: we do NOT seed the sample -- it should warn but not throw

    const result = await promoteToCommonArea(root, 'PAD');
    expect(result).toBeDefined();
  });
});
