import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MidiIO } from '@audiocontrol/shared-midi';
import { createS3000xlClient } from '@/devices/s3000xl/s3000xl-client.js';
import {
  AkaiOpcode,
  AKAI_MANUFACTURER_ID,
  S3000XL_DEVICE_ID,
  SYSEX_START,
  SYSEX_END,
} from '@/devices/s3000xl/s3000xl-protocol.js';

/**
 * Test implementation of MidiIO that captures sent messages
 * and allows programmatic response injection.
 */
function createTestMidiIO() {
  let sysExListener: ((message: number[]) => void) | null = null;
  const sentMessages: number[][] = [];

  const midiIO: MidiIO = {
    send(message: number[]) {
      sentMessages.push([...message]);
    },
    onSysEx(callback: (message: number[]) => void) {
      sysExListener = callback;
    },
    removeSysExListener() {
      sysExListener = null;
    },
  };

  return {
    midiIO,
    sentMessages,
    /** Simulate a response from the device */
    respond(response: number[]) {
      if (sysExListener) {
        sysExListener(response);
      }
    },
    /** Build a standard Akai response message */
    buildResponse(opcode: AkaiOpcode, data: number[] = []): number[] {
      return [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, opcode, S3000XL_DEVICE_ID, ...data, SYSEX_END];
    },
  };
}

/**
 * Auto-respond to sent messages with a response builder.
 * Intercepts send() to trigger a response after a microtask.
 */
function autoRespond(
  testIO: ReturnType<typeof createTestMidiIO>,
  responseBuilder: (sentMessage: number[]) => number[],
) {
  const originalSend = testIO.midiIO.send.bind(testIO.midiIO);
  testIO.midiIO.send = (message: number[]) => {
    originalSend(message);
    // Respond asynchronously (like real hardware would)
    queueMicrotask(() => {
      testIO.respond(responseBuilder(message));
    });
  };
}

describe('createS3000xlClient', () => {
  let testIO: ReturnType<typeof createTestMidiIO>;

  beforeEach(() => {
    testIO = createTestMidiIO();
  });

  it('returns an object with all expected interface methods', () => {
    const client = createS3000xlClient(testIO.midiIO);
    expect(client.fetchProgramNames).toBeTypeOf('function');
    expect(client.fetchSampleNames).toBeTypeOf('function');
    expect(client.fetchProgramHeader).toBeTypeOf('function');
    expect(client.fetchSampleHeader).toBeTypeOf('function');
    expect(client.fetchKeygroupHeader).toBeTypeOf('function');
    expect(client.writeProgramHeader).toBeTypeOf('function');
    expect(client.writeKeygroupHeader).toBeTypeOf('function');
    expect(client.writeSampleHeader).toBeTypeOf('function');
    expect(client.invalidateProgramCache).toBeTypeOf('function');
    expect(client.invalidateSampleCache).toBeTypeOf('function');
    expect(client.invalidateKeygroupCache).toBeTypeOf('function');
    expect(client.panic).toBeTypeOf('function');
    expect(client.sendCommand).toBeTypeOf('function');
  });

  describe('fetchProgramNames', () => {
    it('sends RPLIST opcode and parses response', async () => {
      const client = createS3000xlClient(testIO.midiIO, { writeFlushDelayMs: 0 });

      // Build a PLIST response with 1 program name
      const count = [0x01, 0x00];
      const nameBytes = [11, 12, 13, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // "ABC"
      const response = testIO.buildResponse(AkaiOpcode.PLIST, [...count, ...nameBytes]);

      autoRespond(testIO, () => response);

      const names = await client.fetchProgramNames();
      expect(names).toHaveLength(1);
      expect(names[0].trim()).toBe('ABC');

      // Verify the sent message used RPLIST opcode
      expect(testIO.sentMessages).toHaveLength(1);
      expect(testIO.sentMessages[0][3]).toBe(AkaiOpcode.RPLIST);
    });

    it('caches results on second call', async () => {
      const client = createS3000xlClient(testIO.midiIO, { writeFlushDelayMs: 0 });

      const count = [0x01, 0x00];
      const nameBytes = [11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      autoRespond(testIO, () => testIO.buildResponse(AkaiOpcode.PLIST, [...count, ...nameBytes]));

      await client.fetchProgramNames();
      const names2 = await client.fetchProgramNames();

      // Should only have sent one SysEx message (second call used cache)
      expect(testIO.sentMessages).toHaveLength(1);
      expect(names2).toHaveLength(1);
    });

    it('re-fetches after invalidation', async () => {
      const client = createS3000xlClient(testIO.midiIO, { writeFlushDelayMs: 0 });

      const count = [0x01, 0x00];
      const nameBytes = [11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      autoRespond(testIO, () => testIO.buildResponse(AkaiOpcode.PLIST, [...count, ...nameBytes]));

      await client.fetchProgramNames();
      client.invalidateProgramCache();
      await client.fetchProgramNames();

      expect(testIO.sentMessages).toHaveLength(2);
    });
  });

  describe('fetchSampleNames', () => {
    it('sends RSLIST opcode and parses response', async () => {
      const client = createS3000xlClient(testIO.midiIO, { writeFlushDelayMs: 0 });

      const count = [0x02, 0x00];
      const name1 = [11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      const name2 = [12, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      autoRespond(testIO, () => testIO.buildResponse(AkaiOpcode.SLIST, [...count, ...name1, ...name2]));

      const names = await client.fetchSampleNames();
      expect(names).toHaveLength(2);
      expect(testIO.sentMessages[0][3]).toBe(AkaiOpcode.RSLIST);
    });
  });

  describe('error handling', () => {
    it('throws on REPLY (error) response', async () => {
      const client = createS3000xlClient(testIO.midiIO, {
        writeFlushDelayMs: 0,
        maxRetries: 0,
      });

      autoRespond(testIO, () => testIO.buildResponse(AkaiOpcode.REPLY, [0x03]));

      await expect(client.fetchProgramNames()).rejects.toThrow('S3000XL error response');
    });

    it('throws on timeout when no response received', async () => {
      const client = createS3000xlClient(testIO.midiIO, {
        timeoutMs: 50,
        writeFlushDelayMs: 0,
        maxRetries: 0,
      });

      // Don't auto-respond — will timeout
      await expect(client.fetchProgramNames()).rejects.toThrow('S3000XL response timeout');
    }, 10000);
  });

  describe('panic', () => {
    it('clears all caches and resets state', async () => {
      const client = createS3000xlClient(testIO.midiIO, { writeFlushDelayMs: 0 });

      const count = [0x01, 0x00];
      const nameBytes = [11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      autoRespond(testIO, () => testIO.buildResponse(AkaiOpcode.PLIST, [...count, ...nameBytes]));

      await client.fetchProgramNames();
      expect(testIO.sentMessages).toHaveLength(1);

      client.panic();

      // After panic, cache is cleared — next fetch sends a new SysEx
      await client.fetchProgramNames();
      expect(testIO.sentMessages).toHaveLength(2);
    });
  });

  describe('serialization', () => {
    it('serializes concurrent requests', async () => {
      const client = createS3000xlClient(testIO.midiIO, {
        writeFlushDelayMs: 0,
        maxRetries: 0,
      });

      const count = [0x01, 0x00];
      const nameBytes = [11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];

      autoRespond(testIO, (msg) => {
        const opcode = msg[3];
        if (opcode === AkaiOpcode.RPLIST) {
          return testIO.buildResponse(AkaiOpcode.PLIST, [...count, ...nameBytes]);
        }
        return testIO.buildResponse(AkaiOpcode.SLIST, [...count, ...nameBytes]);
      });

      // Fire both concurrently
      const [programs, samples] = await Promise.all([
        client.fetchProgramNames(),
        client.fetchSampleNames(),
      ]);

      expect(programs).toHaveLength(1);
      expect(samples).toHaveLength(1);
      // Both requests completed successfully (serialized, no conflicts)
      expect(testIO.sentMessages).toHaveLength(2);
    });
  });
});
