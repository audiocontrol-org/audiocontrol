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
 * @returns LoopCandidate with all scores
 */
export function scoreCandidate(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  startCrossing: ZeroCrossing,
  endCrossing: ZeroCrossing,
  sampleRate: number,
  config: SearchConfig = DEFAULT_SEARCH_CONFIG
): LoopCandidate {
  // Calculate window sizes
  const nccWindowSize = calculateOptimalWindowSize(sampleRate, 20, 50, config.correlationWindowMs);
  const fftWindowSize = calculateOptimalFFTSize(sampleRate);

  // Calculate individual scores
  const nccScore = calculateNCC(samples, loopStart, loopEnd, nccWindowSize);
  const spectralScore = scoreSpectralSimilarity(samples, loopStart, loopEnd, fftWindowSize);
  const slopeScore = calculateSlopeScore(startCrossing, endCrossing);

  // Calculate composite score
  const compositeScore = calculateCompositeScore(nccScore, spectralScore, slopeScore, config.weights);

  return {
    loopStart,
    loopEnd,
    nccScore,
    spectralScore,
    slopeScore,
    compositeScore,
  };
}

/**
 * Calculate composite score from individual metric scores.
 *
 * Formula:
 * ```
 * score = w_ncc * NCC + w_spec * spectralScore + w_slope * slopeScore
 * ```
 *
 * Note: NCC is in range [-1, 1], so we normalize it to [0, 1] for the composite.
 *
 * @param nccScore - Normalized cross-correlation score [-1, 1]
 * @param spectralScore - Spectral similarity score [0, 1]
 * @param slopeScore - Slope match score [0, 1]
 * @param weights - Weights for each component
 * @returns Composite score [0, 1]
 */
export function calculateCompositeScore(
  nccScore: number,
  spectralScore: number,
  slopeScore: number,
  weights: ScoreWeights
): number {
  // Normalize NCC from [-1, 1] to [0, 1]
  const normalizedNCC = (nccScore + 1) / 2;

  // Calculate weighted sum
  const score =
    weights.ncc * normalizedNCC + weights.spectral * spectralScore + weights.slope * slopeScore;

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
  config: SearchConfig = DEFAULT_SEARCH_CONFIG
): LoopCandidate[] {
  return candidatePairs.map(({ loopStart, loopEnd, startCrossing, endCrossing }) =>
    scoreCandidate(samples, loopStart, loopEnd, startCrossing, endCrossing, sampleRate, config)
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
