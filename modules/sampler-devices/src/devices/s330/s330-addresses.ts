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
 * Tone N at [0x00, 0x03, N*2, 0x00] (stride of 2)
 * Total size per tone: 256 bytes (512 nibbles)
 */
export const ADDR_TONE_BASE = [0x00, 0x03, 0x00, 0x00] as const;

/** Tone stride in address byte 2
 * Each tone occupies 2 units in byte 2
 */
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

/** Number of tone mapping entries per layer (MIDI notes 12-120, C0-C9) */
export const TONE_MAP_ENTRIES = 109;

/** Maximum patches in memory (2 banks of 8) */
export const MAX_PATCHES = 16;

// =============================================================================
// Tone Parameter Offsets
// =============================================================================

/**
 * Tone parameter offsets (byte positions after de-nibblization)
 *
 * The S-330 tone block is 512 nibbles (256 bytes after de-nibblization).
 * Nibble addresses from the protocol are converted to byte offsets using:
 *   byteOffset = ((high << 7) | low) / 2
 *
 * For example, nibble address 00 32H = ((0 << 7) | 0x32) / 2 = 25 bytes
 */
export const TONE_OFFSETS = {
    // === Basic Info (00 00H - 00 1FH) ===
    NAME: 0,                    // 00 00H-00 0FH: 8 bytes (16 nibbles)
    OUTPUT_ASSIGN: 8,           // 00 10H-00 11H
    SOURCE_TONE: 9,             // 00 12H-00 13H
    ORIG_SUB_TONE: 10,          // 00 14H-00 15H
    SAMPLING_FREQ: 11,          // 00 16H-00 17H (0=30kHz, 1=15kHz)
    ORIG_KEY_NUMBER: 12,        // 00 18H-00 19H (MIDI note 11-108)
    WAVE_BANK: 13,              // 00 1AH-00 1BH (0=A, 1=B)
    WAVE_SEGMENT_TOP: 14,       // 00 1CH-00 1DH
    WAVE_SEGMENT_LENGTH: 15,    // 00 1EH-00 1FH

    // === Wave Points (00 20H - 00 33H) - 24-bit addresses ===
    START_POINT: 16,            // 00 20H-00 25H (6 nibbles = 3 bytes)
    END_POINT: 19,              // 00 26H-00 2BH (6 nibbles = 3 bytes)
    LOOP_POINT: 22,             // 00 2CH-00 31H (6 nibbles = 3 bytes)
    LOOP_MODE: 25,              // 00 32H-00 33H (0=Fwd, 1=Alt, 2=1Shot, 3=Rev)

    // === LFO Parameters (00 34H - 00 47H) ===
    TVA_LFO_DEPTH: 26,          // 00 34H-00 35H
    // 00 36H-00 37H: dummy
    LFO_RATE: 28,               // 00 38H-00 39H
    LFO_SYNC: 29,               // 00 3AH-00 3BH (0=OFF, 1=ON)
    LFO_DELAY: 30,              // 00 3CH-00 3DH
    // 00 3EH-00 3FH: dummy
    LFO_MODE: 32,               // 00 40H-00 41H (0=NORMAL, 1=ONE SHOT)
    TVA_LFO_DEPTH_2: 33,        // 00 42H-00 43H (duplicate?)
    LFO_POLARITY: 34,           // 00 44H-00 45H (0=Sine, 1=Peak hold)
    LFO_OFFSET: 35,             // 00 46H-00 47H

    // === Pitch Parameters (00 48H - 00 4BH) ===
    TRANSPOSE: 36,              // 00 48H-00 49H
    FINE_TUNE: 37,              // 00 4AH-00 4BH (-64 to +63)

    // === TVF Parameters (00 4CH - 00 63H) ===
    TVF_CUTOFF: 38,             // 00 4CH-00 4DH
    TVF_RESONANCE: 39,          // 00 4EH-00 4FH
    TVF_KEY_FOLLOW: 40,         // 00 50H-00 51H
    // 00 52H-00 53H: dummy
    TVF_LFO_DEPTH: 42,          // 00 54H-00 55H
    TVF_EG_DEPTH: 43,           // 00 56H-00 57H
    TVF_EG_POLARITY: 44,        // 00 58H-00 59H (0=NORMAL, 1=REVERSE)
    TVF_LEVEL_CURVE: 45,        // 00 5AH-00 5BH
    TVF_KEY_RATE_FOLLOW: 46,    // 00 5CH-00 5DH
    TVF_VEL_RATE_FOLLOW: 47,    // 00 5EH-00 5FH
    // 00 60H-00 61H: dummy
    TVF_SWITCH: 49,             // 00 62H-00 63H (0=OFF, 1=ON)

    // === Bender Switch (00 64H - 00 65H) ===
    BENDER_SWITCH: 50,          // 00 64H-00 65H

    // === TVA Envelope Config (00 66H - 00 69H) ===
    TVA_ENV_SUSTAIN_POINT: 51,  // 00 66H-00 67H (0-7)
    TVA_ENV_END_POINT: 52,      // 00 68H-00 69H (1-8)

    // === TVA Envelope Points 1-5 (00 6AH - 00 7DH) ===
    TVA_ENV_LEVEL_1: 53,        // 00 6AH-00 6BH
    TVA_ENV_RATE_1: 54,         // 00 6CH-00 6DH
    TVA_ENV_LEVEL_2: 55,        // 00 6EH-00 6FH
    TVA_ENV_RATE_2: 56,         // 00 70H-00 71H
    TVA_ENV_LEVEL_3: 57,        // 00 72H-00 73H
    TVA_ENV_RATE_3: 58,         // 00 74H-00 75H
    TVA_ENV_LEVEL_4: 59,        // 00 76H-00 77H
    TVA_ENV_RATE_4: 60,         // 00 78H-00 79H
    TVA_ENV_LEVEL_5: 61,        // 00 7AH-00 7BH
    TVA_ENV_RATE_5: 62,         // 00 7CH-00 7DH

    // === TVA Envelope Points 6-8 (00 7EH - 01 09H) ===
    TVA_ENV_LEVEL_6: 63,        // 00 7EH-00 7FH
    TVA_ENV_RATE_6: 64,         // 01 00H-01 01H (note: crosses nibble boundary)
    TVA_ENV_LEVEL_7: 65,        // 01 02H-01 03H
    TVA_ENV_RATE_7: 66,         // 01 04H-01 05H
    TVA_ENV_LEVEL_8: 67,        // 01 06H-01 07H
    TVA_ENV_RATE_8: 68,         // 01 08H-01 09H

    // === TVA Additional Parameters (01 0CH - 01 33H) ===
    TVA_KEY_RATE: 70,           // 01 0CH-01 0DH
    TVA_LEVEL: 71,              // 01 0EH-01 0FH (output level)
    TVA_VEL_RATE: 72,           // 01 10H-01 11H
    REC_THRESHOLD: 73,          // 01 12H-01 13H
    REC_PRE_TRIGGER: 74,        // 01 14H-01 15H
    REC_SAMPLING_FREQ: 75,      // 01 16H-01 17H
    REC_START_POINT: 76,        // 01 18H-01 1DH (3 bytes)
    REC_END_POINT: 79,          // 01 1EH-01 23H (3 bytes)
    REC_LOOP_POINT: 82,         // 01 24H-01 29H (3 bytes)
    ZOOM_T: 85,                 // 01 2AH-01 2BH
    ZOOM_L: 86,                 // 01 2CH-01 2DH
    COPY_SOURCE: 87,            // 01 2EH-01 2FH
    LOOP_TUNE: 88,              // 01 30H-01 31H
    TVA_LEVEL_CURVE: 89,        // 01 32H-01 33H

    // === Loop Length (01 4CH - 01 51H) ===
    LOOP_LENGTH: 102,           // 01 4CH-01 51H (3 bytes)

    // === Additional Settings (01 52H - 01 55H) ===
    PITCH_FOLLOW: 105,          // 01 52H-01 53H
    ENV_ZOOM: 106,              // 01 54H-01 55H

    // === TVF Envelope Config (01 56H - 01 59H) ===
    TVF_ENV_SUSTAIN_POINT: 107, // 01 56H-01 57H (0-7)
    TVF_ENV_END_POINT: 108,     // 01 58H-01 59H (1-8)

    // === TVF Envelope Points 1-8 (01 5AH - 01 79H) ===
    TVF_ENV_LEVEL_1: 109,       // 01 5AH-01 5BH
    TVF_ENV_RATE_1: 110,        // 01 5CH-01 5DH
    TVF_ENV_LEVEL_2: 111,       // 01 5EH-01 5FH
    TVF_ENV_RATE_2: 112,        // 01 60H-01 61H
    TVF_ENV_LEVEL_3: 113,       // 01 62H-01 63H
    TVF_ENV_RATE_3: 114,        // 01 64H-01 65H
    TVF_ENV_LEVEL_4: 115,       // 01 66H-01 67H
    TVF_ENV_RATE_4: 116,        // 01 68H-01 69H
    TVF_ENV_LEVEL_5: 117,       // 01 6AH-01 6BH
    TVF_ENV_RATE_5: 118,        // 01 6CH-01 6DH
    TVF_ENV_LEVEL_6: 119,       // 01 6EH-01 6FH
    TVF_ENV_RATE_6: 120,        // 01 70H-01 71H
    TVF_ENV_LEVEL_7: 121,       // 01 72H-01 73H
    TVF_ENV_RATE_7: 122,        // 01 74H-01 75H
    TVF_ENV_LEVEL_8: 123,       // 01 76H-01 77H
    TVF_ENV_RATE_8: 124,        // 01 78H-01 79H

    // === Aftertouch Switch (01 7AH - 01 7BH) ===
    AFTERTOUCH_SWITCH: 125,     // 01 7AH-01 7BH
} as const;

/** Size of tone block in bytes (after de-nibblization) */
export const TONE_BLOCK_SIZE = 256;

/** Size of tone block in nibbles (for RQD size calculation) */
export const TONE_BLOCK_NIBBLES = 512;

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
 *
 * Tone address layout (TONE_STRIDE = 2):
 * - Tone N at [0x00, 0x03, N*2, offset]
 * - Tone 0 at byte2=0, Tone 1 at byte2=2, etc.
 */
export function buildToneAddress(toneNumber: number, offset: number): number[] {
    const byte2 = toneNumber * 2;
    return [0x00, 0x03, byte2 & 0x7F, offset & 0x7F];
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
