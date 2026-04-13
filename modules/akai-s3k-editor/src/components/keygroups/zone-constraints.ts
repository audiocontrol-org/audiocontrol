import { clampMidiNote } from '@/components/keygroups/note-coordinate';

export function clampLowNote(nextLow: number, highNote: number): number {
  return Math.min(clampMidiNote(nextLow), clampMidiNote(highNote));
}

export function clampHighNote(nextHigh: number, lowNote: number): number {
  return Math.max(clampMidiNote(nextHigh), clampMidiNote(lowNote));
}

export function clampLowVelocity(nextLow: number, highVelocity: number): number {
  return Math.min(clampMidiNote(nextLow), clampMidiNote(highVelocity));
}

export function clampHighVelocity(nextHigh: number, lowVelocity: number): number {
  return Math.max(clampMidiNote(nextHigh), clampMidiNote(lowVelocity));
}
