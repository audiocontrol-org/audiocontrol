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
 *   - `deviceTones[i]` is NEVER undefined after loading (always an SamplerTone)
 *   - `devicePatches[i]` is NEVER undefined after loading (always an SamplerPatch)
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

import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';

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
export function isToneEmpty(tone: SamplerTone | undefined): boolean {
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
export function isPatchEmpty(patch: SamplerPatch | undefined): boolean {
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
  deviceTones: (SamplerTone | undefined)[],
  slot: number
): boolean {
  return isToneEmpty(deviceTones[slot]);
}

/**
 * Check if a patch slot is empty/available for import.
 * Convenience wrapper around isPatchEmpty for array access.
 */
export function isPatchSlotEmpty(
  devicePatches: (SamplerPatch | undefined)[],
  slot: number
): boolean {
  return isPatchEmpty(devicePatches[slot]);
}

/**
 * Check whether any tone slot in the contiguous range
 * `[start, start + length)` is occupied (i.e. NOT empty).
 *
 * Returns `true` if at least one slot in the range has wave data
 * allocated, meaning importing across that range would overwrite
 * existing data. Returns `false` only when every slot in the range
 * is empty.
 *
 * @warning Do NOT replace this with `deviceTones[i] !== undefined` —
 * the S-330 returns objects for ALL 32 tone slots after device load,
 * so a raw `!== undefined` check is ALWAYS true and labels every
 * range as "(will overwrite)" regardless of actual occupancy. This
 * helper routes through `isToneSlotEmpty`, the authoritative
 * empty-slot check (see the file preamble at line 8-26).
 *
 * @example
 * // CORRECT — range overwrite detection in import dialogs
 * const willOverwrite = hasOccupiedToneRange(deviceTones, start, count);
 *
 * // WRONG — always true after device load
 * const willOverwrite = Array.from({ length: count }, (_, j) =>
 *   deviceTones[start + j]
 * ).some((t) => t !== undefined);
 */
export function hasOccupiedToneRange(
  deviceTones: (SamplerTone | undefined)[],
  start: number,
  length: number
): boolean {
  return Array.from(
    { length },
    (_, j) => !isToneSlotEmpty(deviceTones, start + j)
  ).some(Boolean);
}

/**
 * Check whether any patch slot in the contiguous range
 * `[start, start + length)` is occupied (i.e. NOT empty).
 *
 * Returns `true` if at least one slot in the range has a meaningful
 * patch (non-blank name or assigned tones), meaning importing across
 * that range would overwrite existing data. Returns `false` only when
 * every slot in the range is empty.
 *
 * @warning Do NOT replace this with `devicePatches[i] !== undefined` —
 * the S-330 returns objects for ALL 16 patch slots after device load,
 * so a raw `!== undefined` check is ALWAYS true and labels every
 * range as "(will overwrite)" regardless of actual occupancy. This
 * helper routes through `isPatchSlotEmpty`, the authoritative
 * empty-slot check (see the file preamble at line 8-26).
 *
 * @example
 * // CORRECT — range overwrite detection in import dialogs
 * const willOverwrite = hasOccupiedPatchRange(devicePatches, start, count);
 *
 * // WRONG — always true after device load
 * const willOverwrite = Array.from({ length: count }, (_, j) =>
 *   devicePatches[start + j]
 * ).some((p) => p !== undefined);
 */
export function hasOccupiedPatchRange(
  devicePatches: (SamplerPatch | undefined)[],
  start: number,
  length: number
): boolean {
  return Array.from(
    { length },
    (_, j) => !isPatchSlotEmpty(devicePatches, start + j)
  ).some(Boolean);
}

// ============================================================================
// SLOT FINDING FUNCTIONS
// ============================================================================

/**
 * Find the first available (empty) tone slot.
 * Returns undefined if all slots are occupied.
 */
export function findFirstEmptyToneSlot(
  deviceTones: (SamplerTone | undefined)[],
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
  devicePatches: (SamplerPatch | undefined)[],
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
  deviceTones: (SamplerTone | undefined)[],
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
/** Wave bank index (0-3 for S-550, 0-1 for S-330) */
export type WaveBankIndex = 0 | 1 | 2 | 3;

export interface WaveMemoryRegion {
  bank: WaveBankIndex;
  segmentTop: number;
  segmentLength: number;
}

/**
 * Build the list of all wave bank indices for the current device.
 */
const ALL_WAVE_BANKS: WaveBankIndex[] = [0, 1, 2, 3];

/**
 * Get wave memory usage map from device tones.
 * Returns a map of bank -> Set of used segment indices.
 * Initializes all 4 banks (S-550 uses 0-3, S-330 uses 0-1).
 */
export function getWaveMemoryUsage(
  deviceTones: (SamplerTone | undefined)[]
): Map<WaveBankIndex, Set<number>> {
  const usage = new Map<WaveBankIndex, Set<number>>(
    ALL_WAVE_BANKS.map(b => [b, new Set()])
  );

  for (const tone of deviceTones) {
    if (!tone) continue;

    const bank = tone.wave.bank as WaveBankIndex;
    if (!usage.has(bank)) continue;
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
  deviceTones: (SamplerTone | undefined)[],
  segmentsNeeded: number,
  preferredBank?: WaveBankIndex
): WaveMemoryRegion | undefined {
  const usage = getWaveMemoryUsage(deviceTones);

  // Try preferred bank first, then all others in order
  const banksToTry: WaveBankIndex[] = preferredBank !== undefined
    ? [preferredBank, ...ALL_WAVE_BANKS.filter(b => b !== preferredBank)]
    : [...ALL_WAVE_BANKS];

  for (const bank of banksToTry) {
    const usedSegments = usage.get(bank);
    if (!usedSegments) continue;

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
  deviceTones: (SamplerTone | undefined)[],
  segmentRequests: number[],
  preferredBank?: WaveBankIndex
): WaveMemoryRegion[] {
  const usage = getWaveMemoryUsage(deviceTones);
  const results: WaveMemoryRegion[] = [];

  // Track newly allocated segments to avoid conflicts
  const newAllocations = new Map<WaveBankIndex, Set<number>>(
    ALL_WAVE_BANKS.map(b => [b, new Set()])
  );

  for (const segmentsNeeded of segmentRequests) {
    const banksToTry: WaveBankIndex[] = preferredBank !== undefined
      ? [preferredBank, ...ALL_WAVE_BANKS.filter(b => b !== preferredBank)]
      : [...ALL_WAVE_BANKS];

    let found = false;

    for (const bank of banksToTry) {
      const usedSegments = usage.get(bank);
      const newlyUsed = newAllocations.get(bank);
      if (!usedSegments || !newlyUsed) continue;

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
  deviceTones: (SamplerTone | undefined)[],
  segmentsNeeded: number,
  preferredSlot?: number,
  preferredBank?: WaveBankIndex
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
  deviceTones: (SamplerTone | undefined)[],
  devicePatches: (SamplerPatch | undefined)[],
  dependentTones: Array<{ originalSlot: number; segmentsNeeded: number }>,
  preferredPatchSlot?: number,
  preferredBank?: WaveBankIndex
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
