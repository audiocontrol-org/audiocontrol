import { describe, it, expect } from 'vitest';
import {
  InMemoryDirectoryHandle,
  InMemoryFileHandle,
} from '@audiocontrol/sampler-library/testing';
import type {
  StorageWritable,
  StorageDirectoryHandle,
} from '@audiocontrol/sampler-library/browser';
import {
  listStoredPrograms,
  renameProgramSample,
  saveProgramToLibrary,
  saveProgramSample,
} from '@/lib/program-storage';

// =========================================================================
// Helpers
// =========================================================================

/**
 * Build a minimal program YAML string for testing.
 */
function buildProgramYaml(opts: {
  name: string;
  keygroupCount: number;
  sampleReferences?: string[];
}): string {
  const lines = [
    `name: ${opts.name}`,
    `keygroupCount: ${opts.keygroupCount}`,
  ];
  if (opts.sampleReferences && opts.sampleReferences.length > 0) {
    lines.push('sampleReferences:');
    for (const ref of opts.sampleReferences) {
      lines.push(`  - ${ref}`);
    }
  }
  return lines.join('\n') + '\n';
}

/**
 * Seed a root handle with programs directory structure containing
 * one or more programs, each with optional sample files.
 */
async function seedProgram(
  root: StorageDirectoryHandle,
  dirName: string,
  yaml: string,
  sampleNames?: string[],
): Promise<void> {
  await saveProgramToLibrary(root, dirName, yaml);
  if (sampleNames) {
    for (const name of sampleNames) {
      // Use a trivial ArrayBuffer as WAV data stand-in
      await saveProgramSample(root, dirName, name, new ArrayBuffer(16));
    }
  }
}

// =========================================================================
// listStoredPrograms
// =========================================================================

describe('listStoredPrograms', () => {
  it('returns an empty array when no programs exist', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const result = await listStoredPrograms(root);
    expect(result).toEqual([]);
  });

  it('lists a program with name and keygroupCount from YAML', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const yaml = buildProgramYaml({
      name: 'My Piano',
      keygroupCount: 4,
      sampleReferences: ['piano_C3', 'piano_F3'],
    });

    await seedProgram(root, 'My Piano', yaml);

    const result = await listStoredPrograms(root);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('My Piano');
    expect(result[0].keygroupCount).toBe(4);
    expect(result[0].sampleReferences).toEqual(['piano_C3', 'piano_F3']);
  });

  it('lists sample files from the samples/ subdirectory', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const yaml = buildProgramYaml({
      name: 'Drums',
      keygroupCount: 2,
      sampleReferences: ['kick', 'snare'],
    });

    await seedProgram(root, 'Drums', yaml, ['kick', 'snare']);

    const result = await listStoredPrograms(root);
    expect(result).toHaveLength(1);
    expect(result[0].sampleFiles).toEqual(['kick', 'snare']);
  });

  it('sorts programs by name', async () => {
    const root = new InMemoryDirectoryHandle('root');

    await seedProgram(
      root,
      'Zebra',
      buildProgramYaml({ name: 'Zebra', keygroupCount: 1 }),
    );
    await seedProgram(
      root,
      'Alpha',
      buildProgramYaml({ name: 'Alpha', keygroupCount: 2 }),
    );
    await seedProgram(
      root,
      'Middle',
      buildProgramYaml({ name: 'Middle', keygroupCount: 3 }),
    );

    const result = await listStoredPrograms(root);
    expect(result.map((p) => p.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
  });
});

// =========================================================================
// renameProgramSample
// =========================================================================

describe('renameProgramSample', () => {
  it('renames WAV file and updates YAML sampleReferences', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const yaml = buildProgramYaml({
      name: 'Strings',
      keygroupCount: 1,
      sampleReferences: ['violin_C3'],
    });

    await seedProgram(root, 'Strings', yaml, ['violin_C3']);

    await renameProgramSample(root, 'Strings', 'violin_C3', 'violin_D3');

    // Verify the listing reflects the rename
    const programs = await listStoredPrograms(root);
    expect(programs).toHaveLength(1);
    expect(programs[0].sampleReferences).toEqual(['violin_D3']);
    expect(programs[0].sampleFiles).toEqual(['violin_D3']);
  });

  it('is a no-op when old and new names are the same', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const yaml = buildProgramYaml({
      name: 'Bass',
      keygroupCount: 1,
      sampleReferences: ['bass_E1'],
    });

    await seedProgram(root, 'Bass', yaml, ['bass_E1']);

    // Should not throw
    await renameProgramSample(root, 'Bass', 'bass_E1', 'bass_E1');

    const programs = await listStoredPrograms(root);
    expect(programs[0].sampleFiles).toEqual(['bass_E1']);
    expect(programs[0].sampleReferences).toEqual(['bass_E1']);
  });

  it('throws if old WAV does not exist', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const yaml = buildProgramYaml({
      name: 'Empty',
      keygroupCount: 1,
      sampleReferences: ['ghost'],
    });

    // Seed program without any sample files
    await seedProgram(root, 'Empty', yaml);

    await expect(
      renameProgramSample(root, 'Empty', 'ghost', 'real'),
    ).rejects.toThrow();
  });

  it('rolls back new WAV if YAML write fails', async () => {
    const root = new InMemoryDirectoryHandle('root');
    const yaml = buildProgramYaml({
      name: 'Rollback',
      keygroupCount: 1,
      sampleReferences: ['pad_A3'],
    });

    await seedProgram(root, 'Rollback', yaml, ['pad_A3']);

    // Navigate to the program directory and sabotage the YAML handle
    const libraryDir = await root.getDirectoryHandle('library');
    const s3kDir = await libraryDir.getDirectoryHandle('s3k');
    const programsDir = await s3kDir.getDirectoryHandle('programs');
    const programDir = await programsDir.getDirectoryHandle('Rollback');

    // Replace the YAML file handle with one whose createWritable throws
    const poisonedWritable: StorageWritable = {
      write: () => Promise.reject(new Error('disk full')),
      close: () => Promise.resolve(),
    };
    const poisonedHandle = new InMemoryFileHandle('program.s3k.yaml');
    poisonedHandle.createWritable = () => Promise.resolve(poisonedWritable);

    // Overwrite the YAML file in the directory so the rename picks it up.
    // We need to read the current YAML content and seed it into the poisoned handle first.
    const currentYamlHandle = await programDir.getFileHandle('program.s3k.yaml');
    const currentFile = await currentYamlHandle.getFile();
    const currentText = await currentFile.text();

    // Create a proper file handle that reads correctly but fails on write
    const failingHandle = new InMemoryFileHandle('program.s3k.yaml');
    // Write the existing content so getFile().text() works
    const setupWritable = await failingHandle.createWritable();
    await setupWritable.write(currentText);
    await setupWritable.close();
    // Now sabotage createWritable for all future calls
    failingHandle.createWritable = () => Promise.resolve(poisonedWritable);

    // Inject the failing handle into the directory
    (programDir as InMemoryDirectoryHandle).addFile(failingHandle);

    // The rename should fail
    await expect(
      renameProgramSample(root, 'Rollback', 'pad_A3', 'pad_B3'),
    ).rejects.toThrow('disk full');

    // After rollback, the new WAV should have been removed.
    // The old WAV should still exist. Verify via listing.
    const programs = await listStoredPrograms(root);
    expect(programs).toHaveLength(1);
    // Sample files should still show the original name only
    expect(programs[0].sampleFiles).toEqual(['pad_A3']);
  });
});
