/**
 * Roland S-330 Device Configuration
 *
 * S-330 specific configuration using the shared S-series base.
 *
 * @packageDocumentation
 */

import type { SSeriesDeviceConfig, SSeriesAddresses } from '../roland-s-series/index.js';

/**
 * S-330 address constants
 */
export const S330_ADDRESSES: SSeriesAddresses = {
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
 * S-330 device configuration
 *
 * The S-330 is a 16-voice, 12-bit digital sampler from 1987.
 * - 64 patches (2 banks of 32)
 * - 32 tones
 * - 2 wave banks (A, B)
 */
export const S330_CONFIG: SSeriesDeviceConfig = {
    modelId: 0x1E,
    deviceName: 'S-330',

    // Memory layout
    patchCount: 64,
    toneCount: 32,
    waveBankCount: 2,

    // Value ranges
    maxToneIndex: 31,
    maxWaveBank: 1,
    maxPatchIndex: 63,

    // Address constants
    addresses: S330_ADDRESSES,

    // Block sizes
    patchBlockSize: 512,
    toneBlockSize: 256,
    patchBlockNibbles: 1024,
    toneBlockNibbles: 512,
    toneStride: 2,
    toneMapEntries: 109,
};
