/**
 * Tests for D-110 SysEx message generation and parsing
 */

import { describe, it, expect } from 'vitest';
import {
  calculateChecksum,
  buildDT1Message,
  buildRQ1Message,
  parseSysExMessage,
  isD110Message,
  getTempToneAddress,
  getToneRamAddress,
  getPartTimbreAddress,
  getSystemAddress,
  getPatchAddress,
} from '@/core/midi/sysex';
import { D110_COMMANDS, ROLAND_ID, D110_MODEL_ID, DEFAULT_DEVICE_ID } from '@/core/midi/constants';

describe('calculateChecksum', () => {
  it('should calculate correct checksum for simple data', () => {
    // Example: address [0x04, 0x00, 0x00] + data [0x50]
    // Sum = 0x04 + 0x00 + 0x00 + 0x50 = 0x54
    // 0x54 & 0x7F = 0x54
    // 0x80 - 0x54 = 0x2C
    expect(calculateChecksum([0x04, 0x00, 0x00, 0x50])).toBe(0x2c);
  });

  it('should return 0 when result is 128', () => {
    // Need data that sums to 0 (mod 128)
    // 0x80 - 0 = 0x80, which should return 0
    expect(calculateChecksum([0x00])).toBe(0);
    expect(calculateChecksum([0x80])).toBe(0); // 0x80 mod 0x7F = 0
  });

  it('should handle empty array', () => {
    // Sum = 0, 0x80 - 0 = 0x80, return 0
    expect(calculateChecksum([])).toBe(0);
  });

  it('should wrap correctly for large sums', () => {
    // Sum = 0xFF + 0xFF = 0x1FE
    // 0x1FE & 0x7F = 0x7E
    // 0x80 - 0x7E = 0x02
    expect(calculateChecksum([0xff, 0xff])).toBe(0x02);
  });
});

describe('buildDT1Message', () => {
  it('should build correct DT1 message structure', () => {
    const address = { aa: 0x04, bb: 0x00, cc: 0x00 };
    const data = [0x50];
    const message = buildDT1Message(address, data);

    expect(message[0]).toBe(0xf0); // SysEx start
    expect(message[1]).toBe(ROLAND_ID); // Roland ID
    expect(message[2]).toBe(DEFAULT_DEVICE_ID); // Device ID
    expect(message[3]).toBe(D110_MODEL_ID); // D-110 model ID
    expect(message[4]).toBe(D110_COMMANDS.DATA); // DT1 command
    expect(message[5]).toBe(0x04); // Address AA
    expect(message[6]).toBe(0x00); // Address BB
    expect(message[7]).toBe(0x00); // Address CC
    expect(message[8]).toBe(0x50); // Data
    expect(message[9]).toBe(0x2c); // Checksum
    expect(message[10]).toBe(0xf7); // SysEx end
  });

  it('should use custom device ID when provided', () => {
    const address = { aa: 0x04, bb: 0x00, cc: 0x00 };
    const message = buildDT1Message(address, [0x50], 0x11);

    expect(message[2]).toBe(0x11);
  });

  it('should handle multiple data bytes', () => {
    const address = { aa: 0x10, bb: 0x00, cc: 0x00 };
    const data = [0x01, 0x02, 0x03];
    const message = buildDT1Message(address, data);

    expect(message[8]).toBe(0x01);
    expect(message[9]).toBe(0x02);
    expect(message[10]).toBe(0x03);
    expect(message[message.length - 1]).toBe(0xf7);
  });
});

describe('buildRQ1Message', () => {
  it('should build correct RQ1 message structure', () => {
    const address = { aa: 0x04, bb: 0x00, cc: 0x00 };
    const size = 246; // Tone data size
    const message = buildRQ1Message(address, size);

    expect(message[0]).toBe(0xf0); // SysEx start
    expect(message[1]).toBe(ROLAND_ID); // Roland ID
    expect(message[2]).toBe(DEFAULT_DEVICE_ID); // Device ID
    expect(message[3]).toBe(D110_MODEL_ID); // D-110 model ID
    expect(message[4]).toBe(D110_COMMANDS.REQUEST); // RQ1 command
    expect(message[5]).toBe(0x04); // Address AA
    expect(message[6]).toBe(0x00); // Address BB
    expect(message[7]).toBe(0x00); // Address CC
    expect(message[8]).toBe(0x00); // Size padding
    // 246 = 0x01 << 7 | 0x76 = 0x01, 0x76
    expect(message[9]).toBe(0x01); // Size MSB
    expect(message[10]).toBe(0x76); // Size LSB
    expect(message[message.length - 1]).toBe(0xf7); // SysEx end
  });

  it('should encode size correctly for small values', () => {
    const address = { aa: 0x03, bb: 0x00, cc: 0x00 };
    const size = 16; // Part timbre size
    const message = buildRQ1Message(address, size);

    expect(message[9]).toBe(0x00); // Size MSB
    expect(message[10]).toBe(0x10); // Size LSB (16 = 0x10)
  });
});

describe('parseSysExMessage', () => {
  it('should parse valid DT1 response', () => {
    // Build a valid message then parse it
    const address = { aa: 0x04, bb: 0x00, cc: 0x00 };
    const data = [0x50, 0x60, 0x70];
    const message = buildDT1Message(address, data);

    const parsed = parseSysExMessage(message);

    expect(parsed.isValid).toBe(true);
    expect(parsed.deviceId).toBe(DEFAULT_DEVICE_ID);
    expect(parsed.command).toBe(D110_COMMANDS.DATA);
    expect(parsed.address).toEqual(address);
    expect(parsed.data).toEqual(data);
  });

  it('should reject messages that are too short', () => {
    const parsed = parseSysExMessage([0xf0, 0x41, 0x10]);

    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain('too short');
  });

  it('should reject messages with invalid delimiters', () => {
    const parsed = parseSysExMessage([0x00, 0x41, 0x10, 0x16, 0x12, 0x04, 0x00, 0x00, 0x50, 0x2c, 0xf7]);

    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain('Invalid SysEx delimiters');
  });

  it('should reject messages with wrong manufacturer ID', () => {
    const parsed = parseSysExMessage([0xf0, 0x42, 0x10, 0x16, 0x12, 0x04, 0x00, 0x00, 0x50, 0x2c, 0xf7]);

    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain('Not a Roland message');
  });

  it('should reject messages with wrong model ID', () => {
    const parsed = parseSysExMessage([0xf0, 0x41, 0x10, 0x17, 0x12, 0x04, 0x00, 0x00, 0x50, 0x2c, 0xf7]);

    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain('Not a D-110 message');
  });

  it('should detect checksum mismatch', () => {
    const message = [0xf0, 0x41, 0x10, 0x16, 0x12, 0x04, 0x00, 0x00, 0x50, 0xff, 0xf7]; // Wrong checksum

    const parsed = parseSysExMessage(message);

    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toContain('Checksum mismatch');
  });
});

describe('isD110Message', () => {
  it('should identify valid D-110 messages', () => {
    const message = [0xf0, 0x41, 0x10, 0x16, 0x12, 0x04, 0x00, 0x00, 0x50, 0x2c, 0xf7];
    expect(isD110Message(message)).toBe(true);
  });

  it('should reject non-D-110 messages', () => {
    expect(isD110Message([0xf0, 0x41, 0x10, 0x17, 0x12])).toBe(false); // Wrong model
    expect(isD110Message([0xf0, 0x42, 0x10, 0x16, 0x12])).toBe(false); // Wrong manufacturer
    expect(isD110Message([0xf0, 0x41])).toBe(false); // Too short
  });
});

describe('address calculation functions', () => {
  describe('getTempToneAddress', () => {
    it('should calculate correct address for part 0', () => {
      const address = getTempToneAddress(0);
      expect(address.aa).toBe(0x04);
      expect(address.bb).toBe(0x00);
      expect(address.cc).toBe(0x00);
    });

    it('should calculate correct address for part 1', () => {
      // Part 1: location = 1 * 246 = 246 = 0x00F6
      // BB = (246 >> 7) & 0x7F = 1
      // CC = 246 & 0x7F = 0x76
      const address = getTempToneAddress(1);
      expect(address.aa).toBe(0x04);
      expect(address.bb).toBe(0x01);
      expect(address.cc).toBe(0x76);
    });

    it('should throw for invalid part index', () => {
      expect(() => getTempToneAddress(-1)).toThrow();
      expect(() => getTempToneAddress(8)).toThrow();
    });
  });

  describe('getToneRamAddress', () => {
    it('should calculate correct address for tone 0', () => {
      const address = getToneRamAddress(0);
      expect(address.aa).toBe(0x08);
      expect(address.bb).toBe(0x00);
      expect(address.cc).toBe(0x00);
    });

    it('should calculate correct address for tone 32', () => {
      const address = getToneRamAddress(32);
      expect(address.aa).toBe(0x08);
      expect(address.bb).toBe(0x40); // 32 * 2 = 64 = 0x40
      expect(address.cc).toBe(0x00);
    });

    it('should throw for invalid tone index', () => {
      expect(() => getToneRamAddress(-1)).toThrow();
      expect(() => getToneRamAddress(64)).toThrow();
    });
  });

  describe('getPartTimbreAddress', () => {
    it('should calculate correct address for part 0', () => {
      const address = getPartTimbreAddress(0);
      expect(address.aa).toBe(0x03);
      expect(address.bb).toBe(0x00);
      expect(address.cc).toBe(0x00);
    });

    it('should calculate correct address for part 4', () => {
      const address = getPartTimbreAddress(4);
      expect(address.aa).toBe(0x03);
      expect(address.bb).toBe(0x40); // 4 * 0x10 = 0x40
      expect(address.cc).toBe(0x00);
    });

    it('should calculate correct address for rhythm (part 8)', () => {
      const address = getPartTimbreAddress(8);
      expect(address.aa).toBe(0x03);
      expect(address.bb).toBe(0x80); // 8 * 0x10 = 0x80
      expect(address.cc).toBe(0x00);
    });

    it('should throw for invalid part index', () => {
      expect(() => getPartTimbreAddress(-1)).toThrow();
      expect(() => getPartTimbreAddress(9)).toThrow();
    });
  });

  describe('getSystemAddress', () => {
    it('should return correct system address', () => {
      const address = getSystemAddress();
      expect(address.aa).toBe(0x10);
      expect(address.bb).toBe(0x00);
      expect(address.cc).toBe(0x00);
    });
  });

  describe('getPatchAddress', () => {
    it('should calculate correct address for patch 0', () => {
      const address = getPatchAddress(0);
      expect(address.aa).toBe(0x06);
      expect(address.bb).toBe(0x00);
      expect(address.cc).toBe(0x00);
    });

    it('should calculate correct address for patch 63', () => {
      const address = getPatchAddress(63);
      expect(address.aa).toBe(0x06);
      expect(address.bb).toBe(0x3f); // 63 = 0x3F
      expect(address.cc).toBe(0x00);
    });

    it('should throw for invalid patch index', () => {
      expect(() => getPatchAddress(-1)).toThrow();
      expect(() => getPatchAddress(64)).toThrow();
    });
  });
});
