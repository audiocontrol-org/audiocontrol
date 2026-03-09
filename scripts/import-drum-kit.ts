#!/usr/bin/env tsx
/**
 * Import Drum Kit to S-330
 *
 * Imports WAV files from a drum kit directory to a physical S-330 device via MIDI.
 *
 * Usage:
 *   tsx scripts/import-drum-kit.ts <path-to-drum-kit> [options]
 *
 * Example:
 *   tsx scripts/import-drum-kit.ts ~/Documents/AudioTools/library/s330/drum-kits/KIT\ 01
 *   tsx scripts/import-drum-kit.ts ./my-kit --original-key 72 --starting-tone 0
 *
 * @packageDocumentation
 */

import * as path from 'path';
import * as easymidi from 'easymidi';
import { createS330Client } from '../modules/sampler-midi/src/client/client-roland-s330.js';
import {
  createEasymidiAdapter,
  findMidiPort,
} from '../modules/sampler-midi/src/client/s330-easymidi-adapter.js';
import type { S330Client } from '../modules/sampler-midi/src/client/client-roland-s330.js';
import {
  importDrumKit,
  type DrumKitImportConfig,
  type DrumSampleInput,
} from '../modules/sampler-devices/src/devices/s330/drum-kit-import-service.js';
import { convertDrumKit, type ConvertedDrumKit, loadWavFile } from './lib/drum-kit-converter.js';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_MIDI_DEVICE = process.env.MIDI_DEVICE_NAME || 'Volt 4';
const DEFAULT_DEVICE_ID = 0;
const DEFAULT_TIMEOUT_MS = 10000;

const DEFAULT_STARTING_TONE_SLOT = 0;
const DEFAULT_WAVE_BANK = 0; // Bank A
const DEFAULT_STARTING_SEGMENT = 0;
const DEFAULT_STARTING_PATCH_SLOT = 0;
const DEFAULT_ORIGINAL_KEY = 60; // C4

// =============================================================================
// CLI Options
// =============================================================================

interface ImportOptions {
  kitPath: string;
  midiDevice: string;
  deviceId: number;
  timeoutMs: number;
  startingToneSlot: number;
  waveBank: 0 | 1;
  startingSegment: number;
  startingPatchSlot: number;
  originalKey: number;
  singlePatch: boolean;
  patchName: string;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
}

function printUsage(): void {
  console.log(`
Usage: tsx scripts/import-drum-kit.ts <path-to-drum-kit> [options]

Options:
  --midi-device <name>    MIDI device name (default: "${DEFAULT_MIDI_DEVICE}")
  --device-id <n>         S-330 device ID (default: ${DEFAULT_DEVICE_ID})
  --starting-tone <n>     Starting tone slot 0-31 (default: ${DEFAULT_STARTING_TONE_SLOT})
  --wave-bank <n>         Wave bank 0=A, 1=B (default: ${DEFAULT_WAVE_BANK})
  --starting-segment <n>  Starting segment (default: ${DEFAULT_STARTING_SEGMENT})
  --starting-patch <n>    Starting patch slot 0-15 (default: ${DEFAULT_STARTING_PATCH_SLOT})
  --original-key <n>      Original key MIDI note (default: ${DEFAULT_ORIGINAL_KEY} = C4)
  --single-patch          Create one patch with all samples mapped (default: one patch per sample)
  --patch-name <name>     Name for the single patch (default: kit directory name, max 12 chars)
  --dry-run               Show what would be imported without sending to device
  --verbose, -v           Show detailed progress
  --help, -h              Show this help message

Environment Variables:
  MIDI_DEVICE_NAME        Override default MIDI device name

Examples:
  # Import drum kit with defaults (one patch per sample)
  tsx scripts/import-drum-kit.ts ~/Documents/AudioTools/library/s330/drum-kits/KIT\\ 01

  # Import with single patch containing all samples
  tsx scripts/import-drum-kit.ts ./my-kit --single-patch --patch-name "MYDRUMS"

  # Import with custom original key (C5 = 72)
  tsx scripts/import-drum-kit.ts ./my-kit --original-key 72

  # Dry run to see what would be imported
  tsx scripts/import-drum-kit.ts ./my-kit --dry-run --verbose

  # Import to specific tone/patch slots
  tsx scripts/import-drum-kit.ts ./my-kit --starting-tone 4 --starting-patch 4
`);
}

function parseArgs(args: string[]): ImportOptions {
  const options: ImportOptions = {
    kitPath: '',
    midiDevice: DEFAULT_MIDI_DEVICE,
    deviceId: DEFAULT_DEVICE_ID,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    startingToneSlot: DEFAULT_STARTING_TONE_SLOT,
    waveBank: DEFAULT_WAVE_BANK,
    startingSegment: DEFAULT_STARTING_SEGMENT,
    startingPatchSlot: DEFAULT_STARTING_PATCH_SLOT,
    originalKey: DEFAULT_ORIGINAL_KEY,
    singlePatch: false,
    patchName: '',
    dryRun: false,
    verbose: false,
    help: false,
  };

  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--midi-device') {
      const value = args[++i];
      if (!value) {
        console.error('--midi-device requires a device name');
        process.exit(1);
      }
      options.midiDevice = value;
    } else if (arg === '--device-id') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--device-id requires a number (0-15)');
        process.exit(1);
      }
      options.deviceId = parseInt(value, 10);
    } else if (arg === '--starting-tone') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--starting-tone requires a number (0-31)');
        process.exit(1);
      }
      options.startingToneSlot = parseInt(value, 10);
    } else if (arg === '--wave-bank') {
      const value = args[++i];
      if (!value || !['0', '1'].includes(value)) {
        console.error('--wave-bank requires 0 (Bank A) or 1 (Bank B)');
        process.exit(1);
      }
      options.waveBank = parseInt(value, 10) as 0 | 1;
    } else if (arg === '--starting-segment') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--starting-segment requires a number (0-17)');
        process.exit(1);
      }
      options.startingSegment = parseInt(value, 10);
    } else if (arg === '--starting-patch') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--starting-patch requires a number (0-15)');
        process.exit(1);
      }
      options.startingPatchSlot = parseInt(value, 10);
    } else if (arg === '--original-key') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--original-key requires a MIDI note number (0-127)');
        process.exit(1);
      }
      options.originalKey = parseInt(value, 10);
    } else if (arg === '--single-patch') {
      options.singlePatch = true;
    } else if (arg === '--patch-name') {
      const value = args[++i];
      if (!value) {
        console.error('--patch-name requires a name (max 12 characters)');
        process.exit(1);
      }
      options.patchName = value;
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  if (positionalArgs.length > 0) {
    options.kitPath = positionalArgs[0]!;
  }

  return options;
}

// =============================================================================
// MIDI Setup
// =============================================================================

function setupMidi(deviceName: string, deviceId: number, timeoutMs: number): {
  input: easymidi.Input;
  output: easymidi.Output;
  client: S330Client;
} {
  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();

  console.log('Available MIDI inputs:', inputs.join(', '));
  console.log('Available MIDI outputs:', outputs.join(', '));

  const inputPort = findMidiPort(inputs, deviceName);
  const outputPort = findMidiPort(outputs, deviceName);

  if (!inputPort || !outputPort) {
    throw new Error(
      `MIDI device "${deviceName}" not found.\n` +
        `Available inputs: ${inputs.join(', ')}\n` +
        `Available outputs: ${outputs.join(', ')}`
    );
  }

  console.log(`Opening MIDI input: ${inputPort}`);
  console.log(`Opening MIDI output: ${outputPort}`);

  const input = new easymidi.Input(inputPort);
  const output = new easymidi.Output(outputPort);

  const midiIO = createEasymidiAdapter(input, output);
  const client = createS330Client(midiIO, { deviceId, timeoutMs });

  return { input, output, client };
}

// =============================================================================
// Conversion
// =============================================================================

function prepareSamplesForImport(
  kitPath: string,
  converted: ConvertedDrumKit
): DrumSampleInput[] {
  const samples: DrumSampleInput[] = [];

  for (const sample of converted.samples) {
    const filePath = path.join(kitPath, sample.filename);
    const { buffer } = loadWavFile(filePath);

    samples.push({
      wavData: buffer,
      drumType: sample.drumType as 'kick' | 'snare' | 'hhClosed' | 'hhOpen',
      kitNumber: sample.kitNumber,
      midiNote: sample.midiNote,
    });
  }

  return samples;
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help || !options.kitPath) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  console.log('='.repeat(60));
  console.log('S-330 Drum Kit Import');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Convert the drum kit
  console.log(`Converting drum kit: ${options.kitPath}`);
  const converted = convertDrumKit(options.kitPath);

  if (converted.errors.length > 0) {
    console.error('\nConversion errors:');
    for (const error of converted.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(`  Name: ${converted.name}`);
  console.log(`  Sample Rate: ${converted.sampleRate}Hz`);
  console.log(`  Samples: ${converted.samples.length}`);
  console.log(`  Total Segments: ${converted.totalSegments}`);
  console.log();

  if (options.verbose) {
    console.log('Samples:');
    for (const sample of converted.samples) {
      console.log(`  ${sample.filename}:`);
      console.log(`    Type: ${sample.drumType} (kit ${sample.kitNumber})`);
      console.log(`    MIDI Note: ${sample.midiNote}`);
      console.log(`    Source: ${sample.source.sampleRate}Hz, ${sample.source.sampleCount} samples`);
      console.log(`    Output: ${sample.output.sampleRate}Hz, ${sample.output.sampleCount} samples`);
      console.log(`    Segments: ${sample.output.segmentsNeeded}`);
    }
    console.log();
  }

  // Step 2: Show import configuration
  console.log('Import Configuration:');
  console.log(`  Starting Tone Slot: ${options.startingToneSlot} (T${options.startingToneSlot + 11})`);
  console.log(`  Wave Bank: ${options.waveBank === 0 ? 'A' : 'B'}`);
  console.log(`  Starting Segment: ${options.startingSegment}`);
  console.log(`  Starting Patch Slot: ${options.startingPatchSlot} (P${options.startingPatchSlot + 1})`);
  console.log(`  Original Key: ${options.originalKey} (MIDI note)`);
  console.log(`  Patch Mode: ${options.singlePatch ? 'Single patch' : 'One patch per sample'}`);
  if (options.singlePatch) {
    const patchName = options.patchName || converted.name;
    console.log(`  Patch Name: ${patchName}`);
  }
  console.log();

  // Step 3: Show what will be created
  console.log('Will create:');
  for (let i = 0; i < converted.samples.length; i++) {
    const sample = converted.samples[i]!;
    const toneSlot = options.startingToneSlot + i;
    console.log(`  Tone ${toneSlot} (T${toneSlot + 11}): ${sample.drumType} ${sample.kitNumber}`);
  }
  if (options.singlePatch) {
    const patchName = options.patchName || converted.name;
    console.log(`  Patch ${options.startingPatchSlot} (P${options.startingPatchSlot + 1}): "${patchName}" with mappings:`);
    for (let i = 0; i < converted.samples.length; i++) {
      const sample = converted.samples[i]!;
      const toneSlot = options.startingToneSlot + i;
      console.log(`    MIDI note ${sample.midiNote} -> tone ${toneSlot}`);
    }
  } else {
    for (let i = 0; i < converted.samples.length; i++) {
      const sample = converted.samples[i]!;
      const toneSlot = options.startingToneSlot + i;
      const patchSlot = options.startingPatchSlot + i;
      console.log(`  Patch ${patchSlot} (P${patchSlot + 1}): maps MIDI note ${sample.midiNote} -> tone ${toneSlot}`);
    }
  }
  console.log();

  if (options.dryRun) {
    console.log('Dry run mode - skipping device upload');
    process.exit(0);
  }

  // Step 4: Setup MIDI
  console.log('Setting up MIDI connection...');
  let input: easymidi.Input | null = null;
  let output: easymidi.Output | null = null;
  let client: S330Client | null = null;

  try {
    const midi = setupMidi(options.midiDevice, options.deviceId, options.timeoutMs);
    input = midi.input;
    output = midi.output;
    client = midi.client;

    console.log('Connecting to S-330...');
    const connected = await client.connect();
    if (!connected) {
      throw new Error('Failed to connect to S-330');
    }
    console.log('Connected!\n');

    // Step 5: Prepare samples
    const samples = prepareSamplesForImport(options.kitPath, converted);

    const config: DrumKitImportConfig = {
      samples,
      sampleRate: converted.sampleRate,
      startingToneSlot: options.startingToneSlot,
      waveBank: options.waveBank,
      startingSegment: options.startingSegment,
      startingPatchSlot: options.startingPatchSlot,
      originalKey: options.originalKey,
      singlePatch: options.singlePatch,
      patchName: options.patchName || converted.name,
    };

    // Step 6: Import
    console.log('Importing drum kit...');
    const result = await importDrumKit(client, config, (current, total, status) => {
      if (options.verbose) {
        console.log(`  [${current}/${total}] ${status}`);
      }
    });

    console.log();
    console.log('='.repeat(60));
    console.log('Import Complete!');
    console.log('='.repeat(60));
    console.log(`  Samples imported: ${result.samples.length}`);
    console.log(`  Segments used: ${result.totalSegments}`);
    console.log();

    for (const sample of result.samples) {
      console.log(`  Tone ${sample.toneSlot} (T${sample.toneSlot + 11}):`);
      console.log(`    Segment: ${sample.segmentTop}, Length: ${sample.segmentLength}`);
      console.log(`    Sample count: ${sample.sampleCount}`);
      console.log(`    Patch: ${sample.patchSlot} (P${sample.patchSlot + 1})`);
    }

  } catch (err) {
    console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    // Cleanup
    client?.disconnect();
    input?.close();
    output?.close();
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
