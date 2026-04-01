/**
 * MIDI Sample Dump Standard (SDS) 7-bit sample data encoding and decoding.
 *
 * The SDS protocol encodes each sample word into multiple 7-bit MIDI bytes.
 * Each MIDI byte carries 7 data bits (MSB is always 0). Sample bits are
 * left-justified — packed from the MSB of the first byte, with unused low
 * bits in the last byte zeroed.
 *
 * Reference: MIDI 1.0 Detailed Specification, "Sample Dump Standard"
 */

import {
  DATA_PACKET_PAYLOAD_SIZE,
  MIN_BIT_DEPTH,
  MAX_BIT_DEPTH,
} from './sds-constants';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateBitsPerWord(bitsPerWord: number): void {
  if (
    !Number.isInteger(bitsPerWord) ||
    bitsPerWord < MIN_BIT_DEPTH ||
    bitsPerWord > MAX_BIT_DEPTH
  ) {
    throw new Error(
      `bitsPerWord must be an integer between ${MIN_BIT_DEPTH} and ${MAX_BIT_DEPTH}, got ${bitsPerWord}`,
    );
  }
}

function validateMidiByte(byte: number, index: number): void {
  if (byte < 0 || byte > 0x7f) {
    throw new Error(
      `MIDI byte at index ${index} must be 0-127, got ${byte}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Byte-per-word calculation
// ---------------------------------------------------------------------------

/**
 * Number of 7-bit MIDI bytes needed to encode a sample word at the given
 * bit depth.
 */
function bytesPerWord(bitsPerWord: number): number {
  return Math.ceil(bitsPerWord / 7);
}

// ---------------------------------------------------------------------------
// Single sample word encoding / decoding
// ---------------------------------------------------------------------------

/**
 * Encode a single sample word into 7-bit MIDI bytes.
 *
 * The value is left-justified into `ceil(bitsPerWord / 7)` bytes of 7 bits
 * each. Unused low bits in the last byte are zeroed.
 *
 * @param value - The sample word value (unsigned, must fit in `bitsPerWord` bits)
 * @param bitsPerWord - Bit depth of the sample (8-28)
 * @returns Array of 7-bit MIDI bytes, length = ceil(bitsPerWord / 7)
 */
export function encodeSampleWord(
  value: number,
  bitsPerWord: number,
): number[] {
  validateBitsPerWord(bitsPerWord);

  const numBytes = bytesPerWord(bitsPerWord);
  const totalBits = numBytes * 7;
  const shiftAmount = totalBits - bitsPerWord;

  // Left-justify: shift the sample value into the top bitsPerWord bits
  // of the totalBits-wide field.
  const shifted = value << shiftAmount;

  // Extract 7 bits at a time from MSB to LSB.
  // Bit position: the most significant 7 bits are in byte 0.
  const result: number[] = new Array(numBytes);
  for (let i = 0; i < numBytes; i++) {
    const bitOffset = totalBits - 7 * (i + 1);
    result[i] = (shifted >>> bitOffset) & 0x7f;
  }

  return result;
}

/**
 * Decode 7-bit MIDI bytes back to a sample word.
 *
 * Inverse of {@link encodeSampleWord}. Reassembles the left-justified bits
 * and right-shifts to recover the original value.
 *
 * @param midiBytes - Array of 7-bit MIDI bytes
 * @param bitsPerWord - Bit depth of the sample (8-28)
 * @returns The decoded sample word value
 */
export function decodeSampleWord(
  midiBytes: number[],
  bitsPerWord: number,
): number {
  validateBitsPerWord(bitsPerWord);

  const numBytes = bytesPerWord(bitsPerWord);
  if (midiBytes.length < numBytes) {
    throw new Error(
      `Expected at least ${numBytes} MIDI bytes for ${bitsPerWord}-bit sample, got ${midiBytes.length}`,
    );
  }

  const totalBits = numBytes * 7;
  const shiftAmount = totalBits - bitsPerWord;

  // Reassemble the left-justified value from 7-bit chunks.
  // Loop bounds guarantee i < numBytes <= midiBytes.length, so indices are safe.
  let assembled = 0;
  for (let i = 0; i < numBytes; i++) {
    validateMidiByte(midiBytes[i]!, i);
    const bitOffset = totalBits - 7 * (i + 1);
    assembled |= midiBytes[i]! << bitOffset;
  }

  // Right-shift to recover the original value.
  return assembled >>> shiftAmount;
}

// ---------------------------------------------------------------------------
// Bulk sample encoding / decoding
// ---------------------------------------------------------------------------

/**
 * Encode an entire array of samples into a flat buffer of 7-bit MIDI bytes.
 *
 * @param samples - Sample data (Int16Array or Int32Array, treated as unsigned)
 * @param bitsPerWord - Bit depth of each sample (8-28)
 * @returns Flat Uint8Array of all encoded MIDI bytes
 */
export function encodeSampleData(
  samples: Int16Array | Int32Array,
  bitsPerWord: number,
): Uint8Array {
  validateBitsPerWord(bitsPerWord);

  const numBytes = bytesPerWord(bitsPerWord);
  const result = new Uint8Array(samples.length * numBytes);

  const maxUnsigned = (1 << bitsPerWord) - 1;

  for (let s = 0; s < samples.length; s++) {
    // Treat the sample as unsigned for encoding.
    const value = samples[s]! & maxUnsigned;
    const encoded = encodeSampleWord(value, bitsPerWord);
    const offset = s * numBytes;
    for (let b = 0; b < numBytes; b++) {
      result[offset + b] = encoded[b]!;
    }
  }

  return result;
}

/**
 * Decode a flat buffer of 7-bit MIDI bytes back into sample words.
 *
 * @param midiBytes - Flat buffer of 7-bit MIDI bytes
 * @param bitsPerWord - Bit depth of each sample (8-28)
 * @param sampleCount - Number of samples to decode
 * @returns Int16Array for bitsPerWord <= 16, Int32Array for > 16
 */
export function decodeSampleData(
  midiBytes: Uint8Array,
  bitsPerWord: number,
  sampleCount: number,
): Int16Array | Int32Array {
  validateBitsPerWord(bitsPerWord);

  const numBytes = bytesPerWord(bitsPerWord);
  const requiredBytes = sampleCount * numBytes;
  if (midiBytes.length < requiredBytes) {
    throw new Error(
      `Expected at least ${requiredBytes} MIDI bytes for ${sampleCount} samples ` +
        `at ${bitsPerWord} bits/word, got ${midiBytes.length}`,
    );
  }

  const result = bitsPerWord <= 16
    ? new Int16Array(sampleCount)
    : new Int32Array(sampleCount);

  for (let s = 0; s < sampleCount; s++) {
    const offset = s * numBytes;
    const chunk = Array.from(midiBytes.subarray(offset, offset + numBytes));
    result[s] = decodeSampleWord(chunk, bitsPerWord);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Packet-level operations
// ---------------------------------------------------------------------------

/**
 * Calculate the number of 120-byte data packets needed for the given samples.
 *
 * @param sampleCount - Number of samples
 * @param bitsPerWord - Bit depth of each sample (8-28)
 * @returns Number of packets (each carrying up to 120 bytes of payload)
 */
export function calculatePacketCount(
  sampleCount: number,
  bitsPerWord: number,
): number {
  validateBitsPerWord(bitsPerWord);

  if (sampleCount <= 0) {
    return 0;
  }

  const numBytes = bytesPerWord(bitsPerWord);
  const totalBytes = sampleCount * numBytes;
  return Math.ceil(totalBytes / DATA_PACKET_PAYLOAD_SIZE);
}

/**
 * Encode samples and split the resulting MIDI bytes into 120-byte packet
 * payloads. The last packet is zero-padded to exactly 120 bytes.
 *
 * @param samples - Sample data
 * @param bitsPerWord - Bit depth of each sample (8-28)
 * @returns Array of Uint8Array packet payloads, each exactly 120 bytes
 */
export function samplesToPackets(
  samples: Int16Array | Int32Array,
  bitsPerWord: number,
): Uint8Array[] {
  validateBitsPerWord(bitsPerWord);

  const encoded = encodeSampleData(samples, bitsPerWord);
  const packetCount = calculatePacketCount(samples.length, bitsPerWord);
  const packets: Uint8Array[] = [];

  for (let p = 0; p < packetCount; p++) {
    const start = p * DATA_PACKET_PAYLOAD_SIZE;
    const end = Math.min(start + DATA_PACKET_PAYLOAD_SIZE, encoded.length);

    // Always produce a full 120-byte packet (zero-padded).
    const packet = new Uint8Array(DATA_PACKET_PAYLOAD_SIZE);
    packet.set(encoded.subarray(start, end));
    packets.push(packet);
  }

  return packets;
}

/**
 * Reassemble packet payloads into a flat byte buffer and decode back to
 * sample words.
 *
 * @param packets - Array of 120-byte packet payloads
 * @param bitsPerWord - Bit depth of each sample (8-28)
 * @param sampleCount - Total number of samples to decode
 * @returns Int16Array for bitsPerWord <= 16, Int32Array for > 16
 */
export function packetsToSamples(
  packets: Uint8Array[],
  bitsPerWord: number,
  sampleCount: number,
): Int16Array | Int32Array {
  validateBitsPerWord(bitsPerWord);

  if (packets.length === 0 && sampleCount > 0) {
    throw new Error(
      `Cannot decode ${sampleCount} samples from zero packets`,
    );
  }

  const numBytes = bytesPerWord(bitsPerWord);
  const requiredBytes = sampleCount * numBytes;
  const totalAvailable = packets.length * DATA_PACKET_PAYLOAD_SIZE;
  if (totalAvailable < requiredBytes) {
    throw new Error(
      `Need at least ${requiredBytes} bytes for ${sampleCount} samples ` +
        `at ${bitsPerWord} bits/word, but ${packets.length} packets ` +
        `provide only ${totalAvailable} bytes`,
    );
  }

  // Concatenate all packet payloads into a single flat buffer.
  // Loop bounds guarantee p < packets.length, so indices are safe.
  const flat = new Uint8Array(totalAvailable);
  for (let p = 0; p < packets.length; p++) {
    flat.set(packets[p]!, p * DATA_PACKET_PAYLOAD_SIZE);
  }

  return decodeSampleData(flat, bitsPerWord, sampleCount);
}
