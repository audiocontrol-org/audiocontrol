/**
 * SDS sample receiver — listens for incoming dump headers and data packets,
 * validates checksums, sends ACK/NAK handshakes, and decodes the final
 * sample data.
 */

import { PACKET_COUNTER_MAX } from './sds-constants';

import type {
  SdsDumpHeader,
  SdsReceiverOptions,
  SdsMessage,
} from './sds-types';

import {
  buildAck,
  buildNak,
  buildCancel,
  validateChecksum,
} from './sds-messages';

import {
  packetsToSamples,
  calculatePacketCount,
} from './sds-encoding';

import type { MidiIO } from '../types';

import { tryParseSds } from './sds-transfer-util';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SdsReceiver {
  start(): void;
  cancel(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an SDS sample receiver.
 *
 * Listens for an incoming dump header, then collects data packets,
 * validating checksums and sending ACK/NAK handshakes. When all
 * packets are received, decodes and delivers the sample data.
 */
export function createSdsReceiver(
  midiIn: MidiIO,
  options: SdsReceiverOptions,
): SdsReceiver {
  const { channel, onHeader, onProgress, onComplete, onError } = options;

  let active = false;
  let receivedHeader: SdsDumpHeader | undefined;
  let receivedPackets: Uint8Array[] = [];
  let expectedPacketCount = 0;
  let packetsReceived = 0;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  function cleanup(): void {
    active = false;
    midiIn.removeSysExListener(listener);
  }

  function fail(error: Error): void {
    cleanup();
    if (onError) {
      onError(error);
    }
  }

  // -------------------------------------------------------------------------
  // SysEx listener
  // -------------------------------------------------------------------------

  function listener(data: number[]): void {
    if (!active) return;

    const msg = tryParseSds(data);
    if (!msg) return;
    if (msg.channel !== channel) return;

    if (!receivedHeader) {
      handleHeader(msg);
      return;
    }

    handleDataPacket(msg);
  }

  // -------------------------------------------------------------------------
  // Header handling
  // -------------------------------------------------------------------------

  function handleHeader(msg: SdsMessage): void {
    if (msg.type !== 'dump-header') return;

    receivedHeader = msg.header;
    expectedPacketCount = calculatePacketCount(
      msg.header.sampleLength,
      msg.header.sampleFormat,
    );
    receivedPackets = new Array(expectedPacketCount);
    packetsReceived = 0;

    if (onHeader) {
      onHeader(msg.header);
    }

    // ACK the header (packet number 0)
    midiIn.send(buildAck(channel, 0));
  }

  // -------------------------------------------------------------------------
  // Data packet handling
  // -------------------------------------------------------------------------

  function handleDataPacket(msg: SdsMessage): void {
    if (msg.type !== 'data-packet') return;

    const { packet } = msg;

    // Validate checksum
    if (!validateChecksum(packet, channel)) {
      midiIn.send(buildNak(channel, packet.packetNumber));
      return;
    }

    // Verify expected packet counter (wraps at PACKET_COUNTER_MAX)
    const expectedCounter = packetsReceived % PACKET_COUNTER_MAX;
    if (packet.packetNumber !== expectedCounter) {
      midiIn.send(buildNak(channel, expectedCounter));
      return;
    }

    // Store and acknowledge
    receivedPackets[packetsReceived] = packet.data;
    packetsReceived++;
    midiIn.send(buildAck(channel, packet.packetNumber));

    // Report progress
    if (onProgress && receivedHeader) {
      const totalBytes =
        receivedHeader.sampleLength *
        Math.ceil(receivedHeader.sampleFormat / 7);
      onProgress({
        packetsSent: packetsReceived,
        packetsTotal: expectedPacketCount,
        bytesSent: Math.min(packetsReceived * 120, totalBytes),
        bytesTotal: totalBytes,
      });
    }

    // Check completion
    if (packetsReceived >= expectedPacketCount && receivedHeader) {
      finishTransfer();
    }
  }

  // -------------------------------------------------------------------------
  // Transfer completion
  // -------------------------------------------------------------------------

  function finishTransfer(): void {
    if (!receivedHeader) {
      fail(new Error('Cannot finish transfer: no header received'));
      return;
    }

    cleanup();

    try {
      const samples = packetsToSamples(
        receivedPackets,
        receivedHeader.sampleFormat,
        receivedHeader.sampleLength,
      );

      if (onComplete) {
        onComplete(samples);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error decoding sample data';
      if (onError) {
        onError(new Error(`Failed to decode received sample data: ${message}`));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  function start(): void {
    if (active) {
      throw new Error('Receiver is already active');
    }
    active = true;
    receivedHeader = undefined;
    receivedPackets = [];
    expectedPacketCount = 0;
    packetsReceived = 0;
    midiIn.onSysEx(listener);
  }

  function cancel(): void {
    if (!active) return;

    const packetNumber = packetsReceived % PACKET_COUNTER_MAX;
    midiIn.send(buildCancel(channel, packetNumber));
    cleanup();
  }

  return { start, cancel };
}
