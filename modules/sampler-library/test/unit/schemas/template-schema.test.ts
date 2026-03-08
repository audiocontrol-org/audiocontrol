import { describe, it, expect } from 'vitest';
import {
  TemplateYamlSchema,
  DrumKitTemplateSchema,
  VelocityLayerTemplateSchema,
  DrumKitEntrySchema,
  MidiNoteSchema,
} from '@/schemas/index.js';

describe('MidiNoteSchema', () => {
  it('should accept valid note names', () => {
    const validNotes = ['C2', 'F#4', 'Bb3', 'A0', 'G9', 'D#5', 'Ab-1'];
    for (const note of validNotes) {
      const result = MidiNoteSchema.safeParse(note);
      expect(result.success, `Expected ${note} to be valid`).toBe(true);
    }
  });

  it('should accept valid MIDI note numbers', () => {
    const validNumbers = [0, 36, 60, 127];
    for (const num of validNumbers) {
      const result = MidiNoteSchema.safeParse(num);
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid note names', () => {
    const invalidNotes = ['H2', 'C', '2C', 'CC2', 'C##2'];
    for (const note of invalidNotes) {
      const result = MidiNoteSchema.safeParse(note);
      expect(result.success, `Expected ${note} to be invalid`).toBe(false);
    }
  });

  it('should reject MIDI note numbers out of range', () => {
    const invalid = [-1, 128, 200];
    for (const num of invalid) {
      const result = MidiNoteSchema.safeParse(num);
      expect(result.success).toBe(false);
    }
  });
});

describe('DrumKitTemplateSchema', () => {
  const validDrumKit = {
    format: 'sampler-template' as const,
    device: 's330' as const,
    version: 1,
    type: 'drum-kit' as const,
    name: '808 Kit',
    description: 'Classic 808 drum kit',
    kit: [
      { name: 'Kick', key: 'C2', tone: 'kick_808' },
      { name: 'Snare', key: 38, tone: 'snare_808' },
      { name: 'Hi-Hat', key: 'F#2', tone: 'hihat_808', muteGroup: 1 },
    ],
  };

  it('should validate a complete drum kit template', () => {
    const result = DrumKitTemplateSchema.safeParse(validDrumKit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('808 Kit');
      expect(result.data.kit).toHaveLength(3);
    }
  });

  it('should accept kit entries with note names', () => {
    const result = DrumKitTemplateSchema.safeParse(validDrumKit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kit[0]?.key).toBe('C2');
    }
  });

  it('should accept kit entries with MIDI numbers', () => {
    const result = DrumKitTemplateSchema.safeParse(validDrumKit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kit[1]?.key).toBe(38);
    }
  });

  it('should reject empty kit', () => {
    const invalid = { ...validDrumKit, kit: [] };
    const result = DrumKitTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject kit entry without tone reference', () => {
    const invalid = {
      ...validDrumKit,
      kit: [{ name: 'Kick', key: 'C2', tone: '' }],
    };
    const result = DrumKitTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept kit entry with optional fields', () => {
    const kitWithOptions = {
      ...validDrumKit,
      kit: [
        {
          name: 'Kick',
          key: 'C2',
          tone: 'kick_808',
          muteGroup: 1,
          level: 100,
          pan: -20,
        },
      ],
    };
    const result = DrumKitTemplateSchema.safeParse(kitWithOptions);
    expect(result.success).toBe(true);
  });

  it('should reject invalid mute group', () => {
    const invalid = {
      ...validDrumKit,
      kit: [{ name: 'HH', key: 42, tone: 'hihat', muteGroup: 20 }], // Max is 16
    };
    const result = DrumKitTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('DrumKitEntrySchema', () => {
  it('should validate entry with pan as center', () => {
    const entry = {
      name: 'Kick',
      key: 'C2',
      tone: 'kick_808',
      pan: 'center',
    };
    const result = DrumKitEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should validate entry with numeric pan', () => {
    const entry = {
      name: 'Kick',
      key: 'C2',
      tone: 'kick_808',
      pan: -32,
    };
    const result = DrumKitEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });
});

describe('VelocityLayerTemplateSchema', () => {
  const validVelocityLayer = {
    format: 'sampler-template' as const,
    device: 's330' as const,
    version: 1,
    type: 'velocity-layer' as const,
    name: 'Piano Layers',
    keyRange: [36, 96] as [number, number],
    velocityLayers: [
      { range: [1, 31] as [number, number], tone: 'piano_pp' },
      { range: [32, 63] as [number, number], tone: 'piano_p' },
      { range: [64, 95] as [number, number], tone: 'piano_mf' },
      { range: [96, 127] as [number, number], tone: 'piano_ff' },
    ],
  };

  it('should validate a complete velocity layer template', () => {
    const result = VelocityLayerTemplateSchema.safeParse(validVelocityLayer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Piano Layers');
      expect(result.data.velocityLayers).toHaveLength(4);
    }
  });

  it('should reject velocity layers that do not start at 1', () => {
    const invalid = {
      ...validVelocityLayer,
      velocityLayers: [
        { range: [10, 63] as [number, number], tone: 'piano_p' }, // Starts at 10
        { range: [64, 127] as [number, number], tone: 'piano_f' },
      ],
    };
    const result = VelocityLayerTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject velocity layers that do not end at 127', () => {
    const invalid = {
      ...validVelocityLayer,
      velocityLayers: [
        { range: [1, 63] as [number, number], tone: 'piano_p' },
        { range: [64, 100] as [number, number], tone: 'piano_f' }, // Ends at 100
      ],
    };
    const result = VelocityLayerTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject velocity layers with gaps', () => {
    const invalid = {
      ...validVelocityLayer,
      velocityLayers: [
        { range: [1, 50] as [number, number], tone: 'piano_p' },
        { range: [60, 127] as [number, number], tone: 'piano_f' }, // Gap: 51-59
      ],
    };
    const result = VelocityLayerTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should accept single velocity layer covering full range', () => {
    const single = {
      ...validVelocityLayer,
      velocityLayers: [
        { range: [1, 127] as [number, number], tone: 'piano' },
      ],
    };
    const result = VelocityLayerTemplateSchema.safeParse(single);
    expect(result.success).toBe(true);
  });

  it('should reject empty velocity layers', () => {
    const invalid = { ...validVelocityLayer, velocityLayers: [] };
    const result = VelocityLayerTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject invalid key range', () => {
    const invalid = {
      ...validVelocityLayer,
      keyRange: [96, 36] as [number, number], // Invalid: low > high
    };
    const result = VelocityLayerTemplateSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('TemplateYamlSchema (discriminated union)', () => {
  it('should correctly discriminate drum-kit type', () => {
    const drumKit = {
      format: 'sampler-template',
      device: 's330',
      version: 1,
      type: 'drum-kit',
      name: 'Kit',
      kit: [{ name: 'Kick', key: 36, tone: 'kick' }],
    };
    const result = TemplateYamlSchema.safeParse(drumKit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('drum-kit');
    }
  });

  it('should correctly discriminate velocity-layer type', () => {
    const velocityLayer = {
      format: 'sampler-template',
      device: 's330',
      version: 1,
      type: 'velocity-layer',
      name: 'Layers',
      keyRange: [36, 96],
      velocityLayers: [{ range: [1, 127], tone: 'piano' }],
    };
    const result = TemplateYamlSchema.safeParse(velocityLayer);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('velocity-layer');
    }
  });

  it('should reject unknown template type', () => {
    const invalid = {
      format: 'sampler-template',
      device: 's330',
      version: 1,
      type: 'unknown-type',
      name: 'Test',
    };
    const result = TemplateYamlSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
