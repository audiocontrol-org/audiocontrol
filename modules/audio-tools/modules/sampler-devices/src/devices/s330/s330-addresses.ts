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

/** Patch parameters base address (add patch number to byte 2) */
export const ADDR_PATCH_BASE = [0x00, 0x01, 0x00, 0x00] as const;

/** Tone parameters base address (add tone number to byte 2) */
export const ADDR_TONE_BASE = [0x00, 0x02, 0x00, 0x00] as const;

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

/** Offsets within patch common block */
export const PATCH_COMMON_OFFSETS = {
    NAME: 0x00,              // 8 bytes
    BENDER_RANGE: 0x08,
    AFTERTOUCH_SENS: 0x09,
    KEY_MODE: 0x0A,
    SPLIT_POINT: 0x0B,
    PORTAMENTO_TIME: 0x0C,
    PORTAMENTO_MODE: 0x0D,
    OUTPUT_ASSIGN: 0x0E,
    LEVEL: 0x0F,
} as const;

/** Size of patch common block */
export const PATCH_COMMON_SIZE = 0x10;

/** Offset where partials begin within patch */
export const PATCH_PARTIALS_OFFSET = 0x10;

/** Offsets within each partial block */
export const PARTIAL_OFFSETS = {
    TONE_NUMBER: 0x00,
    KEY_RANGE_LOW: 0x01,
    KEY_RANGE_HIGH: 0x02,
    VEL_RANGE_LOW: 0x03,
    VEL_RANGE_HIGH: 0x04,
    LEVEL: 0x05,
    PAN: 0x06,
    COARSE_TUNE: 0x07,
    FINE_TUNE: 0x08,
    OUTPUT_ASSIGN: 0x09,
    MUTE: 0x0A,
} as const;

/** Size of each partial block */
export const PARTIAL_SIZE = 0x0B;

/** Maximum partials per patch */
export const MAX_PARTIALS = 32;

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
 */
export function buildPatchAddress(patchNumber: number, offset: number): number[] {
    return [0x00, 0x01, patchNumber & 0x3F, offset & 0x7F];
}

/**
 * Build tone address from tone number and offset
 */
export function buildToneAddress(toneNumber: number, offset: number): number[] {
    return [0x00, 0x02, toneNumber & 0x1F, offset & 0x7F];
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
