import type { NoteInput } from '@/types/note-input';

export interface MockNoteInputControls {
  simulateNoteOn(note: number, velocity: number): void;
  simulateNoteOff(note: number): void;
}

export function createMockNoteInput(): {
  impl: NoteInput;
  controls: MockNoteInputControls;
} {
  let noteOnHandler: ((note: number, velocity: number) => void) | null = null;
  let noteOffHandler: ((note: number) => void) | null = null;

  const impl: NoteInput = {
    onNoteOn(handler) {
      noteOnHandler = handler;
    },
    onNoteOff(handler) {
      noteOffHandler = handler;
    },
    dispose() {
      noteOnHandler = null;
      noteOffHandler = null;
    },
  };

  const controls: MockNoteInputControls = {
    simulateNoteOn(note: number, velocity: number) {
      noteOnHandler?.(note, velocity);
    },
    simulateNoteOff(note: number) {
      noteOffHandler?.(note);
    },
  };

  return { impl, controls };
}
