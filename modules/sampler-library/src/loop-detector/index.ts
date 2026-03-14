/**
 * Loop point detection and splice smoothing for Roland S-550/S-330 samplers.
 *
 * This module provides automatic loop point detection to find optimal
 * (loopStart, loopEnd) pairs where the sampler can seamlessly loop without
 * clicks, tonal discontinuities, or amplitude steps.
 *
 * @example
 * ```typescript
 * import { searchLoopPoints, applyCrossfade } from '@audiocontrol/sampler-library';
 *
 * // Find loop point candidates
 * const candidates = searchLoopPoints(samples, sampleRate);
 *
 * // Apply smoothing to the best candidate
 * if (candidates.length > 0) {
 *   const best = candidates[0];
 *   applyCrossfade(samples, best.loopStart, best.loopEnd);
 * }
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  ZeroCrossingPolarity,
  ZeroCrossing,
  LoopCandidate,
  SearchConfig,
  ScoreWeights,
  SpliceConfig,
  TransientConfig,
  ProgressCallback,
  SearchRequest,
  SearchProgress,
  SearchComplete,
  SearchError,
  SearchResponse,
} from './types.js';

export {
  DEFAULT_SEARCH_CONFIG,
  DEFAULT_SPLICE_CONFIG,
  DEFAULT_TRANSIENT_CONFIG,
  HARDWARE_CONSTRAINTS,
} from './types.js';

// Zero crossing detection
export {
  snapToWordBoundary,
  detectZeroCrossings,
  filterByPolarity,
  matchBySlope,
  findMatchingCrossings,
  calculateSlopeScore,
  generateCandidatePairs,
} from './zero-crossing-detector.js';

// Transient exclusion
export { findSustainStart, analyzeAttack } from './transient-excluder.js';

export type { AttackAnalysis } from './transient-excluder.js';

// NCC scoring
export {
  calculateNCC,
  calculateZeroMeanNCC,
  batchCalculateNCC,
  calculateOptimalWindowSize,
  normalizeNCCScore,
} from './ncc-scorer.js';

// Spectral scoring
export {
  createHannWindow,
  computeLogMagnitudeSpectrum,
  calculateSpectralDistance,
  scoreSpectralSimilarity,
  normalizeSpectralDistance,
  batchCalculateSpectralSimilarity,
  calculateOptimalFFTSize,
} from './spectral-scorer.js';

// Candidate scoring
export {
  scoreCandidate,
  calculateCompositeScore,
  scoreCandidates,
  rankCandidates,
  filterByThresholds,
  deduplicateCandidates,
} from './candidate-scorer.js';

// Loop point search
export {
  searchLoopPoints,
  quickSearchLoopPoints,
  validateCandidate,
  search,
} from './loop-point-searcher.js';

export type { SearchOptions } from './loop-point-searcher.js';

// Splice smoothing
export {
  applyCrossfade,
  createSmoothedCopy,
  calculateOptimalCrossfadeLength,
  analyzeDiscontinuity,
} from './splice-smoother.js';

export type { DiscontinuityAnalysis } from './splice-smoother.js';
