/**
 * Sample chopper orchestrator.
 *
 * Main entry point for slicing audio samples and converting
 * the results to drum kit format for import.
 *
 * Browser-compatible functions only. For Node.js filesystem
 * operations, see chopper-node.ts.
 *
 * @packageDocumentation
 */

import type { ResolvedDrumKitBundle, DetectedKit, KitSamples, KitMidiNotes } from '@/drum-kits/index.js';

import type {
  SliceConfig,
  SliceResult,
  DrumKitOutputConfig,
  Slice,
} from '@/sample-chopper/types.js';
import { DEFAULT_BASE_NOTE, DEFAULT_DRUM_TYPES } from '@/sample-chopper/types.js';
import { sliceByFixedInterval } from '@/sample-chopper/fixed-slicer.js';
import { sliceBySilence } from '@/sample-chopper/silence-detector.js';
import { sliceByTransient } from '@/sample-chopper/transient-detector.js';
import { sliceByManualRegions } from '@/sample-chopper/manual-slicer.js';

/**
 * Slice audio into regions using the specified method.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param config - Slice configuration (method-specific)
 * @returns Slice result with extracted regions
 *
 * @example
 * ```typescript
 * const result = sliceAudio(samples, 44100, {
 *   method: 'transient',
 *   threshold: 0.3,
 *   minGapMs: 100
 * });
 * ```
 */
export function sliceAudio(
  samples: Int16Array,
  sampleRate: number,
  config: SliceConfig
): SliceResult {
  switch (config.method) {
    case 'fixed':
      return sliceByFixedInterval(samples, sampleRate, config);

    case 'silence':
      return sliceBySilence(samples, sampleRate, config);

    case 'transient':
      return sliceByTransient(samples, sampleRate, config);

    case 'manual':
      return sliceByManualRegions(samples, sampleRate, config);

    default:
      // Exhaustive check
      const exhaustiveCheck: never = config;
      throw new Error(`Unknown slice method: ${(exhaustiveCheck as SliceConfig).method}`);
  }
}

/**
 * Convert slice results to a resolved drum kit bundle structure.
 *
 * Each slice becomes one sample in the kit, mapped to consecutive
 * MIDI notes starting from the base note.
 *
 * @param sliceResult - Result from slicing operation
 * @param config - Drum kit output configuration
 * @returns Resolved drum kit bundle ready for file output
 */
export function slicesToDrumKit(
  sliceResult: SliceResult,
  config: DrumKitOutputConfig
): ResolvedDrumKitBundle {
  const baseNote = config.baseNote ?? DEFAULT_BASE_NOTE;
  const drumTypes = config.drumTypes ?? DEFAULT_DRUM_TYPES;

  // Group slices into kits of 4 (kick, snare, hhc, hho)
  const kits: DetectedKit[] = [];
  const SAMPLES_PER_KIT = 4;

  for (let i = 0; i < sliceResult.slices.length; i += SAMPLES_PER_KIT) {
    const kitIndex = Math.floor(i / SAMPLES_PER_KIT);
    const kitSlices = sliceResult.slices.slice(i, i + SAMPLES_PER_KIT);

    const samples: KitSamples = {};
    const typeOrder: (keyof KitSamples)[] = ['kick', 'snare', 'hhClosed', 'hhOpen'];

    for (let j = 0; j < kitSlices.length; j++) {
      const slice = kitSlices[j];
      const drumType = typeOrder[j];
      const label = drumTypes[j % drumTypes.length] ?? drumType;
      const filename = formatSampleFilename(kitIndex + 1, label);
      samples[drumType] = filename;
    }

    const midiNotes: KitMidiNotes = {
      kick: baseNote + kitIndex * 4,
      snare: baseNote + kitIndex * 4 + 1,
      hhClosed: baseNote + kitIndex * 4 + 2,
      hhOpen: baseNote + kitIndex * 4 + 3,
    };

    kits.push({
      kitNumber: kitIndex + 1,
      samples,
      midiNotes,
      isComplete: kitSlices.length === SAMPLES_PER_KIT,
    });
  }

  return {
    name: config.name,
    sampleRate: config.sampleRate,
    baseNote,
    kits,
    totalSamples: sliceResult.slices.length,
    allComplete: kits.every(k => k.isComplete),
  };
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
 * Analyze a WAV file and suggest slicing parameters.
 *
 * Useful for previewing before chopping.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @returns Suggested parameters for each slicing method
 */
export function analyzeForSlicing(
  samples: Int16Array,
  sampleRate: number
): {
  duration: { ms: number; samples: number };
  peakAmplitude: number;
  suggestedTransientThreshold: number;
  suggestedSilenceThresholdDb: number;
} {
  // Find peak amplitude
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) {
      maxAbs = abs;
    }
  }
  const peakAmplitude = maxAbs / 32768;

  // Suggest transient threshold at 30% of peak
  const suggestedTransientThreshold = Math.max(0.1, peakAmplitude * 0.3);

  // Suggest silence threshold (rough estimate)
  const suggestedSilenceThresholdDb = -40;

  return {
    duration: {
      ms: (samples.length / sampleRate) * 1000,
      samples: samples.length,
    },
    peakAmplitude,
    suggestedTransientThreshold,
    suggestedSilenceThresholdDb,
  };
}
