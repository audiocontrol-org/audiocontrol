import { describe, it, expect } from 'vitest';
import { PatchYamlSchema, KeyGroupSchema } from '@/schemas/index.js';

describe('PatchYamlSchema', () => {
  const validPatch = {
    format: 'sampler-patch' as const,
    device: 's330' as const,
    version: 1,
    name: 'DrumKit_01',
    level: 100,
    keyGroups: [
      {
        name: 'Kick',
        tone: 'Kick_01',
        keyRange: [36, 36] as [number, number],
        velocityRange: [1, 127] as [number, number],
        level: 100,
        pan: 'center' as const,
      },
      {
        name: 'Snare',
        tone: 'Snare_01',
        keyRange: [38, 38] as [number, number],
        level: 95,
        pan: 10,
      },
    ],
    s330: {
      benderRange: 2,
      keyMode: 'normal' as const,
    },
  };

  it('should validate a complete patch with key groups', () => {
    const result = PatchYamlSchema.safeParse(validPatch);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('DrumKit_01');
      expect(result.data.keyGroups).toHaveLength(2);
    }
  });

  it('should validate patch with only s330 extension', () => {
    const patchWithExtension = {
      format: 'sampler-patch',
      device: 's330',
      version: 1,
      name: 'Test Patch',
      s330: {
        benderRange: 2,
        keyMode: 'v-sw',
        velocityThreshold: 64,
      },
    };
    const result = PatchYamlSchema.safeParse(patchWithExtension);
    expect(result.success).toBe(true);
  });

  it('should reject patch without keyGroups or s330 extension', () => {
    const invalidPatch = {
      format: 'sampler-patch',
      device: 's330',
      version: 1,
      name: 'Invalid',
    };
    const result = PatchYamlSchema.safeParse(invalidPatch);
    expect(result.success).toBe(false);
  });

  it('should reject invalid format identifier', () => {
    const invalid = { ...validPatch, format: 'wrong-format' };
    const result = PatchYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject name longer than 12 characters', () => {
    const invalid = { ...validPatch, name: 'ThisPatchNameIsTooLong' };
    const result = PatchYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject level out of range', () => {
    const invalid = { ...validPatch, level: 200 };
    const result = PatchYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept all valid key modes', () => {
    const modes = ['normal', 'v-sw', 'x-fade', 'v-mix', 'unison'] as const;
    for (const keyMode of modes) {
      const patch = {
        ...validPatch,
        s330: { ...validPatch.s330, keyMode },
      };
      const result = PatchYamlSchema.safeParse(patch);
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid aftertouch assignments', () => {
    const assigns = ['modulation', 'volume', 'bend+', 'bend-', 'filter'] as const;
    for (const aftertouchAssign of assigns) {
      const patch = {
        ...validPatch,
        s330: { ...validPatch.s330, aftertouchAssign },
      };
      const result = PatchYamlSchema.safeParse(patch);
      expect(result.success).toBe(true);
    }
  });

  it('should reject benderRange out of range', () => {
    const invalid = {
      ...validPatch,
      s330: { ...validPatch.s330, benderRange: 24 }, // Max is 12
    };
    const result = PatchYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject octaveShift out of range', () => {
    const invalid = {
      ...validPatch,
      s330: { ...validPatch.s330, octaveShift: 5 }, // Range is -2 to +2
    };
    const result = PatchYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('KeyGroupSchema', () => {
  it('should validate a complete key group', () => {
    const keyGroup = {
      name: 'Kick',
      tone: 'Kick_01',
      keyRange: [36, 48] as [number, number],
      velocityRange: [1, 127] as [number, number],
      level: 100,
      pan: 'center',
    };
    const result = KeyGroupSchema.safeParse(keyGroup);
    expect(result.success).toBe(true);
  });

  it('should validate key group with minimal fields', () => {
    const keyGroup = {
      tone: 'Kick_01',
      keyRange: [36, 36] as [number, number],
    };
    const result = KeyGroupSchema.safeParse(keyGroup);
    expect(result.success).toBe(true);
  });

  it('should reject empty tone reference', () => {
    const keyGroup = {
      tone: '',
      keyRange: [36, 36] as [number, number],
    };
    const result = KeyGroupSchema.safeParse(keyGroup);
    expect(result.success).toBe(false);
  });

  it('should reject key range where low > high', () => {
    const keyGroup = {
      tone: 'Kick_01',
      keyRange: [60, 36] as [number, number], // Invalid: low > high
    };
    const result = KeyGroupSchema.safeParse(keyGroup);
    expect(result.success).toBe(false);
  });

  it('should reject velocity range where min > max', () => {
    const keyGroup = {
      tone: 'Kick_01',
      keyRange: [36, 36] as [number, number],
      velocityRange: [100, 50] as [number, number], // Invalid: min > max
    };
    const result = KeyGroupSchema.safeParse(keyGroup);
    expect(result.success).toBe(false);
  });

  it('should accept numeric pan values', () => {
    const keyGroup = {
      tone: 'Kick_01',
      keyRange: [36, 36] as [number, number],
      pan: -32,
    };
    const result = KeyGroupSchema.safeParse(keyGroup);
    expect(result.success).toBe(true);
  });

  it('should reject pan out of range', () => {
    const keyGroup = {
      tone: 'Kick_01',
      keyRange: [36, 36] as [number, number],
      pan: 100, // Max is 63
    };
    const result = KeyGroupSchema.safeParse(keyGroup);
    expect(result.success).toBe(false);
  });
});
