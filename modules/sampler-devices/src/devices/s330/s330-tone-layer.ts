/**
 * S-330 Tone Layer Utilities
 *
 * Provides constants and functions for working with S-330 patch tone layers.
 * The S-330 uses a 109-element array to map MIDI notes 12-120 (C0 to C9) to tone slots.
 *
 * This module is the single source of truth for tone layer mapping logic.
 * Both device-level code and UI components should use these functions
 * rather than implementing their own index calculations.
 *
 * @packageDocumentation
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * First MIDI note in the S-330 tone layer mapping (C0).
 */
export const TONE_LAYER_MIN_MIDI_NOTE = 12;

/**
 * Last MIDI note in the S-330 tone layer mapping (C9).
 */
export const TONE_LAYER_MAX_MIDI_NOTE = 120;

/**
 * Total number of entries in a tone layer array.
 */
export const TONE_LAYER_SIZE = 109;

/**
 * Value indicating no tone is assigned (Layer 1 only).
 * Layer 2 uses 0 as "off" since it's an unsigned value.
 */
export const TONE_LAYER_OFF = -1;

// =============================================================================
// Index Conversion Functions
// =============================================================================

/**
 * Convert a MIDI note number to a tone layer array index.
 *
 * @param midiNote - MIDI note number (12-120)
 * @returns Array index (0-108), or -1 if out of range
 */
export function midiNoteToLayerIndex(midiNote: number): number {
  const index = midiNote - TONE_LAYER_MIN_MIDI_NOTE;
  if (index < 0 || index >= TONE_LAYER_SIZE) {
    return -1;
  }
  return index;
}

/**
 * Convert a tone layer array index to a MIDI note number.
 *
 * @param index - Array index (0-108)
 * @returns MIDI note number (12-120), or -1 if out of range
 */
export function layerIndexToMidiNote(index: number): number {
  if (index < 0 || index >= TONE_LAYER_SIZE) {
    return -1;
  }
  return index + TONE_LAYER_MIN_MIDI_NOTE;
}

// =============================================================================
// Tone Layer Factory Functions
// =============================================================================

/**
 * Create an empty tone layer array with all entries set to "off".
 *
 * @param layer - Which layer (1 or 2). Layer 1 uses -1 for off, Layer 2 uses 0.
 * @returns A new 109-element array initialized to the off value
 */
export function createEmptyToneLayer(layer: 1 | 2): number[] {
  const offValue = layer === 1 ? TONE_LAYER_OFF : 0;
  return new Array(TONE_LAYER_SIZE).fill(offValue);
}

// =============================================================================
// Tone Layer Manipulation Functions
// =============================================================================

/**
 * Get the tone slot assigned to a specific MIDI note.
 *
 * @param toneLayer - The tone layer array (109 elements)
 * @param midiNote - MIDI note number (12-120)
 * @returns Tone slot number (-1 to 31 for Layer 1, 0 to 31 for Layer 2),
 *          or undefined if midiNote is out of range
 */
export function getToneAtMidiNote(
  toneLayer: number[],
  midiNote: number
): number | undefined {
  const index = midiNoteToLayerIndex(midiNote);
  if (index < 0) {
    return undefined;
  }
  return toneLayer[index];
}

/**
 * Set the tone slot for a specific MIDI note.
 *
 * @param toneLayer - The tone layer array (109 elements) - will be mutated
 * @param midiNote - MIDI note number (12-120)
 * @param toneSlot - Tone slot to assign (-1 to 31 for Layer 1, 0 to 31 for Layer 2)
 * @returns true if the assignment was made, false if midiNote is out of range
 */
export function setToneAtMidiNote(
  toneLayer: number[],
  midiNote: number,
  toneSlot: number
): boolean {
  const index = midiNoteToLayerIndex(midiNote);
  if (index < 0) {
    return false;
  }
  toneLayer[index] = toneSlot;
  return true;
}

/**
 * Set the tone slot for a range of MIDI notes (inclusive).
 *
 * @param toneLayer - The tone layer array (109 elements) - will be mutated
 * @param startMidiNote - Starting MIDI note (12-120)
 * @param endMidiNote - Ending MIDI note (12-120), inclusive
 * @param toneSlot - Tone slot to assign
 * @returns Number of notes that were assigned
 */
export function setToneForMidiRange(
  toneLayer: number[],
  startMidiNote: number,
  endMidiNote: number,
  toneSlot: number
): number {
  let count = 0;
  for (let note = startMidiNote; note <= endMidiNote; note++) {
    if (setToneAtMidiNote(toneLayer, note, toneSlot)) {
      count++;
    }
  }
  return count;
}

/**
 * Check if a MIDI note is within the valid tone layer range.
 *
 * @param midiNote - MIDI note number to check
 * @returns true if the note is in range (12-120)
 */
export function isValidToneLayerMidiNote(midiNote: number): boolean {
  return midiNote >= TONE_LAYER_MIN_MIDI_NOTE && midiNote <= TONE_LAYER_MAX_MIDI_NOTE;
}

// =============================================================================
// Zone Types and Functions
// =============================================================================

/**
 * Represents a contiguous zone of keys mapped to a single tone.
 */
export interface ToneZone {
  /** Starting MIDI note (12-120) */
  startMidiNote: number;
  /** Ending MIDI note (12-120) */
  endMidiNote: number;
  /** Tone slot number (-1 to 31 for Layer 1, 0 to 31 for Layer 2) */
  toneSlot: number;
}

/**
 * Convert a tone layer array to a list of contiguous zones.
 *
 * @param toneLayer - The tone layer array (109 elements)
 * @param layer - Which layer (1 or 2), determines the "off" value
 * @returns Array of zones representing contiguous tone mappings
 */
export function toneLayerToZones(toneLayer: number[], layer: 1 | 2): ToneZone[] {
  const zones: ToneZone[] = [];
  const offValue = layer === 1 ? TONE_LAYER_OFF : 0;
  let i = 0;

  while (i < TONE_LAYER_SIZE) {
    const currentTone = toneLayer[i];

    // Skip OFF entries
    if (currentTone === offValue) {
      i++;
      continue;
    }

    const startMidiNote = layerIndexToMidiNote(i);

    // Find the end of this zone (contiguous same-tone entries)
    while (i < TONE_LAYER_SIZE && toneLayer[i] === currentTone) {
      i++;
    }

    const endMidiNote = layerIndexToMidiNote(i - 1);
    zones.push({ startMidiNote, endMidiNote, toneSlot: currentTone });
  }

  return zones;
}

/**
 * Convert a list of zones back to a tone layer array.
 *
 * @param zones - Array of tone zones
 * @param layer - Which layer (1 or 2), determines the "off" value
 * @returns A new 109-element tone layer array
 */
export function zonesToToneLayer(zones: ToneZone[], layer: 1 | 2): number[] {
  const toneLayer = createEmptyToneLayer(layer);

  for (const zone of zones) {
    setToneForMidiRange(toneLayer, zone.startMidiNote, zone.endMidiNote, zone.toneSlot);
  }

  return toneLayer;
}
