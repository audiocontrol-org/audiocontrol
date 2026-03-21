/** Note event source — MIDI controller, keyboard, sequencer, etc. */
export interface NoteInput {
  onNoteOn(handler: ((note: number, velocity: number) => void) | null): void;
  onNoteOff(handler: ((note: number) => void) | null): void;
  dispose(): void;
}
