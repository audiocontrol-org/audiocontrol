/**
 * Loop point search orchestrator.
 *
 * Coordinates the full loop point detection pipeline:
 * 1. Find sustain region (transient exclusion)
 * 2. Detect zero crossings
 * 3. Generate candidate pairs
 * 4. Score candidates
 * 5. Rank and return top K
 *
 * @packageDocumentation
 */

import { msToSamples, calculateRms, dbToAmplitude, amplitudeToDb } from '@/sample-chopper/audio-utils.js';
import { deduplicateCandidates, rankCandidates, scoreCandidates } from '@/loop-detector/candidate-scorer.js';
import { findSustainStart } from '@/loop-detector/transient-excluder.js';
import {
  DEFAULT_SEARCH_CONFIG,
  HARDWARE_CONSTRAINTS,
  type LoopCandidate,
  type ProgressCallback,
  type SearchConfig,
} from '@/loop-detector/types.js';
import { detectZeroCrossings, generateCandidatePairs, snapToWordBoundary } from '@/loop-detector/zero-crossing-detector.js';

/**
 * Error thrown when loop detection fails due to sample characteristics.
 */
export class LoopDetectionError extends Error {
  constructor(
    message: string,
    public readonly reason: 'decaying_sample' | 'no_usable_candidates' | 'silent_sample' | 'too_short'
  ) {
    super(message);
    this.name = 'LoopDetectionError';
  }
}

/**
 * Calculate the average RMS level at a loop candidate's region.
 *
 * @param samples - Audio samples
 * @param loopStart - Loop start point
 * @param loopEnd - Loop end point
 * @param sampleRate - Sample rate in Hz
 * @returns RMS level (0-1 normalized)
 */
function calculateLoopRegionRms(
  samples: Int16Array,
  loopStart: number,
  loopEnd: number,
  sampleRate: number
): number {
  const windowMs = 50; // 50ms analysis window
  const windowSamples = msToSamples(windowMs, sampleRate);

  // Calculate RMS at the start and end of the loop region
  const startRms = calculateRms(samples, loopStart, Math.min(windowSamples, loopEnd - loopStart));
  const endRms = calculateRms(samples, Math.max(loopStart, loopEnd - windowSamples), windowSamples);

  // Return the average
  return (startRms + endRms) / 2;
}

/**
 * Find where meaningful audio ends by scanning backwards for silence.
 *
 * @param samples - Audio samples
 * @param sampleRate - Sample rate in Hz
 * @param thresholdDb - Silence threshold in dB
 * @param startPoint - Point to start scanning back from
 * @returns Index where audio content ends (last non-silent sample)
 */
function findAudioEnd(
  samples: Int16Array,
  sampleRate: number,
  thresholdDb: number,
  startPoint: number
): number {
  const windowSizeSamples = msToSamples(5, sampleRate); // 5ms analysis window
  const threshold = dbToAmplitude(thresholdDb);
  const minAudioEnd = HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH * 2; // Don't trim past this

  // Scan backwards from startPoint to find last non-silent window
  for (let pos = startPoint - windowSizeSamples; pos >= minAudioEnd; pos -= windowSizeSamples) {
    const rms = calculateRms(samples, pos, windowSizeSamples);
    if (rms >= threshold) {
      // Found non-silent audio - return end of this window
      return Math.min(pos + windowSizeSamples, startPoint);
    }
  }

  // No audio found above threshold - return original point
  return startPoint;
}

/**
 * Search for optimal loop points in a sample.
 *
 * This is the main entry point for loop point detection. It orchestrates
 * all the sub-modules to find and rank loop point candidates.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param sampleRate - Sample rate in Hz
 * @param targetEndPoint - Target end point (or end of sample if not specified)
 * @param config - Search configuration
 * @param onProgress - Optional progress callback
 * @returns Array of top K loop point candidates
 */
export function searchLoopPoints(
  samples: Int16Array,
  sampleRate: number,
  targetEndPoint?: number,
  config: Partial<SearchConfig> = {},
  onProgress?: ProgressCallback
): LoopCandidate[] {
  const cfg: SearchConfig = {
    ...DEFAULT_SEARCH_CONFIG,
    ...config,
  };

  // Validate sample
  if (samples.length < HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH * 2) {
    throw new LoopDetectionError(
      'Sample is too short for loop detection.',
      'too_short'
    );
  }

  // Step 1: Find sustain region (10%)
  onProgress?.(0, 'Analyzing transient...');

  const sustainStart = findSustainStart(samples, sampleRate, {
    minSustainOffsetMs: cfg.sustainStartMs,
  });

  // Check if this is a decaying sample (sustain starts past 50% of sample)
  const sustainRatio = sustainStart / samples.length;
  const isDecayingSample = sustainRatio > 0.5;

  onProgress?.(10, 'Finding zero crossings...');

  // Step 2: Determine search regions
  // Strategy: Search for start candidates EARLY in the sustain region,
  // and end candidates LATE in the sample. This naturally produces long loops.
  let effectiveEndPoint = targetEndPoint ?? samples.length;

  const endSearchWindowSamples = msToSamples(cfg.searchWindowMs, sampleRate);
  const startSearchWindowSamples = msToSamples(cfg.startSearchWindowMs, sampleRate);

  // Step 2a: Exclude trailing silence if configured
  // This prevents finding "perfect" loops in silent regions at the end of samples
  if (cfg.excludeTrailingSilence) {
    const audioEnd = findAudioEnd(samples, sampleRate, cfg.silenceThresholdDb, effectiveEndPoint);
    if (audioEnd < effectiveEndPoint) {
      // Check if trimming would leave enough space for valid search regions
      // We need at least: sustainStart + startSearchWindow + MIN_LOOP_LENGTH + endSearchWindow
      const minRequiredLength = sustainStart + startSearchWindowSamples +
        HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH + endSearchWindowSamples;

      if (audioEnd >= minRequiredLength) {
        effectiveEndPoint = audioEnd;
        onProgress?.(15, `Excluded trailing silence (audio ends at sample ${audioEnd})`);
      } else {
        // Trimming would create invalid search regions - skip trimming
        onProgress?.(15, 'Trailing silence detected but preserving for valid search regions');
      }
    }
  }

  // Loop START search region: early sustain region (right after attack)
  // Constrained to the first startSearchWindowMs of the sustain region
  const startSearchStart = snapToWordBoundary(sustainStart);
  const startSearchEnd = snapToWordBoundary(
    Math.min(sustainStart + startSearchWindowSamples, effectiveEndPoint - HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH)
  );

  // Loop END search region: near the end of the sample
  const endSearchStart = snapToWordBoundary(
    Math.max(startSearchEnd + HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH, effectiveEndPoint - endSearchWindowSamples)
  );
  const endSearchEnd = snapToWordBoundary(Math.min(samples.length, effectiveEndPoint));

  // Check if we have valid search regions
  if (startSearchEnd <= startSearchStart || endSearchEnd <= endSearchStart) {
    return []; // Not enough space for loop detection
  }

  // Step 3: Detect zero crossings in both regions
  const startCrossings = detectZeroCrossings(samples, startSearchStart, startSearchEnd);
  const endCrossings = detectZeroCrossings(samples, endSearchStart, endSearchEnd);

  onProgress?.(30, `Found ${startCrossings.length} start and ${endCrossings.length} end crossings`);

  // Check if we have any crossings
  if (startCrossings.length === 0 || endCrossings.length === 0) {
    return []; // No zero crossings found
  }

  // Step 4: Generate candidate pairs
  onProgress?.(40, 'Generating candidate pairs...');

  // Use slope tolerance for pre-filtering if we have many crossings
  const totalPairs = startCrossings.length * endCrossings.length;
  const slopeTolerance = totalPairs > 1000 ? 0.3 : null; // Pre-filter if too many pairs

  const candidatePairs = generateCandidatePairs(
    startCrossings,
    endCrossings,
    HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH,
    slopeTolerance
  );

  onProgress?.(50, `Generated ${candidatePairs.length} candidate pairs`);

  if (candidatePairs.length === 0) {
    return [];
  }

  // Step 5: Score candidates (most expensive step)
  onProgress?.(60, 'Scoring candidates...');

  // If we have too many candidates, sample them
  const maxCandidatesToScore = 500;
  let pairsToScore = candidatePairs;

  if (candidatePairs.length > maxCandidatesToScore) {
    // Take evenly distributed sample
    pairsToScore = sampleCandidates(candidatePairs, maxCandidatesToScore);
  }

  const scoredCandidates = scoreCandidates(samples, pairsToScore, sampleRate, cfg);

  onProgress?.(80, 'Ranking candidates...');

  // Step 6: Rank and deduplicate
  const ranked = rankCandidates(scoredCandidates, cfg.topK * 3); // Get more for deduplication

  // Deduplicate candidates within 100 samples of each other
  const deduplicationDistance = Math.min(100, msToSamples(5, sampleRate));
  const deduplicated = deduplicateCandidates(ranked, deduplicationDistance);

  // Step 7: Filter out candidates in silent/near-silent regions
  const silenceThreshold = dbToAmplitude(cfg.silenceThresholdDb);
  const usableCandidates = deduplicated.filter((candidate) => {
    const loopRms = calculateLoopRegionRms(samples, candidate.loopStart, candidate.loopEnd, sampleRate);
    return loopRms >= silenceThreshold;
  });

  // If no usable candidates, provide a helpful error
  if (usableCandidates.length === 0) {
    if (isDecayingSample) {
      throw new LoopDetectionError(
        'No suitable loop points found. This appears to be a decaying sample without a sustained region.',
        'decaying_sample'
      );
    } else if (deduplicated.length > 0) {
      // We found candidates but they were all in silent regions
      throw new LoopDetectionError(
        'No suitable loop points found. All candidate regions are too quiet for a usable loop.',
        'no_usable_candidates'
      );
    } else {
      throw new LoopDetectionError(
        'No suitable loop points found in this sample.',
        'no_usable_candidates'
      );
    }
  }

  // Take top K
  const topK = usableCandidates.slice(0, cfg.topK);

  onProgress?.(100, `Found ${topK.length} candidates`);

  return topK;
}

/**
 * Sample candidates evenly from a larger set.
 *
 * Used when there are too many candidates to score efficiently.
 *
 * @param candidates - Full array of candidates
 * @param count - Number of candidates to sample
 * @returns Evenly sampled candidates
 */
function sampleCandidates<T>(candidates: T[], count: number): T[] {
  if (candidates.length <= count) {
    return candidates;
  }

  const step = candidates.length / count;
  const result: T[] = [];

  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * step);
    result.push(candidates[index]);
  }

  return result;
}

/**
 * Quick search for loop points with reduced accuracy.
 *
 * Uses only NCC scoring (no spectral analysis) for faster results.
 * Suitable for real-time preview or initial suggestions.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param sampleRate - Sample rate in Hz
 * @param targetEndPoint - Target end point
 * @param topK - Number of candidates to return
 * @returns Array of loop point candidates (NCC only)
 */
export function quickSearchLoopPoints(
  samples: Int16Array,
  sampleRate: number,
  targetEndPoint?: number,
  topK: number = 5
): LoopCandidate[] {
  // Use a smaller search window and no spectral scoring
  const config: Partial<SearchConfig> = {
    searchWindowMs: 50,
    topK,
    // Adjust weights to use only NCC and slope
    weights: {
      ncc: 0.85,
      spectral: 0,
      slope: 0.15,
    },
  };

  return searchLoopPoints(samples, sampleRate, targetEndPoint, config);
}

/**
 * Validate that a loop point candidate is valid for the hardware.
 *
 * @param candidate - Loop point candidate to validate
 * @param samples - Audio samples
 * @returns true if valid, false otherwise
 */
export function validateCandidate(candidate: LoopCandidate, samples: Int16Array): boolean {
  // Check word alignment
  if (candidate.loopStart % HARDWARE_CONSTRAINTS.WORD_ALIGNMENT !== 0) {
    return false;
  }
  if (candidate.loopEnd % HARDWARE_CONSTRAINTS.WORD_ALIGNMENT !== 0) {
    return false;
  }

  // Check bounds
  if (candidate.loopStart < 0 || candidate.loopStart >= samples.length) {
    return false;
  }
  if (candidate.loopEnd < 0 || candidate.loopEnd > samples.length) {
    return false;
  }

  // Check minimum loop length
  if (candidate.loopEnd - candidate.loopStart < HARDWARE_CONSTRAINTS.MIN_LOOP_LENGTH) {
    return false;
  }

  // Check ordering
  if (candidate.loopStart >= candidate.loopEnd) {
    return false;
  }

  return true;
}

/**
 * Search options for configuring the search behavior.
 */
export interface SearchOptions {
  /**
   * Whether to use quick search (NCC only, no spectral).
   */
  quick?: boolean;

  /**
   * Partial search configuration.
   */
  config?: Partial<SearchConfig>;

  /**
   * Progress callback.
   */
  onProgress?: ProgressCallback;
}

/**
 * Main search function with options.
 *
 * @param samples - Audio samples as 16-bit signed integers
 * @param sampleRate - Sample rate in Hz
 * @param targetEndPoint - Target end point
 * @param options - Search options
 * @returns Array of loop point candidates
 */
export function search(
  samples: Int16Array,
  sampleRate: number,
  targetEndPoint?: number,
  options: SearchOptions = {}
): LoopCandidate[] {
  if (options.quick) {
    return quickSearchLoopPoints(samples, sampleRate, targetEndPoint, options.config?.topK);
  }

  return searchLoopPoints(samples, sampleRate, targetEndPoint, options.config, options.onProgress);
}
