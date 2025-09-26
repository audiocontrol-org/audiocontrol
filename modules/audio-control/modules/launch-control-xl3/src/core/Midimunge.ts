/**
 * Midimunge 7-bit encoding/decoding for MIDI SysEx data transmission
 *
 * The Midimunge algorithm encodes 8-bit data into 7-bit values suitable for
 * MIDI SysEx transmission. It processes data in chunks of 7 bytes, using an
 * additional header byte to store the MSBs.
 *
 * Encoding format:
 * - Every 7 bytes of input data becomes 8 bytes of encoded output
 * - First byte contains the MSBs of the following 7 bytes (bit 0 = MSB of byte 1, etc.)
 * - Following 7 bytes contain the lower 7 bits of the original data
 *
 * Example:
 * Input:  [0x81, 0x02, 0x83, 0x04, 0x85, 0x06, 0x87]
 * Output: [0x55, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]
 *         (0x55 = 0b01010101 contains all the MSBs)
 */

export class Midimunge {
  /**
   * Encode 8-bit data into 7-bit MIDI SysEx format
   * @param data - Array of 8-bit values to encode
   * @returns Array of 7-bit values suitable for MIDI SysEx
   * @throws Error if input contains values > 255
   */
  static encode(data: number[]): number[] {
    // Validate input
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 255 || data[i] < 0) {
        throw new Error(`Invalid data value at index ${i}: ${data[i]}. Must be 0-255.`);
      }
    }

    const encoded: number[] = [];
    let index = 0;

    while (index < data.length) {
      // Process up to 7 bytes at a time
      const chunkSize = Math.min(7, data.length - index);
      let headerByte = 0;

      // Collect MSBs into header byte
      for (let i = 0; i < chunkSize; i++) {
        const value = data[index + i];
        if (value & 0x80) {
          headerByte |= (1 << i);
        }
      }

      // Add header byte
      encoded.push(headerByte);

      // Add 7-bit data bytes
      for (let i = 0; i < chunkSize; i++) {
        encoded.push(data[index + i] & 0x7F);
      }

      index += chunkSize;
    }

    return encoded;
  }

  /**
   * Decode 7-bit MIDI SysEx data back to 8-bit format
   * @param data - Array of 7-bit MIDI SysEx values to decode
   * @returns Array of decoded 8-bit values
   * @throws Error if input contains invalid 7-bit values or malformed data
   */
  static decode(data: number[]): number[] {
    // Validate input
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 127 || data[i] < 0) {
        throw new Error(`Invalid 7-bit value at index ${i}: ${data[i]}. Must be 0-127.`);
      }
    }

    const decoded: number[] = [];
    let index = 0;

    while (index < data.length) {
      if (index >= data.length) {
        break;
      }

      // Get header byte containing MSBs
      const headerByte = data[index];
      index++;

      // Calculate how many data bytes follow (up to 7)
      const remainingBytes = data.length - index;
      const chunkSize = Math.min(7, remainingBytes);

      // Decode each data byte
      for (let i = 0; i < chunkSize; i++) {
        if (index >= data.length) {
          throw new Error('Unexpected end of data during decode');
        }

        let value = data[index] & 0x7F;

        // Restore MSB if set in header
        if (headerByte & (1 << i)) {
          value |= 0x80;
        }

        decoded.push(value);
        index++;
      }
    }

    return decoded;
  }

  /**
   * Calculate the encoded size for a given data length
   * @param dataLength - Length of data to encode
   * @returns Size of encoded data
   */
  static getEncodedSize(dataLength: number): number {
    const fullChunks = Math.floor(dataLength / 7);
    const remainder = dataLength % 7;

    // Each full chunk of 7 bytes becomes 8 bytes
    let size = fullChunks * 8;

    // Partial chunk adds header + remaining bytes
    if (remainder > 0) {
      size += 1 + remainder;
    }

    return size;
  }

  /**
   * Calculate the maximum decoded size for a given encoded data length
   * @param encodedLength - Length of encoded data
   * @returns Maximum size of decoded data
   */
  static getMaxDecodedSize(encodedLength: number): number {
    const fullChunks = Math.floor(encodedLength / 8);
    const remainder = encodedLength % 8;

    // Each full chunk of 8 bytes becomes 7 bytes
    let size = fullChunks * 7;

    // Partial chunk: header byte + up to 7 data bytes
    if (remainder > 1) {
      size += remainder - 1;
    }

    return size;
  }

  /**
   * Encode a string to 7-bit MIDI SysEx format
   * @param text - String to encode
   * @returns Array of 7-bit values
   */
  static encodeString(text: string): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 255) {
        throw new Error(`Character at position ${i} is not ASCII: ${text[i]}`);
      }
      bytes.push(code);
    }
    return this.encode(bytes);
  }

  /**
   * Decode 7-bit MIDI SysEx data to a string
   * @param data - Array of 7-bit values to decode
   * @returns Decoded string
   */
  static decodeString(data: number[]): string {
    const bytes = this.decode(data);
    let result = '';
    for (const byte of bytes) {
      result += String.fromCharCode(byte);
    }
    return result;
  }

  /**
   * Validate that data is properly encoded Midimunge format
   * @param data - Data to validate
   * @returns True if data appears to be valid Midimunge encoding
   */
  static isValidEncoding(data: number[]): boolean {
    // All values must be 7-bit
    for (const value of data) {
      if (value < 0 || value > 127) {
        return false;
      }
    }

    // Check structure: should be chunks of (1 header + up to 7 data bytes)
    let index = 0;
    while (index < data.length) {
      if (index >= data.length) {
        break;
      }

      // Skip header byte
      index++;

      // Count data bytes (up to 7)
      const remainingBytes = data.length - index;
      const chunkSize = Math.min(7, remainingBytes);

      index += chunkSize;
    }

    return true;
  }

  /**
   * Create a hex string representation of encoded data for debugging
   * @param data - Encoded data
   * @returns Hex string with chunk separators
   */
  static toHexString(data: number[]): string {
    const chunks: string[] = [];
    let index = 0;

    while (index < data.length) {
      const chunkSize = Math.min(8, data.length - index);
      const chunk = data.slice(index, index + chunkSize);
      chunks.push(chunk.map(b => b.toString(16).padStart(2, '0')).join(' '));
      index += chunkSize;
    }

    return chunks.join(' | ');
  }
}

/**
 * Utility class for working with packed bit fields in Midimunge data
 */
export class MidimungeBitField {
  private data: number[];

  constructor(sizeInBits: number = 0) {
    const sizeInBytes = Math.ceil(sizeInBits / 8);
    this.data = new Array(sizeInBytes).fill(0);
  }

  /**
   * Set a bit at the specified index
   */
  setBit(index: number, value: boolean): void {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;

    if (byteIndex >= this.data.length) {
      throw new Error(`Bit index ${index} out of range`);
    }

    if (value) {
      this.data[byteIndex] |= (1 << bitIndex);
    } else {
      this.data[byteIndex] &= ~(1 << bitIndex);
    }
  }

  /**
   * Get a bit at the specified index
   */
  getBit(index: number): boolean {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;

    if (byteIndex >= this.data.length) {
      throw new Error(`Bit index ${index} out of range`);
    }

    return (this.data[byteIndex] & (1 << bitIndex)) !== 0;
  }

  /**
   * Set a range of bits from a value
   */
  setBits(startIndex: number, length: number, value: number): void {
    for (let i = 0; i < length; i++) {
      this.setBit(startIndex + i, (value & (1 << i)) !== 0);
    }
  }

  /**
   * Get a range of bits as a value
   */
  getBits(startIndex: number, length: number): number {
    let value = 0;
    for (let i = 0; i < length; i++) {
      if (this.getBit(startIndex + i)) {
        value |= (1 << i);
      }
    }
    return value;
  }

  /**
   * Get the raw byte array
   */
  toBytes(): number[] {
    return [...this.data];
  }

  /**
   * Create from a byte array
   */
  static fromBytes(bytes: number[]): MidimungeBitField {
    const field = new MidimungeBitField(bytes.length * 8);
    field.data = [...bytes];
    return field;
  }

  /**
   * Encode to Midimunge format
   */
  encode(): number[] {
    return Midimunge.encode(this.data);
  }

  /**
   * Decode from Midimunge format
   */
  static decode(encoded: number[]): MidimungeBitField {
    const bytes = Midimunge.decode(encoded);
    return MidimungeBitField.fromBytes(bytes);
  }
}

export default Midimunge;