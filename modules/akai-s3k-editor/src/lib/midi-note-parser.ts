/**
 * MIDI note name to number conversion.
 *
 * Parses note names like "C1", "F#4", "Bb3" into MIDI note numbers.
 * Convention: C-1 = 0, C0 = 12, C1 = 24, C2 = 36, etc.
 *
 * @packageDocumentation
 */

const NOTE_OFFSETS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * Parse a MIDI note name (e.g., "C2", "F#4", "Bb3") into a MIDI note number.
 *
 * Uses the convention where C-1 = 0, C0 = 12, C1 = 24, C2 = 36.
 *
 * @param noteOrNumber - A MIDI note name string or a MIDI note number (0-127)
 * @returns MIDI note number (0-127)
 * @throws If the note name is invalid or the resulting number is out of range
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
    throw new Error(`Invalid MIDI note name: "${noteOrNumber}"`);
  }

  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = parseInt(match[3], 10);

  const baseOffset = NOTE_OFFSETS[letter];
  if (baseOffset === undefined) {
    throw new Error(`Invalid note letter: "${letter}"`);
  }

  let offset = baseOffset;
  if (accidental === '#') offset += 1;
  if (accidental === 'b') offset -= 1;

  // C-1 = 0, so MIDI number = (octave + 1) * 12 + offset
  const midiNote = (octave + 1) * 12 + offset;

  if (midiNote < 0 || midiNote > 127) {
    throw new Error(
      `MIDI note "${noteOrNumber}" resolves to ${midiNote}, which is out of range (0-127)`,
    );
  }

  return midiNote;
}

/**
 * Format a MIDI note number as a human-readable note name.
 *
 * @param noteNumber - MIDI note number (0-127)
 * @returns Note name string like "C2", "F#4"
 */
export function formatMidiNote(noteNumber: number): string {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteName = NOTE_NAMES[noteNumber % 12];
  return `${noteName}${octave}`;
}
