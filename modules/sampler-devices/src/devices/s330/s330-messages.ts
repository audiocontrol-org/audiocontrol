/**
 * Roland S-330 SysEx Message Builders
 *
 * Shared message format implementation for S-330 SysEx communication.
 * This module provides the message building logic that should be used by both
 * Node.js (sampler-midi) and browser (s330-editor) transport implementations.
 *
 * ## Message Format
 *
 * All S-330 messages follow Roland's standard SysEx format:
 * F0 41 [dev] 1E [cmd] [address/data] [checksum] F7
 *
 * ## Nibblization
 *
 * The S-330 uses nibblized format for data transmission:
 * - Each byte is split into two 4-bit nibbles
 * - High nibble (MSN) comes first, then low nibble (LSN)
 * - Both nibbles are in range 0x00-0x0F
 *
 * @packageDocumentation
 */

import {
    ROLAND_ID,
    S330_MODEL_ID,
    S330_COMMANDS,
    calculateChecksum,
} from './s330-addresses.js';

// =============================================================================
// Nibblization Functions
// =============================================================================

/**
 * Convert bytes to nibblized format for S-330 transmission
 *
 * Each byte is split into two 4-bit nibbles:
 * - High nibble (bits 7-4) → first output byte
 * - Low nibble (bits 3-0) → second output byte
 *
 * @param data - Array of bytes to nibblize
 * @returns Array of nibbles (2x length of input)
 *
 * @example
 * ```typescript
 * nibblize([0xA5, 0x3C])  // → [0x0A, 0x05, 0x03, 0x0C]
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
 * Convert nibblized S-330 data back to bytes
 *
 * Combines pairs of nibbles back into bytes:
 * - First nibble (MSN) → bits 7-4
 * - Second nibble (LSN) → bits 3-0
 *
 * @param nibbles - Array of nibbles to denibblize (must be even length)
 * @returns Array of bytes (half length of input)
 *
 * @example
 * ```typescript
 * denibblize([0x0A, 0x05, 0x03, 0x0C])  // → [0xA5, 0x3C]
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
 * encodeSize(1024)  // → [0x00, 0x00, 0x08, 0x00]
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
 * Used to request data from the S-330 using address/size format.
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
 *
 * @example
 * ```typescript
 * // Request patch 0 (512 bytes = 1024 nibbles)
 * const msg = buildRQDMessage(0, [0x00, 0x00, 0x00, 0x00], 1024);
 * ```
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
        S330_MODEL_ID,
        S330_COMMANDS.RQD,
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
 * Used to request permission to send data to the S-330.
 * The device responds with ACK (ready) or RJC (rejected).
 *
 * @param deviceId - Device ID (0-31)
 * @param address - 4-byte address
 * @param sizeBytes - Size in BYTES (data payload size)
 * @returns Complete SysEx message
 *
 * @example
 * ```typescript
 * // Request to send 512 bytes to patch 0
 * const msg = buildWSDMessage(0, [0x00, 0x00, 0x00, 0x00], 512);
 * ```
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
        S330_MODEL_ID,
        S330_COMMANDS.WSD,
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
 *
 * @example
 * ```typescript
 * const bytes = [0x12, 0x34, 0x56];
 * const nibbles = nibblize(bytes);
 * const msg = buildDATMessage(0, [0x00, 0x00, 0x00, 0x00], nibbles);
 * ```
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
        S330_MODEL_ID,
        S330_COMMANDS.DAT,
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
        S330_MODEL_ID,
        S330_COMMANDS.ACK,
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
        S330_MODEL_ID,
        S330_COMMANDS.EOD,
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
        S330_MODEL_ID,
        S330_COMMANDS.RJC,
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
        S330_MODEL_ID,
        S330_COMMANDS.ERR,
        errorCode & 0x7F,
        0xF7,
    ];
}

// =============================================================================
// Helper Functions for RQD/WSD
// =============================================================================

/**
 * Build patch address for RQD/WSD/DAT messages
 *
 * Convenience wrapper that builds patch address with offset 0x00.
 * For addresses with other offsets, use buildPatchAddress from s330-addresses.
 *
 * @param patchNumber - Patch number (0-63)
 * @returns 4-byte address [0x00, 0x00, patchNumber*4, 0x00]
 *
 * @throws Error if patch number out of range
 */
export function buildPatchAddressRQD(patchNumber: number): number[] {
    if (patchNumber < 0 || patchNumber >= 64) {
        throw new Error(`Patch number must be 0-63, got ${patchNumber}`);
    }

    return [0x00, 0x00, (patchNumber * 4) & 0x7F, 0x00];
}
