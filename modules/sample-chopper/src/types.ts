/**
 * Sample chopper type definitions.
 *
 * Generic types for slicing contiguous audio samples into individual regions.
 * No device-specific coupling.
 *
 * @packageDocumentation
 */

/**
 * Available slicing methods.
 */
export type SliceMethod = 'transient' | 'silence' | 'fixed' | 'manual';

/**
 * Configuration for transient detection slicing.
 *
 * Detects amplitude spikes above a threshold to identify
 * drum hit onsets.
 */
export interface TransientConfig {
  method: 'transient';
  /** Amplitude threshold for onset detection (0-1) */
  threshold: number;
  /** Minimum gap between detected hits in milliseconds */
  minGapMs: number;
  /** Samples to include before transient in milliseconds */
  prePadMs?: number;
  /** Samples to include after decay in milliseconds */
  postPadMs?: number;
}

/**
 * Configuration for silence detection slicing.
 *
 * Splits at gaps of silence/low amplitude between hits.
 */
export interface SilenceConfig {
  method: 'silence';
  /** Silence threshold in dB (e.g., -40) */
  thresholdDb: number;
  /** Minimum silence duration to trigger a split in milliseconds */
  minSilenceMs: number;
  /** Minimum sample length in milliseconds (discards shorter slices) */
  minSampleMs?: number;
}

/**
 * Configuration for fixed count slicing.
 *
 * Splits audio into a specified number of equal-length slices.
 * Optionally accepts an explicit interval instead.
 */
export interface FixedConfig {
  method: 'fixed';
  /** Number of equal slices to create */
  count: number;
  /** Explicit interval in ms (overrides count-based calculation if provided) */
  intervalMs?: number;
}

/**
 * Configuration for manual region slicing.
 *
 * User specifies exact start/end points for each slice.
 */
export interface ManualConfig {
  method: 'manual';
  /** User-defined regions to extract */
  regions: ManualRegion[];
}

/**
 * A manually defined slice region.
 */
export interface ManualRegion {
  /** Start time in milliseconds */
  start: number;
  /** End time in milliseconds */
  end: number;
  /** Optional name for this slice */
  name?: string;
}

/**
 * Union type for all slice configuration options.
 */
export type SliceConfig =
  | TransientConfig
  | SilenceConfig
  | FixedConfig
  | ManualConfig;

/**
 * A single slice extracted from the source audio.
 */
export interface Slice {
  /** Zero-based index of this slice */
  index: number;
  /** Start position in source samples */
  startSample: number;
  /** End position in source samples (exclusive) */
  endSample: number;
  /** Extracted audio samples (16-bit signed) */
  samples: Int16Array;
  /** Duration in milliseconds */
  durationMs: number;
  /** Optional name (from manual config) */
  name?: string;
}

/**
 * Result of slicing an audio file.
 */
export interface SliceResult {
  /** Extracted slices */
  slices: Slice[];
  /** Sample rate of the audio */
  sampleRate: number;
  /** Total duration of source audio in milliseconds */
  totalDurationMs: number;
}

/**
 * Default drum type labels in standard order.
 */
export const DEFAULT_DRUM_TYPES = ['kick', 'snare', 'hhc', 'hho'];

/**
 * Default base MIDI note (C2).
 */
export const DEFAULT_BASE_NOTE = 36;
