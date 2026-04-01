/**
 * TypeScript types for the MIDI Sample Dump Standard (SDS) protocol.
 *
 * All types model the on-the-wire SDS message structures and the
 * higher-level transfer options used by senders and receivers.
 */

// ---------------------------------------------------------------------------
// Loop type
// ---------------------------------------------------------------------------

/** SDS loop type: forward (0x00), forward-backward (0x01), or off (0x7F). */
export type SdsLoopType = 0x00 | 0x01 | 0x7f;

// ---------------------------------------------------------------------------
// Message payloads
// ---------------------------------------------------------------------------

/** Dump Header -- sample metadata transmitted before data packets. */
export interface SdsDumpHeader {
  /** Sample number, 0-16383 (14-bit). */
  sampleNumber: number;

  /** Bits per sample word, 8-28. */
  sampleFormat: number;

  /** Sample period in nanoseconds (1_000_000_000 / sampleRate). */
  samplePeriodNs: number;

  /** Total sample length in words. */
  sampleLength: number;

  /** Loop start point as a word offset. */
  loopStart: number;

  /** Loop end point as a word offset. */
  loopEnd: number;

  /** Loop type. */
  loopType: SdsLoopType;
}

/** Data Packet -- 120 bytes of 7-bit encoded sample data. */
export interface SdsDataPacket {
  /** Running packet counter, 0-127. Wraps at 128. */
  packetNumber: number;

  /** 120 bytes of 7-bit encoded sample data. */
  data: Uint8Array;

  /** XOR checksum of the packet bytes. */
  checksum: number;
}

/** Dump Request -- asks the remote device to transmit a sample. */
export interface SdsDumpRequest {
  /** Requested sample number, 0-16383. */
  sampleNumber: number;
}

/** ACK handshake. */
export interface SdsAck {
  packetNumber: number;
}

/** NAK handshake. */
export interface SdsNak {
  packetNumber: number;
}

/** WAIT handshake. */
export interface SdsWait {
  packetNumber: number;
}

/** CANCEL handshake. */
export interface SdsCancel {
  packetNumber: number;
}

// ---------------------------------------------------------------------------
// Discriminated union for parsed SDS messages
// ---------------------------------------------------------------------------

export type SdsMessage =
  | { type: 'dump-header'; channel: number; header: SdsDumpHeader }
  | { type: 'data-packet'; channel: number; packet: SdsDataPacket }
  | { type: 'dump-request'; channel: number; request: SdsDumpRequest }
  | { type: 'ack'; channel: number; packetNumber: number }
  | { type: 'nak'; channel: number; packetNumber: number }
  | { type: 'wait'; channel: number; packetNumber: number }
  | { type: 'cancel'; channel: number; packetNumber: number };

// ---------------------------------------------------------------------------
// Transfer progress
// ---------------------------------------------------------------------------

/** Reports progress during an SDS sample transfer. */
export interface SdsTransferProgress {
  packetsSent: number;
  packetsTotal: number;
  bytesSent: number;
  bytesTotal: number;
}

// ---------------------------------------------------------------------------
// Sender / Receiver options
// ---------------------------------------------------------------------------

/** Configuration for sending a sample via SDS. */
export interface SdsSenderOptions {
  /** MIDI channel (device ID) for SysEx addressing. */
  channel: number;

  /** Sample metadata to transmit in the dump header. */
  header: SdsDumpHeader;

  /** Raw sample data to encode and send. */
  samples: Int16Array | Int32Array;

  /**
   * Transfer mode.
   * - `open-loop`: send packets without waiting for ACK.
   * - `closed-loop`: wait for ACK/NAK after each packet.
   */
  mode: 'open-loop' | 'closed-loop';

  /** Called after each packet is sent. */
  onProgress?: (progress: SdsTransferProgress) => void;

  /** Timeout in ms waiting for ACK in closed-loop mode. Default: 2000. */
  ackTimeoutMs?: number;

  /** Maximum retries on NAK or timeout before aborting. Default: 3. */
  maxRetries?: number;
}

/** Configuration for receiving a sample via SDS. */
export interface SdsReceiverOptions {
  /** MIDI channel (device ID) to listen on. */
  channel: number;

  /** Called when the dump header is received. */
  onHeader?: (header: SdsDumpHeader) => void;

  /** Called after each data packet is received. */
  onProgress?: (progress: SdsTransferProgress) => void;

  /** Called when all packets have been received and decoded. */
  onComplete?: (samples: Int16Array | Int32Array) => void;

  /** Called if the transfer fails. */
  onError?: (error: Error) => void;
}
