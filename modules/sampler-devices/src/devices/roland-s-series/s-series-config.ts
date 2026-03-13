/**
 * Roland S-Series Device Configuration Interface
 *
 * Defines device-specific parameters that vary between S-330 and S-550
 * while sharing the same SysEx protocol (model ID 0x1E).
 *
 * @packageDocumentation
 */

import type { SSeriesAddresses } from './s-series-types.js';

/**
 * Device configuration for Roland S-series samplers.
 *
 * Both S-330 and S-550 use model ID 0x1E and share the same SysEx protocol.
 * This interface captures the device-specific differences:
 * - Memory layout (patch/tone counts)
 * - Wave bank count
 * - Value ranges for indices
 */
export interface SSeriesDeviceConfig {
    /** Model ID (0x1E for both S-330 and S-550) */
    modelId: number;

    /** Human-readable device name */
    deviceName: 'S-330' | 'S-550';

    // === Memory Layout ===

    /** Total number of patches (S-330: 64, S-550: 32) */
    patchCount: number;

    /** Total number of tones (S-330: 32, S-550: 64) */
    toneCount: number;

    /** Number of wave banks (S-330: 2 (A,B), S-550: 4 (A,B,C,D)) */
    waveBankCount: number;

    // === Value Ranges ===

    /** Maximum tone index (S-330: 31, S-550: 63) */
    maxToneIndex: number;

    /** Maximum wave bank index (S-330: 1, S-550: 3) */
    maxWaveBank: number;

    /** Maximum patch index (S-330: 63, S-550: 31) */
    maxPatchIndex: number;

    // === Address Constants ===

    /** Device-specific address constants */
    addresses: SSeriesAddresses;

    // === Block Sizes ===

    /** Size of patch data in bytes (after de-nibblization) */
    patchBlockSize: number;

    /** Size of tone data in bytes (after de-nibblization) */
    toneBlockSize: number;

    /** Size of patch data in nibbles (for RQD size calculation) */
    patchBlockNibbles: number;

    /** Size of tone data in nibbles (for RQD size calculation) */
    toneBlockNibbles: number;

    /** Tone stride in address byte 2 */
    toneStride: number;

    /** Number of tone map entries per layer (MIDI notes covered) */
    toneMapEntries: number;
}

/**
 * Validate that a device configuration is consistent.
 */
export function validateDeviceConfig(config: SSeriesDeviceConfig): void {
    if (config.maxToneIndex !== config.toneCount - 1) {
        throw new Error(
            `Invalid config: maxToneIndex (${config.maxToneIndex}) should be toneCount - 1 (${config.toneCount - 1})`
        );
    }
    if (config.maxPatchIndex !== config.patchCount - 1) {
        throw new Error(
            `Invalid config: maxPatchIndex (${config.maxPatchIndex}) should be patchCount - 1 (${config.patchCount - 1})`
        );
    }
    if (config.maxWaveBank !== config.waveBankCount - 1) {
        throw new Error(
            `Invalid config: maxWaveBank (${config.maxWaveBank}) should be waveBankCount - 1 (${config.waveBankCount - 1})`
        );
    }
}
