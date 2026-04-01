/**
 * MIDI Sample Dump Standard (SDS) transfer state machines.
 *
 * Re-exports the sender and receiver factories, and provides the
 * requestSample convenience function that combines a dump request
 * with an auto-started receiver.
 */

import type { SdsReceiverOptions } from './sds-types';
import { buildDumpRequest } from './sds-messages';
import type { MidiIO } from '../types';

import { createSdsReceiver } from './sds-receiver';
import type { SdsReceiver } from './sds-receiver';

// Re-export sender and receiver factories and their interfaces
export { createSdsSender } from './sds-sender';
export type { SdsSender } from './sds-sender';
export { createSdsReceiver } from './sds-receiver';
export type { SdsReceiver } from './sds-receiver';

// ---------------------------------------------------------------------------
// Dump request convenience
// ---------------------------------------------------------------------------

interface SdsRequestResult {
  receiver: SdsReceiver;
}

/**
 * Send a Dump Request and return a receiver ready to collect the response.
 *
 * Sends the SDS dump request message immediately, then creates and starts
 * a receiver that listens for the incoming dump header and data packets.
 */
export function requestSample(
  midiOut: MidiIO,
  channel: number,
  sampleNumber: number,
  options: SdsReceiverOptions,
): SdsRequestResult {
  midiOut.send(buildDumpRequest(channel, sampleNumber));

  const receiver = createSdsReceiver(midiOut, options);
  receiver.start();

  return { receiver };
}
