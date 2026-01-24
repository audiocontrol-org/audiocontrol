/**
 * Roland S-330 Address Map Constants
 *
 * SysEx address definitions for Roland S-330 sampler.
 * See /docs/s330_sysex.md for complete protocol documentation.
 *
 * @packageDocumentation
 */

// =============================================================================
// Device Identification
// =============================================================================

/** Roland manufacturer ID */
export const ROLAND_ID = 0x41;

/** S-330/S-550 model ID */
export const S330_MODEL_ID = 0x1E;

/** Default device ID (can be changed on sampler) */
export const DEFAULT_DEVICE_ID = 0x00;

// =============================================================================
// Command Bytes
// =============================================================================

/** SysEx command byte values */
export const S330_COMMANDS = {
    /** Data Request (host to device) */
    RQ1: 0x11,
    /** Data Set (host to device) */
    DT1: 0x12,
    /** Want to Send Data (bulk dump initiate) */
    WSD: 0x40,
    /** Request Data (bulk dump request) */
    RQD: 0x41,
    /** Data Transfer (bulk dump packet) */
    DAT: 0x42,
    /** Acknowledge */
    ACK: 0x43,
    /** End of Data */
    EOD: 0x45,
    /** Communication Error */
    ERR: 0x4E,
    /** Rejection */
    RJC: 0x4F,
} as const;

// =============================================================================
// Base Addresses (4-byte format)
// =============================================================================

/** System parameters base address */
export const ADDR_SYSTEM = [0x00, 0x00, 0x00, 0x00] as const;

/** Patch parameters base address
 * Each patch occupies stride of 4: patch N at [0x00, 0x00, N*4, 0x00]
 * Note: Patch addresses are in bank 0x00 0x00, NOT 0x00 0x01
 */
export const ADDR_PATCH_BASE = [0x00, 0x00, 0x00, 0x00] as const;

/** Tone parameters base address
 * Each tone occupies stride of 2: tone N at [0x00, 0x02, N*2, 0x00]
 * Total size per tone: 00 00 02 00H (512 nibble-bytes)
 */
export const ADDR_TONE_BASE = [0x00, 0x02, 0x00, 0x00] as const;

/** Tone stride in address byte 2
 * Each tone occupies 4 units in byte 2 (same as patches)
 * Total size 00 00 02 00H refers to internal structure, not address stride
 */
export const TONE_STRIDE = 4;

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
// Patch Parameter Offsets
// =============================================================================

/**
 * Patch parameter offsets (byte positions after de-nibblization)
 *
 * Each patch is 512 bytes total (1024 nibbles)
 * Patches are accessed at address: 00 00 (pp*4) 00 where pp = patch number 0-63
 */
export const PATCH_COMMON_OFFSETS = {
    NAME: 0,                 // 12 bytes (nibble address 00 00H-00 17H)
    BENDER_RANGE: 12,        // nibble address 00 18H
    AFTERTOUCH_SENS: 14,     // nibble address 00 1CH
    KEY_MODE: 15,            // nibble address 00 1EH (0-4: Normal/V-Sw/X-Fade/V-Mix/Unison)
    VELOCITY_THRESHOLD: 16,  // nibble address 00 20H
    TONE_LAYER_1: 17,        // nibble address 00 22H-01 7BH (109 entries, -1 to 31)
    TONE_LAYER_2: 126,       // nibble address 01 7CH-03 55H (109 entries, 0-31)
    COPY_SOURCE: 235,        // nibble address 03 56H
    OCTAVE_SHIFT: 284,       // nibble address 03 58H (-2 to +2)
    LEVEL: 285,              // nibble address 03 5AH
    DETUNE: 287,             // nibble address 03 5EH (-64 to +63)
    VELOCITY_MIX_RATIO: 288, // nibble address 03 60H
    AFTERTOUCH_ASSIGN: 289,  // nibble address 03 62H (0-4: Mod/Vol/Bend+/Bend-/Filter)
    KEY_ASSIGN: 290,         // nibble address 03 64H (0=Rotary, 1=Fix)
    OUTPUT_ASSIGN: 291,      // nibble address 03 66H (0-7=Out 1-8, 8=TONE)
} as const;

/** Total size of patch data (512 bytes after de-nibblization) */
export const PATCH_TOTAL_SIZE = 512;

// =============================================================================
// Patch Parameter Definitions (Semantic API)
// =============================================================================

/**
 * Defines a patch parameter with both address and byte offset.
 * This provides a single source of truth for parameter locations:
 * - `address` is used for MIDI SysEx communication (nibble addresses)
 * - `byteOffset` is used for parsing de-nibblized data
 */
export interface PatchParam {
    /** Human-readable parameter name for debugging */
    name: string;
    /** [high, low] nibble offset within patch address space */
    address: readonly [number, number];
    /** Offset in parsed (de-nibblized) patch data */
    byteOffset: number;
    /** Size in bytes (default 1) */
    size: number;
}

/**
 * All patch parameters with their addresses and byte offsets.
 *
 * Address format: Each patch starts at [0x00, 0x00, patchIndex * 4, 0x00]
 * The `address` here is the offset from that base, split into high/low nibbles.
 *
 * For parameters in the upper range (bytes 235+), the high nibble wraps:
 * - Nibble address 0x0356 → [0x03, 0x56] → high byte adds 3 to patch stride
 */
export const PATCH_PARAMS = {
    name: {
        name: 'Name',
        address: [0x00, 0x00] as const,
        byteOffset: 0,
        size: 12,
    },
    benderRange: {
        name: 'Bender Range',
        address: [0x00, 0x18] as const,
        byteOffset: 12,
        size: 1,
    },
    aftertouchSens: {
        name: 'A.T. Sensitivity',
        address: [0x00, 0x1c] as const,
        byteOffset: 14,
        size: 1,
    },
    keyMode: {
        name: 'Key Mode',
        address: [0x00, 0x1e] as const,
        byteOffset: 15,
        size: 1,
    },
    velocityThreshold: {
        name: 'V-Sw Threshold',
        address: [0x00, 0x20] as const,
        byteOffset: 16,
        size: 1,
    },
    toneLayer1: {
        name: 'Tone Layer 1',
        address: [0x00, 0x22] as const,
        byteOffset: 17,
        size: 109,
    },
    toneLayer2: {
        name: 'Tone Layer 2',
        address: [0x01, 0x7c] as const,
        byteOffset: 126,
        size: 109,
    },
    copySource: {
        name: 'Copy Source',
        address: [0x03, 0x56] as const,
        byteOffset: 235, // (3<<7|0x56)/2 = 470/2 = 235
        size: 1,
    },
    octaveShift: {
        name: 'Octave Shift',
        address: [0x03, 0x58] as const,
        byteOffset: 236, // (3<<7|0x58)/2 = 472/2 = 236
        size: 1,
    },
    level: {
        name: 'Level',
        address: [0x03, 0x5a] as const,
        byteOffset: 237, // (3<<7|0x5a)/2 = 474/2 = 237
        size: 1,
    },
    detune: {
        name: 'Detune',
        address: [0x03, 0x5e] as const,
        byteOffset: 239, // (3<<7|0x5e)/2 = 478/2 = 239
        size: 1,
    },
    velocityMixRatio: {
        name: 'V-Mix Ratio',
        address: [0x03, 0x60] as const,
        byteOffset: 240, // (3<<7|0x60)/2 = 480/2 = 240
        size: 1,
    },
    aftertouchAssign: {
        name: 'A.T. Assign',
        address: [0x03, 0x62] as const,
        byteOffset: 241, // (3<<7|0x62)/2 = 482/2 = 241
        size: 1,
    },
    keyAssign: {
        name: 'Key Assign',
        address: [0x03, 0x64] as const,
        byteOffset: 242, // (3<<7|0x64)/2 = 484/2 = 242
        size: 1,
    },
    outputAssign: {
        name: 'Output Assign',
        address: [0x03, 0x66] as const,
        byteOffset: 243, // (3<<7|0x66)/2 = 486/2 = 243
        size: 1,
    },
} as const satisfies Record<string, PatchParam>;

/** Number of tone mapping entries per layer (MIDI notes 21-127) */
export const TONE_MAP_ENTRIES = 109;

/** Maximum patches in memory */
export const MAX_PATCHES = 64;

// =============================================================================
// Tone Parameter Offsets
// =============================================================================

/** Offsets within tone block */
export const TONE_OFFSETS = {
    NAME: 0x00,              // 8 bytes
    ORIGINAL_KEY: 0x08,
    SAMPLE_RATE: 0x09,
    START_ADDRESS: 0x0A,     // 3 bytes (21-bit)
    LOOP_START: 0x0D,        // 3 bytes (21-bit)
    LOOP_END: 0x10,          // 3 bytes (21-bit)
    LOOP_MODE: 0x13,
    COARSE_TUNE: 0x14,
    FINE_TUNE: 0x15,
    LEVEL: 0x16,
    TVA_ATTACK: 0x17,
    TVA_DECAY: 0x18,
    TVA_SUSTAIN: 0x19,
    TVA_RELEASE: 0x1A,
    TVF_CUTOFF: 0x1B,
    TVF_RESONANCE: 0x1C,
    TVF_ENV_DEPTH: 0x1D,
    TVF_ATTACK: 0x1E,
    TVF_DECAY: 0x1F,
    TVF_SUSTAIN: 0x20,
    TVF_RELEASE: 0x21,
    LFO_RATE: 0x22,
    LFO_DEPTH: 0x23,
    LFO_DELAY: 0x24,
    LFO_DESTINATION: 0x25,
} as const;

/** Size of tone block */
export const TONE_BLOCK_SIZE = 0x26;

/** Maximum tones in memory */
export const MAX_TONES = 32;

// =============================================================================
// Bulk Dump Type Codes
// =============================================================================

/** Bulk dump type identifiers for WSD/RQD commands */
export const BULK_DUMP_TYPES = {
    ALL_PATCHES: 0x00,
    ALL_TONES: 0x01,
    SINGLE_PATCH: 0x02,
    SINGLE_TONE: 0x03,
    WAVE_DATA: 0x04,
    ALL_DATA: 0x7F,
} as const;

// =============================================================================
// Error Codes
// =============================================================================

/** Error codes returned in ERR response */
export const ERROR_CODES = {
    CHECKSUM: 0x00,
    UNKNOWN_COMMAND: 0x01,
    WRONG_FORMAT: 0x02,
    MEMORY_FULL: 0x03,
    OUT_OF_RANGE: 0x04,
} as const;

// =============================================================================
// Timing Constants
// =============================================================================

/** Timing parameters for SysEx communication */
export const TIMING = {
    /** Minimum inter-byte delay in ms */
    INTER_BYTE_DELAY_MS: 1,
    /** ACK response timeout in ms */
    ACK_TIMEOUT_MS: 500,
    /** Retry delay after error in ms */
    RETRY_DELAY_MS: 100,
    /** Maximum retry attempts */
    MAX_RETRIES: 3,
    /** Maximum bytes per DAT packet */
    MAX_PACKET_SIZE: 256,
} as const;

// =============================================================================
// Value Ranges
// =============================================================================

/** Parameter value constraints */
export const VALUE_RANGES = {
    /** Device ID range */
    DEVICE_ID: { min: 0x00, max: 0x1F },
    /** MIDI channel range */
    MIDI_CHANNEL: { min: 0x00, max: 0x0F },
    /** Pitch bend range (semitones) */
    BENDER_RANGE: { min: 0x00, max: 0x0C },
    /** Standard 7-bit parameter */
    STANDARD_7BIT: { min: 0x00, max: 0x7F },
    /** Tone number range */
    TONE_NUMBER: { min: 0x00, max: 0x1F },
    /** Patch number range */
    PATCH_NUMBER: { min: 0x00, max: 0x3F },
    /** Partial count range */
    PARTIAL_COUNT: { min: 0x00, max: 0x1F },
} as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build patch address from patch number and offset
 * Patches are at bank 00 00 with stride of 4: address 00 00 (pp*4) offset
 */
export function buildPatchAddress(patchNumber: number, offset: number): number[] {
    return [0x00, 0x00, (patchNumber * 4) & 0x7F, offset & 0x7F];
}

/**
 * Build patch parameter address from patch index and PatchParam definition
 *
 * This is the semantic API for building patch addresses. It combines:
 * - Base patch address: [0x00, 0x00, patchIndex * 4, 0x00]
 * - Parameter offset: param.address[0] added to byte 2, param.address[1] as byte 3
 *
 * Example for patch 0, level parameter (address [0x03, 0x5a]):
 * - Byte 2: 0 * 4 + 3 = 3
 * - Byte 3: 0x5a
 * - Result: [0x00, 0x00, 0x03, 0x5a]
 *
 * Example for patch 1, level parameter:
 * - Byte 2: 1 * 4 + 3 = 7
 * - Byte 3: 0x5a
 * - Result: [0x00, 0x00, 0x07, 0x5a]
 */
export function buildPatchParamAddress(patchIndex: number, param: PatchParam): number[] {
    const [high, low] = param.address;
    return [0x00, 0x00, (patchIndex * 4 + high) & 0x7f, low & 0x7f];
}

/**
 * Build tone address from tone number and offset
 * Empirically determined layout:
 * - Tone 0 at byte2=4
 * - Tone N (N>=1) at byte2=8+N*2
 */
export function buildToneAddress(toneNumber: number, offset: number): number[] {
    const byte2 = toneNumber === 0 ? 4 : (8 + toneNumber * 2);
    return [0x00, 0x02, byte2 & 0x7F, offset & 0x7F];
}

/**
 * Build system parameter address from offset
 */
export function buildSystemAddress(offset: number): number[] {
    return [0x00, 0x00, 0x00, offset & 0x7F];
}

/**
 * Calculate Roland checksum for address and data
 */
export function calculateChecksum(address: number[], data: number[]): number {
    const sum = address.reduce((a, b) => a + b, 0) + data.reduce((a, b) => a + b, 0);
    const checksum = 128 - (sum & 0x7F);
    return checksum === 128 ? 0 : checksum;
}
