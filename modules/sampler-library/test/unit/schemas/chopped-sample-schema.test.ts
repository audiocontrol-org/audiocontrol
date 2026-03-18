import { describe, it, expect } from 'vitest';
import {
  ChoppedSampleSchema,
  GenericChoppedSampleSchema,
  DrumKitChoppedSampleSchema,
  TriggerMappingSchema,
  PlaybackConfigSchema,
} from '@/schemas/chopped-sample-schema.js';

describe('TriggerMappingSchema', () => {
  it('should accept valid trigger mapping', () => {
    const result = TriggerMappingSchema.safeParse({
      triggerId: 'key:a',
      sliceIndex: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty triggerId', () => {
    const result = TriggerMappingSchema.safeParse({
      triggerId: '',
      sliceIndex: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative sliceIndex', () => {
    const result = TriggerMappingSchema.safeParse({
      triggerId: 'key:a',
      sliceIndex: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('PlaybackConfigSchema', () => {
  it('should accept valid playback config', () => {
    const result = PlaybackConfigSchema.safeParse({
      polyphony: 'poly',
      playbackMode: 'one-shot',
      muteGroups: [0, 0, 1, 1],
    });
    expect(result.success).toBe(true);
  });

  it('should accept mono + gate mode', () => {
    const result = PlaybackConfigSchema.safeParse({
      polyphony: 'mono',
      playbackMode: 'gate',
      muteGroups: [],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid polyphony mode', () => {
    const result = PlaybackConfigSchema.safeParse({
      polyphony: 'stereo',
      playbackMode: 'one-shot',
      muteGroups: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('GenericChoppedSampleSchema', () => {
  const validGeneric = {
    format: 'chopped-sample',
    version: 1,
    variant: 'generic',
    name: 'My Break',
    source: 'source.wav',
    sampleRate: 44100,
    slices: [
      { label: 'hit-1', startSample: 0, endSample: 22050 },
      { label: 'hit-2', startSample: 22050, endSample: 44100 },
    ],
  };

  it('should accept valid generic chopped sample', () => {
    const result = GenericChoppedSampleSchema.safeParse(validGeneric);
    expect(result.success).toBe(true);
  });

  it('should accept with optional triggers and playback', () => {
    const result = GenericChoppedSampleSchema.safeParse({
      ...validGeneric,
      triggers: [{ triggerId: 'key:a', sliceIndex: 0 }],
      playback: { polyphony: 'poly', playbackMode: 'one-shot', muteGroups: [0, 0] },
    });
    expect(result.success).toBe(true);
  });

  it('should accept with timestamps', () => {
    const result = GenericChoppedSampleSchema.safeParse({
      ...validGeneric,
      createdAt: '2026-01-01T00:00:00.000Z',
      modifiedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('should require at least one slice', () => {
    const result = GenericChoppedSampleSchema.safeParse({
      ...validGeneric,
      slices: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong variant', () => {
    const result = GenericChoppedSampleSchema.safeParse({
      ...validGeneric,
      variant: 'drum-kit',
    });
    expect(result.success).toBe(false);
  });
});

describe('DrumKitChoppedSampleSchema', () => {
  const validDrumKit = {
    format: 'chopped-sample',
    version: 1,
    variant: 'drum-kit',
    name: 'Kit Break',
    source: 'source.wav',
    sampleRate: 30000,
    slices: [
      { label: 'kick', startSample: 0, endSample: 15000 },
      { label: 'snare', startSample: 15000, endSample: 30000 },
    ],
    drumKit: {
      baseNote: 'C2',
    },
  };

  it('should accept valid drum kit chopped sample', () => {
    const result = DrumKitChoppedSampleSchema.safeParse(validDrumKit);
    expect(result.success).toBe(true);
  });

  it('should accept with optional drum kit fields', () => {
    const result = DrumKitChoppedSampleSchema.safeParse({
      ...validDrumKit,
      drumKit: {
        baseNote: 36,
        transpose: -12,
        velocitySensitivity: 4,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drumKit.transpose).toBe(-12);
      expect(result.data.drumKit.velocitySensitivity).toBe(4);
    }
  });

  it('should reject missing drumKit', () => {
    const { drumKit: _, ...noDrumKit } = validDrumKit;
    const result = DrumKitChoppedSampleSchema.safeParse(noDrumKit);
    expect(result.success).toBe(false);
  });
});

describe('ChoppedSampleSchema (discriminated union)', () => {
  it('should discriminate generic variant', () => {
    const result = ChoppedSampleSchema.safeParse({
      format: 'chopped-sample',
      version: 1,
      variant: 'generic',
      name: 'Test',
      source: 'source.wav',
      sampleRate: 44100,
      slices: [{ label: 'a', startSample: 0, endSample: 100 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant).toBe('generic');
    }
  });

  it('should discriminate drum-kit variant', () => {
    const result = ChoppedSampleSchema.safeParse({
      format: 'chopped-sample',
      version: 1,
      variant: 'drum-kit',
      name: 'Test Kit',
      source: 'source.wav',
      sampleRate: 30000,
      slices: [{ label: 'kick', startSample: 0, endSample: 100 }],
      drumKit: { baseNote: 'C2' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variant).toBe('drum-kit');
    }
  });

  it('should reject unknown variant', () => {
    const result = ChoppedSampleSchema.safeParse({
      format: 'chopped-sample',
      version: 1,
      variant: 'unknown',
      name: 'Test',
      source: 'source.wav',
      sampleRate: 44100,
      slices: [{ label: 'a', startSample: 0, endSample: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong format literal', () => {
    const result = ChoppedSampleSchema.safeParse({
      format: 'drum-kit-bundle',
      version: 1,
      variant: 'generic',
      name: 'Test',
      source: 'source.wav',
      sampleRate: 44100,
      slices: [{ label: 'a', startSample: 0, endSample: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong version', () => {
    const result = ChoppedSampleSchema.safeParse({
      format: 'chopped-sample',
      version: 2,
      variant: 'generic',
      name: 'Test',
      source: 'source.wav',
      sampleRate: 44100,
      slices: [{ label: 'a', startSample: 0, endSample: 100 }],
    });
    expect(result.success).toBe(false);
  });
});
