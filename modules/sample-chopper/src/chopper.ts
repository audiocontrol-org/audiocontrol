/**
 * Sample chopper orchestrator.
 *
 * Main entry point for slicing audio samples using various
 * detection methods.
 *
 * @packageDocumentation
 */

import type {
  SliceConfig,
  SliceResult,
} from '@/types.js';
import { sliceByFixedInterval } from '@/fixed-slicer.js';
import { sliceBySilence } from '@/silence-detector.js';
import { sliceByTransient } from '@/transient-detector.js';
import { sliceByManualRegions } from '@/manual-slicer.js';

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
