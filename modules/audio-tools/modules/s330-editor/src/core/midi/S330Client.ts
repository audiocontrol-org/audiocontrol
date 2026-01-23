/**
 * S-330 MIDI Client for Web Browser
 *
 * Browser-compatible implementation of S-330 communication using the RQD/WSD protocol.
 * Re-exports types from @oletizi/sampler-devices for convenience.
 *
 * Protocol Notes (from hardware testing, January 2026):
 * - RQD with address/size format works: F0 41 dev 1E 41 [addr 4B] [size 4B] [cs] F7
 * - Both address LSB and size LSB must be EVEN (nibble alignment)
 * - Size represents nibble count, not byte count (size = bytes * 2)
 * - Handshake: RQD → DAT → ACK → ... → EOD → ACK (no initial ACK from device)
 */

import type { S330MidiIO } from './types';
import type {
  S330SystemParams,
  S330Patch,
  S330Tone,
  S330ClientOptions,
  S330Response,
  S330Command,
  S330PatchCommon,
  S330Partial,
} from '@oletizi/sampler-devices/s330';

import {
  ROLAND_ID,
  S330_MODEL_ID,
  DEFAULT_DEVICE_ID,
  S330_COMMANDS,
  TIMING,
  calculateChecksum,
  PATCH_COMMON_SIZE,
  PARTIAL_SIZE,
  TONE_BLOCK_SIZE,
  MAX_PARTIALS,
  MAX_PATCHES,
  MAX_TONES,
} from '@oletizi/sampler-devices/s330';

// Re-export types for convenience
export type {
  S330SystemParams,
  S330Patch,
  S330Tone,
  S330PatchCommon,
  S330Partial,
  S330Response,
  S330Command,
};

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
 * All function parameters are stored as single bytes at consecutive addresses
 */
export const S330_FUNCTION_ADDRESSES = {
  // MULTI MIDI RX-CH (MIDI channel assignments 0-15 = Ch 1-16)
  // Each value is 1 byte at consecutive addresses
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

  // MULTI LEVEL (level 0-127)
  MULTI_LEVEL_A: 0x56,
  MULTI_LEVEL_B: 0x57,
  MULTI_LEVEL_C: 0x58,
  MULTI_LEVEL_D: 0x59,
  MULTI_LEVEL_E: 0x5A,
  MULTI_LEVEL_F: 0x5B,
  MULTI_LEVEL_G: 0x5C,
  MULTI_LEVEL_H: 0x5D,
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
  level: number; // 0-127
}

/**
 * S-330 client interface for browser
 */
export interface S330ClientInterface {
  connect(): Promise<boolean>;
  disconnect(): void;
  isConnected(): boolean;
  getDeviceId(): number;

  // RQD with address/size methods (WORKING - use these!)
  requestAllPatchNames(): Promise<PatchNameInfo[]>;
  requestAllToneNames(): Promise<ToneNameInfo[]>;
  requestPatchData(patchIndex: number): Promise<S330Patch | null>;
  requestToneData(toneIndex: number): Promise<S330Tone | null>;

  // Function parameters - Multi mode configuration
  requestFunctionParameters(): Promise<MultiPartConfig[]>;
  setMultiChannel(part: number, channel: number): void;
  setMultiPatch(part: number, patchIndex: number): void;
  setMultiLevel(part: number, level: number): void;

  // Low-level RQD with address/size - for custom requests
  requestDataWithAddress(
    address: number[],
    sizeInBytes: number
  ): Promise<number[]>;

  // DT1 parameter update - for setting individual parameters
  sendParameter(address: number[], data: number[]): void;

  // Legacy bulk dump methods (type-byte format - typically rejected by S-330)
  requestBulkDump(dataType: S330DataType): Promise<number[][]>;
  sendBulkDump(dataType: S330DataType, data: number[]): Promise<S330Response>;
  parsePatches(packets: number[][]): S330Patch[];
  parseTones(packets: number[][]): S330Tone[];
}

/**
 * De-nibblize data from DAT packets
 *
 * S-330 sends data with high nibble and low nibble separated:
 * [high0, low0, high1, low1, ...] → [byte0, byte1, ...]
 */
function deNibblize(nibbles: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < nibbles.length - 1; i += 2) {
    const high = (nibbles[i] & 0x0F) << 4;
    const low = nibbles[i + 1] & 0x0F;
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
    nibbles.push((byte >> 4) & 0x0F);
    nibbles.push(byte & 0x0F);
  }
  return nibbles;
}

/**
 * Parse ASCII name from data bytes
 */
function parseName(data: number[], offset: number, length: number = 8): string {
  let name = '';
  for (let i = 0; i < length; i++) {
    const charCode = data[offset + i];
    if (charCode >= 0x20 && charCode <= 0x7E) {
      name += String.fromCharCode(charCode);
    }
  }
  return name.trim();
}

/**
 * Parse key mode from byte value
 */
function parseKeyMode(value: number): 'whole' | 'dual' | 'split' {
  switch (value) {
    case 0: return 'whole';
    case 1: return 'dual';
    case 2: return 'split';
    default: return 'whole';
  }
}

/**
 * Parse loop mode from byte value
 */
function parseLoopMode(value: number): 'forward' | 'alternating' | 'one-shot' {
  switch (value) {
    case 0: return 'forward';
    case 1: return 'alternating';
    case 2: return 'one-shot';
    default: return 'forward';
  }
}

/**
 * Parse LFO destination from byte value
 */
function parseLfoDestination(value: number): 'pitch' | 'tvf' | 'tva' {
  switch (value) {
    case 0: return 'pitch';
    case 1: return 'tvf';
    case 2: return 'tva';
    default: return 'pitch';
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
    ((data[offset] & 0x7F) << 14) |
    ((data[offset + 1] & 0x7F) << 7) |
    (data[offset + 2] & 0x7F)
  );
}

/**
 * Create S-330 client for browser
 *
 * The client internally serializes all MIDI requests to prevent
 * concurrent requests from interfering with each other.
 */
export function createS330Client(
  midiIO: S330MidiIO,
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
        midiIO.removeSysExListener(listener);
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
     * Request data using RQD with address/size format (WORKING method)
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
    async requestDataWithAddress(
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

      // Size LSB must be even - this is guaranteed since sizeInNibbles = bytes * 2

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

      console.log('[S330] RQD request:', {
        address: address.map((b) => b.toString(16).padStart(2, '0')).join(' '),
        sizeBytes: sizeInBytes,
        sizeNibbles: sizeInNibbles,
        message: message.map((b) => b.toString(16).padStart(2, '0')).join(' '),
      });

      return new Promise((resolve, reject) => {
        const allNibbles: number[] = [];
        let timeoutId: ReturnType<typeof setTimeout>;

        function resetTimeout() {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            midiIO.removeSysExListener(listener);
            if (allNibbles.length > 0) {
              // Partial data received - return what we have
              console.warn(
                '[S330] Timeout with partial data:',
                allNibbles.length,
                'nibbles'
              );
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
          midiIO.send(ackMsg);
        }

        function listener(response: number[]) {
          // Validate response header
          if (response.length < 5) return;
          if (response[1] !== ROLAND_ID) return;
          if (response[3] !== S330_MODEL_ID) return;

          const respDeviceId = response[2];
          const command = response[4];

          // Check device ID
          if (respDeviceId !== deviceId) {
            console.warn(
              '[S330] Device ID mismatch:',
              respDeviceId,
              'vs',
              deviceId
            );
            if (command === S330_COMMANDS.RJC || command === S330_COMMANDS.ERR) {
              clearTimeout(timeoutId);
              midiIO.removeSysExListener(listener);
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
            console.log(
              '[S330] DAT packet:',
              nibbles.length,
              'nibbles, total:',
              allNibbles.length
            );
            sendAck();
          } else if (command === S330_COMMANDS.EOD) {
            console.log('[S330] EOD - transfer complete');
            clearTimeout(timeoutId);
            midiIO.removeSysExListener(listener);
            sendAck();
            resolve(deNibblize(allNibbles));
          } else if (command === S330_COMMANDS.RJC) {
            console.log('[S330] RJC - request rejected');
            clearTimeout(timeoutId);
            midiIO.removeSysExListener(listener);
            reject(new Error('RQD request rejected by S-330'));
          } else if (command === S330_COMMANDS.ERR) {
            console.log('[S330] ERR - communication error');
            clearTimeout(timeoutId);
            midiIO.removeSysExListener(listener);
            reject(new Error('S-330 communication error'));
          }
        }

        resetTimeout();
        midiIO.onSysEx(listener);
        midiIO.send(message);
      });
    },

    /**
     * Send parameter update using DT1 (Data Set 1) command
     *
     * DT1 is a one-way write command that sets parameters on the S-330.
     * No response is expected from the device.
     *
     * Format: F0 41 [dev] 1E 12 [addr 4B] [data] [checksum] F7
     *
     * @param address - 4-byte address [aa, bb, cc, dd]
     * @param data - Parameter data bytes to write
     */
    sendParameter(address: number[], data: number[]): void {
      if (address.length !== 4) {
        throw new Error('Address must be 4 bytes');
      }

      // Calculate checksum over address + data
      const cs = calculateChecksum(address, data);

      const message = [
        0xf0,
        ROLAND_ID,
        deviceId,
        S330_MODEL_ID,
        S330_COMMANDS.DT1,
        ...address,
        ...data,
        cs,
        0xf7,
      ];

      console.log('[S330] DT1 parameter update:', {
        address: address.map((b) => b.toString(16).padStart(2, '0')).join(' '),
        data: data.map((b) => b.toString(16).padStart(2, '0')).join(' '),
        message: message.map((b) => b.toString(16).padStart(2, '0')).join(' '),
      });

      midiIO.send(message);
    },

    /**
     * Request all patch names from the S-330
     * Serialized to prevent concurrent request interference
     *
     * Patch names are stored in bank 00 00 (Patch parameters).
     * Address format: 00 00 pp 00 (pp = patch number 0-63)
     * Name is the first 8 bytes at each patch address.
     */
    async requestAllPatchNames(): Promise<PatchNameInfo[]> {
      return serialize(async () => {
        const patches: PatchNameInfo[] = [];

        // Request each patch name individually
        // Patch address: 00 00 (pp*4) 00 - each patch has stride of 4
        // Name is 8 bytes at offset 0
        for (let i = 0; i < MAX_PATCHES; i++) {
          try {
            const address = [0x00, 0x00, i * 4, 0x00];
            const data = await this.requestDataWithAddress(address, 8);

            const name = parseName(data, 0, 8);
            const isEmpty =
              name === '' || name === '        ' || data.every((b) => b === 0);

            // Debug: log non-empty patches
            if (!isEmpty) {
              console.log(`[S330] Patch ${i}: name="${name}", data=[${data.join(',')}]`);
            }

            patches.push({ index: i, name, isEmpty });
          } catch (err) {
            // If we get RJC, the patch slot is empty
            console.log(`[S330] Patch ${i}: RJC or error - marking empty`);
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
            const data = await this.requestDataWithAddress(address, 8);

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
          // Request full patch data
          // Patch common is 16 bytes, partials are 11 bytes each (max 32)
          // Total max size: 16 + (32 * 11) = 368 bytes
          const address = [0x00, 0x01, patchIndex, 0x00];
          const data = await this.requestDataWithAddress(
            address,
            PATCH_COMMON_SIZE + MAX_PARTIALS * PARTIAL_SIZE
          );

          // Parse patch common
          const common: S330PatchCommon = {
            name: parseName(data, 0),
            benderRange: data[8],
            aftertouchSens: data[9],
            keyMode: parseKeyMode(data[10]),
            splitPoint: data[11],
            portamentoTime: data[12],
            portamentoEnabled: data[13] !== 0,
            outputAssign: data[14],
            level: data[15],
          };

          // Parse partials
          const partials: S330Partial[] = [];
          for (let p = 0; p < MAX_PARTIALS; p++) {
            const offset = PATCH_COMMON_SIZE + p * PARTIAL_SIZE;
            const toneNum = data[offset];

            // Tone number 0x7F indicates empty partial
            if (toneNum === 0x7f) break;

            partials.push({
              toneNumber: toneNum,
              keyRangeLow: data[offset + 1],
              keyRangeHigh: data[offset + 2],
              velRangeLow: data[offset + 3],
              velRangeHigh: data[offset + 4],
              level: data[offset + 5],
              pan: data[offset + 6],
              coarseTune: data[offset + 7],
              fineTune: data[offset + 8],
              outputAssign: data[offset + 9],
              muted: data[offset + 10] !== 0,
            });
          }

          return { common, partials };
        } catch (err) {
          console.warn('[S330] Failed to get patch', patchIndex, err);
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
          const data = await this.requestDataWithAddress(address, TONE_BLOCK_SIZE);

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
          console.warn('[S330] Failed to get tone', toneIndex, err);
          return null;
        }
      });
    },

    /**
     * Request all function parameters (Multi mode configuration)
     * Serialized to prevent concurrent request interference
     *
     * Address base: 00 01 00 00 (function parameters bank per MIDI Implementation)
     * - Multi MIDI RX-CH 1-8:    offsets 0x22-0x29 (8 bytes)
     * - Multi Patch Number 1-8:  offsets 0x32-0x39 (8 bytes)
     * - Multi Level 1-8:         offsets 0x56-0x5D (8 bytes)
     *
     * Returns configuration for all 8 parts (A-H)
     */
    async requestFunctionParameters(): Promise<MultiPartConfig[]> {
      return serialize(async () => {
        try {
          // Read each parameter group separately using correct base address 00 01 00 xx
          // Data is already de-nibblized, each byte = 1 value

          // Channels: 00 01 00 22 (8 bytes for parts A-H)
          const channelData = await this.requestDataWithAddress(
            [0x00, 0x01, 0x00, 0x22],
            8
          );

          // Patches: 00 01 00 32 (8 bytes for parts A-H)
          const patchData = await this.requestDataWithAddress(
            [0x00, 0x01, 0x00, 0x32],
            8
          );

          // Levels: 00 01 00 56 (8 bytes for parts A-H)
          const levelData = await this.requestDataWithAddress(
            [0x00, 0x01, 0x00, 0x56],
            8
          );

          const parts: MultiPartConfig[] = [];

          for (let i = 0; i < 8; i++) {
            const channel = channelData[i] ?? 0;
            const patchIndex = patchData[i] ?? 0;
            const level = levelData[i] ?? 127;

            parts.push({ channel, patchIndex, level });
          }

          console.log('[S330] Loaded function parameters:', parts);
          return parts;
        } catch (err) {
          console.warn('[S330] Failed to load function parameters:', err);
          // Return default configuration
          return Array.from({ length: 8 }, (_, i) => ({
            channel: i,
            patchIndex: 0,
            level: 127,
          }));
        }
      });
    },

    /**
     * Set MIDI receive channel for a multi mode part
     *
     * Address: 00 01 00 (0x22 + part) - function parameters bank
     *
     * @param part - Part number (0-7 for A-H)
     * @param channel - MIDI channel (0-15 for Ch 1-16)
     */
    setMultiChannel(part: number, channel: number): void {
      if (part < 0 || part > 7) {
        throw new Error(`Invalid part number: ${part} (must be 0-7)`);
      }
      if (channel < 0 || channel > 15) {
        throw new Error(`Invalid channel: ${channel} (must be 0-15)`);
      }

      // Address: 00 01 00 (0x22 + part) - each part is 1 byte apart
      const offset = 0x22 + part;
      const address = [0x00, 0x01, 0x00, offset];

      // Value is stored as single byte, but sent nibblized for DT1
      const nibbles = [(channel >> 4) & 0x0f, channel & 0x0f];

      this.sendParameter(address, nibbles);
      console.log(`[S330] Set part ${part} channel to ${channel + 1}`);
    },

    /**
     * Set patch assignment for a multi mode part
     *
     * Address: 00 01 00 (0x32 + part) - function parameters bank
     *
     * @param part - Part number (0-7 for A-H)
     * @param patchIndex - Patch number (0-63)
     */
    setMultiPatch(part: number, patchIndex: number): void {
      if (part < 0 || part > 7) {
        throw new Error(`Invalid part number: ${part} (must be 0-7)`);
      }
      if (patchIndex < 0 || patchIndex > 63) {
        throw new Error(`Invalid patch index: ${patchIndex} (must be 0-63)`);
      }

      // Address: 00 01 00 (0x32 + part) - each part is 1 byte apart
      const offset = 0x32 + part;
      const address = [0x00, 0x01, 0x00, offset];

      // Value is stored as single byte, but sent nibblized for DT1
      const nibbles = [(patchIndex >> 4) & 0x0f, patchIndex & 0x0f];

      this.sendParameter(address, nibbles);
      console.log(`[S330] Set part ${part} patch to ${patchIndex}`);
    },

    /**
     * Set level for a multi mode part
     *
     * Address: 00 01 00 (0x56 + part) - function parameters bank
     *
     * @param part - Part number (0-7 for A-H)
     * @param level - Level (0-127)
     */
    setMultiLevel(part: number, level: number): void {
      if (part < 0 || part > 7) {
        throw new Error(`Invalid part number: ${part} (must be 0-7)`);
      }
      if (level < 0 || level > 127) {
        throw new Error(`Invalid level: ${level} (must be 0-127)`);
      }

      // Address: 00 01 00 (0x56 + part) - each part is 1 byte apart
      const offset = 0x56 + part;
      const address = [0x00, 0x01, 0x00, offset];

      // Value is stored as single byte, but sent nibblized for DT1
      const nibbles = [(level >> 4) & 0x0f, level & 0x0f];

      this.sendParameter(address, nibbles);
      console.log(`[S330] Set part ${part} level to ${level}`);
    },

    // Legacy bulk dump method (type-byte format - typically rejected)
    // Serialized to prevent concurrent request interference
    async requestBulkDump(dataType: S330DataType): Promise<number[][]> {
      return serialize(async () => {
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

        console.log('[S330] Sending RQD request:', {
          dataType: dataType.toString(16),
          deviceId,
          message: message.map(b => b.toString(16).padStart(2, '0')).join(' '),
        });

        return new Promise((resolve, reject) => {
        const packets: number[][] = [];
        let timeoutId: ReturnType<typeof setTimeout>;

        function resetTimeout() {
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            console.log('[S330] Timeout - packets received:', packets.length);
            midiIO.removeSysExListener(listener);
            if (packets.length > 0) {
              resolve(packets);
            } else {
              reject(new Error('RQD response timeout - no data received'));
            }
          }, timeoutMs * 2);
        }

        function listener(response: number[]) {
          console.log('[S330] Received SysEx:', {
            length: response.length,
            header: response.slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join(' '),
          });

          if (response.length < 5) {
            console.log('[S330] Ignoring - message too short');
            return;
          }

          if (response[1] !== ROLAND_ID) {
            console.log('[S330] Ignoring - not Roland (expected 0x41, got 0x' + response[1].toString(16) + ')');
            return;
          }

          if (response[3] !== S330_MODEL_ID) {
            console.log('[S330] Ignoring - wrong model ID (expected 0x1e, got 0x' + response[3].toString(16) + ')');
            return;
          }

          // Check device ID - warn but still process if it's a rejection/error
          const responseDeviceId = response[2];
          const responseCommand = response[4];

          if (responseDeviceId !== deviceId) {
            console.warn('[S330] Device ID mismatch! Expected:', deviceId, 'Got:', responseDeviceId);
            console.warn('[S330] Your S-330 device ID is set to', responseDeviceId, '- update the editor to match');

            // Still process rejection/error responses even with wrong device ID
            // so the user sees the error instead of a timeout
            if (responseCommand === S330_COMMANDS.RJC) {
              clearTimeout(timeoutId);
              midiIO.removeSysExListener(listener);
              reject(new Error(`S-330 rejected request (device ID mismatch: S-330 is set to ${responseDeviceId}, editor is set to ${deviceId})`));
              return;
            }
            if (responseCommand === S330_COMMANDS.ERR) {
              clearTimeout(timeoutId);
              midiIO.removeSysExListener(listener);
              reject(new Error(`S-330 communication error (device ID mismatch: S-330 is ${responseDeviceId}, editor is ${deviceId})`));
              return;
            }
            return;
          }

          resetTimeout();
          const command = response[4];
          console.log('[S330] Command:', command.toString(16),
            command === S330_COMMANDS.DAT ? '(DAT)' :
            command === S330_COMMANDS.EOD ? '(EOD)' :
            command === S330_COMMANDS.RJC ? '(RJC)' :
            command === S330_COMMANDS.ERR ? '(ERR)' : '(unknown)');

          if (command === S330_COMMANDS.DAT) {
            packets.push(response);
            console.log('[S330] DAT packet received, total:', packets.length);
          } else if (command === S330_COMMANDS.EOD) {
            console.log('[S330] EOD received, resolving with', packets.length, 'packets');
            clearTimeout(timeoutId);
            midiIO.removeSysExListener(listener);
            resolve(packets);
          } else if (command === S330_COMMANDS.RJC) {
            console.log('[S330] RJC - request rejected');
            clearTimeout(timeoutId);
            midiIO.removeSysExListener(listener);
            reject(new Error('RQD request rejected - no data available'));
          } else if (command === S330_COMMANDS.ERR) {
            console.log('[S330] ERR - communication error');
            clearTimeout(timeoutId);
            midiIO.removeSysExListener(listener);
            reject(new Error('RQD communication error'));
          }
        }

        resetTimeout();
        midiIO.onSysEx(listener);
        midiIO.send(message);
      });
      });
    },

    // Serialized to prevent concurrent request interference
    async sendBulkDump(dataType: S330DataType, data: number[]): Promise<S330Response> {
      return serialize(async () => {
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

      const response = await sendAndReceive(wsdMessage);
      const responseCommand = response[4];

      if (responseCommand === S330_COMMANDS.RJC) {
        return { success: false, command: 'RJC' as S330Command };
      }
      if (responseCommand !== S330_COMMANDS.ACK) {
        return { success: false, command: 'ERR' as S330Command };
      }

      // Nibblize and send data
      const nibblizedData = nibblize(data);
      const dataSum = dataType + nibblizedData.reduce((a, b) => a + b, 0);
      const dataChecksum = (128 - (dataSum & 0x7F)) & 0x7F;

      const datMessage = [
        0xF0,
        ROLAND_ID,
        deviceId,
        S330_MODEL_ID,
        S330_COMMANDS.DAT,
        dataType,
        ...nibblizedData,
        dataChecksum,
        0xF7,
      ];

      midiIO.send(datMessage);

      // Send EOD
      midiIO.send([
        0xF0,
        ROLAND_ID,
        deviceId,
        S330_MODEL_ID,
        S330_COMMANDS.EOD,
        0xF7,
      ]);

      return { success: true, command: 'EOD' as S330Command };
      });
    },

    parsePatches(packets: number[][]): S330Patch[] {
      const patches: S330Patch[] = [];

      // Combine all DAT packet payloads
      const allData: number[] = [];
      for (const packet of packets) {
        // DAT packet structure: F0 41 dev 1E 42 type [data...] checksum F7
        const dataStart = 6;
        const dataEnd = packet.length - 2;
        allData.push(...packet.slice(dataStart, dataEnd));
      }

      // De-nibblize the data
      const data = deNibblize(allData);

      // Each patch is PATCH_COMMON_SIZE + (MAX_PARTIALS * PARTIAL_SIZE) bytes
      const patchSize = PATCH_COMMON_SIZE + MAX_PARTIALS * PARTIAL_SIZE;
      const numPatches = Math.floor(data.length / patchSize);

      for (let i = 0; i < numPatches; i++) {
        const offset = i * patchSize;
        const patchData = data.slice(offset, offset + patchSize);

        const common: S330PatchCommon = {
          name: parseName(patchData, 0),
          benderRange: patchData[8],
          aftertouchSens: patchData[9],
          keyMode: parseKeyMode(patchData[10]),
          splitPoint: patchData[11],
          portamentoTime: patchData[12],
          portamentoEnabled: patchData[13] !== 0,
          outputAssign: patchData[14],
          level: patchData[15],
        };

        const partials: S330Partial[] = [];
        const partialsOffset = PATCH_COMMON_SIZE;

        // Read partials until we hit an empty one
        for (let p = 0; p < MAX_PARTIALS; p++) {
          const pOffset = partialsOffset + p * PARTIAL_SIZE;
          const toneNum = patchData[pOffset];

          // Tone number 0x7F indicates empty partial
          if (toneNum === 0x7F) break;

          partials.push({
            toneNumber: toneNum,
            keyRangeLow: patchData[pOffset + 1],
            keyRangeHigh: patchData[pOffset + 2],
            velRangeLow: patchData[pOffset + 3],
            velRangeHigh: patchData[pOffset + 4],
            level: patchData[pOffset + 5],
            pan: patchData[pOffset + 6],
            coarseTune: patchData[pOffset + 7],
            fineTune: patchData[pOffset + 8],
            outputAssign: patchData[pOffset + 9],
            muted: patchData[pOffset + 10] !== 0,
          });
        }

        patches.push({ common, partials });
      }

      return patches;
    },

    parseTones(packets: number[][]): S330Tone[] {
      const tones: S330Tone[] = [];

      // Combine all DAT packet payloads
      const allData: number[] = [];
      for (const packet of packets) {
        const dataStart = 6;
        const dataEnd = packet.length - 2;
        allData.push(...packet.slice(dataStart, dataEnd));
      }

      // De-nibblize the data
      const data = deNibblize(allData);

      const numTones = Math.floor(data.length / TONE_BLOCK_SIZE);

      for (let i = 0; i < numTones; i++) {
        const offset = i * TONE_BLOCK_SIZE;
        const toneData = data.slice(offset, offset + TONE_BLOCK_SIZE);

        tones.push({
          name: parseName(toneData, 0),
          originalKey: toneData[8],
          sampleRate: parseSampleRate(toneData[9]),
          startAddress: parse21BitAddress(toneData, 10),
          loopStart: parse21BitAddress(toneData, 13),
          loopEnd: parse21BitAddress(toneData, 16),
          loopMode: parseLoopMode(toneData[19]),
          coarseTune: toneData[20],
          fineTune: toneData[21],
          level: toneData[22],
          tva: {
            attack: toneData[23],
            decay: toneData[24],
            sustain: toneData[25],
            release: toneData[26],
          },
          tvf: {
            cutoff: toneData[27],
            resonance: toneData[28],
            envDepth: toneData[29],
            envelope: {
              attack: toneData[30],
              decay: toneData[31],
              sustain: toneData[32],
              release: toneData[33],
            },
          },
          lfo: {
            rate: toneData[34],
            depth: toneData[35],
            delay: toneData[36],
            destination: parseLfoDestination(toneData[37]),
          },
        });
      }

      return tones;
    },
  };
}

// Export constants for use elsewhere
export {
  ROLAND_ID,
  S330_MODEL_ID,
  DEFAULT_DEVICE_ID,
  S330_COMMANDS,
  TIMING,
  calculateChecksum,
};
