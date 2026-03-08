import { describe, it, expect, beforeEach } from 'vitest';
import { ConverterRegistry, converterRegistry } from '@/converters/index.js';
import type { ToneConverter, PatchConverter } from '@/converters/index.js';
import type { BaseTone, BasePatch } from '@/types/index.js';

// Mock converters for testing
const mockToneConverter: ToneConverter<{ name: string }, BaseTone> = {
  deviceType: 's330',
  toYaml: (tone, wavFilename) => ({
    format: 'sampler-tone',
    device: 's330',
    version: 1,
    name: tone.name,
    wave: {
      file: wavFilename,
      sampleRate: 30000,
      loopMode: 'forward',
    },
  }),
  fromYaml: (yaml) => ({ name: yaml.name }),
};

const mockPatchConverter: PatchConverter<{ name: string }, BasePatch> = {
  deviceType: 's330',
  toYaml: (patch) => ({
    format: 'sampler-patch',
    device: 's330',
    version: 1,
    name: patch.name,
  }),
  fromYaml: (yaml) => ({ name: yaml.name }),
};

describe('ConverterRegistry', () => {
  let registry: ConverterRegistry;

  beforeEach(() => {
    registry = new ConverterRegistry();
  });

  describe('tone converters', () => {
    it('should register and retrieve a tone converter', () => {
      registry.registerToneConverter(mockToneConverter);

      const converter = registry.getToneConverter('s330');
      expect(converter).toBeDefined();
      expect(converter?.deviceType).toBe('s330');
    });

    it('should return undefined for unregistered device', () => {
      const converter = registry.getToneConverter('jv1080');
      expect(converter).toBeUndefined();
    });

    it('should check if converter exists', () => {
      expect(registry.hasToneConverter('s330')).toBe(false);

      registry.registerToneConverter(mockToneConverter);

      expect(registry.hasToneConverter('s330')).toBe(true);
      expect(registry.hasToneConverter('jv1080')).toBe(false);
    });

    it('should list registered devices', () => {
      expect(registry.getRegisteredToneDevices()).toEqual([]);

      registry.registerToneConverter(mockToneConverter);

      expect(registry.getRegisteredToneDevices()).toEqual(['s330']);
    });

    it('should convert tones using registered converter', () => {
      registry.registerToneConverter(mockToneConverter);

      const converter = registry.getToneConverter<{ name: string }>('s330');
      const yaml = converter?.toYaml({ name: 'Test' }, 'test.wav');

      expect(yaml?.name).toBe('Test');
      expect(yaml?.wave.file).toBe('test.wav');
    });
  });

  describe('patch converters', () => {
    it('should register and retrieve a patch converter', () => {
      registry.registerPatchConverter(mockPatchConverter);

      const converter = registry.getPatchConverter('s330');
      expect(converter).toBeDefined();
      expect(converter?.deviceType).toBe('s330');
    });

    it('should return undefined for unregistered device', () => {
      const converter = registry.getPatchConverter('d110');
      expect(converter).toBeUndefined();
    });

    it('should check if converter exists', () => {
      expect(registry.hasPatchConverter('s330')).toBe(false);

      registry.registerPatchConverter(mockPatchConverter);

      expect(registry.hasPatchConverter('s330')).toBe(true);
    });

    it('should list registered devices', () => {
      expect(registry.getRegisteredPatchDevices()).toEqual([]);

      registry.registerPatchConverter(mockPatchConverter);

      expect(registry.getRegisteredPatchDevices()).toEqual(['s330']);
    });
  });

  describe('multiple converters', () => {
    it('should support multiple device types', () => {
      const jv1080Converter: ToneConverter<{ name: string }, BaseTone> = {
        deviceType: 'jv1080',
        toYaml: (tone, wavFilename) => ({
          format: 'sampler-tone',
          device: 'jv1080',
          version: 1,
          name: tone.name,
          wave: { file: wavFilename, sampleRate: 44100, loopMode: 'forward' },
        }),
        fromYaml: (yaml) => ({ name: yaml.name }),
      };

      registry.registerToneConverter(mockToneConverter);
      registry.registerToneConverter(jv1080Converter);

      expect(registry.getRegisteredToneDevices()).toContain('s330');
      expect(registry.getRegisteredToneDevices()).toContain('jv1080');

      const s330 = registry.getToneConverter('s330');
      const jv1080 = registry.getToneConverter('jv1080');

      expect(s330?.deviceType).toBe('s330');
      expect(jv1080?.deviceType).toBe('jv1080');
    });

    it('should overwrite converter for same device type', () => {
      const converter1: ToneConverter<{ name: string }, BaseTone> = {
        deviceType: 's330',
        toYaml: () => ({
          format: 'sampler-tone',
          device: 's330',
          version: 1,
          name: 'v1',
          wave: { file: '', sampleRate: 30000, loopMode: 'forward' },
        }),
        fromYaml: () => ({ name: 'v1' }),
      };

      const converter2: ToneConverter<{ name: string }, BaseTone> = {
        deviceType: 's330',
        toYaml: () => ({
          format: 'sampler-tone',
          device: 's330',
          version: 2,
          name: 'v2',
          wave: { file: '', sampleRate: 30000, loopMode: 'forward' },
        }),
        fromYaml: () => ({ name: 'v2' }),
      };

      registry.registerToneConverter(converter1);
      registry.registerToneConverter(converter2);

      const converter = registry.getToneConverter<{ name: string }>('s330');
      const yaml = converter?.toYaml({ name: 'test' }, 'test.wav');

      expect(yaml?.version).toBe(2);
    });
  });
});

describe('converterRegistry (global instance)', () => {
  it('should have s330 tone converter registered', () => {
    expect(converterRegistry.hasToneConverter('s330')).toBe(true);
  });

  it('should have s330 patch converter registered', () => {
    expect(converterRegistry.hasPatchConverter('s330')).toBe(true);
  });
});
