/**
 * S-330 Display Formatting Utilities
 *
 * The S-330 uses bank+slot notation for both tones and patches.
 * This module provides the canonical formatting functions.
 *
 * @packageDocumentation
 */

/**
 * Format tone slot index for display.
 *
 * S-330 uses bank.slot notation: T11-T18 (bank 1), T21-T28 (bank 2), etc.
 *
 * @param index - Tone index (0-31)
 * @returns Display string like "T11", "T24", "T48"
 */
export function formatToneSlot(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const slot = (index % 8) + 1;
  return `T${bank}${slot}`;
}

/**
 * Format patch slot index for display.
 *
 * S-330 uses bank.slot notation: P11-P18 (bank 1), P21-P28 (bank 2).
 *
 * @param index - Patch index (0-15)
 * @returns Display string like "P11", "P18", "P21", "P28"
 */
export function formatPatchSlot(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const slot = (index % 8) + 1;
  return `P${bank}${slot}`;
}
