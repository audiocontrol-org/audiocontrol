/**
 * Roland S-550 Device Configuration
 *
 * S-550 specific configuration using the shared S-series base.
 *
 * The S-550 is organized as two independent blocks:
 * - Block 1: Tones 0-31, Wave Banks A (0) and B (1)
 * - Block 2: Tones 32-63, Wave Banks C (2) and D (3)
 *
 * Within each block, tones reference wave banks as 0 or 1 (block-relative),
 * which maps to the actual wave bank based on which block the tone is in.
 *
 * @packageDocumentation
 */

import type { SSeriesDeviceConfig, SSeriesAddresses } from '../roland-s-series/index.js';
import type { S550Block, S550BlockInfo, S550AbsoluteWaveBank } from './s550-types.js';

// =============================================================================
// Block Structure Constants
// =============================================================================

/** Number of tones per block */
export const TONES_PER_BLOCK = 32;

/** Number of wave banks per block */
export const WAVE_BANKS_PER_BLOCK = 2;

/** Total number of blocks */
export const BLOCK_COUNT = 2;

/**
 * Wave bank addresses by absolute bank index.
 * Each address is the base address for that wave bank's segment 0.
 */
export const WAVE_BANK_ADDRESSES = {
    /** Bank A - Block 1, bank 0 */
    A: [0x01, 0x00, 0x00, 0x00] as const,
    /** Bank B - Block 1, bank 1 */
    B: [0x01, 0x20, 0x00, 0x00] as const,
    /** Bank C - Block 2, bank 0 */
    C: [0x01, 0x40, 0x00, 0x00] as const,
    /** Bank D - Block 2, bank 1 */
    D: [0x01, 0x60, 0x00, 0x00] as const,
} as const;

/**
 * Absolute wave bank indices for each block.
 * Maps block number to the two wave banks available in that block.
 */
export const BLOCK_WAVE_BANKS: Record<S550Block, readonly [S550AbsoluteWaveBank, S550AbsoluteWaveBank]> = {
    1: [0, 1] as const,  // Block 1: Banks A and B
    2: [2, 3] as const,  // Block 2: Banks C and D
} as const;

/**
 * Block information for each block.
 */
export const BLOCK_INFO: Record<S550Block, Omit<S550BlockInfo, 'diskLabel'>> = {
    1: {
        block: 1,
        firstToneIndex: 0,
        lastToneIndex: 31,
        waveBanks: BLOCK_WAVE_BANKS[1],
    },
    2: {
        block: 2,
        firstToneIndex: 32,
        lastToneIndex: 63,
        waveBanks: BLOCK_WAVE_BANKS[2],
    },
} as const;

// =============================================================================
// Address Constants
// =============================================================================

/**
 * S-550 address constants
 */
export const S550_ADDRESSES: SSeriesAddresses = {
    /** System parameters base address */
    system: [0x00, 0x00, 0x00, 0x00] as const,

    /** Patch parameters base address */
    patchBase: [0x00, 0x00, 0x00, 0x00] as const,

    /** Tone parameters base address */
    toneBase: [0x00, 0x03, 0x00, 0x00] as const,

    /** Wave data base address */
    waveData: [0x01, 0x00, 0x00, 0x00] as const,
};

/**
 * S-550 device configuration
 *
 * The S-550 is a 24-voice, 12-bit digital sampler (1987).
 * It uses the same SysEx protocol as the S-330 (model ID 0x1E).
 *
 * Key differences from S-330:
 * - 32 patches (vs 64)
 * - 64 tones (vs 32)
 * - 4 wave banks A, B, C, D (vs 2)
 * - More RAM capacity
 */
export const S550_CONFIG: SSeriesDeviceConfig = {
    modelId: 0x1E,
    deviceName: 'S-550',

    // Memory layout (inverted from S-330)
    patchCount: 32,
    toneCount: 64,
    waveBankCount: 4,

    // Value ranges
    maxToneIndex: 63,
    maxWaveBank: 3,
    maxPatchIndex: 31,

    // Address constants
    addresses: S550_ADDRESSES,

    // Block sizes (same as S-330)
    patchBlockSize: 512,
    toneBlockSize: 256,
    patchBlockNibbles: 1024,
    toneBlockNibbles: 512,
    toneStride: 2,
    toneMapEntries: 109,
};
