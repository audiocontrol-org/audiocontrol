/**
 * SDS sample sender — open-loop and closed-loop transfer modes.
 *
 * Open-loop: sends all packets without waiting for handshake responses.
 * Closed-loop: waits for ACK/NAK/WAIT/CANCEL after each packet, with
 * timeout and retry logic.
 */

import {
  PACKET_COUNTER_MAX,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
} from './sds-constants';

import type {
  SdsSenderOptions,
  SdsMessage,
} from './sds-types';

import {
  buildDumpHeader,
  buildDataPacket,
} from './sds-messages';

import { samplesToPackets } from './sds-encoding';

import type { MidiIO } from '../types';

import { makeProgress, tryParseSds } from './sds-transfer-util';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SdsSender {
  start(): Promise<void>;
  cancel(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create an SDS sample sender.
 *
 * In open-loop mode, packets are sent sequentially without waiting for
 * responses. In closed-loop mode, the sender waits for ACK/NAK/WAIT/CANCEL
 * after each packet.
 */
export function createSdsSender(
  midiOut: MidiIO,
  options: SdsSenderOptions,
): SdsSender {
  const {
    channel,
    header,
    samples,
    mode,
    onProgress,
    ackTimeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  let cancelled = false;
  let rejectTransfer: ((error: Error) => void) | undefined;

  function cancel(): void {
    cancelled = true;
    if (rejectTransfer) {
      rejectTransfer(new Error('Transfer cancelled by sender'));
    }
  }

  function start(): Promise<void> {
    const packets = samplesToPackets(samples, header.sampleFormat);
    const totalPackets = packets.length;
    const totalBytes = samples.length * Math.ceil(header.sampleFormat / 7);

    if (mode === 'open-loop') {
      return sendOpenLoop(packets, totalPackets, totalBytes);
    }
    return sendClosedLoop(packets, totalPackets, totalBytes);
  }

  // -------------------------------------------------------------------------
  // Open-loop
  // -------------------------------------------------------------------------

  function sendOpenLoop(
    packets: Uint8Array[],
    totalPackets: number,
    totalBytes: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      rejectTransfer = reject;

      midiOut.send(buildDumpHeader(channel, header));

      // Loop bounds guarantee i < packets.length, so indices are safe.
      for (let i = 0; i < packets.length; i++) {
        if (cancelled) {
          reject(new Error('Transfer cancelled by sender'));
          return;
        }

        const packetNumber = i % PACKET_COUNTER_MAX;
        midiOut.send(buildDataPacket(channel, packetNumber, packets[i]!));

        if (onProgress) {
          onProgress(makeProgress(i, totalPackets, 120, totalBytes));
        }
      }

      rejectTransfer = undefined;
      resolve();
    });
  }

  // -------------------------------------------------------------------------
  // Closed-loop
  // -------------------------------------------------------------------------

  function sendClosedLoop(
    packets: Uint8Array[],
    totalPackets: number,
    totalBytes: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      rejectTransfer = reject;

      let currentPacket = 0;
      let retryCount = 0;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let waitingForHeaderAck = true;

      function cleanup(): void {
        midiOut.removeSysExListener(listener);
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        rejectTransfer = undefined;
      }

      function fail(error: Error): void {
        cleanup();
        reject(error);
      }

      function succeed(): void {
        cleanup();
        resolve();
      }

      function startTimeout(): void {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          timeoutId = undefined;
          handleTimeout();
        }, ackTimeoutMs);
      }

      function handleTimeout(): void {
        if (cancelled) {
          fail(new Error('Transfer cancelled by sender'));
          return;
        }

        retryCount++;
        if (retryCount > maxRetries) {
          fail(
            new Error(
              `Transfer failed: no response after ${maxRetries} retries ` +
                `(packet ${currentPacket})`,
            ),
          );
          return;
        }

        if (waitingForHeaderAck) {
          midiOut.send(buildDumpHeader(channel, header));
          startTimeout();
          return;
        }

        sendCurrentPacket();
      }

      function sendCurrentPacket(): void {
        const packetNumber = currentPacket % PACKET_COUNTER_MAX;
        // currentPacket is always < totalPackets when this is called, so the index is safe.
        midiOut.send(
          buildDataPacket(channel, packetNumber, packets[currentPacket]!),
        );
        startTimeout();
      }

      function listener(data: number[]): void {
        const msg = tryParseSds(data);
        if (!msg) return;
        if (msg.channel !== channel) return;

        if (cancelled) {
          fail(new Error('Transfer cancelled by sender'));
          return;
        }

        if (waitingForHeaderAck) {
          handleHeaderResponse(msg);
          return;
        }

        handlePacketResponse(msg);
      }

      function handleHeaderResponse(msg: SdsMessage): void {
        switch (msg.type) {
          case 'ack':
            waitingForHeaderAck = false;
            clearActiveTimeout();
            if (totalPackets === 0) {
              succeed();
              return;
            }
            retryCount = 0;
            sendCurrentPacket();
            break;
          case 'nak':
            retryCount++;
            if (retryCount > maxRetries) {
              fail(
                new Error(
                  `Transfer failed: dump header NAKed after ${maxRetries} retries`,
                ),
              );
              return;
            }
            clearActiveTimeout();
            midiOut.send(buildDumpHeader(channel, header));
            startTimeout();
            break;
          case 'cancel':
            fail(new Error('Transfer cancelled by receiver'));
            break;
          case 'wait':
            clearActiveTimeout();
            startTimeout();
            break;
          default:
            break;
        }
      }

      function handlePacketResponse(msg: SdsMessage): void {
        switch (msg.type) {
          case 'ack': {
            clearActiveTimeout();

            if (onProgress) {
              onProgress(
                makeProgress(currentPacket, totalPackets, 120, totalBytes),
              );
            }

            currentPacket++;
            retryCount = 0;

            if (currentPacket >= totalPackets) {
              succeed();
              return;
            }

            sendCurrentPacket();
            break;
          }
          case 'nak': {
            clearActiveTimeout();

            retryCount++;
            if (retryCount > maxRetries) {
              fail(
                new Error(
                  `Transfer failed: packet ${currentPacket} NAKed after ` +
                    `${maxRetries} retries`,
                ),
              );
              return;
            }

            sendCurrentPacket();
            break;
          }
          case 'wait': {
            clearActiveTimeout();
            startTimeout();
            break;
          }
          case 'cancel':
            fail(new Error('Transfer cancelled by receiver'));
            break;
          default:
            break;
        }
      }

      function clearActiveTimeout(): void {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      }

      // Kick off: register listener, send dump header, start timeout
      midiOut.onSysEx(listener);
      midiOut.send(buildDumpHeader(channel, header));
      startTimeout();
    });
  }

  return { start, cancel };
}
