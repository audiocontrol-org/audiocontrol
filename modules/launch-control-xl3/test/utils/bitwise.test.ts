/**
 * Tests for bit manipulation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  extractBits,
  setBits,
  isBitSet,
  setBit,
  clearBit,
  toggleBit,
  bytes7To14Bit,
  value14To7Bit,
  clampTo7Bit,
  clampTo14Bit,
  calculateXORChecksum,
  calculateSumChecksum,
  pack4BitValues,
  unpack4BitValues,
  bytesToBinary,
  binaryToBytes,
  rotateLeft,
  rotateRight,
  popCount,
  findLSB,
  findMSB,
  reverseBits,
} from '@/utils/bitwise.js';

describe('bitwise utilities', () => {
  describe('extractBits', () => {
    it('should extract bits correctly', () => {
      // Extract middle 4 bits from 11110000 (0xF0)
      expect(extractBits(0xF0, 4, 4)).toBe(0xF);

      // Extract lower 3 bits from 10101010 (0xAA)
      expect(extractBits(0xAA, 0, 3)).toBe(0x2); // 010

      // Extract single bit
      expect(extractBits(0x80, 7, 1)).toBe(1);
      expect(extractBits(0x7F, 7, 1)).toBe(0);
    });

    it('should handle edge cases', () => {
      expect(extractBits(0xFF, 0, 8)).toBe(0xFF);
      expect(extractBits(0x00, 0, 8)).toBe(0x00);
    });
  });

  describe('setBits', () => {
    it('should set bits correctly', () => {
      // Set middle 4 bits to 0xF in 0x00
      expect(setBits(0x00, 4, 4, 0xF)).toBe(0xF0);

      // Set lower 3 bits to 0x5 in 0x00
      expect(setBits(0x00, 0, 3, 0x5)).toBe(0x05);

      // Overwrite existing bits
      expect(setBits(0xFF, 4, 4, 0x0)).toBe(0x0F);
    });

    it('should preserve other bits', () => {
      // Set middle bits without affecting others
      expect(setBits(0x0F, 4, 4, 0xA)).toBe(0xAF);
    });
  });

  describe('bit checking and manipulation', () => {
    describe('isBitSet', () => {
      it('should check bit status correctly', () => {
        expect(isBitSet(0x80, 7)).toBe(true);
        expect(isBitSet(0x7F, 7)).toBe(false);
        expect(isBitSet(0x01, 0)).toBe(true);
        expect(isBitSet(0xFE, 0)).toBe(false);
      });
    });

    describe('setBit', () => {
      it('should set individual bits', () => {
        expect(setBit(0x00, 7)).toBe(0x80);
        expect(setBit(0x00, 0)).toBe(0x01);
        expect(setBit(0x7F, 7)).toBe(0xFF);
      });
    });

    describe('clearBit', () => {
      it('should clear individual bits', () => {
        expect(clearBit(0xFF, 7)).toBe(0x7F);
        expect(clearBit(0xFF, 0)).toBe(0xFE);
        expect(clearBit(0x80, 7)).toBe(0x00);
      });
    });

    describe('toggleBit', () => {
      it('should toggle individual bits', () => {
        expect(toggleBit(0x00, 7)).toBe(0x80);
        expect(toggleBit(0x80, 7)).toBe(0x00);
        expect(toggleBit(0xFF, 0)).toBe(0xFE);
        expect(toggleBit(0xFE, 0)).toBe(0xFF);
      });
    });
  });

  describe('MIDI value conversion', () => {
    describe('bytes7To14Bit', () => {
      it('should convert 7-bit bytes to 14-bit values', () => {
        expect(bytes7To14Bit(0x7F, 0x7F)).toBe(0x3FFF); // Maximum 14-bit value
        expect(bytes7To14Bit(0x00, 0x00)).toBe(0x0000);
        expect(bytes7To14Bit(0x01, 0x00)).toBe(0x0080); // MSB contribution
        expect(bytes7To14Bit(0x00, 0x01)).toBe(0x0001); // LSB contribution
      });

      it('should mask input to 7 bits', () => {
        // Input values > 127 should be masked
        expect(bytes7To14Bit(0xFF, 0xFF)).toBe(0x3FFF);
        expect(bytes7To14Bit(0x80, 0x80)).toBe(0x0000); // Only bit 7 set, masked out
      });
    });

    describe('value14To7Bit', () => {
      it('should convert 14-bit values to 7-bit bytes', () => {
        expect(value14To7Bit(0x3FFF)).toEqual([0x7F, 0x7F]);
        expect(value14To7Bit(0x0000)).toEqual([0x00, 0x00]);
        expect(value14To7Bit(0x0080)).toEqual([0x01, 0x00]);
        expect(value14To7Bit(0x0001)).toEqual([0x00, 0x01]);
      });

      it('should clamp values to 14-bit range', () => {
        expect(value14To7Bit(-1)).toEqual([0x00, 0x00]);
        expect(value14To7Bit(20000)).toEqual([0x7F, 0x7F]);
      });
    });

    describe('clampTo7Bit', () => {
      it('should clamp values to 0-127 range', () => {
        expect(clampTo7Bit(64)).toBe(64);
        expect(clampTo7Bit(0)).toBe(0);
        expect(clampTo7Bit(127)).toBe(127);
        expect(clampTo7Bit(-10)).toBe(0);
        expect(clampTo7Bit(200)).toBe(127);
        expect(clampTo7Bit(127.9)).toBe(127);
      });
    });

    describe('clampTo14Bit', () => {
      it('should clamp values to 0-16383 range', () => {
        expect(clampTo14Bit(8192)).toBe(8192);
        expect(clampTo14Bit(0)).toBe(0);
        expect(clampTo14Bit(16383)).toBe(16383);
        expect(clampTo14Bit(-10)).toBe(0);
        expect(clampTo14Bit(20000)).toBe(16383);
        expect(clampTo14Bit(16383.9)).toBe(16383);
      });
    });
  });

  describe('checksum calculations', () => {
    describe('calculateXORChecksum', () => {
      it('should calculate XOR checksum correctly', () => {
        expect(calculateXORChecksum([0x01, 0x02, 0x03])).toBe(0x00); // 1^2^3 = 0
        expect(calculateXORChecksum([0x7F, 0x7F])).toBe(0x00);
        expect(calculateXORChecksum([0x55, 0xAA])).toBe(0x7F); // 01010101 ^ 10101010 = 11111111
        expect(calculateXORChecksum([])).toBe(0x00);
      });

      it('should mask result to 7 bits', () => {
        expect(calculateXORChecksum([0xFF, 0x00])).toBe(0x7F);
      });
    });

    describe('calculateSumChecksum', () => {
      it('should calculate sum checksum correctly', () => {
        expect(calculateSumChecksum([0x01, 0x02, 0x03])).toBe(0x06);
        expect(calculateSumChecksum([0x7F, 0x01])).toBe(0x00); // 128 & 0x7F = 0
        expect(calculateSumChecksum([])).toBe(0x00);
      });

      it('should mask result to 7 bits', () => {
        expect(calculateSumChecksum([0x80, 0x80])).toBe(0x00); // 256 & 0x7F = 0
      });
    });
  });

  describe('4-bit packing', () => {
    describe('pack4BitValues', () => {
      it('should pack 4-bit values into bytes', () => {
        expect(pack4BitValues([0xF, 0x0])).toEqual([0xF0]);
        expect(pack4BitValues([0x0, 0xF])).toEqual([0x0F]);
        expect(pack4BitValues([0xA, 0x5])).toEqual([0xA5]);
        expect(pack4BitValues([0x1, 0x2, 0x3, 0x4])).toEqual([0x12, 0x34]);
      });

      it('should handle odd number of values', () => {
        expect(pack4BitValues([0xF])).toEqual([0xF0]);
        expect(pack4BitValues([0x1, 0x2, 0x3])).toEqual([0x12, 0x30]);
      });

      it('should mask values to 4 bits', () => {
        expect(pack4BitValues([0xFF, 0xFF])).toEqual([0xFF]);
      });
    });

    describe('unpack4BitValues', () => {
      it('should unpack bytes into 4-bit values', () => {
        expect(unpack4BitValues([0xF0])).toEqual([0xF, 0x0]);
        expect(unpack4BitValues([0x0F])).toEqual([0x0, 0xF]);
        expect(unpack4BitValues([0xA5])).toEqual([0xA, 0x5]);
        expect(unpack4BitValues([0x12, 0x34])).toEqual([0x1, 0x2, 0x3, 0x4]);
      });

      it('should handle empty input', () => {
        expect(unpack4BitValues([])).toEqual([]);
      });
    });
  });

  describe('binary conversion', () => {
    describe('bytesToBinary', () => {
      it('should convert bytes to binary string', () => {
        expect(bytesToBinary([0xFF])).toBe('11111111');
        expect(bytesToBinary([0x00])).toBe('00000000');
        expect(bytesToBinary([0xAA, 0x55])).toBe('10101010 01010101');
      });

      it('should handle empty array', () => {
        expect(bytesToBinary([])).toBe('');
      });
    });

    describe('binaryToBytes', () => {
      it('should convert binary string to bytes', () => {
        expect(binaryToBytes('11111111')).toEqual([0xFF]);
        expect(binaryToBytes('00000000')).toEqual([0x00]);
        expect(binaryToBytes('10101010 01010101')).toEqual([0xAA, 0x55]);
      });

      it('should ignore incomplete bytes', () => {
        expect(binaryToBytes('1111111')).toEqual([]); // Only 7 bits
        expect(binaryToBytes('11111111 111')).toEqual([0xFF]); // Second byte incomplete
      });

      it('should handle whitespace', () => {
        expect(binaryToBytes('  1111 1111  ')).toEqual([0xFF]);
      });
    });
  });

  describe('bit rotation', () => {
    describe('rotateLeft', () => {
      it('should rotate bits left', () => {
        expect(rotateLeft(0x01, 1)).toBe(0x02); // 00000001 -> 00000010
        expect(rotateLeft(0x80, 1)).toBe(0x01); // 10000000 -> 00000001 (wrap around)
        expect(rotateLeft(0xAA, 4)).toBe(0xAA); // 10101010 -> 10101010 (symmetric)
      });

      it('should handle multiple rotations', () => {
        expect(rotateLeft(0x01, 8)).toBe(0x01); // Full rotation
        expect(rotateLeft(0x01, 9)).toBe(0x02); // One extra
      });

      it('should support custom bit width', () => {
        expect(rotateLeft(0x1, 1, 4)).toBe(0x2); // 4-bit: 0001 -> 0010
        expect(rotateLeft(0x8, 1, 4)).toBe(0x1); // 4-bit: 1000 -> 0001
      });
    });

    describe('rotateRight', () => {
      it('should rotate bits right', () => {
        expect(rotateRight(0x02, 1)).toBe(0x01); // 00000010 -> 00000001
        expect(rotateRight(0x01, 1)).toBe(0x80); // 00000001 -> 10000000 (wrap around)
        expect(rotateRight(0xAA, 4)).toBe(0xAA); // 10101010 -> 10101010 (symmetric)
      });

      it('should handle multiple rotations', () => {
        expect(rotateRight(0x01, 8)).toBe(0x01); // Full rotation
        expect(rotateRight(0x01, 9)).toBe(0x80); // One extra
      });

      it('should support custom bit width', () => {
        expect(rotateRight(0x2, 1, 4)).toBe(0x1); // 4-bit: 0010 -> 0001
        expect(rotateRight(0x1, 1, 4)).toBe(0x8); // 4-bit: 0001 -> 1000
      });
    });
  });

  describe('bit analysis', () => {
    describe('popCount', () => {
      it('should count set bits', () => {
        expect(popCount(0x00)).toBe(0);
        expect(popCount(0xFF)).toBe(8);
        expect(popCount(0xAA)).toBe(4); // 10101010
        expect(popCount(0x55)).toBe(4); // 01010101
        expect(popCount(0x01)).toBe(1);
        expect(popCount(0x80)).toBe(1);
      });
    });

    describe('findLSB', () => {
      it('should find least significant bit position', () => {
        expect(findLSB(0x01)).toBe(0); // ...00000001
        expect(findLSB(0x02)).toBe(1); // ...00000010
        expect(findLSB(0x80)).toBe(7); // ...10000000
        expect(findLSB(0x06)).toBe(1); // ...00000110 (first 1 at position 1)
      });

      it('should return -1 for zero', () => {
        expect(findLSB(0x00)).toBe(-1);
      });
    });

    describe('findMSB', () => {
      it('should find most significant bit position', () => {
        expect(findMSB(0x01)).toBe(0); // ...00000001
        expect(findMSB(0x02)).toBe(1); // ...00000010
        expect(findMSB(0x80)).toBe(7); // ...10000000
        expect(findMSB(0x06)).toBe(2); // ...00000110 (highest 1 at position 2)
        expect(findMSB(0xFF)).toBe(7); // ...11111111
      });

      it('should return -1 for zero', () => {
        expect(findMSB(0x00)).toBe(-1);
      });
    });

    describe('reverseBits', () => {
      it('should reverse bit order', () => {
        expect(reverseBits(0x01)).toBe(0x80); // 00000001 -> 10000000
        expect(reverseBits(0x80)).toBe(0x01); // 10000000 -> 00000001
        expect(reverseBits(0xAA)).toBe(0x55); // 10101010 -> 01010101
        expect(reverseBits(0x55)).toBe(0xAA); // 01010101 -> 10101010
        expect(reverseBits(0x00)).toBe(0x00);
        expect(reverseBits(0xFF)).toBe(0xFF);
      });

      it('should be its own inverse', () => {
        const testValues = [0x01, 0x80, 0xAA, 0x55, 0x12, 0x34];
        testValues.forEach(value => {
          expect(reverseBits(reverseBits(value))).toBe(value);
        });
      });
    });
  });
});