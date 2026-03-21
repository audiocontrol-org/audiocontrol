/**
 * Type definitions for loop point detection and splice smoothing.
 *
 * These types support automatic loop point detection for Roland S-550/S-330
 * samplers, implementing the algorithms described in loop-editor-spec.md.
 *
 * @packageDocumentation
 */

/**
 * Polarity of a zero crossing - the direction the waveform is moving.
 */
export type ZeroCrossingPolarity = 'positive' | 'negative';

/**
 * A zero crossing point in the waveform.
 *
 * Zero crossings are candidate points for loop boundaries because
 * they minimize amplitude discontinuity at the splice point.
 */
export interface ZeroCrossing {
  /**
   * Sample index of the zero crossing.
   * Always even (2-byte aligned) per S-550/S-330 hardware requirements.
   */
  index: number;

  /**
   * Direction the waveform is moving at the crossing point.
   * - 'positive': crossing from negative to positive values
   * - 'negative': crossing from positive to negative values
   */
  polarity: ZeroCrossingPolarity;

  /**
   * Magnitude of the first derivative (slope) at the crossing.
   * Used for slope matching between loop start and end points.
   * Normalized to [-1, 1] range based on maximum possible slope.
   */
  slope: number;
}

/**
 * A candidate loop point pair with quality scores.
 */
export interface LoopCandidate {
  /**
   * Sample index where the loop begins (playback jumps here from loopEnd).
   * Always even (2-byte aligned) per hardware requirements.
   */
  loopStart: number;

  /**
   * Sample index where the loop ends (playback jumps back to loopStart).
   * Always even (2-byte aligned) per hardware requirements.
   */
  loopEnd: number;

  /**
   * Normalized cross-correlation score [-1, 1].
   * 1.0 = perfect waveform match, -1.0 = inverted, 0 = uncorrelated.
   */
  nccScore: number;

  /**
   * Spectral similarity score [0, 1].
   * 1.0 = identical spectral envelope, 0 = completely different.
   */
  spectralScore: number;

  /**
   * Slope match score [0, 1].
   * 1.0 = identical first derivative, 0 = maximum difference.
   */
  slopeScore: number;

  /**
   * Weighted combination of all scores [0, 1].
   * Higher is better.
   */
  compositeScore: number;
}

/**
 * Configuration for the loop point search algorithm.
 */
export interface SearchConfig {
  /**
   * Search window in milliseconds for loop END candidates.
   * Searches near the end of the sample (or targetEndPoint).
   * @default 100
   */
  searchWindowMs: number;

  /**
   * Search window in milliseconds for loop START candidates.
   * Searches in the early sustain region, right after the attack.
   * A smaller value produces longer loops (start is earlier).
   * @default 200
   */
  startSearchWindowMs: number;

  /**
   * Minimum offset from sample start in milliseconds.
   * Loop start candidates before this point are excluded to avoid
   * looping into the attack transient.
   * @default 50
   */
  sustainStartMs: number;

  /**
   * Correlation window size in milliseconds.
   * Larger windows capture more tonal context but increase computation.
   * @default 34 (≈1024 samples at 30kHz)
   */
  correlationWindowMs: number;

  /**
   * Number of top candidates to return.
   * @default 10
   */
  topK: number;

  /**
   * Weights for the composite score calculation.
   * All weights should sum to 1.0 for consistent scoring.
   */
  weights: ScoreWeights;

  /**
   * Whether to automatically detect and exclude trailing silence.
   * When true, the effective end point is moved back to where
   * meaningful audio stops, preventing loops in silent regions.
   * @default true
   */
  excludeTrailingSilence: boolean;

  /**
   * Threshold in dB below which audio is considered silence.
   * Only used when excludeTrailingSilence is true.
   * More negative = more sensitive (treats quieter audio as non-silence).
   * @default -40
   */
  silenceThresholdDb: number;
}

/**
 * Weights for combining individual scores into a composite score.
 *
 * Loop length is NOT a scoring factor - instead, we constrain the search
 * regions to naturally produce long loops (start early, end late).
 */
export interface ScoreWeights {
  /**
   * Weight for normalized cross-correlation (time domain).
   * @default 0.50
   */
  ncc: number;

  /**
   * Weight for spectral envelope similarity (frequency domain).
   * @default 0.35
   */
  spectral: number;

  /**
   * Weight for slope (first derivative) match.
   * @default 0.15
   */
  slope: number;
}

/**
 * Configuration for the crossfade splice smoother.
 */
export interface SpliceConfig {
  /**
   * Length of the crossfade in samples.
   * Must be at least 8 samples for 12-bit audio to avoid quantization artifacts.
   * @default 32
   */
  crossfadeLength: number;

  /**
   * Crossfade curve type.
   * - 'linear': Simple linear fade, may have 3dB dip for uncorrelated signals
   * - 'equal-power': Sine/cosine curves, maintains perceived loudness
   * @default 'linear'
   */
  mode: 'linear' | 'equal-power';
}

/**
 * Configuration for transient (attack) detection.
 */
export interface TransientConfig {
  /**
   * RMS window size in milliseconds for envelope calculation.
   * Should span multiple waveform cycles for low-frequency sounds
   * (e.g., 50ms spans ~6.5 cycles at 130Hz).
   * @default 50
   */
  windowMs: number;

  /**
   * Hop size in milliseconds between RMS calculations.
   * @default 10
   */
  hopMs: number;

  /**
   * Threshold for envelope derivative (normalized).
   * When derivative drops below this, sustain region begins.
   * @default 0.01
   */
  derivativeThreshold: number;

  /**
   * Minimum sustain offset in milliseconds from sample start.
   * Ensures loop start is never too close to sample start.
   * @default 50
   */
  minSustainOffsetMs: number;

  /**
   * Threshold for detecting already-stable samples.
   * If the normalized envelope variance (coefficient of variation squared)
   * is below this value, the sample is considered stable from the start
   * and sustain detection is skipped.
   * @default 0.02
   */
  stableEnvelopeVarianceThreshold: number;

  /**
   * Maximum position (as ratio of sample length) for sustain detection.
   * Prevents sustain from being detected near the end of the sample,
   * which would leave no room for loop point search.
   * @default 0.25
   */
  maxSustainPositionRatio: number;
}

/**
 * Progress callback for long-running operations.
 *
 * @param percent - Completion percentage (0-100)
 * @param stage - Current processing stage description
 */
export type ProgressCallback = (percent: number, stage: string) => void;

/**
 * Message sent to the loop detection Web Worker.
 */
export interface SearchRequest {
  /**
   * Audio samples as 16-bit signed integers.
   */
  samples: Int16Array;

  /**
   * Sample rate in Hz (15000 or 30000 for S-330/S-550).
   */
  sampleRate: number;

  /**
   * Target end point around which to search for loop end candidates.
   * If not specified, searches near the end of the sample.
   */
  targetEndPoint?: number;

  /**
   * Search configuration options.
   */
  config?: Partial<SearchConfig>;
}

/**
 * Progress message from the Web Worker.
 */
export interface SearchProgress {
  type: 'progress';
  percent: number;
  stage: string;
}

/**
 * Completion message from the Web Worker.
 */
export interface SearchComplete {
  type: 'complete';
  candidates: LoopCandidate[];
}

/**
 * Error message from the Web Worker.
 */
export interface SearchError {
  type: 'error';
  message: string;
}

/**
 * All possible messages from the Web Worker.
 */
export type SearchResponse = SearchProgress | SearchComplete | SearchError;

/**
 * Default search configuration values.
 */
export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  searchWindowMs: 100,
  startSearchWindowMs: 200,
  sustainStartMs: 50,
  correlationWindowMs: 34,
  topK: 10,
  weights: {
    ncc: 0.50,
    spectral: 0.35,
    slope: 0.15,
  },
  excludeTrailingSilence: true,
  silenceThresholdDb: -40,
};

/**
 * Default splice configuration values.
 */
export const DEFAULT_SPLICE_CONFIG: SpliceConfig = {
  crossfadeLength: 32,
  mode: 'linear',
};

/**
 * Default transient configuration values.
 */
export const DEFAULT_TRANSIENT_CONFIG: TransientConfig = {
  windowMs: 50,
  hopMs: 10,
  derivativeThreshold: 0.01,
  minSustainOffsetMs: 50,
  stableEnvelopeVarianceThreshold: 0.02,
  maxSustainPositionRatio: 0.25,
};

/**
 * Hardware constraints for Roland S-550/S-330.
 */
export const HARDWARE_CONSTRAINTS = {
  /**
   * Minimum loop length in samples.
   * Shorter loops cause hardware instability.
   */
  MIN_LOOP_LENGTH: 32,

  /**
   * Maximum sample length for S-550 (in samples at base rate).
   */
  MAX_SAMPLE_LENGTH_S550: 524288,

  /**
   * Maximum sample length for S-330 (in samples at base rate).
   */
  MAX_SAMPLE_LENGTH_S330: 262144,

  /**
   * All loop point indices must be even (2-byte boundary).
   */
  WORD_ALIGNMENT: 2,
} as const;
