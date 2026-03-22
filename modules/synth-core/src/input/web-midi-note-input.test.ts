import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebMidiNoteInput } from '@/input/web-midi-note-input';

function createMockMidiInput() {
  const listeners = new Map<string, Set<EventListener>>();
  return {
    addEventListener(type: string, listener: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type: string, event: unknown) {
      for (const l of listeners.get(type) ?? []) {
        l(event as Event);
      }
    },
    getListenerCount(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function createMockMidiAccess(inputs: ReturnType<typeof createMockMidiInput>[]) {
  const stateChangeListeners = new Set<EventListener>();
  return {
    inputs: new Map(inputs.map((input, i) => [`input-${i}`, input])),
    addEventListener(type: string, listener: EventListener) {
      if (type === 'statechange') stateChangeListeners.add(listener);
    },
    removeEventListener(_type: string, _listener: EventListener) {
      // Not needed for tests
    },
    fireStateChange() {
      for (const l of stateChangeListeners) l({} as Event);
    },
  };
}

function setupNavigatorMidi(midiAccess: ReturnType<typeof createMockMidiAccess>) {
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    value: vi.fn().mockResolvedValue(midiAccess),
    writable: true,
    configurable: true,
  });
}

describe('createWebMidiNoteInput', () => {
  let mockInput: ReturnType<typeof createMockMidiInput>;
  let mockAccess: ReturnType<typeof createMockMidiAccess>;

  beforeEach(() => {
    mockInput = createMockMidiInput();
    mockAccess = createMockMidiAccess([mockInput]);
    setupNavigatorMidi(mockAccess);
  });

  it('fires noteOn for MIDI note-on messages', async () => {
    const noteInput = await createWebMidiNoteInput();
    const onNoteOn = vi.fn();
    noteInput.onNoteOn(onNoteOn);

    // Note On: channel 0, note 60, velocity 100
    mockInput.fire('midimessage', { data: new Uint8Array([0x90, 60, 100]) });

    expect(onNoteOn).toHaveBeenCalledWith(60, 100);
  });

  it('fires noteOff for MIDI note-off messages (0x80)', async () => {
    const noteInput = await createWebMidiNoteInput();
    const onNoteOff = vi.fn();
    noteInput.onNoteOff(onNoteOff);

    mockInput.fire('midimessage', { data: new Uint8Array([0x80, 60, 0]) });

    expect(onNoteOff).toHaveBeenCalledWith(60);
  });

  it('fires noteOff for note-on with velocity 0', async () => {
    const noteInput = await createWebMidiNoteInput();
    const onNoteOff = vi.fn();
    noteInput.onNoteOff(onNoteOff);

    mockInput.fire('midimessage', { data: new Uint8Array([0x90, 64, 0]) });

    expect(onNoteOff).toHaveBeenCalledWith(64);
  });

  it('ignores messages with fewer than 3 bytes', async () => {
    const noteInput = await createWebMidiNoteInput();
    const onNoteOn = vi.fn();
    noteInput.onNoteOn(onNoteOn);

    mockInput.fire('midimessage', { data: new Uint8Array([0x90, 60]) });

    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('handles note-on on different MIDI channels', async () => {
    const noteInput = await createWebMidiNoteInput();
    const onNoteOn = vi.fn();
    noteInput.onNoteOn(onNoteOn);

    // Channel 5 note-on (0x95)
    mockInput.fire('midimessage', { data: new Uint8Array([0x95, 72, 80]) });

    expect(onNoteOn).toHaveBeenCalledWith(72, 80);
  });

  it('dispose removes listeners', async () => {
    const noteInput = await createWebMidiNoteInput();
    noteInput.dispose();

    expect(mockInput.getListenerCount('midimessage')).toBe(0);
  });

  it('does not fire after dispose', async () => {
    const noteInput = await createWebMidiNoteInput();
    const onNoteOn = vi.fn();
    noteInput.onNoteOn(onNoteOn);
    noteInput.dispose();

    mockInput.fire('midimessage', { data: new Uint8Array([0x90, 60, 100]) });

    expect(onNoteOn).not.toHaveBeenCalled();
  });
});
