import type { NoteInput } from '@/types/note-input';

// Two-octave QWERTY keyboard layout (piano-style)
// Lower row: z=C, s=C#, x=D, d=D#, c=E, v=F, g=F#, b=G, h=G#, n=A, j=A#, m=B
// Upper row: q=C+1, 2=C#+1, w=D+1, 3=D#+1, e=E+1, r=F+1, 5=F#+1, t=G+1, 6=G#+1, y=A+1, 7=A#+1, u=B+1
const KEY_MAP: Record<string, number> = {
  z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
  q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20, y: 21, '7': 22, u: 23,
};

const DEFAULT_VELOCITY = 100;

export function createKeyboardNoteInput(baseNote = 60): NoteInput {
  let noteOnHandler: ((note: number, velocity: number) => void) | null = null;
  let noteOffHandler: ((note: number) => void) | null = null;
  const heldKeys = new Set<string>();

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    const offset = KEY_MAP[event.key];
    if (offset === undefined) return;

    heldKeys.add(event.key);
    noteOnHandler?.(baseNote + offset, DEFAULT_VELOCITY);
  }

  function handleKeyUp(event: KeyboardEvent): void {
    const offset = KEY_MAP[event.key];
    if (offset === undefined) return;

    heldKeys.delete(event.key);
    noteOffHandler?.(baseNote + offset);
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return {
    onNoteOn(handler) {
      noteOnHandler = handler;
    },
    onNoteOff(handler) {
      noteOffHandler = handler;
    },
    dispose() {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      noteOnHandler = null;
      noteOffHandler = null;
      heldKeys.clear();
    },
  };
}
