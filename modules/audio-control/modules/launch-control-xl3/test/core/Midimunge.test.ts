import { describe, it, expect } from 'vitest';
import { Midimunge, MidimungeBitField } from '@/core/Midimunge';

describe('Midimunge', () => {
  describe('encode', () => {
    it('should encode single chunk of 7 bytes', () => {
      const input = [0x81, 0x02, 0x83, 0x04, 0x85, 0x06, 0x87];
      const expected = [
        0x55, // Header: 0b01010101 (bits 0,2,4,6 set for bytes with MSB)
        0x01, // 0x81 & 0x7F
        0x02, // 0x02 & 0x7F
        0x03, // 0x83 & 0x7F
        0x04, // 0x04 & 0x7F
        0x05, // 0x85 & 0x7F
        0x06, // 0x06 & 0x7F
        0x07, // 0x87 & 0x7F
      ];

      const result = Midimunge.encode(input);
      expect(result).toEqual(expected);
    });

    it('should encode partial chunk', () => {
      const input = [0x81, 0x02, 0x83];
      const expected = [
        0x05, // Header: 0b00000101 (bits 0,2 set)
        0x01, // 0x81 & 0x7F
        0x02, // 0x02 & 0x7F
        0x03, // 0x83 & 0x7F
      ];

      const result = Midimunge.encode(input);
      expect(result).toEqual(expected);
    });

    it('should encode multiple chunks', () => {
      const input = [
        0x81, 0x02, 0x83, 0x04, 0x85, 0x06, 0x87, // First chunk
        0x88, 0x09, // Second chunk (partial)
      ];

      const result = Midimunge.encode(input);

      // First chunk: header + 7 bytes
      expect(result.slice(0, 8)).toEqual([
        0x55, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07
      ]);

      // Second chunk: header + 2 bytes
      expect(result.slice(8)).toEqual([
        0x01, // Header: bit 0 set for 0x88
        0x08, // 0x88 & 0x7F
        0x09, // 0x09 & 0x7F
      ]);
    });

    it('should encode all 7-bit values unchanged', () => {
      const input = [0x00, 0x7F, 0x40, 0x20, 0x10, 0x08, 0x04];
      const expected = [
        0x00, // No MSBs set
        0x00, 0x7F, 0x40, 0x20, 0x10, 0x08, 0x04
      ];

      const result = Midimunge.encode(input);
      expect(result).toEqual(expected);
    });

    it('should handle empty input', () => {
      const result = Midimunge.encode([]);
      expect(result).toEqual([]);
    });

    it('should throw error for invalid values', () => {
      expect(() => Midimunge.encode([256])).toThrow('Invalid data value');
      expect(() => Midimunge.encode([-1])).toThrow('Invalid data value');
      expect(() => Midimunge.encode([0, 300, 0])).toThrow('Invalid data value');
    });
  });

  describe('decode', () => {
    it('should decode single chunk', () => {
      const input = [
        0x55, // Header
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07
      ];
      const expected = [0x81, 0x02, 0x83, 0x04, 0x85, 0x06, 0x87];

      const result = Midimunge.decode(input);
      expect(result).toEqual(expected);
    });

    it('should decode partial chunk', () => {
      const input = [0x05, 0x01, 0x02, 0x03];
      const expected = [0x81, 0x02, 0x83];

      const result = Midimunge.decode(input);
      expect(result).toEqual(expected);
    });

    it('should decode multiple chunks', () => {
      const input = [
        0x55, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, // First chunk
        0x01, 0x08, 0x09, // Second chunk
      ];
      const expected = [
        0x81, 0x02, 0x83, 0x04, 0x85, 0x06, 0x87,
        0x88, 0x09
      ];

      const result = Midimunge.decode(input);
      expect(result).toEqual(expected);
    });

    it('should handle empty input', () => {
      const result = Midimunge.decode([]);
      expect(result).toEqual([]);
    });

    it('should throw error for invalid 7-bit values', () => {
      expect(() => Midimunge.decode([128])).toThrow('Invalid 7-bit value');
      expect(() => Midimunge.decode([0, 200, 0])).toThrow('Invalid 7-bit value');
      expect(() => Midimunge.decode([-1])).toThrow('Invalid 7-bit value');
    });

    it('should decode header-only chunk as empty', () => {
      const input = [0x00]; // Just a header with no data bytes
      const result = Midimunge.decode(input);
      expect(result).toEqual([]);
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should preserve data through encode/decode cycle', () => {
      const testCases = [
        [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06],
        [0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86],
        [0xFF, 0xFE, 0xFD, 0xFC, 0xFB, 0xFA, 0xF9],
        Array.from({ length: 100 }, (_, i) => i),
        Array.from({ length: 256 }, (_, i) => i % 256),
      ];

      for (const original of testCases) {
        const encoded = Midimunge.encode(original);
        const decoded = Midimunge.decode(encoded);
        expect(decoded).toEqual(original);
      }
    });
  });

  describe('getEncodedSize', () => {
    it('should calculate correct encoded size', () => {
      expect(Midimunge.getEncodedSize(0)).toBe(0);
      expect(Midimunge.getEncodedSize(1)).toBe(2); // 1 header + 1 data
      expect(Midimunge.getEncodedSize(7)).toBe(8); // 1 header + 7 data
      expect(Midimunge.getEncodedSize(8)).toBe(10); // (1+7) + (1+1)
      expect(Midimunge.getEncodedSize(14)).toBe(16); // 2 full chunks
      expect(Midimunge.getEncodedSize(15)).toBe(18); // 2 full + partial
    });
  });

  describe('getMaxDecodedSize', () => {
    it('should calculate correct max decoded size', () => {
      expect(Midimunge.getMaxDecodedSize(0)).toBe(0);
      expect(Midimunge.getMaxDecodedSize(2)).toBe(1); // 1 header + 1 data
      expect(Midimunge.getMaxDecodedSize(8)).toBe(7); // Full chunk
      expect(Midimunge.getMaxDecodedSize(16)).toBe(14); // 2 full chunks
      expect(Midimunge.getMaxDecodedSize(10)).toBe(8); // 1 full + partial
    });
  });

  describe('encodeString / decodeString', () => {
    it('should encode and decode ASCII strings', () => {
      const testStrings = [
        'Hello, World!',
        'Launch Control XL',
        '1234567890',
        'MIDI SysEx Test',
        '', // Empty string
      ];

      for (const original of testStrings) {
        const encoded = Midimunge.encodeString(original);
        const decoded = Midimunge.decodeString(encoded);
        expect(decoded).toBe(original);
      }
    });

    it('should throw error for non-ASCII characters', () => {
      expect(() => Midimunge.encodeString('🎹')).toThrow('not ASCII');
      expect(() => Midimunge.encodeString('€')).toThrow('not ASCII');
    });
  });

  describe('isValidEncoding', () => {
    it('should validate correct encodings', () => {
      const validEncodings = [
        [],
        [0x00],
        [0x00, 0x01, 0x02],
        [0x7F, 0x7F, 0x7F, 0x7F, 0x7F, 0x7F, 0x7F, 0x7F],
        Midimunge.encode([0x80, 0x81, 0x82]),
      ];

      for (const data of validEncodings) {
        expect(Midimunge.isValidEncoding(data)).toBe(true);
      }
    });

    it('should reject invalid encodings', () => {
      const invalidEncodings = [
        [128], // 8-bit value
        [0, 255, 0], // Contains 8-bit value
        [-1], // Negative value
      ];

      for (const data of invalidEncodings) {
        expect(Midimunge.isValidEncoding(data)).toBe(false);
      }
    });
  });

  describe('toHexString', () => {
    it('should format encoded data as hex string', () => {
      const data = [0x55, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x01, 0x08];
      const result = Midimunge.toHexString(data);
      expect(result).toBe('55 01 02 03 04 05 06 07 | 01 08');
    });

    it('should handle empty data', () => {
      expect(Midimunge.toHexString([])).toBe('');
    });
  });
});

describe('MidimungeBitField', () => {
  describe('bit operations', () => {
    it('should set and get individual bits', () => {
      const field = new MidimungeBitField(16);

      field.setBit(0, true);
      field.setBit(7, true);
      field.setBit(8, true);
      field.setBit(15, true);

      expect(field.getBit(0)).toBe(true);
      expect(field.getBit(1)).toBe(false);
      expect(field.getBit(7)).toBe(true);
      expect(field.getBit(8)).toBe(true);
      expect(field.getBit(15)).toBe(true);
    });

    it('should clear bits', () => {
      const field = new MidimungeBitField(8);
      field.setBit(3, true);
      expect(field.getBit(3)).toBe(true);

      field.setBit(3, false);
      expect(field.getBit(3)).toBe(false);
    });

    it('should throw error for out-of-range access', () => {
      const field = new MidimungeBitField(8);
      expect(() => field.setBit(8, true)).toThrow('out of range');
      expect(() => field.getBit(8)).toThrow('out of range');
    });
  });

  describe('multi-bit operations', () => {
    it('should set and get bit ranges', () => {
      const field = new MidimungeBitField(16);

      // Set 4 bits starting at index 2 to value 0b1010 (10)
      field.setBits(2, 4, 0b1010);

      expect(field.getBit(2)).toBe(false); // bit 0 of 0b1010
      expect(field.getBit(3)).toBe(true);  // bit 1 of 0b1010
      expect(field.getBit(4)).toBe(false); // bit 2 of 0b1010
      expect(field.getBit(5)).toBe(true);  // bit 3 of 0b1010

      expect(field.getBits(2, 4)).toBe(0b1010);
    });

    it('should handle byte-aligned values', () => {
      const field = new MidimungeBitField(16);

      field.setBits(0, 8, 0xFF);
      expect(field.getBits(0, 8)).toBe(0xFF);

      field.setBits(8, 8, 0xAA);
      expect(field.getBits(8, 8)).toBe(0xAA);

      const bytes = field.toBytes();
      expect(bytes).toEqual([0xFF, 0xAA]);
    });
  });

  describe('byte conversion', () => {
    it('should convert to and from bytes', () => {
      const original = [0x55, 0xAA, 0xFF, 0x00];
      const field = MidimungeBitField.fromBytes(original);
      const result = field.toBytes();

      expect(result).toEqual(original);
    });

    it('should create correct size from bit count', () => {
      const field1 = new MidimungeBitField(1);
      expect(field1.toBytes()).toEqual([0]);

      const field8 = new MidimungeBitField(8);
      expect(field8.toBytes()).toEqual([0]);

      const field9 = new MidimungeBitField(9);
      expect(field9.toBytes()).toEqual([0, 0]);
    });
  });

  describe('Midimunge encoding/decoding', () => {
    it('should encode and decode bit field', () => {
      const field = new MidimungeBitField(16);
      field.setBits(0, 8, 0x81);
      field.setBits(8, 8, 0xFE);

      const encoded = field.encode();
      const decoded = MidimungeBitField.decode(encoded);

      expect(decoded.toBytes()).toEqual(field.toBytes());
      expect(decoded.getBits(0, 8)).toBe(0x81);
      expect(decoded.getBits(8, 8)).toBe(0xFE);
    });

    it('should handle empty bit field', () => {
      const field = new MidimungeBitField(0);
      const encoded = field.encode();
      const decoded = MidimungeBitField.decode(encoded);

      expect(decoded.toBytes()).toEqual([]);
    });
  });
});