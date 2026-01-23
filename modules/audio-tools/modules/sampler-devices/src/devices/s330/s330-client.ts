/**
 * Roland S-330 MIDI SysEx Client
 *
 * Universal client for communicating with Roland S-330 samplers via SysEx.
 * Works in both Node.js and browser environments via dependency injection.
 *
 * See /docs/s330_sysex.md for complete protocol documentation.
 *
 * ## Protocol Notes (from hardware testing, January 2026)
 *
 * The S-330 uses the RQD/WSD handshake protocol exclusively:
 *
 * - **RQD with address/size**: F0 41 dev 1E 41 [addr 4B] [size 4B] [cs] F7
 * - **WSD (Want to Send Data)**: Request permission to write parameters
 * - **DAT (Data Transfer)**: Bidirectional data packets with nibblized data
 * - **ACK (Acknowledge)**: Ready to receive next packet
 * - **EOD (End of Data)**: Transfer complete
 * - **ERR (Error)**: Communication error
 * - **RJC (Rejection)**: Request denied or no data available
 *
 * Important constraints:
 * - Both address LSB and size LSB must be EVEN (nibble alignment)
 * - Size represents nibble count, not byte count (size = bytes * 2)
 * - RQD handshake: RQD → DAT → ACK → ... → EOD → ACK (no initial ACK from device)
 * - Function parameter writes MUST use WSD/DAT/EOD (DT1 does not work)
 *
 * @packageDocumentation
 */

import type {
    S330MidiAdapter,
    S330SystemParams,
    S330Patch,
    S330Tone,
    S330ClientOptions,
    S330Response,
    S330Command,
    S330PatchCommon,
} from './s330-types.js';

import {
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S330_COMMANDS,
    TIMING,
    calculateChecksum,
    PATCH_TOTAL_SIZE,
    TONE_BLOCK_SIZE,
    MAX_PATCHES,
    MAX_TONES,
} from './s330-addresses.js';

import {
    parsePatchCommon,
    encodePatchCommon,
    parseName,
} from './s330-params.js';

// =============================================================================
// Data Types
// =============================================================================

/**
 * Data type codes for RQD/WSD commands
 */
export const S330_DATA_TYPES = {
    ALL_DATA: 0x00,
    PATCH_1_32: 0x01,
    PATCH_33_64: 0x02,
    TONE_1_32: 0x03,
    TONE_33_64: 0x04,
    FUNCTION: 0x05,
} as const;

export type S330DataType = (typeof S330_DATA_TYPES)[keyof typeof S330_DATA_TYPES];

/**
 * Function parameter addresses (00 01 00 xx)
 * Base address is 00 01 00 00 (function parameters bank)
 */
export const S330_FUNCTION_ADDRESSES = {
    // MULTI MIDI RX-CH (MIDI channel assignments 0-15 = Ch 1-16)
    MULTI_CHANNEL_A: 0x22,
    MULTI_CHANNEL_B: 0x23,
    MULTI_CHANNEL_C: 0x24,
    MULTI_CHANNEL_D: 0x25,
    MULTI_CHANNEL_E: 0x26,
    MULTI_CHANNEL_F: 0x27,
    MULTI_CHANNEL_G: 0x28,
    MULTI_CHANNEL_H: 0x29,

    // MULTI PATCH NUMBER (patch index 0-63)
    MULTI_PATCH_A: 0x32,
    MULTI_PATCH_B: 0x33,
    MULTI_PATCH_C: 0x34,
    MULTI_PATCH_D: 0x35,
    MULTI_PATCH_E: 0x36,
    MULTI_PATCH_F: 0x37,
    MULTI_PATCH_G: 0x38,
    MULTI_PATCH_H: 0x39,

    // MULTI OUTPUT ASSIGN (output 1-8, 0=mix)
    MULTI_OUTPUT_A: 0x42,
    MULTI_OUTPUT_B: 0x43,
    MULTI_OUTPUT_C: 0x44,
    MULTI_OUTPUT_D: 0x45,
    MULTI_OUTPUT_E: 0x46,
    MULTI_OUTPUT_F: 0x47,
    MULTI_OUTPUT_G: 0x48,
    MULTI_OUTPUT_H: 0x49,

    // MULTI LEVEL (level 0-127)
    MULTI_LEVEL_A: 0x56,
    MULTI_LEVEL_B: 0x57,
    MULTI_LEVEL_C: 0x58,
    MULTI_LEVEL_D: 0x59,
    MULTI_LEVEL_E: 0x5a,
    MULTI_LEVEL_F: 0x5b,
    MULTI_LEVEL_G: 0x5c,
    MULTI_LEVEL_H: 0x5d,
} as const;

/**
 * Patch name info returned from requestAllPatchNames
 */
export interface PatchNameInfo {
    index: number;
    name: string;
    isEmpty: boolean;
}

/**
 * Tone name info returned from requestAllToneNames
 */
export interface ToneNameInfo {
    index: number;
    name: string;
    isEmpty: boolean;
}

/**
 * Multi mode part configuration
 */
export interface MultiPartConfig {
    channel: number; // 0-15 (MIDI channel 1-16)
    patchIndex: number; // 0-63
    output: number; // 0-8 (0=mix, 1-8=individual outputs)
    level: number; // 0-127
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * De-nibblize data from DAT packets
 *
 * S-330 sends data with high nibble and low nibble separated:
 * [high0, low0, high1, low1, ...] → [byte0, byte1, ...]
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
 * Nibblize data for sending via DAT packets
 */
function nibblize(bytes: number[]): number[] {
    const nibbles: number[] = [];
    for (const byte of bytes) {
        nibbles.push((byte >> 4) & 0x0f);
        nibbles.push(byte & 0x0f);
    }
    return nibbles;
}

/**
 * Parse loop mode from byte value
 */
function parseLoopMode(value: number): 'forward' | 'alternating' | 'one-shot' {
    switch (value) {
        case 0:
            return 'forward';
        case 1:
            return 'alternating';
        case 2:
            return 'one-shot';
        default:
            return 'forward';
    }
}

/**
 * Parse LFO destination from byte value
 */
function parseLfoDestination(value: number): 'pitch' | 'tvf' | 'tva' {
    switch (value) {
        case 0:
            return 'pitch';
        case 1:
            return 'tvf';
        case 2:
            return 'tva';
        default:
            return 'pitch';
    }
}

/**
 * Parse sample rate from byte value
 */
function parseSampleRate(value: number): '15kHz' | '30kHz' {
    return value === 0 ? '30kHz' : '15kHz';
}

/**
 * Parse 21-bit address from 3 bytes
 */
function parse21BitAddress(data: number[], offset: number): number {
    return (
        ((data[offset] & 0x7f) << 14) |
        ((data[offset + 1] & 0x7f) << 7) |
        (data[offset + 2] & 0x7f)
    );
}

// =============================================================================
// S-330 Client Interface
// =============================================================================

/**
 * S-330 client interface for MIDI communication
 *
 * This interface provides semantic methods for interacting with the S-330.
 * All address calculations and protocol details are handled internally.
 */
export interface S330ClientInterface {
    connect(): Promise<boolean>;
    disconnect(): void;
    isConnected(): boolean;
    getDeviceId(): number;

    // Patch operations
    requestAllPatchNames(): Promise<PatchNameInfo[]>;
    requestPatchData(patchIndex: number): Promise<S330Patch | null>;
    sendPatchData(patchIndex: number, patch: S330PatchCommon): Promise<void>;

    // Tone operations
    requestAllToneNames(): Promise<ToneNameInfo[]>;
    requestToneData(toneIndex: number): Promise<S330Tone | null>;

    // Multi mode configuration
    requestFunctionParameters(): Promise<MultiPartConfig[]>;
    setMultiChannel(part: number, channel: number): Promise<void>;
    setMultiPatch(part: number, patchIndex: number | null): Promise<void>;
    setMultiOutput(part: number, output: number): Promise<void>;
    setMultiLevel(part: number, level: number): Promise<void>;

    // Individual patch parameter setters
    setPatchKeyMode(
        patchIndex: number,
        keyMode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison'
    ): Promise<void>;
    setPatchBenderRange(patchIndex: number, range: number): Promise<void>;
    setPatchAftertouchSens(patchIndex: number, sens: number): Promise<void>;
    setPatchOutput(patchIndex: number, output: number): Promise<void>;
    setPatchLevel(patchIndex: number, level: number): Promise<void>;
}

// =============================================================================
// Client Implementation
// =============================================================================

/**
 * Create S-330 MIDI client with dependency injection
 *
 * The client internally serializes all MIDI requests to prevent
 * concurrent requests from interfering with each other.
 *
 * @param midiAdapter - MIDI transport adapter (easymidi or Web MIDI)
 * @param options - Client configuration options
 * @returns S330ClientInterface instance
 *
 * @example Node.js with easymidi
 * ```typescript
 * import { createS330Client } from '@oletizi/sampler-devices/s330';
 * import { createEasymidiAdapter } from '@oletizi/sampler-midi';
 *
 * const adapter = createEasymidiAdapter('S-330');
 * const client = createS330Client(adapter, { deviceId: 0 });
 * await client.connect();
 * const patches = await client.requestAllPatchNames();
 * ```
 *
 * @example Browser with Web MIDI
 * ```typescript
 * import { createS330Client } from '@oletizi/sampler-devices/s330';
 * import { createWebMidiAdapter } from './midi/WebMidiAdapter';
 *
 * const adapter = await createWebMidiAdapter(inputPort, outputPort);
 * const client = createS330Client(adapter, { deviceId: 0 });
 * const patches = await client.requestAllPatchNames();
 * ```
 */
export function createS330Client(
    midiAdapter: S330MidiAdapter,
    options: S330ClientOptions = {}
): S330ClientInterface {
    const deviceId = options.deviceId ?? DEFAULT_DEVICE_ID;
    const timeoutMs = options.timeoutMs ?? TIMING.ACK_TIMEOUT_MS;

    let connected = false;

    // Request queue for serializing MIDI operations
    // The S-330 can only handle one request at a time
    let requestQueue: Promise<unknown> = Promise.resolve();

    /**
     * Serialize a request through the queue
     * Ensures only one MIDI request is in flight at a time
     */
    function serialize<T>(fn: () => Promise<T>): Promise<T> {
        const result = requestQueue.then(fn, fn); // Run even if previous failed
        requestQueue = result.catch(() => {}); // Swallow errors for queue chain
        return result;
    }

    /**
     * Send message and wait for response with timeout
     */
    function sendAndReceive(message: number[]): Promise<number[]> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                midiAdapter.removeSysExListener(listener);
                reject(new Error('S-330 response timeout'));
            }, timeoutMs);

            function listener(response: number[]) {
                if (
                    response.length >= 5 &&
                    response[1] === ROLAND_ID &&
                    response[2] === deviceId &&
                    response[3] === S330_MODEL_ID
                ) {
                    clearTimeout(timeout);
                    midiAdapter.removeSysExListener(listener);
                    resolve(response);
                }
            }

            midiAdapter.onSysEx(listener);
            midiAdapter.send(message);
        });
    }

    /**
     * Internal helper: Request data using RQD with address/size format
     *
     * This is the low-level method that handles the RQD handshake protocol.
     * Address and size constraints are enforced automatically:
     * - Address LSB must be even (aligned to nibble boundary)
     * - Size is converted to nibble count (bytes * 2)
     *
     * @param address - 4-byte address [aa, bb, cc, dd]
     * @param sizeInBytes - Number of logical bytes to request
     * @returns De-nibblized data bytes
     */
    async function requestDataWithAddress(
        address: number[],
        sizeInBytes: number
    ): Promise<number[]> {
        if (address.length !== 4) {
            throw new Error('Address must be 4 bytes');
        }

        // Ensure address LSB is even (nibble-aligned)
        if (address[3] & 0x01) {
            throw new Error(
                `Address LSB must be even (got 0x${address[3].toString(16)})`
            );
        }

        // Convert bytes to nibbles (size field represents nibble count)
        const sizeInNibbles = sizeInBytes * 2;

        // Build 4-byte size field (7-bit encoding per byte)
        const size = [
            (sizeInNibbles >> 21) & 0x7f,
            (sizeInNibbles >> 14) & 0x7f,
            (sizeInNibbles >> 7) & 0x7f,
            sizeInNibbles & 0x7f,
        ];

        // Calculate checksum over address + size
        const cs = calculateChecksum(address, size);

        const message = [
            0xf0,
            ROLAND_ID,
            deviceId,
            S330_MODEL_ID,
            S330_COMMANDS.RQD,
            ...address,
            ...size,
            cs,
            0xf7,
        ];

        return new Promise((resolve, reject) => {
            const allNibbles: number[] = [];
            let timeoutId: ReturnType<typeof setTimeout>;

            function resetTimeout() {
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    midiAdapter.removeSysExListener(listener);
                    if (allNibbles.length > 0) {
                        // Partial data received - return what we have
                        resolve(deNibblize(allNibbles));
                    } else {
                        reject(new Error('RQD response timeout - no data received'));
                    }
                }, timeoutMs * 2);
            }

            function sendAck() {
                const ackMsg = [
                    0xf0,
                    ROLAND_ID,
                    deviceId,
                    S330_MODEL_ID,
                    S330_COMMANDS.ACK,
                    0xf7,
                ];
                midiAdapter.send(ackMsg);
            }

            function listener(response: number[]) {
                console.log('[S330Client] Received:', response.slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' '), response.length > 10 ? `... (${response.length} bytes)` : '');
                // Validate response header
                if (response.length < 5) return;
                if (response[1] !== ROLAND_ID) return;
                if (response[3] !== S330_MODEL_ID) return;

                const respDeviceId = response[2];
                const command = response[4];

                // Check device ID
                if (respDeviceId !== deviceId) {
                    if (command === S330_COMMANDS.RJC || command === S330_COMMANDS.ERR) {
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);
                        reject(
                            new Error(
                                `S-330 device ID mismatch (device: ${respDeviceId}, expected: ${deviceId})`
                            )
                        );
                    }
                    return;
                }

                resetTimeout();

                if (command === S330_COMMANDS.DAT) {
                    // DAT packet: F0 41 dev 1E 42 [addr 4B] [nibbles...] cs F7
                    // Data starts at byte 9 (after addr), ends 2 bytes before end (cs + F7)
                    const dataStart = 9;
                    const dataEnd = response.length - 2;
                    const nibbles = response.slice(dataStart, dataEnd);
                    allNibbles.push(...nibbles);
                    sendAck();
                } else if (command === S330_COMMANDS.EOD) {
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    sendAck();
                    resolve(deNibblize(allNibbles));
                } else if (command === S330_COMMANDS.RJC) {
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error('RQD request rejected by S-330'));
                } else if (command === S330_COMMANDS.ERR) {
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error('S-330 communication error'));
                }
            }

            resetTimeout();
            midiAdapter.onSysEx(listener);
            console.log('[S330Client] Sending RQD:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
            midiAdapter.send(message);
        });
    }

    /**
     * Internal helper: Send data using WSD/DAT/EOD protocol
     *
     * This is the ONLY method that works for function parameter writes on S-330.
     * The protocol requires:
     * 1. Send WSD (Want to Send Data) with address and size
     * 2. Wait for ACK
     * 3. Send DAT with nibblized data
     * 4. Send EOD (End of Data)
     *
     * @param address - 4-byte address [aa, bb, cc, dd]
     * @param data - Parameter data bytes to write
     * @returns Promise that resolves when write is complete
     */
    async function sendData(address: number[], data: number[]): Promise<void> {
        if (address.length !== 4) {
            throw new Error('Address must be 4 bytes');
        }

        return new Promise((resolve, reject) => {
            let phase: 'WSD' | 'DAT' | 'DONE' = 'WSD';
            const timeoutId = setTimeout(() => {
                midiAdapter.removeSysExListener(listener);
                reject(new Error('WSD write timeout - no response from S-330'));
            }, timeoutMs);

            function listener(response: number[]) {
                if (response.length < 5) return;
                if (response[1] !== ROLAND_ID) return;
                if (response[2] !== deviceId) return;
                if (response[3] !== S330_MODEL_ID) return;

                const command = response[4];

                if (phase === 'WSD') {
                    if (command === S330_COMMANDS.ACK) {
                        phase = 'DAT';

                        // Send DAT with address and nibblized data
                        const nibblized = nibblize(data);
                        const datChecksum = calculateChecksum(address, nibblized);

                        const datMessage = [
                            0xf0,
                            ROLAND_ID,
                            deviceId,
                            S330_MODEL_ID,
                            S330_COMMANDS.DAT,
                            ...address,
                            ...nibblized,
                            datChecksum,
                            0xf7,
                        ];

                        midiAdapter.send(datMessage);

                        // Send EOD after small delay
                        setTimeout(() => {
                            const eodMessage = [
                                0xf0,
                                ROLAND_ID,
                                deviceId,
                                S330_MODEL_ID,
                                S330_COMMANDS.EOD,
                                0xf7,
                            ];
                            midiAdapter.send(eodMessage);
                            phase = 'DONE';

                            // Wait a bit for S-330 to process, then resolve
                            setTimeout(() => {
                                clearTimeout(timeoutId);
                                midiAdapter.removeSysExListener(listener);
                                resolve();
                            }, 100);
                        }, 50);
                    } else if (command === S330_COMMANDS.RJC) {
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);
                        reject(new Error('WSD rejected by S-330'));
                    } else if (command === S330_COMMANDS.ERR) {
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);
                        reject(new Error('WSD communication error'));
                    }
                }
            }

            midiAdapter.onSysEx(listener);

            // Build and send WSD message
            const sizeInBytes = data.length;
            const size = [
                (sizeInBytes >> 21) & 0x7f,
                (sizeInBytes >> 14) & 0x7f,
                (sizeInBytes >> 7) & 0x7f,
                sizeInBytes & 0x7f,
            ];

            const wsdChecksum = calculateChecksum(address, size);

            const wsdMessage = [
                0xf0,
                ROLAND_ID,
                deviceId,
                S330_MODEL_ID,
                S330_COMMANDS.WSD,
                ...address,
                ...size,
                wsdChecksum,
                0xf7,
            ];

            midiAdapter.send(wsdMessage);
        });
    }

    return {
        async connect(): Promise<boolean> {
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

        /**
         * Request all patch names from the S-330
         * Serialized to prevent concurrent request interference
         *
         * Patch names are stored in bank 00 00 (Patch parameters).
         * Address format: 00 00 (pp*4) 00 where pp = patch number 0-63
         * Name is the first 12 bytes (24 nibbles) at each patch address.
         */
        async requestAllPatchNames(): Promise<PatchNameInfo[]> {
            return serialize(async () => {
                const patches: PatchNameInfo[] = [];

                // Request each patch name individually
                // Patch address: 00 00 (pp*4) 00 - each patch has stride of 4
                // Name is 12 bytes at offset 0
                for (let i = 0; i < MAX_PATCHES; i++) {
                    try {
                        const address = [0x00, 0x00, i * 4, 0x00];
                        const data = await requestDataWithAddress(address, 12);

                        const name = parseName(data, 0, 12);
                        const isEmpty =
                            name === '' || name === '            ' || data.every((b) => b === 0);

                        patches.push({ index: i, name, isEmpty });
                    } catch (err) {
                        // If we get RJC, the patch slot is empty
                        patches.push({ index: i, name: '', isEmpty: true });
                    }
                }

                return patches;
            });
        },

        /**
         * Request all tone names from the S-330
         * Serialized to prevent concurrent request interference
         */
        async requestAllToneNames(): Promise<ToneNameInfo[]> {
            return serialize(async () => {
                const tones: ToneNameInfo[] = [];

                // Request each tone name individually
                // Tone address: 00 02 tt 00 (tt = tone number 0-31)
                // Name is 8 bytes at offset 0
                for (let i = 0; i < MAX_TONES; i++) {
                    try {
                        const address = [0x00, 0x02, i, 0x00];
                        const data = await requestDataWithAddress(address, 8);

                        const name = parseName(data, 0, 8);
                        const isEmpty =
                            name === '' || name === '        ' || data.every((b) => b === 0);

                        tones.push({ index: i, name, isEmpty });
                    } catch (err) {
                        // If we get RJC, the tone slot is empty
                        tones.push({ index: i, name: '', isEmpty: true });
                    }
                }

                return tones;
            });
        },

        /**
         * Request full patch data for a specific patch
         * Serialized to prevent concurrent request interference
         */
        async requestPatchData(patchIndex: number): Promise<S330Patch | null> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }

            return serialize(async () => {
                try {
                    // Request full patch data (512 bytes total)
                    // Patches are in bank 00 00 with stride of 4: 00 00 (pp*4) 00
                    const address = [0x00, 0x00, patchIndex * 4, 0x00];
                    const data = await requestDataWithAddress(address, PATCH_TOTAL_SIZE);

                    // Parse patch using the parsePatchCommon function from sampler-devices
                    const common = parsePatchCommon(data);

                    return { common };
                } catch (err) {
                    return null;
                }
            });
        },

        /**
         * Request full tone data for a specific tone
         * Serialized to prevent concurrent request interference
         */
        async requestToneData(toneIndex: number): Promise<S330Tone | null> {
            if (toneIndex < 0 || toneIndex >= MAX_TONES) {
                throw new Error(`Invalid tone index: ${toneIndex}`);
            }

            return serialize(async () => {
                try {
                    // Request full tone data (38 bytes = 0x26)
                    const address = [0x00, 0x02, toneIndex, 0x00];
                    const data = await requestDataWithAddress(address, TONE_BLOCK_SIZE);

                    return {
                        name: parseName(data, 0),
                        originalKey: data[8],
                        sampleRate: parseSampleRate(data[9]),
                        startAddress: parse21BitAddress(data, 10),
                        loopStart: parse21BitAddress(data, 13),
                        loopEnd: parse21BitAddress(data, 16),
                        loopMode: parseLoopMode(data[19]),
                        coarseTune: data[20],
                        fineTune: data[21],
                        level: data[22],
                        tva: {
                            attack: data[23],
                            decay: data[24],
                            sustain: data[25],
                            release: data[26],
                        },
                        tvf: {
                            cutoff: data[27],
                            resonance: data[28],
                            envDepth: data[29],
                            envelope: {
                                attack: data[30],
                                decay: data[31],
                                sustain: data[32],
                                release: data[33],
                            },
                        },
                        lfo: {
                            rate: data[34],
                            depth: data[35],
                            delay: data[36],
                            destination: parseLfoDestination(data[37]),
                        },
                    };
                } catch (err) {
                    return null;
                }
            });
        },

        /**
         * Request all function parameters (Multi mode configuration)
         * Serialized to prevent concurrent request interference
         *
         * Address base: 00 01 00 00 (function parameters bank per MIDI Implementation)
         * Returns configuration for all 8 parts (A-H)
         */
        async requestFunctionParameters(): Promise<MultiPartConfig[]> {
            return serialize(async () => {
                try {
                    // Read each parameter group separately
                    const channelData = await requestDataWithAddress(
                        [0x00, 0x01, 0x00, 0x22],
                        8
                    );
                    const patchData = await requestDataWithAddress(
                        [0x00, 0x01, 0x00, 0x32],
                        8
                    );

                    let outputData: number[];
                    try {
                        outputData = await requestDataWithAddress(
                            [0x00, 0x01, 0x00, 0x42],
                            8
                        );
                    } catch (err) {
                        // Output parameters may not exist on all firmware versions
                        outputData = [1, 1, 1, 1, 1, 1, 1, 1];
                    }

                    const levelData = await requestDataWithAddress(
                        [0x00, 0x01, 0x00, 0x56],
                        8
                    );

                    const parts: MultiPartConfig[] = [];
                    for (let i = 0; i < 8; i++) {
                        parts.push({
                            channel: channelData[i] ?? 0,
                            patchIndex: patchData[i] ?? 0,
                            output: outputData[i] ?? 1,
                            level: levelData[i] ?? 127,
                        });
                    }

                    return parts;
                } catch (err) {
                    // Return default configuration
                    return Array.from({ length: 8 }, (_, i) => ({
                        channel: i,
                        patchIndex: 0,
                        output: 1,
                        level: 127,
                    }));
                }
            });
        },

        /**
         * Set MIDI receive channel for a multi mode part
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters)
         */
        async setMultiChannel(part: number, channel: number): Promise<void> {
            if (part < 0 || part > 7) {
                throw new Error(`Invalid part number: ${part} (must be 0-7)`);
            }
            if (channel < 0 || channel > 15) {
                throw new Error(`Invalid channel: ${channel} (must be 0-15)`);
            }

            return serialize(async () => {
                const allChannelData = await requestDataWithAddress(
                    [0x00, 0x01, 0x00, 0x22],
                    8
                );
                const newChannelData = [...allChannelData];
                newChannelData[part] = channel;
                await sendData([0x00, 0x01, 0x00, 0x22], newChannelData);
            });
        },

        /**
         * Set patch assignment for a multi mode part
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters)
         */
        async setMultiPatch(part: number, patchIndex: number | null): Promise<void> {
            if (part < 0 || part > 7) {
                throw new Error(`Invalid part number: ${part} (must be 0-7)`);
            }
            const value = patchIndex === null ? 0x7f : patchIndex;
            if (patchIndex !== null && (patchIndex < 0 || patchIndex > 63)) {
                throw new Error(`Invalid patch index: ${patchIndex} (must be 0-63 or null)`);
            }

            return serialize(async () => {
                const allPatchData = await requestDataWithAddress(
                    [0x00, 0x01, 0x00, 0x32],
                    8
                );
                const newPatchData = [...allPatchData];
                newPatchData[part] = value;
                await sendData([0x00, 0x01, 0x00, 0x32], newPatchData);
            });
        },

        /**
         * Set output assignment for a multi mode part
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters)
         */
        async setMultiOutput(part: number, output: number): Promise<void> {
            if (part < 0 || part > 7) {
                throw new Error(`Invalid part number: ${part} (must be 0-7)`);
            }
            if (output < 0 || output > 8) {
                throw new Error(`Invalid output: ${output} (must be 0-8)`);
            }

            return serialize(async () => {
                let allOutputData: number[];
                try {
                    allOutputData = await requestDataWithAddress(
                        [0x00, 0x01, 0x00, 0x42],
                        8
                    );
                } catch (err) {
                    allOutputData = [1, 1, 1, 1, 1, 1, 1, 1];
                }
                const newOutputData = [...allOutputData];
                newOutputData[part] = output;
                await sendData([0x00, 0x01, 0x00, 0x42], newOutputData);
            });
        },

        /**
         * Set level for a multi mode part
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters)
         */
        async setMultiLevel(part: number, level: number): Promise<void> {
            if (part < 0 || part > 7) {
                throw new Error(`Invalid part number: ${part} (must be 0-7)`);
            }
            if (level < 0 || level > 127) {
                throw new Error(`Invalid level: ${level} (must be 0-127)`);
            }

            return serialize(async () => {
                const allLevelData = await requestDataWithAddress(
                    [0x00, 0x01, 0x00, 0x56],
                    8
                );
                const newLevelData = [...allLevelData];
                newLevelData[part] = level;
                await sendData([0x00, 0x01, 0x00, 0x56], newLevelData);
            });
        },

        /**
         * Set key mode for a patch
         * Uses WSD/DAT/EOD protocol for single-byte parameter update
         */
        async setPatchKeyMode(
            patchIndex: number,
            keyMode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison'
        ): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }

            const keyModeValue =
                keyMode === 'normal'
                    ? 0
                    : keyMode === 'v-sw'
                    ? 1
                    : keyMode === 'x-fade'
                    ? 2
                    : keyMode === 'v-mix'
                    ? 3
                    : 4;

            return serialize(async () => {
                const address = [0x00, 0x00, patchIndex * 4, 0x0f];
                await sendData(address, [keyModeValue]);
            });
        },

        /**
         * Set bender range for a patch
         * Uses WSD/DAT/EOD protocol for single-byte parameter update
         */
        async setPatchBenderRange(patchIndex: number, range: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (range < 0 || range > 12) {
                throw new Error(`Invalid bender range: ${range} (must be 0-12)`);
            }

            return serialize(async () => {
                const address = [0x00, 0x00, patchIndex * 4, 0x0c];
                await sendData(address, [range]);
            });
        },

        /**
         * Set aftertouch sensitivity for a patch
         * Uses WSD/DAT/EOD protocol for single-byte parameter update
         */
        async setPatchAftertouchSens(patchIndex: number, sens: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (sens < 0 || sens > 127) {
                throw new Error(`Invalid aftertouch sensitivity: ${sens}`);
            }

            return serialize(async () => {
                const address = [0x00, 0x00, patchIndex * 4, 0x0e];
                await sendData(address, [sens]);
            });
        },

        /**
         * Set output assignment for a patch
         * Uses WSD/DAT/EOD protocol for single-byte parameter update
         */
        async setPatchOutput(patchIndex: number, output: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (output < 0 || output > 8) {
                throw new Error(`Invalid output: ${output} (must be 0-8)`);
            }

            return serialize(async () => {
                const address = [0x00, 0x00, patchIndex * 4 + 1, 0x33];
                await sendData(address, [output]);
            });
        },

        /**
         * Set level for a patch
         * Uses WSD/DAT/EOD protocol for single-byte parameter update
         */
        async setPatchLevel(patchIndex: number, level: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (level < 0 || level > 127) {
                throw new Error(`Invalid level: ${level}`);
            }

            return serialize(async () => {
                const address = [0x00, 0x00, patchIndex * 4 + 1, 0x2d];
                await sendData(address, [level]);
            });
        },

        /**
         * Send complete patch data to S-330
         * Uses WSD/DAT/EOD protocol to write patch common section
         *
         * @param patchIndex - Patch number (0-63)
         * @param patch - Complete patch common data structure
         * @returns Promise that resolves when patch is written
         */
        async sendPatchData(patchIndex: number, patch: S330PatchCommon): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }

            return serialize(async () => {
                // Encode patch to binary format
                const patchBytes = encodePatchCommon(patch);

                // Calculate patch address: [0x00, 0x00, patchIndex * 4, 0x00]
                const address = [0x00, 0x00, patchIndex * 4, 0x00];

                // Send via WSD/DAT/EOD protocol
                await sendData(address, patchBytes);
            });
        },
    };
}
