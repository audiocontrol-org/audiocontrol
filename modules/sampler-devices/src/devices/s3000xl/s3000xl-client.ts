/**
 * Akai S3000XL MIDI SysEx Client
 *
 * Factory-based client for communicating with Akai S3000XL samplers via SysEx.
 * Works in both Node.js and browser environments via the MidiIO interface.
 *
 * Follows the same architectural patterns as the S-330 client:
 * - Factory function (no classes)
 * - Request serialization queue (one SysEx in flight at a time)
 * - Write buffer with configurable flush delay
 * - Retry via withRetry from shared-midi
 * - Response validation
 *
 * Protocol reference: https://lakai.sourceforge.net/docs/s2800_sysex.html
 */

import type { MidiIO } from '@audiocontrol/shared-midi';
import { withRetry } from '@audiocontrol/shared-midi';
import {
  parseProgramHeader,
  parseKeygroupHeader,
  parseSampleHeader,
} from '@/devices/s3000xl.js';
import type { ProgramHeader, KeygroupHeader, SampleHeader } from '@/devices/s3000xl.js';
import type { S3000xlClientOptions, S3000xlClientInterface } from '@/devices/s3000xl/s3000xl-types.js';
import {
  AkaiOpcode,
  AKAI_MANUFACTURER_ID,
  DEFAULT_TIMING,
  buildAkaiSysEx,
  parseAkaiResponse,
  isErrorResponse,
  parseNameList,
} from '@/devices/s3000xl/s3000xl-protocol.js';

const AKAI_NAME_LENGTH = 12;

// =========================================================================
// Inline nibble utilities (avoids sampler-lib dependency for browser compat)
// =========================================================================

/** Split a byte into [lowNibble, highNibble] (little-endian). */
function byte2nibblesLE(byte: number): number[] {
  return [byte & 0x0f, (byte >> 4) & 0x0f];
}

/** Combine two nibbles into a byte. */
function nibbles2byte(low: number, high: number): number {
  return (high << 4) | (low & 0x0f);
}

/** Read next byte from nibble stream, advancing offset by 2. */
function nextByte(nibbles: number[], v: { value: number; offset: number }): void {
  v.value = nibbles2byte(nibbles[v.offset], nibbles[v.offset + 1]);
  v.offset += 2;
}

/**
 * Create a new S3000XL client instance.
 *
 * @param midiIO - MIDI I/O interface (browser WebMidiAdapter or Node.js easymidi adapter)
 * @param options - Optional client configuration
 */
export function createS3000xlClient(
  midiIO: MidiIO,
  options?: Partial<S3000xlClientOptions>,
): S3000xlClientInterface {
  const channel = options?.channel ?? 0;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMING.TIMEOUT_MS;
  const writeFlushDelayMs = options?.writeFlushDelayMs ?? DEFAULT_TIMING.WRITE_FLUSH_DELAY_MS;
  const maxRetries = options?.maxRetries ?? DEFAULT_TIMING.MAX_RETRIES;

  // Caches
  let programNamesCache: string[] | undefined;
  let sampleNamesCache: string[] | undefined;
  const programHeaderCache = new Map<number, ProgramHeader>();
  const sampleHeaderCache = new Map<number, SampleHeader>();
  const keygroupHeaderCache = new Map<string, KeygroupHeader>();

  // Request queue for serializing MIDI operations
  let requestQueue: Promise<unknown> = Promise.resolve();

  function serialize<T>(fn: () => Promise<T>): Promise<T> {
    const result = requestQueue.then(fn, fn);
    requestQueue = result.catch(() => {});
    return result;
  }

  // =========================================================================
  // Write Buffer
  // =========================================================================

  const writeBuffer = new Map<string, { opcode: AkaiOpcode; data: number[] }>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let flushPromise: Promise<void> | null = null;

  async function flushWriteBuffer(): Promise<void> {
    if (writeBuffer.size === 0) return;

    const pending = Array.from(writeBuffer.values());
    writeBuffer.clear();
    flushTimer = null;

    for (const { opcode, data } of pending) {
      await serialize(async () => {
        await sendCommandInternal(opcode, data);
      });
    }
  }

  function bufferWrite(key: string, opcode: AkaiOpcode, data: number[]): Promise<void> {
    if (writeFlushDelayMs === 0) {
      return serialize(async () => {
        await sendCommandInternal(opcode, data);
      });
    }

    writeBuffer.set(key, { opcode, data });

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
  // Core SysEx Communication
  // =========================================================================

  function sendAndReceive(message: number[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        midiIO.removeSysExListener(listener);
        reject(new Error('S3000XL response timeout'));
      }, timeoutMs);

      function listener(response: number[]) {
        if (
          response.length >= 6 &&
          response[1] === AKAI_MANUFACTURER_ID
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

  async function sendCommandInternal(opcode: number, data: number[]): Promise<number[]> {
    const message = buildAkaiSysEx(channel, opcode, data);
    const response = await sendAndReceive(message);

    if (isErrorResponse(response)) {
      const { data: errorData } = parseAkaiResponse(response);
      const errorCode = errorData.length > 0 ? errorData[0] : -1;
      throw new Error(
        `S3000XL error response (opcode 0x${opcode.toString(16)}): error code ${errorCode}`,
      );
    }

    return response;
  }

  function sendCommandWithRetry(opcode: number, data: number[]): Promise<number[]> {
    return serialize(() =>
      withRetry(() => sendCommandInternal(opcode, data), {
        maxRetries,
        initialDelayMs: DEFAULT_TIMING.RETRY_DELAY_MS,
      }),
    );
  }

  // =========================================================================
  // Header Parsing Helpers
  // =========================================================================

  function parseProgramFromResponse(response: number[]): ProgramHeader {
    const header = {} as ProgramHeader;
    const v = { value: 0, offset: 5 };
    nextByte(response, v);
    const headerData = response.slice(v.offset, response.length - 1);
    parseProgramHeader(headerData, 1, header);
    header.raw = response;
    return header;
  }

  function parseKeygroupFromResponse(response: number[]): KeygroupHeader {
    const header = {} as KeygroupHeader;
    const v = { value: 0, offset: 5 };
    nextByte(response, v);
    const headerData = response.slice(v.offset, response.length - 1);
    parseKeygroupHeader(headerData, 0, header);
    header.raw = response;
    return header;
  }

  function parseSampleFromResponse(response: number[]): SampleHeader {
    const header = {} as SampleHeader;
    const v = { value: 0, offset: 5 };
    nextByte(response, v);
    parseSampleHeader(response.slice(v.offset, response.length - 1), 0, header);
    header.raw = response;
    return header;
  }

  // =========================================================================
  // Public Interface
  // =========================================================================

  const client: S3000xlClientInterface = {
    async fetchProgramNames(): Promise<string[]> {
      if (programNamesCache) return [...programNamesCache];

      const response = await sendCommandWithRetry(AkaiOpcode.RPLIST, []);
      const names = parseNameList(response, AKAI_NAME_LENGTH);
      programNamesCache = names;
      return [...names];
    },

    async fetchSampleNames(): Promise<string[]> {
      if (sampleNamesCache) return [...sampleNamesCache];

      const response = await sendCommandWithRetry(AkaiOpcode.RSLIST, []);
      const names = parseNameList(response, AKAI_NAME_LENGTH);
      sampleNamesCache = names;
      return [...names];
    },

    async fetchProgramHeader(programNumber: number): Promise<ProgramHeader> {
      const cached = programHeaderCache.get(programNumber);
      if (cached) return cached;

      const response = await sendCommandWithRetry(
        AkaiOpcode.RPDATA,
        byte2nibblesLE(programNumber),
      );
      const header = parseProgramFromResponse(response);
      programHeaderCache.set(programNumber, header);
      return header;
    },

    async fetchSampleHeader(sampleNumber: number): Promise<SampleHeader> {
      const cached = sampleHeaderCache.get(sampleNumber);
      if (cached) return cached;

      const response = await sendCommandWithRetry(
        AkaiOpcode.RSDATA,
        byte2nibblesLE(sampleNumber),
      );
      const header = parseSampleFromResponse(response);
      sampleHeaderCache.set(sampleNumber, header);
      return header;
    },

    async fetchKeygroupHeader(
      programNumber: number,
      keygroupNumber: number,
    ): Promise<KeygroupHeader> {
      const cacheKey = `${programNumber}:${keygroupNumber}`;
      const cached = keygroupHeaderCache.get(cacheKey);
      if (cached) return cached;

      const response = await sendCommandWithRetry(
        AkaiOpcode.RKDATA,
        byte2nibblesLE(programNumber).concat(keygroupNumber),
      );
      const header = parseKeygroupFromResponse(response);
      keygroupHeaderCache.set(cacheKey, header);
      return header;
    },

    async writeProgramHeader(header: ProgramHeader): Promise<void> {
      const key = `program:${header.PRNAME}`;
      await bufferWrite(key, AkaiOpcode.PDATA, header.raw);
    },

    async writeKeygroupHeader(header: KeygroupHeader): Promise<void> {
      const key = `keygroup:${header.raw?.slice(0, 8).join(',')}`;
      await bufferWrite(key, AkaiOpcode.KDATA, header.raw);
    },

    async writeSampleHeader(header: SampleHeader): Promise<void> {
      const key = `sample:${header.SHNAME}`;
      await bufferWrite(key, AkaiOpcode.SDATA, header.raw);
    },

    invalidateProgramCache(): void {
      programNamesCache = undefined;
      programHeaderCache.clear();
    },

    invalidateSampleCache(): void {
      sampleNamesCache = undefined;
      sampleHeaderCache.clear();
    },

    invalidateKeygroupCache(): void {
      keygroupHeaderCache.clear();
    },

    panic(): void {
      programNamesCache = undefined;
      sampleNamesCache = undefined;
      programHeaderCache.clear();
      sampleHeaderCache.clear();
      keygroupHeaderCache.clear();
      writeBuffer.clear();
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushPromise = null;
      requestQueue = Promise.resolve();
    },

    async sendCommand(opcode: number, data: number[]): Promise<number[]> {
      const response = await sendCommandWithRetry(opcode, data);
      const parsed = parseAkaiResponse(response);
      return parsed.data;
    },
  };

  return client;
}
