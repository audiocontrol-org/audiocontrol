import { describe, it, expect } from 'vitest';
import type { S330Tone, S330Patch } from '@audiocontrol/sampler-devices/s330';
import {
  deviceStateToSet,
  setToDeviceState,
  validateSetAllocations,
  calculateSetSegmentUsage,
} from '@/converters/s330/set-converter.js';
import type { SetYaml, ToneYaml, PatchYaml } from '@/schemas/index.js';

// Sample S330 tone for testing
function createSampleTone(name: string): S330Tone {
  return {
    name,
    outputAssign: 0,
    sourceTone: 0,
    origSubTone: 0,
    sampleRate: '30kHz',
    originalKey: 60,
    wave: {
      bank: 0,
      segmentTop: 0,
      segmentLength: 2,
      startPoint: 0,
      endPoint: 1000,
      loopPoint: 500,
      loopLength: 500,
    },
    loopMode: 'forward',
    lfo: {
      rate: 0,
      sync: false,
      delay: 0,
      mode: 'normal',
      polarity: false,
      offset: 0,
    },
    transpose: 64,
    fineTune: 0,
    tvf: {
      cutoff: 127,
      resonance: 0,
      keyFollow: 0,
      lfoDepth: 0,
      egDepth: 0,
      egPolarity: 'normal',
      levelCurve: 0,
      keyRateFollow: 0,
      velRateFollow: 0,
      enabled: true,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 6,
        endPoint: 8,
      },
    },
    tva: {
      level: 127,
      lfoDepth: 0,
      keyRate: 0,
      velRate: 0,
      levelCurve: 0,
      envelope: {
        levels: [127, 100, 80, 60, 40, 20, 10, 0],
        rates: [127, 100, 80, 60, 50, 40, 30, 20],
        sustainPoint: 3,
        endPoint: 8,
      },
    },
    benderEnabled: true,
    aftertouchEnabled: true,
    pitchFollow: true,
    recThreshold: 0,
    recPreTrigger: 0,
    loopTune: 0,
    envZoom: 0,
    copySource: 0,
  };
}

// Sample S330 patch for testing
function createSamplePatch(name: string): S330Patch {
  return {
    common: {
      name,
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
    },
  };
}

describe('deviceStateToSet', () => {
  it('should convert device state to set format', () => {
    const tones: (S330Tone | null)[] = Array(32).fill(null);
    const patches: (S330Patch | null)[] = Array(16).fill(null);
    const waveData = new Map<number, { data: Uint8Array; sampleRate: number }>();

    // Add one tone
    tones[0] = createSampleTone('TestTone');
    waveData.set(0, { data: new Uint8Array(1000), sampleRate: 30000 });

    // Add one patch
    patches[0] = createSamplePatch('TestPatch');

    const result = deviceStateToSet('MySet', 'Test description', {
      tones,
      patches,
      waveData,
    });

    expect(result.manifest.format).toBe('sampler-set');
    expect(result.manifest.name).toBe('MySet');
    expect(result.manifest.description).toBe('Test description');
    expect(result.manifest.tones).toHaveLength(1);
    expect(result.manifest.patches).toHaveLength(1);
    expect(result.tones.size).toBe(1);
    expect(result.patches.size).toBe(1);
  });

  it('should include wave allocation in manifest', () => {
    const tones: (S330Tone | null)[] = Array(32).fill(null);
    const patches: (S330Patch | null)[] = Array(16).fill(null);
    const waveData = new Map<number, { data: Uint8Array; sampleRate: number }>();

    const tone = createSampleTone('TestTone');
    tone.wave.bank = 1;
    tone.wave.segmentTop = 5;
    tone.wave.segmentLength = 3;
    tones[0] = tone;
    waveData.set(0, { data: new Uint8Array(1000), sampleRate: 30000 });

    const result = deviceStateToSet('MySet', undefined, { tones, patches, waveData });

    expect(result.manifest.tones[0]?.waveAllocation).toEqual({
      bank: 1,
      segmentTop: 5,
      segmentLength: 3,
    });
  });

  it('should skip tones without wave data', () => {
    const tones: (S330Tone | null)[] = Array(32).fill(null);
    tones[0] = createSampleTone('TestTone');
    // No wave data for slot 0

    const result = deviceStateToSet('MySet', undefined, {
      tones,
      patches: Array(16).fill(null),
      waveData: new Map(),
    });

    expect(result.manifest.tones).toHaveLength(0);
    expect(result.tones.size).toBe(0);
  });

  it('should handle multiple tones and patches', () => {
    const tones: (S330Tone | null)[] = Array(32).fill(null);
    const patches: (S330Patch | null)[] = Array(16).fill(null);
    const waveData = new Map<number, { data: Uint8Array; sampleRate: number }>();

    // Add multiple tones
    for (let i = 0; i < 5; i++) {
      const tone = createSampleTone(`Tone${i}`);
      tone.wave.segmentTop = i * 2;
      tones[i] = tone;
      waveData.set(i, { data: new Uint8Array(500), sampleRate: 30000 });
    }

    // Add multiple patches
    for (let i = 0; i < 3; i++) {
      patches[i] = createSamplePatch(`Patch${i}`);
    }

    const result = deviceStateToSet('MultiSet', undefined, {
      tones,
      patches,
      waveData,
    });

    expect(result.manifest.tones).toHaveLength(5);
    expect(result.manifest.patches).toHaveLength(3);
    expect(result.tones.size).toBe(5);
    expect(result.patches.size).toBe(3);
  });

  it('should sort entries by slot', () => {
    const tones: (S330Tone | null)[] = Array(32).fill(null);
    const patches: (S330Patch | null)[] = Array(16).fill(null);
    const waveData = new Map<number, { data: Uint8Array; sampleRate: number }>();

    // Add tones in non-sequential order
    tones[5] = createSampleTone('Tone5');
    tones[2] = createSampleTone('Tone2');
    tones[8] = createSampleTone('Tone8');
    waveData.set(5, { data: new Uint8Array(100), sampleRate: 30000 });
    waveData.set(2, { data: new Uint8Array(100), sampleRate: 30000 });
    waveData.set(8, { data: new Uint8Array(100), sampleRate: 30000 });

    const result = deviceStateToSet('Sorted', undefined, { tones, patches, waveData });

    expect(result.manifest.tones[0]?.slot).toBe(2);
    expect(result.manifest.tones[1]?.slot).toBe(5);
    expect(result.manifest.tones[2]?.slot).toBe(8);
  });
});

describe('setToDeviceState', () => {
  it('should convert set to device state', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'TestSet',
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 2 } },
      ],
      patches: [
        { slot: 0, file: 'P01' },
      ],
    };

    const toneYaml: ToneYaml = {
      format: 'sampler-tone',
      device: 's330',
      version: 1,
      name: 'TestTone',
      wave: {
        file: 'T01.wav',
        sampleRate: 30000,
        loopMode: 'forward',
        loopPoint: 0,
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

    const patchYaml: PatchYaml = {
      format: 'sampler-patch',
      device: 's330',
      version: 1,
      name: 'TestPatch',
      level: 100,
      s330: {
        benderRange: 2,
        keyMode: 'normal',
      },
    };

    const tones = new Map<number, { yaml: ToneYaml; wavData: Uint8Array }>();
    tones.set(0, { yaml: toneYaml, wavData: new Uint8Array(100) });

    const patches = new Map<number, PatchYaml>();
    patches.set(0, patchYaml);

    const result = setToDeviceState({ manifest, tones, patches });

    expect(result.tones.size).toBe(1);
    expect(result.patches.size).toBe(1);
    expect(result.allocations.size).toBe(1);
  });

  it('should apply wave allocation from manifest', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'TestSet',
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 1, segmentTop: 5, segmentLength: 3 } },
      ],
      patches: [],
    };

    const toneYaml: ToneYaml = {
      format: 'sampler-tone',
      device: 's330',
      version: 1,
      name: 'TestTone',
      wave: {
        file: 'T01.wav',
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

    const tones = new Map<number, { yaml: ToneYaml; wavData: Uint8Array }>();
    tones.set(0, { yaml: toneYaml, wavData: new Uint8Array(100) });

    const result = setToDeviceState({ manifest, tones, patches: new Map() });
    const tone = result.tones.get(0);

    expect(tone?.tone.wave.bank).toBe(1);
    expect(tone?.tone.wave.segmentTop).toBe(5);
    expect(tone?.tone.wave.segmentLength).toBe(3);
  });
});

describe('validateSetAllocations', () => {
  it('should return empty array for valid allocations', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'TestSet',
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 2 } },
        { slot: 1, file: 'T02', waveAllocation: { bank: 0, segmentTop: 2, segmentLength: 3 } },
        { slot: 2, file: 'T03', waveAllocation: { bank: 1, segmentTop: 0, segmentLength: 4 } },
      ],
      patches: [],
    };

    const errors = validateSetAllocations(manifest);
    expect(errors).toEqual([]);
  });

  it('should detect overlapping segments in same bank', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'TestSet',
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 3 } },
        { slot: 1, file: 'T02', waveAllocation: { bank: 0, segmentTop: 2, segmentLength: 2 } }, // Overlaps at segment 2
      ],
      patches: [],
    };

    const errors = validateSetAllocations(manifest);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('overlaps');
  });

  it('should detect segment exceeding bank capacity', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'TestSet',
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 16, segmentLength: 5 } }, // Goes past 17
      ],
      patches: [],
    };

    const errors = validateSetAllocations(manifest);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('exceeds');
  });

  it('should allow same segments in different banks', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'TestSet',
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 5 } },
        { slot: 1, file: 'T02', waveAllocation: { bank: 1, segmentTop: 0, segmentLength: 5 } }, // Same position, different bank
      ],
      patches: [],
    };

    const errors = validateSetAllocations(manifest);
    expect(errors).toEqual([]);
  });
});

describe('calculateSetSegmentUsage', () => {
  it('should calculate segment usage per bank', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'TestSet',
      tones: [
        { slot: 0, file: 'T01', waveAllocation: { bank: 0, segmentTop: 0, segmentLength: 3 } },
        { slot: 1, file: 'T02', waveAllocation: { bank: 0, segmentTop: 5, segmentLength: 2 } },
        { slot: 2, file: 'T03', waveAllocation: { bank: 1, segmentTop: 0, segmentLength: 4 } },
      ],
      patches: [],
    };

    const usage = calculateSetSegmentUsage(manifest);

    // Bank 0: segments 0-2 and 5-6, highest used is 7 (5+2)
    expect(usage.bank0).toBe(7);
    // Bank 1: segments 0-3, highest used is 4
    expect(usage.bank1).toBe(4);
  });

  it('should return zeros for empty set', () => {
    const manifest: SetYaml = {
      format: 'sampler-set',
      device: 's330',
      version: 1,
      name: 'EmptySet',
      tones: [],
      patches: [],
    };

    const usage = calculateSetSegmentUsage(manifest);
    expect(usage.bank0).toBe(0);
    expect(usage.bank1).toBe(0);
  });
});
