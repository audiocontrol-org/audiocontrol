/**
 * Canonical MIDI note name/number conversion utilities.
 *
 * All MIDI note parsing and formatting in the codebase should import from here.
 * Convention: C-1 = 0, C0 = 12, C1 = 24, C2 = 36, C4 = 60 (Middle C).
 *
 * @packageDocumentation
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * MIDI note name to semitone offset mapping.
 * Supports sharps (#) and flats (b).
 */
const NOTE_OFFSETS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11,
};

/**
 * Convert a MIDI note number to a human-readable note name.
 *
 * @param note - MIDI note number (0-127)
 * @returns Note name string like "C4", "F#2", "A#-1"
 *
 * @example
 * ```typescript
 * midiNoteToName(60) // "C4"
 * midiNoteToName(36) // "C2"
 * midiNoteToName(0)  // "C-1"
 * ```
 */
export function midiNoteToName(note: number): string {
  const octave = Math.floor(note / 12) - 1;
  const noteName = NOTE_NAMES[note % 12];
  return `${noteName}${octave}`;
}

/**
 * Parse a MIDI note name into a MIDI note number.
 *
 * Accepts note names like "C4", "F#2", "Bb3", "c-1".
 * Also accepts a number directly (pass-through with range validation).
 *
 * @param noteOrNumber - A MIDI note name string or a MIDI note number (0-127)
 * @returns MIDI note number (0-127)
 * @throws If the note name is invalid or the resulting number is out of range
 *
 * @example
 * ```typescript
 * parseMidiNote("C4")  // 60
 * parseMidiNote("C2")  // 36
 * parseMidiNote("C-1") // 0
 * parseMidiNote(60)     // 60
 * ```
 */
export function parseMidiNote(noteOrNumber: string | number): number {
  if (typeof noteOrNumber === 'number') {
    if (noteOrNumber < 0 || noteOrNumber > 127 || !Number.isInteger(noteOrNumber)) {
      throw new Error(`MIDI note number out of range: ${noteOrNumber}`);
    }
    return noteOrNumber;
  }

  const match = noteOrNumber.match(/^([A-Ga-g])([#b]?)(-?\d)$/);
  if (!match) {
    throw new Error(`Invalid note name: "${noteOrNumber}"`);
  }

  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = parseInt(match[3], 10);

  const baseName = letter + (accidental ?? '');
  const semitone = NOTE_OFFSETS[baseName];
  if (semitone === undefined) {
    throw new Error(`Invalid note name: "${noteOrNumber}"`);
  }

  // MIDI note = (octave + 1) * 12 + semitone
  // C-1 = 0, C0 = 12, C1 = 24, C2 = 36, etc.
  const midiNote = (octave + 1) * 12 + semitone;

  if (midiNote < 0 || midiNote > 127) {
    throw new Error(
      `MIDI note "${noteOrNumber}" resolves to ${midiNote}, which is out of range (0-127)`,
    );
  }

  return midiNote;
}

/**
 * Resolve a key specification to a MIDI note number.
 *
 * Convenience wrapper around parseMidiNote for cases where the input
 * may be either a note name string or a number.
 *
 * @param key - Note name (e.g., "C2") or MIDI number
 * @returns MIDI note number
 */
export function resolveKey(key: string | number): number {
  return parseMidiNote(key);
}
