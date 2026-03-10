/**
 * Slot Allocation Utilities
 *
 * Helpers for finding available tone slots, patch slots, and wave memory
 * segments for safe importing without overwriting existing data.
 *
 * ============================================================================
 * CRITICAL: S-330 RETURNS OBJECTS FOR ALL SLOTS, EVEN EMPTY ONES
 * ============================================================================
 *
 * The S-330 sampler returns tone/patch objects for ALL 32 tone slots and
 * ALL 16 patch slots, regardless of whether they contain actual data.
 * This means:
 *
 *   - `deviceTones[i]` is NEVER undefined after loading (always an S330Tone)
 *   - `devicePatches[i]` is NEVER undefined after loading (always an S330Patch)
 *   - Checking `!!deviceTones[i]` or `!!devicePatches[i]` is ALWAYS TRUE
 *
 * To determine if a slot is truly empty/available:
 *
 *   - For tones: Use `isToneEmpty(tone)` - checks wave.segmentLength === 0
 *   - For patches: Use `isPatchEmpty(patch)` - checks blank name + no assignments
 *   - For arrays: Use `isToneSlotEmpty(tones, i)` or `isPatchSlotEmpty(patches, i)`
 *
 * NEVER use truthiness checks (!!tone, !!patch, tone ? x : y) to determine
 * if a slot is empty. This has caused bugs multiple times.
 *
 * ============================================================================
 */

import type { S330Tone, S330Patch } from '@/core/midi/S330Client';

const SEGMENTS_PER_BANK = 18;
const SAMPLES_PER_SEGMENT = 12000;

// ============================================================================
// EMPTY SLOT DETECTION - Single Source of Truth
// ============================================================================

/**
 * Check if a tone is empty (no wave data allocated).
 *
 * This is the AUTHORITATIVE check for whether a tone slot is available.
 * An empty tone has wave.segmentLength === 0.
 *
 * @warning Do NOT use truthiness checks (!!tone) - the S-330 returns objects
 * for all 32 slots, so tone is never undefined after device data is loaded.
 *
 * @example
 * // CORRECT
 * if (isToneEmpty(deviceTones[i])) { ... }
 * const label = isToneEmpty(tone) ? '(empty)' : tone.name;
 *
 * // WRONG - will always be true after device load
 * if (deviceTones[i]) { ... }
 * const label = tone ? tone.name : '(empty)';
 */
export function isToneEmpty(tone: S330Tone | undefined): boolean {
  // Not loaded yet = treat as NOT empty (don't assume it's available)
  if (!tone) return false;

  // No wave segments allocated = empty slot
  return tone.wave.segmentLength === 0;
}

/**
 * Check if a patch is empty (no meaningful data).
 *
 * This is the AUTHORITATIVE check for whether a patch slot is available.
 * An empty patch has a blank/whitespace-only name AND no tone assignments.
 *
 * @warning Do NOT use truthiness checks (!!patch) - the S-330 returns objects
 * for all 16 slots, so patch is never undefined after device data is loaded.
 *
 * @example
 * // CORRECT
 * if (isPatchEmpty(devicePatches[i])) { ... }
 * const label = isPatchEmpty(patch) ? '(empty)' : patch.common.name;
 *
 * // WRONG - will always be true after device load
 * if (devicePatches[i]) { ... }
 * const label = patch ? patch.common.name : '(empty)';
 */
export function isPatchEmpty(patch: S330Patch | undefined): boolean {
  // Not loaded yet = treat as NOT empty
  if (!patch) return false;

  // Check for blank/empty name
  const name = patch.common.name;
  if (name && name.trim() !== '') return false;

  // Check if any tone is assigned in layer 1 (non-empty patches have at least one)
  const hasAssignedTone = patch.common.toneLayer1.some((t) => t >= 0);
  return !hasAssignedTone;
}

/**
 * Check if a tone slot is empty/available for import.
 * Convenience wrapper around isToneEmpty for array access.
 */
export function isToneSlotEmpty(
  deviceTones: (S330Tone | undefined)[],
  slot: number
): boolean {
  return isToneEmpty(deviceTones[slot]);
}

/**
 * Check if a patch slot is empty/available for import.
 * Convenience wrapper around isPatchEmpty for array access.
 */
export function isPatchSlotEmpty(
  devicePatches: (S330Patch | undefined)[],
  slot: number
): boolean {
  return isPatchEmpty(devicePatches[slot]);
}

// ============================================================================
// SLOT FINDING FUNCTIONS
// ============================================================================

/**
 * Find the first available (empty) tone slot.
 * Returns undefined if all slots are occupied.
 */
export function findFirstEmptyToneSlot(
  deviceTones: (S330Tone | undefined)[],
  preferredSlot?: number
): number | undefined {
  // If preferred slot is empty, use it
  if (preferredSlot !== undefined && isToneEmpty(deviceTones[preferredSlot])) {
    return preferredSlot;
  }

  // Find first empty slot
  for (let i = 0; i < deviceTones.length; i++) {
    if (isToneEmpty(deviceTones[i])) {
      return i;
    }
  }

  return undefined;
}

/**
 * Find the first available (empty) patch slot.
 * Returns undefined if all slots are occupied.
 */
export function findFirstEmptyPatchSlot(
  devicePatches: (S330Patch | undefined)[],
  preferredSlot?: number
): number | undefined {
  // If preferred slot is empty, use it
  if (preferredSlot !== undefined && isPatchEmpty(devicePatches[preferredSlot])) {
    return preferredSlot;
  }

  // Find first empty slot
  for (let i = 0; i < devicePatches.length; i++) {
    if (isPatchEmpty(devicePatches[i])) {
      return i;
    }
  }

  return undefined;
}

/**
 * Find multiple available tone slots for batch import.
 * Returns array of available slots, may be shorter than requested if not enough available.
 */
export function findEmptyToneSlots(
  deviceTones: (S330Tone | undefined)[],
  count: number,
  preferredSlots?: number[]
): number[] {
  const result: number[] = [];
  const usedSlots = new Set<number>();

  // First, try preferred slots if they're empty
  if (preferredSlots) {
    for (const slot of preferredSlots) {
      if (isToneEmpty(deviceTones[slot]) && !usedSlots.has(slot) && result.length < count) {
        result.push(slot);
        usedSlots.add(slot);
      }
    }
  }

  // Fill remaining from available slots
  for (let i = 0; i < deviceTones.length && result.length < count; i++) {
    if (isToneEmpty(deviceTones[i]) && !usedSlots.has(i)) {
      result.push(i);
      usedSlots.add(i);
    }
  }

  return result;
}

/**
 * Represents a contiguous region of wave memory.
 */
export interface WaveMemoryRegion {
  bank: 0 | 1;
  segmentTop: number;
  segmentLength: number;
}

/**
 * Get wave memory usage map from device tones.
 * Returns a map of bank -> Set of used segment indices.
 */
export function getWaveMemoryUsage(
  deviceTones: (S330Tone | undefined)[]
): Map<0 | 1, Set<number>> {
  const usage = new Map<0 | 1, Set<number>>([
    [0, new Set()],
    [1, new Set()],
  ]);

  for (const tone of deviceTones) {
    if (!tone) continue;

    const bank = tone.wave.bank as 0 | 1;
    const segmentSet = usage.get(bank)!;

    for (let i = 0; i < tone.wave.segmentLength; i++) {
      segmentSet.add(tone.wave.segmentTop + i);
    }
  }

  return usage;
}

/**
 * Find available wave memory region for a given segment count.
 * Tries to find contiguous free segments, preferring the specified bank.
 */
export function findAvailableWaveMemory(
  deviceTones: (S330Tone | undefined)[],
  segmentsNeeded: number,
  preferredBank?: 0 | 1
): WaveMemoryRegion | undefined {
  const usage = getWaveMemoryUsage(deviceTones);

  // Try preferred bank first, then the other
  const banksToTry: (0 | 1)[] = preferredBank !== undefined
    ? [preferredBank, preferredBank === 0 ? 1 : 0]
    : [0, 1];

  for (const bank of banksToTry) {
    const usedSegments = usage.get(bank)!;

    // Find contiguous free region
    for (let start = 0; start <= SEGMENTS_PER_BANK - segmentsNeeded; start++) {
      let isFree = true;
      for (let i = 0; i < segmentsNeeded; i++) {
        if (usedSegments.has(start + i)) {
          isFree = false;
          break;
        }
      }

      if (isFree) {
        return {
          bank,
          segmentTop: start,
          segmentLength: segmentsNeeded,
        };
      }
    }
  }

  return undefined;
}

/**
 * Find multiple available wave memory regions for batch import.
 * Returns array of regions, may be shorter than requested if not enough space.
 */
export function findAvailableWaveMemoryRegions(
  deviceTones: (S330Tone | undefined)[],
  segmentRequests: number[],
  preferredBank?: 0 | 1
): WaveMemoryRegion[] {
  const usage = getWaveMemoryUsage(deviceTones);
  const results: WaveMemoryRegion[] = [];

  // Track newly allocated segments to avoid conflicts
  const newAllocations = new Map<0 | 1, Set<number>>([
    [0, new Set()],
    [1, new Set()],
  ]);

  for (const segmentsNeeded of segmentRequests) {
    const banksToTry: (0 | 1)[] = preferredBank !== undefined
      ? [preferredBank, preferredBank === 0 ? 1 : 0]
      : [0, 1];

    let found = false;

    for (const bank of banksToTry) {
      const usedSegments = usage.get(bank)!;
      const newlyUsed = newAllocations.get(bank)!;

      for (let start = 0; start <= SEGMENTS_PER_BANK - segmentsNeeded; start++) {
        let isFree = true;
        for (let i = 0; i < segmentsNeeded; i++) {
          if (usedSegments.has(start + i) || newlyUsed.has(start + i)) {
            isFree = false;
            break;
          }
        }

        if (isFree) {
          // Mark as allocated
          for (let i = 0; i < segmentsNeeded; i++) {
            newlyUsed.add(start + i);
          }

          results.push({
            bank,
            segmentTop: start,
            segmentLength: segmentsNeeded,
          });
          found = true;
          break;
        }
      }

      if (found) break;
    }

    if (!found) {
      // No space found for this request
      break;
    }
  }

  return results;
}

/**
 * Calculate segments needed for a given sample count.
 */
export function calculateSegmentsNeeded(sampleCount: number): number {
  return Math.ceil(sampleCount / SAMPLES_PER_SEGMENT);
}

// ============================================================================
// ALLOCATION SUGGESTIONS
// ============================================================================

/**
 * Result of allocation attempt for a single tone import.
 */
export interface ToneAllocationResult {
  /** Suggested tone slot (empty if available, otherwise first slot) */
  toneSlot: number;
  /** Whether the suggested slot is empty */
  toneSlotIsEmpty: boolean;
  /** Suggested wave memory region (if available) */
  waveMemory: WaveMemoryRegion | undefined;
  /** Whether wave memory is available */
  hasAvailableWaveMemory: boolean;
}

/**
 * Get allocation suggestion for importing a single tone.
 */
export function suggestToneAllocation(
  deviceTones: (S330Tone | undefined)[],
  segmentsNeeded: number,
  preferredSlot?: number,
  preferredBank?: 0 | 1
): ToneAllocationResult {
  const emptySlot = findFirstEmptyToneSlot(deviceTones, preferredSlot);
  const toneSlot = emptySlot ?? preferredSlot ?? 0;
  const waveMemory = findAvailableWaveMemory(deviceTones, segmentsNeeded, preferredBank);

  return {
    toneSlot,
    toneSlotIsEmpty: emptySlot !== undefined,
    waveMemory,
    hasAvailableWaveMemory: waveMemory !== undefined,
  };
}

/**
 * Result of allocation attempt for a patch import with dependent tones.
 */
export interface PatchAllocationResult {
  /** Suggested patch slot */
  patchSlot: number;
  /** Whether the patch slot is empty */
  patchSlotIsEmpty: boolean;
  /** Suggested tone allocations for each dependent tone */
  toneAllocations: Array<{
    originalSlot: number;
    suggestedSlot: number;
    slotIsEmpty: boolean;
    waveMemory: WaveMemoryRegion | undefined;
  }>;
  /** Whether all dependent tones have available slots */
  allTonesHaveSlots: boolean;
  /** Whether all dependent tones have wave memory */
  allTonesHaveWaveMemory: boolean;
}

/**
 * Get allocation suggestion for importing a patch with its dependent tones.
 */
export function suggestPatchAllocation(
  deviceTones: (S330Tone | undefined)[],
  devicePatches: (S330Patch | undefined)[],
  dependentTones: Array<{ originalSlot: number; segmentsNeeded: number }>,
  preferredPatchSlot?: number,
  preferredBank?: 0 | 1
): PatchAllocationResult {
  // Find patch slot
  const emptyPatchSlot = findFirstEmptyPatchSlot(devicePatches, preferredPatchSlot);
  const patchSlot = emptyPatchSlot ?? preferredPatchSlot ?? 0;

  // Find tone slots
  const preferredToneSlots = dependentTones.map((t) => t.originalSlot);
  const emptyToneSlots = findEmptyToneSlots(
    deviceTones,
    dependentTones.length,
    preferredToneSlots
  );

  console.log('[suggestPatchAllocation] Finding tone slots:', {
    preferredToneSlots,
    emptyToneSlots,
    deviceTonesLength: deviceTones.length,
    availableSlots: deviceTones.map((t, i) => isToneEmpty(t) ? i : null).filter(i => i !== null),
    occupiedSlots: deviceTones.map((t, i) => (t && !isToneEmpty(t)) ? { index: i, name: t.name, segments: t.wave.segmentLength } : null).filter(Boolean),
  });

  // Find wave memory regions
  const segmentRequests = dependentTones.map((t) => t.segmentsNeeded);
  const waveRegions = findAvailableWaveMemoryRegions(
    deviceTones,
    segmentRequests,
    preferredBank
  );

  // Build tone allocations
  const toneAllocations = dependentTones.map((tone, index) => {
    const suggestedSlot = emptyToneSlots[index] ?? tone.originalSlot;
    const slotIsEmpty = emptyToneSlots[index] !== undefined;
    const waveMemory = waveRegions[index];

    return {
      originalSlot: tone.originalSlot,
      suggestedSlot,
      slotIsEmpty,
      waveMemory,
    };
  });

  return {
    patchSlot,
    patchSlotIsEmpty: emptyPatchSlot !== undefined,
    toneAllocations,
    allTonesHaveSlots: emptyToneSlots.length >= dependentTones.length,
    allTonesHaveWaveMemory: waveRegions.length >= dependentTones.length,
  };
}
