import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseNoteName,
  resolveKey,
  validateToneReferences,
  TemplateHandlerRegistry,
  templateHandlerRegistry,
} from '@/templates/index.js';
import type { ToneYaml } from '@/schemas/index.js';

describe('parseNoteName', () => {
  it('should parse basic note names', () => {
    expect(parseNoteName('C0')).toBe(12);
    expect(parseNoteName('C1')).toBe(24);
    expect(parseNoteName('C2')).toBe(36);
    expect(parseNoteName('C3')).toBe(48);
    expect(parseNoteName('C4')).toBe(60); // Middle C
    expect(parseNoteName('C5')).toBe(72);
  });

  it('should parse all note letters', () => {
    // In octave 4
    expect(parseNoteName('C4')).toBe(60);
    expect(parseNoteName('D4')).toBe(62);
    expect(parseNoteName('E4')).toBe(64);
    expect(parseNoteName('F4')).toBe(65);
    expect(parseNoteName('G4')).toBe(67);
    expect(parseNoteName('A4')).toBe(69);
    expect(parseNoteName('B4')).toBe(71);
  });

  it('should parse sharps', () => {
    expect(parseNoteName('C#4')).toBe(61);
    expect(parseNoteName('D#4')).toBe(63);
    expect(parseNoteName('F#4')).toBe(66);
    expect(parseNoteName('G#4')).toBe(68);
    expect(parseNoteName('A#4')).toBe(70);
  });

  it('should parse flats', () => {
    expect(parseNoteName('Db4')).toBe(61);
    expect(parseNoteName('Eb4')).toBe(63);
    expect(parseNoteName('Gb4')).toBe(66);
    expect(parseNoteName('Ab4')).toBe(68);
    expect(parseNoteName('Bb4')).toBe(70);
  });

  it('should parse negative octaves', () => {
    expect(parseNoteName('C-1')).toBe(0);
    expect(parseNoteName('G-1')).toBe(7);
  });

  it('should parse lowercase letters', () => {
    expect(parseNoteName('c4')).toBe(60);
    expect(parseNoteName('f#4')).toBe(66);
  });

  it('should handle drum kit standard notes', () => {
    // Standard GM drum map notes
    expect(parseNoteName('C2')).toBe(36); // Kick
    expect(parseNoteName('D2')).toBe(38); // Snare
    expect(parseNoteName('F#2')).toBe(42); // Closed Hi-Hat
    expect(parseNoteName('A#2')).toBe(46); // Open Hi-Hat
  });

  it('should throw for invalid note names', () => {
    expect(() => parseNoteName('X4')).toThrow('Invalid note name');
    expect(() => parseNoteName('C')).toThrow('Invalid note name');
    expect(() => parseNoteName('4C')).toThrow('Invalid note name');
    expect(() => parseNoteName('')).toThrow('Invalid note name');
  });
});

describe('resolveKey', () => {
  it('should pass through numeric keys', () => {
    expect(resolveKey(36)).toBe(36);
    expect(resolveKey(60)).toBe(60);
    expect(resolveKey(127)).toBe(127);
  });

  it('should parse string note names', () => {
    expect(resolveKey('C2')).toBe(36);
    expect(resolveKey('C4')).toBe(60);
    expect(resolveKey('F#4')).toBe(66);
  });
});

describe('validateToneReferences', () => {
  it('should return empty array when all tones exist', () => {
    const availableTones = new Map<string, ToneYaml>([
      ['kick', {} as ToneYaml],
      ['snare', {} as ToneYaml],
      ['hihat', {} as ToneYaml],
    ]);

    const missing = validateToneReferences(
      ['kick', 'snare', 'hihat'],
      availableTones
    );

    expect(missing).toEqual([]);
  });

  it('should return missing tone names', () => {
    const availableTones = new Map<string, ToneYaml>([
      ['kick', {} as ToneYaml],
    ]);

    const missing = validateToneReferences(
      ['kick', 'snare', 'hihat'],
      availableTones
    );

    expect(missing).toEqual(['snare', 'hihat']);
  });

  it('should handle empty inputs', () => {
    const availableTones = new Map<string, ToneYaml>();
    const missing = validateToneReferences([], availableTones);
    expect(missing).toEqual([]);
  });
});

describe('TemplateHandlerRegistry', () => {
  let registry: TemplateHandlerRegistry;

  beforeEach(() => {
    registry = new TemplateHandlerRegistry();
  });

  it('should register and retrieve handlers', () => {
    const mockHandler = {
      deviceType: 's330' as const,
      applyDrumKit: () => ({ patches: [], referencedTones: [], warnings: [] }),
      applyVelocityLayer: () => ({ patches: [], referencedTones: [], warnings: [] }),
    };

    registry.register(mockHandler);

    expect(registry.has('s330')).toBe(true);
    expect(registry.get('s330')).toBe(mockHandler);
  });

  it('should return undefined for unregistered devices', () => {
    expect(registry.has('jv1080')).toBe(false);
    expect(registry.get('jv1080')).toBeUndefined();
  });
});

describe('templateHandlerRegistry (global)', () => {
  it('should have s330 handler registered', () => {
    expect(templateHandlerRegistry.has('s330')).toBe(true);
  });
});
