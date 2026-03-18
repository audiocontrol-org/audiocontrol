/**
 * Roland S-550 Address Map Constants
 *
 * SysEx address definitions for Roland S-550 sampler.
 * Uses shared S-series constants and adds S-550 specific values.
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
// Re-export shared constants
// =============================================================================

export const ROLAND_ID = SHARED_ROLAND_ID;
export const S550_MODEL_ID = S_SERIES_MODEL_ID;
export const DEFAULT_DEVICE_ID = SHARED_DEFAULT_DEVICE_ID;
export const S550_COMMANDS = S_SERIES_COMMANDS;
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

/** Patch parameters base address */
export const ADDR_PATCH_BASE = [0x00, 0x00, 0x00, 0x00] as const;

/** Tone parameters base address */
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

/** Maximum patches in memory (S-550: 32) */
export const MAX_PATCHES = 32;

/** Maximum tones in memory (S-550: 64) */
export const MAX_TONES = 64;

// =============================================================================
// Value Ranges (S-550 specific)
// =============================================================================

/** Parameter value constraints */
export const VALUE_RANGES = {
    ...SHARED_VALUE_RANGES,
    /** Tone number range (S-550: 0-63) */
    TONE_NUMBER: { min: 0x00, max: 0x3F },
    /** Patch number range (S-550: 0-31) */
    PATCH_NUMBER: { min: 0x00, max: 0x1F },
    /** Wave bank range (S-550: 0-3) */
    WAVE_BANK: { min: 0x00, max: 0x03 },
} as const;

// =============================================================================
// Block-Aware Wave Data Address Functions
// =============================================================================

/**
 * Wave bank base addresses.
 *
 * The S-550 has 4 wave banks organized into 2 blocks:
 * - Block 1: Banks A (0x00) and B (0x20)
 * - Block 2: Banks C (0x40) and D (0x60)
 */
export const WAVE_BANK_BASE_ADDRESSES = {
    0: 0x00,  // Bank A
    1: 0x20,  // Bank B
    2: 0x40,  // Bank C
    3: 0x60,  // Bank D
} as const;

/**
 * Build wave data address for an absolute wave bank and segment.
 *
 * @param absoluteWaveBank - Absolute wave bank (0-3: A, B, C, D)
 * @param segmentIndex - Segment index within the bank (0-17)
 * @returns 4-byte address array
 *
 * @example
 * ```typescript
 * buildWaveDataAddress(0, 0);  // [0x01, 0x00, 0x00, 0x00] - Bank A, Segment 0
 * buildWaveDataAddress(2, 5);  // [0x01, 0x40, 0x28, 0x00] - Bank C, Segment 5
 * ```
 */
export function buildWaveDataAddress(absoluteWaveBank: number, segmentIndex: number): number[] {
    if (absoluteWaveBank < 0 || absoluteWaveBank > 3) {
        throw new Error(`Wave bank ${absoluteWaveBank} out of range (0-3)`);
    }
    if (segmentIndex < 0 || segmentIndex > 17) {
        throw new Error(`Segment index ${segmentIndex} out of range (0-17)`);
    }

    const byte1 = WAVE_BANK_BASE_ADDRESSES[absoluteWaveBank as 0 | 1 | 2 | 3];
    const byte2 = (segmentIndex * 8) & 0x7F;  // Segment stride is 8 in byte 2

    return [0x01, byte1, byte2, 0x00];
}

/**
 * Build wave data address using block-relative bank index.
 *
 * @param block - Block number (1 or 2)
 * @param blockRelativeBank - Block-relative bank (0 or 1)
 * @param segmentIndex - Segment index within the bank (0-17)
 * @returns 4-byte address array
 *
 * @example
 * ```typescript
 * buildBlockRelativeWaveAddress(1, 0, 0);  // Bank A, Segment 0
 * buildBlockRelativeWaveAddress(1, 1, 0);  // Bank B, Segment 0
 * buildBlockRelativeWaveAddress(2, 0, 0);  // Bank C, Segment 0
 * buildBlockRelativeWaveAddress(2, 1, 0);  // Bank D, Segment 0
 * ```
 */
export function buildBlockRelativeWaveAddress(
    block: 1 | 2,
    blockRelativeBank: 0 | 1,
    segmentIndex: number
): number[] {
    // Convert block-relative bank to absolute bank
    const absoluteBank = block === 1
        ? blockRelativeBank        // Block 1: 0 → A(0), 1 → B(1)
        : blockRelativeBank + 2;   // Block 2: 0 → C(2), 1 → D(3)

    return buildWaveDataAddress(absoluteBank, segmentIndex);
}
