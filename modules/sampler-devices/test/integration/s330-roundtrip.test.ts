/**
 * S-330 Round-Trip Integration Test
 *
 * Tests the complete import/export workflow with generated sine wave samples:
 * 1. Generate WAV files containing sine waves at known frequencies
 * 2. Import to S-330 device
 * 3. Export (read back) wave data from device
 * 4. Verify exported data contains the expected frequencies
 *
 * This validates the entire data path is working correctly without corruption.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as easymidi from 'easymidi';
import {
  createS330Client,
  createEasymidiAdapter,
  findMidiPort,
  type S330Client,
} from '@audiocontrol/sampler-midi';
import {
  importDrumKit,
  prepareWavForS330,
  createWav,
  parseWav,
  s330ToWav,
  type DrumSampleInput,
  type DrumKitImportConfig,
} from '@audiocontrol/sampler-devices/s330';

// =============================================================================
// Configuration
// =============================================================================

const MIDI_DEVICE_NAME = process.env.MIDI_DEVICE_NAME || 'Volt 4';
const DEVICE_ID = 0;
const TIMEOUT_MS = 10000;

// Test targets - use slots that won't interfere with user data
const TEST_STARTING_TONE_SLOT = 24;
const TEST_WAVE_BANK = 0; // Bank A
const TEST_STARTING_SEGMENT = 6;
const TEST_STARTING_PATCH_SLOT = 8;

// Sample generation parameters
const SOURCE_SAMPLE_RATE = 44100; // Generate at CD quality
const TARGET_SAMPLE_RATE = 15000; // Import at 15kHz
const SAMPLE_DURATION_MS = 200; // Short samples for quick testing

// Test frequencies - each drum gets a distinct frequency
const TEST_FREQUENCIES = {
  kick: 100, // Low frequency for kick
  snare: 250, // Mid frequency for snare
  hhClosed: 1000, // High frequency for closed hi-hat
  hhOpen: 2000, // Higher frequency for open hi-hat
};

// Frequency detection tolerance (percentage)
const FREQUENCY_TOLERANCE = 0.15; // 15% tolerance due to 12-bit quantization and resampling

// =============================================================================
// Sine Wave Generation
// =============================================================================

/**
 * Generate a sine wave at the specified frequency.
 */
function generateSineWave(
  frequency: number,
  sampleRate: number,
  durationMs: number,
  amplitude: number = 0.8
): Int16Array {
  const sampleCount = Math.floor((sampleRate * durationMs) / 1000);
  const samples = new Int16Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const value = Math.sin(2 * Math.PI * frequency * t) * amplitude;
    samples[i] = Math.round(value * 32767);
  }

  return samples;
}

/**
 * Create a WAV file buffer containing a sine wave.
 */
function createSineWaveWav(
  frequency: number,
  sampleRate: number,
  durationMs: number
): ArrayBuffer {
  const samples = generateSineWave(frequency, sampleRate, durationMs);
  return createWav(samples, sampleRate);
}

// =============================================================================
// Frequency Detection
// =============================================================================

/**
 * Detect the dominant frequency in audio samples using autocorrelation.
 *
 * This is a simple pitch detection algorithm that works well for pure tones.
 */
function detectFrequency(samples: Int16Array, sampleRate: number): number {
  const minPeriod = Math.floor(sampleRate / 4000); // Max 4kHz
  const maxPeriod = Math.floor(sampleRate / 50); // Min 50Hz

  // Use only the middle portion to avoid edge effects
  const startSample = Math.floor(samples.length * 0.1);
  const endSample = Math.floor(samples.length * 0.9);
  const windowSize = endSample - startSample;

  if (windowSize < maxPeriod * 2) {
    throw new Error('Sample too short for frequency detection');
  }

  // Find the period with highest autocorrelation
  let bestPeriod = minPeriod;
  let bestCorrelation = -Infinity;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let correlation = 0;
    let count = 0;

    for (let i = startSample; i < endSample - period; i++) {
      correlation += samples[i] * samples[i + period];
      count++;
    }

    correlation /= count;

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestPeriod = period;
    }
  }

  return sampleRate / bestPeriod;
}

/**
 * Alternative frequency detection using zero-crossing rate.
 * More robust for lower frequencies.
 */
function detectFrequencyZeroCrossing(
  samples: Int16Array,
  sampleRate: number
): number {
  let zeroCrossings = 0;

  // Use middle portion of samples
  const startSample = Math.floor(samples.length * 0.1);
  const endSample = Math.floor(samples.length * 0.9);

  for (let i = startSample; i < endSample - 1; i++) {
    if (
      (samples[i] >= 0 && samples[i + 1] < 0) ||
      (samples[i] < 0 && samples[i + 1] >= 0)
    ) {
      zeroCrossings++;
    }
  }

  const duration = (endSample - startSample) / sampleRate;
  // Zero crossings happen twice per cycle
  return zeroCrossings / (2 * duration);
}

/**
 * Detect frequency using both methods and return the average.
 */
function detectFrequencyRobust(
  samples: Int16Array,
  sampleRate: number
): { frequency: number; method: string } {
  try {
    const autocorr = detectFrequency(samples, sampleRate);
    const zeroCross = detectFrequencyZeroCrossing(samples, sampleRate);

    // If both methods agree within 20%, use autocorrelation (more accurate)
    if (Math.abs(autocorr - zeroCross) / autocorr < 0.2) {
      return { frequency: autocorr, method: 'autocorrelation' };
    }

    // If they disagree, use zero-crossing (more robust)
    return { frequency: zeroCross, method: 'zero-crossing' };
  } catch {
    // Fallback to zero-crossing only
    return {
      frequency: detectFrequencyZeroCrossing(samples, sampleRate),
      method: 'zero-crossing-fallback',
    };
  }
}

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
  client = createS330Client(midiIO, {
    deviceId: DEVICE_ID,
    timeoutMs: TIMEOUT_MS,
  });
}

function teardownMidi(): void {
  client?.disconnect();
  input?.close();
  output?.close();
  input = null;
  output = null;
  client = null;
}

// =============================================================================
// Tests
// =============================================================================

describe('S-330 Round-Trip Verification', () => {
  const shouldSkip = process.env.SKIP_HARDWARE_TESTS === 'true';

  beforeAll(() => {
    if (shouldSkip) {
      console.log('Skipping hardware tests (SKIP_HARDWARE_TESTS=true)');
      return;
    }

    try {
      setupMidi();
    } catch (error) {
      console.error('MIDI setup failed:', error);
      throw error;
    }
  });

  afterAll(() => {
    if (!shouldSkip) {
      teardownMidi();
    }
  });

  describe('Sine Wave Generation', () => {
    it('should generate valid sine waves', { skip: shouldSkip }, () => {
      for (const [drumType, frequency] of Object.entries(TEST_FREQUENCIES)) {
        const wavBuffer = createSineWaveWav(
          frequency,
          SOURCE_SAMPLE_RATE,
          SAMPLE_DURATION_MS
        );
        const parsed = parseWav(wavBuffer);

        console.log(`  ${drumType} (${frequency}Hz):`);
        console.log(`    - Sample rate: ${parsed.sampleRate}`);
        console.log(`    - Sample count: ${parsed.samples.length}`);

        // Verify WAV is valid
        expect(parsed.sampleRate).toBe(SOURCE_SAMPLE_RATE);
        expect(parsed.samples.length).toBeGreaterThan(0);

        // Verify frequency can be detected
        const detected = detectFrequencyRobust(
          parsed.samples,
          parsed.sampleRate
        );
        console.log(
          `    - Detected frequency: ${detected.frequency.toFixed(1)}Hz (${detected.method})`
        );

        const error = Math.abs(detected.frequency - frequency) / frequency;
        expect(error).toBeLessThan(0.05); // 5% tolerance for source
      }

      console.log('All sine waves generated and verified');
    });

    it(
      'should convert sine waves to S330 format preserving frequency',
      { skip: shouldSkip },
      () => {
        for (const [drumType, frequency] of Object.entries(TEST_FREQUENCIES)) {
          const wavBuffer = createSineWaveWav(
            frequency,
            SOURCE_SAMPLE_RATE,
            SAMPLE_DURATION_MS
          );

          // Convert to S330 format
          const prepared = prepareWavForS330(wavBuffer, TARGET_SAMPLE_RATE);

          console.log(`  ${drumType} (${frequency}Hz):`);
          console.log(`    - S330 data: ${prepared.data.length} bytes`);
          console.log(`    - Sample count: ${prepared.sampleCount}`);

          // Convert back to PCM
          const recovered = s330ToWav(prepared.data, TARGET_SAMPLE_RATE);

          // Detect frequency in recovered data
          const detected = detectFrequencyRobust(recovered, TARGET_SAMPLE_RATE);
          console.log(
            `    - Recovered frequency: ${detected.frequency.toFixed(1)}Hz (${detected.method})`
          );

          // Verify frequency is preserved through conversion
          const error = Math.abs(detected.frequency - frequency) / frequency;
          console.log(`    - Error: ${(error * 100).toFixed(1)}%`);

          expect(error).toBeLessThan(FREQUENCY_TOLERANCE);
        }

        console.log('S330 format conversion preserves frequencies');
      }
    );
  });

  describe('Device Round-Trip', () => {
    it('should connect to S-330', { skip: shouldSkip }, async () => {
      expect(client).toBeDefined();
      const connected = await client!.connect();
      expect(connected).toBe(true);
      console.log('Connected to S-330');
    });

    it(
      'should import generated sine waves to device',
      { skip: shouldSkip, timeout: 120000 },
      async () => {
        expect(client).toBeDefined();

        // Generate samples
        const drumTypes = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;
        const samples: DrumSampleInput[] = drumTypes.map((drumType, index) => {
          const frequency =
            TEST_FREQUENCIES[drumType as keyof typeof TEST_FREQUENCIES];
          const wavBuffer = createSineWaveWav(
            frequency,
            SOURCE_SAMPLE_RATE,
            SAMPLE_DURATION_MS
          );

          console.log(
            `  Generated ${drumType}: ${frequency}Hz, ${wavBuffer.byteLength} bytes`
          );

          return {
            wavData: wavBuffer,
            drumType,
            kitNumber: 1,
            midiNote: 36 + index, // C2, C#2, D2, D#2
          };
        });

        const config: DrumKitImportConfig = {
          samples,
          sampleRate: TARGET_SAMPLE_RATE,
          startingToneSlot: TEST_STARTING_TONE_SLOT,
          waveBank: TEST_WAVE_BANK,
          startingSegment: TEST_STARTING_SEGMENT,
          startingPatchSlot: TEST_STARTING_PATCH_SLOT,
        };

        console.log('\nImport configuration:');
        console.log(`  - Starting tone slot: ${config.startingToneSlot}`);
        console.log(
          `  - Wave bank: ${config.waveBank === 0 ? 'A' : 'B'}`
        );
        console.log(`  - Starting segment: ${config.startingSegment}`);
        console.log(`  - Sample rate: ${config.sampleRate}Hz`);

        // Import to device
        console.log('\nImporting...');
        const result = await importDrumKit(
          client!,
          config,
          (current, total, status) => {
            console.log(`  [${current}/${total}] ${status}`);
          }
        );

        expect(result.samples.length).toBe(4);
        console.log(
          `\nImported ${result.samples.length} samples using ${result.totalSegments} segments`
        );
      }
    );

    it(
      'should export and verify sine wave frequencies',
      { skip: shouldSkip, timeout: 60000 },
      async () => {
        expect(client).toBeDefined();

        const drumTypes = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;
        const results: Array<{
          drumType: string;
          expectedFreq: number;
          detectedFreq: number;
          error: number;
          passed: boolean;
        }> = [];

        console.log('\nExporting and verifying wave data...\n');

        for (let i = 0; i < drumTypes.length; i++) {
          const drumType = drumTypes[i];
          const toneSlot = TEST_STARTING_TONE_SLOT + i;
          const expectedFreq =
            TEST_FREQUENCIES[drumType as keyof typeof TEST_FREQUENCIES];

          console.log(`  ${drumType} (tone ${toneSlot}):`);
          console.log(`    - Expected frequency: ${expectedFreq}Hz`);

          // Read wave data from device
          const waveResponse = await client!.requestWaveData(toneSlot);

          console.log(`    - Received ${waveResponse.data.length} bytes`);
          console.log(`    - Sample rate: ${waveResponse.sampleRate}Hz`);
          console.log(
            `    - End point: ${waveResponse.endPoint} samples`
          );

          // Convert S330 data back to PCM
          const pcmSamples = s330ToWav(
            waveResponse.data,
            waveResponse.sampleRate
          );

          // Trim to actual sample length (endPoint)
          const trimmedSamples = pcmSamples.slice(0, waveResponse.endPoint);
          console.log(`    - Trimmed to ${trimmedSamples.length} samples`);

          // Detect frequency
          const detected = detectFrequencyRobust(
            trimmedSamples,
            waveResponse.sampleRate
          );
          console.log(
            `    - Detected frequency: ${detected.frequency.toFixed(1)}Hz (${detected.method})`
          );

          const error =
            Math.abs(detected.frequency - expectedFreq) / expectedFreq;
          console.log(`    - Error: ${(error * 100).toFixed(1)}%`);

          const passed = error < FREQUENCY_TOLERANCE;
          console.log(`    - ${passed ? 'PASS' : 'FAIL'}`);

          results.push({
            drumType,
            expectedFreq,
            detectedFreq: detected.frequency,
            error,
            passed,
          });

          // Small delay between reads
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Summary
        console.log('\n--- Round-Trip Verification Summary ---');
        console.log('Sample | Expected | Detected | Error | Status');
        console.log('-------|----------|----------|-------|-------');

        for (const r of results) {
          const status = r.passed ? 'PASS' : 'FAIL';
          console.log(
            `${r.drumType.padEnd(7)}| ${r.expectedFreq.toString().padEnd(9)}| ${r.detectedFreq.toFixed(0).padEnd(9)}| ${(r.error * 100).toFixed(1).padStart(4)}% | ${status}`
          );
        }

        // Assert all passed
        const allPassed = results.every((r) => r.passed);
        expect(allPassed).toBe(true);

        if (allPassed) {
          console.log(
            '\nAll frequencies verified - round-trip successful!'
          );
        } else {
          const failed = results.filter((r) => !r.passed);
          console.log(
            `\n${failed.length} sample(s) failed frequency verification`
          );
        }
      }
    );

    it(
      'should verify no sample corruption by checking signal integrity',
      { skip: shouldSkip, timeout: 60000 },
      async () => {
        expect(client).toBeDefined();

        const drumTypes = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;

        console.log('\nVerifying signal integrity...\n');

        for (let i = 0; i < drumTypes.length; i++) {
          const drumType = drumTypes[i];
          const toneSlot = TEST_STARTING_TONE_SLOT + i;

          // Read wave data from device
          const waveResponse = await client!.requestWaveData(toneSlot);
          const pcmSamples = s330ToWav(
            waveResponse.data,
            waveResponse.sampleRate
          );
          const trimmedSamples = pcmSamples.slice(0, waveResponse.endPoint);

          // Check for signal characteristics
          let maxAmplitude = 0;
          let minAmplitude = 0;
          let zeroCrossings = 0;
          let hasContent = false;

          for (let j = 0; j < trimmedSamples.length; j++) {
            const sample = trimmedSamples[j];
            if (sample > maxAmplitude) maxAmplitude = sample;
            if (sample < minAmplitude) minAmplitude = sample;
            if (Math.abs(sample) > 100) hasContent = true;

            if (j > 0) {
              if (
                (trimmedSamples[j - 1] >= 0 && sample < 0) ||
                (trimmedSamples[j - 1] < 0 && sample >= 0)
              ) {
                zeroCrossings++;
              }
            }
          }

          console.log(`  ${drumType}:`);
          console.log(`    - Max amplitude: ${maxAmplitude}`);
          console.log(`    - Min amplitude: ${minAmplitude}`);
          console.log(`    - Zero crossings: ${zeroCrossings}`);
          console.log(`    - Has content: ${hasContent}`);

          // Verify signal is not corrupted
          expect(hasContent).toBe(true);
          expect(maxAmplitude).toBeGreaterThan(1000); // Should have significant amplitude
          expect(minAmplitude).toBeLessThan(-1000);
          expect(zeroCrossings).toBeGreaterThan(5); // Should have periodic content

          // For a sine wave, peak-to-peak should be roughly symmetric
          const symmetry = Math.abs(maxAmplitude + minAmplitude) / maxAmplitude;
          console.log(`    - Symmetry (0=perfect): ${symmetry.toFixed(3)}`);
          expect(symmetry).toBeLessThan(0.3); // Allow 30% asymmetry due to quantization
        }

        console.log('\nAll signals verified - no corruption detected');
      }
    );

    it(
      'should verify MIDI note to tone mappings via SysEx',
      { skip: shouldSkip, timeout: 60000 },
      async () => {
        expect(client).toBeDefined();

        const drumTypes = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;
        const BASE_MIDI_NOTE = 36; // C2

        console.log('\nVerifying MIDI note to tone mappings via SysEx...\n');

        for (let i = 0; i < drumTypes.length; i++) {
          const drumType = drumTypes[i];
          const expectedToneSlot = TEST_STARTING_TONE_SLOT + i;
          const patchSlot = TEST_STARTING_PATCH_SLOT + i;
          const expectedMidiNote = BASE_MIDI_NOTE + i;

          // Read patch from device
          const patch = await client!.requestPatchData(patchSlot);
          expect(patch).not.toBeNull();

          if (patch) {
            // toneLayer1 maps MIDI notes 21-127 to tone slots
            // Index = midiNote - 21
            const layerIndex = expectedMidiNote - 21;
            const actualToneSlot = patch.common.toneLayer1[layerIndex];

            console.log(`  ${drumType}:`);
            console.log(`    - Patch slot: ${patchSlot}`);
            console.log(`    - Expected MIDI note: ${expectedMidiNote}`);
            console.log(`    - Expected tone slot: ${expectedToneSlot}`);
            console.log(`    - Actual tone slot at layer index ${layerIndex}: ${actualToneSlot}`);

            // Verify the mapping is correct
            expect(actualToneSlot).toBe(expectedToneSlot);

            // Also verify other notes are unmapped (-1)
            let otherMappings = 0;
            for (let j = 0; j < patch.common.toneLayer1.length; j++) {
              if (j !== layerIndex && patch.common.toneLayer1[j] !== -1) {
                otherMappings++;
              }
            }
            console.log(`    - Other mapped notes in patch: ${otherMappings}`);
            // This patch should only have one mapped note
            expect(otherMappings).toBe(0);
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        console.log('\nAll MIDI note mappings verified via SysEx');
      }
    );

    it(
      'should verify MIDI note to tone mappings in exported YAML',
      { skip: shouldSkip, timeout: 60000 },
      async () => {
        expect(client).toBeDefined();

        // Import the patch converter for YAML export
        const { s330PatchConverter } = await import(
          '@audiocontrol/sampler-library'
        );

        const drumTypes = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;
        const BASE_MIDI_NOTE = 36; // C2

        console.log('\nVerifying MIDI note to tone mappings in exported YAML...\n');

        for (let i = 0; i < drumTypes.length; i++) {
          const drumType = drumTypes[i];
          const expectedToneSlot = TEST_STARTING_TONE_SLOT + i;
          const patchSlot = TEST_STARTING_PATCH_SLOT + i;
          const expectedMidiNote = BASE_MIDI_NOTE + i;

          // Read patch from device
          const patch = await client!.requestPatchData(patchSlot);
          expect(patch).not.toBeNull();

          if (patch) {
            // Convert to YAML format using the existing converter
            const patchYaml = s330PatchConverter.toYaml(patch);

            console.log(`  ${drumType}:`);
            console.log(`    - Patch name: "${patchYaml.name}"`);
            console.log(`    - Format: ${patchYaml.format}`);
            console.log(`    - Device: ${patchYaml.device}`);

            // Verify YAML has the s330 extension with toneLayer1
            expect(patchYaml.s330).toBeDefined();
            expect(patchYaml.s330?.toneLayer1).toBeDefined();

            // Check the mapping in the YAML
            const layerIndex = expectedMidiNote - 21;
            const yamlToneSlot = patchYaml.s330?.toneLayer1?.[layerIndex];

            console.log(`    - YAML toneLayer1[${layerIndex}] (MIDI ${expectedMidiNote}): ${yamlToneSlot}`);
            console.log(`    - Expected tone slot: ${expectedToneSlot}`);

            expect(yamlToneSlot).toBe(expectedToneSlot);

            // Verify format is correct for serialization
            expect(patchYaml.format).toBe('sampler-patch');
            expect(patchYaml.device).toBe('s330');
            expect(patchYaml.version).toBe(1);
          }

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        console.log('\nAll MIDI note mappings verified in exported YAML');
      }
    );
  });
});
