import { describe, it, expect } from 'vitest';
import { ToneYamlSchema, S330EnvelopeSchema } from '@/schemas/index.js';

describe('ToneYamlSchema', () => {
  const validS330Tone = {
    format: 'sampler-tone' as const,
    device: 's330' as const,
    version: 1,
    name: 'Kick_01',
    wave: {
      file: 'Kick_01.wav',
      sampleRate: 30000,
      loopMode: 'forward' as const,
      loopPoint: 0,
    },
    s330: {
      originalKey: 60,
      outputAssign: 0,
      transpose: 64,
      fineTune: 0,
      tvf: {
        cutoff: 127,
        resonance: 0,
        keyFollow: 0,
        egDepth: 0,
        egPolarity: 'normal' as const,
        enabled: true,
      },
      tva: {
        level: 127,
        envelope: {
          levels: [127, 100, 80, 60, 40, 20, 10, 0] as [number, number, number, number, number, number, number, number],
          rates: [127, 100, 80, 60, 50, 40, 30, 20] as [number, number, number, number, number, number, number, number],
          sustainPoint: 3,
          endPoint: 8,
        },
      },
    },
  };

  it('should validate a complete S-330 tone', () => {
    const result = ToneYamlSchema.safeParse(validS330Tone);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Kick_01');
      expect(result.data.device).toBe('s330');
    }
  });

  it('should reject tone without device-specific extension for s330', () => {
    const toneWithoutExtension = {
      format: 'sampler-tone',
      device: 's330',
      version: 1,
      name: 'Test',
      wave: {
        file: 'test.wav',
        sampleRate: 30000,
        loopMode: 'forward',
      },
      // Missing s330 extension
    };

    const result = ToneYamlSchema.safeParse(toneWithoutExtension);
    expect(result.success).toBe(false);
  });

  it('should reject invalid format identifier', () => {
    const invalid = { ...validS330Tone, format: 'invalid-format' };
    const result = ToneYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid device type', () => {
    const invalid = { ...validS330Tone, device: 'unknown-device' };
    const result = ToneYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject name longer than 12 characters', () => {
    const invalid = { ...validS330Tone, name: 'ThisNameIsTooLong' };
    const result = ToneYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid sample rate', () => {
    const invalid = {
      ...validS330Tone,
      wave: { ...validS330Tone.wave, sampleRate: -1 },
    };
    const result = ToneYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid loop mode', () => {
    const invalid = {
      ...validS330Tone,
      wave: { ...validS330Tone.wave, loopMode: 'invalid' },
    };
    const result = ToneYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept all valid loop modes', () => {
    const modes = ['oneShot', 'forward', 'alternating', 'reverse'] as const;
    for (const loopMode of modes) {
      const tone = {
        ...validS330Tone,
        wave: { ...validS330Tone.wave, loopMode },
      };
      const result = ToneYamlSchema.safeParse(tone);
      expect(result.success).toBe(true);
    }
  });

  it('should reject S-330 originalKey outside valid range', () => {
    const invalid = {
      ...validS330Tone,
      s330: { ...validS330Tone.s330, originalKey: 200 },
    };
    const result = ToneYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should apply default values for transpose and fineTune', () => {
    const toneWithoutDefaults = {
      ...validS330Tone,
      s330: {
        originalKey: 60,
        outputAssign: 0,
        tva: validS330Tone.s330.tva,
      },
    };
    const result = ToneYamlSchema.safeParse(toneWithoutDefaults);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.s330?.transpose).toBe(64);
      expect(result.data.s330?.fineTune).toBe(0);
    }
  });
});

describe('S330EnvelopeSchema', () => {
  it('should validate a complete 8-point envelope', () => {
    const envelope = {
      levels: [127, 100, 80, 60, 40, 20, 10, 0],
      rates: [127, 100, 80, 60, 50, 40, 30, 20],
      sustainPoint: 3,
      endPoint: 8,
    };
    const result = S330EnvelopeSchema.safeParse(envelope);
    expect(result.success).toBe(true);
  });

  it('should reject envelope with wrong number of levels', () => {
    const envelope = {
      levels: [127, 100, 80], // Only 3 instead of 8
      rates: [127, 100, 80, 60, 50, 40, 30, 20],
      sustainPoint: 3,
      endPoint: 8,
    };
    const result = S330EnvelopeSchema.safeParse(envelope);
    expect(result.success).toBe(false);
  });

  it('should reject envelope with level out of range', () => {
    const envelope = {
      levels: [200, 100, 80, 60, 40, 20, 10, 0], // 200 is > 127
      rates: [127, 100, 80, 60, 50, 40, 30, 20],
      sustainPoint: 3,
      endPoint: 8,
    };
    const result = S330EnvelopeSchema.safeParse(envelope);
    expect(result.success).toBe(false);
  });

  it('should reject envelope with rate of 0', () => {
    const envelope = {
      levels: [127, 100, 80, 60, 40, 20, 10, 0],
      rates: [0, 100, 80, 60, 50, 40, 30, 20], // 0 is invalid (min 1)
      sustainPoint: 3,
      endPoint: 8,
    };
    const result = S330EnvelopeSchema.safeParse(envelope);
    expect(result.success).toBe(false);
  });

  it('should reject sustainPoint out of range', () => {
    const envelope = {
      levels: [127, 100, 80, 60, 40, 20, 10, 0],
      rates: [127, 100, 80, 60, 50, 40, 30, 20],
      sustainPoint: 10, // Max is 7
      endPoint: 8,
    };
    const result = S330EnvelopeSchema.safeParse(envelope);
    expect(result.success).toBe(false);
  });

  it('should reject endPoint out of range', () => {
    const envelope = {
      levels: [127, 100, 80, 60, 40, 20, 10, 0],
      rates: [127, 100, 80, 60, 50, 40, 30, 20],
      sustainPoint: 3,
      endPoint: 0, // Min is 1
    };
    const result = S330EnvelopeSchema.safeParse(envelope);
    expect(result.success).toBe(false);
  });
});
