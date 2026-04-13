import { clampMidiNote } from '@/components/keygroups/note-coordinate';

export const KEYGROUP_NOTE_MIN = 21;

function clampKeygroupNote(value: number): number {
  return Math.max(KEYGROUP_NOTE_MIN, clampMidiNote(value));
}

export function clampLowNote(nextLow: number, highNote: number): number {
  return Math.min(clampKeygroupNote(nextLow), clampKeygroupNote(highNote));
}

export function clampHighNote(nextHigh: number, lowNote: number): number {
  return Math.max(clampKeygroupNote(nextHigh), clampKeygroupNote(lowNote));
}

export function clampLowVelocity(nextLow: number, highVelocity: number): number {
  return Math.min(clampMidiNote(nextLow), clampMidiNote(highVelocity));
}

export function clampHighVelocity(nextHigh: number, lowVelocity: number): number {
  return Math.max(clampMidiNote(nextHigh), clampMidiNote(lowVelocity));
}
