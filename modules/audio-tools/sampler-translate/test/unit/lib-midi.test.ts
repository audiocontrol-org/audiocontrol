import { describe, it, expect } from 'vitest';
import { midiNoteToNumber } from '@/lib-midi.js';

describe('lib-midi', () => {
    describe('midiNoteToNumber', () => {
        // Test basic notes without accidentals
        it('converts basic notes correctly', () => {
            expect(midiNoteToNumber('C4')).toBe(60);
            expect(midiNoteToNumber('D4')).toBe(62);
            expect(midiNoteToNumber('E4')).toBe(64);
            expect(midiNoteToNumber('F4')).toBe(65);
            expect(midiNoteToNumber('G4')).toBe(67);
            expect(midiNoteToNumber('A4')).toBe(69);
            expect(midiNoteToNumber('B4')).toBe(71);
        });

        // Test notes with sharp accidentals
        it('handles sharp notes correctly', () => {
            expect(midiNoteToNumber('C#4')).toBe(61);
            expect(midiNoteToNumber('F#3')).toBe(54);
            expect(midiNoteToNumber('G#4')).toBe(68);
        });

        // Test notes with flat accidentals
        it('handles flat notes correctly', () => {
            expect(midiNoteToNumber('Bb3')).toBe(58);
            expect(midiNoteToNumber('Eb4')).toBe(63);
            expect(midiNoteToNumber('Ab4')).toBe(68);
        });

        // Test notes across different octaves
        it('handles different octaves correctly', () => {
            expect(midiNoteToNumber('C0')).toBe(12);
            expect(midiNoteToNumber('C1')).toBe(24);
            expect(midiNoteToNumber('C2')).toBe(36);
            expect(midiNoteToNumber('C8')).toBe(108);
        });

        // Test edge cases
        it('handles edge cases correctly', () => {
            // Lowest note (C-1 in MIDI is note 0)
            expect(midiNoteToNumber('C-1')).toBe(0);
            // Highest note (G9 in MIDI is note 127)
            expect(midiNoteToNumber('G9')).toBe(127);
        });

        // Test invalid inputs
        it('handles invalid inputs correctly', () => {
            // Empty string
            expect(midiNoteToNumber('')).toBe(-1);
            // Invalid note names
            expect(midiNoteToNumber('H4')).toBe(-1);
            // Invalid accidentals
            expect(midiNoteToNumber('C$4')).toBe(-1);
            // Missing octave
            expect(midiNoteToNumber('C')).toBe(-1);
            // Invalid format
            expect(midiNoteToNumber('4C')).toBe(-1);
            // Invalid octave
            expect(midiNoteToNumber('C10')).toBe(-1);
        });

        // Test case sensitivity
        it('handles case sensitivity correctly', () => {
            // Lowercase notes should work the same as uppercase
            expect(midiNoteToNumber('c4')).toBe(60);
            expect(midiNoteToNumber('d#4')).toBe(63);
            expect(midiNoteToNumber('f#3')).toBe(54);
            expect(midiNoteToNumber('bb3')).toBe(58);
        });
    });
});
