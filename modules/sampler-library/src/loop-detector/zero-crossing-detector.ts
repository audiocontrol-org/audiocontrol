/**
 * Zero crossing detection for loop point candidate generation.
 *
 * Zero crossings are points where the waveform crosses the zero axis.
 * These are ideal loop point candidates because they minimize amplitude
 * discontinuity at the splice point.
 *
 * @packageDocumentation
 */

import { HARDWARE_CONSTRAINTS, type ZeroCrossing, type ZeroCrossingPolarity } from '@/loop-detector/types.js';

/**
 * Maximum 16-bit sample value for slope normalization.
 */
const MAX_SAMPLE_VALUE = 32768;

/**
 * Maximum possible slope between adjacent 16-bit samples.
 * This is 2 * MAX_SAMPLE_VALUE (from -32768 to +32767).
 */
const MAX_SLOPE = 2 * MAX_SAMPLE_VALUE;

/**
 * Snap a sample index to the nearest even value (2-byte boundary).
 *
 * Roland S-550/S-330 requires all loop point indices to be even
 * due to 16-bit word alignment in hardware memory.
 *
 * @param index - Sample index to align
 * @returns Aligned sample index (always even)
 */
export function snapToWordBoundary(index: number): number {
  return Math.floor(index / HARDWARE_CONSTRAINTS.WORD_ALIGNMENT) * HARDWARE_CONSTRAINTS.WORD_ALIGNMENT;
}

/**
 * Detect all zero crossings in a range of samples.
 *
 * A zero crossing occurs when:
 * - samples[i-1] < 0 && samples[i] >= 0 (positive-going)
 * - samples[i-1] >= 0 && samples[i] < 0 (negative-going)
 *
 * All returned indices are snapped to even values (2-byte boundaries)
 * per S-550/S-330 hardware requirements.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param startIndex - Start of the search range (inclusive)
 * @param endIndex - End of the search range (exclusive)
 * @returns Array of zero crossings with index, polarity, and slope
 */
export function detectZeroCrossings(
  samples: Int16Array,
  startIndex: number,
  endIndex: number
): ZeroCrossing[] {
  const crossings: ZeroCrossing[] = [];

  // Clamp indices to valid range
  const start = Math.max(1, startIndex); // Need at least one previous sample
  const end = Math.min(samples.length, endIndex);

  for (let i = start; i < end; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];

    let polarity: ZeroCrossingPolarity | null = null;

    // Check for zero crossing
    if (prev < 0 && curr >= 0) {
      polarity = 'positive';
    } else if (prev >= 0 && curr < 0) {
      polarity = 'negative';
    }

    if (polarity !== null) {
      // Calculate slope (first derivative) at crossing
      const slope = (curr - prev) / MAX_SLOPE;

      // Snap to 2-byte boundary
      const alignedIndex = snapToWordBoundary(i);

      // Avoid duplicate indices from snapping
      if (crossings.length === 0 || crossings[crossings.length - 1].index !== alignedIndex) {
        crossings.push({
          index: alignedIndex,
          polarity,
          slope,
        });
      }
    }
  }

  return crossings;
}

/**
 * Filter zero crossings by polarity.
 *
 * For seamless loops, the loop start and end should have matching polarity
 * (both positive-going or both negative-going) to ensure waveform continuity.
 *
 * @param crossings - Array of zero crossings to filter
 * @param polarity - Polarity to keep ('positive' or 'negative')
 * @returns Filtered array containing only crossings with the specified polarity
 */
export function filterByPolarity(
  crossings: ZeroCrossing[],
  polarity: ZeroCrossingPolarity
): ZeroCrossing[] {
  return crossings.filter((c) => c.polarity === polarity);
}

/**
 * Filter zero crossings by slope similarity to a target.
 *
 * Matching slopes between loop start and end reduces first-derivative
 * discontinuity, resulting in a smoother loop transition.
 *
 * @param crossings - Array of zero crossings to filter
 * @param targetSlope - Target slope value to match (normalized [-1, 1])
 * @param tolerance - Maximum allowed difference from target slope
 * @returns Filtered array containing only crossings within slope tolerance
 */
export function matchBySlope(
  crossings: ZeroCrossing[],
  targetSlope: number,
  tolerance: number
): ZeroCrossing[] {
  return crossings.filter((c) => Math.abs(c.slope - targetSlope) <= tolerance);
}

/**
 * Find zero crossings that match a reference crossing.
 *
 * This is used to find loop start candidates that match a given loop end
 * crossing, ensuring both polarity and slope are similar.
 *
 * @param crossings - Array of zero crossings to search
 * @param reference - Reference crossing to match
 * @param slopeTolerance - Maximum allowed slope difference
 * @returns Array of crossings matching the reference
 */
export function findMatchingCrossings(
  crossings: ZeroCrossing[],
  reference: ZeroCrossing,
  slopeTolerance: number
): ZeroCrossing[] {
  return crossings.filter(
    (c) =>
      c.polarity === reference.polarity &&
      Math.abs(c.slope - reference.slope) <= slopeTolerance
  );
}

/**
 * Calculate slope match score between two crossings.
 *
 * Returns a score from 0 to 1, where 1 means identical slopes
 * and 0 means maximum possible slope difference.
 *
 * @param crossing1 - First zero crossing
 * @param crossing2 - Second zero crossing
 * @returns Slope match score [0, 1]
 */
export function calculateSlopeScore(
  crossing1: ZeroCrossing,
  crossing2: ZeroCrossing
): number {
  // Maximum possible slope difference is 2 (from -1 to +1)
  const maxDiff = 2;
  const diff = Math.abs(crossing1.slope - crossing2.slope);
  return 1 - diff / maxDiff;
}

/**
 * Generate all valid (loopStart, loopEnd) pairs from zero crossings.
 *
 * Pairs are generated by matching:
 * 1. Polarity (both positive-going or both negative-going)
 * 2. Minimum loop length constraint
 * 3. Slope tolerance (optional pre-filter)
 *
 * @param startCrossings - Zero crossings in the loop start search region
 * @param endCrossings - Zero crossings in the loop end search region
 * @param minLoopLength - Minimum samples between start and end
 * @param slopeTolerance - Optional slope tolerance for pre-filtering (null = no filter)
 * @returns Array of [loopStart, loopEnd] pairs
 */
export function generateCandidatePairs(
  startCrossings: ZeroCrossing[],
  endCrossings: ZeroCrossing[],
  minLoopLength: number = HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH,
  slopeTolerance: number | null = null
): Array<{ loopStart: number; loopEnd: number; startCrossing: ZeroCrossing; endCrossing: ZeroCrossing }> {
  const pairs: Array<{
    loopStart: number;
    loopEnd: number;
    startCrossing: ZeroCrossing;
    endCrossing: ZeroCrossing;
  }> = [];

  for (const endCrossing of endCrossings) {
    // Find matching start crossings for this end crossing
    let matchingStarts: ZeroCrossing[];

    if (slopeTolerance !== null) {
      matchingStarts = findMatchingCrossings(startCrossings, endCrossing, slopeTolerance);
    } else {
      matchingStarts = filterByPolarity(startCrossings, endCrossing.polarity);
    }

    for (const startCrossing of matchingStarts) {
      const loopLength = endCrossing.index - startCrossing.index;

      // Enforce minimum loop length
      if (loopLength >= minLoopLength) {
        pairs.push({
          loopStart: startCrossing.index,
          loopEnd: endCrossing.index,
          startCrossing,
          endCrossing,
        });
      }
    }
  }

  return pairs;
}
