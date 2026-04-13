import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';

export interface NoteCoordinateRange {
  min: number;
  max: number;
}

export const MIDI_NOTE_MIN = 0;
export const MIDI_NOTE_MAX = 127;
export const TOTAL_MIDI_NOTES = MIDI_NOTE_MAX - MIDI_NOTE_MIN + 1;
const DEFAULT_PADDING = 4;

export function clampMidiNote(value: number): number {
  return Math.max(MIDI_NOTE_MIN, Math.min(MIDI_NOTE_MAX, Math.round(value)));
}

export function computeVisibleKeyRange(
  keygroups: (KeygroupHeader | undefined)[],
  keygroupCount: number,
  padding = DEFAULT_PADDING,
): NoteCoordinateRange {
  let min = MIDI_NOTE_MAX;
  let max = MIDI_NOTE_MIN;

  for (let i = 0; i < keygroupCount; i++) {
    const keygroup = keygroups[i];
    if (!keygroup) continue;
    if (keygroup.LONOTE < min) min = keygroup.LONOTE;
    if (keygroup.HINOTE > max) max = keygroup.HINOTE;
  }

  if (min > max) {
    return { min: MIDI_NOTE_MIN, max: MIDI_NOTE_MAX };
  }

  return {
    min: clampMidiNote(min - padding),
    max: clampMidiNote(max + padding),
  };
}

export function noteRangeSpan(range: NoteCoordinateRange): number {
  return Math.max(1, range.max - range.min + 1);
}

export function noteToPercent(
  note: number,
  range: NoteCoordinateRange = { min: MIDI_NOTE_MIN, max: MIDI_NOTE_MAX },
): number {
  const clamped = clampMidiNote(note);
  const span = noteRangeSpan(range);
  return ((clamped - range.min) / span) * 100;
}

export function noteToFraction(
  note: number,
  range: NoteCoordinateRange = { min: MIDI_NOTE_MIN, max: MIDI_NOTE_MAX },
): number {
  return noteToPercent(note, range) / 100;
}

export function clientXToNote(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  range: NoteCoordinateRange = { min: MIDI_NOTE_MIN, max: MIDI_NOTE_MAX },
): number {
  if (rectWidth <= 0) {
    return range.min;
  }

  const fraction = Math.max(0, Math.min(1, (clientX - rectLeft) / rectWidth));
  const span = noteRangeSpan(range);
  return clampMidiNote(range.min + fraction * span);
}
