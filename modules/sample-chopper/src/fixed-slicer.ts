/**
 * Fixed count slicer for sample chopping.
 *
 * Splits audio into a specified number of equal-length slices.
 *
 * @packageDocumentation
 */

import type { FixedConfig, SliceResult, Slice } from '@/types.js';
import { msToSamples, samplesToMs } from '@/audio-utils.js';

/**
 * Slice audio into a fixed number of equal-length regions.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param config - Fixed count configuration
 * @returns Slice result with extracted regions
 *
 * @example
 * ```typescript
 * // Split into 4 equal slices
 * const result = sliceByFixedInterval(samples, 44100, {
 *   method: 'fixed',
 *   count: 4
 * });
 * ```
 */
export function sliceByFixedInterval(
  samples: Int16Array,
  sampleRate: number,
  config: FixedConfig
): SliceResult {
  const totalDurationMs = samplesToMs(samples.length, sampleRate);

  // Determine interval: explicit intervalMs overrides count-based calculation
  let intervalSamples: number;
  let sliceCount: number;

  if (config.intervalMs !== undefined) {
    intervalSamples = msToSamples(config.intervalMs, sampleRate);
    if (intervalSamples <= 0) {
      throw new Error(`Invalid interval: ${config.intervalMs}ms results in 0 samples at ${sampleRate}Hz`);
    }
    sliceCount = config.count;
  } else {
    if (config.count <= 0) {
      throw new Error(`Invalid count: ${config.count} (must be > 0)`);
    }
    sliceCount = config.count;
    intervalSamples = Math.floor(samples.length / sliceCount);
    if (intervalSamples <= 0) {
      throw new Error(`Audio too short for ${config.count} slices at ${sampleRate}Hz`);
    }
  }

  const slices: Slice[] = [];

  for (let i = 0; i < sliceCount; i++) {
    const startSample = i * intervalSamples;
    // Last slice extends to end of audio to capture any remainder
    const endSample = i === sliceCount - 1
      ? samples.length
      : Math.min(startSample + intervalSamples, samples.length);

    if (startSample >= samples.length) break;

    const sliceSamples = samples.slice(startSample, endSample);

    slices.push({
      index: i,
      startSample,
      endSample,
      samples: sliceSamples,
      durationMs: samplesToMs(sliceSamples.length, sampleRate),
    });
  }

  return {
    slices,
    sampleRate,
    totalDurationMs,
  };
}
