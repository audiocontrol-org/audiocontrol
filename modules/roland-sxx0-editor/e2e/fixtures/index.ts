/**
 * E2E test fixtures for the roland-sxx0-editor.
 *
 * Provides pre-defined tone, patch, and set fixtures that can be used
 * with OPFS populate helpers for e2e testing.
 */

/**
 * Creates a minimal valid WAV file with 16-bit mono PCM silence.
 *
 * @param sampleCount - Number of samples (default 1024 for ~34ms at 30kHz)
 * @param sampleRate - Sample rate in Hz (default 30000)
 * @returns Uint8Array containing valid WAV file bytes
 */
function createMinimalWav(sampleCount = 1024, sampleRate = 30000): Uint8Array {
  const dataSize = sampleCount * 2; // 16-bit = 2 bytes per sample
  const fileSize = 44 + dataSize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, fileSize - 8, true); // file size - 8
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  // Generate a simple sine wave at 440Hz for audibility
  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const amplitude = Math.sin(2 * Math.PI * 440 * t);
    const sample = Math.round(amplitude * 16000); // ~50% volume
    view.setInt16(44 + i * 2, sample, true);
  }

  return new Uint8Array(buffer);
}

// YAML content for basic-sine.yaml
const basicSineToneYaml = `format: sampler-tone
device: s330
version: 1
name: Basic Sine
wave:
  file: basic-sine.wav
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 1000
  loopPoint: 0
s330:
  originalKey: 60
  outputAssign: 0
  transpose: 0
  fineTune: 0
  lfo:
    rate: 0
    sync: false
    delay: 0
    mode: normal
    polarity: false
    offset: 64
  tvf:
    cutoff: 127
    resonance: 0
    keyFollow: 64
    lfoDepth: 0
    egDepth: 0
    egPolarity: normal
    levelCurve: 0
    keyRateFollow: 64
    velRateFollow: 64
    enabled: false
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  tva:
    level: 100
    lfoDepth: 0
    keyRate: 64
    velRate: 64
    levelCurve: 0
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  benderEnabled: true
  aftertouchEnabled: true
  pitchFollow: true`;

// YAML content for basic-patch.yaml
const basicPatchYaml = `format: sampler-patch
device: s330
version: 1
name: Basic Patch
level: 100
keyGroups:
  - name: Basic Sine
    tone: basic-sine
    keyRange: [0, 127]
    velocityRange: [1, 127]
    level: 100
    pan: center
s330:
  benderRange: 2
  aftertouchSens: 64
  keyMode: normal
  velocityThreshold: 64
  octaveShift: 0
  detune: 0
  velocityMixRatio: 64
  aftertouchAssign: modulation
  keyAssign: rotary
  outputAssign: 0`;

// YAML content for test-set/set.yaml
const testSetManifestYaml = `format: sampler-set
device: s330
version: 1
name: Test Set
description: E2E test fixture set
createdAt: "2024-01-01T00:00:00.000Z"
modifiedAt: "2024-01-01T00:00:00.000Z"
tones:
  - slot: 0
    file: T01
    waveAllocation:
      bank: 0
      segmentTop: 0
      segmentLength: 1
patches:
  - slot: 0
    file: P01`;

// YAML content for test-set/tones/T01.yaml
const testSetTone01Yaml = `format: sampler-tone
device: s330
version: 1
name: Test Tone 01
wave:
  file: T01.wav
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 1000
  loopPoint: 0
s330:
  originalKey: 60
  outputAssign: 0
  transpose: 0
  fineTune: 0
  lfo:
    rate: 0
    sync: false
    delay: 0
    mode: normal
    polarity: false
    offset: 64
  tvf:
    cutoff: 127
    resonance: 0
    keyFollow: 64
    lfoDepth: 0
    egDepth: 0
    egPolarity: normal
    levelCurve: 0
    keyRateFollow: 64
    velRateFollow: 64
    enabled: false
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  tva:
    level: 100
    lfoDepth: 0
    keyRate: 64
    velRate: 64
    levelCurve: 0
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  benderEnabled: true
  aftertouchEnabled: true
  pitchFollow: true`;

// YAML content for test-set/patches/P01.yaml
const testSetPatch01Yaml = `format: sampler-patch
device: s330
version: 1
name: Test Patch 01
level: 100
keyGroups:
  - name: Test Tone 01
    tone: T01
    keyRange: [0, 127]
    velocityRange: [1, 127]
    level: 100
    pan: center
s330:
  benderRange: 2
  aftertouchSens: 64
  keyMode: normal
  velocityThreshold: 64
  octaveShift: 0
  detune: 0
  velocityMixRatio: 64
  aftertouchAssign: modulation
  keyAssign: rotary
  outputAssign: 0`;

/**
 * File content entry for fixture population.
 */
export interface FixtureFileContent {
  /** Text content (for YAML files) */
  text?: string;
  /** Binary content (for WAV files) */
  binary?: Uint8Array;
}

/**
 * Directory structure for fixture population.
 */
export interface FixtureDirectory {
  [name: string]: FixtureFileContent | FixtureDirectory;
}

/**
 * Type guard to check if a fixture entry is a file.
 */
export function isFixtureFile(
  entry: FixtureFileContent | FixtureDirectory
): entry is FixtureFileContent {
  return 'text' in entry || 'binary' in entry;
}

/**
 * Test fixtures for e2e tests.
 *
 * Structure mirrors the OPFS library layout:
 * - library/s330/tones/  - Individual tones
 * - library/s330/patches/ - Individual patches
 * - library/s330/sets/   - Complete sets
 */
export const testFixtures = {
  library: {
    s330: {
      tones: {
        'basic-sine.yaml': { text: basicSineToneYaml },
        'basic-sine.wav': { binary: createMinimalWav(1024, 30000) },
      } as FixtureDirectory,
      patches: {
        'basic-patch.yaml': { text: basicPatchYaml },
      } as FixtureDirectory,
      sets: {
        'test-set': {
          'set.yaml': { text: testSetManifestYaml },
          tones: {
            'T01.yaml': { text: testSetTone01Yaml },
            'T01.wav': { binary: createMinimalWav(1024, 30000) },
          } as FixtureDirectory,
          patches: {
            'P01.yaml': { text: testSetPatch01Yaml },
          } as FixtureDirectory,
        } as FixtureDirectory,
      } as FixtureDirectory,
    } as FixtureDirectory,
  } as FixtureDirectory,
};

/**
 * Creates a fresh copy of the test fixtures.
 *
 * Use this when you need independent fixture data that won't be
 * affected by modifications to other copies.
 */
export function createTestFixtures(): typeof testFixtures {
  return {
    library: {
      s330: {
        tones: {
          'basic-sine.yaml': { text: basicSineToneYaml },
          'basic-sine.wav': { binary: createMinimalWav(1024, 30000) },
        },
        patches: {
          'basic-patch.yaml': { text: basicPatchYaml },
        },
        sets: {
          'test-set': {
            'set.yaml': { text: testSetManifestYaml },
            tones: {
              'T01.yaml': { text: testSetTone01Yaml },
              'T01.wav': { binary: createMinimalWav(1024, 30000) },
            },
            patches: {
              'P01.yaml': { text: testSetPatch01Yaml },
            },
          },
        },
      },
    },
  };
}

/**
 * Creates a minimal WAV file with custom parameters.
 *
 * Useful for creating additional test fixtures with different
 * sample counts or rates.
 */
export { createMinimalWav };
