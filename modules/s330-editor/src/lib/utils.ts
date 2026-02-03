/**
 * Utility functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format MIDI note number as note name
 */
export function midiNoteToName(note: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = noteNames[note % 12];
  return `${noteName}${octave}`;
}

/**
 * Format value as percentage (0-127 → 0-100%)
 */
export function formatPercent(value: number): string {
  return `${Math.round((value / 127) * 100)}%`;
}

/**
 * Format signed value (-64 to +63 from 0-127)
 */
export function formatSigned(value: number): string {
  const signed = value - 64;
  return signed >= 0 ? `+${signed}` : String(signed);
}

/**
 * Format pan value (0-127, 64 = center)
 */
export function formatPan(value: number): string {
  if (value === 64) return 'C';
  if (value < 64) return `L${64 - value}`;
  return `R${value - 64}`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Clamp value to range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
