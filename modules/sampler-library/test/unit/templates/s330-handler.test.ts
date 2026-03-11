import { describe, it, expect } from 'vitest';
import { s330TemplateHandler } from '@/templates/index.js';
import type { ToneYaml, DrumKitTemplateYaml, VelocityLayerTemplateYaml } from '@/schemas/index.js';

// Helper to create a minimal ToneYaml
function createToneYaml(name: string): ToneYaml {
  return {
    format: 'sampler-tone',
    device: 's330',
    version: 1,
    name,
    wave: {
      file: `${name}.wav`,
      sampleRate: 30000,
      loopMode: 'forward',
    },
    s330: {
      originalKey: 60,
      outputAssign: 0,
      tva: {
        level: 127,
        envelope: {
          levels: [127, 100, 80, 60, 40, 20, 10, 0],
          rates: [127, 100, 80, 60, 50, 40, 30, 20],
          sustainPoint: 3,
          endPoint: 8,
        },
      },
    },
  };
}

describe('s330TemplateHandler', () => {
  describe('applyDrumKit', () => {
    it('should create a drum kit patch with correct key mappings', () => {
      const template: DrumKitTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'drum-kit',
        name: 'Test Kit',
        kit: [
          { name: 'Kick', key: 'C2', tone: 'kick' },
          { name: 'Snare', key: 'D2', tone: 'snare' },
          { name: 'Hi-Hat', key: 42, tone: 'hihat' },
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['kick', createToneYaml('kick')],
        ['snare', createToneYaml('snare')],
        ['hihat', createToneYaml('hihat')],
      ]);

      const toneNameToIndex = new Map([
        ['kick', 0],
        ['snare', 1],
        ['hihat', 2],
      ]);

      const result = s330TemplateHandler.applyDrumKit(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.patches).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);

      const patch = result.patches[0];
      expect(patch?.common.name).toBe('Test Kit');

      // C2 = MIDI 36, layer index = 36 - 12 = 24
      expect(patch?.common.toneLayer1[24]).toBe(0); // kick
      // D2 = MIDI 38, layer index = 26
      expect(patch?.common.toneLayer1[26]).toBe(1); // snare
      // MIDI 42, layer index = 30
      expect(patch?.common.toneLayer1[30]).toBe(2); // hihat
    });

    it('should report missing tones', () => {
      const template: DrumKitTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'drum-kit',
        name: 'Test Kit',
        kit: [
          { name: 'Kick', key: 36, tone: 'kick' },
          { name: 'Snare', key: 38, tone: 'missing_snare' },
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['kick', createToneYaml('kick')],
      ]);

      const toneNameToIndex = new Map([
        ['kick', 0],
      ]);

      const result = s330TemplateHandler.applyDrumKit(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.warnings).toContain('Tone not found in library: missing_snare');
      expect(result.referencedTones).toContain('missing_snare');
    });

    it('should warn about keys outside S-330 range', () => {
      const template: DrumKitTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'drum-kit',
        name: 'Test Kit',
        kit: [
          { name: 'Low', key: 10, tone: 'tone' }, // Below 21
          { name: 'OK', key: 60, tone: 'tone' },
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['tone', createToneYaml('tone')],
      ]);

      const toneNameToIndex = new Map([
        ['tone', 0],
      ]);

      const result = s330TemplateHandler.applyDrumKit(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.warnings.some(w => w.includes('outside S-330 range'))).toBe(true);
    });

    it('should warn about mute groups not being supported', () => {
      const template: DrumKitTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'drum-kit',
        name: 'Test Kit',
        kit: [
          { name: 'Closed HH', key: 42, tone: 'hh_closed', muteGroup: 1 },
          { name: 'Open HH', key: 46, tone: 'hh_open', muteGroup: 1 },
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['hh_closed', createToneYaml('hh_closed')],
        ['hh_open', createToneYaml('hh_open')],
      ]);

      const toneNameToIndex = new Map([
        ['hh_closed', 0],
        ['hh_open', 1],
      ]);

      const result = s330TemplateHandler.applyDrumKit(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.warnings.some(w => w.includes('Mute groups'))).toBe(true);
    });

    it('should return unique referenced tones', () => {
      const template: DrumKitTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'drum-kit',
        name: 'Test Kit',
        kit: [
          { name: 'Kick 1', key: 36, tone: 'kick' },
          { name: 'Kick 2', key: 48, tone: 'kick' }, // Same tone, different key
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['kick', createToneYaml('kick')],
      ]);

      const toneNameToIndex = new Map([
        ['kick', 0],
      ]);

      const result = s330TemplateHandler.applyDrumKit(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.referencedTones).toEqual(['kick']);
    });
  });

  describe('applyVelocityLayer', () => {
    it('should create a velocity-switched patch with 2 layers', () => {
      const template: VelocityLayerTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'velocity-layer',
        name: 'Piano',
        keyRange: [36, 96],
        velocityLayers: [
          { range: [1, 64], tone: 'piano_soft' },
          { range: [65, 127], tone: 'piano_loud' },
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['piano_soft', createToneYaml('piano_soft')],
        ['piano_loud', createToneYaml('piano_loud')],
      ]);

      const toneNameToIndex = new Map([
        ['piano_soft', 0],
        ['piano_loud', 1],
      ]);

      const result = s330TemplateHandler.applyVelocityLayer(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.patches).toHaveLength(1);

      const patch = result.patches[0];
      expect(patch?.common.name).toBe('Piano');
      expect(patch?.common.keyMode).toBe('v-sw');
      expect(patch?.common.velocityThreshold).toBe(65);

      // Check that keys in range have both layers assigned
      // C2 = 36, layer index = 36 - 12 = 24
      expect(patch?.common.toneLayer1[24]).toBe(0); // soft
      expect(patch?.common.toneLayer2[24]).toBe(1); // loud

      // C7 = 96, layer index = 96 - 12 = 84
      expect(patch?.common.toneLayer1[84]).toBe(0); // soft
      expect(patch?.common.toneLayer2[84]).toBe(1); // loud
    });

    it('should warn when more than 2 velocity layers are provided', () => {
      const template: VelocityLayerTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'velocity-layer',
        name: 'Piano 4-Layer',
        keyRange: [36, 96],
        velocityLayers: [
          { range: [1, 31], tone: 'pp' },
          { range: [32, 63], tone: 'p' },
          { range: [64, 95], tone: 'mf' },
          { range: [96, 127], tone: 'ff' },
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['pp', createToneYaml('pp')],
        ['p', createToneYaml('p')],
        ['mf', createToneYaml('mf')],
        ['ff', createToneYaml('ff')],
      ]);

      const toneNameToIndex = new Map([
        ['pp', 0],
        ['p', 1],
        ['mf', 2],
        ['ff', 3],
      ]);

      const result = s330TemplateHandler.applyVelocityLayer(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.warnings.some(w => w.includes('only supports 2 velocity layers'))).toBe(true);

      // Should use first (pp) and last (ff) layers
      // C2 = 36, layer index = 36 - 12 = 24
      const patch = result.patches[0];
      expect(patch?.common.toneLayer1[24]).toBe(0); // pp (first)
      expect(patch?.common.toneLayer2[24]).toBe(3); // ff (last)
    });

    it('should report missing tones', () => {
      const template: VelocityLayerTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'velocity-layer',
        name: 'Test',
        keyRange: [60, 60],
        velocityLayers: [
          { range: [1, 127], tone: 'missing_tone' },
        ],
      };

      const availableTones = new Map<string, ToneYaml>();
      const toneNameToIndex = new Map<string, number>();

      const result = s330TemplateHandler.applyVelocityLayer(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.warnings).toContain('Tone not found in library: missing_tone');
    });

    it('should return empty patches when required tones are missing', () => {
      const template: VelocityLayerTemplateYaml = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'velocity-layer',
        name: 'Test',
        keyRange: [60, 60],
        velocityLayers: [
          { range: [1, 64], tone: 'soft' },
          { range: [65, 127], tone: 'loud' },
        ],
      };

      const availableTones = new Map<string, ToneYaml>([
        ['soft', createToneYaml('soft')],
        // 'loud' is missing
      ]);

      const toneNameToIndex = new Map([
        ['soft', 0],
        // 'loud' is missing
      ]);

      const result = s330TemplateHandler.applyVelocityLayer(
        template,
        availableTones,
        toneNameToIndex
      );

      expect(result.patches).toHaveLength(0);
    });
  });
});
