import { describe, it, expect } from 'vitest';
import type { S330Patch } from '@audiocontrol/sampler-devices/s330';
import { s330PatchConverter, createPatchFromKeyGroups } from '@/converters/s330/index.js';
import { PatchYamlSchema } from '@/schemas/index.js';

/**
 * Create a minimal valid S330Patch for testing.
 */
function createTestPatch(overrides: Partial<S330Patch['common']> = {}): S330Patch {
  return {
    common: {
      name: 'TestPatch',
      benderRange: 2,
      aftertouchSens: 64,
      keyMode: 'normal',
      velocityThreshold: 64,
      toneLayer1: new Array(109).fill(-1),
      toneLayer2: new Array(109).fill(0),
      copySource: 0,
      octaveShift: 0,
      level: 100,
      detune: 0,
      velocityMixRatio: 64,
      aftertouchAssign: 'modulation',
      keyAssign: 'rotary',
      outputAssign: 8,
      ...overrides,
    },
  };
}

describe('s330PatchConverter', () => {
  describe('toYaml', () => {
    it('should convert a patch to valid YAML format', () => {
      const patch = createTestPatch();
      const yaml = s330PatchConverter.toYaml(patch);

      expect(yaml.format).toBe('sampler-patch');
      expect(yaml.device).toBe('s330');
      expect(yaml.version).toBe(1);
      expect(yaml.name).toBe('TestPatch');
    });

    it('should produce schema-valid output', () => {
      const patch = createTestPatch();
      const yaml = s330PatchConverter.toYaml(patch);

      const result = PatchYamlSchema.safeParse(yaml);
      expect(result.success).toBe(true);
    });

    it('should include all key modes', () => {
      const modes = ['normal', 'v-sw', 'x-fade', 'v-mix', 'unison'] as const;

      for (const keyMode of modes) {
        const patch = createTestPatch({ keyMode });
        const yaml = s330PatchConverter.toYaml(patch);
        expect(yaml.s330?.keyMode).toBe(keyMode);
      }
    });

    it('should include all aftertouch assignments', () => {
      const assigns = ['modulation', 'volume', 'bend+', 'bend-', 'filter'] as const;

      for (const aftertouchAssign of assigns) {
        const patch = createTestPatch({ aftertouchAssign });
        const yaml = s330PatchConverter.toYaml(patch);
        expect(yaml.s330?.aftertouchAssign).toBe(aftertouchAssign);
      }
    });

    it('should preserve tone layer data', () => {
      const toneLayer1 = new Array(109).fill(-1);
      toneLayer1[15] = 5; // C2 (MIDI 36) -> tone 5
      toneLayer1[17] = 7; // D2 (MIDI 38) -> tone 7

      const patch = createTestPatch({ toneLayer1 });
      const yaml = s330PatchConverter.toYaml(patch);

      expect(yaml.s330?.toneLayer1).toHaveLength(109);
      expect(yaml.s330?.toneLayer1?.[15]).toBe(5);
      expect(yaml.s330?.toneLayer1?.[17]).toBe(7);
    });

    it('should include performance parameters', () => {
      const patch = createTestPatch({
        benderRange: 12,
        octaveShift: -2,
        detune: 10,
        velocityMixRatio: 80,
      });
      const yaml = s330PatchConverter.toYaml(patch);

      expect(yaml.s330?.benderRange).toBe(12);
      expect(yaml.s330?.octaveShift).toBe(-2);
      expect(yaml.s330?.detune).toBe(10);
      expect(yaml.s330?.velocityMixRatio).toBe(80);
    });
  });

  describe('fromYaml', () => {
    it('should convert YAML back to S330Patch', () => {
      const originalPatch = createTestPatch();
      const yaml = s330PatchConverter.toYaml(originalPatch);
      const restored = s330PatchConverter.fromYaml(yaml);

      expect(restored.common.name).toBe(originalPatch.common.name);
      expect(restored.common.level).toBe(originalPatch.common.level);
    });

    it('should restore key modes', () => {
      const modes = ['normal', 'v-sw', 'x-fade', 'v-mix', 'unison'] as const;

      for (const keyMode of modes) {
        const patch = createTestPatch({ keyMode });
        const yaml = s330PatchConverter.toYaml(patch);
        const restored = s330PatchConverter.fromYaml(yaml);
        expect(restored.common.keyMode).toBe(keyMode);
      }
    });

    it('should restore tone layers', () => {
      const toneLayer1 = new Array(109).fill(-1);
      toneLayer1[15] = 3;
      toneLayer1[17] = 8;

      const patch = createTestPatch({ toneLayer1 });
      const yaml = s330PatchConverter.toYaml(patch);
      const restored = s330PatchConverter.fromYaml(yaml);

      expect(restored.common.toneLayer1[15]).toBe(3);
      expect(restored.common.toneLayer1[17]).toBe(8);
    });

    it('should throw for non-s330 YAML', () => {
      const invalidYaml = {
        format: 'sampler-patch' as const,
        device: 'jv1080' as const,
        version: 1,
        name: 'Test',
      };

      expect(() => s330PatchConverter.fromYaml(invalidYaml as any)).toThrow();
    });

    it('should apply defaults for missing optional fields', () => {
      const minimalYaml = {
        format: 'sampler-patch' as const,
        device: 's330' as const,
        version: 1,
        name: 'Minimal',
        s330: {},
      };

      const restored = s330PatchConverter.fromYaml(minimalYaml as any);

      expect(restored.common.benderRange).toBe(2); // default
      expect(restored.common.keyMode).toBe('normal'); // default
      expect(restored.common.aftertouchAssign).toBe('modulation'); // default
    });
  });

  describe('round-trip', () => {
    it('should preserve all fields through conversion', () => {
      const original = createTestPatch({
        name: 'RoundTrip',
        benderRange: 5,
        keyMode: 'v-sw',
        velocityThreshold: 80,
        octaveShift: 1,
        level: 90,
        aftertouchAssign: 'filter',
        keyAssign: 'fix',
      });

      const yaml = s330PatchConverter.toYaml(original);
      const restored = s330PatchConverter.fromYaml(yaml);

      expect(restored.common.name).toBe(original.common.name);
      expect(restored.common.benderRange).toBe(original.common.benderRange);
      expect(restored.common.keyMode).toBe(original.common.keyMode);
      expect(restored.common.velocityThreshold).toBe(original.common.velocityThreshold);
      expect(restored.common.octaveShift).toBe(original.common.octaveShift);
      expect(restored.common.level).toBe(original.common.level);
      expect(restored.common.aftertouchAssign).toBe(original.common.aftertouchAssign);
      expect(restored.common.keyAssign).toBe(original.common.keyAssign);
    });
  });
});

describe('createPatchFromKeyGroups', () => {
  it('should create a patch with correct tone mappings', () => {
    const toneNameToIndex = new Map([
      ['kick', 0],
      ['snare', 1],
      ['hihat', 2],
    ]);

    const patch = createPatchFromKeyGroups(
      'DrumKit',
      [
        { tone: 'kick', keyRange: [36, 36] },
        { tone: 'snare', keyRange: [38, 38] },
        { tone: 'hihat', keyRange: [42, 44] },
      ],
      toneNameToIndex
    );

    expect(patch.common.name).toBe('DrumKit');
    // C2 (36) is index 15 in the layer (36 - 21 = 15)
    expect(patch.common.toneLayer1[15]).toBe(0); // kick
    // D2 (38) is index 17
    expect(patch.common.toneLayer1[17]).toBe(1); // snare
    // F#2-A2 (42-44) are indices 21-23
    expect(patch.common.toneLayer1[21]).toBe(2); // hihat
    expect(patch.common.toneLayer1[22]).toBe(2); // hihat
    expect(patch.common.toneLayer1[23]).toBe(2); // hihat
  });

  it('should support layer 2 assignments', () => {
    const toneNameToIndex = new Map([
      ['soft', 0],
      ['loud', 1],
    ]);

    const patch = createPatchFromKeyGroups(
      'Layers',
      [
        { tone: 'soft', keyRange: [60, 60], layer: 1 },
        { tone: 'loud', keyRange: [60, 60], layer: 2 },
      ],
      toneNameToIndex
    );

    // C4 (60) is index 39 (60 - 21 = 39)
    expect(patch.common.toneLayer1[39]).toBe(0); // soft
    expect(patch.common.toneLayer2[39]).toBe(1); // loud
  });

  it('should throw for unknown tone names', () => {
    const toneNameToIndex = new Map([['kick', 0]]);

    expect(() =>
      createPatchFromKeyGroups(
        'Test',
        [{ tone: 'unknown', keyRange: [36, 36] }],
        toneNameToIndex
      )
    ).toThrow('Tone not found in library: unknown');
  });

  it('should truncate long names to 12 characters', () => {
    const toneNameToIndex = new Map([['kick', 0]]);

    const patch = createPatchFromKeyGroups(
      'ThisNameIsWayTooLong',
      [{ tone: 'kick', keyRange: [36, 36] }],
      toneNameToIndex
    );

    expect(patch.common.name).toBe('ThisNameIsWa');
    expect(patch.common.name.length).toBe(12);
  });

  it('should handle keys outside the valid range gracefully', () => {
    const toneNameToIndex = new Map([['tone', 0]]);

    const patch = createPatchFromKeyGroups(
      'Test',
      [
        { tone: 'tone', keyRange: [10, 20] }, // Below valid range (21-127)
        { tone: 'tone', keyRange: [60, 60] }, // Valid
      ],
      toneNameToIndex
    );

    // Keys below 21 should be ignored
    expect(patch.common.toneLayer1[0]).toBe(-1); // No assignment
    // C4 (60) should be assigned
    expect(patch.common.toneLayer1[39]).toBe(0);
  });
});
