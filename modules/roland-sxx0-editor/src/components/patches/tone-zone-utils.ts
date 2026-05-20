/**
 * Pure helpers for the Tone Zone Editor. Extracted so the React
 * component itself stays under the file-length cap and the
 * zone-array <-> zone-list conversion is unit-testable without
 * loading any UI dependencies.
 */

import type { SamplerKeyMode } from '@/core/midi/SamplerClient';
import {
  TONE_LAYER_MIN_MIDI_NOTE,
  TONE_LAYER_MAX_MIDI_NOTE,
  TONE_LAYER_SIZE,
  TONE_LAYER_OFF,
} from '@audiocontrol/sampler-devices/s330';

/**
 * A contiguous range of keys mapped to a single tone.
 * `startKey` / `endKey` are MIDI note numbers; `tone` is a tone
 * index (or TONE_LAYER_OFF for Layer 1 OFF segments).
 */
export interface ToneZone {
  startKey: number;
  endKey: number;
  tone: number;
}

export const MIN_KEY = TONE_LAYER_MIN_MIDI_NOTE;
export const MAX_KEY = TONE_LAYER_MAX_MIDI_NOTE;
export const TOTAL_KEYS = TONE_LAYER_SIZE;

/** Layer N's "absent zone" value: -1 for Layer 1 (OFF), 0 for Layer 2 (default). */
export function offValueForLayer(layer: 1 | 2): number {
  return layer === 1 ? TONE_LAYER_OFF : 0;
}

/** Convert a 109-entry tone array to a list of contiguous zones. */
export function arrayToZones(data: number[], layer: 1 | 2): ToneZone[] {
  const zones: ToneZone[] = [];
  const off = offValueForLayer(layer);
  let i = 0;

  while (i < TOTAL_KEYS) {
    const tone = data[i];
    if (tone === off) { i++; continue; }
    const startKey = MIN_KEY + i;
    while (i < TOTAL_KEYS && data[i] === tone) i++;
    zones.push({ startKey, endKey: MIN_KEY + i - 1, tone });
  }

  return zones;
}

/** Convert a list of zones back to a 109-entry array. */
export function zonesToArray(zones: ToneZone[], layer: 1 | 2): number[] {
  const off = offValueForLayer(layer);
  const result = new Array(TOTAL_KEYS).fill(off);
  for (const zone of zones) {
    for (let key = zone.startKey; key <= zone.endKey; key++) {
      const idx = key - MIN_KEY;
      if (idx >= 0 && idx < TOTAL_KEYS) result[idx] = zone.tone;
    }
  }
  return result;
}

/**
 * Layer 2 only exists in dual-layer key modes (V-Sw / X-Fade / V-Mix /
 * Unison). In Normal mode the second layer is hidden.
 */
export function usesDualLayers(keyMode: SamplerKeyMode): boolean {
  return keyMode !== 'normal';
}

/**
 * Find a placement for a new zone — the first off-value gap that fits
 * up to 12 keys, falling back to the top octave of the keybed.
 */
export function findInsertionRange(
  data: number[],
  layer: 1 | 2,
): { startKey: number; endKey: number } {
  const off = offValueForLayer(layer);
  for (let i = 0; i < TOTAL_KEYS; i++) {
    if (data[i] !== off) continue;
    const startKey = MIN_KEY + i;
    let endKey = startKey;
    while (i < TOTAL_KEYS - 1 && data[i + 1] === off && endKey - startKey < 11) {
      i++;
      endKey = MIN_KEY + i;
    }
    return { startKey, endKey };
  }
  // No gap found — place at the top of the keybed.
  return { startKey: MAX_KEY - 11, endKey: MAX_KEY };
}

/** Per-zone hue offset for the `--ac-zone-hue` custom property. */
export function zoneHueOffset(toneIndex: number): number {
  if (toneIndex < 0) return 0;
  return (toneIndex * 31) % 360;
}
