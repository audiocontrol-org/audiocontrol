/**
 * Roland S-330 MIDI SysEx Client
 *
 * MIDI client for communicating with Roland S-330 samplers via SysEx.
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

import type {
    S330SystemParams,
    S330Patch,
    S330Tone,
    S330ClientOptions,
    S330Response,
    S330Command,
} from '@oletizi/sampler-devices/s330';

import {
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S330_COMMANDS,
    TIMING,
    calculateChecksum,
} from '@oletizi/sampler-devices/s330';

// =============================================================================
// RQD/WSD Data Types
// =============================================================================

/**
 * Data type codes for RQD (Request Data) and WSD (Want to Send Data)
 */
export const S330_DATA_TYPES = {
    /** Complete memory dump */
    ALL_DATA: 0x00,
    /** Patches 1-32 */
    PATCH_1_32: 0x01,
    /** Patches 33-64 */
    PATCH_33_64: 0x02,
    /** Tones 1-32 */
    TONE_1_32: 0x03,
    /** Tones 33-64 (expanded memory) */
    TONE_33_64: 0x04,
    /** Function/system parameters */
    FUNCTION: 0x05,
} as const;

export type S330DataType = typeof S330_DATA_TYPES[keyof typeof S330_DATA_TYPES];

// =============================================================================
// Types
// =============================================================================

/**
 * MIDI I/O interface (to be injected)
 */
export interface S330MidiIO {
    send(message: number[]): void;
    onSysEx(callback: (message: number[]) => void): void;
    removeSysExListener(callback: (message: number[]) => void): void;
}

/**
 * S-330 client interface
 */
export interface S330Client {
    /** Initialize connection and verify device */
    connect(): Promise<boolean>;

    /** Disconnect from device */
    disconnect(): void;

    /** Check if connected */
    isConnected(): boolean;

    /** Get device ID */
    getDeviceId(): number;

    /** Request system parameters */
    getSystemParams(): Promise<S330SystemParams>;

    /** Set system parameter */
    setSystemParam(offset: number, value: number): Promise<S330Response>;

    /** Get list of patch names */
    getPatchNames(): Promise<string[]>;

    /** Get patch by number */
    getPatch(patchNumber: number): Promise<S330Patch>;

    /** Set patch data */
    setPatch(patchNumber: number, patch: S330Patch): Promise<S330Response>;

    /** Get list of tone names */
    getToneNames(): Promise<string[]>;

    /** Get tone by number */
    getTone(toneNumber: number): Promise<S330Tone>;

    /** Set tone data */
    setTone(toneNumber: number, tone: S330Tone): Promise<S330Response>;

    /** Send raw SysEx message and wait for response */
    sendSysEx(command: S330Command, address: number[], data: number[]): Promise<number[]>;

    /** Request bulk dump via RQD protocol - returns array of DAT packets */
    requestBulkDump(dataType: S330DataType): Promise<number[][]>;

    /** Send bulk dump via WSD/DAT/EOD protocol */
    sendBulkDump(dataType: S330DataType, data: number[]): Promise<S330Response>;
}

// =============================================================================
// Client Implementation
// =============================================================================

/**
 * Create a new S-330 MIDI client
 *
 * @param midiIO - MIDI input/output interface
 * @param options - Client configuration options
 * @returns S330Client instance
 *
 * @example
 * ```typescript
 * const client = createS330Client(midiIO, { deviceId: 0 });
 * await client.connect();
 *
 * const patches = await client.getPatchNames();
 * console.log('Patches:', patches);
 *
 * const tone = await client.getTone(0);
 * console.log('Tone 0:', tone.name);
 * ```
 */
export function createS330Client(
    midiIO: S330MidiIO,
    options: S330ClientOptions = {}
): S330Client {
    const deviceId = options.deviceId ?? DEFAULT_DEVICE_ID;
    const timeoutMs = options.timeoutMs ?? TIMING.ACK_TIMEOUT_MS;
    const _retryCount = options.retryCount ?? TIMING.MAX_RETRIES;

    let connected = false;

    /**
     * Build SysEx message with checksum
     */
    function buildMessage(command: number, address: number[], data: number[]): number[] {
        const message = [
            0xF0,           // SysEx start
            ROLAND_ID,      // Roland
            deviceId,       // Device ID
            S330_MODEL_ID,  // S-330
            command,        // Command
            ...address,     // Address (4 bytes)
            ...data,        // Data
        ];

        // Add checksum (address + data)
        const checksum = calculateChecksum(address, data);
        message.push(checksum);

        message.push(0xF7);  // SysEx end

        return message;
    }

    /**
     * Send message and wait for response
     */
    function sendAndReceive(message: number[]): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                midiIO.removeSysExListener(listener);
                reject(new Error('S-330 response timeout'));
            }, timeoutMs);

            function listener(response: number[]) {
                // Verify response is from our device
                if (response.length >= 5 &&
                    response[1] === ROLAND_ID &&
                    response[2] === deviceId &&
                    response[3] === S330_MODEL_ID) {
                    clearTimeout(timeout);
                    midiIO.removeSysExListener(listener);
                    resolve(response);
                }
            }

            midiIO.onSysEx(listener);
            midiIO.send(message);
        });
    }

    return {
        async connect(): Promise<boolean> {
            // TODO: Send identity request or simple parameter read to verify device
            // For now, just mark as connected
            connected = true;
            return true;
        },

        disconnect(): void {
            connected = false;
        },

        isConnected(): boolean {
            return connected;
        },

        getDeviceId(): number {
            return deviceId;
        },

        async getSystemParams(): Promise<S330SystemParams> {
            // NOTE: S-330 doesn't support RQ1. Must use requestBulkDump(FUNCTION) instead.
            throw new Error('Not implemented: getSystemParams - use requestBulkDump(S330_DATA_TYPES.FUNCTION)');
        },

        async setSystemParam(_offset: number, _value: number): Promise<S330Response> {
            // NOTE: S-330 doesn't respond to DT1. Must use sendBulkDump instead.
            throw new Error('Not implemented: setSystemParam - use sendBulkDump');
        },

        async getPatchNames(): Promise<string[]> {
            // Use requestBulkDump(S330_DATA_TYPES.PATCH_1_32) and parse names
            throw new Error('Not implemented: getPatchNames - use requestBulkDump');
        },

        async getPatch(_patchNumber: number): Promise<S330Patch> {
            // NOTE: S-330 doesn't support individual patch requests via RQ1.
            // Must dump all patches with requestBulkDump and filter.
            throw new Error('Not implemented: getPatch - use requestBulkDump');
        },

        async setPatch(_patchNumber: number, _patch: S330Patch): Promise<S330Response> {
            // Use sendBulkDump with patch data
            throw new Error('Not implemented: setPatch - use sendBulkDump');
        },

        async getToneNames(): Promise<string[]> {
            // Use requestBulkDump(S330_DATA_TYPES.TONE_1_32) and parse names
            throw new Error('Not implemented: getToneNames - use requestBulkDump');
        },

        async getTone(_toneNumber: number): Promise<S330Tone> {
            // NOTE: S-330 doesn't support individual tone requests via RQ1.
            // Must dump all tones with requestBulkDump and filter.
            throw new Error('Not implemented: getTone - use requestBulkDump');
        },

        async setTone(_toneNumber: number, _tone: S330Tone): Promise<S330Response> {
            // Use sendBulkDump with tone data
            throw new Error('Not implemented: setTone - use sendBulkDump');
        },

        async sendSysEx(command: S330Command, address: number[], data: number[]): Promise<number[]> {
            const commandByte = S330_COMMANDS[command as keyof typeof S330_COMMANDS];
            if (commandByte === undefined) {
                throw new Error(`Unknown command: ${command}`);
            }

            const message = buildMessage(commandByte, address, data);
            return sendAndReceive(message);
        },

        async requestBulkDump(dataType: S330DataType): Promise<number[][]> {
            // Build RQD message: F0 41 dev 1E 41 tt cs F7
            const checksum = (128 - (dataType & 0x7F)) & 0x7F;
            const message = [
                0xF0,
                ROLAND_ID,
                deviceId,
                S330_MODEL_ID,
                S330_COMMANDS.RQD,
                dataType,
                checksum,
                0xF7,
            ];

            return new Promise((resolve, reject) => {
                const packets: number[][] = [];
                let timeoutId: NodeJS.Timeout;

                function resetTimeout() {
                    if (timeoutId) clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        midiIO.removeSysExListener(listener);
                        if (packets.length > 0) {
                            resolve(packets);
                        } else {
                            reject(new Error('RQD response timeout - no data received'));
                        }
                    }, timeoutMs * 2); // Extended timeout for bulk data
                }

                function listener(response: number[]) {
                    // Verify response is from our device
                    if (response.length < 5 ||
                        response[1] !== ROLAND_ID ||
                        response[2] !== deviceId ||
                        response[3] !== S330_MODEL_ID) {
                        return;
                    }

                    resetTimeout();
                    const command = response[4];

                    if (command === S330_COMMANDS.DAT) {
                        packets.push(response);
                    } else if (command === S330_COMMANDS.EOD) {
                        clearTimeout(timeoutId);
                        midiIO.removeSysExListener(listener);
                        resolve(packets);
                    } else if (command === S330_COMMANDS.RJC) {
                        clearTimeout(timeoutId);
                        midiIO.removeSysExListener(listener);
                        reject(new Error('RQD request rejected - no data available'));
                    } else if (command === S330_COMMANDS.ERR) {
                        clearTimeout(timeoutId);
                        midiIO.removeSysExListener(listener);
                        reject(new Error('RQD communication error'));
                    }
                }

                resetTimeout();
                midiIO.onSysEx(listener);
                midiIO.send(message);
            });
        },

        async sendBulkDump(dataType: S330DataType, data: number[]): Promise<S330Response> {
            // First, send WSD to request permission to send
            const wsdChecksum = (128 - (dataType & 0x7F)) & 0x7F;
            const wsdMessage = [
                0xF0,
                ROLAND_ID,
                deviceId,
                S330_MODEL_ID,
                S330_COMMANDS.WSD,
                dataType,
                wsdChecksum,
                0xF7,
            ];

            // Wait for ACK
            const response = await sendAndReceive(wsdMessage);
            const responseCommand = response[4];

            if (responseCommand === S330_COMMANDS.RJC) {
                return { success: false, command: 'RJC' as S330Command };
            }
            if (responseCommand !== S330_COMMANDS.ACK) {
                return { success: false, command: 'ERR' as S330Command };
            }

            // Send DAT packets
            // Data format: F0 41 dev 1E 42 tt cs data... checksum F7
            const datMessage = [
                0xF0,
                ROLAND_ID,
                deviceId,
                S330_MODEL_ID,
                S330_COMMANDS.DAT,
                dataType,
                wsdChecksum,
                ...data,
            ];

            // Calculate data checksum (on data type + data)
            const dataSum = dataType + data.reduce((a, b) => a + b, 0);
            const dataChecksum = (128 - (dataSum & 0x7F)) & 0x7F;
            datMessage.push(dataChecksum, 0xF7);

            midiIO.send(datMessage);

            // Send EOD
            const eodMessage = [
                0xF0,
                ROLAND_ID,
                deviceId,
                S330_MODEL_ID,
                S330_COMMANDS.EOD,
                0xF7,
            ];
            midiIO.send(eodMessage);

            return { success: true, command: 'EOD' as S330Command };
        },
    };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Parse command from SysEx response
 */
export function parseResponseCommand(message: number[]): S330Command | null {
    if (message.length < 5) return null;

    const commandByte = message[4];

    for (const [name, value] of Object.entries(S330_COMMANDS)) {
        if (value === commandByte) {
            return name as S330Command;
        }
    }

    return null;
}

/**
 * Check if response is ACK
 */
export function isAckResponse(message: number[]): boolean {
    return message.length >= 5 && message[4] === S330_COMMANDS.ACK;
}

/**
 * Check if response is error
 */
export function isErrorResponse(message: number[]): boolean {
    return message.length >= 5 && message[4] === S330_COMMANDS.ERR;
}

/**
 * Check if response is rejection
 */
export function isRejectionResponse(message: number[]): boolean {
    return message.length >= 5 && message[4] === S330_COMMANDS.RJC;
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

    const calculated = calculateChecksum(address, data);
    return calculated === receivedChecksum;
}
