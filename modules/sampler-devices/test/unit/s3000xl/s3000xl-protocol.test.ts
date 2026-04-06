import { describe, it, expect } from 'vitest';
import {
  AkaiOpcode,
  AKAI_MANUFACTURER_ID,
  S3000XL_DEVICE_ID,
  SYSEX_START,
  SYSEX_END,
  buildAkaiSysEx,
  parseAkaiResponse,
  isErrorResponse,
  parseNameList,
} from '@/devices/s3000xl/s3000xl-protocol.js';

describe('buildAkaiSysEx', () => {
  it('builds a correct SysEx message with no data', () => {
    const msg = buildAkaiSysEx(0x00, AkaiOpcode.RSTAT, []);
    expect(msg).toEqual([
      SYSEX_START,
      AKAI_MANUFACTURER_ID,
      0x00,
      AkaiOpcode.RSTAT,
      S3000XL_DEVICE_ID,
      SYSEX_END,
    ]);
  });

  it('builds a correct SysEx message with data', () => {
    const msg = buildAkaiSysEx(0x02, AkaiOpcode.RPDATA, [0x03, 0x00]);
    expect(msg).toEqual([
      SYSEX_START,
      AKAI_MANUFACTURER_ID,
      0x02,
      AkaiOpcode.RPDATA,
      S3000XL_DEVICE_ID,
      0x03,
      0x00,
      SYSEX_END,
    ]);
  });

  it('uses the correct manufacturer ID (0x47)', () => {
    const msg = buildAkaiSysEx(0, AkaiOpcode.RSTAT, []);
    expect(msg[1]).toBe(0x47);
  });

  it('uses the correct device ID (0x48)', () => {
    const msg = buildAkaiSysEx(0, AkaiOpcode.RSTAT, []);
    expect(msg[4]).toBe(0x48);
  });
});

describe('parseAkaiResponse', () => {
  it('parses a valid response', () => {
    const response = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.STAT, S3000XL_DEVICE_ID, 0x01, 0x02, SYSEX_END];
    const result = parseAkaiResponse(response);
    expect(result.opcode).toBe(AkaiOpcode.STAT);
    expect(result.data).toEqual([0x01, 0x02]);
  });

  it('returns empty data for minimal response', () => {
    const response = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.STAT, S3000XL_DEVICE_ID, SYSEX_END];
    const result = parseAkaiResponse(response);
    expect(result.opcode).toBe(AkaiOpcode.STAT);
    expect(result.data).toEqual([]);
  });

  it('throws on message too short', () => {
    expect(() => parseAkaiResponse([0xf0, 0x47, 0x00])).toThrow('expected at least 6 bytes');
  });

  it('throws on wrong manufacturer ID', () => {
    expect(() => parseAkaiResponse([SYSEX_START, 0x41, 0x00, 0x01, S3000XL_DEVICE_ID, SYSEX_END])).toThrow('Invalid manufacturer ID');
  });
});

describe('isErrorResponse', () => {
  it('returns true for REPLY with non-zero error code', () => {
    const response = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.REPLY, S3000XL_DEVICE_ID, 0x01, SYSEX_END];
    expect(isErrorResponse(response)).toBe(true);
  });

  it('returns false for REPLY with error code 0 (OK)', () => {
    const response = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.REPLY, S3000XL_DEVICE_ID, 0x00, SYSEX_END];
    expect(isErrorResponse(response)).toBe(false);
  });

  it('returns false for non-REPLY opcode', () => {
    const response = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.PDATA, S3000XL_DEVICE_ID, SYSEX_END];
    expect(isErrorResponse(response)).toBe(false);
  });

  it('returns false for too-short message', () => {
    expect(isErrorResponse([0xf0])).toBe(false);
  });
});

describe('parseNameList', () => {
  it('parses a list with one name', () => {
    // Build a fake PLIST response:
    // Header: F0 47 00 03 48
    // Count: 01 00 (LE = 1)
    // Name: 12 bytes of Akai-encoded chars
    // Footer: F7
    const header = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.PLIST, S3000XL_DEVICE_ID];
    const count = [0x01, 0x00]; // 1 name
    // Akai encoding: 'A' = 11, 'B' = 12, space = 10
    const nameBytes = [11, 12, 13, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // "ABC         "
    const message = [...header, ...count, ...nameBytes, SYSEX_END];

    const names = parseNameList(message, 12);
    expect(names).toHaveLength(1);
    expect(names[0].trim()).toBe('ABC');
  });

  it('parses empty list', () => {
    const header = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.PLIST, S3000XL_DEVICE_ID];
    const count = [0x00, 0x00];
    const message = [...header, ...count, SYSEX_END];

    const names = parseNameList(message, 12);
    expect(names).toHaveLength(0);
  });

  it('parses multiple names', () => {
    const header = [SYSEX_START, AKAI_MANUFACTURER_ID, 0x00, AkaiOpcode.PLIST, S3000XL_DEVICE_ID];
    const count = [0x02, 0x00]; // 2 names
    const name1 = [11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // "A           "
    const name2 = [12, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]; // "B           "
    const message = [...header, ...count, ...name1, ...name2, SYSEX_END];

    const names = parseNameList(message, 12);
    expect(names).toHaveLength(2);
    expect(names[0].trim()).toBe('A');
    expect(names[1].trim()).toBe('B');
  });
});

describe('AkaiOpcode', () => {
  it('has correct opcode values', () => {
    expect(AkaiOpcode.RSTAT).toBe(0x00);
    expect(AkaiOpcode.RPLIST).toBe(0x02);
    expect(AkaiOpcode.RSLIST).toBe(0x04);
    expect(AkaiOpcode.RPDATA).toBe(0x06);
    expect(AkaiOpcode.RKDATA).toBe(0x08);
    expect(AkaiOpcode.RSDATA).toBe(0x0a);
    expect(AkaiOpcode.REPLY).toBe(0x16);
    expect(AkaiOpcode.CASPACK).toBe(0x1d);
  });
});
