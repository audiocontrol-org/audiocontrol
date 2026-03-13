/**
 * Roland S-Series Shared Constants
 *
 * Protocol constants shared between S-330 and S-550 samplers.
 * Both devices use model ID 0x1E and the same SysEx command codes.
 *
 * @packageDocumentation
 */

// =============================================================================
// Device Identification
// =============================================================================

/** Roland manufacturer ID */
export const ROLAND_ID = 0x41;

/** S-330/S-550 model ID */
export const S_SERIES_MODEL_ID = 0x1E;

/** Default device ID (can be changed on sampler) */
export const DEFAULT_DEVICE_ID = 0x00;

// =============================================================================
// Command Bytes
// =============================================================================

/** SysEx command byte values */
export const S_SERIES_COMMANDS = {
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
    EOD: 0x4F,
    /** Communication Error */
    ERR: 0x4E,
    /** Rejection */
    RJC: 0x45,
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

/** Parameter value constraints shared by all S-series devices */
export const VALUE_RANGES = {
    /** Device ID range */
    DEVICE_ID: { min: 0x00, max: 0x1F },
    /** MIDI channel range */
    MIDI_CHANNEL: { min: 0x00, max: 0x0F },
    /** Pitch bend range (semitones) */
    BENDER_RANGE: { min: 0x00, max: 0x0C },
    /** Standard 7-bit parameter */
    STANDARD_7BIT: { min: 0x00, max: 0x7F },
} as const;

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
