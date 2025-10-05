// XXX: Does this library belong in a higher-level module?

/**
 * Converts a MIDI note name to its corresponding MIDI note number.
 *
 * Supports standard note names (C-G), accidentals (# or b), and octaves (-1 to 9).
 * The octave -1 is the lowest MIDI octave, where C-1 = MIDI note 0.
 *
 * @param note - The note name in the format: note + optional accidental + octave (e.g., "C4", "F#3", "Bb-1")
 * @returns The MIDI note number (0-127), or -1 if the note format is invalid or out of range
 * @public
 *
 * @example
 * ```typescript
 * // Middle C (MIDI note 60)
 * const c4 = midiNoteToNumber("C4");  // Returns 60
 *
 * // F# in octave 3
 * const fSharp3 = midiNoteToNumber("F#3");  // Returns 54
 *
 * // B-flat in octave 2
 * const bFlat2 = midiNoteToNumber("Bb2");  // Returns 46
 *
 * // Invalid note
 * const invalid = midiNoteToNumber("X9");  // Returns -1
 *
 * // Out of range
 * const tooHigh = midiNoteToNumber("C10");  // Returns -1
 * ```
 *
 * @remarks
 * - MIDI note range is 0-127 (C-1 to G9)
 * - Note names are case-insensitive (C4 and c4 are equivalent)
 * - Accidentals: # (sharp) adds 1 semitone, b (flat) subtracts 1 semitone
 * - Returns -1 for invalid formats or out-of-range notes
 */
export function midiNoteToNumber(note: string): number {
    // MIDI note range is 0-127 (C-1 to G9)
    const MIN_MIDI_NOTE = 0;
    const MAX_MIDI_NOTE = 127;

    // Validate note format with regex
    // Allows for notes from C-1 to G9
    // Format: note name + optional accidental + octave number
    const noteRegex = /^([a-gA-G])([#b]?)(-?\d+)$/;
    const match = note.match(noteRegex);

    if (!match) {
        return -1; // Invalid note format
    }

    const noteName = match[1].toUpperCase();
    const accidental = match[2];
    const octave = parseInt(match[3], 10);

    const noteValues = {
        'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
    };

    let noteValue = noteValues[noteName as keyof typeof noteValues];

    if (accidental === '#') {
        noteValue += 1;
    } else if (accidental === 'b') {
        noteValue -= 1;
    }

    // Calculate the MIDI note number
    // const midiNote = 12 + (octave + 1) * 12 + noteValue;
    const midiNote = (octave + 1) * 12 + noteValue;

    // Check if the calculated note is within valid MIDI range
    if (midiNote < MIN_MIDI_NOTE || midiNote > MAX_MIDI_NOTE) {
        return -1;
    }

    return midiNote;
}
