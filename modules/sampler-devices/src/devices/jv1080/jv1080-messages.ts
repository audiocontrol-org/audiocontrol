import {
    JV_1080_COMMANDS,
    JV_1080_MODEL_ID,
    ROLAND_MANUFACTURER_ID,
} from "./jv1080-addresses.js";
import type {
    Jv1080Address,
    Jv1080ParameterEvent,
    Jv1080SysexMessage,
} from "./jv1080-types.js";

/**
 * Calculate Roland checksum for a message payload.
 *
 * Formula: (128 - (sum(data) % 128)) % 128
 */
export function calculateRolandChecksum(data: number[]): number {
    return (128 - data.reduce((acc, value) => (acc + value) % 128, 0)) % 128;
}

/**
 * Build a complete JV-1080 SysEx message.
 */
export function buildJv1080SysexMessage(deviceId: number, command: number, payload: number[]): number[] {
    const checksum = calculateRolandChecksum(payload);
    return [0xf0, ROLAND_MANUFACTURER_ID, deviceId, JV_1080_MODEL_ID, command, ...payload, checksum, 0xf7];
}

/**
 * Build DT1 write message for a single address/value pair.
 */
export function buildDt1WriteMessage(deviceId: number, address: Jv1080Address, value: number): number[] {
    return buildJv1080SysexMessage(deviceId, JV_1080_COMMANDS.DT1, [...address, value & 0x7f]);
}

/**
 * Build RQ1 request message.
 */
export function buildRq1RequestMessage(deviceId: number, payload: number[]): number[] {
    return buildJv1080SysexMessage(deviceId, JV_1080_COMMANDS.RQ1, payload);
}

/**
 * Parse a JV-1080 SysEx message.
 *
 * Returns `null` when the message does not match the expected Roland/JV-1080 format.
 */
export function parseJv1080SysexMessage(data: number[]): Jv1080SysexMessage | null {
    if (data.length < 8) {
        return null;
    }

    if (
        data[0] !== 0xf0 ||
        data[data.length - 1] !== 0xf7 ||
        data[1] !== ROLAND_MANUFACTURER_ID ||
        data[3] !== JV_1080_MODEL_ID
    ) {
        return null;
    }

    const payload = data.slice(5, -2);
    const checksum = data[data.length - 2];

    return {
        deviceId: data[2],
        modelId: data[3],
        command: data[4],
        payload,
        checksum,
    };
}

/**
 * Parse a single-parameter DT1 event.
 *
 * Returns `null` if the message is not a DT1 address/value payload.
 */
export function parseJv1080Dt1ParameterEvent(data: number[]): Jv1080ParameterEvent | null {
    const parsed = parseJv1080SysexMessage(data);
    if (!parsed || parsed.command !== JV_1080_COMMANDS.DT1 || parsed.payload.length < 5) {
        return null;
    }

    const address = parsed.payload.slice(0, 4) as Jv1080Address;
    const value = parsed.payload[4] & 0x7f;

    return {
        deviceId: parsed.deviceId,
        address,
        value,
        checksum: parsed.checksum,
    };
}
