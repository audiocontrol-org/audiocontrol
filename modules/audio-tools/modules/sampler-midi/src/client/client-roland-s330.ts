/**
 * Roland S-330 MIDI SysEx Client for Node.js
 *
 * This module re-exports the unified S330Client from @oletizi/sampler-devices
 * and provides Node.js easymidi adapter compatibility.
 *
 * The actual client implementation is now in @oletizi/sampler-devices/s330
 * and works in both Node.js and browser environments via dependency injection.
 *
 * See /docs/s330_sysex.md for complete protocol documentation.
 *
 * ## Protocol Notes
 *
 * The S-330 does NOT support RQ1/DT1 (one-way) commands. It exclusively uses
 * the handshake-based RQD/WSD protocol:
 *
 * - **RQD (0x41)**: Request data from device - returns DAT or RJC
 * - **WSD (0x40)**: Want to send data to device - returns ACK or RJC
 * - **DAT (0x42)**: Data transfer packet (bidirectional)
 * - **ACK (0x43)**: Acknowledge (ready to receive after WSD)
 * - **EOD (0x45)**: End of data transfer
 * - **ERR (0x4E)**: Communication error
 * - **RJC (0x4F)**: Rejection (no data available)
 *
 * @packageDocumentation
 */

// =============================================================================
// Re-export unified client and types
// =============================================================================

export type {
    S330ClientInterface as S330Client,
    PatchNameInfo,
    ToneNameInfo,
    MultiPartConfig,
    S330DataType,
} from '@oletizi/sampler-devices/s330';

export {
    createS330Client,
    S330_DATA_TYPES,
    S330_FUNCTION_ADDRESSES,
} from '@oletizi/sampler-devices/s330';

// Re-export types for convenience
export type {
    S330MidiAdapter as S330MidiIO,
    S330SystemParams,
    S330Patch,
    S330Tone,
    S330PatchCommon,
    S330Response,
    S330Command,
    S330ClientOptions,
} from '@oletizi/sampler-devices/s330';

// Import S330Command for use in function signatures
import type { S330Command } from '@oletizi/sampler-devices/s330';

// Re-export constants for convenience
export {
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S330_COMMANDS,
    TIMING,
    calculateChecksum,
    buildRQDMessage,
    buildWSDMessage,
    buildDATMessage,
    buildACKMessage,
    buildEODMessage,
    buildPatchAddressRQD,
} from '@oletizi/sampler-devices/s330';

// =============================================================================
// Utility Functions (re-exported for backward compatibility)
// =============================================================================

/**
 * Parse command from SysEx response
 */
export function parseResponseCommand(message: number[]): S330Command | null {
    if (message.length < 5) return null;

    const commandByte = message[4];

    const S330_COMMANDS_MAP = {
        0x11: 'RQ1',
        0x12: 'DT1',
        0x40: 'WSD',
        0x41: 'RQD',
        0x42: 'DAT',
        0x43: 'ACK',
        0x45: 'EOD',
        0x4e: 'ERR',
        0x4f: 'RJC',
    } as const;

    return (S330_COMMANDS_MAP[commandByte as keyof typeof S330_COMMANDS_MAP] as S330Command) ?? null;
}

/**
 * Check if response is ACK
 */
export function isAckResponse(message: number[]): boolean {
    return message.length >= 5 && message[4] === 0x43;
}

/**
 * Check if response is error
 */
export function isErrorResponse(message: number[]): boolean {
    return message.length >= 5 && message[4] === 0x4e;
}

/**
 * Check if response is rejection
 */
export function isRejectionResponse(message: number[]): boolean {
    return message.length >= 5 && message[4] === 0x4f;
}

/**
 * Extract error code from ERR response
 */
export function getErrorCode(message: number[]): number | null {
    if (!isErrorResponse(message) || message.length < 6) return null;
    return message[5];
}

/**
 * Verify Roland SysEx checksum
 */
export function verifyChecksum(message: number[]): boolean {
    if (message.length < 8) return false;

    // Extract address (bytes 5-8) and data (bytes 9 to end-2)
    const address = message.slice(5, 9);
    const data = message.slice(9, -2);
    const receivedChecksum = message[message.length - 2];

    // Calculate checksum using the imported function
    const { calculateChecksum } = require('@oletizi/sampler-devices/s330');
    const calculated = calculateChecksum(address, data);
    return calculated === receivedChecksum;
}
