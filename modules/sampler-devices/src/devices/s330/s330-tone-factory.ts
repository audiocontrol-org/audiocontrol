/**
 * S-330 Tone Factory
 *
 * Provides factory functions for creating S330Tone objects with sensible defaults.
 * This ensures consistent tone creation across different code paths (import, drum kit, etc.).
 *
 * @packageDocumentation
 */

import type { S330Tone, S330LoopMode } from './s330-types.js';

/**
 * Configuration for creating a new tone.
 */
export interface CreateToneConfig {
  /** Tone name (max 8 characters) */
  name: string;
  /** Sample rate */
  sampleRate: 15000 | 30000 | '15kHz' | '30kHz';
  /** Wave bank (0=A, 1=B) */
  waveBank: 0 | 1;
  /** Starting segment index */
  segmentTop: number;
  /** Number of segments */
  segmentLength: number;
  /** Number of samples */
  sampleCount: number;
  /** Loop mode (default: 'one-shot') */
  loopMode?: S330LoopMode;
  /** Loop point in samples (default: 0) */
  loopPoint?: number;
  /** Original key MIDI note (default: 60 = C4) */
  originalKey?: number;
  /** Transpose value - raw S-330 value where 0 = no pitch change (default: 0) */
  transpose?: number;
  /** Whether pitch follows MIDI note (default: false for one-shot, true for looping) */
  pitchFollow?: boolean;
  /** Output assignment (default: 0) */
  outputAssign?: number;
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
 * Create a new S330Tone with sensible defaults for one-shot samples.
 *
 * The defaults are optimized for one-shot playback (drum hits, sound effects):
 * - transpose: 0 (no pitch change - raw S-330 value, NOT standard MIDI bipolar)
 * - pitchFollow: false (plays at recorded pitch regardless of MIDI note)
 * - loopMode: 'one-shot' (plays once, no looping)
 * - TVF/TVA envelopes: flat (no filtering or amplitude shaping)
 *
 * For melodic samples that should track pitch, set pitchFollow: true and
 * optionally adjust transpose for tuning.
 */
export function createTone(config: CreateToneConfig): S330Tone {
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
      levelCurve: 0,
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
