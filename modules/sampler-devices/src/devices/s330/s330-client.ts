/**
 * Roland S-330 MIDI SysEx Client
 *
 * Universal client for communicating with Roland S-330 samplers via SysEx.
 * Works in both Node.js and browser environments via dependency injection.
 *
 * See docs/1.0/s330-sysex-protocol.md for complete protocol documentation.
 *
 * ## Protocol Notes (from hardware testing)
 *
 * The S-330 uses the RQD/WSD handshake protocol exclusively:
 *
 * - **RQD with address/size**: F0 41 dev 1E 41 [addr 4B] [size 4B] [cs] F7
 * - **WSD (Want to Send Data)**: Request permission to write parameters
 * - **DAT (Data Transfer)**: Bidirectional data packets
 * - **ACK (Acknowledge)**: Ready to receive next packet
 * - **EOD (End of Data)**: Transfer complete
 * - **ERR (Error)**: Communication error
 * - **RJC (Rejection)**: Request denied or no data available
 *
 * ## Data Encoding
 *
 * **Parameter data** (patches, tones): Nibblized format
 * - Size = bytes × 2 (nibble count)
 * - Each byte split into two nibbles (0x00-0x0F)
 *
 * **Wave data**: 7-bit encoded 12-bit samples (NOT nibblized)
 * - Size = sample count × 2 (bytes, not nibbles)
 * - Each 12-bit sample = 2 bytes: `0aaa aaaa` + `0bbb bb00`
 * - Decode: `sample = (byte0 << 5) | (byte1 >> 2)`
 *
 * Important constraints:
 * - Both address LSB and size LSB must be EVEN
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
    S330AftertouchAssign,
    S330KeyAssign,
    S330WaveDataResponse,
    S330WaveDataInput,
    S330ImportToneInput,
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
    TONE_STRIDE,
    MAX_PATCHES,
    MAX_TONES,
    PATCH_PARAMS,
    buildPatchParamAddress,
    ADDR_WAVE_DATA,
} from './s330-addresses.js';

import {
    parsePatchCommon,
    encodePatchCommon,
    parseTone,
    encodeTone,
    parseName,
    encodeAftertouchAssign,
    encodeKeyAssign,
    encodeSignedValue,
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

// =============================================================================
// Callback Types for Progressive Loading
// =============================================================================

/**
 * Progress callback for batch operations
 * @param current - Number of items loaded so far
 * @param total - Total number of items to load
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Callback invoked when a patch is loaded
 * @param index - Patch index (0-15)
 * @param patch - The loaded patch data
 */
export type PatchLoadedCallback = (index: number, patch: S330Patch) => void;

/**
 * Callback invoked when a tone is loaded
 * @param index - Tone index (0-31)
 * @param tone - The loaded tone data
 */
export type ToneLoadedCallback = (index: number, tone: S330Tone) => void;

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
    requestPatchData(patchIndex: number): Promise<S330Patch | null>;
    sendPatchData(patchIndex: number, patch: S330PatchCommon): Promise<void>;
    loadPatchRange(
        startIndex: number,
        count: number,
        onProgress?: ProgressCallback,
        onPatchLoaded?: PatchLoadedCallback,
        forceReload?: boolean
    ): Promise<S330Patch[]>;
    getLoadedPatches(): (S330Patch | undefined)[];
    invalidatePatchCache(): void;

    // Tone operations
    requestToneData(toneIndex: number): Promise<S330Tone | null>;
    sendToneData(toneIndex: number, tone: S330Tone): Promise<void>;
    loadToneRange(
        startIndex: number,
        count: number,
        onProgress?: ProgressCallback,
        onToneLoaded?: ToneLoadedCallback,
        forceReload?: boolean
    ): Promise<S330Tone[]>;
    getLoadedTones(): (S330Tone | undefined)[];
    invalidateToneCache(): void;

    // Wave data operations
    requestWaveData(
        toneIndex: number,
        onProgress?: (bytesReceived: number, totalBytes: number) => void
    ): Promise<S330WaveDataResponse>;

    sendWaveData(
        input: S330WaveDataInput,
        onProgress?: (bytesSent: number, totalBytes: number) => void
    ): Promise<void>;

    /**
     * Import a tone with wave data to the S-330.
     *
     * This uploads wave data to the specified segment and configures
     * the tone parameters to use it.
     */
    importTone(
        input: S330ImportToneInput,
        onProgress?: (bytesSent: number, totalBytes: number) => void
    ): Promise<void>;

    // Multi mode configuration
    requestFunctionParameters(): Promise<MultiPartConfig[]>;
    setMultiChannel(part: number, channel: number): Promise<void>;
    setMultiPatch(part: number, patchIndex: number | null): Promise<void>;
    setMultiOutput(part: number, output: number): Promise<void>;
    setMultiLevel(part: number, level: number): Promise<void>;

    // MIDI panic - send All Notes Off / All Sound Off on all channels
    panic(): void;

    // Individual patch parameter setters
    setPatchName(patchIndex: number, name: string): Promise<void>;
    setPatchKeyMode(
        patchIndex: number,
        keyMode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison'
    ): Promise<void>;
    setPatchBenderRange(patchIndex: number, range: number): Promise<void>;
    setPatchAftertouchSens(patchIndex: number, sens: number): Promise<void>;
    setPatchAftertouchAssign(patchIndex: number, assign: S330AftertouchAssign): Promise<void>;
    setPatchKeyAssign(patchIndex: number, assign: S330KeyAssign): Promise<void>;
    setPatchOutput(patchIndex: number, output: number): Promise<void>;
    setPatchLevel(patchIndex: number, level: number): Promise<void>;
    setPatchDetune(patchIndex: number, detune: number): Promise<void>;
    setPatchVelocityThreshold(patchIndex: number, threshold: number): Promise<void>;
    setPatchVelocityMixRatio(patchIndex: number, ratio: number): Promise<void>;
    setPatchOctaveShift(patchIndex: number, shift: number): Promise<void>;
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
 * import { createS330Client } from '@audiocontrol/sampler-devices/s330';
 * import { createEasymidiAdapter } from '@audiocontrol/sampler-midi';
 *
 * const adapter = createEasymidiAdapter('S-330');
 * const client = createS330Client(adapter, { deviceId: 0 });
 * await client.connect();
 * const patches = await client.requestAllPatchNames();
 * ```
 *
 * @example Browser with Web MIDI
 * ```typescript
 * import { createS330Client } from '@audiocontrol/sampler-devices/s330';
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
    const writeFlushDelayMs = options.writeFlushDelayMs ?? 150;

    let connected = false;

    // Patch and tone caches for progressive loading
    // undefined = not loaded, S330Patch/S330Tone = loaded
    let patchCache: (S330Patch | undefined)[] = new Array(MAX_PATCHES).fill(undefined);
    let toneCache: (S330Tone | undefined)[] = new Array(MAX_TONES).fill(undefined);

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

    // =========================================================================
    // Write Buffer - Rate limits device writes
    // =========================================================================

    /**
     * Buffer for pending writes.
     * Key is address as string (e.g., "0,2,4,0"), value is data to write.
     * Multiple writes to same address collapse to latest value.
     */
    const writeBuffer = new Map<string, { address: number[]; data: number[] }>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let flushPromise: Promise<void> | null = null;

    /**
     * Convert address array to string key for buffer map
     */
    function addressKey(address: number[]): string {
        return address.join(',');
    }

    /**
     * Flush all buffered writes to the device.
     * Writes are sent sequentially through the serialize queue.
     */
    async function flushWriteBuffer(): Promise<void> {
        if (writeBuffer.size === 0) return;

        // Copy and clear buffer before async operations
        const pending = Array.from(writeBuffer.values());
        writeBuffer.clear();
        flushTimer = null;

        // Send all pending writes sequentially
        for (const { address, data } of pending) {
            await serialize(async () => {
                await sendData(address, data);
            });
        }
    }

    /**
     * Schedule a buffered write.
     * Multiple writes to the same address within writeFlushDelayMs are collapsed.
     *
     * @param address - 4-byte address
     * @param data - Data bytes to write
     * @returns Promise that resolves when the write is flushed
     */
    function bufferWrite(address: number[], data: number[]): Promise<void> {
        // If buffering is disabled, write immediately
        if (writeFlushDelayMs === 0) {
            return serialize(async () => {
                await sendData(address, data);
            });
        }

        // Add/update in buffer (collapses multiple writes to same address)
        const key = addressKey(address);
        writeBuffer.set(key, { address, data });

        // Schedule flush if not already scheduled
        if (!flushTimer) {
            flushPromise = new Promise((resolve, reject) => {
                flushTimer = setTimeout(() => {
                    flushWriteBuffer().then(resolve).catch(reject);
                }, writeFlushDelayMs);
            });
        }

        return flushPromise!;
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
                    // Extract and verify response address matches our request
                    const respAddr = response.slice(5, 9);

                    // For the first DAT packet, verify address matches request
                    // For continuation packets, address will be different (incremented)
                    if (allNibbles.length === 0) {
                        // First packet - verify base address matches
                        const addrMatch = respAddr[0] === address[0] &&
                                         respAddr[1] === address[1] &&
                                         respAddr[2] === address[2] &&
                                         respAddr[3] === address[3];
                        if (!addrMatch) {
                            console.warn(`[S330Client] Ignoring stale DAT packet for address ${respAddr.map(b => b.toString(16).padStart(2, '0')).join(' ')} (expected ${address.map(b => b.toString(16).padStart(2, '0')).join(' ')})`);
                            sendAck(); // Still ACK to clear it
                            return;
                        }
                    }

                    // Data starts at byte 9 (after addr), ends 2 bytes before end (cs + F7)
                    const dataStart = 9;
                    const dataEnd = response.length - 2;
                    const nibbles = response.slice(dataStart, dataEnd);
                    allNibbles.push(...nibbles);
                    sendAck();
                } else if (command === S330_COMMANDS.EOD || command === 0x45) {
                    // Accept both 0x4F and 0x45 as EOD - S-330 uses different values
                    // for bulk data dumps vs small parameter reads
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    sendAck();
                    resolve(deNibblize(allNibbles));
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

        const addrStr = address.map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`[S330Client] sendData: address=${addrStr}, dataLen=${data.length}`);

        return new Promise((resolve, reject) => {
            // State machine: WSD → wait ACK → DAT → wait ACK → EOD → wait ACK → done
            let phase: 'WSD' | 'DAT' | 'EOD' | 'DONE' = 'WSD';
            let phaseStartTime = Date.now();

            const timeoutId = setTimeout(() => {
                const elapsed = Date.now() - phaseStartTime;
                console.log(`[S330Client] sendData TIMEOUT in phase ${phase} after ${elapsed}ms`);
                midiAdapter.removeSysExListener(listener);
                reject(new Error(`WSD write timeout in phase ${phase}`));
            }, timeoutMs);

            function listener(response: number[]) {
                if (response.length < 5) return;
                if (response[1] !== ROLAND_ID) return;
                if (response[2] !== deviceId) return;
                if (response[3] !== S330_MODEL_ID) return;

                const command = response[4];

                if (command === S330_COMMANDS.RJC) {
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error(`WSD rejected by S-330 in phase ${phase}`));
                    return;
                }
                if (command === S330_COMMANDS.ERR) {
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error(`WSD communication error in phase ${phase}`));
                    return;
                }

                if (command === S330_COMMANDS.ACK) {
                    const elapsed = Date.now() - phaseStartTime;
                    console.log(`[S330Client] sendData ACK received in phase ${phase} after ${elapsed}ms`);

                    if (phase === 'WSD') {
                        // Received ACK for WSD - send DAT
                        phase = 'DAT';
                        phaseStartTime = Date.now();

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

                        console.log(`[S330Client] sendData sending DAT (${nibblized.length} nibbles)`);
                        midiAdapter.send(datMessage);
                    } else if (phase === 'DAT') {
                        // Received ACK for DAT - send EOD
                        phase = 'EOD';
                        phaseStartTime = Date.now();

                        // Clear the original timeout - we'll handle EOD specially
                        clearTimeout(timeoutId);

                        const eodMessage = [
                            0xf0,
                            ROLAND_ID,
                            deviceId,
                            S330_MODEL_ID,
                            S330_COMMANDS.EOD,
                            0xf7,
                        ];

                        console.log(`[S330Client] sendData sending EOD`);
                        midiAdapter.send(eodMessage);

                        // S-330 may not ACK after EOD for parameter writes
                        // Give it a short time to respond, then resolve anyway
                        // (the data was already acknowledged with the DAT ACK)
                        setTimeout(() => {
                            if (phase === 'EOD') {
                                console.log(`[S330Client] sendData EOD not ACKed, assuming success`);
                                phase = 'DONE';
                                midiAdapter.removeSysExListener(listener);
                                resolve();
                            }
                        }, 300);
                    } else if (phase === 'EOD') {
                        // Received ACK for EOD - write complete
                        console.log(`[S330Client] sendData complete`);
                        phase = 'DONE';
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);
                        resolve();
                    }
                }
            }

            midiAdapter.onSysEx(listener);

            // Build and send WSD message
            // Size is in nibbles (same as RQD) - each byte becomes 2 nibbles
            const sizeInNibbles = data.length * 2;
            const size = [
                (sizeInNibbles >> 21) & 0x7f,
                (sizeInNibbles >> 14) & 0x7f,
                (sizeInNibbles >> 7) & 0x7f,
                sizeInNibbles & 0x7f,
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

            console.log(`[S330Client] sendData sending WSD: ${wsdMessage.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
            phaseStartTime = Date.now();
            midiAdapter.send(wsdMessage);
        });
    }

    // =========================================================================
    // Internal Wave Upload Helpers
    // =========================================================================

    /**
     * Internal helper for wave data upload.
     * Used by both sendWaveData (public) and importTone.
     * Must be called from within a serialize block.
     */
    async function sendWaveDataInternal(
        input: S330WaveDataInput,
        onProgress?: (bytesSent: number, totalBytes: number) => void
    ): Promise<void> {
        const { data, waveBank, segmentTop } = input;

        // Calculate wave address using same logic as requestWaveData
        const SEGMENT_ADDR_STRIDE = 24576; // 00 01 40 00H in 7-bit hex

        // Bank base addresses from S-330 MIDI Implementation:
        // Bank A: 01 00 00 00H (offset 0)
        // Bank B: 01 20 00 00H (offset 0x20 << 14 = 524288)
        const BANK_B_OFFSET = 0x20 << 14; // 524288
        const bankBaseAddr = waveBank === 0 ? 0 : BANK_B_OFFSET;
        const addrOffset = bankBaseAddr + (segmentTop * SEGMENT_ADDR_STRIDE);

        const waveAddress = [
            ADDR_WAVE_DATA[0],
            (addrOffset >> 14) & 0x7f,
            (addrOffset >> 7) & 0x7f,
            addrOffset & 0x7e,
        ];

        console.log(`[S330Client] Sending wave data: ${data.length} bytes to bank=${waveBank}, segment=${segmentTop}`);
        console.log(`[S330Client] Wave address: ${waveAddress.map(b => b.toString(16).padStart(2, '0')).join(' ')}`);

        await sendWaveDataChunked(waveAddress, data, onProgress);
    }

    /**
     * Internal helper for chunked wave data transfer using WSD/DAT/EOD protocol.
     * Data is nibblized before sending (each byte becomes 2 nibbles) per S-330 MIDI spec.
     */
    async function sendWaveDataChunked(
        address: number[],
        data: Uint8Array,
        onProgress?: (bytesSent: number, totalBytes: number) => void
    ): Promise<void> {
        if (address.length !== 4) {
            throw new Error('Address must be 4 bytes');
        }
        if (address[3] & 0x01) {
            throw new Error(`Address LSB must be even (got 0x${address[3].toString(16)})`);
        }

        const totalBytes = data.length;
        // S-330 wave data is already 7-bit MIDI safe (2 bytes per 12-bit sample)
        // No nibblization needed - send raw bytes directly
        const MAX_CHUNK_BYTES = 128;

        return new Promise((resolve, reject) => {
            let bytesSent = 0;
            let currentByteOffset = 0;
            let phase: 'WSD' | 'DAT' | 'EOD' | 'DONE' = 'WSD';
            let timeoutId: ReturnType<typeof setTimeout>;

            function resetTimeout() {
                if (timeoutId) clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error(`Wave data send timeout in phase ${phase} (sent ${bytesSent}/${totalBytes})`));
                }, timeoutMs * 4);
            }

            function sendNextChunk() {
                if (currentByteOffset >= totalBytes) {
                    // All data sent, send EOD
                    phase = 'EOD';
                    const eodMessage = [
                        0xf0,
                        ROLAND_ID,
                        deviceId,
                        S330_MODEL_ID,
                        S330_COMMANDS.EOD,
                        0xf7,
                    ];
                    midiAdapter.send(eodMessage);

                    // S-330 may not ACK after EOD for wave data uploads
                    // Give it a short time to respond, then resolve anyway
                    setTimeout(() => {
                        if (phase === 'EOD') {
                            phase = 'DONE';
                            clearTimeout(timeoutId);
                            midiAdapter.removeSysExListener(listener);
                            resolve();
                        }
                    }, 500);
                    return;
                }

                phase = 'DAT';
                const chunkEndByte = Math.min(currentByteOffset + MAX_CHUNK_BYTES, totalBytes);
                const chunkBytes = Array.from(data.slice(currentByteOffset, chunkEndByte));

                // S-330 wave data is already 7-bit MIDI safe (2 bytes per 12-bit sample)
                // No nibblization needed - send raw bytes

                // Calculate current address for this chunk (in bytes)
                const baseOffset = (address[1] << 14) | (address[2] << 7) | address[3];
                const chunkAddr = baseOffset + currentByteOffset;
                const chunkAddress = [
                    address[0],
                    (chunkAddr >> 14) & 0x7f,
                    (chunkAddr >> 7) & 0x7f,
                    chunkAddr & 0x7f,
                ];

                const datChecksum = calculateChecksum(chunkAddress, chunkBytes);
                const datMessage = [
                    0xf0,
                    ROLAND_ID,
                    deviceId,
                    S330_MODEL_ID,
                    S330_COMMANDS.DAT,
                    ...chunkAddress,
                    ...chunkBytes,
                    datChecksum,
                    0xf7,
                ];

                midiAdapter.send(datMessage);
                bytesSent = chunkEndByte;
                currentByteOffset = chunkEndByte;
                onProgress?.(bytesSent, totalBytes);
            }

            function listener(response: number[]) {
                if (response.length < 5) return;
                if (response[1] !== ROLAND_ID) return;
                if (response[2] !== deviceId) return;
                if (response[3] !== S330_MODEL_ID) return;

                const command = response[4];
                resetTimeout();

                if (command === S330_COMMANDS.RJC) {
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error(`Wave data rejected by S-330 in phase ${phase}`));
                    return;
                }
                if (command === S330_COMMANDS.ERR) {
                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    reject(new Error(`Wave data communication error in phase ${phase}`));
                    return;
                }

                if (command === S330_COMMANDS.ACK) {
                    if (phase === 'WSD') {
                        // WSD accepted, start sending data
                        // Small delay to let S-330 prepare for data
                        setTimeout(() => sendNextChunk(), 10);
                    } else if (phase === 'DAT') {
                        // Chunk acknowledged, send next
                        // Small delay between chunks for S-330 to process
                        setTimeout(() => sendNextChunk(), 5);
                    } else if (phase === 'EOD') {
                        // Transfer complete
                        phase = 'DONE';
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);
                        resolve();
                    }
                }
            }

            midiAdapter.onSysEx(listener);
            resetTimeout();

            // Build and send WSD message
            // Size is in bytes (S-330 wave data is already 7-bit MIDI safe)
            const size = [
                (totalBytes >> 21) & 0x7f,
                (totalBytes >> 14) & 0x7f,
                (totalBytes >> 7) & 0x7f,
                totalBytes & 0x7f,
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

            console.log('[S330Client] Sending WSD:', wsdMessage.map(b => b.toString(16).padStart(2, '0')).join(' '));
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
         * Send MIDI panic: All Sound Off (CC#120) and All Notes Off (CC#123) on all channels.
         * This immediately silences all notes without waiting for the message queue.
         * Use when notes get stuck during heavy SysEx traffic.
         */
        panic(): void {
            // Send All Sound Off (CC#120) and All Notes Off (CC#123) on all 16 channels
            for (let channel = 0; channel < 16; channel++) {
                const status = 0xb0 + channel; // Control Change status byte
                // CC#120 - All Sound Off (immediate silence)
                midiAdapter.send([status, 120, 0]);
                // CC#123 - All Notes Off (release all held notes)
                midiAdapter.send([status, 123, 0]);
            }
            console.log('[S330Client] Panic: sent All Sound Off and All Notes Off on all channels');
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
                    // Return null for errors (timeout, rejection, no data, etc.)
                    // This provides graceful degradation when patch data is unavailable
                    console.error(`[S330Client] Error loading patch ${patchIndex}:`, err);
                    return null;
                }
            });
        },

        /**
         * Load a range of patches with progress callbacks and caching.
         * Only fetches patches that aren't already cached (unless forceReload).
         */
        async loadPatchRange(
            startIndex: number,
            count: number,
            onProgress?: ProgressCallback,
            onPatchLoaded?: PatchLoadedCallback,
            forceReload?: boolean
        ): Promise<S330Patch[]> {
            const endIndex = Math.min(startIndex + count, MAX_PATCHES);
            const actualCount = endIndex - startIndex;

            // If forcing reload, clear cache for this range
            if (forceReload) {
                for (let i = startIndex; i < endIndex; i++) {
                    patchCache[i] = undefined;
                }
            }

            return serialize(async () => {
                console.log(`[S330Client] Loading patches ${startIndex}-${endIndex - 1}${forceReload ? ' (forced)' : ''}...`);
                const result: S330Patch[] = [];
                let loaded = 0;

                for (let i = startIndex; i < endIndex; i++) {
                    // Skip if already cached
                    if (patchCache[i] !== undefined) {
                        const patch = patchCache[i]!;
                        result.push(patch);
                        loaded++;
                        onProgress?.(loaded, actualCount);
                        onPatchLoaded?.(i, patch);
                        continue;
                    }

                    let patch: S330Patch;
                    try {
                        const address = [0x00, 0x00, i * 4, 0x00];
                        const data = await requestDataWithAddress(address, PATCH_TOTAL_SIZE);
                        const common = parsePatchCommon(data);
                        patch = { common };
                    } catch (err) {
                        console.error(`[S330Client] Error parsing patch ${i}:`, err);
                        // Create placeholder for failed reads
                        const placeholder: S330PatchCommon = {
                            name: '!ERROR!',
                            keyMode: 'normal',
                            benderRange: 0,
                            aftertouchSens: 0,
                            aftertouchAssign: 'modulation',
                            keyAssign: 'rotary',
                            outputAssign: 0,
                            level: 0,
                            detune: 0,
                            velocityThreshold: 0,
                            velocityMixRatio: 0,
                            octaveShift: 0,
                            toneLayer1: [],
                            toneLayer2: [],
                            copySource: 0,
                        };
                        patch = { common: placeholder };
                    }
                    patchCache[i] = patch;
                    result.push(patch);
                    loaded++;
                    onProgress?.(loaded, actualCount);
                    onPatchLoaded?.(i, patch);
                }

                console.log(`[S330Client] Loaded ${result.length} patches (${startIndex}-${endIndex - 1})`);
                return result;
            });
        },

        /**
         * Get currently loaded patches (sparse array, undefined = not loaded)
         */
        getLoadedPatches(): (S330Patch | undefined)[] {
            return [...patchCache];
        },

        /**
         * Invalidate the patch cache, forcing a reload on next access.
         */
        invalidatePatchCache(): void {
            console.log('[S330Client] Invalidating patch cache');
            patchCache = new Array(MAX_PATCHES).fill(undefined);
        },

        /**
         * Request full tone data for a specific tone
         * Serialized to prevent concurrent request interference
         *
         * Tone data is 256 bytes (512 nibbles) and includes:
         * - Basic info (name, output, sample rate, original key)
         * - Wave parameters (start/end/loop points)
         * - LFO parameters
         * - 8-point TVA envelope with sustain/end points
         * - 8-point TVF envelope with sustain/end points
         * - Various switches and recording parameters
         */
        async requestToneData(toneIndex: number): Promise<S330Tone | null> {
            if (toneIndex < 0 || toneIndex >= MAX_TONES) {
                throw new Error(`Invalid tone index: ${toneIndex}`);
            }

            return serialize(async () => {
                try {
                    // Request full tone data (256 bytes)
                    // Tone address: 0x00, 0x03, toneIndex*2, 0x00
                    const byte2 = toneIndex * 2;
                    const address = [0x00, 0x03, byte2, 0x00];
                    const data = await requestDataWithAddress(address, TONE_BLOCK_SIZE);

                    // Use parseTone from s330-params.ts for proper 8-point envelope parsing
                    return parseTone(data);
                } catch (err) {
                    return null;
                }
            });
        },

        /**
         * Load a range of tones with progress callbacks and caching.
         * Only fetches tones that aren't already cached (unless forceReload).
         */
        async loadToneRange(
            startIndex: number,
            count: number,
            onProgress?: ProgressCallback,
            onToneLoaded?: ToneLoadedCallback,
            forceReload?: boolean
        ): Promise<S330Tone[]> {
            const endIndex = Math.min(startIndex + count, MAX_TONES);
            const actualCount = endIndex - startIndex;

            // If forcing reload, clear cache for this range
            if (forceReload) {
                for (let i = startIndex; i < endIndex; i++) {
                    toneCache[i] = undefined;
                }
            }

            return serialize(async () => {
                console.log(`[S330Client] Loading tones ${startIndex}-${endIndex - 1}${forceReload ? ' (forced)' : ''}...`);
                const result: S330Tone[] = [];
                let loaded = 0;

                for (let i = startIndex; i < endIndex; i++) {
                    // Skip if already cached
                    if (toneCache[i] !== undefined) {
                        const tone = toneCache[i]!;
                        result.push(tone);
                        loaded++;
                        onProgress?.(loaded, actualCount);
                        onToneLoaded?.(i, tone);
                        continue;
                    }

                    let tone: S330Tone | null;
                    try {
                        // Tone address: 0x00, 0x03, toneIndex*2, 0x00
                        const byte2 = i * 2;
                        const address = [0x00, 0x03, byte2, 0x00];
                        const data = await requestDataWithAddress(address, TONE_BLOCK_SIZE);
                        tone = parseTone(data);
                    } catch (err) {
                        console.error(`[S330Client] Error loading tone ${i}:`, err);
                        tone = null;
                    }

                    if (tone) {
                        toneCache[i] = tone;
                        result.push(tone);
                        loaded++;
                        onProgress?.(loaded, actualCount);
                        onToneLoaded?.(i, tone);
                    } else {
                        // Skip empty/error tones but still update progress
                        loaded++;
                        onProgress?.(loaded, actualCount);
                    }
                }

                console.log(`[S330Client] Loaded ${result.length} tones (${startIndex}-${endIndex - 1})`);
                return result;
            });
        },

        /**
         * Get currently loaded tones (sparse array, undefined = not loaded)
         */
        getLoadedTones(): (S330Tone | undefined)[] {
            return [...toneCache];
        },

        /**
         * Invalidate the tone cache, forcing a reload on next access.
         */
        invalidateToneCache(): void {
            console.log('[S330Client] Invalidating tone cache');
            toneCache = new Array(MAX_TONES).fill(undefined);
        },

        /**
         * Send tone data to S-330
         * Uses WSD/DAT/EOD protocol to write complete tone block.
         * Writes are buffered and rate-limited to prevent flooding the device.
         *
         * @param toneIndex - Tone number (0-31)
         * @param tone - Complete tone data structure
         * @returns Promise that resolves when tone is written
         */
        async sendToneData(toneIndex: number, tone: S330Tone): Promise<void> {
            if (toneIndex < 0 || toneIndex >= MAX_TONES) {
                throw new Error(`Invalid tone index: ${toneIndex}`);
            }

            // Encode tone to binary format
            const toneBytes = encodeTone(tone);

            // Tone address: 0x00, 0x03, toneIndex*2, 0x00
            const byte2 = toneIndex * 2;
            const address = [0x00, 0x03, byte2, 0x00];

            // Buffer write - collapses rapid updates, rate-limits device communication
            return bufferWrite(address, toneBytes);
        },

        /**
         * Request wave data for a tone
         *
         * Fetches the raw sample data for a tone from the S-330's wave memory.
         * The S-330 stores samples as 12-bit linear PCM, packed as 2 samples per 3 bytes.
         *
         * @param toneIndex - Tone number (0-31)
         * @param onProgress - Optional progress callback with bytes received and total bytes
         * @returns Wave data response with raw sample bytes and metadata
         */
        async requestWaveData(
            toneIndex: number,
            onProgress?: (bytesReceived: number, totalBytes: number) => void
        ): Promise<S330WaveDataResponse> {
            console.log('[S330Client] requestWaveData called with toneIndex:', toneIndex);
            if (toneIndex < 0 || toneIndex >= MAX_TONES) {
                throw new Error(`Invalid tone index: ${toneIndex}`);
            }

            return serialize(async () => {
                // First, get the tone data to extract wave parameters
                const byte2 = toneIndex * 2;
                const toneAddress = [0x00, 0x03, byte2, 0x00];
                console.log('[S330Client] Fetching tone data from address:', toneAddress);
                const toneData = await requestDataWithAddress(toneAddress, TONE_BLOCK_SIZE);

                if (toneData.length < 26) {
                    throw new Error('Insufficient tone data received');
                }

                // Parse wave parameters from tone data
                // See TONE_OFFSETS in s330-addresses.ts
                const sampleRateValue = toneData[11]; // 0=30kHz, 1=15kHz
                const sampleRate: 15000 | 30000 = sampleRateValue === 1 ? 15000 : 30000;

                // Wave memory organization:
                // - WAVE_BANK (byte 13): 0=A, 1=B (selects 256KB half of wave memory)
                // - WAVE_SEGMENT_TOP (byte 14): Starting segment index within bank
                // - WAVE_SEGMENT_LENGTH (byte 15): Number of segments occupied
                // - START_POINT/END_POINT/LOOP_POINT (bytes 16-24): RELATIVE offsets within segment
                const waveBank = toneData[13]; // 0=A, 1=B
                const waveSegmentTop = toneData[14]; // Starting segment index
                const waveSegmentLength = toneData[15]; // Number of segments

                // Parse 24-bit relative offsets (3 bytes each, big-endian)
                // These are RELATIVE to the start of waveSegmentTop, NOT absolute addresses
                const relativeStart = (toneData[16] << 16) | (toneData[17] << 8) | toneData[18];
                const relativeEnd = (toneData[19] << 16) | (toneData[20] << 8) | toneData[21];
                const relativeLoop = (toneData[22] << 16) | (toneData[23] << 8) | toneData[24];
                const loopModeValue = toneData[25];
                const loopMode = (['forward', 'alternating', 'one-shot', 'reverse'] as const)[loopModeValue] || 'forward';

                console.log('[S330Client] Parsed wave params for tone', toneIndex, ':', {
                    sampleRate,
                    waveBank,
                    waveSegmentTop,
                    waveSegmentLength,
                    relativeStart,
                    relativeEnd,
                    relativeLoop,
                    loopMode,
                });

                // Calculate wave memory address and fetch size
                // S-330 Memory Map (from MIDI Implementation documentation):
                //   - Wave data A (×18 segments): base address 01 00 00 00H
                //   - Wave data B (×18 segments): base address 01 20 00 00H
                //
                // Wave data location is determined ONLY by:
                //   - waveBank: which bank (A=0, B=1)
                //   - waveSegmentTop: starting segment index
                //   - waveSegmentLength: number of segments allocated
                //
                // startPoint/endPoint/loopPoint are PLAYBACK parameters, not memory addresses.
                //
                // S-330 Wave Memory Address Calculation
                // IMPORTANT: Address space differs from data size!
                //
                // From documentation:
                //   - Bank A base: 01 00 00 00H, Bank B base: 01 20 00 00H
                //   - Difference: 0x20 in byte 1 = 32 × 2^14 = 524288 address units per bank
                //   - Each bank has 18 segments
                //
                // Wave data format:
                //   - 12-bit samples transmitted as 2 bytes (7-bit MIDI encoding)
                //   - Each segment: 12,000 samples = 24,000 bytes when transmitted
                //
                // S-330 Wave Memory Address Calculation
                // (from MIDI Implementation documentation, Section 4: Address mapping)
                //
                // Addresses are 7-bit hex (00-7F per byte), 4 bytes: AA BB CC DD
                //   - Bank A base: 01 00 00 00H
                //   - Bank B base: 01 20 00 00H
                //   - Segment stride: 00 01 40 00H = 24576 address units
                //
                // Each segment contains 12000 samples (0.4s at 30kHz, 0.8s at 15kHz)
                // transmitted as 24000 bytes (2 bytes per 12-bit sample).
                //
                const SEGMENT_SIZE_SAMPLES = 12000;
                const SEGMENT_DATA_BYTES = SEGMENT_SIZE_SAMPLES * 2; // 24000 bytes
                const SEGMENT_ADDR_STRIDE = 24576; // 00 01 40 00H in 7-bit hex

                // Bank base addresses from S-330 MIDI Implementation:
                // Bank A: 01 00 00 00H (offset 0)
                // Bank B: 01 20 00 00H (offset 0x20 << 14 = 524288)
                const BANK_B_OFFSET = 0x20 << 14; // 524288
                const bankBaseAddr = waveBank === 0 ? 0 : BANK_B_OFFSET;
                const addrOffset = bankBaseAddr + (waveSegmentTop * SEGMENT_ADDR_STRIDE);

                // Fetch size based on segment length (each segment = 12000 samples × 2 bytes)
                const sampleCount = waveSegmentLength * SEGMENT_SIZE_SAMPLES;
                const bytesToFetch = sampleCount * 2;

                if (sampleCount <= 0) {
                    throw new Error(`Invalid segment allocation: segmentLength=${waveSegmentLength}`);
                }

                console.log(`[S330Client] Fetching wave data: ${sampleCount} samples (${waveSegmentLength} segments), ${bytesToFetch} bytes`);
                console.log(`[S330Client] Wave address: bank=${waveBank}, segmentTop=${waveSegmentTop}, addrOffset=${addrOffset}`);

                // The address bytes encode a 28-bit offset in 7-bit chunks
                // Note: LSB must be even per Roland spec (*3-1: lowest bit of LSB should be 0)
                const waveAddress = [
                    ADDR_WAVE_DATA[0],
                    (addrOffset >> 14) & 0x7f,
                    (addrOffset >> 7) & 0x7f,
                    addrOffset & 0x7e, // Must be even per documentation
                ];

                // Fetch wave data with extended timeout for large samples
                const waveTimeoutMs = Math.max(timeoutMs * 4, bytesToFetch / 100);

                // Use a modified request that supports progress reporting
                const waveData = await requestWaveDataWithProgress(
                    waveAddress,
                    bytesToFetch,
                    waveTimeoutMs,
                    onProgress
                );

                return {
                    data: new Uint8Array(waveData),
                    sampleRate,
                    startPoint: relativeStart,
                    endPoint: relativeEnd,
                    loopPoint: relativeLoop,
                    loopMode,
                };
            });

            // Internal helper for wave data fetch with progress
            // IMPORTANT: Wave data is NOT nibblized - it's raw 7-bit MIDI bytes
            // encoding 12-bit samples. Do NOT de-nibblize wave data.
            async function requestWaveDataWithProgress(
                address: number[],
                sizeInBytes: number,
                waveTimeoutMs: number,
                onProgress?: (bytesReceived: number, totalBytes: number) => void
            ): Promise<number[]> {
                if (address.length !== 4) {
                    throw new Error('Address must be 4 bytes');
                }

                if (address[3] & 0x01) {
                    throw new Error(`Address LSB must be even (got 0x${address[3].toString(16)})`);
                }

                // Wave data size is in BYTES, not nibbles (unlike tone/patch data)
                const size = [
                    (sizeInBytes >> 21) & 0x7f,
                    (sizeInBytes >> 14) & 0x7f,
                    (sizeInBytes >> 7) & 0x7f,
                    sizeInBytes & 0x7f,
                ];

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
                    // Wave data comes as raw 7-bit bytes, NOT nibbles
                    const allBytes: number[] = [];
                    let timeoutId: ReturnType<typeof setTimeout>;

                    function resetTimeout() {
                        if (timeoutId) clearTimeout(timeoutId);
                        timeoutId = setTimeout(() => {
                            midiAdapter.removeSysExListener(listener);
                            if (allBytes.length > 0) {
                                resolve(allBytes);
                            } else {
                                reject(new Error('Wave data request timeout - no data received'));
                            }
                        }, waveTimeoutMs);
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
                        if (response.length < 5) return;
                        if (response[1] !== ROLAND_ID) return;
                        if (response[3] !== S330_MODEL_ID) return;

                        const respDeviceId = response[2];
                        const command = response[4];

                        if (respDeviceId !== deviceId) {
                            return;
                        }

                        resetTimeout();

                        if (command === S330_COMMANDS.DAT) {
                            // DAT packet: F0 41 dev 1E 42 [addr 4B] [data...] cs F7
                            const dataStart = 9;
                            const dataEnd = response.length - 2;
                            const data = response.slice(dataStart, dataEnd);
                            // Wave data is raw 7-bit bytes - do NOT de-nibblize
                            allBytes.push(...data);

                            // Report progress
                            onProgress?.(allBytes.length, sizeInBytes);

                            sendAck();
                        } else if (command === S330_COMMANDS.EOD || command === 0x45) {
                            clearTimeout(timeoutId);
                            midiAdapter.removeSysExListener(listener);
                            sendAck();
                            // Return raw bytes - no de-nibblization for wave data
                            resolve(allBytes);
                        } else if (command === S330_COMMANDS.ERR) {
                            clearTimeout(timeoutId);
                            midiAdapter.removeSysExListener(listener);
                            reject(new Error('Wave data communication error'));
                        }
                    }

                    resetTimeout();
                    midiAdapter.onSysEx(listener);
                    console.log('[S330Client] Requesting wave data:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
                    midiAdapter.send(message);
                });
            }
        },

        /**
         * Send wave data to the S-330.
         *
         * Uses WSD/DAT/EOD protocol to upload wave samples to wave memory.
         * The data must be pre-encoded as 7-bit MIDI bytes (2 bytes per 12-bit sample).
         *
         * @param input - Wave data and target location
         * @param onProgress - Optional progress callback
         */
        async sendWaveData(
            input: S330WaveDataInput,
            onProgress?: (bytesSent: number, totalBytes: number) => void
        ): Promise<void> {
            const { waveBank, segmentTop, segmentLength } = input;

            if (waveBank !== 0 && waveBank !== 1) {
                throw new Error(`Invalid wave bank: ${waveBank} (must be 0 or 1)`);
            }
            if (segmentTop < 0 || segmentTop >= 18) {
                throw new Error(`Invalid segment top: ${segmentTop} (must be 0-17)`);
            }
            if (segmentLength < 1 || segmentTop + segmentLength > 18) {
                throw new Error(`Invalid segment length: ${segmentLength}`);
            }

            return serialize(async () => {
                await sendWaveDataInternal(input, onProgress);
            });
        },

        /**
         * Import a tone with wave data to the S-330.
         *
         * Uploads wave data to the specified segment and configures
         * the tone parameters to use it.
         *
         * @param input - Import configuration
         * @param onProgress - Optional progress callback
         */
        async importTone(
            input: S330ImportToneInput,
            onProgress?: (bytesSent: number, totalBytes: number) => void
        ): Promise<void> {
            const {
                toneIndex,
                waveData,
                waveBank,
                segmentTop,
                segmentLength,
            } = input;

            // Validate inputs
            if (toneIndex < 0 || toneIndex >= MAX_TONES) {
                throw new Error(`Invalid tone index: ${toneIndex} (must be 0-31)`);
            }
            if (waveBank !== 0 && waveBank !== 1) {
                throw new Error(`Invalid wave bank: ${waveBank} (must be 0 or 1)`);
            }
            if (segmentTop < 0 || segmentTop >= 18) {
                throw new Error(`Invalid segment top: ${segmentTop} (must be 0-17)`);
            }
            if (segmentLength < 1 || segmentTop + segmentLength > 18) {
                throw new Error(`Invalid segment length: ${segmentLength}`);
            }

            const sampleCount = waveData.length / 2; // 2 bytes per sample
            const maxSamples = segmentLength * 12000;
            if (sampleCount > maxSamples) {
                throw new Error(`Wave data too large: ${sampleCount} samples exceeds ${maxSamples} for ${segmentLength} segments`);
            }

            // Step 1: Configure tone parameters FIRST (before wave upload)
            // This configures the tone to point to the wave memory location
            console.log('[S330Client] Step 1: Configuring tone parameters...');

            // Determine if we're importing an existing tone or creating a new one
            let tone: S330Tone;

            if (input.tone) {
                // Library import: Use the full tone object, but override wave allocation
                // to match the explicit parameters (wave allocation may differ from original)
                const toneName = input.tone.name;
                console.log(`[S330Client] Importing existing tone ${toneIndex}: "${toneName}" to bank ${waveBank}, segment ${segmentTop}`);

                tone = {
                    ...input.tone,
                    wave: {
                        ...input.tone.wave,
                        bank: waveBank,
                        segmentTop,
                        segmentLength,
                        // Recalculate end point based on actual sample count
                        endPoint: Math.max(0, sampleCount - 1),
                        loopLength: Math.max(0, sampleCount - 1 - input.tone.wave.loopPoint),
                    },
                };
            } else {
                // New sample import: Use basic parameters with sensible defaults
                const name = input.name ?? 'UNNAMED';
                const sampleRate = input.sampleRate ?? '30kHz';
                const loopMode = input.loopMode ?? 'one-shot';
                const loopPoint = input.loopPoint ?? 0;
                const originalKey = input.originalKey ?? 60;

                console.log(`[S330Client] Importing new tone ${toneIndex}: "${name}" to bank ${waveBank}, segment ${segmentTop}`);

                tone = {
                    name: name.slice(0, 8),
                    outputAssign: 1,
                    sourceTone: 0,
                    origSubTone: 0,
                    sampleRate,
                    originalKey,
                    wave: {
                        bank: waveBank,
                        segmentTop,
                        segmentLength,
                        startPoint: 0,
                        endPoint: Math.max(0, sampleCount - 1),
                        loopPoint,
                        loopLength: Math.max(0, sampleCount - 1 - loopPoint),
                    },
                    loopMode,
                    lfo: {
                        rate: 64,
                        sync: false,
                        delay: 0,
                        mode: 'normal',
                        polarity: false,
                        offset: 64,
                    },
                    tvaLfoDepth: 0,
                    transpose: 64,
                    fineTune: 0,
                    tvf: {
                        cutoff: 127,
                        resonance: 0,
                        keyFollow: 64,
                        lfoDepth: 0,
                        egDepth: 0,
                        egPolarity: 'normal',
                        levelCurve: 0,
                        keyRateFollow: 64,
                        velRateFollow: 64,
                        enabled: false,
                        envelope: {
                            levels: [127, 127, 127, 127, 127, 127, 127, 0],
                            rates: [127, 127, 127, 127, 127, 127, 127, 127],
                            sustainPoint: 6,
                            endPoint: 8,
                        },
                    },
                    tva: {
                        lfoDepth: 0,
                        keyRate: 64,
                        level: 127,
                        velRate: 64,
                        levelCurve: 0,
                        envelope: {
                            levels: [127, 127, 127, 127, 127, 127, 127, 0],
                            rates: [127, 127, 127, 127, 127, 127, 127, 127],
                            sustainPoint: 6,
                            endPoint: 8,
                        },
                    },
                    benderEnabled: true,
                    aftertouchEnabled: false,
                    pitchFollow: true,
                    recThreshold: 64,
                    recPreTrigger: 0,
                    loopTune: 0,
                    envZoom: 0,
                    copySource: 0,
                };
            }

            // Use existing sendToneData which uses bufferWrite
            await this.sendToneData(toneIndex, tone);

            // Step 2: Send wave data using existing public method
            console.log('[S330Client] Step 2: Uploading wave data...');
            await this.sendWaveData(
                {
                    data: waveData,
                    waveBank,
                    segmentTop,
                    segmentLength,
                },
                onProgress
            );

            // Step 3: Re-send tone parameters AFTER wave upload
            // The S-330 may need tone params to be set after wave data is in place
            // for the sample rate and other playback parameters to take effect correctly.
            console.log('[S330Client] Step 3: Re-sending tone parameters...');
            await this.sendToneData(toneIndex, tone);

            console.log(`[S330Client] Tone ${toneIndex} imported successfully`);
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
         * Set patch name
         * Uses 2-byte writes in 8-byte chunks at the exact name address
         * @param patchIndex - Patch number (0-63)
         * @param name - Patch name (max 12 characters, padded with spaces)
         */
        async setPatchName(patchIndex: number, name: string): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }

            return serialize(async () => {
                // Get the exact address for the name parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.name);

                // Pad name with spaces to 12 characters
                const nameBytes = Array(PATCH_PARAMS.name.size).fill(0x20); // ASCII space
                for (let i = 0; i < Math.min(name.length, PATCH_PARAMS.name.size); i++) {
                    nameBytes[i] = name.charCodeAt(i);
                }

                // Write name in 8-byte chunk (first 8 chars) then 4-byte chunk (last 4 chars)
                // S-330 accepts 8-byte writes for patch bank
                await sendData(address, nameBytes.slice(0, 8));

                // Calculate address for remaining 4 bytes (offset by 8 nibble pairs = 16 nibbles = 0x10)
                const secondAddress = [...address];
                secondAddress[3] = (secondAddress[3] + 0x10) & 0x7f; // Advance by 8 bytes (16 nibbles)

                // Write remaining 4 bytes (but we need at least 2 bytes for WSD)
                await sendData(secondAddress, nameBytes.slice(8, 12));
            });
        },

        /**
         * Set key mode for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
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
                // Get the exact address for the key mode parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.keyMode);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the key mode (first byte)
                newData[0] = keyModeValue;

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set bender range for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         */
        async setPatchBenderRange(patchIndex: number, range: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (range < 0 || range > 12) {
                throw new Error(`Invalid bender range: ${range} (must be 0-12)`);
            }

            return serialize(async () => {
                // Get the exact address for the bender range parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.benderRange);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the bender range (first byte)
                newData[0] = range;

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set aftertouch sensitivity for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         */
        async setPatchAftertouchSens(patchIndex: number, sens: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (sens < 0 || sens > 127) {
                throw new Error(`Invalid aftertouch sensitivity: ${sens}`);
            }

            return serialize(async () => {
                // Get the exact address for the aftertouch sensitivity parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.aftertouchSens);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the aftertouch sensitivity (first byte)
                newData[0] = sens;

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set output assignment for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         */
        async setPatchOutput(patchIndex: number, output: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (output < 0 || output > 8) {
                throw new Error(`Invalid output: ${output} (must be 0-8)`);
            }

            return serialize(async () => {
                // Get the exact address for the output assignment parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.outputAssign);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the output assignment (first byte)
                newData[0] = output;

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set level for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         */
        async setPatchLevel(patchIndex: number, level: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (level < 0 || level > 127) {
                throw new Error(`Invalid level: ${level}`);
            }

            return serialize(async () => {
                // Get the exact address for the level parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.level);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the level (first byte)
                newData[0] = level;

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set detune for a patch (unison mode)
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         * @param detune - Detune amount (-64 to +63, displayed as -64 to +63)
         */
        async setPatchDetune(patchIndex: number, detune: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (detune < -64 || detune > 63) {
                throw new Error(`Invalid detune: ${detune} (must be -64 to +63)`);
            }

            return serialize(async () => {
                // Get the exact address for the detune parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.detune);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the detune (first byte) - uses signed encoding
                newData[0] = encodeSignedValue(detune);

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set velocity threshold for a patch (V-Sw mode)
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         * @param threshold - Velocity threshold (0-127)
         */
        async setPatchVelocityThreshold(patchIndex: number, threshold: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (threshold < 0 || threshold > 127) {
                throw new Error(`Invalid velocity threshold: ${threshold}`);
            }

            return serialize(async () => {
                // Get the exact address for the velocity threshold parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.velocityThreshold);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the velocity threshold (first byte)
                newData[0] = threshold;

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set velocity mix ratio for a patch (V-Mix mode)
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         * @param ratio - Velocity mix ratio (0-127)
         */
        async setPatchVelocityMixRatio(patchIndex: number, ratio: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (ratio < 0 || ratio > 127) {
                throw new Error(`Invalid velocity mix ratio: ${ratio}`);
            }

            return serialize(async () => {
                // Get the exact address for the velocity mix ratio parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.velocityMixRatio);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the velocity mix ratio (first byte)
                newData[0] = ratio;

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set octave shift for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         * @param shift - Octave shift (-2 to +2)
         */
        async setPatchOctaveShift(patchIndex: number, shift: number): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }
            if (shift < -2 || shift > 2) {
                throw new Error(`Invalid octave shift: ${shift} (must be -2 to +2)`);
            }

            return serialize(async () => {
                // Get the exact address for the octave shift parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.octaveShift);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the octave shift (first byte) - uses signed encoding
                newData[0] = encodeSignedValue(shift, 2);

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set aftertouch assignment for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         */
        async setPatchAftertouchAssign(patchIndex: number, assign: S330AftertouchAssign): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }

            return serialize(async () => {
                // Get the exact address for the aftertouch assign parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.aftertouchAssign);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the aftertouch assign (first byte)
                newData[0] = encodeAftertouchAssign(assign);

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Set key assignment mode for a patch
         * Uses 8-byte read-modify-write (S-330 requires 8-byte minimum for WSD)
         */
        async setPatchKeyAssign(patchIndex: number, assign: S330KeyAssign): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }

            return serialize(async () => {
                // Get the exact address for the key assign parameter
                const address = buildPatchParamAddress(patchIndex, PATCH_PARAMS.keyAssign);

                // Read 8 bytes at this address (S-330 requires 8-byte writes)
                const data = await requestDataWithAddress(address, 8);
                const newData = [...data];

                // Modify the key assign (first byte)
                newData[0] = encodeKeyAssign(assign);

                // Write 8 bytes back
                await sendData(address, newData);
            });
        },

        /**
         * Send complete patch data to S-330
         * Uses WSD/DAT/EOD protocol to write patch common section.
         * Writes are buffered and rate-limited to prevent flooding the device.
         *
         * @param patchIndex - Patch number (0-63)
         * @param patch - Complete patch common data structure
         * @returns Promise that resolves when patch is written
         */
        async sendPatchData(patchIndex: number, patch: S330PatchCommon): Promise<void> {
            if (patchIndex < 0 || patchIndex >= MAX_PATCHES) {
                throw new Error(`Invalid patch index: ${patchIndex}`);
            }

            // Encode patch to binary format
            const patchBytes = encodePatchCommon(patch);

            // Calculate patch address: [0x00, 0x00, patchIndex * 4, 0x00]
            const address = [0x00, 0x00, patchIndex * 4, 0x00];

            // Buffer write - collapses rapid updates, rate-limits device communication
            return bufferWrite(address, patchBytes);
        },
    };
}
