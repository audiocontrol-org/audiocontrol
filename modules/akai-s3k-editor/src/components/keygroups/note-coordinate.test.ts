import { describe, expect, it } from 'vitest';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import {
  clampMidiNote,
  clientXToNote,
  computeVisibleKeyRange,
  noteToPercent,
} from '@/components/keygroups/note-coordinate';

describe('note-coordinate', () => {
  it('computes a padded visible range from loaded keygroups', () => {
    const first = makeKeygroupHeader({ LONOTE: 36, HINOTE: 72 });
    const second = makeKeygroupHeader({ LONOTE: 48, HINOTE: 84 });

    expect(computeVisibleKeyRange([first, second], 2)).toEqual({
      min: 32,
      max: 88,
    });
  });

  it('falls back to the full MIDI range when no keygroups are loaded', () => {
    expect(computeVisibleKeyRange([], 0)).toEqual({ min: 0, max: 127 });
  });

  it('maps note starts and exclusive ends consistently within a visible range', () => {
    const range = { min: 32, max: 88 };

    expect(noteToPercent(36, range)).toBeCloseTo(7.0175, 3);
    expect(noteToPercent(73, range)).toBeCloseTo(71.9298, 3);
  });

  it('converts pointer positions back into MIDI notes in the same range', () => {
    const range = { min: 32, max: 88 };

    expect(clientXToNote(0, 0, 100, range)).toBe(32);
    expect(clientXToNote(100, 0, 100, range)).toBe(89);
    expect(clientXToNote(50, 0, 100, range)).toBe(61);
  });

  it('clamps notes to the MIDI range', () => {
    expect(clampMidiNote(-4)).toBe(0);
    expect(clampMidiNote(129)).toBe(127);
  });
});
