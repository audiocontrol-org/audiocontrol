/**
 * Bit manipulation helpers for MIDI data processing
 */

/**
 * Extract specific bits from a byte
 */
export function extractBits(byte: number, startBit: number, length: number): number {
  const mask = (1 << length) - 1;
  return (byte >>> startBit) & mask;
}

/**
 * Set specific bits in a byte
 */
export function setBits(byte: number, startBit: number, length: number, value: number): number {
  const mask = ((1 << length) - 1) << startBit;
  return (byte & ~mask) | ((value << startBit) & mask);
}

/**
 * Check if a specific bit is set
 */
export function isBitSet(byte: number, bitIndex: number): boolean {
  return (byte & (1 << bitIndex)) !== 0;
}

/**
 * Set a specific bit to 1
 */
export function setBit(byte: number, bitIndex: number): number {
  return byte | (1 << bitIndex);
}

/**
 * Clear a specific bit (set to 0)
 */
export function clearBit(byte: number, bitIndex: number): number {
  return byte & ~(1 << bitIndex);
}

/**
 * Toggle a specific bit
 */
export function toggleBit(byte: number, bitIndex: number): number {
  return byte ^ (1 << bitIndex);
}

/**
 * Convert two 7-bit bytes to a 14-bit value (MSB, LSB)
 */
export function bytes7To14Bit(msb: number, lsb: number): number {
  return ((msb & 0x7F) << 7) | (lsb & 0x7F);
}

/**
 * Convert a 14-bit value to two 7-bit bytes [MSB, LSB]
 */
export function value14To7Bit(value: number): [number, number] {
  const clamped = Math.max(0, Math.min(16383, value));
  const msb = (clamped >>> 7) & 0x7F;
  const lsb = clamped & 0x7F;
  return [msb, lsb];
}

/**
 * Ensure a value is within 7-bit range (0-127)
 */
export function clampTo7Bit(value: number): number {
  return Math.max(0, Math.min(127, Math.floor(value)));
}

/**
 * Ensure a value is within 14-bit range (0-16383)
 */
export function clampTo14Bit(value: number): number {
  return Math.max(0, Math.min(16383, Math.floor(value)));
}

/**
 * Calculate XOR checksum for data integrity
 */
export function calculateXORChecksum(data: readonly number[]): number {
  return data.reduce((checksum, byte) => checksum ^ byte, 0) & 0x7F;
}

/**
 * Calculate sum checksum for data integrity
 */
export function calculateSumChecksum(data: readonly number[]): number {
  return data.reduce((checksum, byte) => checksum + byte, 0) & 0x7F;
}

/**
 * Pack multiple 4-bit values into bytes
 */
export function pack4BitValues(values: readonly number[]): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i += 2) {
    const high = (values[i] || 0) & 0x0F;
    const low = (values[i + 1] || 0) & 0x0F;
    result.push((high << 4) | low);
  }

  return result;
}

/**
 * Unpack bytes into 4-bit values
 */
export function unpack4BitValues(data: readonly number[]): number[] {
  const result: number[] = [];

  for (const byte of data) {
    result.push((byte >>> 4) & 0x0F);
    result.push(byte & 0x0F);
  }

  return result;
}

/**
 * Convert byte array to binary string representation
 */
export function bytesToBinary(data: readonly number[]): string {
  return data.map(byte => byte.toString(2).padStart(8, '0')).join(' ');
}

/**
 * Convert binary string to byte array
 */
export function binaryToBytes(binary: string): number[] {
  const cleanBinary = binary.replace(/\s/g, '');
  const result: number[] = [];

  for (let i = 0; i < cleanBinary.length; i += 8) {
    const chunk = cleanBinary.slice(i, i + 8);
    if (chunk.length === 8) {
      result.push(parseInt(chunk, 2));
    }
  }

  return result;
}

/**
 * Rotate bits left
 */
export function rotateLeft(value: number, positions: number, width: number = 8): number {
  const mask = (1 << width) - 1;
  const normalizedValue = value & mask;
  const normalizedPositions = positions % width;

  return ((normalizedValue << normalizedPositions) | (normalizedValue >>> (width - normalizedPositions))) & mask;
}

/**
 * Rotate bits right
 */
export function rotateRight(value: number, positions: number, width: number = 8): number {
  const mask = (1 << width) - 1;
  const normalizedValue = value & mask;
  const normalizedPositions = positions % width;

  return ((normalizedValue >>> normalizedPositions) | (normalizedValue << (width - normalizedPositions))) & mask;
}

/**
 * Count the number of set bits in a byte
 */
export function popCount(byte: number): number {
  let count = 0;
  let value = byte;

  while (value) {
    count += value & 1;
    value >>>= 1;
  }

  return count;
}

/**
 * Find the position of the least significant bit
 */
export function findLSB(byte: number): number {
  if (byte === 0) return -1;

  let position = 0;
  let value = byte;

  while ((value & 1) === 0) {
    value >>>= 1;
    position++;
  }

  return position;
}

/**
 * Find the position of the most significant bit
 */
export function findMSB(byte: number): number {
  if (byte === 0) return -1;

  let position = 0;
  let value = byte;

  while (value > 1) {
    value >>>= 1;
    position++;
  }

  return position;
}

/**
 * Reverse the bits in a byte
 */
export function reverseBits(byte: number): number {
  let result = 0;
  let value = byte;

  for (let i = 0; i < 8; i++) {
    result = (result << 1) | (value & 1);
    value >>>= 1;
  }

  return result;
}