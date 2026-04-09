import { akaiByte2String } from '@/utils/akai-utils.js';

/**
 * Akai S3000XL SysEx opcodes.
 *
 * Reference: https://lakai.sourceforge.net/docs/s2800_sysex.html
 *
 * ENCODING NOTE: The S1000 SysEx spec defines two different encodings:
 *
 * 1. **Request item numbers** (RPDATA, RKDATA, RSDATA, DELP, DELK, DELS):
 *    Item numbers are encoded as two 7-bit bytes, LSB first.
 *    Example: sample 22 → [22 & 0x7F, (22 >> 7) & 0x7F] → [0x16, 0x00]
 *
 * 2. **Header data fields** (within PDATA, KDATA, SDATA responses):
 *    Parameter values are encoded as nibble pairs (4-bit), low nibble first.
 *    Example: byte 0xAB → [0x0B, 0x0A]
 *
 * Confusing these two encodings causes failures for item numbers >= 16,
 * where 4-bit nibble encoding diverges from 7-bit encoding.
 */
export enum AkaiOpcode {
  /** Request S1000 status */
  RSTAT = 0x00,
  /** S1000 status report */
  STAT = 0x01,
  /** Request list of resident program names */
  RPLIST = 0x02,
  /** List of resident program names */
  PLIST = 0x03,
  /** Request list of resident sample names */
  RSLIST = 0x04,
  /** List of resident sample names */
  SLIST = 0x05,
  /** Request program common data */
  RPDATA = 0x06,
  /** Program common data */
  PDATA = 0x07,
  /** Request keygroup data */
  RKDATA = 0x08,
  /** Keygroup data */
  KDATA = 0x09,
  /** Request sample header data */
  RSDATA = 0x0a,
  /** Sample header data */
  SDATA = 0x0b,
  /** Request sample data packet(s) */
  RSPACK = 0x0c,
  /** Accept sample data packet(s) */
  ASPACK = 0x0d,
  /** Request drum settings */
  RDDATA = 0x0e,
  /** Drum input settings */
  DDATA = 0x0f,
  /** Request miscellaneous data */
  RMDATA = 0x10,
  /** Miscellaneous data */
  MDATA = 0x11,
  /** Delete program and its keygroups */
  DELP = 0x12,
  /** Delete keygroup */
  DELK = 0x13,
  /** Delete sample header and data */
  DELS = 0x14,
  /** Set S1000 exclusive channel */
  SETEX = 0x15,
  /** S1000 command reply (error or ok) */
  REPLY = 0x16,
  /** Corrected ASPACK */
  CASPACK = 0x1d,
}

/** Akai manufacturer ID in MIDI SysEx */
export const AKAI_MANUFACTURER_ID = 0x47;

/** S3000XL device ID byte */
export const S3000XL_DEVICE_ID = 0x48;

/** MIDI SysEx start byte */
export const SYSEX_START = 0xf0;

/** MIDI SysEx end byte */
export const SYSEX_END = 0xf7;

/** Minimum valid SysEx response length: START + MANUFACTURER + CHANNEL + OPCODE + DEVICE_ID + END */
const MIN_RESPONSE_LENGTH = 6;

/** Byte index of the opcode in a standard Akai SysEx message */
const OPCODE_INDEX = 3;

/** Default timing constants for S3000XL communication */
export const DEFAULT_TIMING = {
  TIMEOUT_MS: 3000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 200,
  WRITE_FLUSH_DELAY_MS: 150,
} as const;

/**
 * Build a complete Akai S3000XL SysEx message.
 *
 * Message format: F0 47 <channel> <opcode> 48 <data...> F7
 */
export function buildAkaiSysEx(
  channel: number,
  opcode: AkaiOpcode,
  data: number[],
): number[] {
  return [
    SYSEX_START,
    AKAI_MANUFACTURER_ID,
    channel,
    opcode,
    S3000XL_DEVICE_ID,
    ...data,
    SYSEX_END,
  ];
}

/**
 * Parse an Akai SysEx response, validating the manufacturer ID.
 *
 * @returns The opcode and payload data (between device ID and SYSEX_END).
 * @throws If the message is too short or has wrong manufacturer ID.
 */
export function parseAkaiResponse(message: number[]): {
  opcode: number;
  data: number[];
} {
  if (message.length < MIN_RESPONSE_LENGTH) {
    throw new Error(
      `Invalid Akai SysEx response: expected at least ${MIN_RESPONSE_LENGTH} bytes, got ${message.length}`,
    );
  }
  if (message[1] !== AKAI_MANUFACTURER_ID) {
    throw new Error(
      `Invalid manufacturer ID: expected 0x${AKAI_MANUFACTURER_ID.toString(16)}, got 0x${message[1].toString(16)}`,
    );
  }
  const opcode = message[OPCODE_INDEX];
  // Data is everything after the 5-byte header (START, MFR, CHAN, OPCODE, DEVICE_ID)
  // and before the final SYSEX_END byte.
  const data = message.slice(5, message.length - 1);
  return { opcode, data };
}

/**
 * Check whether a SysEx response is an error reply.
 *
 * REPLY (0x16) with data byte 0x00 means OK (write accepted).
 * REPLY with any non-zero data byte is an error code.
 */
export function isErrorResponse(message: number[]): boolean {
  if (message.length < MIN_RESPONSE_LENGTH) {
    return false;
  }
  if (message[OPCODE_INDEX] !== AkaiOpcode.REPLY) {
    return false;
  }
  // Data byte follows the device ID at index 5
  const errorCode = message.length > 5 ? message[5] : 0;
  return errorCode !== 0;
}

/**
 * Parse a name list from an RPLIST or RSLIST response.
 *
 * The full SysEx message format is:
 *   [F0 47 ch opcode 48] [countLo countHi] [name0...] [name1...] ... [F7]
 *
 * The count is a 16-bit little-endian integer (low byte + high byte * 256).
 * Each name is `nameLength` bytes of Akai-encoded characters.
 *
 * @param message - Full SysEx message bytes (including header and F7)
 * @param nameLength - Length of each name in bytes (typically 12 for Akai names)
 * @returns Array of decoded name strings
 */
export function parseNameList(
  message: number[],
  nameLength: number,
): string[] {
  const names: string[] = [];
  // Skip past the 5-byte SysEx header
  let offset = 5;

  // Item count as 16-bit little-endian
  const countLow = message[offset];
  const countHigh = message[offset + 1];
  const count = countLow | (countHigh << 8);
  offset += 2;

  for (let i = 0; i < count; i++) {
    const nameBytes = message.slice(offset, offset + nameLength);
    names.push(akaiByte2String(nameBytes));
    offset += nameLength;
  }

  return names;
}
