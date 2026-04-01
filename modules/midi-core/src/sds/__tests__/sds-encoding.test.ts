import { describe, it, expect } from 'vitest';
import {
  encodeSampleWord,
  decodeSampleWord,
  encodeSampleData,
  decodeSampleData,
  samplesToPackets,
  packetsToSamples,
  calculatePacketCount,
} from '../sds-encoding';
import { DATA_PACKET_PAYLOAD_SIZE } from '../sds-constants';

// ---------------------------------------------------------------------------
// encodeSampleWord / decodeSampleWord round-trip
// ---------------------------------------------------------------------------

describe('encodeSampleWord / decodeSampleWord round-trip', () => {
  it('round-trips 8-bit value 0xFF', () => {
    const bitsPerWord = 8;
    const encoded = encodeSampleWord(0xff, bitsPerWord);
    // ceil(8/7) = 2 MIDI bytes
    expect(encoded).toHaveLength(2);
    const decoded = decodeSampleWord(encoded, bitsPerWord);
    expect(decoded).toBe(0xff);
  });

  it('round-trips 12-bit value 0xABC', () => {
    const bitsPerWord = 12;
    const encoded = encodeSampleWord(0xabc, bitsPerWord);
    // ceil(12/7) = 2 MIDI bytes
    expect(encoded).toHaveLength(2);
    const decoded = decodeSampleWord(encoded, bitsPerWord);
    expect(decoded).toBe(0xabc);
  });

  it('round-trips 16-bit value 0x8000', () => {
    const bitsPerWord = 16;
    const encoded = encodeSampleWord(0x8000, bitsPerWord);
    // ceil(16/7) = 3 MIDI bytes
    expect(encoded).toHaveLength(3);
    const decoded = decodeSampleWord(encoded, bitsPerWord);
    expect(decoded).toBe(0x8000);
  });

  it('round-trips 16-bit value 0xFFFF', () => {
    const bitsPerWord = 16;
    const encoded = encodeSampleWord(0xffff, bitsPerWord);
    expect(encoded).toHaveLength(3);
    const decoded = decodeSampleWord(encoded, bitsPerWord);
    expect(decoded).toBe(0xffff);
  });

  it('round-trips 24-bit value 0xABCDEF', () => {
    const bitsPerWord = 24;
    const encoded = encodeSampleWord(0xabcdef, bitsPerWord);
    // ceil(24/7) = 4 MIDI bytes
    expect(encoded).toHaveLength(4);
    const decoded = decodeSampleWord(encoded, bitsPerWord);
    expect(decoded).toBe(0xabcdef);
  });

  it('round-trips 16-bit value 0 (zero)', () => {
    const bitsPerWord = 16;
    const encoded = encodeSampleWord(0, bitsPerWord);
    expect(encoded).toHaveLength(3);
    expect(encoded.every((b) => b === 0)).toBe(true);
    const decoded = decodeSampleWord(encoded, bitsPerWord);
    expect(decoded).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// encodeSampleWord left-justification
// ---------------------------------------------------------------------------

describe('encodeSampleWord left-justification', () => {
  it('all encoded MIDI bytes are in range 0-127', () => {
    const testValues = [0, 1, 0x7fff, 0x8000, 0xffff];
    for (const value of testValues) {
      const encoded = encodeSampleWord(value, 16);
      for (const byte of encoded) {
        expect(byte).toBeGreaterThanOrEqual(0);
        expect(byte).toBeLessThanOrEqual(127);
      }
    }
  });

  it('MSB of first byte contains top bits for 16-bit', () => {
    // For 16-bit: 3 MIDI bytes = 21 total bits, left-justify by 5.
    // Value 0x8000 = 1000_0000_0000_0000 (16 bits)
    // Left-justified by 5: 1_0000000_0000000_00000 (21 bits)
    // Byte 0: top 7 bits = 1_000000 = 0x40
    const encoded = encodeSampleWord(0x8000, 16);
    expect(encoded[0]).toBe(0x40);
  });

  it('encodes 8-bit 0x80 into 2 bytes with MSB carrying top bit', () => {
    // 8-bit: 2 MIDI bytes = 14 total bits, left-justify by 6.
    // 0x80 = 10000000, shifted left by 6 = 10_0000000_000000 (14 bits)
    // Byte 0: top 7 bits = 10_00000 = 0x40
    // Byte 1: next 7 bits = 00_00000 = 0x00
    const encoded = encodeSampleWord(0x80, 8);
    expect(encoded[0]).toBe(0x40);
    expect(encoded[1]).toBe(0x00);
  });
});

// ---------------------------------------------------------------------------
// encodeSampleData / decodeSampleData round-trip
// ---------------------------------------------------------------------------

describe('encodeSampleData / decodeSampleData round-trip', () => {
  it('round-trips 16-bit unsigned values', () => {
    // Using unsigned-representable values in Int16Array:
    // 0 and 32767 are straightforward. -32768 becomes 0x8000 unsigned,
    // -1 becomes 0xFFFF unsigned after masking.
    const samples = new Int16Array([0, 32767, -32768, -1]);
    const bitsPerWord = 16;

    const encoded = encodeSampleData(samples, bitsPerWord);
    // 4 samples * 3 bytes/sample = 12 bytes
    expect(encoded).toHaveLength(12);

    const decoded = decodeSampleData(encoded, bitsPerWord, 4);

    // Values are decoded as unsigned, stored back in Int16Array.
    // 0 -> 0
    expect(decoded[0]).toBe(0);
    // 32767 -> 32767
    expect(decoded[1]).toBe(32767);
    // 0x8000 -> -32768 in Int16Array (sign bit)
    expect(decoded[2]).toBe(-32768);
    // 0xFFFF -> -1 in Int16Array
    expect(decoded[3]).toBe(-1);
  });

  it('round-trips 8-bit values', () => {
    const samples = new Int16Array([0, 127, 255]);
    const bitsPerWord = 8;

    const encoded = encodeSampleData(samples, bitsPerWord);
    // 3 samples * 2 bytes/sample = 6 bytes
    expect(encoded).toHaveLength(6);

    const decoded = decodeSampleData(encoded, bitsPerWord, 3);
    expect(decoded[0]).toBe(0);
    expect(decoded[1]).toBe(127);
    expect(decoded[2]).toBe(255);
  });

  it('returns Int16Array for bitsPerWord <= 16', () => {
    const samples = new Int16Array([100]);
    const encoded = encodeSampleData(samples, 16);
    const decoded = decodeSampleData(encoded, 16, 1);
    expect(decoded).toBeInstanceOf(Int16Array);
  });

  it('returns Int32Array for bitsPerWord > 16', () => {
    const samples = new Int32Array([100000]);
    const encoded = encodeSampleData(samples, 24);
    const decoded = decodeSampleData(encoded, 24, 1);
    expect(decoded).toBeInstanceOf(Int32Array);
  });
});

// ---------------------------------------------------------------------------
// samplesToPackets / packetsToSamples round-trip
// ---------------------------------------------------------------------------

describe('samplesToPackets / packetsToSamples round-trip', () => {
  it('small sample fits in 1 packet', () => {
    // 40 samples * 3 bytes/sample (16-bit) = 120 bytes = exactly 1 packet
    const samples = new Int16Array(40);
    for (let i = 0; i < 40; i++) {
      samples[i] = i * 100;
    }

    const packets = samplesToPackets(samples, 16);
    expect(packets).toHaveLength(1);
    expect(packets[0]).toHaveLength(DATA_PACKET_PAYLOAD_SIZE);
  });

  it('large sample spans multiple packets', () => {
    // 41 samples * 3 bytes/sample = 123 bytes = 2 packets
    const samples = new Int16Array(41);
    for (let i = 0; i < 41; i++) {
      samples[i] = i;
    }

    const packets = samplesToPackets(samples, 16);
    expect(packets).toHaveLength(2);
  });

  it('last packet is zero-padded to 120 bytes', () => {
    const samples = new Int16Array([1, 2, 3]);
    const packets = samplesToPackets(samples, 16);

    expect(packets).toHaveLength(1);
    expect(packets[0]).toHaveLength(DATA_PACKET_PAYLOAD_SIZE);

    // Bytes 9 through 119 should be zero (3 samples * 3 bytes = 9 data bytes)
    for (let i = 9; i < DATA_PACKET_PAYLOAD_SIZE; i++) {
      expect(packets[0]![i]).toBe(0);
    }
  });

  it('round-trips through samplesToPackets -> packetsToSamples', () => {
    const original = new Int16Array(100);
    for (let i = 0; i < 100; i++) {
      original[i] = (i * 317) & 0x7fff; // various positive 16-bit values
    }

    const packets = samplesToPackets(original, 16);
    const recovered = packetsToSamples(packets, 16, original.length);

    expect(recovered).toHaveLength(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(recovered[i]).toBe(original[i]);
    }
  });

  it('round-trips 24-bit samples', () => {
    const original = new Int32Array([0, 0xabcdef, 0xffffff, 1]);
    const packets = samplesToPackets(original, 24);
    const recovered = packetsToSamples(packets, 24, original.length);

    for (let i = 0; i < original.length; i++) {
      expect(recovered[i]).toBe(original[i]);
    }
  });

  it('handles empty sample array', () => {
    const samples = new Int16Array(0);
    const packets = samplesToPackets(samples, 16);
    expect(packets).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// calculatePacketCount
// ---------------------------------------------------------------------------

describe('calculatePacketCount', () => {
  it('40 samples at 16-bit = 120 MIDI bytes = 1 packet', () => {
    // 40 * ceil(16/7) = 40 * 3 = 120 bytes = exactly 1 packet
    expect(calculatePacketCount(40, 16)).toBe(1);
  });

  it('41 samples at 16-bit = 123 MIDI bytes = 2 packets', () => {
    expect(calculatePacketCount(41, 16)).toBe(2);
  });

  it('0 samples = 0 packets', () => {
    expect(calculatePacketCount(0, 16)).toBe(0);
  });

  it('1 sample at 8-bit = 2 MIDI bytes = 1 packet', () => {
    expect(calculatePacketCount(1, 8)).toBe(1);
  });

  it('60 samples at 8-bit = 120 MIDI bytes = 1 packet', () => {
    // 60 * ceil(8/7) = 60 * 2 = 120
    expect(calculatePacketCount(60, 8)).toBe(1);
  });

  it('61 samples at 8-bit = 122 MIDI bytes = 2 packets', () => {
    expect(calculatePacketCount(61, 8)).toBe(2);
  });

  it('30 samples at 24-bit = 120 MIDI bytes = 1 packet', () => {
    // 30 * ceil(24/7) = 30 * 4 = 120
    expect(calculatePacketCount(30, 24)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe('encoding validation', () => {
  it('throws for bitsPerWord < 8', () => {
    expect(() => encodeSampleWord(0, 7)).toThrow(/between 8 and 28/);
  });

  it('throws for bitsPerWord > 28', () => {
    expect(() => encodeSampleWord(0, 29)).toThrow(/between 8 and 28/);
  });

  it('throws for non-integer bitsPerWord', () => {
    expect(() => encodeSampleWord(0, 16.5)).toThrow(/integer/);
  });

  it('decodeSampleWord throws for bitsPerWord < 8', () => {
    expect(() => decodeSampleWord([0, 0], 7)).toThrow(/between 8 and 28/);
  });

  it('decodeSampleWord throws for too few MIDI bytes', () => {
    // 16-bit needs 3 bytes, only provide 2
    expect(() => decodeSampleWord([0, 0], 16)).toThrow(/at least 3/);
  });

  it('calculatePacketCount throws for invalid bitsPerWord', () => {
    expect(() => calculatePacketCount(10, 5)).toThrow(/between 8 and 28/);
  });

  it('encodeSampleData throws for invalid bitsPerWord', () => {
    const samples = new Int16Array([1]);
    expect(() => encodeSampleData(samples, 0)).toThrow(/between 8 and 28/);
  });

  it('decodeSampleData throws when not enough bytes', () => {
    const midiBytes = new Uint8Array(3); // only 1 sample worth of 16-bit
    expect(() => decodeSampleData(midiBytes, 16, 2)).toThrow(
      /at least 6 MIDI bytes/,
    );
  });

  it('packetsToSamples throws for zero packets with nonzero sample count', () => {
    expect(() => packetsToSamples([], 16, 10)).toThrow(/zero packets/);
  });
});
