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

// =============================================================================
// Wave Data Address Functions
// =============================================================================

/**
 * S-330 segment address stride: 00 01 40 00H = 24576 in linear 7-bit address units.
 *
 * Each segment contains 12000 samples transmitted as 24000 bytes (2 bytes per 12-bit sample).
 */
const S330_SEGMENT_ADDR_STRIDE = 24576;

/**
 * S-330 Bank B offset: byte 1 = 0x20, which in the 7-bit address scheme
 * equals 0x20 << 14 = 524288 linear address units.
 */
const S330_BANK_B_OFFSET = 0x20 << 14; // 524288

/**
 * Build wave data address for the S-330.
 *
 * The S-330 has 2 wave banks (A, B) with up to 18 segments each.
 * Address layout is linear stride-based:
 *   - Bank A base: 01 00 00 00H (offset 0)
 *   - Bank B base: 01 20 00 00H (offset 0x20 << 14 = 524288)
 *   - Segment stride: 00 01 40 00H = 24576 address units
 *
 * @param waveBank - Wave bank index (0 = Bank A, 1 = Bank B)
 * @param segmentIndex - Segment index within the bank (0-17)
 * @returns 4-byte address array
 */
export function buildWaveDataAddress(waveBank: number, segmentIndex: number): number[] {
    if (waveBank < 0 || waveBank > 1) {
        throw new Error(`S-330 wave bank ${waveBank} out of range (0-1)`);
    }
    if (segmentIndex < 0 || segmentIndex > 17) {
        throw new Error(`Segment index ${segmentIndex} out of range (0-17)`);
    }

    const bankBaseAddr = waveBank === 0 ? 0 : S330_BANK_B_OFFSET;
    const addrOffset = bankBaseAddr + (segmentIndex * S330_SEGMENT_ADDR_STRIDE);

    return [
        ADDR_WAVE_DATA[0],
        (addrOffset >> 14) & 0x7f,
        (addrOffset >> 7) & 0x7f,
        addrOffset & 0x7e, // LSB must be even per Roland spec
    ];
}
