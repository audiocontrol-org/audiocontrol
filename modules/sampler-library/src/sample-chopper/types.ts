/**
 * Sample chopper type definitions.
 *
 * Types for slicing contiguous audio samples into individual hits
 * for drum kit creation.
 *
 * @packageDocumentation
 */

import type { S330WaveSampleRate } from '@/converters/index.js';

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
 * Configuration for fixed interval slicing.
 *
 * Splits at regular time intervals (for metronome-recorded hits).
 */
export interface FixedConfig {
  method: 'fixed';
  /** Interval between slice points in milliseconds */
  intervalMs: number;
  /** Expected number of slices (optional, for validation) */
  count?: number;
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
 * Configuration for drum kit output generation.
 */
export interface DrumKitOutputConfig {
  /** Name for the drum kit */
  name: string;
  /** Target sample rate for output */
  sampleRate: S330WaveSampleRate;
  /** Base MIDI note (default: 36 = C2) */
  baseNote?: number;
  /** Labels for each slice (e.g., ['kick', 'snare', 'hhc', 'hho']) */
  drumTypes?: string[];
  /**
   * Transpose value in semitones for pitch adjustment.
   * Use this to pitch samples up or down on playback.
   * Common use case: sample at high speed, then pitch down for more sample time.
   * Range: -64 to +63, where 0 = no pitch change.
   */
  transpose?: number;
}

/**
 * Default drum type labels in standard order.
 */
export const DEFAULT_DRUM_TYPES = ['kick', 'snare', 'hhc', 'hho'];

/**
 * Default base MIDI note (C2).
 */
export const DEFAULT_BASE_NOTE = 36;
