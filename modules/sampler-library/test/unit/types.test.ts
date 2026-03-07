import { describe, it, expect } from 'vitest';
import type {
  DeviceType,
  LoopMode,
  BaseTone,
  BasePatch,
  DrumKitTemplate,
  VelocityLayerTemplate,
} from '@/types/index.js';

describe('sampler-library types', () => {
  describe('DeviceType', () => {
    it('should accept valid device types', () => {
      const s330: DeviceType = 's330';
      const jv1080: DeviceType = 'jv1080';
      const d110: DeviceType = 'd110';

      expect(s330).toBe('s330');
      expect(jv1080).toBe('jv1080');
      expect(d110).toBe('d110');
    });
  });

  describe('LoopMode', () => {
    it('should accept valid loop modes', () => {
      const modes: LoopMode[] = ['oneShot', 'forward', 'alternating', 'reverse'];
      expect(modes).toHaveLength(4);
    });
  });

  describe('BaseTone', () => {
    it('should define correct structure', () => {
      const tone: BaseTone = {
        format: 'sampler-tone',
        device: 's330',
        version: 1,
        name: 'Test Tone',
        wave: {
          file: 'test.wav',
          sampleRate: 30000,
          loopMode: 'forward',
          loopPoint: 0,
        },
      };

      expect(tone.format).toBe('sampler-tone');
      expect(tone.device).toBe('s330');
      expect(tone.wave.file).toBe('test.wav');
    });
  });

  describe('BasePatch', () => {
    it('should define correct structure', () => {
      const patch: BasePatch = {
        format: 'sampler-patch',
        device: 's330',
        version: 1,
        name: 'Test Patch',
      };

      expect(patch.format).toBe('sampler-patch');
      expect(patch.device).toBe('s330');
    });
  });

  describe('DrumKitTemplate', () => {
    it('should define correct structure', () => {
      const template: DrumKitTemplate = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'drum-kit',
        name: '808 Kit',
        description: 'Classic 808 drum kit',
        kit: [
          { name: 'Kick', key: 'C2', tone: 'kick_808' },
          { name: 'Snare', key: 38, tone: 'snare_808' },
          { name: 'Hi-Hat', key: 'F#2', tone: 'hihat_808', muteGroup: 1 },
        ],
      };

      expect(template.type).toBe('drum-kit');
      expect(template.kit).toHaveLength(3);
      expect(template.kit[0]?.name).toBe('Kick');
    });
  });

  describe('VelocityLayerTemplate', () => {
    it('should define correct structure', () => {
      const template: VelocityLayerTemplate = {
        format: 'sampler-template',
        device: 's330',
        version: 1,
        type: 'velocity-layer',
        name: 'Piano Layers',
        keyRange: [36, 96],
        velocityLayers: [
          { range: [1, 31], tone: 'piano_pp' },
          { range: [32, 63], tone: 'piano_p' },
          { range: [64, 95], tone: 'piano_mf' },
          { range: [96, 127], tone: 'piano_ff' },
        ],
      };

      expect(template.type).toBe('velocity-layer');
      expect(template.keyRange).toEqual([36, 96]);
      expect(template.velocityLayers).toHaveLength(4);
    });
  });
});
