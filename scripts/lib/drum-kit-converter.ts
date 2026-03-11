/**
 * Drum Kit Converter
 *
 * Core conversion logic for WAV files to S-330 format.
 * This module is device-independent and can be used for:
 * - Analyzing drum kit WAV files
 * - Converting to S-330 format
 * - Validating conversion results
 *
 * @packageDocumentation
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import {
  parseWav,
  prepareWavForS330,
  type S330WaveSampleRate,
} from '../../modules/sampler-devices/src/devices/s330/s330-wave-format.js';
import {
  loadDrumKitBundle,
  type ResolvedDrumKitBundle,
} from '../../modules/sampler-library/src/drum-kits/drum-kit-parser.js';
import {
  encodeTone,
  encodeSampleRate,
  createDrumTone,
  type S330Tone,
} from '../../modules/sampler-devices/src/devices/s330/index.js';

/**
 * Result of analyzing a single WAV file.
 */
export interface WavAnalysis {
  filename: string;
  source: {
    sampleRate: number;
    bitsPerSample: number;
    channels: number;
    sampleCount: number;
    duration: number;
    fileSize: number;
  };
}

/**
 * Result of converting a single WAV file.
 */
export interface ConvertedSample {
  filename: string;
  drumType: string;
  kitNumber: number;
  midiNote: number;
  source: WavAnalysis['source'];
  output: {
    sampleRate: S330WaveSampleRate;
    sampleCount: number;
    duration: number;
    dataBytes: number;
    segmentsNeeded: number;
  };
  /** The actual converted data */
  data: Uint8Array;
}

/**
 * Result of converting an entire drum kit.
 */
export interface ConvertedDrumKit {
  name: string;
  description?: string;
  sampleRate: S330WaveSampleRate;
  baseNote: number;
  samples: ConvertedSample[];
  totalSegments: number;
  errors: string[];
}

/**
 * Load a WAV file from disk.
 */
export function loadWavFile(filePath: string): { buffer: ArrayBuffer; size: number } {
  const fileBytes = readFileSync(filePath);
  const buffer = fileBytes.buffer.slice(
    fileBytes.byteOffset,
    fileBytes.byteOffset + fileBytes.byteLength
  );
  return { buffer, size: fileBytes.length };
}

/**
 * Analyze a WAV file without converting it.
 */
export function analyzeWav(filePath: string): WavAnalysis {
  const { buffer, size } = loadWavFile(filePath);
  const wavData = parseWav(buffer);

  return {
    filename: basename(filePath),
    source: {
      sampleRate: wavData.sampleRate,
      bitsPerSample: wavData.bitsPerSample,
      channels: wavData.channels,
      sampleCount: wavData.samples.length,
      duration: wavData.samples.length / wavData.sampleRate,
      fileSize: size,
    },
  };
}

/**
 * Convert a single WAV file to S-330 format.
 */
export function convertWav(
  filePath: string,
  targetSampleRate: S330WaveSampleRate,
  metadata: { drumType: string; kitNumber: number; midiNote: number }
): ConvertedSample {
  const { buffer, size } = loadWavFile(filePath);
  const prepared = prepareWavForS330(buffer, targetSampleRate);

  return {
    filename: basename(filePath),
    drumType: metadata.drumType,
    kitNumber: metadata.kitNumber,
    midiNote: metadata.midiNote,
    source: {
      sampleRate: prepared.source.sampleRate,
      bitsPerSample: prepared.source.bitsPerSample,
      channels: prepared.source.channels,
      sampleCount: prepared.source.sampleCount,
      duration: prepared.source.duration,
      fileSize: size,
    },
    output: {
      sampleRate: prepared.sampleRate,
      sampleCount: prepared.sampleCount,
      duration: prepared.sampleCount / prepared.sampleRate,
      dataBytes: prepared.data.length,
      segmentsNeeded: prepared.segmentLength,
    },
    data: prepared.data,
  };
}

/**
 * Load and parse a drum kit directory.
 *
 * Uses auto-detection from filenames. For kit.yaml support,
 * use the sampler-library module directly.
 */
export function loadDrumKitDirectory(kitPath: string): ResolvedDrumKitBundle {
  if (!existsSync(kitPath)) {
    throw new Error(`Drum kit directory not found: ${kitPath}`);
  }

  const files = readdirSync(kitPath).filter((f) => f.toLowerCase().endsWith('.wav'));

  if (files.length === 0) {
    throw new Error(`No WAV files found in: ${kitPath}`);
  }

  // Use auto-detection (kit.yaml parsing would require yaml dependency)
  const directoryName = basename(kitPath);
  return loadDrumKitBundle(null, files, directoryName);
}

/**
 * Convert an entire drum kit directory to S-330 format.
 */
export function convertDrumKit(kitPath: string): ConvertedDrumKit {
  const bundle = loadDrumKitDirectory(kitPath);
  const samples: ConvertedSample[] = [];
  const errors: string[] = [];
  let totalSegments = 0;

  const drumOrder = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;

  for (const kit of bundle.kits) {
    for (const drumType of drumOrder) {
      const filename = kit.samples[drumType];
      if (!filename) continue;

      const filePath = join(kitPath, filename);

      try {
        const converted = convertWav(filePath, bundle.sampleRate, {
          drumType,
          kitNumber: kit.kitNumber,
          midiNote: kit.midiNotes[drumType],
        });
        samples.push(converted);
        totalSegments += converted.output.segmentsNeeded;
      } catch (err) {
        errors.push(`${filename}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    name: bundle.name,
    description: bundle.description,
    sampleRate: bundle.sampleRate,
    baseNote: bundle.baseNote,
    samples,
    totalSegments,
    errors,
  };
}

/**
 * Verify that conversion preserves duration correctly.
 */
export function verifyConversion(sample: ConvertedSample): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check duration preservation
  const durationDiff = Math.abs(sample.source.duration - sample.output.duration);
  if (durationDiff > 0.001) {
    issues.push(
      `Duration mismatch: source=${sample.source.duration.toFixed(4)}s, ` +
        `output=${sample.output.duration.toFixed(4)}s`
    );
  }

  // Check resampling ratio
  const expectedRatio = sample.source.sampleRate / sample.output.sampleRate;
  const actualRatio = sample.source.sampleCount / sample.output.sampleCount;
  if (Math.abs(expectedRatio - actualRatio) > 0.01) {
    issues.push(
      `Resampling ratio mismatch: expected=${expectedRatio.toFixed(4)}, ` +
        `actual=${actualRatio.toFixed(4)}`
    );
  }

  // Check data size
  const expectedBytes = sample.output.sampleCount * 2;
  if (sample.output.dataBytes !== expectedBytes) {
    issues.push(
      `Data size mismatch: expected=${expectedBytes} bytes, ` +
        `actual=${sample.output.dataBytes} bytes`
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Format a sample analysis for display.
 */
export function formatSampleAnalysis(sample: ConvertedSample, verbose = false): string {
  const lines: string[] = [];

  lines.push(`${sample.filename} (${sample.drumType} ${sample.kitNumber})`);
  lines.push(`  Source: ${sample.source.sampleRate}Hz ${sample.source.bitsPerSample}-bit, ${sample.source.sampleCount} samples, ${sample.source.duration.toFixed(3)}s`);
  lines.push(`  Output: ${sample.output.sampleRate}Hz, ${sample.output.sampleCount} samples, ${sample.output.duration.toFixed(3)}s`);
  lines.push(`  Segments: ${sample.output.segmentsNeeded}, MIDI note: ${sample.midiNote}`);

  if (verbose) {
    // Show what tone parameters will be set
    const encoded = getEncodedSampleRate(sample);
    lines.push(`  Tone: sampleRate="${encoded.meaning}", encoded byte=${encoded.value} (0=30kHz, 1=15kHz)`);

    // Show playback analysis
    const expectedDuration = sample.output.sampleCount / sample.output.sampleRate;
    const durationAt30k = sample.output.sampleCount / 30000;
    const durationAt15k = sample.output.sampleCount / 15000;

    lines.push(`  Playback analysis:`);
    lines.push(`    At ${encoded.meaning}: ${expectedDuration.toFixed(3)}s (correct)`);
    if (sample.output.sampleRate === 15000) {
      lines.push(`    If played at 30kHz: ${durationAt30k.toFixed(3)}s (${(sample.source.duration / durationAt30k).toFixed(1)}x speed)`);
    } else {
      lines.push(`    If played at 15kHz: ${durationAt15k.toFixed(3)}s (${(sample.source.duration / durationAt15k).toFixed(1)}x speed)`);
    }

    const verification = verifyConversion(sample);
    if (verification.valid) {
      lines.push(`  Status: ✓ Valid`);
    } else {
      lines.push(`  Status: ✗ Issues found`);
      for (const issue of verification.issues) {
        lines.push(`    - ${issue}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Create an S330Tone object for a converted sample.
 * This is what would be sent to the device.
 *
 * Delegates to the canonical createDrumTone function from drum-kit-import-service.
 */
export function createToneForSample(
  sample: ConvertedSample,
  waveBank: 0 | 1,
  segmentTop: number,
  originalKey: number = 60
): S330Tone {
  const toneName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;

  // Use the canonical createDrumTone and override the endPoint
  const tone = createDrumTone(
    toneName,
    sample.output.sampleRate,
    waveBank,
    segmentTop,
    sample.output.segmentsNeeded,
    sample.output.sampleCount,
    originalKey
  );

  return tone;
}

/**
 * Get the encoded sampleRate byte value for a sample.
 */
export function getEncodedSampleRate(sample: ConvertedSample): { value: number; meaning: string } {
  const value = encodeSampleRate(sample.output.sampleRate === 30000 ? '30kHz' : '15kHz');
  return {
    value,
    meaning: value === 0 ? '30kHz' : '15kHz',
  };
}

/**
 * Get the full encoded tone bytes for a sample.
 * This shows exactly what would be sent to the device.
 */
export function getEncodedToneBytes(
  sample: ConvertedSample,
  waveBank: 0 | 1,
  segmentTop: number,
  originalKey: number = 60
): { bytes: number[]; sampleRateByteIndex: number; sampleRateByte: number; originalKey: number } {
  const tone = createToneForSample(sample, waveBank, segmentTop, originalKey);
  const encoded = encodeTone(tone);

  // SAMPLING_FREQ is at offset 11 in the tone block
  const SAMPLING_FREQ_OFFSET = 11;

  return {
    bytes: Array.from(encoded),
    sampleRateByteIndex: SAMPLING_FREQ_OFFSET,
    sampleRateByte: encoded[SAMPLING_FREQ_OFFSET],
    originalKey,
  };
}

/**
 * Format a full kit conversion result for display.
 */
export function formatKitConversion(kit: ConvertedDrumKit, verbose = false): string {
  const lines: string[] = [];

  lines.push(`Drum Kit: ${kit.name}`);
  if (kit.description) {
    lines.push(`Description: ${kit.description}`);
  }
  lines.push(`Sample Rate: ${kit.sampleRate}Hz`);
  lines.push(`Base Note: ${kit.baseNote}`);
  lines.push(`Total Samples: ${kit.samples.length}`);
  lines.push(`Total Segments: ${kit.totalSegments}`);
  lines.push('');

  for (const sample of kit.samples) {
    lines.push(formatSampleAnalysis(sample, verbose));
    lines.push('');
  }

  if (kit.errors.length > 0) {
    lines.push('Errors:');
    for (const error of kit.errors) {
      lines.push(`  - ${error}`);
    }
  }

  // Summary verification
  let allValid = true;
  const issues: string[] = [];
  for (const sample of kit.samples) {
    const v = verifyConversion(sample);
    if (!v.valid) {
      allValid = false;
      issues.push(`${sample.filename}: ${v.issues.join(', ')}`);
    }
  }

  lines.push('');
  if (allValid) {
    lines.push('✓ All conversions verified');
  } else {
    lines.push('✗ Conversion issues detected:');
    for (const issue of issues) {
      lines.push(`  - ${issue}`);
    }
  }

  return lines.join('\n');
}
