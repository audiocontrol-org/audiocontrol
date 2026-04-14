import { describe, expect, it } from 'vitest';
import { midiNoteToName, parseMidiNote, resolveKey } from '@/midi-notes.js';

describe('midiNoteToName', () => {
  it('converts middle C', () => {
    expect(midiNoteToName(60)).toBe('C4');
  });

  it('converts C2 (common drum base note)', () => {
    expect(midiNoteToName(36)).toBe('C2');
  });

  it('converts sharps', () => {
    expect(midiNoteToName(54)).toBe('F#3');
    expect(midiNoteToName(61)).toBe('C#4');
  });

  it('converts MIDI note 0 (C-1)', () => {
    expect(midiNoteToName(0)).toBe('C-1');
  });

  it('converts MIDI note 127 (G9)', () => {
    expect(midiNoteToName(127)).toBe('G9');
  });
});

describe('parseMidiNote', () => {
  it('parses natural notes across octaves', () => {
    expect(parseMidiNote('C0')).toBe(12);
    expect(parseMidiNote('C1')).toBe(24);
    expect(parseMidiNote('C2')).toBe(36);
    expect(parseMidiNote('C3')).toBe(48);
    expect(parseMidiNote('C4')).toBe(60);
    expect(parseMidiNote('C5')).toBe(72);
  });

  it('parses all natural notes in octave 4', () => {
    expect(parseMidiNote('C4')).toBe(60);
    expect(parseMidiNote('D4')).toBe(62);
    expect(parseMidiNote('E4')).toBe(64);
    expect(parseMidiNote('F4')).toBe(65);
    expect(parseMidiNote('G4')).toBe(67);
    expect(parseMidiNote('A4')).toBe(69);
    expect(parseMidiNote('B4')).toBe(71);
  });

  it('parses sharps', () => {
    expect(parseMidiNote('C#4')).toBe(61);
    expect(parseMidiNote('D#4')).toBe(63);
    expect(parseMidiNote('F#4')).toBe(66);
    expect(parseMidiNote('G#4')).toBe(68);
    expect(parseMidiNote('A#4')).toBe(70);
  });

  it('parses flats', () => {
    expect(parseMidiNote('Db4')).toBe(61);
    expect(parseMidiNote('Eb4')).toBe(63);
    expect(parseMidiNote('Gb4')).toBe(66);
    expect(parseMidiNote('Ab4')).toBe(68);
    expect(parseMidiNote('Bb4')).toBe(70);
  });

  it('parses octave -1', () => {
    expect(parseMidiNote('C-1')).toBe(0);
    expect(parseMidiNote('G-1')).toBe(7);
  });

  it('handles lowercase input', () => {
    expect(parseMidiNote('c4')).toBe(60);
    expect(parseMidiNote('f#4')).toBe(66);
  });

  it('passes through valid numbers', () => {
    expect(parseMidiNote(60)).toBe(60);
    expect(parseMidiNote(0)).toBe(0);
    expect(parseMidiNote(127)).toBe(127);
  });

  it('throws for invalid number range', () => {
    expect(() => parseMidiNote(-1)).toThrow('out of range');
    expect(() => parseMidiNote(128)).toThrow('out of range');
    expect(() => parseMidiNote(1.5)).toThrow('out of range');
  });

  it('throws for invalid note names', () => {
    expect(() => parseMidiNote('X4')).toThrow('Invalid note name');
    expect(() => parseMidiNote('C')).toThrow('Invalid note name');
    expect(() => parseMidiNote('4C')).toThrow('Invalid note name');
    expect(() => parseMidiNote('')).toThrow('Invalid note name');
  });

  it('round-trips with midiNoteToName for natural notes and sharps', () => {
    for (let note = 0; note <= 127; note++) {
      const name = midiNoteToName(note);
      expect(parseMidiNote(name)).toBe(note);
    }
  });
});

describe('resolveKey', () => {
  it('resolves string note names', () => {
    expect(resolveKey('C2')).toBe(36);
    expect(resolveKey('F#4')).toBe(66);
  });

  it('resolves numbers directly', () => {
    expect(resolveKey(60)).toBe(60);
    expect(resolveKey(36)).toBe(36);
  });
});
