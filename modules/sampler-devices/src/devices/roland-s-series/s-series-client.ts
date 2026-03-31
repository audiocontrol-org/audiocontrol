/**
 * Roland S-Series Shared MIDI SysEx Client
 *
 * Universal client for communicating with Roland S-series samplers via SysEx.
 * Works in both Node.js and browser environments via dependency injection.
 *
 * This shared client is parameterized by device configuration, allowing the same
 * code to work with both S-330 and S-550 (and potentially other S-series devices).
 *
 * Both devices use model ID 0x1E and share the same SysEx protocol.
 *
 * @packageDocumentation
 */

import type {
    SSeriesMidiAdapter,
    SSeriesClientOptions,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
    SSeriesWaveDataResponse,
    SSeriesLoopMode,
    SSeriesSampleRate,
    SSeriesWaveParams,
} from './s-series-types.js';

import type { SSeriesDeviceConfig } from './s-series-config.js';

import {
    ROLAND_ID,
    S_SERIES_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S_SERIES_COMMANDS,
    TIMING,
} from './s-series-constants.js';

import {
    nibblize,
    denibblize,
    calculateChecksum,
} from './s-series-messages.js';

import { clampWaveParams } from './s-series-wave-format.js';

import { withRetry, type RetryOptions } from '@audiocontrol/shared-midi';

// =============================================================================
// Callback Types
// =============================================================================

/**
 * Progress callback for batch operations
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Callback for patch loaded during range load
 */
export type PatchLoadedCallback<TPatch> = (index: number, patch: TPatch) => void;

/**
 * Callback for tone loaded during range load
 */
export type ToneLoadedCallback<TTone> = (index: number, tone: TTone) => void;

// =============================================================================
// Multi Mode Types
// =============================================================================

/**
 * Multi mode part configuration
 */
export interface MultiPartConfig {
    channel: number; // 0-15 (MIDI channel 1-16)
    patchIndex: number; // 0-63 (S-330) or 0-31 (S-550)
    output: number; // 0-8 (0=mix, 1-8=individual outputs)
    level: number; // 0-127
}

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

// =============================================================================
// Import Input Types (Generic)
// =============================================================================

/**
 * Input for sending wave data to the device.
 */
export interface SSeriesWaveDataInput {
    data: Uint8Array;
    waveBank: number;
    segmentTop: number;
    segmentLength: number;
}

/**
 * Input for importing a tone with wave data.
 * Generic over the tone type.
 */
export interface SSeriesImportToneInput<TTone> {
    toneIndex: number;
    waveData: Uint8Array;
    waveBank: number;
    segmentTop: number;
    segmentLength: number;
    tone?: TTone;
    name?: string;
    sampleRate?: SSeriesSampleRate;
    loopMode?: SSeriesLoopMode;
    loopPoint?: number;
    originalKey?: number;
}

// =============================================================================
// Parser/Encoder Function Types
// =============================================================================

/**
 * Functions for parsing device-specific data structures
 */
export interface SSeriesParserFunctions<TPatch, TTone, TPatchCommon> {
    parsePatchCommon: (data: number[]) => TPatchCommon;
    parseTone: (data: number[]) => TTone;
    encodePatchCommon: (params: TPatchCommon) => number[];
    encodeTone: (tone: TTone) => number[];
    createTone: (params: {
        name: string;
        sampleRate: SSeriesSampleRate;
        waveBank: number;
        segmentTop: number;
        segmentLength: number;
        sampleCount: number;
        loopMode: SSeriesLoopMode;
        loopPoint: number;
        originalKey: number;
    }) => TTone;
    /** Extract common from patch (for S-series, patch.common) */
    getPatchCommon: (patch: TPatch) => TPatchCommon;
    /** Create patch from common */
    createPatch: (common: TPatchCommon) => TPatch;
    /** Get tone wave params */
    getToneWave: (tone: TTone) => SSeriesWaveParams;
    /** Set tone wave params */
    setToneWave: (tone: TTone, wave: SSeriesWaveParams) => TTone;
}

// =============================================================================
// Client Interface
// =============================================================================

/**
 * S-series client interface for MIDI communication
 *
 * This interface provides semantic methods for interacting with S-series devices.
 * All address calculations and protocol details are handled internally.
 */
export interface SSeriesClientInterface<TPatch, TTone, TPatchCommon> {
    /** Get the device configuration */
    getConfig(): SSeriesDeviceConfig;

    connect(): Promise<boolean>;
    disconnect(): void;
    isConnected(): boolean;
    getDeviceId(): number;

    // Patch operations
    requestPatchData(patchIndex: number): Promise<TPatch | null>;
    sendPatchData(patchIndex: number, patch: TPatchCommon): Promise<void>;
    loadPatchRange(
        startIndex: number,
        count: number,
        onProgress?: ProgressCallback,
        onPatchLoaded?: PatchLoadedCallback<TPatch>,
        forceReload?: boolean
    ): Promise<TPatch[]>;
    getLoadedPatches(): (TPatch | undefined)[];
    invalidatePatchCache(): void;

    // Tone operations
    requestToneData(toneIndex: number): Promise<TTone | null>;
    sendToneData(toneIndex: number, tone: TTone): Promise<void>;
    loadToneRange(
        startIndex: number,
        count: number,
        onProgress?: ProgressCallback,
        onToneLoaded?: ToneLoadedCallback<TTone>,
        forceReload?: boolean
    ): Promise<TTone[]>;
    getLoadedTones(): (TTone | undefined)[];
    invalidateToneCache(): void;

    // Wave data operations
    requestWaveData(
        toneIndex: number,
        onProgress?: (bytesReceived: number, totalBytes: number) => void
    ): Promise<SSeriesWaveDataResponse>;

    sendWaveData(
        input: SSeriesWaveDataInput,
        onProgress?: (bytesSent: number, totalBytes: number) => void
    ): Promise<void>;

    /**
     * Import a tone with wave data.
     *
     * This uploads wave data to the specified segment and configures
     * the tone parameters to use it.
     */
    importTone(
        input: SSeriesImportToneInput<TTone>,
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
    setPatchAftertouchAssign(patchIndex: number, assign: SSeriesAftertouchAssign): Promise<void>;
    setPatchKeyAssign(patchIndex: number, assign: SSeriesKeyAssign): Promise<void>;
    setPatchOutput(patchIndex: number, output: number): Promise<void>;
    setPatchLevel(patchIndex: number, level: number): Promise<void>;
    setPatchDetune(patchIndex: number, detune: number): Promise<void>;
    setPatchVelocityThreshold(patchIndex: number, threshold: number): Promise<void>;
    setPatchVelocityMixRatio(patchIndex: number, ratio: number): Promise<void>;
    setPatchOctaveShift(patchIndex: number, shift: number): Promise<void>;
}

// =============================================================================
// Address Builder Types
// =============================================================================

/**
 * Functions for building device-specific addresses
 */
export interface SSeriesAddressBuilders {
    buildPatchAddress: (patchIndex: number) => number[];
    buildToneAddress: (toneIndex: number) => number[];
    buildPatchParamAddress: (patchIndex: number, paramName: string) => number[];
    buildWaveDataAddress: (waveBank: number, segmentIndex: number) => number[];
}

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create an S-series MIDI client with dependency injection
 *
 * The client internally serializes all MIDI requests to prevent
 * concurrent requests from interfering with each other.
 *
 * @param config - Device configuration (S-330 or S-550)
 * @param midiAdapter - MIDI transport adapter (easymidi or Web MIDI)
 * @param parsers - Device-specific parser functions
 * @param addressBuilders - Device-specific address builders
 * @param options - Client configuration options
 * @returns SSeriesClientInterface instance
 */
export function createSSeriesClient<TPatch, TTone, TPatchCommon>(
    config: SSeriesDeviceConfig,
    midiAdapter: SSeriesMidiAdapter,
    parsers: SSeriesParserFunctions<TPatch, TTone, TPatchCommon>,
    addressBuilders: SSeriesAddressBuilders,
    patchParamConfig: Record<string, { byteOffset: number; size: number }>,
    options: SSeriesClientOptions = {}
): SSeriesClientInterface<TPatch, TTone, TPatchCommon> {
    const deviceId = options.deviceId ?? DEFAULT_DEVICE_ID;
    const timeoutMs = options.timeoutMs ?? TIMING.ACK_TIMEOUT_MS;
    const writeFlushDelayMs = options.writeFlushDelayMs ?? 150;

    let connected = false;

    // Multi-mode function parameter addresses (shared across S-330 and S-550)
    const MULTI_CHANNELS_ADDRESS = [0x00, 0x01, 0x00, 0x22];
    const MULTI_PATCHES_ADDRESS = [0x00, 0x01, 0x00, 0x32];
    const MULTI_OUTPUTS_ADDRESS = [0x00, 0x01, 0x00, 0x42];
    const MULTI_LEVELS_ADDRESS = [0x00, 0x01, 0x00, 0x56];
    const MULTI_PART_COUNT = 8;

    // Patch and tone caches for progressive loading
    let patchCache: (TPatch | undefined)[] = new Array(config.patchCount).fill(undefined);
    let toneCache: (TTone | undefined)[] = new Array(config.toneCount).fill(undefined);

    // Request queue for serializing MIDI operations
    let requestQueue: Promise<unknown> = Promise.resolve();

    /**
     * Serialize a request through the queue
     */
    function serialize<T>(fn: () => Promise<T>): Promise<T> {
        const result = requestQueue.then(fn, fn);
        requestQueue = result.catch(() => {});
        return result;
    }

    // =========================================================================
    // Write Buffer - Rate limits device writes
    // =========================================================================

    const writeBuffer = new Map<string, { address: number[]; data: number[] }>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let flushPromise: Promise<void> | null = null;

    function addressKey(address: number[]): string {
        return address.join(',');
    }

    async function flushWriteBuffer(): Promise<void> {
        if (writeBuffer.size === 0) return;

        const pending = Array.from(writeBuffer.values());
        writeBuffer.clear();
        flushTimer = null;

        for (const { address, data } of pending) {
            await serialize(async () => {
                await sendData(address, data);
            });
        }
    }

    function bufferWrite(address: number[], data: number[]): Promise<void> {
        if (writeFlushDelayMs === 0) {
            return serialize(async () => {
                await sendData(address, data);
            });
        }

        const key = addressKey(address);
        writeBuffer.set(key, { address, data });

        if (!flushTimer) {
            flushPromise = new Promise((resolve, reject) => {
                flushTimer = setTimeout(() => {
                    flushWriteBuffer().then(resolve).catch(reject);
                }, writeFlushDelayMs);
            });
        }

        return flushPromise!;
    }

    // =========================================================================
    // Low-level MIDI Communication
    // =========================================================================

    /**
     * Send a SysEx message and wait for a matching response.
     * @param acceptCommands - If provided, only resolve on these command bytes.
     *   Stale responses with other commands are logged and ignored.
     *   If not provided, resolves on any valid S-series response (except RJC).
     */
    function sendAndReceive(message: number[], acceptCommands?: number[]): Promise<number[]> {
        return new Promise((resolve, reject) => {
            let timeoutId = setTimeout(onTimeout, timeoutMs);

            function onTimeout() {
                midiAdapter.removeSysExListener(listener);
                reject(new Error(`${config.deviceName} response timeout`));
            }

            function resetTimeout() {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(onTimeout, timeoutMs);
            }

            function listener(response: number[]) {
                if (
                    response.length >= 5 &&
                    response[1] === ROLAND_ID &&
                    response[2] === deviceId &&
                    response[3] === S_SERIES_MODEL_ID
                ) {
                    const cmd = response[4];

                    // Always ignore stale RJC
                    if (cmd === S_SERIES_COMMANDS.RJC) {
                        console.warn(`[${config.deviceName}] Ignoring stale RJC in sendAndReceive`);
                        resetTimeout(); // Reset timeout — stale response consumed time
                        return;
                    }

                    // If caller specified acceptable commands, ignore anything else
                    if (acceptCommands && !acceptCommands.includes(cmd)) {
                        console.warn(`[${config.deviceName}] Ignoring stale 0x${cmd.toString(16)} (expected ${acceptCommands.map(c => '0x' + c.toString(16)).join('/')})`);
                        resetTimeout(); // Reset timeout — stale response consumed time
                        return;
                    }

                    clearTimeout(timeoutId);
                    midiAdapter.removeSysExListener(listener);
                    resolve(response);
                }
            }

            midiAdapter.onSysEx(listener);
            midiAdapter.send(message);
        });
    }

    /**
     * Request data using RQD with address/size format
     */
    async function requestDataWithAddress(
        address: number[],
        sizeInBytes: number
    ): Promise<number[]> {
        if (address.length !== 4) {
            throw new Error('Address must be 4 bytes');
        }

        if (address[3] & 0x01) {
            throw new Error(
                `Address LSB must be even (got 0x${address[3].toString(16)})`
            );
        }

        const sizeInNibbles = sizeInBytes * 2;

        const size = [
            (sizeInNibbles >> 21) & 0x7f,
            (sizeInNibbles >> 14) & 0x7f,
            (sizeInNibbles >> 7) & 0x7f,
            sizeInNibbles & 0x7f,
        ];

        const cs = calculateChecksum(address, size);

        const message = [
            0xf0,
            ROLAND_ID,
            deviceId,
            S_SERIES_MODEL_ID,
            S_SERIES_COMMANDS.RQD,
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
                        resolve(denibblize(allNibbles));
                    } else {
                        reject(new Error('RQD response timeout - no data received'));
                    }
                }, timeoutMs * 2);
            }

            function listener(response: number[]) {
                if (
                    response.length >= 5 &&
                    response[1] === ROLAND_ID &&
                    response[2] === deviceId &&
                    response[3] === S_SERIES_MODEL_ID
                ) {
                    const command = response[4];

                    if (command === S_SERIES_COMMANDS.DAT) {
                        resetTimeout();
                        // DAT payload: [addr0, addr1, addr2, addr3, nibble0, nibble1, ..., checksum, F7]
                        // Skip 4-byte address header, strip checksum + F7
                        const dataStart = 5 + 4; // skip SysEx header (5) + address (4)
                        const dataEnd = response.length - 2; // strip checksum + F7
                        const nibbleData = response.slice(dataStart, dataEnd);
                        allNibbles.push(...nibbleData);

                        const ack = [
                            0xf0,
                            ROLAND_ID,
                            deviceId,
                            S_SERIES_MODEL_ID,
                            S_SERIES_COMMANDS.ACK,
                            0xf7,
                        ];
                        midiAdapter.send(ack);
                    } else if (command === S_SERIES_COMMANDS.EOD) {
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);

                        const ack = [
                            0xf0,
                            ROLAND_ID,
                            deviceId,
                            S_SERIES_MODEL_ID,
                            S_SERIES_COMMANDS.ACK,
                            0xf7,
                        ];
                        midiAdapter.send(ack);

                        resolve(denibblize(allNibbles));
                    } else if (command === S_SERIES_COMMANDS.RJC) {
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);
                        reject(new Error('Request rejected by device'));
                    } else if (command === S_SERIES_COMMANDS.ERR) {
                        clearTimeout(timeoutId);
                        midiAdapter.removeSysExListener(listener);
                        reject(new Error('Device reported error'));
                    }
                }
            }

            resetTimeout();
            midiAdapter.onSysEx(listener);
            midiAdapter.send(message);
        });
    }

    /**
     * Send data using WSD/DAT/EOD handshake (single attempt)
     */
    async function sendDataAttempt(address: number[], data: number[]): Promise<void> {
        const nibbled = nibblize(data);
        const sizeInNibbles = nibbled.length;

        const size = [
            (sizeInNibbles >> 21) & 0x7f,
            (sizeInNibbles >> 14) & 0x7f,
            (sizeInNibbles >> 7) & 0x7f,
            sizeInNibbles & 0x7f,
        ];

        const wsdChecksum = calculateChecksum(address, size);
        const wsd = [
            0xf0,
            ROLAND_ID,
            deviceId,
            S_SERIES_MODEL_ID,
            S_SERIES_COMMANDS.WSD,
            ...address,
            ...size,
            wsdChecksum,
            0xf7,
        ];

        const wsdResponse = await sendAndReceive(wsd, [S_SERIES_COMMANDS.ACK, S_SERIES_COMMANDS.ERR]);
        if (wsdResponse[4] !== S_SERIES_COMMANDS.ACK) {
            throw new Error(`WSD rejected: got ${wsdResponse[4].toString(16)}`);
        }

        // Each DAT packet includes a 4-byte address header followed by nibble data.
        // The device uses 128 nibbles per packet; 1 byte2 unit = 128 nibbles.
        const NIBBLES_PER_PACKET = 128;
        for (let offset = 0; offset < nibbled.length; offset += NIBBLES_PER_PACKET) {
            const chunk = nibbled.slice(offset, offset + NIBBLES_PER_PACKET);

            // Calculate packet address: advance byte2 by 1 per 128-nibble chunk
            // Overflow from byte2 carries into byte1 (7-bit per byte)
            const chunkIndex = offset / NIBBLES_PER_PACKET;
            const linearAddr2 = address[2] + chunkIndex;
            const packetAddress = [
                address[0],
                (address[1] + Math.floor(linearAddr2 / 128)) & 0x7f,
                linearAddr2 & 0x7f,
                address[3],
            ];

            const datChecksum = calculateChecksum(packetAddress, chunk);
            const dat = [
                0xf0,
                ROLAND_ID,
                deviceId,
                S_SERIES_MODEL_ID,
                S_SERIES_COMMANDS.DAT,
                ...packetAddress,
                ...chunk,
                datChecksum,
                0xf7,
            ];

            const datResponse = await sendAndReceive(dat, [S_SERIES_COMMANDS.ACK, S_SERIES_COMMANDS.ERR]);
            if (datResponse[4] !== S_SERIES_COMMANDS.ACK) {
                throw new Error(`DAT rejected: got ${datResponse[4].toString(16)}`);
            }
        }

        const eod = [
            0xf0,
            ROLAND_ID,
            deviceId,
            S_SERIES_MODEL_ID,
            S_SERIES_COMMANDS.EOD,
            0xf7,
        ];

        const eodResponse = await sendAndReceive(eod, [S_SERIES_COMMANDS.ACK, S_SERIES_COMMANDS.ERR]);
        if (eodResponse[4] !== S_SERIES_COMMANDS.ACK) {
            throw new Error(`EOD rejected: got ${eodResponse[4].toString(16)}`);
        }
    }

    /** Retry options for WSD write operations. */
    const wsdRetryOptions: RetryOptions = {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 2000,
        multiplier: 2,
        jitter: 0.3,
        isRetryable: (error: unknown) => {
            if (error instanceof Error) {
                return error.message.includes('timeout') || error.message.includes('rejected');
            }
            return false;
        },
        onRetry: (attempt, error, delayMs) => {
            console.log(`[${config.deviceName}] WSD retry ${attempt} after ${delayMs}ms: ${error}`);
        },
    };

    /** Send data with retry logic. */
    async function sendData(address: number[], data: number[]): Promise<void> {
        return withRetry(() => sendDataAttempt(address, data), wsdRetryOptions);
    }

    /**
     * Send wave data (not nibblized)
     */
    async function sendWaveDataInternal(
        address: number[],
        waveData: Uint8Array,
        onProgress?: (bytesSent: number, totalBytes: number) => void
    ): Promise<void> {
        const totalBytes = waveData.length;
        const size = [
            (totalBytes >> 21) & 0x7f,
            (totalBytes >> 14) & 0x7f,
            (totalBytes >> 7) & 0x7f,
            totalBytes & 0x7f,
        ];

        const wsdChecksum = calculateChecksum(address, size);
        const wsd = [
            0xf0,
            ROLAND_ID,
            deviceId,
            S_SERIES_MODEL_ID,
            S_SERIES_COMMANDS.WSD,
            ...address,
            ...size,
            wsdChecksum,
            0xf7,
        ];

        const wsdResponse = await sendAndReceive(wsd, [S_SERIES_COMMANDS.ACK, S_SERIES_COMMANDS.ERR]);
        if (wsdResponse[4] !== S_SERIES_COMMANDS.ACK) {
            throw new Error(`Wave WSD rejected: got ${wsdResponse[4].toString(16)}`);
        }

        // Wave data DAT packets include 4-byte address headers.
        // Wave data is NOT nibblized — 128 bytes per packet matches
        // 1 byte2 unit = 128 bytes in the wave address space.
        // Address overflow from byte2 carries into byte1 (7-bit per byte).
        const WAVE_PACKET_SIZE = 128;
        let bytesSent = 0;

        for (let offset = 0; offset < totalBytes; offset += WAVE_PACKET_SIZE) {
            const end = Math.min(offset + WAVE_PACKET_SIZE, totalBytes);
            const chunk = Array.from(waveData.slice(offset, end));

            const chunkIndex = offset / WAVE_PACKET_SIZE;
            const linearAddr2 = address[2] + chunkIndex;
            const packetAddress = [
                address[0],
                (address[1] + Math.floor(linearAddr2 / 128)) & 0x7f,
                linearAddr2 & 0x7f,
                address[3],
            ];

            const datChecksum = calculateChecksum(packetAddress, chunk);
            const dat = [
                0xf0,
                ROLAND_ID,
                deviceId,
                S_SERIES_MODEL_ID,
                S_SERIES_COMMANDS.DAT,
                ...packetAddress,
                ...chunk,
                datChecksum,
                0xf7,
            ];

            const datResponse = await sendAndReceive(dat, [S_SERIES_COMMANDS.ACK, S_SERIES_COMMANDS.ERR]);
            if (datResponse[4] !== S_SERIES_COMMANDS.ACK) {
                throw new Error(`Wave DAT rejected at offset ${offset}`);
            }

            bytesSent = end;
            onProgress?.(bytesSent, totalBytes);
        }

        const eod = [
            0xf0,
            ROLAND_ID,
            deviceId,
            S_SERIES_MODEL_ID,
            S_SERIES_COMMANDS.EOD,
            0xf7,
        ];

        const eodResponse = await sendAndReceive(eod, [S_SERIES_COMMANDS.ACK, S_SERIES_COMMANDS.ERR]);
        if (eodResponse[4] !== S_SERIES_COMMANDS.ACK) {
            throw new Error(`Wave EOD rejected`);
        }
    }

    // =========================================================================
    // Client Interface Implementation
    // =========================================================================

    return {
        getConfig(): SSeriesDeviceConfig {
            return config;
        },

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

        // === Patch Operations ===

        async requestPatchData(patchIndex: number): Promise<TPatch | null> {
            return serialize(async () => {
                const address = addressBuilders.buildPatchAddress(patchIndex);
                const data = await requestDataWithAddress(address, config.patchBlockSize);
                const common = parsers.parsePatchCommon(data);
                const patch = parsers.createPatch(common);
                patchCache[patchIndex] = patch;
                return patch;
            });
        },

        async sendPatchData(patchIndex: number, patch: TPatchCommon): Promise<void> {
            const address = addressBuilders.buildPatchAddress(patchIndex);
            const data = parsers.encodePatchCommon(patch);
            await bufferWrite(address, data);
            const fullPatch = parsers.createPatch(patch);
            patchCache[patchIndex] = fullPatch;
        },

        async loadPatchRange(
            startIndex: number,
            count: number,
            onProgress?: ProgressCallback,
            onPatchLoaded?: PatchLoadedCallback<TPatch>,
            forceReload?: boolean
        ): Promise<TPatch[]> {
            const patches: TPatch[] = [];

            for (let i = 0; i < count; i++) {
                const index = startIndex + i;
                if (index >= config.patchCount) break;

                if (!forceReload && patchCache[index]) {
                    patches.push(patchCache[index]!);
                    onProgress?.(i + 1, count);
                    onPatchLoaded?.(index, patchCache[index]!);
                    continue;
                }

                const patch = await this.requestPatchData(index);
                if (patch) {
                    patches.push(patch);
                    onPatchLoaded?.(index, patch);
                }
                onProgress?.(i + 1, count);
            }

            return patches;
        },

        getLoadedPatches(): (TPatch | undefined)[] {
            return [...patchCache];
        },

        invalidatePatchCache(): void {
            patchCache = new Array(config.patchCount).fill(undefined);
        },

        // === Tone Operations ===

        async requestToneData(toneIndex: number): Promise<TTone | null> {
            return serialize(async () => {
                const address = addressBuilders.buildToneAddress(toneIndex);
                const data = await requestDataWithAddress(address, config.toneBlockSize);
                const tone = parsers.parseTone(data);
                toneCache[toneIndex] = tone;
                return tone;
            });
        },

        async sendToneData(toneIndex: number, tone: TTone): Promise<void> {
            const address = addressBuilders.buildToneAddress(toneIndex);
            const data = parsers.encodeTone(tone);
            await bufferWrite(address, data);
            toneCache[toneIndex] = tone;
        },

        async loadToneRange(
            startIndex: number,
            count: number,
            onProgress?: ProgressCallback,
            onToneLoaded?: ToneLoadedCallback<TTone>,
            forceReload?: boolean
        ): Promise<TTone[]> {
            const tones: TTone[] = [];

            for (let i = 0; i < count; i++) {
                const index = startIndex + i;
                if (index >= config.toneCount) break;

                if (!forceReload && toneCache[index]) {
                    tones.push(toneCache[index]!);
                    onProgress?.(i + 1, count);
                    onToneLoaded?.(index, toneCache[index]!);
                    continue;
                }

                const tone = await this.requestToneData(index);
                if (tone) {
                    tones.push(tone);
                    onToneLoaded?.(index, tone);
                }
                onProgress?.(i + 1, count);
            }

            return tones;
        },

        getLoadedTones(): (TTone | undefined)[] {
            return [...toneCache];
        },

        invalidateToneCache(): void {
            toneCache = new Array(config.toneCount).fill(undefined);
        },

        // === Wave Data Operations ===

        async requestWaveData(
            toneIndex: number,
            onProgress?: (bytesReceived: number, totalBytes: number) => void
        ): Promise<SSeriesWaveDataResponse> {
            return serialize(async () => {
                // First get tone data to know wave location
                const tone = toneCache[toneIndex] ?? await this.requestToneData(toneIndex);
                if (!tone) {
                    throw new Error(`Tone ${toneIndex} not found`);
                }

                const wave = parsers.getToneWave(tone);
                const address = addressBuilders.buildWaveDataAddress(wave.bank, wave.segmentTop);

                // Calculate byte count from segment length
                const SAMPLES_PER_SEGMENT = 12000;
                const BYTES_PER_SAMPLE = 2;
                const totalBytes = wave.segmentLength * SAMPLES_PER_SEGMENT * BYTES_PER_SAMPLE;

                // Request wave data (not nibblized)
                const allBytes: number[] = [];

                const size = [
                    (totalBytes >> 21) & 0x7f,
                    (totalBytes >> 14) & 0x7f,
                    (totalBytes >> 7) & 0x7f,
                    totalBytes & 0x7f,
                ];

                const cs = calculateChecksum(address, size);
                const rqd = [
                    0xf0,
                    ROLAND_ID,
                    deviceId,
                    S_SERIES_MODEL_ID,
                    S_SERIES_COMMANDS.RQD,
                    ...address,
                    ...size,
                    cs,
                    0xf7,
                ];

                await new Promise<void>((resolve, reject) => {
                    let timeoutId: ReturnType<typeof setTimeout>;

                    function resetTimeout() {
                        if (timeoutId) clearTimeout(timeoutId);
                        timeoutId = setTimeout(() => {
                            midiAdapter.removeSysExListener(listener);
                            if (allBytes.length > 0) {
                                resolve();
                            } else {
                                reject(new Error('Wave data timeout'));
                            }
                        }, timeoutMs * 4);
                    }

                    function listener(response: number[]) {
                        if (
                            response.length >= 5 &&
                            response[1] === ROLAND_ID &&
                            response[2] === deviceId &&
                            response[3] === S_SERIES_MODEL_ID
                        ) {
                            const command = response[4];

                            if (command === S_SERIES_COMMANDS.DAT) {
                                resetTimeout();
                                // Skip 4-byte address header in DAT payload
                                const dataStart = 5 + 4;
                                const dataEnd = response.length - 2;
                                allBytes.push(...response.slice(dataStart, dataEnd));
                                onProgress?.(allBytes.length, totalBytes);

                                const ack = [
                                    0xf0,
                                    ROLAND_ID,
                                    deviceId,
                                    S_SERIES_MODEL_ID,
                                    S_SERIES_COMMANDS.ACK,
                                    0xf7,
                                ];
                                midiAdapter.send(ack);
                            } else if (command === S_SERIES_COMMANDS.EOD) {
                                clearTimeout(timeoutId);
                                midiAdapter.removeSysExListener(listener);

                                const ack = [
                                    0xf0,
                                    ROLAND_ID,
                                    deviceId,
                                    S_SERIES_MODEL_ID,
                                    S_SERIES_COMMANDS.ACK,
                                    0xf7,
                                ];
                                midiAdapter.send(ack);
                                resolve();
                            } else if (command === S_SERIES_COMMANDS.RJC || command === S_SERIES_COMMANDS.ERR) {
                                clearTimeout(timeoutId);
                                midiAdapter.removeSysExListener(listener);
                                reject(new Error('Wave data request rejected'));
                            }
                        }
                    }

                    resetTimeout();
                    midiAdapter.onSysEx(listener);
                    midiAdapter.send(rqd);
                });

                // Get tone details for response
                const toneData = toneCache[toneIndex]!;
                const toneWave = parsers.getToneWave(toneData);

                return {
                    data: new Uint8Array(allBytes),
                    sampleRate: (toneData as { sampleRate?: SSeriesSampleRate }).sampleRate === '15kHz' ? 15000 : 30000,
                    startPoint: toneWave.startPoint,
                    endPoint: toneWave.endPoint,
                    loopPoint: toneWave.loopPoint,
                    loopMode: (toneData as { loopMode?: SSeriesLoopMode }).loopMode ?? 'one-shot',
                };
            });
        },

        async sendWaveData(
            input: SSeriesWaveDataInput,
            onProgress?: (bytesSent: number, totalBytes: number) => void
        ): Promise<void> {
            return serialize(async () => {
                const address = addressBuilders.buildWaveDataAddress(input.waveBank, input.segmentTop);
                await sendWaveDataInternal(address, input.data, onProgress);
            });
        },

        async importTone(
            input: SSeriesImportToneInput<TTone>,
            onProgress?: (bytesSent: number, totalBytes: number) => void
        ): Promise<void> {
            return serialize(async () => {
                const { toneIndex, waveData, waveBank, segmentTop, segmentLength } = input;

                // Calculate sample count from wave data (2 bytes per sample)
                const sampleCount = Math.floor(waveData.length / 2);

                let tone: TTone;

                if (input.tone) {
                    // Library import: Use the full tone object, but override wave allocation
                    // and CLAMP wave parameters to prevent playing past wave data
                    const originalWave = parsers.getToneWave(input.tone);

                    // Use clampWaveParams to ensure loopPoint doesn't exceed endPoint
                    const clampedWave = clampWaveParams(
                        {
                            ...originalWave,
                            bank: waveBank,
                            segmentTop,
                            segmentLength,
                        },
                        sampleCount
                    );

                    tone = parsers.setToneWave(input.tone, clampedWave);
                } else {
                    // New sample import: Use createTone factory with sensible defaults
                    tone = parsers.createTone({
                        name: input.name ?? 'UNNAMED',
                        sampleRate: input.sampleRate ?? '30kHz',
                        waveBank,
                        segmentTop,
                        segmentLength,
                        sampleCount,
                        loopMode: input.loopMode ?? 'one-shot',
                        loopPoint: input.loopPoint ?? 0,
                        originalKey: input.originalKey ?? 60,
                    });
                }

                // Use internal functions directly to avoid serialize() deadlock
                // (we're already inside serialize)

                // Step 1: Send tone parameters
                const toneAddress = addressBuilders.buildToneAddress(toneIndex);
                const toneData = parsers.encodeTone(tone);
                await sendData(toneAddress, toneData);
                toneCache[toneIndex] = tone;

                // Step 2: Send wave data
                const waveAddress = addressBuilders.buildWaveDataAddress(waveBank, segmentTop);
                await sendWaveDataInternal(waveAddress, waveData, onProgress);

                // Step 3: Wait for device to process wave data
                await new Promise((resolve) => setTimeout(resolve, 500));

                // Step 4: Re-send tone parameters
                await sendData(toneAddress, toneData);
            });
        },

        // === Multi Mode Configuration ===

        async requestFunctionParameters(): Promise<MultiPartConfig[]> {
            return serialize(async () => {
                try {
                    const channelData = await requestDataWithAddress(
                        MULTI_CHANNELS_ADDRESS,
                        MULTI_PART_COUNT
                    );
                    const patchData = await requestDataWithAddress(
                        MULTI_PATCHES_ADDRESS,
                        MULTI_PART_COUNT
                    );

                    let outputData: number[];
                    try {
                        outputData = await requestDataWithAddress(
                            MULTI_OUTPUTS_ADDRESS,
                            MULTI_PART_COUNT
                        );
                    } catch {
                        // Output parameters may not exist on all firmware versions
                        outputData = [1, 1, 1, 1, 1, 1, 1, 1];
                    }

                    const levelData = await requestDataWithAddress(
                        MULTI_LEVELS_ADDRESS,
                        MULTI_PART_COUNT
                    );

                    const parts: MultiPartConfig[] = [];
                    for (let i = 0; i < MULTI_PART_COUNT; i++) {
                        parts.push({
                            channel: channelData[i] ?? 0,
                            patchIndex: patchData[i] ?? 0,
                            output: outputData[i] ?? 1,
                            level: levelData[i] ?? 127,
                        });
                    }

                    return parts;
                } catch {
                    // Return default configuration
                    return Array.from({ length: MULTI_PART_COUNT }, (_, i) => ({
                        channel: i,
                        patchIndex: 0,
                        output: 1,
                        level: 127,
                    }));
                }
            });
        },

        /**
         * Set MIDI receive channel for a multi mode part.
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters).
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
                    MULTI_CHANNELS_ADDRESS,
                    MULTI_PART_COUNT
                );
                const newChannelData = [...allChannelData];
                newChannelData[part] = channel;
                await sendData(MULTI_CHANNELS_ADDRESS, newChannelData);
            });
        },

        /**
         * Set patch assignment for a multi mode part.
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters).
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
                    MULTI_PATCHES_ADDRESS,
                    MULTI_PART_COUNT
                );
                const newPatchData = [...allPatchData];
                newPatchData[part] = value;
                await sendData(MULTI_PATCHES_ADDRESS, newPatchData);
            });
        },

        /**
         * Set output assignment for a multi mode part.
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters).
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
                        MULTI_OUTPUTS_ADDRESS,
                        MULTI_PART_COUNT
                    );
                } catch {
                    allOutputData = [1, 1, 1, 1, 1, 1, 1, 1];
                }
                const newOutputData = [...allOutputData];
                newOutputData[part] = output;
                await sendData(MULTI_OUTPUTS_ADDRESS, newOutputData);
            });
        },

        /**
         * Set level for a multi mode part.
         * Uses WSD/DAT/EOD protocol (DT1 does not work for function parameters).
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
                    MULTI_LEVELS_ADDRESS,
                    MULTI_PART_COUNT
                );
                const newLevelData = [...allLevelData];
                newLevelData[part] = level;
                await sendData(MULTI_LEVELS_ADDRESS, newLevelData);
            });
        },

        // === MIDI Panic ===

        panic(): void {
            // Send All Notes Off and All Sound Off on all channels
            for (let channel = 0; channel < 16; channel++) {
                // All Notes Off (CC 123)
                midiAdapter.send([0xb0 + channel, 123, 0]);
                // All Sound Off (CC 120)
                midiAdapter.send([0xb0 + channel, 120, 0]);
            }
        },

        // === Individual Patch Parameter Setters ===

        async setPatchName(patchIndex: number, name: string): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'name');
            const encoded = new Array(12).fill(0x20); // Space-padded
            for (let i = 0; i < Math.min(name.length, 12); i++) {
                encoded[i] = name.charCodeAt(i) & 0x7f;
            }
            await bufferWrite(address, encoded);
        },

        async setPatchKeyMode(patchIndex: number, keyMode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison'): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'keyMode');
            const modes = { normal: 0, 'v-sw': 1, 'x-fade': 2, 'v-mix': 3, unison: 4 };
            await bufferWrite(address, [modes[keyMode]]);
        },

        async setPatchBenderRange(patchIndex: number, range: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'benderRange');
            await bufferWrite(address, [Math.max(0, Math.min(12, range))]);
        },

        async setPatchAftertouchSens(patchIndex: number, sens: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'aftertouchSens');
            await bufferWrite(address, [Math.max(0, Math.min(127, sens))]);
        },

        async setPatchAftertouchAssign(patchIndex: number, assign: SSeriesAftertouchAssign): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'aftertouchAssign');
            const assigns: Record<SSeriesAftertouchAssign, number> = {
                modulation: 0, volume: 1, 'bend+': 2, 'bend-': 3, filter: 4
            };
            await bufferWrite(address, [assigns[assign]]);
        },

        async setPatchKeyAssign(patchIndex: number, assign: SSeriesKeyAssign): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'keyAssign');
            await bufferWrite(address, [assign === 'rotary' ? 0 : 1]);
        },

        async setPatchOutput(patchIndex: number, output: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'outputAssign');
            await bufferWrite(address, [Math.max(0, Math.min(8, output))]);
        },

        async setPatchLevel(patchIndex: number, level: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'level');
            await bufferWrite(address, [Math.max(0, Math.min(127, level))]);
        },

        async setPatchDetune(patchIndex: number, detune: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'detune');
            // Convert signed value to unsigned byte
            const unsigned = detune < 0 ? detune + 128 : detune;
            await bufferWrite(address, [unsigned]);
        },

        async setPatchVelocityThreshold(patchIndex: number, threshold: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'velocityThreshold');
            await bufferWrite(address, [Math.max(0, Math.min(127, threshold))]);
        },

        async setPatchVelocityMixRatio(patchIndex: number, ratio: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'velocityMixRatio');
            await bufferWrite(address, [Math.max(0, Math.min(127, ratio))]);
        },

        async setPatchOctaveShift(patchIndex: number, shift: number): Promise<void> {
            const address = addressBuilders.buildPatchParamAddress(patchIndex, 'octaveShift');
            // Convert -2..+2 to unsigned byte
            const unsigned = shift < 0 ? shift + 128 : shift;
            await bufferWrite(address, [unsigned]);
        },
    };
}
