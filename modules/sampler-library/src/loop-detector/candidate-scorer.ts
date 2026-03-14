/**
 * Composite candidate scoring for loop point detection.
 *
 * Combines multiple scoring metrics (NCC, spectral similarity, slope match)
 * into a single composite score for ranking loop point candidates.
 *
 * @packageDocumentation
 */

import { calculateNCC, calculateOptimalWindowSize } from '@/loop-detector/ncc-scorer.js';
import { calculateOptimalFFTSize, scoreSpectralSimilarity } from '@/loop-detector/spectral-scorer.js';
import { calculateSlopeScore } from '@/loop-detector/zero-crossing-detector.js';
import {
  DEFAULT_SEARCH_CONFIG,
  type LoopCandidate,
  type ScoreWeights,
  type SearchConfig,
  type ZeroCrossing,
} from '@/loop-detector/types.js';

/**
 * Score a single loop point candidate pair.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param loopStart - Start index of the loop region
 * @param loopEnd - End index of the loop region
 * @param startCrossing - Zero crossing at loop start
 * @param endCrossing - Zero crossing at loop end
 * @param sampleRate - Sample rate in Hz
 * @param config - Search configuration
 * @param sustainStart - Start of sustain region (for length scoring)
 * @returns LoopCandidate with all scores
 */
export function scoreCandidate(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  startCrossing: ZeroCrossing,
  endCrossing: ZeroCrossing,
  sampleRate: number,
  config: SearchConfig = DEFAULT_SEARCH_CONFIG,
  sustainStart: number = 0
): LoopCandidate {
  // Calculate window sizes
  const nccWindowSize = calculateOptimalWindowSize(sampleRate, 20, 50, config.correlationWindowMs);
  const fftWindowSize = calculateOptimalFFTSize(sampleRate);

  // Calculate individual scores
  const nccScore = calculateNCC(samples, loopStart, loopEnd, nccWindowSize);
  const spectralScore = scoreSpectralSimilarity(samples, loopStart, loopEnd, fftWindowSize);
  const slopeScore = calculateSlopeScore(startCrossing, endCrossing);
  const lengthScore = calculateLengthScore(
    loopStart,
    loopEnd,
    sustainStart,
    samples.length,
    config.targetLoopLengthRatio,
    config.minLoopLengthRatio
  );

  // Calculate composite score
  const compositeScore = calculateCompositeScore(nccScore, spectralScore, slopeScore, lengthScore, config.weights);

  return {
    loopStart,
    loopEnd,
    nccScore,
    spectralScore,
    slopeScore,
    lengthScore,
    compositeScore,
  };
}

/**
 * Calculate loop length preference score.
 *
 * This score encourages loops that are proportional to the sample length:
 * - Very short samples (few cycles): short loops are fine
 * - Longer samples: prefer longer loops to capture more tonal variation
 *
 * The score uses a bell curve centered on the target length, with heavy
 * penalty for loops shorter than the minimum ratio.
 *
 * @param loopStart - Start of loop
 * @param loopEnd - End of loop
 * @param sustainStart - Start of sustain region
 * @param sampleLength - Total sample length
 * @param targetRatio - Target loop length as ratio of sustain region
 * @param minRatio - Minimum acceptable ratio of target length
 * @returns Length score [0, 1]
 */
export function calculateLengthScore(
  loopStart: number,
  loopEnd: number,
  sustainStart: number,
  sampleLength: number,
  targetRatio: number = 0.15,
  minRatio: number = 0.1
): number {
  const loopLength = loopEnd - loopStart;
  const sustainLength = sampleLength - sustainStart;

  // Target loop length based on sustain region
  const targetLength = sustainLength * targetRatio;

  // Minimum acceptable loop length
  const minLength = targetLength * minRatio;

  // If loop is shorter than minimum, heavily penalize
  if (loopLength < minLength) {
    // Sharp falloff below minimum
    return Math.max(0, loopLength / minLength * 0.3);
  }

  // Calculate how close we are to the target
  // Use a bell curve that's more forgiving for longer loops
  const ratio = loopLength / targetLength;

  if (ratio <= 1) {
    // Below target: linear ramp up from minRatio to 1.0
    const normalized = (ratio - minRatio) / (1 - minRatio);
    return 0.3 + normalized * 0.7;
  } else {
    // Above target: gentle falloff (longer loops are okay, just not ideal)
    // Score decreases slowly - being 2x the target still gives ~0.7 score
    const excess = ratio - 1;
    return Math.max(0.4, 1 - excess * 0.3);
  }
}

/**
 * Calculate composite score from individual metric scores.
 *
 * Formula:
 * ```
 * score = w_ncc * NCC + w_spec * spectralScore + w_slope * slopeScore + w_length * lengthScore
 * ```
 *
 * Note: NCC is in range [-1, 1], so we normalize it to [0, 1] for the composite.
 *
 * @param nccScore - Normalized cross-correlation score [-1, 1]
 * @param spectralScore - Spectral similarity score [0, 1]
 * @param slopeScore - Slope match score [0, 1]
 * @param lengthScore - Loop length preference score [0, 1]
 * @param weights - Weights for each component
 * @returns Composite score [0, 1]
 */
export function calculateCompositeScore(
  nccScore: number,
  spectralScore: number,
  slopeScore: number,
  lengthScore: number,
  weights: ScoreWeights
): number {
  // Normalize NCC from [-1, 1] to [0, 1]
  const normalizedNCC = (nccScore + 1) / 2;

  // Calculate weighted sum
  const score =
    weights.ncc * normalizedNCC +
    weights.spectral * spectralScore +
    weights.slope * slopeScore +
    weights.length * lengthScore;

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score));
}

/**
 * Score multiple loop point candidate pairs.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param candidatePairs - Array of candidate pairs with zero crossing info
 * @param sampleRate - Sample rate in Hz
 * @param config - Search configuration
 * @param sustainStart - Start of sustain region (for length scoring)
 * @returns Array of LoopCandidate with all scores
 */
export function scoreCandidates(
  samples: Int16Array,
  candidatePairs: Array<{
    loopStart: number;
    loopEnd: number;
    startCrossing: ZeroCrossing;
    endCrossing: ZeroCrossing;
  }>,
  sampleRate: number,
  config: SearchConfig = DEFAULT_SEARCH_CONFIG,
  sustainStart: number = 0
): LoopCandidate[] {
  return candidatePairs.map(({ loopStart, loopEnd, startCrossing, endCrossing }) =>
    scoreCandidate(samples, loopStart, loopEnd, startCrossing, endCrossing, sampleRate, config, sustainStart)
  );
}

/**
 * Rank candidates by composite score and return top K.
 *
 * @param candidates - Array of scored candidates
 * @param topK - Number of top candidates to return
 * @returns Top K candidates sorted by composite score (highest first)
 */
export function rankCandidates(candidates: LoopCandidate[], topK: number): LoopCandidate[] {
  // Sort by composite score (descending)
  const sorted = [...candidates].sort((a, b) => b.compositeScore - a.compositeScore);

  // Return top K
  return sorted.slice(0, topK);
}

/**
 * Filter candidates by minimum score thresholds.
 *
 * @param candidates - Array of scored candidates
 * @param thresholds - Minimum thresholds for each score component
 * @returns Filtered candidates meeting all thresholds
 */
export function filterByThresholds(
  candidates: LoopCandidate[],
  thresholds: {
    minNCC?: number;
    minSpectral?: number;
    minSlope?: number;
    minComposite?: number;
  }
): LoopCandidate[] {
  return candidates.filter((c) => {
    if (thresholds.minNCC !== undefined && c.nccScore < thresholds.minNCC) {
      return false;
    }
    if (thresholds.minSpectral !== undefined && c.spectralScore < thresholds.minSpectral) {
      return false;
    }
    if (thresholds.minSlope !== undefined && c.slopeScore < thresholds.minSlope) {
      return false;
    }
    if (thresholds.minComposite !== undefined && c.compositeScore < thresholds.minComposite) {
      return false;
    }
    return true;
  });
}

/**
 * Deduplicate candidates that are within a given sample distance.
 *
 * When multiple candidates have similar loop points, keep only the best one.
 *
 * @param candidates - Array of scored candidates (should be pre-sorted by score)
 * @param minDistance - Minimum sample distance between kept candidates
 * @returns Deduplicated candidates
 */
export function deduplicateCandidates(
  candidates: LoopCandidate[],
  minDistance: number
): LoopCandidate[] {
  const result: LoopCandidate[] = [];

  for (const candidate of candidates) {
    // Check if this candidate is too close to any already-selected candidate
    const tooClose = result.some(
      (selected) =>
        Math.abs(candidate.loopStart - selected.loopStart) < minDistance &&
        Math.abs(candidate.loopEnd - selected.loopEnd) < minDistance
    );

    if (!tooClose) {
      result.push(candidate);
    }
  }

  return result;
}
