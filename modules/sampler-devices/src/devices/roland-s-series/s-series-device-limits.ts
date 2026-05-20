/**
 * Canonical Roland S-series device-limit constants.
 *
 * Both S-330 and S-550 share the same SysEx model ID (0x1E) and the same
 * shared parse/encode functions in `s-series-params.ts`. The shared encoders
 * mask outgoing field values against per-device limits so that, for example,
 * an S-330 patch encoded with a 6-bit source-tone index is clamped to its
 * 5-bit (0..31) range before transmission.
 *
 * Single source of truth for the 5 numeric constants per device. Importing
 * these instead of redeclaring lets the TypeScript compiler catch drift at
 * compile time — there is no separate "cross-check unit test" to maintain.
 *
 * @packageDocumentation
 */

import type { SSeriesDeviceLimits } from './s-series-types.js';

/**
 * S-330 device limits.
 *
 * - `sourcetoneMask` 0x1F: source-tone index is 5-bit (0..31)
 * - `waveBankMask`   0x01: wave bank is 1-bit (A/B)
 * - `copySourceMask` 0x1F: copy-source index mirrors sourcetoneMask
 * - `maxPatchNumber` 63:   S-330 stores 64 patches
 * - `maxToneNumber`  31:   S-330 stores 32 tones
 */
export const S330_DEVICE_LIMITS: SSeriesDeviceLimits = {
    sourcetoneMask: 0x1F,
    waveBankMask: 0x01,
    copySourceMask: 0x1F,
    maxPatchNumber: 63,
    maxToneNumber: 31,
};

/**
 * S-550 device limits.
 *
 * - `sourcetoneMask` 0x3F: source-tone index is 6-bit (0..63)
 * - `waveBankMask`   0x03: wave bank is 2-bit (A/B/C/D)
 * - `copySourceMask` 0x3F: copy-source index mirrors sourcetoneMask
 * - `maxPatchNumber` 31:   S-550 stores 32 patches
 * - `maxToneNumber`  63:   S-550 stores 64 tones
 */
export const S550_DEVICE_LIMITS: SSeriesDeviceLimits = {
    sourcetoneMask: 0x3F,
    waveBankMask: 0x03,
    copySourceMask: 0x3F,
    maxPatchNumber: 31,
    maxToneNumber: 63,
};
