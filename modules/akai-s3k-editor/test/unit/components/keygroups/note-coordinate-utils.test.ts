import { describe, it, expect } from 'vitest';
import {
  clampNote,
  clampVelocity,
  computeKeyRange,
  noteToPercent,
  percentToNote,
  velocityToPercent,
  velocityToPercentInverted,
  getVisibleOctaveMarkers,
  OCTAVE_MARKERS,
  TOTAL_NOTES,
  VELOCITY_MAX,
} from '@/components/keygroups/note-coordinate-utils';

describe('note-coordinate-utils', () => {
  describe('constants', () => {
    it('TOTAL_NOTES is 128', () => {
      expect(TOTAL_NOTES).toBe(128);
    });

    it('VELOCITY_MAX is 127', () => {
      expect(VELOCITY_MAX).toBe(127);
    });

    it('OCTAVE_MARKERS contains C-1 through C9', () => {
      expect(OCTAVE_MARKERS[0]).toEqual({ note: 0, label: 'C-1' });
      expect(OCTAVE_MARKERS[OCTAVE_MARKERS.length - 1]).toEqual({
        note: 120,
        label: 'C9',
      });
      expect(OCTAVE_MARKERS.length).toBe(11);
    });
  });

  describe('clampNote', () => {
    it('clamps below 0', () => {
      expect(clampNote(-5)).toBe(0);
    });

    it('clamps above 127', () => {
      expect(clampNote(200)).toBe(127);
    });

    it('rounds to nearest integer', () => {
      expect(clampNote(60.7)).toBe(61);
      expect(clampNote(60.3)).toBe(60);
    });

    it('passes through valid values', () => {
      expect(clampNote(64)).toBe(64);
      expect(clampNote(0)).toBe(0);
      expect(clampNote(127)).toBe(127);
    });
  });

  describe('clampVelocity', () => {
    it('clamps below 0', () => {
      expect(clampVelocity(-1)).toBe(0);
    });

    it('clamps above 127', () => {
      expect(clampVelocity(128)).toBe(127);
    });

    it('passes through valid values', () => {
      expect(clampVelocity(100)).toBe(100);
    });
  });

  describe('computeKeyRange', () => {
    it('returns full range when no keygroups are loaded', () => {
      const result = computeKeyRange([], 0);
      expect(result).toEqual({ min: 0, max: 127 });
    });

    it('returns full range when all keygroups are undefined', () => {
      const result = computeKeyRange([undefined, undefined], 2);
      expect(result).toEqual({ min: 0, max: 127 });
    });

    it('adds 4-note padding on each side', () => {
      const keygroups = [{ LONOTE: 36, HINOTE: 72 }];
      const result = computeKeyRange(keygroups, 1);
      expect(result).toEqual({ min: 32, max: 76 });
    });

    it('clamps padding to 0 and 127', () => {
      const keygroups = [{ LONOTE: 2, HINOTE: 125 }];
      const result = computeKeyRange(keygroups, 1);
      expect(result).toEqual({ min: 0, max: 127 });
    });

    it('spans multiple keygroups', () => {
      const keygroups = [
        { LONOTE: 36, HINOTE: 48 },
        { LONOTE: 60, HINOTE: 84 },
      ];
      const result = computeKeyRange(keygroups, 2);
      expect(result).toEqual({ min: 32, max: 88 });
    });

    it('only considers keygroups up to keygroupCount', () => {
      const keygroups = [
        { LONOTE: 36, HINOTE: 48 },
        { LONOTE: 0, HINOTE: 127 },
      ];
      // Only look at the first keygroup
      const result = computeKeyRange(keygroups, 1);
      expect(result).toEqual({ min: 32, max: 52 });
    });
  });

  describe('noteToPercent', () => {
    it('maps range.min to 0%', () => {
      expect(noteToPercent(32, { min: 32, max: 76 })).toBeCloseTo(0);
    });

    it('maps one past range.max to 100%', () => {
      // The formula is ((note - min) / (max - min + 1)) * 100
      // So note = max + 1 gives 100%
      const range = { min: 32, max: 76 };
      expect(noteToPercent(77, range)).toBeCloseTo(100);
    });

    it('maps mid-range note correctly', () => {
      const range = { min: 0, max: 127 };
      // note 64 / 128 span = 50%
      expect(noteToPercent(64, range)).toBeCloseTo(50);
    });

    it('handles full MIDI range', () => {
      const range = { min: 0, max: 127 };
      expect(noteToPercent(0, range)).toBeCloseTo(0);
      expect(noteToPercent(127, range)).toBeCloseTo(99.21875);
    });

    it('returns 0 when span is 0', () => {
      // Same min and max: span = 1
      expect(noteToPercent(60, { min: 60, max: 60 })).toBeCloseTo(0);
    });
  });

  describe('percentToNote', () => {
    it('maps 0% to range.min', () => {
      expect(percentToNote(0, { min: 32, max: 76 })).toBe(32);
    });

    it('round-trips with noteToPercent', () => {
      const range = { min: 20, max: 100 };
      for (const note of [20, 50, 60, 80, 100]) {
        const percent = noteToPercent(note, range);
        expect(percentToNote(percent, range)).toBe(note);
      }
    });

    it('clamps to 0-127', () => {
      expect(percentToNote(-10, { min: 0, max: 127 })).toBe(0);
      expect(percentToNote(200, { min: 0, max: 127 })).toBe(127);
    });
  });

  describe('velocityToPercent', () => {
    it('maps 0 to 0%', () => {
      expect(velocityToPercent(0)).toBeCloseTo(0);
    });

    it('maps 127 to 100%', () => {
      expect(velocityToPercent(127)).toBeCloseTo(100);
    });

    it('maps 64 to ~50.4%', () => {
      expect(velocityToPercent(64)).toBeCloseTo((64 / 127) * 100);
    });
  });

  describe('velocityToPercentInverted', () => {
    it('maps 127 to 0% (top)', () => {
      expect(velocityToPercentInverted(127)).toBeCloseTo(0);
    });

    it('maps 0 to ~99.2% (near bottom)', () => {
      expect(velocityToPercentInverted(0)).toBeCloseTo((127 / 128) * 100);
    });

    it('produces the same value as the old inline formula', () => {
      // Old formula: ((127 - velocity) / 128) * 100
      for (const vel of [0, 32, 64, 96, 127]) {
        const expected = ((127 - vel) / 128) * 100;
        expect(velocityToPercentInverted(vel)).toBeCloseTo(expected);
      }
    });
  });

  describe('getVisibleOctaveMarkers', () => {
    it('returns all markers for full range', () => {
      const markers = getVisibleOctaveMarkers({ min: 0, max: 127 });
      expect(markers.length).toBe(OCTAVE_MARKERS.length);
    });

    it('filters to visible range', () => {
      const markers = getVisibleOctaveMarkers({ min: 36, max: 72 });
      // C2 = 36 is note 36, included (min is 36)
      // Markers in this range: C2(36), C3(48), C4(60), C5(72)
      expect(markers.map((m) => m.label)).toEqual(['C2', 'C3', 'C4', 'C5']);
    });

    it('returns empty for very narrow range with no octave boundaries', () => {
      const markers = getVisibleOctaveMarkers({ min: 61, max: 70 });
      expect(markers.length).toBe(0);
    });

    it('includes boundary notes', () => {
      // C3 = note 48, test range exactly at that boundary
      const markers = getVisibleOctaveMarkers({ min: 48, max: 48 });
      expect(markers.length).toBe(1);
      expect(markers[0].label).toBe('C3');
    });
  });
});
