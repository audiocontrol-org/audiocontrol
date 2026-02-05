/**
 * S-330 Parameter Change Listener
 *
 * Parses incoming DT1 SysEx messages from the S-330 front panel
 * and maps addresses to cache locations (patch/tone/function).
 *
 * When the user changes parameters on the S-330 front panel, the sampler
 * broadcasts DT1 messages with the new parameter values. This module
 * parses those messages and emits events for UI synchronization.
 *
 * Address spaces:
 * - 00 00 xx xx - Patch params (index = byte2 / 4)
 * - 00 01 xx xx - Function params (multi mode)
 * - 00 03 xx xx - Tone params (index = byte2 / 2)
 * - 00 04 00 00 - UI state/buttons (ignored)
 *
 * @packageDocumentation
 */

import {
    ROLAND_ID,
    S330_MODEL_ID,
    S330_COMMANDS,
} from './s330-addresses.js';

/**
 * Types of parameters that can change
 */
export type ParameterChangeType = 'patch' | 'tone' | 'function';

/**
 * Event emitted when a parameter changes on the hardware
 */
export interface ParameterChangeEvent {
    /** Type of data that changed */
    type: ParameterChangeType;
    /** Index of the item (0-based patch/tone index, or -1 for function params) */
    index: number;
    /** Raw 4-byte address from SysEx */
    address: number[];
    /** De-nibblized data bytes */
    data: number[];
    /** Timestamp when the event was received */
    timestamp: number;
}

/**
 * Result of parsing a SysEx message
 */
export interface ParseResult {
    /** True if this was a valid DT1 message from an S-330 */
    valid: boolean;
    /** Parsed event if valid, null otherwise */
    event: ParameterChangeEvent | null;
    /** Reason for invalid result (for debugging) */
    reason?: string;
}

/**
 * De-nibblize data from DT1 packets
 *
 * S-330 sends data with high nibble and low nibble separated:
 * [high0, low0, high1, low1, ...] -> [byte0, byte1, ...]
 */
function deNibblize(nibbles: number[]): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < nibbles.length - 1; i += 2) {
        const high = (nibbles[i] & 0x0f) << 4;
        const low = nibbles[i + 1] & 0x0f;
        bytes.push(high | low);
    }
    return bytes;
}

/**
 * Map a 4-byte address to its parameter type and index
 *
 * Address structure:
 * - Byte 0, 1: Bank selector
 * - Byte 2: Item index multiplier
 * - Byte 3: Parameter offset within item
 *
 * Patch addresses: 00 00 (patchIndex * 4) offset
 * Tone addresses:  00 03 (toneIndex * 2) offset
 * Function params: 00 01 00 offset
 * UI state:        00 04 00 00 (buttons, ignored)
 */
function mapAddressToType(address: number[]): { type: ParameterChangeType; index: number } | null {
    const [byte0, byte1, byte2, byte3] = address;

    // Must start with 00
    if (byte0 !== 0x00) {
        return null;
    }

    switch (byte1) {
        case 0x00:
            // Patch parameters: 00 00 (patchIndex * 4 + high) low
            // Patch index is derived from byte2 (patchIndex = byte2 / 4)
            // The high nibble of param address adds to byte2
            return {
                type: 'patch',
                index: Math.floor(byte2 / 4),
            };

        case 0x01:
            // Function parameters (multi mode): 00 01 00 offset
            return {
                type: 'function',
                index: -1, // Function params don't have an index
            };

        case 0x03:
            // Tone parameters: 00 03 (toneIndex * 2) offset
            return {
                type: 'tone',
                index: Math.floor(byte2 / 2),
            };

        case 0x04:
            // UI state / button events: 00 04 00 00
            // These are front panel button presses - ignore them
            if (byte2 === 0x00 && byte3 === 0x00) {
                return null;
            }
            // Other 00 04 xx xx addresses - unknown, ignore
            return null;

        default:
            // Unknown address space
            return null;
    }
}

/**
 * Parse an incoming SysEx message to check if it's a parameter change from the S-330
 *
 * DT1 message format:
 * F0 41 dev 1E 12 [addr 4B] [data...] checksum F7
 *
 * @param message - Complete SysEx message including F0 and F7
 * @param expectedDeviceId - Optional device ID to filter (0-31), or undefined to accept any
 * @returns Parse result with event if valid
 */
export function parseDT1Message(message: number[], expectedDeviceId?: number): ParseResult {
    // Minimum message length: F0 + 41 + dev + 1E + 12 + addr[4] + data[>=1] + checksum + F7
    // = 1 + 1 + 1 + 1 + 1 + 4 + 1 + 1 + 1 = 12 bytes minimum
    if (message.length < 12) {
        return { valid: false, event: null, reason: 'Message too short' };
    }

    // Check SysEx framing
    if (message[0] !== 0xf0 || message[message.length - 1] !== 0xf7) {
        return { valid: false, event: null, reason: 'Not a SysEx message' };
    }

    // Check Roland manufacturer ID
    if (message[1] !== ROLAND_ID) {
        return { valid: false, event: null, reason: 'Not a Roland message' };
    }

    // Check S-330 model ID
    if (message[3] !== S330_MODEL_ID) {
        return { valid: false, event: null, reason: 'Not an S-330 message' };
    }

    // Check for DT1 command
    if (message[4] !== S330_COMMANDS.DT1) {
        return { valid: false, event: null, reason: 'Not a DT1 command' };
    }

    // Extract device ID
    const deviceId = message[2];
    if (expectedDeviceId !== undefined && deviceId !== expectedDeviceId) {
        return { valid: false, event: null, reason: `Device ID mismatch (got ${deviceId}, expected ${expectedDeviceId})` };
    }

    // Extract 4-byte address (bytes 5-8)
    const address = [message[5], message[6], message[7], message[8]];

    // Map address to type and index
    const mapped = mapAddressToType(address);
    if (mapped === null) {
        return { valid: false, event: null, reason: 'Address is UI state or unknown' };
    }

    // Extract data (everything between address and checksum)
    // Data starts at byte 9, ends at message.length - 2 (before checksum and F7)
    const dataNibbles = message.slice(9, message.length - 2);

    // De-nibblize the data
    const data = deNibblize(dataNibbles);

    return {
        valid: true,
        event: {
            type: mapped.type,
            index: mapped.index,
            address,
            data,
            timestamp: Date.now(),
        },
    };
}

/**
 * Check if a SysEx message is a DT1 from the S-330 without full parsing
 * Use this for quick filtering before calling parseDT1Message
 */
export function isDT1Message(message: number[]): boolean {
    return (
        message.length >= 12 &&
        message[0] === 0xf0 &&
        message[1] === ROLAND_ID &&
        message[3] === S330_MODEL_ID &&
        message[4] === S330_COMMANDS.DT1 &&
        message[message.length - 1] === 0xf7
    );
}

/**
 * Check if an address represents a UI state event (button press/release)
 * These should be filtered out as they don't represent parameter changes
 */
export function isUIStateAddress(address: number[]): boolean {
    return (
        address.length >= 4 &&
        address[0] === 0x00 &&
        address[1] === 0x04 &&
        address[2] === 0x00 &&
        address[3] === 0x00
    );
}
