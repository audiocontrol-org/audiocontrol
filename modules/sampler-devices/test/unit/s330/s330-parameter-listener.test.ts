/**
 * Tests for S-330 Parameter Change Listener
 *
 * Tests parsing of incoming DT1 SysEx messages from hardware front panel edits.
 */

import { describe, it, expect } from 'vitest';
import {
    parseDT1Message,
    isDT1Message,
    isUIStateAddress,
    type ParameterChangeEvent,
} from '../../../src/devices/s330/s330-parameter-listener.js';

// Constants from the protocol
const ROLAND_ID = 0x41;
const S330_MODEL_ID = 0x1e;
const DT1_COMMAND = 0x12;

/**
 * Helper to build a DT1 message
 */
function buildDT1(deviceId: number, address: number[], data: number[]): number[] {
    // Data needs to be nibblized for DT1
    const nibblizedData: number[] = [];
    for (const byte of data) {
        nibblizedData.push((byte >> 4) & 0x0f);
        nibblizedData.push(byte & 0x0f);
    }

    // Calculate checksum over address + nibblized data
    const sum = address.reduce((a, b) => a + b, 0) + nibblizedData.reduce((a, b) => a + b, 0);
    const checksum = (128 - (sum & 0x7f)) & 0x7f;

    return [
        0xf0,
        ROLAND_ID,
        deviceId,
        S330_MODEL_ID,
        DT1_COMMAND,
        ...address,
        ...nibblizedData,
        checksum,
        0xf7,
    ];
}

describe('s330-parameter-listener', () => {
    describe('isDT1Message', () => {
        it('should identify valid DT1 messages', () => {
            const message = buildDT1(0, [0x00, 0x00, 0x00, 0x00], [0x64]);
            expect(isDT1Message(message)).toBe(true);
        });

        it('should reject non-Roland messages', () => {
            const message = [0xf0, 0x42, 0x00, S330_MODEL_ID, DT1_COMMAND, 0x00, 0x00, 0x00, 0x00, 0x06, 0x04, 0x76, 0xf7];
            expect(isDT1Message(message)).toBe(false);
        });

        it('should reject non-S330 messages', () => {
            const message = [0xf0, ROLAND_ID, 0x00, 0x1f, DT1_COMMAND, 0x00, 0x00, 0x00, 0x00, 0x06, 0x04, 0x76, 0xf7];
            expect(isDT1Message(message)).toBe(false);
        });

        it('should reject non-DT1 commands', () => {
            const message = [0xf0, ROLAND_ID, 0x00, S330_MODEL_ID, 0x11, 0x00, 0x00, 0x00, 0x00, 0x06, 0x04, 0x76, 0xf7];
            expect(isDT1Message(message)).toBe(false);
        });

        it('should reject messages that are too short', () => {
            const message = [0xf0, ROLAND_ID, 0x00, S330_MODEL_ID, DT1_COMMAND, 0x00, 0xf7];
            expect(isDT1Message(message)).toBe(false);
        });
    });

    describe('isUIStateAddress', () => {
        it('should identify UI state address (button events)', () => {
            expect(isUIStateAddress([0x00, 0x04, 0x00, 0x00])).toBe(true);
        });

        it('should reject patch addresses', () => {
            expect(isUIStateAddress([0x00, 0x00, 0x00, 0x00])).toBe(false);
        });

        it('should reject tone addresses', () => {
            expect(isUIStateAddress([0x00, 0x03, 0x00, 0x00])).toBe(false);
        });

        it('should reject function addresses', () => {
            expect(isUIStateAddress([0x00, 0x01, 0x00, 0x22])).toBe(false);
        });
    });

    describe('parseDT1Message', () => {
        describe('patch parameter changes', () => {
            it('should parse patch 0 parameter change', () => {
                // Patch 0, level parameter at offset 0x03 0x5a (address 00 00 03 5a)
                const message = buildDT1(0, [0x00, 0x00, 0x03, 0x5a], [0x64]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event).not.toBeNull();
                expect(result.event!.type).toBe('patch');
                expect(result.event!.index).toBe(0); // byte2 (0x03) / 4 = 0
                expect(result.event!.address).toEqual([0x00, 0x00, 0x03, 0x5a]);
                expect(result.event!.data).toEqual([0x64]);
            });

            it('should parse patch 1 parameter change', () => {
                // Patch 1 is at byte2 = 4-7, so 0x04 to 0x07
                // Patch 1 name at address 00 00 04 00
                const message = buildDT1(0, [0x00, 0x00, 0x04, 0x00], [0x54, 0x45, 0x53, 0x54]); // "TEST"
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event!.type).toBe('patch');
                expect(result.event!.index).toBe(1); // byte2 (0x04) / 4 = 1
            });

            it('should parse patch 7 parameter change', () => {
                // Patch 7 is at byte2 = 28-31 (0x1c-0x1f)
                const message = buildDT1(0, [0x00, 0x00, 0x1c, 0x00], [0x41]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event!.type).toBe('patch');
                expect(result.event!.index).toBe(7); // byte2 (0x1c=28) / 4 = 7
            });
        });

        describe('tone parameter changes', () => {
            it('should parse tone 0 parameter change', () => {
                // Tone 0, LFO rate at address 00 03 00 38
                const message = buildDT1(0, [0x00, 0x03, 0x00, 0x38], [0x40]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event!.type).toBe('tone');
                expect(result.event!.index).toBe(0); // byte2 (0x00) / 2 = 0
            });

            it('should parse tone 1 parameter change', () => {
                // Tone 1 is at byte2 = 2 (stride of 2)
                const message = buildDT1(0, [0x00, 0x03, 0x02, 0x38], [0x50]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event!.type).toBe('tone');
                expect(result.event!.index).toBe(1); // byte2 (0x02) / 2 = 1
            });

            it('should parse tone 15 parameter change', () => {
                // Tone 15 is at byte2 = 30 (0x1e)
                const message = buildDT1(0, [0x00, 0x03, 0x1e, 0x00], [0x41, 0x42, 0x43]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event!.type).toBe('tone');
                expect(result.event!.index).toBe(15); // byte2 (0x1e=30) / 2 = 15
            });
        });

        describe('function parameter changes', () => {
            it('should parse function parameter change', () => {
                // Function param (multi mode) at address 00 01 00 22
                const message = buildDT1(0, [0x00, 0x01, 0x00, 0x22], [0x05]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event!.type).toBe('function');
                expect(result.event!.index).toBe(-1); // Function params don't have an index
            });
        });

        describe('UI state events (filtered)', () => {
            it('should filter out button press events', () => {
                // UI state at address 00 04 00 00
                const message = buildDT1(0, [0x00, 0x04, 0x00, 0x00], [0x09, 0x04]); // INC button
                const result = parseDT1Message(message);

                expect(result.valid).toBe(false);
                expect(result.reason).toBe('Address is UI state or unknown');
            });
        });

        describe('device ID filtering', () => {
            it('should accept messages from expected device ID', () => {
                const message = buildDT1(5, [0x00, 0x00, 0x00, 0x00], [0x64]);
                const result = parseDT1Message(message, 5);

                expect(result.valid).toBe(true);
            });

            it('should reject messages from wrong device ID when filtering', () => {
                const message = buildDT1(5, [0x00, 0x00, 0x00, 0x00], [0x64]);
                const result = parseDT1Message(message, 3);

                expect(result.valid).toBe(false);
                expect(result.reason).toContain('Device ID mismatch');
            });

            it('should accept any device ID when not filtering', () => {
                const message = buildDT1(17, [0x00, 0x00, 0x00, 0x00], [0x64]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
            });
        });

        describe('invalid messages', () => {
            it('should reject non-SysEx messages', () => {
                const result = parseDT1Message([0x90, 0x3c, 0x64]); // Note on
                expect(result.valid).toBe(false);
            });

            it('should reject messages without proper framing', () => {
                const result = parseDT1Message([0xf0, ROLAND_ID, 0x00, S330_MODEL_ID, DT1_COMMAND, 0x00, 0x00, 0x00, 0x00]);
                expect(result.valid).toBe(false);
            });
        });

        describe('data de-nibblization', () => {
            it('should correctly de-nibblize multi-byte data', () => {
                // Send 3 bytes: 0xAB, 0xCD, 0xEF -> nibbles: 0A 0B 0C 0D 0E 0F
                const message = buildDT1(0, [0x00, 0x00, 0x00, 0x00], [0xab, 0xcd, 0xef]);
                const result = parseDT1Message(message);

                expect(result.valid).toBe(true);
                expect(result.event!.data).toEqual([0xab, 0xcd, 0xef]);
            });
        });
    });
});
