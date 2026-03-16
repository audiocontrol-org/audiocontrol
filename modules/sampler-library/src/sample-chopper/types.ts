/**
 * Sample chopper type definitions.
 *
 * Re-exports generic types from @audiocontrol/sample-chopper
 * and adds device-specific types.
 *
 * @packageDocumentation
 */

import type { S330WaveSampleRate } from '@/converters/index.js';

// Re-export all generic types from the standalone module
export type {
  SliceMethod,
  TransientConfig,
  SilenceConfig,
  FixedConfig,
  ManualConfig,
  ManualRegion,
  SliceConfig,
  Slice,
  SliceResult,
} from '@audiocontrol/sample-chopper';

export {
  DEFAULT_DRUM_TYPES,
  DEFAULT_BASE_NOTE,
} from '@audiocontrol/sample-chopper';

/**
 * Configuration for drum kit output generation.
 * Device-specific: uses S330WaveSampleRate.
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
  /**
   * Velocity-to-level sensitivity (0-5, default: 2).
   * Maps to the S-330's L-Curve (TVA Level Curve) parameter.
   * - 0: No velocity sensitivity (constant level)
   * - 5: Maximum velocity sensitivity
   */
  velocitySensitivity?: number;
}
