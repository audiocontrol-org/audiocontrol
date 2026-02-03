/**
 * Midimunge library implementation for 7-bit MIDI encoding/decoding
 * Based on reverse-engineered JavaScript from Novation web editor
 */

/**
 * Convert a single byte into 8 nibbles (4-bit values)
 */
export function bytesToNybbles(byte: number): number[] {
  const nibbles = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    nibbles[i] = (byte >> (4 * (7 - i))) & 0x0F;
  }
  return nibbles;
}

/**
 * Convert an array of 8 nibbles back into a byte value
 */
export function nybblesToBytes(nibbles: number[]): number {
  let result = 0;
  nibbles.forEach((nibble, index) => {
    result += nibble * Math.pow(16, 7 - index);
  });
  return result;
}

/**
 * Convert 8-bit data to 7-bit MIDI-safe format
 * Takes groups of 7 bytes and adds a status byte at the beginning
 * The status byte contains the MSBs of the following 7 bytes
 */
export function eightToSeven(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  const length = data.length;

  for (let offset = 0; offset < length; offset += 7) {
    // Get up to 7 bytes for this group
    const group = data.slice(offset, Math.min(offset + 7, length));

    // Create status byte from MSBs
    let statusByte = 0;
    for (let i = 0; i < group.length; i++) {
      if (group[i] & 0x80) {
        statusByte |= (1 << i);
      }
    }

    // Add status byte to result
    result.push(statusByte);

    // Add the 7-bit values (MSB cleared)
    for (let i = 0; i < group.length; i++) {
      result.push(group[i] & 0x7F);
    }
  }

  return new Uint8Array(result);
}

/**
 * Convert 7-bit MIDI data back to 8-bit format
 * Takes groups of 8 bytes (1 status + 7 data) and reconstructs original bytes
 */
export function sevenToEight(data: Uint8Array): Uint8Array {
  const result: number[] = [];
  const length = data.length;

  for (let offset = 0; offset < length; offset += 8) {
    // Get the status byte and up to 7 data bytes
    const statusByte = data[offset];
    const dataBytes = data.slice(offset + 1, Math.min(offset + 8, length));

    // Reconstruct original bytes using status byte for MSBs
    for (let i = 0; i < dataBytes.length; i++) {
      let value = dataBytes[i] & 0x7F;
      if (statusByte & (1 << i)) {
        value |= 0x80;
      }
      result.push(value);
    }
  }

  return new Uint8Array(result);
}

/**
 * Parse SysEx messages by finding F0 (start) and F7 (end) boundaries
 */
export function chunkSysEx(data: Uint8Array): Uint8Array[] {
  const messages: Uint8Array[] = [];
  let startIndex = 0;
  let endIndex = 0;

  do {
    startIndex = data.indexOf(0xF0, endIndex); // F0 - SysEx start
    if (startIndex === -1) break;

    endIndex = data.indexOf(0xF7, startIndex); // F7 - SysEx end
    if (endIndex === -1) break;

    messages.push(data.slice(startIndex, endIndex + 1));
    endIndex++; // Move past the F7 for next search
  } while (true);

  return messages;
}

/**
 * Encode a string to MIDI-safe format
 * Each character is converted to ASCII and then 7-bit encoded
 */
export function encodeString(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0x7F; // Ensure 7-bit safe
  }
  return bytes;
}

/**
 * Decode a MIDI-safe string back to regular string
 */
export function decodeString(data: Uint8Array): string {
  return String.fromCharCode(...data);
}

/**
 * Encode a control definition to MIDI bytes
 * Based on captured protocol: 49 [ID] 02 [TYPE] [CHANNEL] ... 48 00 [CC] 7F 00
 */
export function encodeControl(
  id: number,
  type: number,
  channel: number,
  ccNumber: number,
  minValue: number = 0,
  maxValue: number = 0x7F
): Uint8Array {
  return new Uint8Array([
    0x49, // Control definition marker
    id,   // Control ID
    0x02, // Definition type
    type, // Control type (0x19=encoder, 0x11=button, 0x31=fader)
    channel, // MIDI channel (0x00-0x0F)
    // Additional parameters may go here
    0x48, // Parameter marker
    0x00, // Reserved
    ccNumber, // CC number
    maxValue, // Max value (usually 0x7F)
    minValue, // Min value (usually 0x00)
  ]);
}

/**
 * Split large data into multiple SysEx messages
 * Launch Control XL 3 uses ~500 byte chunks
 */
export function splitIntoSysExMessages(
  data: Uint8Array,
  maxChunkSize: number = 500
): Uint8Array[] {
  const messages: Uint8Array[] = [];
  let offset = 0;
  let messageIndex = 0;

  while (offset < data.length) {
    const chunkSize = Math.min(maxChunkSize, data.length - offset);
    const chunk = data.slice(offset, offset + chunkSize);

    // Build SysEx message with proper header
    const message = new Uint8Array([
      0xF0, // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID
      0x02, // Device ID
      0x15, // Command
      0x05, // Sub-command
      0x00, // Reserved
      0x45, // Data type (write)
      messageIndex, // Message index/continuation
      0x02, 0x20, 0x05, // Additional header
      ...chunk,
      0xF7, // SysEx end
    ]);

    messages.push(message);
    offset += chunkSize;
    messageIndex++;
  }

  return messages;
}

/**
 * Validate a SysEx message structure
 */
export function validateSysEx(data: Uint8Array): boolean {
  if (data.length < 7) return false;
  if (data[0] !== 0xF0) return false; // Must start with F0
  if (data[data.length - 1] !== 0xF7) return false; // Must end with F7

  // Check for Novation manufacturer ID
  if (data[1] !== 0x00 || data[2] !== 0x20 || data[3] !== 0x29) {
    return false;
  }

  return true;
}

/**
 * Extract the payload from a SysEx message (removing F0 header and F7 terminator)
 */
export function extractSysExPayload(data: Uint8Array): Uint8Array {
  if (!validateSysEx(data)) {
    throw new Error('Invalid SysEx message');
  }

  // Skip F0 at start and F7 at end
  return data.slice(1, data.length - 1);
}