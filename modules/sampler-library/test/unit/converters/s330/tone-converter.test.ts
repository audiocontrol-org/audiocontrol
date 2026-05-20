import { describe, it, expect } from 'vitest';
import type { S330Tone, S330Envelope } from '@audiocontrol/sampler-devices/s330';
import { s330ToneConverter } from '@/converters/s330/index.js';
import { ToneYamlSchema } from '@/schemas/index.js';

/**
 * Create a minimal valid S330Tone for testing.
 */
function createTestTone(overrides: Partial<S330Tone> = {}): S330Tone {
  const defaultEnvelope: S330Envelope = {
    levels: [127, 100, 80, 60, 40, 20, 10, 0],
    rates: [127, 100, 80, 60, 50, 40, 30, 20],
    sustainPoint: 3,
    endPoint: 8,
  };

  return {
    name: 'TestTone',
    outputAssign: 0,
    sourceTone: 0,
    origSubTone: 0,
    sampleRate: '30kHz',
    originalKey: 60,
    wave: {
      bank: 0,
      segmentTop: 0,
      segmentLength: 0,
      startPoint: 0,
      endPoint: 44100,
      loopPoint: 22050,
      loopLength: 22050,
    },
    loopMode: 'forward',
    lfo: {
      rate: 50,
      sync: false,
      delay: 0,
      mode: 'normal',
      polarity: false,
      offset: 0,
    },
    transpose: 0,
    fineTune: 0,
    tvf: {
      cutoff: 127,
      resonance: 0,
      keyFollow: 0,
      lfoDepth: 0,
      egDepth: 64,
      egPolarity: 'normal',
      levelCurve: 0,
      keyRateFollow: 0,
      velRateFollow: 0,
      enabled: true,
      envelope: defaultEnvelope,
    },
    tva: {
      lfoDepth: 0,
      keyRate: 0,
      level: 127,
      velRate: 0,
      levelCurve: 0,
      envelope: defaultEnvelope,
    },
    benderEnabled: true,
    aftertouchEnabled: true,
    pitchFollow: true,
    recThreshold: 0,
    recPreTrigger: 0,
    loopTune: 0,
    envZoom: 0,
    copySource: 0,
    ...overrides,
  };
}

describe('s330ToneConverter', () => {
  describe('toYaml', () => {
    it('should convert a tone to valid YAML format', () => {
      const tone = createTestTone();
      const yaml = s330ToneConverter.toYaml(tone, 'test.wav');

      expect(yaml.format).toBe('sampler-tone');
      expect(yaml.device).toBe('s330');
      expect(yaml.version).toBe(1);
      expect(yaml.name).toBe('TestTone');
      expect(yaml.wave.file).toBe('test.wav');
    });

    it('should produce schema-valid output', () => {
      const tone = createTestTone();
      const yaml = s330ToneConverter.toYaml(tone, 'test.wav');

      const result = ToneYamlSchema.safeParse(yaml);
      expect(result.success).toBe(true);
    });

    it('should map loop modes correctly', () => {
      const modes = [
        { input: 'forward' as const, output: 'forward' },
        { input: 'alternating' as const, output: 'alternating' },
        { input: 'one-shot' as const, output: 'oneShot' },
        { input: 'reverse' as const, output: 'reverse' },
      ];

      for (const { input, output } of modes) {
        const tone = createTestTone({ loopMode: input });
        const yaml = s330ToneConverter.toYaml(tone, 'test.wav');
        expect(yaml.wave.loopMode).toBe(output);
      }
    });

    it('should map sample rates correctly', () => {
      const tone30k = createTestTone({ sampleRate: '30kHz' });
      const yaml30k = s330ToneConverter.toYaml(tone30k, 'test.wav');
      expect(yaml30k.wave.sampleRate).toBe(30000);

      const tone15k = createTestTone({ sampleRate: '15kHz' });
      const yaml15k = s330ToneConverter.toYaml(tone15k, 'test.wav');
      expect(yaml15k.wave.sampleRate).toBe(15000);
    });

    it('should include all S-330 specific parameters', () => {
      const tone = createTestTone({
        originalKey: 48,
        outputAssign: 3,
        transpose: 6,
        fineTune: -12,
      });
      const yaml = s330ToneConverter.toYaml(tone, 'test.wav');

      expect(yaml.s330?.originalKey).toBe(48);
      expect(yaml.s330?.outputAssign).toBe(3);
      expect(yaml.s330?.transpose).toBe(6);
      expect(yaml.s330?.fineTune).toBe(-12);
    });

    it('should include TVF parameters', () => {
      const tone = createTestTone();
      tone.tvf.cutoff = 100;
      tone.tvf.resonance = 50;
      tone.tvf.egPolarity = 'reverse';

      const yaml = s330ToneConverter.toYaml(tone, 'test.wav');

      expect(yaml.s330?.tvf?.cutoff).toBe(100);
      expect(yaml.s330?.tvf?.resonance).toBe(50);
      expect(yaml.s330?.tvf?.egPolarity).toBe('reverse');
    });

    it('should include TVA envelope', () => {
      const tone = createTestTone();
      const yaml = s330ToneConverter.toYaml(tone, 'test.wav');

      expect(yaml.s330?.tva?.envelope.levels).toHaveLength(8);
      expect(yaml.s330?.tva?.envelope.rates).toHaveLength(8);
      expect(yaml.s330?.tva?.envelope.sustainPoint).toBe(3);
      expect(yaml.s330?.tva?.envelope.endPoint).toBe(8);
    });
  });

  describe('fromYaml', () => {
    it('should convert YAML back to S330Tone', () => {
      const originalTone = createTestTone();
      const yaml = s330ToneConverter.toYaml(originalTone, 'test.wav');
      const restored = s330ToneConverter.fromYaml(yaml);

      expect(restored.name).toBe(originalTone.name);
      expect(restored.originalKey).toBe(originalTone.originalKey);
      expect(restored.outputAssign).toBe(originalTone.outputAssign);
    });

    it('should map loop modes back correctly', () => {
      const modes = ['forward', 'alternating', 'one-shot', 'reverse'] as const;

      for (const mode of modes) {
        const tone = createTestTone({ loopMode: mode });
        const yaml = s330ToneConverter.toYaml(tone, 'test.wav');
        const restored = s330ToneConverter.fromYaml(yaml);
        expect(restored.loopMode).toBe(mode);
      }
    });

    it('should map sample rates back correctly', () => {
      const tone30k = createTestTone({ sampleRate: '30kHz' });
      const yaml30k = s330ToneConverter.toYaml(tone30k, 'test.wav');
      const restored30k = s330ToneConverter.fromYaml(yaml30k);
      expect(restored30k.sampleRate).toBe('30kHz');

      const tone15k = createTestTone({ sampleRate: '15kHz' });
      const yaml15k = s330ToneConverter.toYaml(tone15k, 'test.wav');
      const restored15k = s330ToneConverter.fromYaml(yaml15k);
      expect(restored15k.sampleRate).toBe('15kHz');
    });

    it('should restore TVF parameters', () => {
      const tone = createTestTone();
      tone.tvf.cutoff = 80;
      tone.tvf.resonance = 30;
      tone.tvf.egPolarity = 'reverse';

      const yaml = s330ToneConverter.toYaml(tone, 'test.wav');
      const restored = s330ToneConverter.fromYaml(yaml);

      expect(restored.tvf.cutoff).toBe(80);
      expect(restored.tvf.resonance).toBe(30);
      expect(restored.tvf.egPolarity).toBe('reverse');
    });

    it('should restore TVA envelope', () => {
      const tone = createTestTone();
      const yaml = s330ToneConverter.toYaml(tone, 'test.wav');
      const restored = s330ToneConverter.fromYaml(yaml);

      expect(restored.tva.envelope.levels).toEqual(tone.tva.envelope.levels);
      expect(restored.tva.envelope.rates).toEqual(tone.tva.envelope.rates);
      expect(restored.tva.envelope.sustainPoint).toBe(tone.tva.envelope.sustainPoint);
      expect(restored.tva.envelope.endPoint).toBe(tone.tva.envelope.endPoint);
    });

    it('should throw for non-s330 YAML', () => {
      const invalidYaml = {
        format: 'sampler-tone' as const,
        device: 'jv1080' as const,
        version: 1,
        name: 'Test',
        wave: {
          file: 'test.wav',
          sampleRate: 44100,
          loopMode: 'forward' as const,
        },
      };

      expect(() => s330ToneConverter.fromYaml(invalidYaml as any)).toThrow();
    });

    it('should apply defaults for missing optional fields', () => {
      const minimalYaml = {
        format: 'sampler-tone' as const,
        device: 's330' as const,
        version: 1,
        name: 'Minimal',
        wave: {
          file: 'test.wav',
          sampleRate: 30000,
          loopMode: 'forward' as const,
        },
        s330: {
          originalKey: 60,
          outputAssign: 0,
        },
      };

      const restored = s330ToneConverter.fromYaml(minimalYaml as any);

      expect(restored.transpose).toBe(0); // default
      expect(restored.fineTune).toBe(0); // default
      expect(restored.benderEnabled).toBe(true); // default
    });
  });

  describe('round-trip', () => {
    it('should preserve all major fields through conversion', () => {
      const original = createTestTone({
        name: 'RoundTrip',
        originalKey: 72,
        outputAssign: 5,
        transpose: -6,
        fineTune: -24,
        loopMode: 'alternating',
        sampleRate: '15kHz',
      });

      const yaml = s330ToneConverter.toYaml(original, 'round.wav');
      const restored = s330ToneConverter.fromYaml(yaml);

      expect(restored.name).toBe(original.name);
      expect(restored.originalKey).toBe(original.originalKey);
      expect(restored.outputAssign).toBe(original.outputAssign);
      expect(restored.transpose).toBe(original.transpose);
      expect(restored.fineTune).toBe(original.fineTune);
      expect(restored.loopMode).toBe(original.loopMode);
      expect(restored.sampleRate).toBe(original.sampleRate);
    });
  });
});
