// XXX: Does this library belong in a higher-level module?

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
