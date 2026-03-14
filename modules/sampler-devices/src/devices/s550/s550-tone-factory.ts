/**
 * S-550 Tone Factory
 *
 * Provides factory functions for creating S550Tone objects with sensible defaults.
 * This ensures consistent tone creation across different code paths (import, drum kit, etc.).
 *
 * Supports both primary tones (with wave data) and sub-tones (referencing another tone's wave).
 *
 * @packageDocumentation
 */

import type { S550Tone, SSeriesLoopMode } from './s550-types.js';

/**
 * Configuration for creating a new tone.
 */
export interface CreateToneConfig {
  /** Tone name (max 8 characters) */
  name: string;
  /** Sample rate */
  sampleRate: 15000 | 30000 | '15kHz' | '30kHz';
  /** Wave bank (0=A, 1=B, 2=C, 3=D for S-550) */
  waveBank: 0 | 1 | 2 | 3;
  /** Starting segment index */
  segmentTop: number;
  /** Number of segments */
  segmentLength: number;
  /** Number of samples */
  sampleCount: number;
  /** Loop mode (default: 'one-shot') */
  loopMode?: SSeriesLoopMode;
  /** Loop point in samples (default: 0) */
  loopPoint?: number;
  /** Original key MIDI note (default: 60 = C4) */
  originalKey?: number;
  /**
   * Transpose value in semitones.
   *
   * WARNING: The S-550 uses 0 as the default (no pitch change), NOT 64.
   * Do not assume standard MIDI bipolar encoding. Pass semitone values directly:
   * - 0 = no pitch change
   * - negative = pitch down
   * - positive = pitch up
   */
  transpose?: number;
  /** Whether pitch follows MIDI note (default: false for one-shot, true for looping) */
  pitchFollow?: boolean;
  /** Output assignment (default: 0) */
  outputAssign?: number;
  /**
   * Velocity-to-level sensitivity (0-5, default: 0).
   * Maps to the S-550's L-Curve (TVA Level Curve) parameter.
   * - 0: No velocity sensitivity (constant level)
   * - 5: Maximum velocity sensitivity
   */
  velocitySensitivity?: number;
}

/**
 * Normalize sample rate to string format.
 */
function normalizeSampleRate(rate: 15000 | 30000 | '15kHz' | '30kHz'): '15kHz' | '30kHz' {
  if (typeof rate === 'number') {
    return rate === 30000 ? '30kHz' : '15kHz';
  }
  return rate;
}

/**
 * Create a new S550Tone with sensible defaults for one-shot samples.
 *
 * The defaults are optimized for one-shot playback (drum hits, sound effects):
 * - transpose: 0 (no pitch change)
 * - pitchFollow: false (plays at recorded pitch regardless of MIDI note)
 * - loopMode: 'one-shot' (plays once, no looping)
 * - TVF/TVA envelopes: flat (no filtering or amplitude shaping)
 *
 * WARNING: The S-550 transpose parameter uses 0 as the default (no pitch change).
 * Do NOT assume standard MIDI bipolar encoding where 64 = center.
 * Pass semitone values directly: 0 = no change, negative = down, positive = up.
 *
 * For melodic samples that should track pitch, set pitchFollow: true and
 * optionally adjust transpose for tuning.
 */
export function createTone(config: CreateToneConfig): S550Tone {
  const {
    name,
    sampleRate,
    waveBank,
    segmentTop,
    segmentLength,
    sampleCount,
    loopMode = 'one-shot',
    loopPoint = 0,
    originalKey = 60,
    transpose = 0,
    pitchFollow,
    outputAssign = 0,
    velocitySensitivity = 0,
  } = config;

  // Default pitchFollow based on loop mode if not explicitly set
  const effectivePitchFollow = pitchFollow ?? (loopMode !== 'one-shot');

  return {
    name: name.slice(0, 8).toUpperCase().padEnd(8, ' '),
    outputAssign,
    sourceTone: 0,
    origSubTone: 0,
    sampleRate: normalizeSampleRate(sampleRate),
    originalKey,
    wave: {
      bank: waveBank,
      segmentTop,
      segmentLength,
      startPoint: 0,
      endPoint: Math.max(0, sampleCount - 1),
      loopPoint,
      loopLength: Math.max(0, sampleCount - 1 - loopPoint),
    },
    loopMode,
    lfo: {
      rate: 50,
      sync: false,
      delay: 0,
      mode: 'normal',
      polarity: false,
      offset: 64,
    },
    tvaLfoDepth: 0,
    transpose,
    fineTune: 0,
    tvf: {
      cutoff: 127,
      resonance: 0,
      keyFollow: 0,
      lfoDepth: 0,
      egDepth: 0,
      egPolarity: 'normal',
      levelCurve: 0,
      keyRateFollow: 0,
      velRateFollow: 0,
      enabled: false,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 127],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 7,
        endPoint: 8,
      },
    },
    tva: {
      lfoDepth: 0,
      keyRate: 0,
      level: 127,
      velRate: 0,
      levelCurve: Math.max(0, Math.min(5, velocitySensitivity)) as 0 | 1 | 2 | 3 | 4 | 5,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 30],
        sustainPoint: 6,
        endPoint: 8,
      },
    },
    benderEnabled: effectivePitchFollow,
    aftertouchEnabled: false,
    pitchFollow: effectivePitchFollow,
    recThreshold: 64,
    recPreTrigger: 0,
    loopTune: 0,
    envZoom: 0,
    copySource: 0,
  };
}

/**
 * Configuration for creating a sub-tone that shares wave data with a primary tone.
 */
export interface CreateSubToneConfig {
  /** Tone name (max 8 characters) */
  name: string;
  /** Index of the source tone (0-63 for S-550) that owns the wave data */
  sourceToneIndex: number;
  /** Sample rate (must match source tone) */
  sampleRate: 15000 | 30000 | '15kHz' | '30kHz';
  /** Start point within the shared wave data (in samples) */
  startPoint: number;
  /** End point within the shared wave data (in samples) */
  endPoint: number;
  /** Loop mode (default: 'one-shot') */
  loopMode?: SSeriesLoopMode;
  /** Loop point in samples (default: startPoint) */
  loopPoint?: number;
  /** Original key MIDI note (default: 60 = C4) */
  originalKey?: number;
  /** Transpose value in semitones (0 = no pitch change) */
  transpose?: number;
  /** Whether pitch follows MIDI note (default: false for one-shot) */
  pitchFollow?: boolean;
  /** Output assignment (default: 0) */
  outputAssign?: number;
  /** Velocity-to-level sensitivity (0-5, default: 0) */
  velocitySensitivity?: number;
}

/**
 * Create a sub-tone that shares wave data with a primary tone.
 *
 * Sub-tones use `origSubTone=1` and reference the primary tone via `sourceTone`.
 * They have their own start/end points within the shared wave data, allowing
 * multiple tones to play different regions of the same sample.
 *
 * Use case: Monolithic drum kits where one wave upload contains all slices,
 * and each sub-tone plays a different slice region.
 *
 * @param config - Sub-tone configuration
 * @returns S550Tone configured as a sub-tone
 */
export function createSubTone(config: CreateSubToneConfig): S550Tone {
  const {
    name,
    sourceToneIndex,
    sampleRate,
    startPoint,
    endPoint,
    loopMode = 'one-shot',
    loopPoint = startPoint,
    originalKey = 60,
    transpose = 0,
    pitchFollow,
    outputAssign = 0,
    velocitySensitivity = 0,
  } = config;

  const effectivePitchFollow = pitchFollow ?? (loopMode !== 'one-shot');

  return {
    name: name.slice(0, 8).toUpperCase().padEnd(8, ' '),
    outputAssign,
    // Sub-tone references: point to source tone and mark as SUB
    // S-550 has 64 tones, so use 6-bit mask
    sourceTone: sourceToneIndex & 0x3F,
    origSubTone: 1, // 1 = SUB (references another tone's wave data)
    sampleRate: normalizeSampleRate(sampleRate),
    originalKey,
    wave: {
      // Wave bank/segment params may be ignored for sub-tones,
      // but we set them to 0 for clarity
      bank: 0,
      segmentTop: 0,
      segmentLength: 0,
      // These are the key parameters - playback window within shared wave
      startPoint,
      endPoint,
      loopPoint,
      loopLength: Math.max(0, endPoint - loopPoint),
    },
    loopMode,
    lfo: {
      rate: 50,
      sync: false,
      delay: 0,
      mode: 'normal',
      polarity: false,
      offset: 64,
    },
    tvaLfoDepth: 0,
    transpose,
    fineTune: 0,
    tvf: {
      cutoff: 127,
      resonance: 0,
      keyFollow: 0,
      lfoDepth: 0,
      egDepth: 0,
      egPolarity: 'normal',
      levelCurve: 0,
      keyRateFollow: 0,
      velRateFollow: 0,
      enabled: false,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 127],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 7,
        endPoint: 8,
      },
    },
    tva: {
      lfoDepth: 0,
      keyRate: 0,
      level: 127,
      velRate: 0,
      levelCurve: Math.max(0, Math.min(5, velocitySensitivity)) as 0 | 1 | 2 | 3 | 4 | 5,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 30],
        sustainPoint: 6,
        endPoint: 8,
      },
    },
    benderEnabled: effectivePitchFollow,
    aftertouchEnabled: false,
    pitchFollow: effectivePitchFollow,
    recThreshold: 64,
    recPreTrigger: 0,
    loopTune: 0,
    envZoom: 0,
    copySource: 0,
  };
}

/**
 * Create a primary tone for monolithic wave data (all slices in one wave).
 *
 * This tone owns the wave data and can be referenced by sub-tones.
 * The startPoint/endPoint define the playback region for this primary tone
 * (typically the first slice).
 *
 * @param config - Tone configuration (uses standard CreateToneConfig)
 * @param startPoint - Start point for this tone's playback region
 * @param endPoint - End point for this tone's playback region
 * @returns S550Tone configured as primary tone with specified playback window
 */
export function createMonolithicPrimaryTone(
  config: CreateToneConfig,
  startPoint: number,
  endPoint: number
): S550Tone {
  const tone = createTone(config);

  // Override the auto-calculated start/end with the slice boundaries
  tone.wave.startPoint = startPoint;
  tone.wave.endPoint = endPoint;
  tone.wave.loopPoint = startPoint;
  tone.wave.loopLength = endPoint - startPoint;

  // Ensure it's marked as primary (ORG)
  tone.sourceTone = 0;
  tone.origSubTone = 0;

  return tone;
}
