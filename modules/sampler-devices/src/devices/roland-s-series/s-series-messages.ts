/**
 * Roland S-Series SysEx Message Builders
 *
 * Shared message format implementation for S-series SysEx communication.
 * Both S-330 and S-550 use the same message format (model ID 0x1E).
 *
 * ## Message Format
 *
 * All S-series messages follow Roland's standard SysEx format:
 * F0 41 [dev] 1E [cmd] [address/data] [checksum] F7
 *
 * ## Nibblization
 *
 * The S-series uses nibblized format for data transmission:
 * - Each byte is split into two 4-bit nibbles
 * - High nibble (MSN) comes first, then low nibble (LSN)
 * - Both nibbles are in range 0x00-0x0F
 *
 * @packageDocumentation
 */

import {
    ROLAND_ID,
    S_SERIES_MODEL_ID,
    S_SERIES_COMMANDS,
} from './s-series-constants.js';

// =============================================================================
// Nibblization Functions
// =============================================================================

/**
 * Convert bytes to nibblized format for S-series transmission
 *
 * Each byte is split into two 4-bit nibbles:
 * - High nibble (bits 7-4) -> first output byte
 * - Low nibble (bits 3-0) -> second output byte
 *
 * @param data - Array of bytes to nibblize
 * @returns Array of nibbles (2x length of input)
 *
 * @example
 * ```typescript
 * nibblize([0xA5, 0x3C])  // -> [0x0A, 0x05, 0x03, 0x0C]
 * ```
 */
export function nibblize(data: number[]): number[] {
    const result: number[] = [];
    for (const byte of data) {
        result.push((byte >> 4) & 0x0F); // High nibble
        result.push(byte & 0x0F);         // Low nibble
    }
    return result;
}

/**
 * Convert nibblized S-series data back to bytes
 *
 * Combines pairs of nibbles back into bytes:
 * - First nibble (MSN) -> bits 7-4
 * - Second nibble (LSN) -> bits 3-0
 *
 * @param nibbles - Array of nibbles to denibblize (must be even length)
 * @returns Array of bytes (half length of input)
 *
 * @example
 * ```typescript
 * denibblize([0x0A, 0x05, 0x03, 0x0C])  // -> [0xA5, 0x3C]
 * ```
 */
export function denibblize(nibbles: number[]): number[] {
    const result: number[] = [];
    for (let i = 0; i < nibbles.length - 1; i += 2) {
        const msn = nibbles[i] & 0x0F;
        const lsn = nibbles[i + 1] & 0x0F;
        result.push((msn << 4) | lsn);
    }
    return result;
}

// =============================================================================
// Checksum Calculation
// =============================================================================

/**
 * Calculate Roland checksum for address and data
 *
 * Checksum = 128 - (sum of all bytes & 0x7F)
 * If result is 128, use 0 instead.
 */
export function calculateChecksum(address: number[], data: number[]): number {
    const sum = address.reduce((a, b) => a + b, 0) + data.reduce((a, b) => a + b, 0);
    const checksum = 128 - (sum & 0x7F);
    return checksum === 128 ? 0 : checksum;
}

// =============================================================================
// Size Encoding
// =============================================================================

/**
 * Encode size value for RQD/WSD messages
 *
 * Size is encoded as 4 bytes in 7-bit format (28 bits total).
 * For RQD messages, size is in NIBBLES (not bytes).
 * For WSD messages, size is in BYTES.
 *
 * @param size - Size value to encode
 * @returns 4-byte array in 7-bit format
 *
 * @example
 * ```typescript
 * encodeSize(1024)  // -> [0x00, 0x00, 0x08, 0x00]
 * ```
 */
export function encodeSize(size: number): number[] {
    return [
        (size >> 21) & 0x7F,
        (size >> 14) & 0x7F,
        (size >> 7) & 0x7F,
        size & 0x7F,
    ];
}

// =============================================================================
// Message Builders
// =============================================================================

/**
 * Build RQD (Request Data) message
 *
 * Format: F0 41 [dev] 1E 41 [address 4B] [size 4B] [checksum] F7
 *
 * Used to request data from the device using address/size format.
 * The device responds with DAT packets followed by EOD.
 *
 * @param deviceId - Device ID (0-31)
 * @param address - 4-byte address
 * @param sizeNibbles - Size in NIBBLES (must be even)
 * @returns Complete SysEx message
 *
 * @throws Error if address is not 4 bytes
 * @throws Error if address LSB is odd
 * @throws Error if sizeNibbles is odd
 */
export function buildRQDMessage(deviceId: number, address: number[], sizeNibbles: number): number[] {
    // Validate address
    if (address.length !== 4) {
        throw new Error(`Address must be 4 bytes, got ${address.length}`);
    }

    // Validate constraints from Roland manual
    if ((address[3] & 0x01) !== 0) {
        throw new Error(`Address LSB must be EVEN, got 0x${address[3].toString(16)}`);
    }
    if ((sizeNibbles & 0x01) !== 0) {
        throw new Error(`Size LSB must be EVEN, got ${sizeNibbles}`);
    }

    const size = encodeSize(sizeNibbles);
    const checksum = calculateChecksum(address, size);

    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.RQD,
        ...address,
        ...size,
        checksum,
        0xF7,
    ];
}

/**
 * Build WSD (Want to Send Data) message
 *
 * Format: F0 41 [dev] 1E 40 [address 4B] [size 4B] [checksum] F7
 *
 * Used to request permission to send data to the device.
 * The device responds with ACK (ready) or RJC (rejected).
 *
 * @param deviceId - Device ID (0-31)
 * @param address - 4-byte address
 * @param sizeBytes - Size in BYTES (data payload size)
 * @returns Complete SysEx message
 */
export function buildWSDMessage(deviceId: number, address: number[], sizeBytes: number): number[] {
    if (address.length !== 4) {
        throw new Error(`Address must be 4 bytes, got ${address.length}`);
    }

    const size = encodeSize(sizeBytes);
    const checksum = calculateChecksum(address, size);

    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.WSD,
        ...address,
        ...size,
        checksum,
        0xF7,
    ];
}

/**
 * Build DAT (Data Transfer) message
 *
 * Format: F0 41 [dev] 1E 42 [address 4B] [data...] [checksum] F7
 *
 * Used to transfer data packets. Data should be nibblized before calling.
 * Sent in response to RQD (by device) or after ACK from WSD (by host).
 *
 * @param deviceId - Device ID (0-31)
 * @param address - 4-byte address
 * @param data - Nibblized data to send
 * @returns Complete SysEx message
 */
export function buildDATMessage(deviceId: number, address: number[], data: number[]): number[] {
    if (address.length !== 4) {
        throw new Error(`Address must be 4 bytes, got ${address.length}`);
    }

    const checksum = calculateChecksum(address, data);

    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.DAT,
        ...address,
        ...data,
        checksum,
        0xF7,
    ];
}

/**
 * Build DT1 (Data Set) message for single parameter writes
 *
 * Format: F0 41 [dev] 1E 12 [address 4B] [data...] [checksum] F7
 *
 * @param deviceId - Device ID (0-31)
 * @param address - 4-byte address
 * @param data - Data to send (NOT nibblized for DT1)
 * @returns Complete SysEx message
 */
export function buildDT1Message(deviceId: number, address: number[], data: number[]): number[] {
    if (address.length !== 4) {
        throw new Error(`Address must be 4 bytes, got ${address.length}`);
    }

    const checksum = calculateChecksum(address, data);

    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.DT1,
        ...address,
        ...data,
        checksum,
        0xF7,
    ];
}

/**
 * Build ACK (Acknowledge) message
 *
 * Format: F0 41 [dev] 1E 43 F7
 *
 * Sent to acknowledge receipt of data or readiness to receive.
 *
 * @param deviceId - Device ID (0-31)
 * @returns Complete SysEx message
 */
export function buildACKMessage(deviceId: number): number[] {
    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.ACK,
        0xF7,
    ];
}

/**
 * Build EOD (End of Data) message
 *
 * Format: F0 41 [dev] 1E 45 F7
 *
 * Sent to signal end of multi-packet data transfer.
 *
 * @param deviceId - Device ID (0-31)
 * @returns Complete SysEx message
 */
export function buildEODMessage(deviceId: number): number[] {
    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.EOD,
        0xF7,
    ];
}

/**
 * Build RJC (Rejection) message
 *
 * Format: F0 41 [dev] 1E 4F F7
 *
 * Sent by device to reject a request (no data available, busy, etc).
 *
 * @param deviceId - Device ID (0-31)
 * @returns Complete SysEx message
 */
export function buildRJCMessage(deviceId: number): number[] {
    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.RJC,
        0xF7,
    ];
}

/**
 * Build ERR (Error) message
 *
 * Format: F0 41 [dev] 1E 4E [error-code] F7
 *
 * Sent by device to signal a communication error.
 *
 * @param deviceId - Device ID (0-31)
 * @param errorCode - Error code (0-127)
 * @returns Complete SysEx message
 */
export function buildERRMessage(deviceId: number, errorCode: number): number[] {
    return [
        0xF0,
        ROLAND_ID,
        deviceId,
        S_SERIES_MODEL_ID,
        S_SERIES_COMMANDS.ERR,
        errorCode & 0x7F,
        0xF7,
    ];
}
