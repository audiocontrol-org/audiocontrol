import { describe, it, expect } from 'vitest';
import {
  s330SamplePromotion,
  s550SamplePromotion,
} from '@/converters/promotion.js';
import { ToneYamlSchema } from '@/schemas/tone-schema.js';
import { SampleYamlSchema } from '@/schemas/sample-schema.js';
import type { SampleYaml } from '@/schemas/sample-schema.js';

function makeSample(overrides: Partial<SampleYaml> = {}): SampleYaml {
  return {
    format: 'sample',
    version: 1,
    name: 'kick-drum',
    file: 'kick-drum.wav',
    sampleRate: 30000,
    loopMode: 'forward',
    loopStart: 1024,
    ...overrides,
  };
}

describe('S-330 promotion converter', () => {
  it('promotes a sample to a valid ToneYaml with correct device extension', () => {
    const sample = makeSample();
    const tone = s330SamplePromotion.promote(sample, { originalKey: 60 });

    expect(tone.format).toBe('sampler-tone');
    expect(tone.device).toBe('s330');
    expect(tone.version).toBe(1);
    expect(tone.name).toBe('kick-drum');
    expect(tone.wave.file).toBe('kick-drum.wav');
    expect(tone.wave.sampleRate).toBe(30000);
    expect(tone.wave.loopMode).toBe('forward');
    expect(tone.wave.loopPoint).toBe(1024);
    expect(tone.s330).toBeDefined();
    expect(tone.s330!.originalKey).toBe(60);
    expect(tone.s330!.outputAssign).toBe(0);
    expect(tone.s330!.transpose).toBe(0);
    expect(tone.s330!.fineTune).toBe(0);

    const result = ToneYamlSchema.safeParse(tone);
    expect(result.success).toBe(true);
  });

  it('demotes a tone to a valid SampleYaml with sourceDevice breadcrumb', () => {
    const sample = makeSample();
    const tone = s330SamplePromotion.promote(sample, { originalKey: 72 });
    const demoted = s330SamplePromotion.demote(tone);

    expect(demoted.format).toBe('sample');
    expect(demoted.version).toBe(1);
    expect(demoted.name).toBe('kick-drum');
    expect(demoted.file).toBe('kick-drum.wav');
    expect(demoted.sampleRate).toBe(30000);
    expect(demoted.loopMode).toBe('forward');
    expect(demoted.loopStart).toBe(1024);
    expect(demoted.rootKey).toBe(72);
    expect(demoted.sourceDevice).toBe('s330');

    const result = SampleYamlSchema.safeParse(demoted);
    expect(result.success).toBe(true);
  });

  it('round-trips: promote then demote preserves wave params and rootKey', () => {
    const sample = makeSample({ rootKey: 48 });
    const tone = s330SamplePromotion.promote(sample, { originalKey: 48 });
    const roundTripped = s330SamplePromotion.demote(tone);

    expect(roundTripped.file).toBe(sample.file);
    expect(roundTripped.sampleRate).toBe(sample.sampleRate);
    expect(roundTripped.loopMode).toBe(sample.loopMode);
    expect(roundTripped.loopStart).toBe(sample.loopStart);
    expect(roundTripped.rootKey).toBe(48);
  });

  it('truncates a long sample name to 12 characters on promote', () => {
    const longName = 'a'.repeat(128);
    const sample = makeSample({ name: longName });
    const tone = s330SamplePromotion.promote(sample, { originalKey: 60 });

    expect(tone.name).toBe('a'.repeat(12));
    expect(tone.name.length).toBe(12);

    const result = ToneYamlSchema.safeParse(tone);
    expect(result.success).toBe(true);
  });

  it('uses sample rootKey as originalKey when passed through defaults', () => {
    const sample = makeSample({ rootKey: 55 });
    const tone = s330SamplePromotion.promote(sample, {
      originalKey: sample.rootKey as number,
    });

    expect(tone.s330!.originalKey).toBe(55);
  });

  it('applies default values for optional extension fields', () => {
    const sample = makeSample();
    const tone = s330SamplePromotion.promote(sample, { originalKey: 60 });

    expect(tone.s330!.outputAssign).toBe(0);
    expect(tone.s330!.transpose).toBe(0);
    expect(tone.s330!.fineTune).toBe(0);
  });

  it('respects explicit non-default extension values', () => {
    const sample = makeSample();
    const tone = s330SamplePromotion.promote(sample, {
      originalKey: 60,
      outputAssign: 3,
      transpose: -12,
      fineTune: 7,
    });

    expect(tone.s330!.outputAssign).toBe(3);
    expect(tone.s330!.transpose).toBe(-12);
    expect(tone.s330!.fineTune).toBe(7);
  });

  it('defaults loopMode to oneShot when sample has no loopMode', () => {
    const sample = makeSample({ loopMode: undefined });
    const tone = s330SamplePromotion.promote(sample, { originalKey: 60 });

    expect(tone.wave.loopMode).toBe('oneShot');
  });

  it('has deviceType set to s330', () => {
    expect(s330SamplePromotion.deviceType).toBe('s330');
  });
});

describe('S-550 promotion converter', () => {
  it('promotes a sample to a valid S-550 ToneYaml', () => {
    const sample = makeSample();
    const tone = s550SamplePromotion.promote(sample, { originalKey: 60 });

    expect(tone.format).toBe('sampler-tone');
    expect(tone.device).toBe('s550');
    expect(tone.s550).toBeDefined();
    expect(tone.s550!.originalKey).toBe(60);

    const result = ToneYamlSchema.safeParse(tone);
    expect(result.success).toBe(true);
  });

  it('demotes an S-550 tone back to SampleYaml with correct sourceDevice', () => {
    const sample = makeSample();
    const tone = s550SamplePromotion.promote(sample, { originalKey: 80 });
    const demoted = s550SamplePromotion.demote(tone);

    expect(demoted.sourceDevice).toBe('s550');
    expect(demoted.rootKey).toBe(80);
    expect(demoted.file).toBe(sample.file);

    const result = SampleYamlSchema.safeParse(demoted);
    expect(result.success).toBe(true);
  });

  it('has deviceType set to s550', () => {
    expect(s550SamplePromotion.deviceType).toBe('s550');
  });

  it('round-trips S-550 promote/demote correctly', () => {
    const sample = makeSample({ rootKey: 36, loopMode: 'alternating' });
    const tone = s550SamplePromotion.promote(sample, { originalKey: 36 });
    const roundTripped = s550SamplePromotion.demote(tone);

    expect(roundTripped.file).toBe(sample.file);
    expect(roundTripped.sampleRate).toBe(sample.sampleRate);
    expect(roundTripped.loopMode).toBe('alternating');
    expect(roundTripped.rootKey).toBe(36);
    expect(roundTripped.sourceDevice).toBe('s550');
  });
});
