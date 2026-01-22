/**
 * Roland S-330 MIDI SysEx Client
 *
 * MIDI client for communicating with Roland S-330 samplers via SysEx.
 * See /docs/s330_sysex.md for complete protocol documentation.
 *
 * ## Status
 *
 * This is a stub implementation. The interfaces and basic structure
 * are defined, but actual MIDI communication is not yet implemented.
 *
 * TODO:
 * - [ ] Implement SysEx message building
 * - [ ] Implement response parsing
 * - [ ] Add handshake protocol (ACK/ERR handling)
 * - [ ] Add bulk dump support (WSD/RQD/DAT)
 * - [ ] Add wave data transfer
 * - [ ] Add timeout and retry logic
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

    /** Request bulk dump */
    requestBulkDump(type: number, itemNumber?: number): Promise<void>;

    /** Send bulk dump */
    sendBulkDump(type: number, itemNumber?: number, data?: number[]): Promise<S330Response>;
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
            // TODO: Implement RQ1 request for system parameters
            throw new Error('Not implemented: getSystemParams');
        },

        async setSystemParam(_offset: number, _value: number): Promise<S330Response> {
            // TODO: Implement DT1 command for system parameter
            throw new Error('Not implemented: setSystemParam');
        },

        async getPatchNames(): Promise<string[]> {
            // TODO: Request all patches and extract names
            throw new Error('Not implemented: getPatchNames');
        },

        async getPatch(_patchNumber: number): Promise<S330Patch> {
            // TODO: Implement RQ1 request for patch data
            throw new Error('Not implemented: getPatch');
        },

        async setPatch(_patchNumber: number, _patch: S330Patch): Promise<S330Response> {
            // TODO: Implement DT1 command for patch data
            throw new Error('Not implemented: setPatch');
        },

        async getToneNames(): Promise<string[]> {
            // TODO: Request all tones and extract names
            throw new Error('Not implemented: getToneNames');
        },

        async getTone(_toneNumber: number): Promise<S330Tone> {
            // TODO: Implement RQ1 request for tone data
            throw new Error('Not implemented: getTone');
        },

        async setTone(_toneNumber: number, _tone: S330Tone): Promise<S330Response> {
            // TODO: Implement DT1 command for tone data
            throw new Error('Not implemented: setTone');
        },

        async sendSysEx(command: S330Command, address: number[], data: number[]): Promise<number[]> {
            const commandByte = S330_COMMANDS[command as keyof typeof S330_COMMANDS];
            if (commandByte === undefined) {
                throw new Error(`Unknown command: ${command}`);
            }

            const message = buildMessage(commandByte, address, data);
            return sendAndReceive(message);
        },

        async requestBulkDump(_type: number, _itemNumber?: number): Promise<void> {
            // TODO: Implement RQD command
            throw new Error('Not implemented: requestBulkDump');
        },

        async sendBulkDump(_type: number, _itemNumber?: number, _data?: number[]): Promise<S330Response> {
            // TODO: Implement WSD/DAT/EOD sequence
            throw new Error('Not implemented: sendBulkDump');
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
