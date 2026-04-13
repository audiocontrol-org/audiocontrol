/**
 * Shared note-to-pixel coordinate mapping utilities.
 *
 * Both ZoneOverview and KeyRangeEditor use these functions so that
 * note positions align horizontally across components.
 */

export interface NoteRange {
  readonly min: number;
  readonly max: number;
}

export const TOTAL_NOTES = 128;
export const VELOCITY_MAX = 127;

/** C octave markers across the MIDI range (C-1 through C9). */
export const OCTAVE_MARKERS: ReadonlyArray<{ note: number; label: string }> =
  buildOctaveMarkers();

function buildOctaveMarkers(): ReadonlyArray<{ note: number; label: string }> {
  const markers: { note: number; label: string }[] = [];
  for (let octave = -1; octave <= 9; octave++) {
    const note = (octave + 1) * 12;
    if (note >= 0 && note <= 127) {
      markers.push({ note, label: `C${octave}` });
    }
  }
  return markers;
}

/** Clamp a note value to the valid MIDI range 0-127. */
export function clampNote(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

/** Clamp a velocity value to the valid MIDI range 0-127. */
export function clampVelocity(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

/**
 * Compute the visible key range across all loaded keygroups, with 4-note
 * padding on each side. Falls back to full range if no keygroups are loaded.
 */
export function computeKeyRange(
  keygroups: ({ LONOTE: number; HINOTE: number } | undefined)[],
  keygroupCount: number,
): NoteRange {
  let min = 127;
  let max = 0;

  for (let i = 0; i < keygroupCount; i++) {
    const kg = keygroups[i];
    if (!kg) continue;
    if (kg.LONOTE < min) min = kg.LONOTE;
    if (kg.HINOTE > max) max = kg.HINOTE;
  }

  if (min > max) {
    return { min: 0, max: 127 };
  }

  return {
    min: Math.max(0, min - 4),
    max: Math.min(127, max + 4),
  };
}

/**
 * Map a MIDI note to a percentage position within a NoteRange.
 * This is THE shared mapping that both ZoneOverview and KeyRangeEditor use
 * so their horizontal positions align.
 */
export function noteToPercent(note: number, range: NoteRange): number {
  const span = range.max - range.min + 1;
  if (span <= 0) return 0;
  return ((note - range.min) / span) * 100;
}

/**
 * Inverse of noteToPercent: map a percentage back to a MIDI note.
 * Used for drag interactions (e.g., converting mouse position to note).
 */
export function percentToNote(percent: number, range: NoteRange): number {
  const span = range.max - range.min + 1;
  const note = (percent / 100) * span + range.min;
  return clampNote(note);
}

/** Map a velocity value (0-127) to a percentage (0-100). */
export function velocityToPercent(velocity: number): number {
  return (velocity / VELOCITY_MAX) * 100;
}

/**
 * Map a velocity to a top-down percentage for CSS positioning.
 * velocity 127 -> 0% (top), velocity 0 -> ~99.2% (near bottom).
 */
export function velocityToPercentInverted(velocity: number): number {
  return ((VELOCITY_MAX - velocity) / (VELOCITY_MAX + 1)) * 100;
}

/** Filter OCTAVE_MARKERS to those within the visible range. */
export function getVisibleOctaveMarkers(
  range: NoteRange,
): ReadonlyArray<{ note: number; label: string }> {
  return OCTAVE_MARKERS.filter(
    (m) => m.note >= range.min && m.note <= range.max,
  );
}
