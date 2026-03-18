/**
 * Splice smoothing for loop point transitions.
 *
 * Even a well-scored loop point pair may have a residual discontinuity due to
 * quantization noise (especially relevant for 12-bit S-550/S-330 samples) or
 * near-zero-crossing imprecision. A short crossfade at the splice point
 * eliminates this.
 *
 * @packageDocumentation
 */

import { DEFAULT_SPLICE_CONFIG, HARDWARE_CONSTRAINTS, type SpliceConfig } from '@/loop-detector/types.js';

/**
 * Apply a crossfade to smooth the loop transition.
 *
 * This modifies the sample data at the loop end region to blend smoothly
 * into the loop start region. The crossfade is written to the end of the
 * loop (before loopEnd), not the beginning.
 *
 * @param samples - Audio samples as 16-bit signed integers (will be modified)
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param config - Crossfade configuration
 * @returns Modified samples (same array, modified in place)
 */
export function applyCrossfade(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  config: Partial<SpliceConfig> = {}
): Int16Array {
  const cfg: SpliceConfig = {
    ...DEFAULT_SPLICE_CONFIG,
    ...config,
  };

  // Validate parameters
  const loopLength = loopEnd - loopStart;
  if (loopLength < HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH) {
    throw new Error(
      `Loop length ${loopLength} is less than minimum ${HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH}`
    );
  }

  // Clamp crossfade length to half the loop length
  const maxCrossfadeLength = Math.floor(loopLength / 2);
  const effectiveCrossfadeLength = Math.min(cfg.crossfadeLength, maxCrossfadeLength);

  // Ensure minimum crossfade length for 12-bit audio
  const minCrossfadeLength = 8;
  if (effectiveCrossfadeLength < minCrossfadeLength) {
    // Loop too short for meaningful crossfade
    return samples;
  }

  // Apply the appropriate crossfade type
  if (cfg.mode === 'equal-power') {
    return applyEqualPowerCrossfade(samples, loopStart, loopEnd, effectiveCrossfadeLength);
  } else {
    return applyLinearCrossfade(samples, loopStart, loopEnd, effectiveCrossfadeLength);
  }
}

/**
 * Apply a linear crossfade (overlap-add).
 *
 * Blends the end of the loop body into the beginning using linear fade curves.
 *
 * Note: Linear crossfades introduce a 3 dB amplitude dip at the midpoint
 * for uncorrelated signals. For highly correlated signals (the goal of
 * good loop point selection), the dip is minimal.
 *
 * @param samples - Audio samples (will be modified)
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param crossfadeLength - Length of the crossfade in samples
 * @returns Modified samples (same array)
 */
function applyLinearCrossfade(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  crossfadeLength: number
): Int16Array {
  for (let i = 0; i < crossfadeLength; i++) {
    // Alpha goes from 0 to 1 over the crossfade
    const alpha = i / crossfadeLength;

    // Indices into the sample array
    const endIndex = loopEnd - crossfadeLength + i;
    const startIndex = loopStart + i;

    // Blend: fade out the end, fade in the start
    const endSample = samples[endIndex];
    const startSample = samples[startIndex];

    const blended = Math.round((1 - alpha) * endSample + alpha * startSample);

    // Clamp to 16-bit range
    samples[endIndex] = clamp16Bit(blended);
  }

  return samples;
}

/**
 * Apply an equal-power crossfade.
 *
 * Uses sine/cosine curves to maintain constant perceived loudness
 * through the transition. Preferred for material where the two regions
 * are not highly correlated.
 *
 * @param samples - Audio samples (will be modified)
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param crossfadeLength - Length of the crossfade in samples
 * @returns Modified samples (same array)
 */
function applyEqualPowerCrossfade(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  crossfadeLength: number
): Int16Array {
  const halfPi = Math.PI / 2;

  for (let i = 0; i < crossfadeLength; i++) {
    // Calculate equal-power fade curves
    const angle = (i / crossfadeLength) * halfPi;
    const alphaOut = Math.cos(angle); // Fade out the end
    const alphaIn = Math.sin(angle); // Fade in the start

    // Indices into the sample array
    const endIndex = loopEnd - crossfadeLength + i;
    const startIndex = loopStart + i;

    // Blend with equal-power curves
    const endSample = samples[endIndex];
    const startSample = samples[startIndex];

    const blended = Math.round(alphaOut * endSample + alphaIn * startSample);

    // Clamp to 16-bit range
    samples[endIndex] = clamp16Bit(blended);
  }

  return samples;
}

/**
 * Clamp a value to 16-bit signed integer range.
 *
 * @param value - Value to clamp
 * @returns Clamped value in [-32768, 32767]
 */
function clamp16Bit(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}

/**
 * Create a smoothed copy of the samples without modifying the original.
 *
 * @param samples - Original audio samples
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param config - Crossfade configuration
 * @returns New Int16Array with crossfade applied
 */
export function createSmoothedCopy(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  config: Partial<SpliceConfig> = {}
): Int16Array {
  // Create a copy of the samples
  const copy = new Int16Array(samples.length);
  copy.set(samples);

  // Apply crossfade to the copy
  return applyCrossfade(copy, loopStart, loopEnd, config);
}

/**
 * Calculate the optimal crossfade length based on sample characteristics.
 *
 * @param sampleRate - Sample rate in Hz
 * @param loopLength - Length of the loop in samples
 * @param targetMs - Target crossfade duration in milliseconds
 * @returns Optimal crossfade length in samples
 */
export function calculateOptimalCrossfadeLength(
  sampleRate: number,
  loopLength: number,
  targetMs: number = 1
): number {
  // Convert target to samples
  const targetSamples = Math.round((targetMs * sampleRate) / 1000);

  // Minimum: 8 samples for 12-bit quantization
  const minLength = 8;

  // Maximum: half the loop length
  const maxLength = Math.floor(loopLength / 2);

  // Default: 32 samples
  const defaultLength = 32;

  // Use target if valid, otherwise default, clamped to range
  const preferred = targetSamples > 0 ? targetSamples : defaultLength;
  return Math.max(minLength, Math.min(maxLength, preferred));
}

/**
 * Analyze the discontinuity at a loop point.
 *
 * Returns metrics that can help decide if smoothing is needed
 * and how aggressive the crossfade should be.
 *
 * @param samples - Audio samples
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @returns Discontinuity analysis
 */
export function analyzeDiscontinuity(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number
): DiscontinuityAnalysis {
  // Sample values at the loop points
  const endValue = samples[loopEnd - 1] ?? 0;
  const startValue = samples[loopStart] ?? 0;

  // Amplitude discontinuity
  const amplitudeStep = Math.abs(endValue - startValue);
  const normalizedStep = amplitudeStep / 32768; // 0-1 range

  // Slope discontinuity (first derivative)
  const endSlope = (samples[loopEnd - 1] ?? 0) - (samples[loopEnd - 2] ?? 0);
  const startSlope = (samples[loopStart + 1] ?? 0) - (samples[loopStart] ?? 0);
  const slopeDiff = Math.abs(endSlope - startSlope);
  const normalizedSlopeDiff = slopeDiff / 65536; // Max possible slope diff

  // Recommended crossfade length based on discontinuity
  let recommendedCrossfadeLength: number;
  if (normalizedStep < 0.01 && normalizedSlopeDiff < 0.01) {
    recommendedCrossfadeLength = 8; // Minimal discontinuity
  } else if (normalizedStep < 0.05 && normalizedSlopeDiff < 0.05) {
    recommendedCrossfadeLength = 16; // Small discontinuity
  } else if (normalizedStep < 0.1 && normalizedSlopeDiff < 0.1) {
    recommendedCrossfadeLength = 32; // Moderate discontinuity
  } else {
    recommendedCrossfadeLength = 64; // Large discontinuity
  }

  return {
    amplitudeStep,
    normalizedAmplitudeStep: normalizedStep,
    slopeDifference: slopeDiff,
    normalizedSlopeDifference: normalizedSlopeDiff,
    needsSmoothing: normalizedStep > 0.01 || normalizedSlopeDiff > 0.01,
    recommendedCrossfadeLength,
  };
}

/**
 * Results of discontinuity analysis.
 */
export interface DiscontinuityAnalysis {
  /**
   * Absolute amplitude difference between loop end and start.
   */
  amplitudeStep: number;

  /**
   * Normalized amplitude step (0-1 range).
   */
  normalizedAmplitudeStep: number;

  /**
   * Absolute slope difference between loop end and start.
   */
  slopeDifference: number;

  /**
   * Normalized slope difference (0-1 range).
   */
  normalizedSlopeDifference: number;

  /**
   * Whether smoothing is recommended based on discontinuity.
   */
  needsSmoothing: boolean;

  /**
   * Recommended crossfade length in samples.
   */
  recommendedCrossfadeLength: number;
}
