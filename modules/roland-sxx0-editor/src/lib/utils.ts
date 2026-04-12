/**
 * Utility functions
 */

export { cn } from '@audiocontrol/editor-core';

// Re-export midiNoteToName from canonical location for consumers
// that import it from this module.
export { midiNoteToName } from '@audiocontrol/editor-core';

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

/**
 * Format S-330 patch/tone index as display number
 *
 * S-330 uses bank+slot numbering in groups of 8:
 * - Index 0-7 -> 11-18 (bank 1)
 * - Index 8-15 -> 21-28 (bank 2)
 * - etc.
 */
export function formatS330Number(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const slot = (index % 8) + 1;
  return String(bank * 10 + slot);
}
