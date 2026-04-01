/**
 * MIDI Sample Dump Standard (SDS) protocol constants.
 *
 * Reference: MIDI 1.0 Detailed Specification, Section "Sample Dump Standard"
 */

// ---------------------------------------------------------------------------
// SysEx framing
// ---------------------------------------------------------------------------

/** SysEx start byte */
export const SYSEX_START = 0xf0;

/** SysEx end byte */
export const SYSEX_END = 0xf7;

/** Universal Non-Real Time SysEx ID */
export const UNIVERSAL_NON_REAL_TIME = 0x7e;

// ---------------------------------------------------------------------------
// SDS sub-command IDs (byte following the channel in the SysEx message)
// ---------------------------------------------------------------------------

/** Dump Header command byte */
export const CMD_DUMP_HEADER = 0x01;

/** Data Packet command byte */
export const CMD_DATA_PACKET = 0x02;

/** Dump Request command byte */
export const CMD_DUMP_REQUEST = 0x03;

// ---------------------------------------------------------------------------
// Handshake command bytes
// ---------------------------------------------------------------------------

/** ACK (acknowledge) */
export const CMD_ACK = 0x7f;

/** NAK (negative acknowledge) */
export const CMD_NAK = 0x7e;

/** WAIT (pause transmission) */
export const CMD_WAIT = 0x7c;

/** CANCEL (abort transfer) */
export const CMD_CANCEL = 0x7d;

// ---------------------------------------------------------------------------
// Loop types
// ---------------------------------------------------------------------------

/** Forward-only loop */
export const LOOP_FORWARD = 0x00;

/** Forward-backward (ping-pong) loop */
export const LOOP_FORWARD_BACKWARD = 0x01;

/** Loop off */
export const LOOP_OFF = 0x7f;

// ---------------------------------------------------------------------------
// Data packet geometry
// ---------------------------------------------------------------------------

/** Number of payload bytes in each data packet */
export const DATA_PACKET_PAYLOAD_SIZE = 120;

/**
 * Packet counter range: 0x00 through 0x7F (0-127).
 * The counter wraps back to 0x00 after reaching 0x7F.
 */
export const PACKET_COUNTER_MAX = 128;

// ---------------------------------------------------------------------------
// Sample number limits
// ---------------------------------------------------------------------------

/**
 * Maximum sample number (14-bit value).
 * Sample numbers are encoded as two 7-bit bytes: LSB, MSB.
 */
export const MAX_SAMPLE_NUMBER = 16383;

// ---------------------------------------------------------------------------
// Bit depth limits
// ---------------------------------------------------------------------------

/** Minimum supported sample bit depth */
export const MIN_BIT_DEPTH = 8;

/** Maximum supported sample bit depth */
export const MAX_BIT_DEPTH = 28;

// ---------------------------------------------------------------------------
// Transfer timing defaults
// ---------------------------------------------------------------------------

/** Default ACK/NAK timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 2000;

/** Default maximum retry count before aborting */
export const DEFAULT_MAX_RETRIES = 3;
