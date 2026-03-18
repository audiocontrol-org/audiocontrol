import { describe, it, expect } from 'vitest';
import {
  SetYamlSchema,
  SetToneEntrySchema,
  SetPatchEntrySchema,
  WaveSegmentAllocationSchema,
} from '@/schemas/set-schema.js';

describe('WaveSegmentAllocationSchema', () => {
  it('should accept valid allocation', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 0,
      segmentTop: 0,
      segmentLength: 2,
    });
    expect(result.success).toBe(true);
  });

  it('should accept bank 1', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 1,
      segmentTop: 10,
      segmentLength: 5,
    });
    expect(result.success).toBe(true);
  });

  it('should accept bank 2 (S-550)', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 2,
      segmentTop: 0,
      segmentLength: 2,
    });
    expect(result.success).toBe(true);
  });

  it('should accept bank 3 (S-550)', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 3,
      segmentTop: 5,
      segmentLength: 3,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid bank (4)', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 4,
      segmentTop: 0,
      segmentLength: 2,
    });
    expect(result.success).toBe(false);
  });

  it('should reject segment top out of range', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 0,
      segmentTop: 18,
      segmentLength: 2,
    });
    expect(result.success).toBe(false);
  });

  it('should reject segment length of 0', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 0,
      segmentTop: 0,
      segmentLength: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject segment length over 18', () => {
    const result = WaveSegmentAllocationSchema.safeParse({
      bank: 0,
      segmentTop: 0,
      segmentLength: 19,
    });
    expect(result.success).toBe(false);
  });
});

describe('SetToneEntrySchema', () => {
  it('should accept valid tone entry', () => {
    const result = SetToneEntrySchema.safeParse({
      slot: 0,
      file: 'T01',
      waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 2 },
    });
    expect(result.success).toBe(true);
  });

  it('should accept maximum S-330 slot (31)', () => {
    const result = SetToneEntrySchema.safeParse({
      slot: 31,
      file: 'T32',
      waveAllocation: { bank: 1, segmentTop: 0, segmentLength: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('should accept S-550 extended slot (32-63)', () => {
    const result = SetToneEntrySchema.safeParse({
      slot: 63,
      file: 'T64',
      waveAllocation: { bank: 3, segmentTop: 0, segmentLength: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('should reject slot out of range (64)', () => {
    const result = SetToneEntrySchema.safeParse({
      slot: 64,
      file: 'T65',
      waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 1 },
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty file name', () => {
    const result = SetToneEntrySchema.safeParse({
      slot: 0,
      file: '',
      waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 1 },
    });
    expect(result.success).toBe(false);
  });
});

describe('SetPatchEntrySchema', () => {
  it('should accept valid patch entry', () => {
    const result = SetPatchEntrySchema.safeParse({
      slot: 0,
      file: 'P01',
    });
    expect(result.success).toBe(true);
  });

  it('should accept S-330 maximum slot (63)', () => {
    const result = SetPatchEntrySchema.safeParse({
      slot: 63,
      file: 'P64',
    });
    expect(result.success).toBe(true);
  });

  it('should accept S-550 patch slot (31)', () => {
    const result = SetPatchEntrySchema.safeParse({
      slot: 31,
      file: 'P32',
    });
    expect(result.success).toBe(true);
  });

  it('should reject slot out of range (64)', () => {
    const result = SetPatchEntrySchema.safeParse({
      slot: 64,
      file: 'P65',
    });
    expect(result.success).toBe(false);
  });
});

describe('SetYamlSchema', () => {
  const validSet = {
    format: 'sampler-set',
    device: 's330',
    version: 1,
    name: 'TestSet',
    tones: [],
    patches: [],
  };

  it('should accept valid empty set', () => {
    const result = SetYamlSchema.safeParse(validSet);
    expect(result.success).toBe(true);
  });

  it('should accept set with description', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      description: 'A test set',
    });
    expect(result.success).toBe(true);
  });

  it('should accept set with timestamps', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      createdAt: '2024-03-07T10:30:00Z',
      modifiedAt: '2024-03-07T10:30:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('should accept set with tones and patches', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 2 } },
        { slot: 1, file: 'T02', waveAllocation: { bank: 0, segmentTop: 2, segmentLength: 1 } },
      ],
      patches: [
        { slot: 0, file: 'P01' },
        { slot: 1, file: 'P02' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should accept set with system params', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      system: {
        masterTune: 0,
        masterLevel: 100,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject wrong format', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      format: 'wrong-format',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid device type', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      device: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name too long', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      name: 'a'.repeat(65),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing tones array', () => {
    const { tones, ...withoutTones } = validSet;
    const result = SetYamlSchema.safeParse(withoutTones);
    expect(result.success).toBe(false);
  });

  it('should reject missing patches array', () => {
    const { patches, ...withoutPatches } = validSet;
    const result = SetYamlSchema.safeParse(withoutPatches);
    expect(result.success).toBe(false);
  });

  it('should accept s550 device', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      device: 's550',
    });
    expect(result.success).toBe(true);
  });

  it('should accept jv1080 device', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      device: 'jv1080',
    });
    expect(result.success).toBe(true);
  });

  it('should accept d110 device', () => {
    const result = SetYamlSchema.safeParse({
      ...validSet,
      device: 'd110',
    });
    expect(result.success).toBe(true);
  });
});
