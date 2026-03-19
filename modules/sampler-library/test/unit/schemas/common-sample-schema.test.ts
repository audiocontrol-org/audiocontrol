import { describe, it, expect } from 'vitest';
import { CommonSampleYamlSchema } from '@/schemas/common-sample-schema.js';

const validCommonSample = {
  format: 'common-sample',
  version: 1,
  name: 'My Kick Drum',
  wave: {
    file: 'kick.wav',
    sampleRate: 44100,
    loopMode: 'oneShot',
  },
};

describe('CommonSampleYamlSchema', () => {
  it('should accept a minimal valid common sample', () => {
    const result = CommonSampleYamlSchema.safeParse(validCommonSample);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('common-sample');
      expect(result.data.version).toBe(1);
      expect(result.data.name).toBe('My Kick Drum');
      expect(result.data.wave.file).toBe('kick.wav');
      expect(result.data.wave.sampleRate).toBe(44100);
      expect(result.data.wave.loopMode).toBe('oneShot');
    }
  });

  it('should accept all optional fields', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      tags: ['drums', 'kick', 'electronic'],
      description: 'A punchy kick drum sample',
      sourceDevice: 's330',
      createdAt: '2026-03-18T10:00:00.000Z',
      modifiedAt: '2026-03-18T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual(['drums', 'kick', 'electronic']);
      expect(result.data.description).toBe('A punchy kick drum sample');
      expect(result.data.sourceDevice).toBe('s330');
      expect(result.data.createdAt).toBe('2026-03-18T10:00:00.000Z');
      expect(result.data.modifiedAt).toBe('2026-03-18T12:00:00.000Z');
    }
  });

  it('should accept wave params with loopPoint', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      wave: {
        file: 'pad.wav',
        sampleRate: 30000,
        loopMode: 'forward',
        loopPoint: 1024,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.wave.loopPoint).toBe(1024);
      expect(result.data.wave.loopMode).toBe('forward');
    }
  });

  it('should accept names up to 128 characters', () => {
    const longName = 'A'.repeat(128);
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      name: longName,
    });
    expect(result.success).toBe(true);
  });

  it('should reject names over 128 characters', () => {
    const tooLong = 'A'.repeat(129);
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      name: tooLong,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing name', () => {
    const { name: _, ...noName } = validCommonSample;
    const result = CommonSampleYamlSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('should reject missing wave', () => {
    const { wave: _, ...noWave } = validCommonSample;
    const result = CommonSampleYamlSchema.safeParse(noWave);
    expect(result.success).toBe(false);
  });

  it('should reject missing format', () => {
    const { format: _, ...noFormat } = validCommonSample;
    const result = CommonSampleYamlSchema.safeParse(noFormat);
    expect(result.success).toBe(false);
  });

  it('should reject wrong format discriminator', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      format: 'sampler-tone',
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong version', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      version: 2,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid sourceDevice', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      sourceDevice: 'mpc3000',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid sourceDevice values', () => {
    for (const device of ['s330', 's550', 'jv1080', 'd110']) {
      const result = CommonSampleYamlSchema.safeParse({
        ...validCommonSample,
        sourceDevice: device,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid wave params (missing file)', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      wave: {
        sampleRate: 44100,
        loopMode: 'oneShot',
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid loopMode', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      wave: {
        file: 'kick.wav',
        sampleRate: 44100,
        loopMode: 'pingPong',
      },
    });
    expect(result.success).toBe(false);
  });

  it('should accept empty tags array', () => {
    const result = CommonSampleYamlSchema.safeParse({
      ...validCommonSample,
      tags: [],
    });
    expect(result.success).toBe(true);
  });
});
