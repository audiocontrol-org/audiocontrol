/**
 * Tests for Roland S-330 MIDI Client
 *
 * Uses mock MIDI I/O to test client behavior without hardware dependencies.
 */

import { describe, it, beforeEach, expect, vi } from 'vitest';
import {
    createS330Client,
    parseResponseCommand,
    isAckResponse,
    isErrorResponse,
    isRejectionResponse,
    getErrorCode,
    verifyChecksum,
    type S330MidiIO,
    type S330Client,
} from '@/client/client-roland-s330.js';

import {
    ROLAND_ID,
    S330_MODEL_ID,
    S330_COMMANDS,
} from '@oletizi/sampler-devices/s330';

/**
 * Create a mock MIDI I/O interface for testing
 */
function createMockMidiIO(): S330MidiIO & {
    _listeners: Array<(message: number[]) => void>;
    _simulateResponse: (message: number[]) => void;
    _lastSentMessage: number[] | null;
} {
    const listeners: Array<(message: number[]) => void> = [];
    let lastSentMessage: number[] | null = null;

    return {
        _listeners: listeners,
        _lastSentMessage: lastSentMessage,

        send: vi.fn((message: number[]) => {
            lastSentMessage = message;
        }),

        onSysEx: vi.fn((callback: (message: number[]) => void) => {
            listeners.push(callback);
        }),

        removeSysExListener: vi.fn((callback: (message: number[]) => void) => {
            const index = listeners.indexOf(callback);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }),

        _simulateResponse: (message: number[]) => {
            listeners.forEach(listener => listener(message));
        },

        get lastSentMessage() {
            return lastSentMessage;
        },
    };
}

describe('Roland S-330 MIDI Client', () => {
    let mockMidiIO: ReturnType<typeof createMockMidiIO>;
    let client: S330Client;

    beforeEach(() => {
        mockMidiIO = createMockMidiIO();
        client = createS330Client(mockMidiIO);
    });

    describe('createS330Client', () => {
        it('should create a client with default options', () => {
            const client = createS330Client(mockMidiIO);
            expect(client).toBeDefined();
            expect(client.getDeviceId()).toBe(0);
        });

        it('should create a client with custom device ID', () => {
            const client = createS330Client(mockMidiIO, { deviceId: 5 });
            expect(client.getDeviceId()).toBe(5);
        });

        it('should accept custom timeout', () => {
            const client = createS330Client(mockMidiIO, { timeoutMs: 1000 });
            expect(client).toBeDefined();
        });

        it('should accept custom retry count', () => {
            const client = createS330Client(mockMidiIO, { retryCount: 5 });
            expect(client).toBeDefined();
        });
    });

    describe('connect/disconnect', () => {
        it('should connect successfully', async () => {
            const result = await client.connect();
            expect(result).toBe(true);
            expect(client.isConnected()).toBe(true);
        });

        it('should disconnect', async () => {
            await client.connect();
            client.disconnect();
            expect(client.isConnected()).toBe(false);
        });

        it('should report not connected initially', () => {
            expect(client.isConnected()).toBe(false);
        });
    });

    describe('sendSysEx', () => {
        it('should build and send correct SysEx message', async () => {
            const address = [0x00, 0x00, 0x00, 0x00];
            const data = [0x40];

            // Simulate response after a short delay
            setTimeout(() => {
                mockMidiIO._simulateResponse([
                    0xF0, ROLAND_ID, 0x00, S330_MODEL_ID,
                    S330_COMMANDS.DT1,
                    ...address,
                    ...data,
                    0x00, // checksum
                    0xF7
                ]);
            }, 10);

            const response = await client.sendSysEx('RQ1', address, data);

            expect(mockMidiIO.send).toHaveBeenCalled();
            expect(response).toBeDefined();
        });

        it('should throw error for unknown command', async () => {
            await expect(
                client.sendSysEx('INVALID' as any, [0, 0, 0, 0], [])
            ).rejects.toThrow('Unknown command');
        });

        it('should register and remove SysEx listener', async () => {
            const address = [0x00, 0x00, 0x00, 0x00];

            setTimeout(() => {
                mockMidiIO._simulateResponse([
                    0xF0, ROLAND_ID, 0x00, S330_MODEL_ID,
                    S330_COMMANDS.ACK,
                    0xF7
                ]);
            }, 10);

            await client.sendSysEx('RQ1', address, []);

            expect(mockMidiIO.onSysEx).toHaveBeenCalled();
            expect(mockMidiIO.removeSysExListener).toHaveBeenCalled();
        });

        it('should timeout if no response received', async () => {
            const clientWithShortTimeout = createS330Client(mockMidiIO, { timeoutMs: 50 });

            await expect(
                clientWithShortTimeout.sendSysEx('RQ1', [0, 0, 0, 0], [])
            ).rejects.toThrow('timeout');
        });

        it('should ignore responses from other devices', async () => {
            const clientWithShortTimeout = createS330Client(mockMidiIO, {
                deviceId: 5,
                timeoutMs: 50
            });

            // Send response from wrong device ID
            setTimeout(() => {
                mockMidiIO._simulateResponse([
                    0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, // Wrong device ID (0 instead of 5)
                    S330_COMMANDS.ACK,
                    0xF7
                ]);
            }, 10);

            await expect(
                clientWithShortTimeout.sendSysEx('RQ1', [0, 0, 0, 0], [])
            ).rejects.toThrow('timeout');
        });
    });

    describe('stub methods throw not implemented', () => {
        it('getSystemParams should throw', async () => {
            await expect(client.getSystemParams()).rejects.toThrow('Not implemented');
        });

        it('setSystemParam should throw', async () => {
            await expect(client.setSystemParam(0, 64)).rejects.toThrow('Not implemented');
        });

        it('getPatchNames should throw', async () => {
            await expect(client.getPatchNames()).rejects.toThrow('Not implemented');
        });

        it('getPatch should throw', async () => {
            await expect(client.getPatch(0)).rejects.toThrow('Not implemented');
        });

        it('setPatch should throw', async () => {
            await expect(client.setPatch(0, {} as any)).rejects.toThrow('Not implemented');
        });

        it('getToneNames should throw', async () => {
            await expect(client.getToneNames()).rejects.toThrow('Not implemented');
        });

        it('getTone should throw', async () => {
            await expect(client.getTone(0)).rejects.toThrow('Not implemented');
        });

        it('setTone should throw', async () => {
            await expect(client.setTone(0, {} as any)).rejects.toThrow('Not implemented');
        });

        it('requestBulkDump should throw', async () => {
            await expect(client.requestBulkDump(0)).rejects.toThrow('Not implemented');
        });

        it('sendBulkDump should throw', async () => {
            await expect(client.sendBulkDump(0)).rejects.toThrow('Not implemented');
        });
    });
});

describe('S-330 Response Parsing Utilities', () => {
    describe('parseResponseCommand', () => {
        it('should parse RQ1 command', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.RQ1, 0xF7];
            expect(parseResponseCommand(message)).toBe('RQ1');
        });

        it('should parse DT1 command', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.DT1, 0xF7];
            expect(parseResponseCommand(message)).toBe('DT1');
        });

        it('should parse ACK command', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ACK, 0xF7];
            expect(parseResponseCommand(message)).toBe('ACK');
        });

        it('should parse ERR command', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ERR, 0xF7];
            expect(parseResponseCommand(message)).toBe('ERR');
        });

        it('should parse RJC command', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.RJC, 0xF7];
            expect(parseResponseCommand(message)).toBe('RJC');
        });

        it('should return null for short messages', () => {
            expect(parseResponseCommand([0xF0, 0x41, 0x00, 0x1E])).toBeNull();
            expect(parseResponseCommand([0xF0])).toBeNull();
            expect(parseResponseCommand([])).toBeNull();
        });

        it('should return null for unknown command', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, 0xFF, 0xF7];
            expect(parseResponseCommand(message)).toBeNull();
        });
    });

    describe('isAckResponse', () => {
        it('should return true for ACK response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ACK, 0xF7];
            expect(isAckResponse(message)).toBe(true);
        });

        it('should return false for non-ACK response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ERR, 0xF7];
            expect(isAckResponse(message)).toBe(false);
        });

        it('should return false for short messages', () => {
            expect(isAckResponse([0xF0, 0x41, 0x00, 0x1E])).toBe(false);
        });
    });

    describe('isErrorResponse', () => {
        it('should return true for ERR response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ERR, 0xF7];
            expect(isErrorResponse(message)).toBe(true);
        });

        it('should return false for non-ERR response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ACK, 0xF7];
            expect(isErrorResponse(message)).toBe(false);
        });

        it('should return false for short messages', () => {
            expect(isErrorResponse([0xF0, 0x41, 0x00, 0x1E])).toBe(false);
        });
    });

    describe('isRejectionResponse', () => {
        it('should return true for RJC response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.RJC, 0xF7];
            expect(isRejectionResponse(message)).toBe(true);
        });

        it('should return false for non-RJC response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ACK, 0xF7];
            expect(isRejectionResponse(message)).toBe(false);
        });

        it('should return false for short messages', () => {
            expect(isRejectionResponse([0xF0, 0x41, 0x00, 0x1E])).toBe(false);
        });
    });

    describe('getErrorCode', () => {
        it('should extract error code from ERR response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ERR, 0x02, 0xF7];
            expect(getErrorCode(message)).toBe(0x02);
        });

        it('should return null for non-ERR response', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ACK, 0xF7];
            expect(getErrorCode(message)).toBeNull();
        });

        it('should return null for short ERR messages', () => {
            const message = [0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.ERR];
            expect(getErrorCode(message)).toBeNull();
        });
    });

    describe('verifyChecksum', () => {
        it('should verify valid checksum', () => {
            // Build a valid message: address 00 01 00 0F, data 64, checksum calculated
            // sum = 0 + 1 + 0 + 15 + 100 = 116, checksum = 128 - 116 = 12 (0x0C)
            const message = [
                0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.DT1,
                0x00, 0x01, 0x00, 0x0F, // address
                0x64, // data
                0x0C, // checksum
                0xF7
            ];
            expect(verifyChecksum(message)).toBe(true);
        });

        it('should reject invalid checksum', () => {
            const message = [
                0xF0, ROLAND_ID, 0x00, S330_MODEL_ID, S330_COMMANDS.DT1,
                0x00, 0x01, 0x00, 0x0F, // address
                0x64, // data
                0xFF, // wrong checksum
                0xF7
            ];
            expect(verifyChecksum(message)).toBe(false);
        });

        it('should return false for short messages', () => {
            expect(verifyChecksum([0xF0, 0x41, 0x00])).toBe(false);
            expect(verifyChecksum([])).toBe(false);
        });
    });
});
