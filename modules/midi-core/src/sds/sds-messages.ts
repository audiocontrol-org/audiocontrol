/**
 * MIDI Sample Dump Standard (SDS) message builders and parsers.
 *
 * All functions are pure — no side effects or mutable state.
 * Builders return complete SysEx messages as number arrays.
 * The parser returns a discriminated union (SdsMessage).
 *
 * Reference: MIDI 1.0 Detailed Specification, "Sample Dump Standard"
 */

import {
  SYSEX_START,
  SYSEX_END,
  UNIVERSAL_NON_REAL_TIME,
  CMD_DUMP_HEADER,
  CMD_DATA_PACKET,
  CMD_DUMP_REQUEST,
  CMD_ACK,
  CMD_NAK,
  CMD_WAIT,
  CMD_CANCEL,
  DATA_PACKET_PAYLOAD_SIZE,
  MAX_SAMPLE_NUMBER,
  PACKET_COUNTER_MAX,
  MIN_BIT_DEPTH,
  MAX_BIT_DEPTH,
} from './sds-constants';

import type {
  SdsDumpHeader,
  SdsDataPacket,
  SdsMessage,
  SdsLoopType,
} from './sds-types';

// ---------------------------------------------------------------------------
// Internal helpers — 7-bit encoding / decoding
// ---------------------------------------------------------------------------

/** Maximum value for a 21-bit field (3 x 7-bit bytes). */
const MAX_21_BIT = 0x1fffff;

/** Encode a value into 2 x 7-bit bytes (LSB, MSB). */
function encode7bit14(value: number): [number, number] {
  return [value & 0x7f, (value >> 7) & 0x7f];
}

/** Encode a value into 3 x 7-bit bytes (low, mid, high). */
function encode7bit21(value: number): [number, number, number] {
  return [value & 0x7f, (value >> 7) & 0x7f, (value >> 14) & 0x7f];
}

/** Decode 2 x 7-bit bytes (LSB, MSB) into a 14-bit value. */
function decode7bit14(lsb: number, msb: number): number {
  return (msb & 0x7f) << 7 | (lsb & 0x7f);
}

/** Decode 3 x 7-bit bytes into a 21-bit value. */
function decode7bit21(low: number, mid: number, high: number): number {
  return ((high & 0x7f) << 14) | ((mid & 0x7f) << 7) | (low & 0x7f);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateChannel(channel: number): void {
  if (!Number.isInteger(channel) || channel < 0 || channel > 0x7f) {
    throw new Error(
      `SDS channel must be an integer 0-127, got ${channel}`,
    );
  }
}

function validateSampleNumber(sampleNumber: number): void {
  if (
    !Number.isInteger(sampleNumber) ||
    sampleNumber < 0 ||
    sampleNumber > MAX_SAMPLE_NUMBER
  ) {
    throw new Error(
      `SDS sample number must be an integer 0-${MAX_SAMPLE_NUMBER}, got ${sampleNumber}`,
    );
  }
}

function validatePacketNumber(packetNumber: number): void {
  if (
    !Number.isInteger(packetNumber) ||
    packetNumber < 0 ||
    packetNumber >= PACKET_COUNTER_MAX
  ) {
    throw new Error(
      `SDS packet number must be an integer 0-${PACKET_COUNTER_MAX - 1}, got ${packetNumber}`,
    );
  }
}

function validate21BitValue(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > MAX_21_BIT) {
    throw new Error(
      `SDS ${name} must be an integer 0-${MAX_21_BIT}, got ${value}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Checksum
// ---------------------------------------------------------------------------

/**
 * Calculate XOR checksum over a byte array.
 * Returns the result masked to 7 bits.
 */
export function calculateChecksum(data: number[]): number {
  let xor = 0;
  for (const byte of data) {
    xor ^= byte;
  }
  return xor & 0x7f;
}

/**
 * Validate the checksum of a parsed SDS data packet.
 * Re-builds the checksummed region and compares against the stored checksum.
 */
export function validateChecksum(
  packet: SdsDataPacket,
  channel: number,
): boolean {
  validateChannel(channel);
  const checksumRegion = [
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_DATA_PACKET,
    packet.packetNumber & 0x7f,
    ...Array.from(packet.data),
  ];
  return calculateChecksum(checksumRegion) === packet.checksum;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build a Dump Header SysEx message.
 *
 * Wire format:
 *   F0 7E cc 01 sl sh ee pl pm ph al am ah bl bm bh cl cm ch tt F7
 */
export function buildDumpHeader(
  channel: number,
  header: SdsDumpHeader,
): number[] {
  validateChannel(channel);
  validateSampleNumber(header.sampleNumber);

  if (
    !Number.isInteger(header.sampleFormat) ||
    header.sampleFormat < MIN_BIT_DEPTH ||
    header.sampleFormat > MAX_BIT_DEPTH
  ) {
    throw new Error(
      `SDS sample format (bits) must be ${MIN_BIT_DEPTH}-${MAX_BIT_DEPTH}, got ${header.sampleFormat}`,
    );
  }

  validate21BitValue(header.samplePeriodNs, 'sample period');
  validate21BitValue(header.sampleLength, 'sample length');
  validate21BitValue(header.loopStart, 'loop start');
  validate21BitValue(header.loopEnd, 'loop end');

  const [sl, sh] = encode7bit14(header.sampleNumber);
  const [pl, pm, ph] = encode7bit21(header.samplePeriodNs);
  const [al, am, ah] = encode7bit21(header.sampleLength);
  const [bl, bm, bh] = encode7bit21(header.loopStart);
  const [cl, cm, ch] = encode7bit21(header.loopEnd);

  return [
    SYSEX_START,
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_DUMP_HEADER,
    sl, sh,
    header.sampleFormat,
    pl, pm, ph,
    al, am, ah,
    bl, bm, bh,
    cl, cm, ch,
    header.loopType,
    SYSEX_END,
  ];
}

/**
 * Build a Data Packet SysEx message.
 *
 * Wire format:
 *   F0 7E cc 02 kk <120 bytes> cs F7
 *
 * Data shorter than 120 bytes is zero-padded.
 * Checksum is the XOR of bytes from 7E through all 120 data bytes.
 */
export function buildDataPacket(
  channel: number,
  packetNumber: number,
  data: Uint8Array,
): number[] {
  validateChannel(channel);
  validatePacketNumber(packetNumber);

  if (data.length > DATA_PACKET_PAYLOAD_SIZE) {
    throw new Error(
      `SDS data packet payload must be at most ${DATA_PACKET_PAYLOAD_SIZE} bytes, got ${data.length}`,
    );
  }

  // Pad to 120 bytes
  const padded = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
  padded.set(data);

  const kk = packetNumber & 0x7f;

  // Checksum region: 7E, cc, 02, kk, and all 120 data bytes
  const checksumRegion = [
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_DATA_PACKET,
    kk,
    ...Array.from(padded),
  ];
  const cs = calculateChecksum(checksumRegion);

  return [
    SYSEX_START,
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_DATA_PACKET,
    kk,
    ...Array.from(padded),
    cs,
    SYSEX_END,
  ];
}

/**
 * Build a Dump Request SysEx message.
 *
 * Wire format: F0 7E cc 03 sl sh F7
 */
export function buildDumpRequest(
  channel: number,
  sampleNumber: number,
): number[] {
  validateChannel(channel);
  validateSampleNumber(sampleNumber);

  const [sl, sh] = encode7bit14(sampleNumber);
  return [
    SYSEX_START,
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_DUMP_REQUEST,
    sl, sh,
    SYSEX_END,
  ];
}

/**
 * Build an ACK handshake message.
 *
 * Wire format: F0 7E cc 7F kk F7
 */
export function buildAck(channel: number, packetNumber: number): number[] {
  validateChannel(channel);
  validatePacketNumber(packetNumber);
  return [
    SYSEX_START,
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_ACK,
    packetNumber & 0x7f,
    SYSEX_END,
  ];
}

/**
 * Build a NAK handshake message.
 *
 * Wire format: F0 7E cc 7E kk F7
 */
export function buildNak(channel: number, packetNumber: number): number[] {
  validateChannel(channel);
  validatePacketNumber(packetNumber);
  return [
    SYSEX_START,
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_NAK,
    packetNumber & 0x7f,
    SYSEX_END,
  ];
}

/**
 * Build a WAIT handshake message.
 *
 * Wire format: F0 7E cc 7C kk F7
 */
export function buildWait(channel: number, packetNumber: number): number[] {
  validateChannel(channel);
  validatePacketNumber(packetNumber);
  return [
    SYSEX_START,
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_WAIT,
    packetNumber & 0x7f,
    SYSEX_END,
  ];
}

/**
 * Build a CANCEL handshake message.
 *
 * Wire format: F0 7E cc 7D kk F7
 */
export function buildCancel(channel: number, packetNumber: number): number[] {
  validateChannel(channel);
  validatePacketNumber(packetNumber);
  return [
    SYSEX_START,
    UNIVERSAL_NON_REAL_TIME,
    channel,
    CMD_CANCEL,
    packetNumber & 0x7f,
    SYSEX_END,
  ];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a raw SysEx byte array into a typed SDS message.
 *
 * Validates framing (F0 ... F7), the Universal Non-Real Time ID (7E),
 * and dispatches on the command byte to decode each message type.
 *
 * Throws on invalid or unrecognized messages.
 */
export function parseSdsMessage(data: number[]): SdsMessage {
  if (data.length < 5) {
    throw new Error(
      `SDS message too short: expected at least 5 bytes, got ${data.length}`,
    );
  }

  // Length validated above — indices 0..4 are safe.
  if (data[0]! !== SYSEX_START) {
    throw new Error(
      `SDS message must start with 0xF0, got 0x${data[0]!.toString(16).padStart(2, '0')}`,
    );
  }

  if (data[data.length - 1]! !== SYSEX_END) {
    throw new Error(
      `SDS message must end with 0xF7, got 0x${data[data.length - 1]!.toString(16).padStart(2, '0')}`,
    );
  }

  if (data[1]! !== UNIVERSAL_NON_REAL_TIME) {
    throw new Error(
      `SDS message byte[1] must be 0x7E (Universal Non-Real Time), got 0x${data[1]!.toString(16).padStart(2, '0')}`,
    );
  }

  const channel = data[2]!;
  const command = data[3]!;

  switch (command) {
    case CMD_DUMP_HEADER:
      return parseDumpHeader(data, channel);
    case CMD_DATA_PACKET:
      return parseDataPacket(data, channel);
    case CMD_DUMP_REQUEST:
      return parseDumpRequestMsg(data, channel);
    case CMD_ACK:
      return parseHandshake(data, channel, 'ack');
    case CMD_NAK:
      return parseHandshake(data, channel, 'nak');
    case CMD_WAIT:
      return parseHandshake(data, channel, 'wait');
    case CMD_CANCEL:
      return parseHandshake(data, channel, 'cancel');
    default:
      throw new Error(
        `Unknown SDS command byte: 0x${command.toString(16).padStart(2, '0')}`,
      );
  }
}

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

function parseDumpHeader(data: number[], channel: number): SdsMessage {
  // F0 7E cc 01 sl sh ee pl pm ph al am ah bl bm bh cl cm ch tt F7
  // 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20
  const expectedLength = 21;
  if (data.length !== expectedLength) {
    throw new Error(
      `SDS Dump Header must be ${expectedLength} bytes, got ${data.length}`,
    );
  }

  // Length validated above — all indexed positions (4..19) are safe.
  const sampleNumber = decode7bit14(data[4]!, data[5]!);
  const sampleFormat = data[6]!;
  const samplePeriodNs = decode7bit21(data[7]!, data[8]!, data[9]!);
  const sampleLength = decode7bit21(data[10]!, data[11]!, data[12]!);
  const loopStart = decode7bit21(data[13]!, data[14]!, data[15]!);
  const loopEnd = decode7bit21(data[16]!, data[17]!, data[18]!);
  const loopType = data[19]! as SdsLoopType;

  return {
    type: 'dump-header',
    channel,
    header: {
      sampleNumber,
      sampleFormat,
      samplePeriodNs,
      sampleLength,
      loopStart,
      loopEnd,
      loopType,
    },
  };
}

function parseDataPacket(data: number[], channel: number): SdsMessage {
  // F0 7E cc 02 kk <120 bytes> cs F7
  // Expected length: 1 + 1 + 1 + 1 + 1 + 120 + 1 + 1 = 127
  const expectedLength = 5 + DATA_PACKET_PAYLOAD_SIZE + 2;
  if (data.length !== expectedLength) {
    throw new Error(
      `SDS Data Packet must be ${expectedLength} bytes, got ${data.length}`,
    );
  }

  // Length validated above — index 4 and payloadEnd are safe.
  const packetNumber = data[4]! & 0x7f;
  const payloadStart = 5;
  const payloadEnd = payloadStart + DATA_PACKET_PAYLOAD_SIZE;
  const packetData = new Uint8Array(
    data.slice(payloadStart, payloadEnd),
  );
  const checksum = data[payloadEnd]!;

  return {
    type: 'data-packet',
    channel,
    packet: {
      packetNumber,
      data: packetData,
      checksum,
    },
  };
}

function parseDumpRequestMsg(data: number[], channel: number): SdsMessage {
  // F0 7E cc 03 sl sh F7
  const expectedLength = 7;
  if (data.length !== expectedLength) {
    throw new Error(
      `SDS Dump Request must be ${expectedLength} bytes, got ${data.length}`,
    );
  }

  // Length validated above — indices 4 and 5 are safe.
  const sampleNumber = decode7bit14(data[4]!, data[5]!);

  return {
    type: 'dump-request',
    channel,
    request: { sampleNumber },
  };
}

function parseHandshake(
  data: number[],
  channel: number,
  kind: 'ack' | 'nak' | 'wait' | 'cancel',
): SdsMessage {
  // F0 7E cc XX kk F7
  const expectedLength = 6;
  if (data.length !== expectedLength) {
    throw new Error(
      `SDS ${kind.toUpperCase()} must be ${expectedLength} bytes, got ${data.length}`,
    );
  }

  // Length validated above — index 4 is safe.
  const packetNumber = data[4]! & 0x7f;

  return { type: kind, channel, packetNumber };
}
