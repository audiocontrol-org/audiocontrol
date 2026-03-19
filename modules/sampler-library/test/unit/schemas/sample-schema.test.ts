import { describe, it, expect } from 'vitest';
import { SampleYamlSchema } from '@/schemas/sample-schema.js';

const validSample = {
  format: 'sample',
  version: 1,
  name: 'My Kick Drum',
  file: 'kick.wav',
  sampleRate: 44100,
};

describe('SampleYamlSchema', () => {
  it('should accept a minimal valid sample', () => {
    const result = SampleYamlSchema.safeParse(validSample);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('sample');
      expect(result.data.version).toBe(1);
      expect(result.data.name).toBe('My Kick Drum');
      expect(result.data.file).toBe('kick.wav');
      expect(result.data.sampleRate).toBe(44100);
    }
  });

  it('should accept all optional fields', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      loopMode: 'forward',
      loopStart: 1024,
      loopEnd: 8192,
      rootKey: 'C4',
      tags: ['drums', 'kick', 'electronic'],
      description: 'A punchy kick drum sample',
      sourceDevice: 's330',
      createdAt: '2026-03-18T10:00:00.000Z',
      modifiedAt: '2026-03-18T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loopMode).toBe('forward');
      expect(result.data.loopStart).toBe(1024);
      expect(result.data.loopEnd).toBe(8192);
      expect(result.data.rootKey).toBe('C4');
      expect(result.data.tags).toEqual(['drums', 'kick', 'electronic']);
      expect(result.data.description).toBe('A punchy kick drum sample');
      expect(result.data.sourceDevice).toBe('s330');
    }
  });

  it('should accept rootKey as a MIDI note number', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      rootKey: 60,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rootKey).toBe(60);
    }
  });

  it('should accept rootKey as a note name', () => {
    for (const note of ['C2', 'F#4', 'Bb3']) {
      const result = SampleYamlSchema.safeParse({
        ...validSample,
        rootKey: note,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all loop modes', () => {
    for (const mode of ['oneShot', 'forward', 'alternating', 'reverse']) {
      const result = SampleYamlSchema.safeParse({
        ...validSample,
        loopMode: mode,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should accept names up to 128 characters', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      name: 'A'.repeat(128),
    });
    expect(result.success).toBe(true);
  });

  it('should reject names over 128 characters', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      name: 'A'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing name', () => {
    const { name: _, ...noName } = validSample;
    const result = SampleYamlSchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('should reject missing file', () => {
    const { file: _, ...noFile } = validSample;
    const result = SampleYamlSchema.safeParse(noFile);
    expect(result.success).toBe(false);
  });

  it('should reject empty file', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      file: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing sampleRate', () => {
    const { sampleRate: _, ...noRate } = validSample;
    const result = SampleYamlSchema.safeParse(noRate);
    expect(result.success).toBe(false);
  });

  it('should reject zero sampleRate', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      sampleRate: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong format discriminator', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      format: 'sampler-tone',
    });
    expect(result.success).toBe(false);
  });

  it('should reject wrong version', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      version: 2,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid sourceDevice', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      sourceDevice: 'mpc3000',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid sourceDevice values', () => {
    for (const device of ['s330', 's550', 'jv1080', 'd110']) {
      const result = SampleYamlSchema.safeParse({
        ...validSample,
        sourceDevice: device,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid loopMode', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      loopMode: 'pingPong',
    });
    expect(result.success).toBe(false);
  });

  it('should reject loopEnd < loopStart', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      loopStart: 1000,
      loopEnd: 500,
    });
    expect(result.success).toBe(false);
  });

  it('should accept loopEnd == loopStart', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      loopStart: 1000,
      loopEnd: 1000,
    });
    expect(result.success).toBe(true);
  });

  it('should accept loopStart without loopEnd', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      loopStart: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('should accept loopEnd without loopStart', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      loopEnd: 8192,
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty tags array', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      tags: [],
    });
    expect(result.success).toBe(true);
  });

  it('should reject negative loopStart', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      loopStart: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject rootKey outside MIDI range', () => {
    const result = SampleYamlSchema.safeParse({
      ...validSample,
      rootKey: 128,
    });
    expect(result.success).toBe(false);
  });
});
