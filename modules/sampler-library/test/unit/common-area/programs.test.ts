import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryDirectoryHandle } from '@/testing/in-memory-storage.js';
import {
  saveProgram,
  loadProgramMeta,
  loadProgram,
} from '@/common-area/programs.js';
import type { ProgramYaml } from '@/schemas/index.js';
import type { ProgramSavePayload } from '@/common-area/programs.js';

/** Create a minimal WAV-like buffer for testing. */
function fakeWav(size: number): ArrayBuffer {
  const buf = new ArrayBuffer(size);
  const view = new Uint8Array(buf);
  for (let i = 0; i < size; i++) {
    view[i] = i % 256;
  }
  return buf;
}

describe('saveProgram / loadProgram round trip', () => {
  let root: InMemoryDirectoryHandle;

  const minimalProgram: ProgramYaml = {
    format: 'program',
    version: 1,
    name: 'Test Kit',
    zones: [{ sample: 'kick.wav' }],
  };

  const fullProgram: ProgramYaml = {
    format: 'program',
    version: 1,
    name: '808 Kit',
    zones: [
      { sample: 'kick.wav', keyRange: [36, 36], label: 'kick' },
      { sample: 'snare.wav', keyRange: [38, 38], label: 'snare' },
      { sample: 'hihat.wav', keyRange: [42, 42], label: 'hi-hat', muteGroup: 1 },
    ],
    polyphony: 'poly',
    playbackMode: 'one-shot',
    sourceInfo: {
      sampleName: 'Amen Break',
      sampleDirectory: 'Amen_Break',
    },
    description: 'Classic 808 drum kit',
    tags: ['drums', 'electronic'],
  };

  beforeEach(() => {
    root = new InMemoryDirectoryHandle('root');
  });

  it('should round-trip a minimal program (save then load metadata)', async () => {
    const payload: ProgramSavePayload = {
      name: 'Test Kit',
      yaml: minimalProgram,
      wavFiles: [{ filename: 'kick.wav', data: fakeWav(100) }],
    };

    await saveProgram(root, payload);
    const loaded = await loadProgramMeta(root, 'Test Kit');

    expect(loaded.format).toBe('program');
    expect(loaded.version).toBe(1);
    expect(loaded.name).toBe('Test Kit');
    expect(loaded.zones).toHaveLength(1);
    expect(loaded.zones[0].sample).toBe('kick.wav');
  });

  it('should round-trip a full program with all fields', async () => {
    const payload: ProgramSavePayload = {
      name: '808 Kit',
      yaml: fullProgram,
      wavFiles: [
        { filename: 'kick.wav', data: fakeWav(200) },
        { filename: 'snare.wav', data: fakeWav(300) },
        { filename: 'hihat.wav', data: fakeWav(150) },
      ],
    };

    await saveProgram(root, payload);
    const loaded = await loadProgramMeta(root, '808 Kit');

    expect(loaded.name).toBe('808 Kit');
    expect(loaded.zones).toHaveLength(3);
    expect(loaded.zones[0]).toEqual({ sample: 'kick.wav', keyRange: [36, 36], label: 'kick' });
    expect(loaded.zones[1]).toEqual({ sample: 'snare.wav', keyRange: [38, 38], label: 'snare' });
    expect(loaded.zones[2]).toEqual({ sample: 'hihat.wav', keyRange: [42, 42], label: 'hi-hat', muteGroup: 1 });
    expect(loaded.polyphony).toBe('poly');
    expect(loaded.playbackMode).toBe('one-shot');
    expect(loaded.sourceInfo).toEqual({
      sampleName: 'Amen Break',
      sampleDirectory: 'Amen_Break',
    });
    expect(loaded.description).toBe('Classic 808 drum kit');
    expect(loaded.tags).toEqual(['drums', 'electronic']);
  });

  it('should round-trip WAV file data', async () => {
    const kickData = fakeWav(1024);
    const snareData = fakeWav(2048);

    const payload: ProgramSavePayload = {
      name: 'Test Kit',
      yaml: {
        format: 'program',
        version: 1,
        name: 'Test Kit',
        zones: [
          { sample: 'kick.wav' },
          { sample: 'snare.wav' },
        ],
      },
      wavFiles: [
        { filename: 'kick.wav', data: kickData },
        { filename: 'snare.wav', data: snareData },
      ],
    };

    await saveProgram(root, payload);
    const loaded = await loadProgram(root, 'Test Kit');

    expect(loaded.yaml.name).toBe('Test Kit');
    expect(loaded.wavFiles).toHaveLength(2);

    const kick = loaded.wavFiles.find(f => f.filename === 'kick.wav');
    const snare = loaded.wavFiles.find(f => f.filename === 'snare.wav');
    expect(kick).toBeDefined();
    expect(snare).toBeDefined();
    expect(kick!.data.byteLength).toBe(1024);
    expect(snare!.data.byteLength).toBe(2048);

    // Verify actual byte content
    const kickView = new Uint8Array(kick!.data);
    const originalKickView = new Uint8Array(kickData);
    expect(kickView).toEqual(originalKickView);
  });

  it('should create program directory with program.yaml and samples/ subdirectory', async () => {
    const payload: ProgramSavePayload = {
      name: 'My Program',
      yaml: minimalProgram,
      wavFiles: [{ filename: 'kick.wav', data: fakeWav(100) }],
    };

    await saveProgram(root, payload);

    // Verify directory structure: root/library/common/programs/My_Program/
    const libraryDir = await root.getDirectoryHandle('library');
    const commonDir = await libraryDir.getDirectoryHandle('common');
    const programsDir = await commonDir.getDirectoryHandle('programs');
    const programDir = await programsDir.getDirectoryHandle('My_Program');

    // program.yaml exists
    const yamlHandle = await programDir.getFileHandle('program.yaml');
    const yamlFile = await yamlHandle.getFile();
    const yamlText = await yamlFile.text();
    expect(yamlText).toContain('format: program');

    // samples/ directory exists with WAV file
    const samplesDir = await programDir.getDirectoryHandle('samples');
    const wavHandle = await samplesDir.getFileHandle('kick.wav');
    const wavFile = await wavHandle.getFile();
    expect(wavFile.size).toBe(100);
  });

  it('should sanitize directory names with spaces', async () => {
    const payload: ProgramSavePayload = {
      name: 'My Drum Kit',
      yaml: { ...minimalProgram, name: 'My Drum Kit' },
      wavFiles: [{ filename: 'kick.wav', data: fakeWav(50) }],
    };

    await saveProgram(root, payload);

    // Should be accessible by the original name (sanitizeForFilename converts spaces)
    const loaded = await loadProgramMeta(root, 'My Drum Kit');
    expect(loaded.name).toBe('My Drum Kit');
  });

  it('should reject invalid program YAML on save', async () => {
    const invalidYaml = {
      format: 'program',
      version: 1,
      name: 'Bad',
      zones: [], // empty zones array is invalid
    } as unknown as ProgramYaml;

    const payload: ProgramSavePayload = {
      name: 'Bad',
      yaml: invalidYaml,
      wavFiles: [],
    };

    await expect(saveProgram(root, payload)).rejects.toThrow('Invalid program YAML');
  });

  it('should handle program with no WAV files', async () => {
    const payload: ProgramSavePayload = {
      name: 'Empty Program',
      yaml: { ...minimalProgram, name: 'Empty Program' },
      wavFiles: [],
    };

    await saveProgram(root, payload);
    const loaded = await loadProgram(root, 'Empty Program');

    expect(loaded.yaml.name).toBe('Empty Program');
    expect(loaded.wavFiles).toHaveLength(0);
  });

  it('should report progress during save', async () => {
    const progressEvents: Array<{ step: number; label: string }> = [];

    const payload: ProgramSavePayload = {
      name: 'Progress Test',
      yaml: { ...minimalProgram, name: 'Progress Test' },
      wavFiles: [
        { filename: 'kick.wav', data: fakeWav(100) },
        { filename: 'snare.wav', data: fakeWav(200) },
      ],
    };

    await saveProgram(root, payload, {
      onProgress: (p) => {
        progressEvents.push({ step: p.currentStep, label: p.stepLabel });
      },
    });

    // Should have: yaml start, yaml end, kick start, kick end, snare start, snare end
    expect(progressEvents.length).toBe(6);
    expect(progressEvents[0].step).toBe(1);
    expect(progressEvents[0].label).toContain('program.yaml');
    expect(progressEvents[2].step).toBe(2);
    expect(progressEvents[2].label).toContain('kick.wav');
    expect(progressEvents[4].step).toBe(3);
    expect(progressEvents[4].label).toContain('snare.wav');
  });

  it('should report progress during load', async () => {
    const payload: ProgramSavePayload = {
      name: 'Load Progress',
      yaml: { ...minimalProgram, name: 'Load Progress' },
      wavFiles: [{ filename: 'kick.wav', data: fakeWav(100) }],
    };

    await saveProgram(root, payload);

    const progressEvents: Array<{ step: number; label: string }> = [];
    await loadProgram(root, 'Load Progress', {
      onProgress: (p) => {
        progressEvents.push({ step: p.currentStep, label: p.stepLabel });
      },
    });

    // At least yaml loaded + wav start + wav end
    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents[0].label).toContain('program.yaml');
  });
});

describe('loadProgramMeta with sourceInfo', () => {
  let root: InMemoryDirectoryHandle;

  beforeEach(() => {
    root = new InMemoryDirectoryHandle('root');
  });

  it('should preserve sourceInfo through round trip', async () => {
    const program: ProgramYaml = {
      format: 'program',
      version: 1,
      name: 'Chopped Break',
      zones: [
        { sample: 'slice-01.wav', keyRange: [36, 36] },
        { sample: 'slice-02.wav', keyRange: [37, 37] },
      ],
      sourceInfo: {
        sampleName: 'Amen Break',
        sampleDirectory: 'Amen_Break',
      },
    };

    await saveProgram(root, {
      name: 'Chopped Break',
      yaml: program,
      wavFiles: [
        { filename: 'slice-01.wav', data: new ArrayBuffer(50) },
        { filename: 'slice-02.wav', data: new ArrayBuffer(50) },
      ],
    });

    const loaded = await loadProgramMeta(root, 'Chopped Break');
    expect(loaded.sourceInfo).toEqual({
      sampleName: 'Amen Break',
      sampleDirectory: 'Amen_Break',
    });
  });

  it('should load program without sourceInfo (field is optional)', async () => {
    const program: ProgramYaml = {
      format: 'program',
      version: 1,
      name: 'No Source',
      zones: [{ sample: 'pad.wav' }],
    };

    await saveProgram(root, {
      name: 'No Source',
      yaml: program,
      wavFiles: [{ filename: 'pad.wav', data: new ArrayBuffer(20) }],
    });

    const loaded = await loadProgramMeta(root, 'No Source');
    expect(loaded.sourceInfo).toBeUndefined();
  });
});
