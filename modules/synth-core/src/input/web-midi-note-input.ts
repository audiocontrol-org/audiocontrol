import type { NoteInput } from '@/types/note-input';

const NOTE_ON_STATUS = 0x90;
const NOTE_OFF_STATUS = 0x80;
const STATUS_MASK = 0xf0;

export async function createWebMidiNoteInput(): Promise<NoteInput> {
  const midiAccess = await navigator.requestMIDIAccess();

  let noteOnHandler: ((note: number, velocity: number) => void) | null = null;
  let noteOffHandler: ((note: number) => void) | null = null;

  function handleMidiMessage(event: Event): void {
    const midiEvent = event as MIDIMessageEvent;
    const data = midiEvent.data;
    if (!data || data.length < 3) return;

    const status = data[0]! & STATUS_MASK;
    const note = data[1]!;
    const velocity = data[2]!;

    if (status === NOTE_ON_STATUS && velocity > 0) {
      noteOnHandler?.(note, velocity);
    } else if (status === NOTE_OFF_STATUS || (status === NOTE_ON_STATUS && velocity === 0)) {
      noteOffHandler?.(note);
    }
  }

  function attachListeners(): void {
    midiAccess.inputs.forEach((input) => {
      input.addEventListener('midimessage', handleMidiMessage);
    });
  }

  function detachListeners(): void {
    midiAccess.inputs.forEach((input) => {
      input.removeEventListener('midimessage', handleMidiMessage);
    });
  }

  attachListeners();

  // Listen for newly connected inputs
  midiAccess.addEventListener('statechange', () => {
    detachListeners();
    attachListeners();
  });

  return {
    onNoteOn(handler) {
      noteOnHandler = handler;
    },
    onNoteOff(handler) {
      noteOffHandler = handler;
    },
    dispose() {
      detachListeners();
      noteOnHandler = null;
      noteOffHandler = null;
    },
  };
}
