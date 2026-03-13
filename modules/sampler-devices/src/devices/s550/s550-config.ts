/**
 * Roland S-550 Device Configuration
 *
 * S-550 specific configuration using the shared S-series base.
 *
 * @packageDocumentation
 */

import type { SSeriesDeviceConfig, SSeriesAddresses } from '../roland-s-series/index.js';

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
