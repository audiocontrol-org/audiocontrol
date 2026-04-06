/**
 * Shared utilities for SDS transfer state machines.
 */

import type { SdsTransferProgress, SdsMessage } from './sds-types';
import { parseSdsMessage } from './sds-messages';

/**
 * Build a progress report for a packet-based transfer.
 */
export function makeProgress(
  packetIndex: number,
  totalPackets: number,
  bytesPerPacket: number,
  totalBytes: number,
): SdsTransferProgress {
  const packetsSent = packetIndex + 1;
  return {
    packetsSent,
    packetsTotal: totalPackets,
    bytesSent: Math.min(packetsSent * bytesPerPacket, totalBytes),
    bytesTotal: totalBytes,
  };
}

/**
 * Try to parse a SysEx message as an SDS message, returning undefined
 * if it fails (the message is not an SDS message we recognize).
 */
export function tryParseSds(data: number[]): SdsMessage | undefined {
  try {
    return parseSdsMessage(data);
  } catch {
    return undefined;
  }
}
