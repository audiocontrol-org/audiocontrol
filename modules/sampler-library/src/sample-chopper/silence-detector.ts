/**
 * Silence detection slicer for sample chopping.
 *
 * Splits audio at gaps of silence/low amplitude, useful for
 * recordings with clear gaps between drum hits.
 *
 * @packageDocumentation
 */

import type { SilenceConfig, SliceResult, Slice } from '@/sample-chopper/types.js';
import {
  msToSamples,
  samplesToMs,
  calculateRms,
  amplitudeToDb,
  dbToAmplitude,
} from '@/sample-chopper/audio-utils.js';

/**
 * State of a region being analyzed.
 */
type RegionState = 'silence' | 'sound';

/**
 * Slice audio at silence gaps.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param config - Silence detection configuration
 * @returns Slice result with extracted regions
 *
 * @example
 * ```typescript
 * // Split at gaps below -40dB lasting at least 50ms
 * const result = sliceBySilence(samples, 44100, {
 *   method: 'silence',
 *   thresholdDb: -40,
 *   minSilenceMs: 50
 * });
 * ```
 */
export function sliceBySilence(
  samples: Int16Array,
  sampleRate: number,
  config: SilenceConfig
): SliceResult {
  const windowSizeSamples = msToSamples(10, sampleRate); // 10ms analysis window
  const minSilenceSamples = msToSamples(config.minSilenceMs, sampleRate);
  const minSampleSamples = config.minSampleMs !== undefined
    ? msToSamples(config.minSampleMs, sampleRate)
    : 0;

  const thresholdAmplitude = dbToAmplitude(config.thresholdDb);
  const totalDurationMs = samplesToMs(samples.length, sampleRate);

  // Find regions of sound vs silence
  const regions: Array<{ start: number; end: number; state: RegionState }> = [];
  let currentState: RegionState = 'silence';
  let regionStart = 0;

  for (let pos = 0; pos < samples.length; pos += windowSizeSamples) {
    const windowLength = Math.min(windowSizeSamples, samples.length - pos);
    const rms = calculateRms(samples, pos, windowLength);
    const db = amplitudeToDb(rms);
    const isSound = db > config.thresholdDb;

    const newState: RegionState = isSound ? 'sound' : 'silence';

    if (newState !== currentState) {
      // State change - close previous region
      if (pos > regionStart) {
        regions.push({
          start: regionStart,
          end: pos,
          state: currentState,
        });
      }
      regionStart = pos;
      currentState = newState;
    }
  }

  // Close final region
  if (samples.length > regionStart) {
    regions.push({
      start: regionStart,
      end: samples.length,
      state: currentState,
    });
  }

  // Merge short silence gaps (below minSilenceMs threshold)
  const mergedRegions: Array<{ start: number; end: number; state: RegionState }> = [];

  for (const region of regions) {
    if (region.state === 'silence' && (region.end - region.start) < minSilenceSamples) {
      // Short silence - merge with previous sound region if exists
      if (mergedRegions.length > 0 && mergedRegions[mergedRegions.length - 1].state === 'sound') {
        mergedRegions[mergedRegions.length - 1].end = region.end;
        continue;
      }
    }
    mergedRegions.push({ ...region });
  }

  // Also merge consecutive sound regions that resulted from above
  const finalRegions: Array<{ start: number; end: number; state: RegionState }> = [];
  for (const region of mergedRegions) {
    if (
      finalRegions.length > 0 &&
      region.state === 'sound' &&
      finalRegions[finalRegions.length - 1].state === 'sound'
    ) {
      finalRegions[finalRegions.length - 1].end = region.end;
    } else {
      finalRegions.push({ ...region });
    }
  }

  // Extract sound regions as slices
  const slices: Slice[] = [];
  let sliceIndex = 0;

  for (const region of finalRegions) {
    if (region.state === 'sound') {
      const length = region.end - region.start;

      // Skip slices shorter than minimum
      if (length < minSampleSamples) {
        continue;
      }

      const sliceSamples = samples.slice(region.start, region.end);

      slices.push({
        index: sliceIndex,
        startSample: region.start,
        endSample: region.end,
        samples: sliceSamples,
        durationMs: samplesToMs(length, sampleRate),
      });

      sliceIndex++;
    }
  }

  return {
    slices,
    sampleRate,
    totalDurationMs,
  };
}

/**
 * Trim silence from the start and end of a sample.
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param thresholdDb - Silence threshold in dB
 * @returns Trimmed sample region { start, end } in samples
 */
export function trimSilence(
  samples: Int16Array,
  sampleRate: number,
  thresholdDb: number
): { start: number; end: number } {
  const windowSizeSamples = msToSamples(5, sampleRate); // 5ms window
  const threshold = dbToAmplitude(thresholdDb);

  // Find start (first non-silent window)
  let start = 0;
  for (let pos = 0; pos < samples.length; pos += windowSizeSamples) {
    const windowLength = Math.min(windowSizeSamples, samples.length - pos);
    const rms = calculateRms(samples, pos, windowLength);
    if (rms >= threshold) {
      start = pos;
      break;
    }
  }

  // Find end (last non-silent window)
  let end = samples.length;
  for (let pos = samples.length - windowSizeSamples; pos >= start; pos -= windowSizeSamples) {
    const windowLength = Math.min(windowSizeSamples, samples.length - pos);
    const rms = calculateRms(samples, Math.max(0, pos), windowLength);
    if (rms >= threshold) {
      end = Math.min(pos + windowSizeSamples, samples.length);
      break;
    }
  }

  return { start, end };
}
