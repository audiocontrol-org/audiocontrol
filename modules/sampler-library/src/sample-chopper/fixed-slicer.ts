/**
 * Fixed interval slicer for sample chopping.
 *
 * Splits audio at regular time intervals, useful for
 * metronome-recorded drum hits at consistent tempo.
 *
 * @packageDocumentation
 */

import type { FixedConfig, SliceResult, Slice } from '@/sample-chopper/types.js';
import { msToSamples, samplesToMs } from '@/sample-chopper/audio-utils.js';

/**
 * Slice audio at fixed time intervals.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param config - Fixed interval configuration
 * @returns Slice result with extracted regions
 *
 * @example
 * ```typescript
 * // Split every 500ms
 * const result = sliceByFixedInterval(samples, 44100, {
 *   method: 'fixed',
 *   intervalMs: 500
 * });
 * ```
 */
export function sliceByFixedInterval(
  samples: Int16Array,
  sampleRate: number,
  config: FixedConfig
): SliceResult {
  const intervalSamples = msToSamples(config.intervalMs, sampleRate);

  if (intervalSamples <= 0) {
    throw new Error(`Invalid interval: ${config.intervalMs}ms results in 0 samples at ${sampleRate}Hz`);
  }

  const totalDurationMs = samplesToMs(samples.length, sampleRate);
  const slices: Slice[] = [];

  let sliceCount = Math.floor(samples.length / intervalSamples);

  // Handle partial final slice
  const remainder = samples.length % intervalSamples;
  if (remainder > 0) {
    sliceCount++;
  }

  // Validate count if specified
  if (config.count !== undefined && sliceCount !== config.count) {
    const actualCount = Math.floor(samples.length / intervalSamples);
    throw new Error(
      `Expected ${config.count} slices but audio length yields ${actualCount} ` +
      `complete slices at ${config.intervalMs}ms intervals ` +
      `(total duration: ${totalDurationMs.toFixed(1)}ms)`
    );
  }

  for (let i = 0; i < sliceCount; i++) {
    const startSample = i * intervalSamples;
    const endSample = Math.min(startSample + intervalSamples, samples.length);
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
