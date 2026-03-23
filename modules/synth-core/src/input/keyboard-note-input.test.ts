import { describe, it, expect, vi } from 'vitest';
import { createKeyboardNoteInput } from '@/input/keyboard-note-input';

function pressKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
}

function releaseKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('createKeyboardNoteInput', () => {
  it('fires noteOn for mapped keys', () => {
    const input = createKeyboardNoteInput(60);
    const onNoteOn = vi.fn();
    input.onNoteOn(onNoteOn);

    pressKey('z'); // C = baseNote + 0

    expect(onNoteOn).toHaveBeenCalledWith(60, 100);
    input.dispose();
  });

  it('fires noteOff on key release', () => {
    const input = createKeyboardNoteInput(60);
    const onNoteOff = vi.fn();
    input.onNoteOff(onNoteOff);

    pressKey('z');
    releaseKey('z');

    expect(onNoteOff).toHaveBeenCalledWith(60);
    input.dispose();
  });

  it('maps upper row to second octave', () => {
    const input = createKeyboardNoteInput(48);
    const onNoteOn = vi.fn();
    input.onNoteOn(onNoteOn);

    pressKey('q'); // C+1 octave = baseNote + 12

    expect(onNoteOn).toHaveBeenCalledWith(60, 100);
    input.dispose();
  });

  it('ignores unmapped keys', () => {
    const input = createKeyboardNoteInput(60);
    const onNoteOn = vi.fn();
    input.onNoteOn(onNoteOn);

    pressKey('p');

    expect(onNoteOn).not.toHaveBeenCalled();
    input.dispose();
  });

  it('ignores repeat keydown events', () => {
    const input = createKeyboardNoteInput(60);
    const onNoteOn = vi.fn();
    input.onNoteOn(onNoteOn);

    pressKey('z');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', repeat: true }));

    expect(onNoteOn).toHaveBeenCalledTimes(1);
    input.dispose();
  });

  it('uses default baseNote of 60', () => {
    const input = createKeyboardNoteInput();
    const onNoteOn = vi.fn();
    input.onNoteOn(onNoteOn);

    pressKey('x'); // D = baseNote + 2

    expect(onNoteOn).toHaveBeenCalledWith(62, 100);
    input.dispose();
  });

  it('dispose removes listeners', () => {
    const input = createKeyboardNoteInput(60);
    const onNoteOn = vi.fn();
    input.onNoteOn(onNoteOn);
    input.dispose();

    pressKey('z');

    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('maps chromatic notes correctly', () => {
    const input = createKeyboardNoteInput(60);
    const onNoteOn = vi.fn();
    input.onNoteOn(onNoteOn);

    // C C# D D# E F F# G G# A A# B
    const keys = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm'];
    for (let i = 0; i < keys.length; i++) {
      pressKey(keys[i]!);
      expect(onNoteOn).toHaveBeenLastCalledWith(60 + i, 100);
    }

    input.dispose();
  });
});
