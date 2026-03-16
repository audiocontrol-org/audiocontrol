/**
 * Transient detection slicer for sample chopping.
 *
 * Detects amplitude spikes (onsets) to identify drum hit
 * beginnings, useful for clean recordings with clear attacks.
 *
 * @packageDocumentation
 */

import type { TransientConfig, SliceResult, Slice } from '@/types.js';
import {
  msToSamples,
  samplesToMs,
  calculateRms,
} from '@/audio-utils.js';

/**
 * Detected onset point.
 */
interface Onset {
  /** Sample index of the onset */
  sampleIndex: number;
  /** RMS amplitude at onset */
  amplitude: number;
}

/**
 * Slice audio at detected transients (amplitude onsets).
 *
 * @param samples - Audio samples (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param config - Transient detection configuration
 * @returns Slice result with extracted regions
 *
 * @example
 * ```typescript
 * // Detect hits above 30% amplitude with 100ms minimum gap
 * const result = sliceByTransient(samples, 44100, {
 *   method: 'transient',
 *   threshold: 0.3,
 *   minGapMs: 100
 * });
 * ```
 */
export function sliceByTransient(
  samples: Int16Array,
  sampleRate: number,
  config: TransientConfig
): SliceResult {
  const windowSizeMs = 10; // 10ms analysis window
  const windowSizeSamples = msToSamples(windowSizeMs, sampleRate);
  const hopSizeSamples = msToSamples(5, sampleRate); // 5ms hop for smoother detection
  const minGapSamples = msToSamples(config.minGapMs, sampleRate);
  const prePadSamples = config.prePadMs !== undefined
    ? msToSamples(config.prePadMs, sampleRate)
    : msToSamples(5, sampleRate); // Default 5ms pre-pad
  const postPadSamples = config.postPadMs !== undefined
    ? msToSamples(config.postPadMs, sampleRate)
    : 0; // Default no post-pad (extend to next transient)

  const totalDurationMs = samplesToMs(samples.length, sampleRate);

  // Calculate RMS for each window
  const rmsValues: number[] = [];
  const windowPositions: number[] = [];

  for (let pos = 0; pos + windowSizeSamples <= samples.length; pos += hopSizeSamples) {
    const rms = calculateRms(samples, pos, windowSizeSamples);
    rmsValues.push(rms);
    windowPositions.push(pos);
  }

  // Detect onsets: where amplitude rises significantly above threshold
  const onsets = detectOnsets(rmsValues, windowPositions, config.threshold, minGapSamples);

  if (onsets.length === 0) {
    // No transients found - return entire audio as one slice
    return {
      slices: [{
        index: 0,
        startSample: 0,
        endSample: samples.length,
        samples: samples.slice(),
        durationMs: totalDurationMs,
      }],
      sampleRate,
      totalDurationMs,
    };
  }

  // Convert onsets to slices
  const slices: Slice[] = [];

  for (let i = 0; i < onsets.length; i++) {
    const onset = onsets[i];
    const nextOnset = onsets[i + 1];

    // Start: onset position minus pre-pad (but not before 0 or previous slice)
    let startSample = Math.max(0, onset.sampleIndex - prePadSamples);
    if (i > 0) {
      // Don't overlap with previous slice
      const prevEnd = slices[i - 1].endSample;
      startSample = Math.max(startSample, prevEnd);
    }

    // End: next onset (minus its pre-pad) or end of audio
    let endSample: number;
    if (nextOnset) {
      // Stop before the next transient's pre-pad region
      endSample = Math.max(onset.sampleIndex + 1, nextOnset.sampleIndex - prePadSamples);
    } else {
      // Last slice: extend to end of audio (with optional post-pad limit)
      if (postPadSamples > 0) {
        // Find where audio falls quiet after this transient
        endSample = findDecayEnd(samples, onset.sampleIndex, postPadSamples, sampleRate);
      } else {
        endSample = samples.length;
      }
    }

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

/**
 * Detect onset points from RMS values.
 *
 * Uses a simple threshold-based approach: an onset is detected when
 * the RMS rises above the threshold after being below it.
 */
function detectOnsets(
  rmsValues: number[],
  windowPositions: number[],
  threshold: number,
  minGapSamples: number
): Onset[] {
  const onsets: Onset[] = [];
  let wasAboveThreshold = false;
  let lastOnsetSample = -minGapSamples; // Allow first onset at position 0

  for (let i = 0; i < rmsValues.length; i++) {
    const rms = rmsValues[i];
    const isAboveThreshold = rms >= threshold;

    // Detect rising edge: going from below to above threshold
    if (isAboveThreshold && !wasAboveThreshold) {
      const sampleIndex = windowPositions[i];

      // Enforce minimum gap between onsets
      if (sampleIndex - lastOnsetSample >= minGapSamples) {
        onsets.push({
          sampleIndex,
          amplitude: rms,
        });
        lastOnsetSample = sampleIndex;
      }
    }

    wasAboveThreshold = isAboveThreshold;
  }

  return onsets;
}

/**
 * Find where the audio decays after a transient.
 *
 * Looks for where the amplitude falls to a quiet level
 * or a maximum duration is reached.
 */
function findDecayEnd(
  samples: Int16Array,
  onsetSample: number,
  maxDurationSamples: number,
  sampleRate: number
): number {
  const windowSizeSamples = msToSamples(10, sampleRate);
  const silenceThreshold = 0.01; // Very quiet
  const maxEnd = Math.min(onsetSample + maxDurationSamples, samples.length);

  // Start checking from onset forward
  for (let pos = onsetSample; pos + windowSizeSamples <= maxEnd; pos += windowSizeSamples) {
    const rms = calculateRms(samples, pos, windowSizeSamples);
    if (rms < silenceThreshold) {
      // Found silence - include a bit more for the tail
      return Math.min(pos + windowSizeSamples * 2, maxEnd);
    }
  }

  // Didn't find silence - use max duration
  return maxEnd;
}

/**
 * Refine onset detection by finding the exact sample where
 * the attack begins (for more precise slicing).
 *
 * @param samples - Audio samples
 * @param roughOnset - Approximate onset position
 * @param searchRangeSamples - Range to search around rough onset
 * @returns Refined onset sample position
 */
export function refineOnsetPosition(
  samples: Int16Array,
  roughOnset: number,
  searchRangeSamples: number
): number {
  const searchStart = Math.max(0, roughOnset - searchRangeSamples);
  const searchEnd = Math.min(samples.length, roughOnset + searchRangeSamples);

  // Find the point with maximum derivative (steepest rise)
  let maxDerivative = 0;
  let maxDerivativePos = roughOnset;

  for (let i = searchStart + 1; i < searchEnd; i++) {
    const derivative = Math.abs(samples[i]) - Math.abs(samples[i - 1]);
    if (derivative > maxDerivative) {
      maxDerivative = derivative;
      maxDerivativePos = i;
    }
  }

  return maxDerivativePos;
}
