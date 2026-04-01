/**
 * Unit tests for SDS sender and receiver state machines.
 *
 * Uses a mock MidiIO injected via constructor to avoid module stubbing.
 */

import { describe, it, expect, vi } from 'vitest';

import type { MidiIO } from '../../types';
import type { SdsDumpHeader, SdsTransferProgress } from '../sds-types';
import { LOOP_OFF } from '../sds-constants';
import {
  buildAck,
  buildNak,
  buildCancel,
  buildWait,
  buildDumpHeader,
  buildDataPacket,
} from '../sds-messages';
import { samplesToPackets } from '../sds-encoding';
import { createSdsSender } from '../sds-sender';
import { createSdsReceiver } from '../sds-receiver';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockMidiIO() {
  const listeners: ((msg: number[]) => void)[] = [];
  const sent: number[][] = [];

  const midiIO: MidiIO = {
    send: (msg) => {
      sent.push(msg);
    },
    onSysEx: (cb) => {
      listeners.push(cb);
    },
    removeSysExListener: (cb) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };

  /** Simulate a message arriving from the remote device. */
  function receive(msg: number[]) {
    for (const cb of [...listeners]) cb(msg);
  }

  return { midiIO, sent, receive, listeners };
}

const CHANNEL = 0;

function makeTestHeader(sampleLength = 40): SdsDumpHeader {
  return {
    sampleNumber: 1,
    sampleFormat: 16,
    samplePeriodNs: 22676,
    sampleLength,
    loopStart: 0,
    loopEnd: 0,
    loopType: LOOP_OFF,
  };
}

/** Build a small 16-bit sample buffer with deterministic values. */
function makeTestSamples(length = 40): Int16Array {
  const samples = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = (i * 137) & 0xffff; // arbitrary deterministic values
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Sender tests
// ---------------------------------------------------------------------------

describe('createSdsSender', () => {
  describe('open-loop mode', () => {
    it('sends header then all packets without waiting for ACKs', async () => {
      const { midiIO, sent } = createMockMidiIO();
      const header = makeTestHeader();
      const samples = makeTestSamples();
      const expectedPackets = samplesToPackets(samples, header.sampleFormat);

      const sender = createSdsSender(midiIO, {
        channel: CHANNEL,
        header,
        samples,
        mode: 'open-loop',
      });

      await sender.start();

      // First message should be the dump header
      expect(sent[0]).toEqual(buildDumpHeader(CHANNEL, header));

      // Remaining messages should be data packets (one packet for 40 x 16-bit)
      expect(sent.length).toBe(1 + expectedPackets.length);

      for (let i = 0; i < expectedPackets.length; i++) {
        const packetNumber = i % 128;
        expect(sent[i + 1]).toEqual(
          buildDataPacket(CHANNEL, packetNumber, expectedPackets[i]!),
        );
      }
    });

    it('calls onProgress for each packet', async () => {
      const { midiIO } = createMockMidiIO();
      const header = makeTestHeader();
      const samples = makeTestSamples();
      const progressCalls: SdsTransferProgress[] = [];

      const sender = createSdsSender(midiIO, {
        channel: CHANNEL,
        header,
        samples,
        mode: 'open-loop',
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      await sender.start();

      const expectedPacketCount = samplesToPackets(
        samples,
        header.sampleFormat,
      ).length;
      expect(progressCalls.length).toBe(expectedPacketCount);

      // Final progress should report all packets sent
      const last = progressCalls[progressCalls.length - 1]!;
      expect(last.packetsSent).toBe(expectedPacketCount);
      expect(last.packetsTotal).toBe(expectedPacketCount);
    });

    it('rejects when cancel() is called before start completes', async () => {
      const { midiIO } = createMockMidiIO();
      // Use enough samples that we can cancel mid-stream
      const header = makeTestHeader(1000);
      const samples = makeTestSamples(1000);

      const sender = createSdsSender(midiIO, {
        channel: CHANNEL,
        header,
        samples,
        mode: 'open-loop',
      });

      // cancel() immediately — open-loop is synchronous in the promise body
      // so for a truly async cancel we test closed-loop below. Here we verify
      // the cancel path exists and sets the flag.
      sender.cancel();

      await expect(sender.start()).rejects.toThrow('cancelled by sender');
    });
  });

  describe('closed-loop mode', () => {
    it('sends header, waits for ACK, then sends packets', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO, sent, receive } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();
        const expectedPackets = samplesToPackets(samples, header.sampleFormat);

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
        });

        const done = sender.start();

        // Header should be sent immediately
        expect(sent.length).toBe(1);
        expect(sent[0]).toEqual(buildDumpHeader(CHANNEL, header));

        // ACK the header
        receive(buildAck(CHANNEL, 0));

        // First data packet should now be sent
        expect(sent.length).toBe(2);
        expect(sent[1]).toEqual(
          buildDataPacket(CHANNEL, 0, expectedPackets[0]!),
        );

        // ACK the data packet
        receive(buildAck(CHANNEL, 0));

        // Transfer should complete (only 1 packet for 40 samples at 16-bit)
        await done;
      } finally {
        vi.useRealTimers();
      }
    });

    it('retransmits packet on NAK', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO, sent, receive } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();
        const expectedPackets = samplesToPackets(samples, header.sampleFormat);

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
        });

        const done = sender.start();

        // ACK the header
        receive(buildAck(CHANNEL, 0));

        // Record how many messages before NAK
        const countBeforeNak = sent.length;

        // NAK the data packet
        receive(buildNak(CHANNEL, 0));

        // Packet should be retransmitted
        expect(sent.length).toBe(countBeforeNak + 1);
        expect(sent[sent.length - 1]).toEqual(
          buildDataPacket(CHANNEL, 0, expectedPackets[0]!),
        );

        // ACK it this time to finish
        receive(buildAck(CHANNEL, 0));
        await done;
      } finally {
        vi.useRealTimers();
      }
    });

    it('aborts on CANCEL from receiver', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO, receive } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
        });

        const done = sender.start();

        // ACK the header
        receive(buildAck(CHANNEL, 0));

        // Receiver sends CANCEL
        receive(buildCancel(CHANNEL, 0));

        await expect(done).rejects.toThrow('cancelled by receiver');
      } finally {
        vi.useRealTimers();
      }
    });

    it('handles WAIT then resumes on ACK', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO, sent, receive } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
        });

        const done = sender.start();

        // ACK the header
        receive(buildAck(CHANNEL, 0));
        const countAfterFirstPacket = sent.length;

        // Receiver sends WAIT — no new packet should be sent
        receive(buildWait(CHANNEL, 0));
        expect(sent.length).toBe(countAfterFirstPacket);

        // Now ACK to resume
        receive(buildAck(CHANNEL, 0));

        // Transfer should complete
        await done;
      } finally {
        vi.useRealTimers();
      }
    });

    it('cancel() aborts in-progress closed-loop transfer', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
        });

        const done = sender.start();

        // Header sent, waiting for ACK — cancel before ACK arrives
        sender.cancel();

        await expect(done).rejects.toThrow('cancelled by sender');
      } finally {
        vi.useRealTimers();
      }
    });

    it('calls onProgress after each ACKed packet', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO, receive } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();
        const progressCalls: SdsTransferProgress[] = [];

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
          onProgress: (p) => progressCalls.push({ ...p }),
        });

        const done = sender.start();

        // ACK header
        receive(buildAck(CHANNEL, 0));

        // ACK the data packet
        receive(buildAck(CHANNEL, 0));

        await done;

        expect(progressCalls.length).toBeGreaterThanOrEqual(1);
        const last = progressCalls[progressCalls.length - 1]!;
        expect(last.packetsSent).toBe(last.packetsTotal);
      } finally {
        vi.useRealTimers();
      }
    });

    it('times out and retries when no response arrives', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO, sent } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
          ackTimeoutMs: 500,
          maxRetries: 2,
        });

        // Capture the rejection early to avoid unhandled promise warnings
        let rejection: Error | undefined;
        const done = sender.start().catch((e: Error) => { rejection = e; });

        // Header sent once
        expect(sent.length).toBe(1);

        // Advance past timeout — header should be resent
        await vi.advanceTimersByTimeAsync(500);
        expect(sent.length).toBe(2);
        expect(sent[1]).toEqual(buildDumpHeader(CHANNEL, header));

        // Advance past second timeout — another retry
        await vi.advanceTimersByTimeAsync(500);
        expect(sent.length).toBe(3);

        // Advance past third timeout — exceeds maxRetries, should fail
        await vi.advanceTimersByTimeAsync(500);
        await done;

        expect(rejection).toBeDefined();
        expect(rejection!.message).toContain('no response after 2 retries');
      } finally {
        vi.useRealTimers();
      }
    });

    it('aborts on CANCEL during header handshake', async () => {
      vi.useFakeTimers();
      try {
        const { midiIO, receive } = createMockMidiIO();
        const header = makeTestHeader();
        const samples = makeTestSamples();

        const sender = createSdsSender(midiIO, {
          channel: CHANNEL,
          header,
          samples,
          mode: 'closed-loop',
        });

        const done = sender.start();

        // Receiver sends CANCEL before ACK
        receive(buildCancel(CHANNEL, 0));

        await expect(done).rejects.toThrow('cancelled by receiver');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Receiver tests
// ---------------------------------------------------------------------------

describe('createSdsReceiver', () => {
  it('collects header and packets, then calls onComplete', () => {
    const { midiIO, sent, receive } = createMockMidiIO();
    const header = makeTestHeader();
    const samples = makeTestSamples();
    const packets = samplesToPackets(samples, header.sampleFormat);

    let receivedHeader: SdsDumpHeader | undefined;
    let completedSamples: Int16Array | Int32Array | undefined;

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
      onHeader: (h) => {
        receivedHeader = h;
      },
      onComplete: (s) => {
        completedSamples = s;
      },
    });

    receiver.start();

    // Send the dump header
    receive(buildDumpHeader(CHANNEL, header));

    // Receiver should ACK the header
    expect(sent.length).toBe(1);
    expect(sent[0]).toEqual(buildAck(CHANNEL, 0));

    // onHeader should have been called
    expect(receivedHeader).toBeDefined();
    expect(receivedHeader!.sampleNumber).toBe(header.sampleNumber);
    expect(receivedHeader!.sampleFormat).toBe(header.sampleFormat);
    expect(receivedHeader!.sampleLength).toBe(header.sampleLength);

    // Send all data packets
    for (let i = 0; i < packets.length; i++) {
      const packetNumber = i % 128;
      receive(buildDataPacket(CHANNEL, packetNumber, packets[i]!));
    }

    // Receiver should ACK each packet
    // sent[0] = header ACK, then one ACK per data packet
    expect(sent.length).toBe(1 + packets.length);

    // onComplete should have been called with decoded samples
    expect(completedSamples).toBeDefined();
    expect(completedSamples!.length).toBe(samples.length);

    // Verify round-trip fidelity: the received samples match the originals.
    // Because SDS encoding is left-justified 7-bit, we compare via
    // re-encoding: encode originals, decode, and compare.
    for (let i = 0; i < samples.length; i++) {
      expect(completedSamples![i]).toBe(samples[i]);
    }
  });

  it('sends NAK for a data packet with bad checksum', () => {
    const { midiIO, sent, receive } = createMockMidiIO();
    const header = makeTestHeader();
    const samples = makeTestSamples();
    const packets = samplesToPackets(samples, header.sampleFormat);

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
    });

    receiver.start();

    // Send header
    receive(buildDumpHeader(CHANNEL, header));
    expect(sent.length).toBe(1); // header ACK

    // Build a valid data packet, then corrupt its checksum
    const validPacket = buildDataPacket(CHANNEL, 0, packets[0]!);
    const corruptedPacket = [...validPacket];
    // The checksum is the second-to-last byte (before F7)
    const checksumIndex = corruptedPacket.length - 2;
    corruptedPacket[checksumIndex] =
      (corruptedPacket[checksumIndex]! ^ 0x7f) & 0x7f;

    receive(corruptedPacket);

    // Should have sent a NAK, not an ACK
    expect(sent.length).toBe(2);
    expect(sent[1]).toEqual(buildNak(CHANNEL, 0));
  });

  it('sends NAK for out-of-order packet', () => {
    const { midiIO, sent, receive } = createMockMidiIO();
    const header = makeTestHeader();
    const samples = makeTestSamples();
    const packets = samplesToPackets(samples, header.sampleFormat);

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
    });

    receiver.start();

    // Send header
    receive(buildDumpHeader(CHANNEL, header));
    expect(sent.length).toBe(1); // header ACK

    // Send packet 1 (expecting packet 0)
    receive(buildDataPacket(CHANNEL, 1, packets[0]!));

    // Should NAK with expected packet number 0
    expect(sent.length).toBe(2);
    expect(sent[1]).toEqual(buildNak(CHANNEL, 0));
  });

  it('calls onProgress after each received packet', () => {
    const { midiIO, receive } = createMockMidiIO();
    const header = makeTestHeader();
    const samples = makeTestSamples();
    const packets = samplesToPackets(samples, header.sampleFormat);
    const progressCalls: SdsTransferProgress[] = [];

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
      onProgress: (p) => progressCalls.push({ ...p }),
    });

    receiver.start();

    // Send header
    receive(buildDumpHeader(CHANNEL, header));

    // Send all data packets
    for (let i = 0; i < packets.length; i++) {
      receive(buildDataPacket(CHANNEL, i % 128, packets[i]!));
    }

    expect(progressCalls.length).toBe(packets.length);

    const last = progressCalls[progressCalls.length - 1]!;
    expect(last.packetsSent).toBe(packets.length);
    expect(last.packetsTotal).toBe(packets.length);
  });

  it('cancel() sends CANCEL and removes listener', () => {
    const { midiIO, sent, listeners } = createMockMidiIO();

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
    });

    receiver.start();
    expect(listeners.length).toBe(1);

    receiver.cancel();

    // Should send a CANCEL message
    expect(sent.length).toBe(1);
    expect(sent[0]).toEqual(buildCancel(CHANNEL, 0));

    // Listener should be removed
    expect(listeners.length).toBe(0);
  });

  it('ignores messages on a different channel', () => {
    const { midiIO, sent, receive } = createMockMidiIO();
    const header = makeTestHeader();
    const otherChannel = 5;

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
    });

    receiver.start();

    // Send header on a different channel
    receive(buildDumpHeader(otherChannel, header));

    // No ACK should be sent — receiver ignores the message
    expect(sent.length).toBe(0);
  });

  it('throws if start() is called while already active', () => {
    const { midiIO } = createMockMidiIO();

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
    });

    receiver.start();

    expect(() => receiver.start()).toThrow('already active');
  });

  it('calls onError when onComplete throws', () => {
    const { midiIO, receive } = createMockMidiIO();
    const header = makeTestHeader(40);
    const errors: Error[] = [];

    const receiver = createSdsReceiver(midiIO, {
      channel: CHANNEL,
      onError: (e) => errors.push(e),
      onComplete: () => {
        throw new Error('onComplete blew up');
      },
    });

    receiver.start();

    receive(buildDumpHeader(CHANNEL, header));

    const validSamples = makeTestSamples(40);
    const packets = samplesToPackets(validSamples, 16);
    for (let i = 0; i < packets.length; i++) {
      receive(buildDataPacket(CHANNEL, i % 128, packets[i]!));
    }

    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toContain('onComplete blew up');
  });
});
