/**
 * Roland S-330 Drum Kit Import Integration Test
 *
 * Tests the complete drum kit import workflow:
 * 1. Load WAV files from disk
 * 2. Convert to S330 format
 * 3. Upload to device
 * 4. Verify upload by reading back
 *
 * ## Requirements
 * - Physical Roland S-330 connected via MIDI
 * - Drum kit files in ~/Documents/AudioTools/library/s330/drum-kits/KIT 01/
 * - MIDI interface available (default: "Volt 4")
 *
 * ## Running
 * ```bash
 * pnpm test:integration -- s330-drum-kit
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as easymidi from 'easymidi';
import {
  createS330Client,
  createEasymidiAdapter,
  findMidiPort,
  type S330Client,
} from '@audiocontrol/sampler-midi';
import {
  importDrumKit,
  verifyDrumKitImport,
  prepareWavForS330,
  type DrumSampleInput,
  type DrumKitImportConfig,
} from '@audiocontrol/sampler-devices/s330';

// =============================================================================
// Configuration
// =============================================================================

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || 'Volt 4';
const DEVICE_ID = 0;
const TIMEOUT_MS = 10000;

// Drum kit location
const DRUM_KIT_PATH = path.join(
  os.homedir(),
  'Documents/AudioTools/library/s330/drum-kits/KIT 01'
);

// Test targets (use high slots to avoid overwriting user data)
const TEST_STARTING_TONE_SLOT = 28; // T39-T42 (display is slot+11)
const TEST_WAVE_BANK = 0; // Bank A
const TEST_STARTING_SEGMENT = 10; // Leaves room for 5+ segments (needs 14, 15, 16, 17 max)
const TEST_STARTING_PATCH_SLOT = 12; // P13-P16

// MIDI note mapping (C2 = 36 for kick)
const BASE_MIDI_NOTE = 36;

// =============================================================================
// Test State
// =============================================================================

let input: easymidi.Input | null = null;
let output: easymidi.Output | null = null;
let client: S330Client | null = null;

// =============================================================================
// Setup/Teardown
// =============================================================================

function setupMidi(): void {
  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  console.log('Available MIDI inputs:', inputs);
  console.log('Available MIDI outputs:', outputs);

  const inputPort = findMidiPort(inputs, MIDI_DEVICE_NAME);
  const outputPort = findMidiPort(outputs, MIDI_DEVICE_NAME);

  if (!inputPort || !outputPort) {
    throw new Error(
      `MIDI device "${MIDI_DEVICE_NAME}" not found.\n` +
        `Available inputs: ${inputs.join(', ')}\n` +
        `Available outputs: ${outputs.join(', ')}`
    );
  }

  console.log(`Opening MIDI input: ${inputPort}`);
  console.log(`Opening MIDI output: ${outputPort}`);

  input = new easymidi.Input(inputPort);
  output = new easymidi.Output(outputPort);

  const midiIO = createEasymidiAdapter(input, output);
  client = createS330Client(midiIO, { deviceId: DEVICE_ID, timeoutMs: TIMEOUT_MS });
}

function teardownMidi(): void {
  client?.disconnect();
  input?.close();
  output?.close();
  input = null;
  output = null;
  client = null;
}

/**
 * Load drum kit samples from disk.
 */
function loadDrumKitSamples(): DrumSampleInput[] {
  const samples: DrumSampleInput[] = [];
  const drumTypes = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;
  const fileNames = ['KICK 01.wav', 'SNARE 01.wav', 'HHC 01.wav', 'HHO 01.wav'];

  for (let i = 0; i < drumTypes.length; i++) {
    const filePath = path.join(DRUM_KIT_PATH, fileNames[i]!);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Drum kit file not found: ${filePath}`);
    }

    const wavBuffer = fs.readFileSync(filePath);
    const wavData = wavBuffer.buffer.slice(
      wavBuffer.byteOffset,
      wavBuffer.byteOffset + wavBuffer.byteLength
    );

    samples.push({
      wavData,
      drumType: drumTypes[i]!,
      kitNumber: 1,
      midiNote: BASE_MIDI_NOTE + i,
    });

    console.log(`  Loaded ${fileNames[i]}: ${wavBuffer.length} bytes`);
  }

  return samples;
}

// =============================================================================
// Tests
// =============================================================================

describe('S-330 Drum Kit Import', () => {
  const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

  beforeAll(() => {
    if (shouldSkip) {
      console.log('⏭️  Skipping hardware tests (SKIP_HARDWARE_TESTS=true)');
      return;
    }

    // Check drum kit exists
    if (!fs.existsSync(DRUM_KIT_PATH)) {
      console.log(`⏭️  Skipping: Drum kit not found at ${DRUM_KIT_PATH}`);
      return;
    }

    try {
      setupMidi();
    } catch (error) {
      console.error('⚠️  MIDI setup failed:', error);
      throw error;
    }
  });

  afterAll(() => {
    if (!shouldSkip) {
      teardownMidi();
    }
  });

  describe('WAV to S330 Conversion', () => {
    it('should convert WAV files to S330 format', { skip: shouldSkip }, () => {
      console.log('Loading drum kit samples...');
      const samples = loadDrumKitSamples();

      expect(samples.length).toBe(4);

      for (const sample of samples) {
        const prepared = prepareWavForS330(sample.wavData, 15000);

        console.log(`  ${sample.drumType}:`);
        console.log(`    - WAV bytes: ${sample.wavData.byteLength}`);
        console.log(`    - S330 bytes: ${prepared.data.length}`);
        console.log(`    - Sample count: ${prepared.sampleCount}`);
        console.log(`    - Segments needed: ${prepared.segmentLength}`);

        // Verify conversion produced valid data
        expect(prepared.data.length).toBeGreaterThan(0);
        expect(prepared.sampleCount).toBeGreaterThan(0);
        expect(prepared.segmentLength).toBeGreaterThanOrEqual(1);

        // S330 data should be 2 bytes per sample
        expect(prepared.data.length).toBe(prepared.sampleCount * 2);

        // All bytes should be 7-bit MIDI safe
        for (let i = 0; i < prepared.data.length; i++) {
          expect(prepared.data[i]).toBeLessThan(128);
        }
      }

      console.log('✓ All samples converted successfully');
    });

    it('should calculate correct segment counts', { skip: shouldSkip }, () => {
      const samples = loadDrumKitSamples();

      // At 15kHz, each segment holds 12,000 samples = 0.8 seconds
      // Short drum hits should fit in 1 segment
      for (const sample of samples) {
        const prepared = prepareWavForS330(sample.wavData, 15000);

        // Drum hits are typically < 1 second, so should be 1-2 segments
        expect(prepared.segmentLength).toBeLessThanOrEqual(2);

        // Sample count should match segment capacity
        const maxSamplesInSegments = prepared.segmentLength * 12000;
        expect(prepared.sampleCount).toBeLessThanOrEqual(maxSamplesInSegments);
      }

      console.log('✓ Segment calculations are correct');
    });
  });

  describe('Device Upload', () => {
    it('should connect to S-330', { skip: shouldSkip }, async () => {
      expect(client).toBeDefined();

      const connected = await client!.connect();
      expect(connected).toBe(true);

      console.log('✓ Connected to S-330');
    });

    it(
      'should import drum kit to device',
      { skip: shouldSkip, timeout: 60000 },
      async () => {
        expect(client).toBeDefined();

        console.log('Loading drum kit samples...');
        const samples = loadDrumKitSamples();

        const config: DrumKitImportConfig = {
          samples,
          sampleRate: 15000,
          startingToneSlot: TEST_STARTING_TONE_SLOT,
          waveBank: TEST_WAVE_BANK,
          startingSegment: TEST_STARTING_SEGMENT,
          startingPatchSlot: TEST_STARTING_PATCH_SLOT,
        };

        console.log('Import configuration:');
        console.log(`  - Starting tone slot: ${config.startingToneSlot} (T${config.startingToneSlot + 11})`);
        console.log(`  - Wave bank: ${config.waveBank === 0 ? 'A' : 'B'}`);
        console.log(`  - Starting segment: ${config.startingSegment}`);
        console.log(`  - Starting patch slot: ${config.startingPatchSlot} (P${config.startingPatchSlot + 1})`);
        console.log(`  - Sample rate: ${config.sampleRate} Hz`);

        console.log('\nImporting drum kit...');
        const result = await importDrumKit(client!, config, (current, total, status) => {
          console.log(`  [${current}/${total}] ${status}`);
        });

        expect(result.samples.length).toBe(4);
        expect(result.totalSegments).toBeGreaterThanOrEqual(1);

        console.log(`\n✓ Imported ${result.samples.length} samples using ${result.totalSegments} segments`);

        for (const sample of result.samples) {
          console.log(`  - Tone ${sample.toneSlot} (T${sample.toneSlot + 11}): segment ${sample.segmentTop}, ${sample.segmentLength} segment(s), ${sample.sampleCount} samples`);
        }
      }
    );

    it(
      'should verify imported drum kit',
      { skip: shouldSkip, timeout: 30000 },
      async () => {
        expect(client).toBeDefined();

        // Re-import to get the result (or store it from previous test)
        const samples = loadDrumKitSamples();
        const config: DrumKitImportConfig = {
          samples,
          sampleRate: 15000,
          startingToneSlot: TEST_STARTING_TONE_SLOT,
          waveBank: TEST_WAVE_BANK,
          startingSegment: TEST_STARTING_SEGMENT,
          startingPatchSlot: TEST_STARTING_PATCH_SLOT,
        };

        // For verification, we need to construct what we expect
        // Let's read back the tones and patches directly
        console.log('Verifying imported data...');

        for (let i = 0; i < 4; i++) {
          const toneSlot = TEST_STARTING_TONE_SLOT + i;
          const patchSlot = TEST_STARTING_PATCH_SLOT + i;

          // Read tone
          console.log(`  Reading tone ${toneSlot} (T${toneSlot + 11})...`);
          const tone = await client!.requestToneData(toneSlot);
          expect(tone).not.toBeNull();

          if (tone) {
            console.log(`    Name: "${tone.name}"`);
            console.log(`    Wave bank: ${tone.wave.bank}`);
            console.log(`    Segment top: ${tone.wave.segmentTop}`);
            console.log(`    Segment length: ${tone.wave.segmentLength}`);
            console.log(`    Loop mode: ${tone.loopMode}`);
            console.log(`    End point: ${tone.wave.endPoint}`);

            // Verify tone settings
            expect(tone.wave.bank).toBe(TEST_WAVE_BANK);
            expect(tone.loopMode).toBe('one-shot');
            expect(tone.wave.segmentLength).toBeGreaterThanOrEqual(1);
          }

          // Read patch
          console.log(`  Reading patch ${patchSlot} (P${patchSlot + 1})...`);
          const patch = await client!.requestPatchData(patchSlot);
          expect(patch).not.toBeNull();

          if (patch) {
            console.log(`    Name: "${patch.common.name}"`);

            // Verify patch maps to the correct tone
            const expectedMidiNote = BASE_MIDI_NOTE + i;
            const layerIndex = expectedMidiNote - 21;
            const mappedTone = patch.common.toneLayer1[layerIndex];

            console.log(`    MIDI note ${expectedMidiNote} -> tone ${mappedTone}`);
            expect(mappedTone).toBe(toneSlot);
          }

          // Small delay between reads
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        console.log('✓ All imported data verified successfully');
      }
    );
  });

  describe('Wave Data Verification', () => {
    it(
      'should have wave data at correct segments',
      { skip: shouldSkip, timeout: 30000 },
      async () => {
        expect(client).toBeDefined();

        console.log('Checking wave data at expected segments...');

        // Read wave data from the first imported tone to verify it exists
        const toneSlot = TEST_STARTING_TONE_SLOT;
        const tone = await client!.requestToneData(toneSlot);

        expect(tone).not.toBeNull();
        if (!tone) return;

        console.log(`  Tone ${toneSlot} wave params:`);
        console.log(`    Bank: ${tone.wave.bank}`);
        console.log(`    Segment top: ${tone.wave.segmentTop}`);
        console.log(`    Segment length: ${tone.wave.segmentLength}`);
        console.log(`    Start point: ${tone.wave.startPoint}`);
        console.log(`    End point: ${tone.wave.endPoint}`);

        // Verify segment allocation matches our expectations
        expect(tone.wave.bank).toBe(TEST_WAVE_BANK);
        expect(tone.wave.segmentTop).toBe(TEST_STARTING_SEGMENT);

        // Read a small amount of wave data to verify it's not empty
        console.log('  Requesting wave data sample...');
        const waveData = await client!.requestWaveData(toneSlot);

        if (waveData) {
          console.log(`    Received ${waveData.data.length} bytes`);
          console.log(`    Sample rate: ${waveData.sampleRate}`);

          // Wave data should not be all zeros
          let hasNonZero = false;
          for (let i = 0; i < Math.min(100, waveData.data.length); i++) {
            if (waveData.data[i] !== 0) {
              hasNonZero = true;
              break;
            }
          }

          expect(hasNonZero).toBe(true);
          console.log('    ✓ Wave data contains non-zero samples');
        }

        console.log('✓ Wave data verification complete');
      }
    );
  });
});
