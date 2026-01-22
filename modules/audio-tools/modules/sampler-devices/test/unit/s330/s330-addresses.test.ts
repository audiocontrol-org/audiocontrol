import { describe, it, expect } from 'vitest';
// Import from index.ts to get coverage on re-exports
import {
    // Device identification
    ROLAND_ID,
    S330_MODEL_ID,
    DEFAULT_DEVICE_ID,

    // Command bytes
    S330_COMMANDS,

    // Base addresses
    ADDR_SYSTEM,
    ADDR_PATCH_BASE,
    ADDR_TONE_BASE,
    ADDR_WAVE_DATA,

    // Offsets and sizes
    SYSTEM_OFFSETS,
    SYSTEM_BLOCK_SIZE,
    PATCH_COMMON_OFFSETS,
    PATCH_COMMON_SIZE,
    PATCH_PARTIALS_OFFSET,
    PARTIAL_OFFSETS,
    PARTIAL_SIZE,
    MAX_PARTIALS,
    MAX_PATCHES,
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
    MAX_TONES,

    // Bulk dump and errors
    BULK_DUMP_TYPES,
    ERROR_CODES,
    TIMING,
    VALUE_RANGES,

    // Helper functions
    buildPatchAddress,
    buildToneAddress,
    buildSystemAddress,
    calculateChecksum,
} from '@/devices/s330/index.js';

describe('S-330 Address Constants', () => {
    describe('Device Identification', () => {
        it('should have correct Roland manufacturer ID', () => {
            expect(ROLAND_ID).toBe(0x41);
        });

        it('should have correct S-330 model ID', () => {
            expect(S330_MODEL_ID).toBe(0x1E);
        });

        it('should have default device ID of 0', () => {
            expect(DEFAULT_DEVICE_ID).toBe(0x00);
        });
    });

    describe('Command Bytes', () => {
        it('should have correct RQ1 command', () => {
            expect(S330_COMMANDS.RQ1).toBe(0x11);
        });

        it('should have correct DT1 command', () => {
            expect(S330_COMMANDS.DT1).toBe(0x12);
        });

        it('should have correct WSD command', () => {
            expect(S330_COMMANDS.WSD).toBe(0x40);
        });

        it('should have correct RQD command', () => {
            expect(S330_COMMANDS.RQD).toBe(0x41);
        });

        it('should have correct DAT command', () => {
            expect(S330_COMMANDS.DAT).toBe(0x42);
        });

        it('should have correct ACK command', () => {
            expect(S330_COMMANDS.ACK).toBe(0x43);
        });

        it('should have correct EOD command', () => {
            expect(S330_COMMANDS.EOD).toBe(0x45);
        });

        it('should have correct ERR command', () => {
            expect(S330_COMMANDS.ERR).toBe(0x4E);
        });

        it('should have correct RJC command', () => {
            expect(S330_COMMANDS.RJC).toBe(0x4F);
        });
    });

    describe('Base Addresses', () => {
        it('should have correct system base address', () => {
            expect(ADDR_SYSTEM).toEqual([0x00, 0x00, 0x00, 0x00]);
        });

        it('should have correct patch base address', () => {
            expect(ADDR_PATCH_BASE).toEqual([0x00, 0x01, 0x00, 0x00]);
        });

        it('should have correct tone base address', () => {
            expect(ADDR_TONE_BASE).toEqual([0x00, 0x02, 0x00, 0x00]);
        });

        it('should have correct wave data base address', () => {
            expect(ADDR_WAVE_DATA).toEqual([0x01, 0x00, 0x00, 0x00]);
        });
    });

    describe('System Parameter Offsets', () => {
        it('should have master tune at offset 0', () => {
            expect(SYSTEM_OFFSETS.MASTER_TUNE).toBe(0x00);
        });

        it('should have master level at offset 1', () => {
            expect(SYSTEM_OFFSETS.MASTER_LEVEL).toBe(0x01);
        });

        it('should have MIDI channel at offset 2', () => {
            expect(SYSTEM_OFFSETS.MIDI_CHANNEL).toBe(0x02);
        });

        it('should have device ID at offset 3', () => {
            expect(SYSTEM_OFFSETS.DEVICE_ID).toBe(0x03);
        });

        it('should have correct system block size', () => {
            expect(SYSTEM_BLOCK_SIZE).toBe(0x0B);
        });
    });

    describe('Patch Parameter Offsets', () => {
        it('should have name at offset 0', () => {
            expect(PATCH_COMMON_OFFSETS.NAME).toBe(0x00);
        });

        it('should have bender range at offset 8', () => {
            expect(PATCH_COMMON_OFFSETS.BENDER_RANGE).toBe(0x08);
        });

        it('should have level at offset 15', () => {
            expect(PATCH_COMMON_OFFSETS.LEVEL).toBe(0x0F);
        });

        it('should have correct patch common size', () => {
            expect(PATCH_COMMON_SIZE).toBe(0x10);
        });

        it('should have partials starting at offset 16', () => {
            expect(PATCH_PARTIALS_OFFSET).toBe(0x10);
        });

        it('should have correct partial size', () => {
            expect(PARTIAL_SIZE).toBe(0x0B);
        });

        it('should allow up to 32 partials', () => {
            expect(MAX_PARTIALS).toBe(32);
        });

        it('should allow up to 64 patches', () => {
            expect(MAX_PATCHES).toBe(64);
        });
    });

    describe('Partial Offsets', () => {
        it('should have tone number at offset 0', () => {
            expect(PARTIAL_OFFSETS.TONE_NUMBER).toBe(0x00);
        });

        it('should have key range low at offset 1', () => {
            expect(PARTIAL_OFFSETS.KEY_RANGE_LOW).toBe(0x01);
        });

        it('should have pan at offset 6', () => {
            expect(PARTIAL_OFFSETS.PAN).toBe(0x06);
        });

        it('should have mute at offset 10', () => {
            expect(PARTIAL_OFFSETS.MUTE).toBe(0x0A);
        });
    });

    describe('Tone Parameter Offsets', () => {
        it('should have name at offset 0', () => {
            expect(TONE_OFFSETS.NAME).toBe(0x00);
        });

        it('should have original key at offset 8', () => {
            expect(TONE_OFFSETS.ORIGINAL_KEY).toBe(0x08);
        });

        it('should have loop mode at offset 19', () => {
            expect(TONE_OFFSETS.LOOP_MODE).toBe(0x13);
        });

        it('should have LFO destination at offset 37', () => {
            expect(TONE_OFFSETS.LFO_DESTINATION).toBe(0x25);
        });

        it('should have correct tone block size', () => {
            expect(TONE_BLOCK_SIZE).toBe(0x26);
        });

        it('should allow up to 32 tones', () => {
            expect(MAX_TONES).toBe(32);
        });
    });

    describe('Bulk Dump Types', () => {
        it('should have correct all patches type', () => {
            expect(BULK_DUMP_TYPES.ALL_PATCHES).toBe(0x00);
        });

        it('should have correct all tones type', () => {
            expect(BULK_DUMP_TYPES.ALL_TONES).toBe(0x01);
        });

        it('should have correct single patch type', () => {
            expect(BULK_DUMP_TYPES.SINGLE_PATCH).toBe(0x02);
        });

        it('should have correct single tone type', () => {
            expect(BULK_DUMP_TYPES.SINGLE_TONE).toBe(0x03);
        });

        it('should have correct wave data type', () => {
            expect(BULK_DUMP_TYPES.WAVE_DATA).toBe(0x04);
        });

        it('should have correct all data type', () => {
            expect(BULK_DUMP_TYPES.ALL_DATA).toBe(0x7F);
        });
    });

    describe('Error Codes', () => {
        it('should have checksum error code 0', () => {
            expect(ERROR_CODES.CHECKSUM).toBe(0x00);
        });

        it('should have unknown command error code 1', () => {
            expect(ERROR_CODES.UNKNOWN_COMMAND).toBe(0x01);
        });

        it('should have wrong format error code 2', () => {
            expect(ERROR_CODES.WRONG_FORMAT).toBe(0x02);
        });

        it('should have memory full error code 3', () => {
            expect(ERROR_CODES.MEMORY_FULL).toBe(0x03);
        });

        it('should have out of range error code 4', () => {
            expect(ERROR_CODES.OUT_OF_RANGE).toBe(0x04);
        });
    });

    describe('Timing Constants', () => {
        it('should have 1ms inter-byte delay', () => {
            expect(TIMING.INTER_BYTE_DELAY_MS).toBe(1);
        });

        it('should have 500ms ACK timeout', () => {
            expect(TIMING.ACK_TIMEOUT_MS).toBe(500);
        });

        it('should have 100ms retry delay', () => {
            expect(TIMING.RETRY_DELAY_MS).toBe(100);
        });

        it('should have 3 max retries', () => {
            expect(TIMING.MAX_RETRIES).toBe(3);
        });

        it('should have 256 byte max packet size', () => {
            expect(TIMING.MAX_PACKET_SIZE).toBe(256);
        });
    });

    describe('Value Ranges', () => {
        it('should have correct device ID range', () => {
            expect(VALUE_RANGES.DEVICE_ID).toEqual({ min: 0x00, max: 0x1F });
        });

        it('should have correct MIDI channel range', () => {
            expect(VALUE_RANGES.MIDI_CHANNEL).toEqual({ min: 0x00, max: 0x0F });
        });

        it('should have correct bender range', () => {
            expect(VALUE_RANGES.BENDER_RANGE).toEqual({ min: 0x00, max: 0x0C });
        });

        it('should have correct 7-bit range', () => {
            expect(VALUE_RANGES.STANDARD_7BIT).toEqual({ min: 0x00, max: 0x7F });
        });

        it('should have correct tone number range', () => {
            expect(VALUE_RANGES.TONE_NUMBER).toEqual({ min: 0x00, max: 0x1F });
        });

        it('should have correct patch number range', () => {
            expect(VALUE_RANGES.PATCH_NUMBER).toEqual({ min: 0x00, max: 0x3F });
        });
    });
});

describe('S-330 Address Builder Functions', () => {
    describe('buildPatchAddress', () => {
        it('should build address for patch 0, offset 0', () => {
            const address = buildPatchAddress(0, 0);
            expect(address).toEqual([0x00, 0x01, 0x00, 0x00]);
        });

        it('should build address for patch 5, offset 8 (bender range)', () => {
            const address = buildPatchAddress(5, 0x08);
            expect(address).toEqual([0x00, 0x01, 0x05, 0x08]);
        });

        it('should build address for patch 63 (max), offset 15 (level)', () => {
            const address = buildPatchAddress(63, 0x0F);
            expect(address).toEqual([0x00, 0x01, 0x3F, 0x0F]);
        });

        it('should mask patch number to 6 bits', () => {
            const address = buildPatchAddress(0xFF, 0x00);
            expect(address[2]).toBe(0x3F); // 0xFF & 0x3F = 0x3F
        });

        it('should mask offset to 7 bits', () => {
            const address = buildPatchAddress(0, 0xFF);
            expect(address[3]).toBe(0x7F); // 0xFF & 0x7F = 0x7F
        });
    });

    describe('buildToneAddress', () => {
        it('should build address for tone 0, offset 0', () => {
            const address = buildToneAddress(0, 0);
            expect(address).toEqual([0x00, 0x02, 0x00, 0x00]);
        });

        it('should build address for tone 10, offset 8 (original key)', () => {
            const address = buildToneAddress(10, 0x08);
            expect(address).toEqual([0x00, 0x02, 0x0A, 0x08]);
        });

        it('should build address for tone 31 (max), offset 37 (LFO dest)', () => {
            const address = buildToneAddress(31, 0x25);
            expect(address).toEqual([0x00, 0x02, 0x1F, 0x25]);
        });

        it('should mask tone number to 5 bits', () => {
            const address = buildToneAddress(0xFF, 0x00);
            expect(address[2]).toBe(0x1F); // 0xFF & 0x1F = 0x1F
        });

        it('should mask offset to 7 bits', () => {
            const address = buildToneAddress(0, 0xFF);
            expect(address[3]).toBe(0x7F); // 0xFF & 0x7F = 0x7F
        });
    });

    describe('buildSystemAddress', () => {
        it('should build address for offset 0 (master tune)', () => {
            const address = buildSystemAddress(0);
            expect(address).toEqual([0x00, 0x00, 0x00, 0x00]);
        });

        it('should build address for offset 2 (MIDI channel)', () => {
            const address = buildSystemAddress(0x02);
            expect(address).toEqual([0x00, 0x00, 0x00, 0x02]);
        });

        it('should build address for offset 10 (hold pedal)', () => {
            const address = buildSystemAddress(0x0A);
            expect(address).toEqual([0x00, 0x00, 0x00, 0x0A]);
        });

        it('should mask offset to 7 bits', () => {
            const address = buildSystemAddress(0xFF);
            expect(address[3]).toBe(0x7F); // 0xFF & 0x7F = 0x7F
        });
    });

    describe('calculateChecksum', () => {
        it('should calculate checksum for simple address and data', () => {
            // Example from documentation: address 00 01 00 08, data 40
            // sum = 0 + 1 + 0 + 8 + 64 = 73 (0x49)
            // checksum = 128 - (73 & 0x7F) = 128 - 73 = 55 (0x37)
            const address = [0x00, 0x01, 0x00, 0x08];
            const data = [0x40];
            const checksum = calculateChecksum(address, data);
            expect(checksum).toBe(0x37);
        });

        it('should calculate checksum for empty data', () => {
            const address = [0x00, 0x00, 0x00, 0x00];
            const data: number[] = [];
            const checksum = calculateChecksum(address, data);
            // sum = 0, checksum = 128 - 0 = 128, but 128 becomes 0
            expect(checksum).toBe(0);
        });

        it('should return 0 when checksum would be 128', () => {
            // Need sum to be 0 mod 128
            const address = [0x00, 0x00, 0x00, 0x00];
            const data: number[] = [];
            const checksum = calculateChecksum(address, data);
            expect(checksum).toBe(0);
        });

        it('should handle larger values correctly', () => {
            const address = [0x01, 0x02, 0x03, 0x04];
            const data = [0x10, 0x20, 0x30];
            // sum = 1 + 2 + 3 + 4 + 16 + 32 + 48 = 106 (0x6A)
            // checksum = 128 - (106 & 0x7F) = 128 - 106 = 22 (0x16)
            const checksum = calculateChecksum(address, data);
            expect(checksum).toBe(0x16);
        });

        it('should wrap correctly for sums > 127', () => {
            const address = [0x7F, 0x7F, 0x7F, 0x7F];
            const data = [0x7F];
            // sum = 127 * 5 = 635, 635 & 0x7F = 635 - 512 - 128 = -5... let me recalculate
            // 635 in binary = 1001111011, & 0x7F (01111111) = 1111011 = 123
            // checksum = 128 - 123 = 5
            const checksum = calculateChecksum(address, data);
            expect(checksum).toBe(5);
        });

        it('should handle multi-byte data correctly', () => {
            const address = [0x00, 0x02, 0x05, 0x00];
            const data = [0x54, 0x45, 0x53, 0x54, 0x20, 0x20, 0x20, 0x20]; // "TEST    "
            // sum = 0 + 2 + 5 + 0 + 84 + 69 + 83 + 84 + 32 + 32 + 32 + 32 = 455
            // 455 & 0x7F = 455 - 384 = 71
            // checksum = 128 - 71 = 57 (0x39)
            const checksum = calculateChecksum(address, data);
            expect(checksum).toBe(0x39);
        });
    });
});
