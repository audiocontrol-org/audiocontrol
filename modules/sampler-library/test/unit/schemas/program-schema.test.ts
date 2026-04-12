import { describe, it, expect } from 'vitest';
import { ZoneSchema, ProgramYamlSchema, SourceInfoSchema } from '@/schemas/program-schema.js';

const validZone = {
  sample: 'kick.wav',
};

const validProgram = {
  format: 'program',
  version: 1,
  name: 'My Drum Kit',
  zones: [validZone],
};

describe('ZoneSchema', () => {
  it('should accept a minimal zone (sample only)', () => {
    const result = ZoneSchema.safeParse(validZone);
    expect(result.success).toBe(true);
  });

  it('should accept a fully-specified zone', () => {
    const result = ZoneSchema.safeParse({
      sample: 'snare.wav',
      keyRange: [36, 36],
      velocityRange: [1, 127],
      rootKey: 'C2',
      transpose: -12,
      fineTune: 5,
      muteGroup: 1,
      label: 'snare',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.keyRange).toEqual([36, 36]);
      expect(result.data.velocityRange).toEqual([1, 127]);
      expect(result.data.rootKey).toBe('C2');
      expect(result.data.transpose).toBe(-12);
      expect(result.data.muteGroup).toBe(1);
      expect(result.data.label).toBe('snare');
    }
  });

  it('should accept rootKey as MIDI note number', () => {
    const result = ZoneSchema.safeParse({
      sample: 'kick.wav',
      rootKey: 60,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty sample', () => {
    const result = ZoneSchema.safeParse({ sample: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing sample', () => {
    const result = ZoneSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject invalid key range (low > high)', () => {
    const result = ZoneSchema.safeParse({
      sample: 'kick.wav',
      keyRange: [72, 36],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid velocity range (low > high)', () => {
    const result = ZoneSchema.safeParse({
      sample: 'kick.wav',
      velocityRange: [100, 50],
    });
    expect(result.success).toBe(false);
  });

  it('should reject transpose out of range', () => {
    expect(ZoneSchema.safeParse({ sample: 'x.wav', transpose: -65 }).success).toBe(false);
    expect(ZoneSchema.safeParse({ sample: 'x.wav', transpose: 64 }).success).toBe(false);
  });

  it('should reject fineTune out of range', () => {
    expect(ZoneSchema.safeParse({ sample: 'x.wav', fineTune: -65 }).success).toBe(false);
    expect(ZoneSchema.safeParse({ sample: 'x.wav', fineTune: 64 }).success).toBe(false);
  });
});

describe('ProgramYamlSchema', () => {
  it('should accept a minimal valid program', () => {
    const result = ProgramYamlSchema.safeParse(validProgram);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('program');
      expect(result.data.version).toBe(1);
      expect(result.data.name).toBe('My Drum Kit');
      expect(result.data.zones).toHaveLength(1);
    }
  });

  it('should accept a drum kit (multiple zones with key ranges)', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      name: '808 Kit',
      zones: [
        { sample: 'kick.wav', keyRange: [36, 36], label: 'kick' },
        { sample: 'snare.wav', keyRange: [38, 38], label: 'snare' },
        { sample: 'hihat-closed.wav', keyRange: [42, 42], label: 'hi-hat closed', muteGroup: 1 },
        { sample: 'hihat-open.wav', keyRange: [46, 46], label: 'hi-hat open', muteGroup: 1 },
      ],
      polyphony: 'poly',
      playbackMode: 'one-shot',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zones).toHaveLength(4);
      expect(result.data.zones[2].muteGroup).toBe(1);
      expect(result.data.zones[3].muteGroup).toBe(1);
      expect(result.data.polyphony).toBe('poly');
      expect(result.data.playbackMode).toBe('one-shot');
    }
  });

  it('should accept a velocity-layer instrument', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      name: 'Piano Velocity Layers',
      zones: [
        { sample: 'piano-pp.wav', keyRange: [21, 108], velocityRange: [1, 42], rootKey: 60 },
        { sample: 'piano-mf.wav', keyRange: [21, 108], velocityRange: [43, 84], rootKey: 60 },
        { sample: 'piano-ff.wav', keyRange: [21, 108], velocityRange: [85, 127], rootKey: 60 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zones).toHaveLength(3);
    }
  });

  it('should accept a keyboard split', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      name: 'Bass + Pad Split',
      zones: [
        { sample: 'bass.wav', keyRange: [0, 59], rootKey: 36 },
        { sample: 'pad.wav', keyRange: [60, 127], rootKey: 72 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept all optional program fields', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      polyphony: 'mono',
      playbackMode: 'gate',
      description: 'A test program',
      tags: ['drums', 'electronic'],
      createdAt: '2026-03-18T10:00:00.000Z',
      modifiedAt: '2026-03-18T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.polyphony).toBe('mono');
      expect(result.data.playbackMode).toBe('gate');
      expect(result.data.description).toBe('A test program');
      expect(result.data.tags).toEqual(['drums', 'electronic']);
    }
  });

  it('should reject empty zones array', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      zones: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing zones', () => {
    const { zones: _, ...noZones } = validProgram;
    const result = ProgramYamlSchema.safeParse(noZones);
    expect(result.success).toBe(false);
  });

  it('should reject wrong format', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      format: 'sample',
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong version', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      version: 2,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name over 128 characters', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      name: 'A'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid polyphony', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      polyphony: 'stereo',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid playbackMode', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      playbackMode: 'looping',
    });
    expect(result.success).toBe(false);
  });

  it('should accept sourceInfo with sampleName', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      sourceInfo: { sampleName: 'Amen Break' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceInfo?.sampleName).toBe('Amen Break');
    }
  });

  it('should accept sourceInfo with sampleName and sampleDirectory', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      sourceInfo: {
        sampleName: 'Amen Break',
        sampleDirectory: 'Amen_Break',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceInfo?.sampleDirectory).toBe('Amen_Break');
    }
  });

  it('should reject sourceInfo with empty sampleName', () => {
    const result = ProgramYamlSchema.safeParse({
      ...validProgram,
      sourceInfo: { sampleName: '' },
    });
    expect(result.success).toBe(false);
  });
});

describe('SourceInfoSchema', () => {
  it('should accept minimal sourceInfo', () => {
    const result = SourceInfoSchema.safeParse({ sampleName: 'Test' });
    expect(result.success).toBe(true);
  });

  it('should reject empty object', () => {
    const result = SourceInfoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
