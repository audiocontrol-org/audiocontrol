/**
 * Roland S-330 Address Map Constants
 *
 * SysEx address definitions for Roland S-330 sampler.
 * Uses shared S-series constants where applicable.
 *
 * @packageDocumentation
 */

import {
    ROLAND_ID as SHARED_ROLAND_ID,
    S_SERIES_MODEL_ID,
    DEFAULT_DEVICE_ID as SHARED_DEFAULT_DEVICE_ID,
    S_SERIES_COMMANDS,
    ERROR_CODES as SHARED_ERROR_CODES,
    TIMING as SHARED_TIMING,
    VALUE_RANGES as SHARED_VALUE_RANGES,
    BULK_DUMP_TYPES as SHARED_BULK_DUMP_TYPES,
    calculateChecksum as sharedCalculateChecksum,
    PATCH_PARAMS as SHARED_PATCH_PARAMS,
    PATCH_COMMON_OFFSETS as SHARED_PATCH_COMMON_OFFSETS,
    TONE_OFFSETS as SHARED_TONE_OFFSETS,
    PATCH_TOTAL_SIZE as SHARED_PATCH_TOTAL_SIZE,
    TONE_BLOCK_SIZE as SHARED_TONE_BLOCK_SIZE,
    TONE_BLOCK_NIBBLES as SHARED_TONE_BLOCK_NIBBLES,
    TONE_MAP_ENTRIES as SHARED_TONE_MAP_ENTRIES,
    buildPatchAddress as sharedBuildPatchAddress,
    buildPatchParamAddress as sharedBuildPatchParamAddress,
    buildToneAddress as sharedBuildToneAddress,
    buildSystemAddress as sharedBuildSystemAddress,
} from '../roland-s-series/index.js';

// =============================================================================
// Re-export shared constants with original names for compatibility
// =============================================================================

export const ROLAND_ID = SHARED_ROLAND_ID;
export const S330_MODEL_ID = S_SERIES_MODEL_ID;
export const DEFAULT_DEVICE_ID = SHARED_DEFAULT_DEVICE_ID;
export const S330_COMMANDS = S_SERIES_COMMANDS;
export const ERROR_CODES = SHARED_ERROR_CODES;
export const TIMING = SHARED_TIMING;
export const BULK_DUMP_TYPES = SHARED_BULK_DUMP_TYPES;
export const calculateChecksum = sharedCalculateChecksum;

// =============================================================================
// Re-export shared address constants
// =============================================================================

export type { PatchParam } from '../roland-s-series/index.js';
export const PATCH_PARAMS = SHARED_PATCH_PARAMS;
export const PATCH_COMMON_OFFSETS = SHARED_PATCH_COMMON_OFFSETS;
export const TONE_OFFSETS = SHARED_TONE_OFFSETS;
export const PATCH_TOTAL_SIZE = SHARED_PATCH_TOTAL_SIZE;
export const TONE_BLOCK_SIZE = SHARED_TONE_BLOCK_SIZE;
export const TONE_BLOCK_NIBBLES = SHARED_TONE_BLOCK_NIBBLES;
export const TONE_MAP_ENTRIES = SHARED_TONE_MAP_ENTRIES;
export const buildPatchAddress = sharedBuildPatchAddress;
export const buildPatchParamAddress = sharedBuildPatchParamAddress;
export const buildToneAddress = sharedBuildToneAddress;
export const buildSystemAddress = sharedBuildSystemAddress;

// =============================================================================
// Base Addresses (4-byte format)
// =============================================================================

/** System parameters base address */
export const ADDR_SYSTEM = [0x00, 0x00, 0x00, 0x00] as const;

/** Patch parameters base address
 * Each patch occupies stride of 4: patch N at [0x00, 0x00, N*4, 0x00]
 */
export const ADDR_PATCH_BASE = [0x00, 0x00, 0x00, 0x00] as const;

/** Tone parameters base address
 * Tone N at [0x00, 0x03, N*2, 0x00] (stride of 2)
 */
export const ADDR_TONE_BASE = [0x00, 0x03, 0x00, 0x00] as const;

/** Tone stride in address byte 2 */
export const TONE_STRIDE = 2;

/** Wave data base address */
export const ADDR_WAVE_DATA = [0x01, 0x00, 0x00, 0x00] as const;

/**
 * S-330 wave segment stride in 7-bit address units.
 * Each segment is 24576 address units apart in the linear address space.
 */
const S330_WAVE_SEGMENT_STRIDE = 24576;

/**
 * Build a wave data address for the S-330.
 *
 * The S-330 uses a linear stride: each segment is 24576 address units apart.
 * Banks A (0) and B (1) are supported.
 *
 * @param waveBank - Wave bank index (0 = A, 1 = B)
 * @param segmentIndex - Segment index within the bank
 * @returns 4-byte address array
 */
export function buildWaveDataAddress(waveBank: number, segmentIndex: number): number[] {
    if (waveBank < 0 || waveBank > 1) {
        throw new Error(`S-330 wave bank ${waveBank} out of range (0-1)`);
    }

    // Linear address: base + (bank * segments_per_bank + segment) * stride
    // S-330 has 18 segments per bank
    const segmentsPerBank = 18;
    const linearOffset = (waveBank * segmentsPerBank + segmentIndex) * S330_WAVE_SEGMENT_STRIDE;

    // Encode as 4-byte 7-bit address (same encoding as S-550)
    return [
        0x01,
        (linearOffset >> 14) & 0x7f,
        (linearOffset >> 7) & 0x7f,
        linearOffset & 0x7f,
    ];
}

// =============================================================================
// System Parameter Offsets
// =============================================================================

/** Offsets within system parameter block */
export const SYSTEM_OFFSETS = {
    MASTER_TUNE: 0x00,
    MASTER_LEVEL: 0x01,
    MIDI_CHANNEL: 0x02,
    DEVICE_ID: 0x03,
    EXCLUSIVE_ENABLE: 0x04,
    PROG_CHANGE_ENABLE: 0x05,
    CTRL_CHANGE_ENABLE: 0x06,
    BENDER_ENABLE: 0x07,
    MOD_WHEEL_ENABLE: 0x08,
    AFTERTOUCH_ENABLE: 0x09,
    HOLD_PEDAL_ENABLE: 0x0A,
} as const;

/** Total size of system parameter block */
export const SYSTEM_BLOCK_SIZE = 0x0B;

// =============================================================================
// Device-Specific Limits
// =============================================================================

/** Maximum patches in memory */
export const MAX_PATCHES = 64;

/** Maximum tones in memory */
export const MAX_TONES = 32;

// =============================================================================
// Value Ranges (S-330 specific)
// =============================================================================

/** Parameter value constraints */
export const VALUE_RANGES = {
    ...SHARED_VALUE_RANGES,
    /** Tone number range (S-330: 0-31) */
    TONE_NUMBER: { min: 0x00, max: 0x1F },
    /** Patch number range (S-330: 0-63) */
    PATCH_NUMBER: { min: 0x00, max: 0x3F },
    /** Partial count range */
    PARTIAL_COUNT: { min: 0x00, max: 0x1F },
} as const;
