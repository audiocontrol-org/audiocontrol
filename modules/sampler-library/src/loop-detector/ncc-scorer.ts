/**
 * Normalized Cross-Correlation (NCC) scoring for loop point detection.
 *
 * NCC measures waveform similarity between a window ending at loopEnd
 * and a window beginning at loopStart. It is bounded in [-1, 1], where
 * 1.0 is a perfect match.
 *
 * @packageDocumentation
 */

/**
 * Calculate normalized cross-correlation between two regions of a sample.
 *
 * NCC formula:
 * ```
 * NCC = Σ(a[i] * b[i]) / sqrt(Σ(a[i]²) * Σ(b[i]²))
 *
 * where:
 *   a[i] = samples[loopStart + i]
 *   b[i] = samples[loopEnd - windowSize + i]
 *   i ∈ [0, windowSize)
 * ```
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param windowSize - Number of samples to compare
 * @returns NCC score [-1, 1], or 0 if calculation fails
 */
export function calculateNCC(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  windowSize: number
): number {
  // Validate indices
  const startWindowStart = loopStart;
  const startWindowEnd = loopStart + windowSize;
  const endWindowStart = loopEnd - windowSize;
  const endWindowEnd = loopEnd;

  // Bounds checking
  if (startWindowStart < 0 || startWindowEnd > samples.length) {
    return 0;
  }
  if (endWindowStart < 0 || endWindowEnd > samples.length) {
    return 0;
  }
  if (windowSize <= 0) {
    return 0;
  }

  // Calculate correlation components
  let sumAB = 0; // Cross product
  let sumA2 = 0; // Sum of squares for window A
  let sumB2 = 0; // Sum of squares for window B

  for (let i = 0; i < windowSize; i++) {
    const a = samples[startWindowStart + i];
    const b = samples[endWindowStart + i];

    sumAB += a * b;
    sumA2 += a * a;
    sumB2 += b * b;
  }

  // Calculate denominator
  const denominator = Math.sqrt(sumA2 * sumB2);

  // Handle edge case: zero variance (silent or DC signal)
  if (denominator === 0) {
    // If both signals have zero variance, they're identical (both silent)
    if (sumA2 === 0 && sumB2 === 0) {
      return 1;
    }
    // Otherwise, one is silent and one isn't - no correlation
    return 0;
  }

  return sumAB / denominator;
}

/**
 * Calculate NCC with mean subtraction (zero-mean NCC).
 *
 * This variant removes the DC offset from both windows before correlation,
 * making it more robust to amplitude differences between regions.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param windowSize - Number of samples to compare
 * @returns Zero-mean NCC score [-1, 1], or 0 if calculation fails
 */
export function calculateZeroMeanNCC(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  windowSize: number
): number {
  // Validate indices
  const startWindowStart = loopStart;
  const startWindowEnd = loopStart + windowSize;
  const endWindowStart = loopEnd - windowSize;
  const endWindowEnd = loopEnd;

  if (startWindowStart < 0 || startWindowEnd > samples.length) {
    return 0;
  }
  if (endWindowStart < 0 || endWindowEnd > samples.length) {
    return 0;
  }
  if (windowSize <= 0) {
    return 0;
  }

  // Calculate means
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < windowSize; i++) {
    sumA += samples[startWindowStart + i];
    sumB += samples[endWindowStart + i];
  }

  const meanA = sumA / windowSize;
  const meanB = sumB / windowSize;

  // Calculate zero-mean correlation
  let sumAB = 0;
  let sumA2 = 0;
  let sumB2 = 0;

  for (let i = 0; i < windowSize; i++) {
    const a = samples[startWindowStart + i] - meanA;
    const b = samples[endWindowStart + i] - meanB;

    sumAB += a * b;
    sumA2 += a * a;
    sumB2 += b * b;
  }

  const denominator = Math.sqrt(sumA2 * sumB2);

  if (denominator === 0) {
    if (sumA2 === 0 && sumB2 === 0) {
      return 1;
    }
    return 0;
  }

  return sumAB / denominator;
}

/**
 * Batch calculate NCC scores for multiple candidate pairs.
 *
 * This is more efficient than calling calculateNCC repeatedly because
 * it avoids repeated bounds checking and can be optimized for
 * sequential memory access.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param candidates - Array of {loopStart, loopEnd} pairs
 * @param windowSize - Number of samples to compare
 * @returns Map from "loopStart,loopEnd" key to NCC score
 */
export function batchCalculateNCC(
  samples: Int16Array,
  candidates: Array<{ loopStart: number; loopEnd: number }>,
  windowSize: number
): Map<string, number> {
  const results = new Map<string, number>();

  for (const { loopStart, loopEnd } of candidates) {
    const key = `${loopStart},${loopEnd}`;
    const score = calculateNCC(samples, loopStart, loopEnd, windowSize);
    results.set(key, score);
  }

  return results;
}

/**
 * Find the optimal window size for NCC calculation.
 *
 * The window should be large enough to capture tonal context
 * (at least one full pitch period) but small enough for efficiency.
 *
 * Recommended: 20-50ms of audio, defaulting to ~34ms (1024 samples at 30kHz).
 *
 * @param sampleRate - Sample rate in Hz
 * @param minMs - Minimum window size in milliseconds
 * @param maxMs - Maximum window size in milliseconds
 * @param targetMs - Target window size in milliseconds
 * @returns Window size in samples (power of 2 for FFT compatibility)
 */
export function calculateOptimalWindowSize(
  sampleRate: number,
  minMs: number = 20,
  maxMs: number = 50,
  targetMs: number = 34
): number {
  // Calculate target in samples
  const targetSamples = Math.round((targetMs * sampleRate) / 1000);

  // Round to nearest power of 2 (helps with FFT compatibility)
  const power = Math.round(Math.log2(targetSamples));
  let windowSize = Math.pow(2, power);

  // Clamp to min/max in samples
  const minSamples = Math.round((minMs * sampleRate) / 1000);
  const maxSamples = Math.round((maxMs * sampleRate) / 1000);

  windowSize = Math.max(minSamples, Math.min(maxSamples, windowSize));

  return windowSize;
}

/**
 * Convert NCC score to a 0-1 range for composite scoring.
 *
 * NCC ranges from -1 to 1, but for loop detection we care most about
 * positive correlation. This function maps:
 * - 1.0 -> 1.0 (perfect match)
 * - 0.0 -> 0.5 (uncorrelated)
 * - -1.0 -> 0.0 (inverted)
 *
 * @param ncc - NCC score [-1, 1]
 * @returns Normalized score [0, 1]
 */
export function normalizeNCCScore(ncc: number): number {
  return (ncc + 1) / 2;
}
