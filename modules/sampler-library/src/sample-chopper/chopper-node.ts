/**
 * Node.js-only sample chopper functions.
 *
 * This file contains functions that require Node.js filesystem
 * and should NOT be imported in browser environments.
 *
 * @packageDocumentation
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';

import { parseWav, createWav } from '@/converters/index.js';
import type { DrumKitBundle } from '@/schemas/drum-kit-bundle-schema.js';

import type {
  SliceConfig,
  DrumKitOutputConfig,
} from '@/sample-chopper/types.js';
import { DEFAULT_BASE_NOTE, DEFAULT_DRUM_TYPES } from '@/sample-chopper/types.js';
import { sliceAudio } from '@/sample-chopper/chopper.js';

/**
 * Map drum type labels to standard filenames.
 */
const DRUM_TYPE_LABELS: Record<string, string> = {
  kick: 'KICK',
  snare: 'SNARE',
  hhc: 'HHC',
  hho: 'HHO',
  hhClosed: 'HHC',
  hhOpen: 'HHO',
  'closed-hat': 'HHC',
  'open-hat': 'HHO',
  hat: 'HHC',
  hihat: 'HHC',
  tom: 'TOM',
  crash: 'CRASH',
  ride: 'RIDE',
};

/**
 * Get the standard label for a drum type.
 */
function getDrumTypeLabel(drumType: string): string {
  const lower = drumType.toLowerCase();
  return DRUM_TYPE_LABELS[lower] ?? drumType.toUpperCase();
}

/**
 * Format a sample filename in the standard convention.
 *
 * @param kitNumber - Kit number (1-based)
 * @param drumType - Drum type label
 * @returns Formatted filename (e.g., "01 KICK.wav")
 */
function formatSampleFilename(kitNumber: number, drumType: string): string {
  const paddedNumber = String(kitNumber).padStart(2, '0');
  const label = drumType.toUpperCase();
  return `${paddedNumber} ${label}.wav`;
}

/**
 * High-level function to chop a WAV file and output a drum kit.
 *
 * Loads the input WAV, slices it according to configuration,
 * and writes the resulting drum kit files to the output directory.
 *
 * NOTE: This function requires Node.js and should not be used in browsers.
 *
 * @param inputWavPath - Path to source WAV file
 * @param outputDir - Output directory for drum kit files
 * @param sliceConfig - Slice configuration (method-specific)
 * @param kitConfig - Drum kit output configuration
 *
 * @example
 * ```typescript
 * await chopSampleToDrumKit(
 *   '/path/to/drums.wav',
 *   '/path/to/output/MY-KIT',
 *   { method: 'transient', threshold: 0.3, minGapMs: 100 },
 *   { name: 'MY-KIT', sampleRate: 15000 }
 * );
 * ```
 */
export async function chopSampleToDrumKit(
  inputWavPath: string,
  outputDir: string,
  sliceConfig: SliceConfig,
  kitConfig: DrumKitOutputConfig
): Promise<void> {
  // Load and parse input WAV
  const wavBytes = await fs.readFile(inputWavPath);
  const wavData = parseWav(wavBytes.buffer);

  console.log(`Loaded: ${inputWavPath}`);
  console.log(`  Sample rate: ${wavData.sampleRate} Hz`);
  console.log(`  Duration: ${(wavData.samples.length / wavData.sampleRate * 1000).toFixed(1)} ms`);
  console.log(`  Samples: ${wavData.samples.length}`);

  // Slice the audio
  const sliceResult = sliceAudio(wavData.samples, wavData.sampleRate, sliceConfig);

  console.log(`\nSliced into ${sliceResult.slices.length} regions using ${sliceConfig.method} method:`);
  for (const slice of sliceResult.slices) {
    const name = slice.name ?? `Slice ${slice.index + 1}`;
    console.log(`  ${slice.index + 1}. ${name}: ${slice.durationMs.toFixed(1)}ms (${slice.samples.length} samples)`);
  }

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Generate drum kit structure
  const drumTypes = kitConfig.drumTypes ?? DEFAULT_DRUM_TYPES;
  const baseNote = kitConfig.baseNote ?? DEFAULT_BASE_NOTE;

  // Write individual WAV files
  for (let i = 0; i < sliceResult.slices.length; i++) {
    const slice = sliceResult.slices[i];
    const kitNumber = Math.floor(i / 4) + 1;
    const sampleIndex = i % 4;
    const label = drumTypes[sampleIndex % drumTypes.length] ?? `sample${sampleIndex + 1}`;
    const filename = formatSampleFilename(kitNumber, getDrumTypeLabel(label));

    const wavBuffer = createWav(slice.samples, wavData.sampleRate);
    const outputPath = path.join(outputDir, filename);

    await fs.writeFile(outputPath, Buffer.from(wavBuffer));
    console.log(`  Wrote: ${filename}`);
  }

  // Create kit.yaml
  const kitYaml: DrumKitBundle = {
    format: 'drum-kit-bundle',
    version: 1,
    name: kitConfig.name,
    sampleRate: kitConfig.sampleRate,
    baseNote: baseNote,
  };

  const yamlContent = yaml.stringify(kitYaml);
  const kitYamlPath = path.join(outputDir, 'kit.yaml');
  await fs.writeFile(kitYamlPath, yamlContent, 'utf-8');
  console.log(`  Wrote: kit.yaml`);

  console.log(`\nDrum kit created at: ${outputDir}`);
  console.log(`Ready for import using existing drum kit workflow.`);
}
