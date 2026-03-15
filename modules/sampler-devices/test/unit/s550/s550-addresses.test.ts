/**
 * S-550 Address Map Tests
 */

import { describe, it, expect } from 'vitest';
import {
    // Constants
    ROLAND_ID,
    S550_MODEL_ID,
    DEFAULT_DEVICE_ID,
    S550_COMMANDS,
    ADDR_SYSTEM,
    ADDR_PATCH_BASE,
    ADDR_TONE_BASE,
    ADDR_WAVE_DATA,
    TONE_STRIDE,
    SYSTEM_OFFSETS,
    SYSTEM_BLOCK_SIZE,
    PATCH_COMMON_OFFSETS,
    PATCH_TOTAL_SIZE,
    TONE_MAP_ENTRIES,
    MAX_PATCHES,
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
    TONE_BLOCK_NIBBLES,
    MAX_TONES,
    VALUE_RANGES,
    BULK_DUMP_TYPES,
    ERROR_CODES,
    TIMING,

    // Functions
    buildPatchAddress,
    buildPatchParamAddress,
    buildToneAddress,
    buildSystemAddress,
    calculateChecksum,
    PATCH_PARAMS,
} from '@/devices/s550/index.js';

describe('S-550 Constants', () => {
    describe('Device Identification', () => {
        it('should have correct Roland manufacturer ID', () => {
            expect(ROLAND_ID).toBe(0x41);
        });

        it('should have correct S-550 model ID (same as S-330)', () => {
            expect(S550_MODEL_ID).toBe(0x1E);
        });

        it('should have correct default device ID', () => {
            expect(DEFAULT_DEVICE_ID).toBe(0x00);
        });
    });

    describe('S-550 Memory Layout', () => {
        it('should have 32 patches (vs S-330\'s 64)', () => {
            expect(MAX_PATCHES).toBe(32);
        });

        it('should have 64 tones (vs S-330\'s 32)', () => {
            expect(MAX_TONES).toBe(64);
        });

        it('should have correct tone stride', () => {
            expect(TONE_STRIDE).toBe(2);
        });
    });

    describe('Value Ranges', () => {
        it('should have correct tone number range (0-63)', () => {
            expect(VALUE_RANGES.TONE_NUMBER.min).toBe(0x00);
            expect(VALUE_RANGES.TONE_NUMBER.max).toBe(0x3F);
        });

        it('should have correct patch number range (0-31)', () => {
            expect(VALUE_RANGES.PATCH_NUMBER.min).toBe(0x00);
            expect(VALUE_RANGES.PATCH_NUMBER.max).toBe(0x1F);
        });

        it('should have correct wave bank range (0-3 for A, B, C, D)', () => {
            expect(VALUE_RANGES.WAVE_BANK.min).toBe(0x00);
            expect(VALUE_RANGES.WAVE_BANK.max).toBe(0x03);
        });
    });

    describe('Commands', () => {
        it('should have correct command values', () => {
            // RQD is 0x41 per S-series protocol
            expect(S550_COMMANDS.RQD).toBe(0x41);
            expect(S550_COMMANDS.WSD).toBe(0x40);
            expect(S550_COMMANDS.DAT).toBe(0x42);
            expect(S550_COMMANDS.DT1).toBe(0x12);
            expect(S550_COMMANDS.ACK).toBe(0x43);
            expect(S550_COMMANDS.EOD).toBe(0x45);
            expect(S550_COMMANDS.RJC).toBe(0x4F);
            expect(S550_COMMANDS.ERR).toBe(0x4E);
        });
    });

    describe('Base Addresses', () => {
        it('should have correct system address', () => {
            expect(ADDR_SYSTEM).toEqual([0x00, 0x00, 0x00, 0x00]);
        });

        it('should have correct patch base address', () => {
            expect(ADDR_PATCH_BASE).toEqual([0x00, 0x00, 0x00, 0x00]);
        });

        it('should have correct tone base address', () => {
            expect(ADDR_TONE_BASE).toEqual([0x00, 0x03, 0x00, 0x00]);
        });

        it('should have correct wave data address', () => {
            expect(ADDR_WAVE_DATA).toEqual([0x01, 0x00, 0x00, 0x00]);
        });
    });

    describe('Block Sizes', () => {
        it('should have correct patch total size', () => {
            expect(PATCH_TOTAL_SIZE).toBe(512);
        });

        it('should have correct tone block size', () => {
            expect(TONE_BLOCK_SIZE).toBe(256);
        });

        it('should have correct tone block nibbles', () => {
            expect(TONE_BLOCK_NIBBLES).toBe(512);
        });

        it('should have correct tone map entries', () => {
            expect(TONE_MAP_ENTRIES).toBe(109);
        });
    });

    describe('System Offsets', () => {
        it('should have correct system parameter offsets', () => {
            expect(SYSTEM_OFFSETS.MASTER_TUNE).toBe(0x00);
            expect(SYSTEM_OFFSETS.MASTER_LEVEL).toBe(0x01);
            expect(SYSTEM_OFFSETS.MIDI_CHANNEL).toBe(0x02);
            expect(SYSTEM_OFFSETS.DEVICE_ID).toBe(0x03);
        });

        it('should have correct system block size', () => {
            expect(SYSTEM_BLOCK_SIZE).toBe(0x0B);
        });
    });

    describe('Patch Parameter Offsets', () => {
        it('should have correct basic patch offsets', () => {
            expect(PATCH_COMMON_OFFSETS.NAME).toBe(0);
            expect(PATCH_COMMON_OFFSETS.BENDER_RANGE).toBe(12);
            expect(PATCH_COMMON_OFFSETS.KEY_MODE).toBe(15);
        });

        it('should have correct tone layer offsets', () => {
            expect(PATCH_COMMON_OFFSETS.TONE_LAYER_1).toBe(17);
            expect(PATCH_COMMON_OFFSETS.TONE_LAYER_2).toBe(126);
        });
    });

    describe('Tone Offsets', () => {
        it('should have correct basic tone offsets', () => {
            expect(TONE_OFFSETS.NAME).toBe(0);
            expect(TONE_OFFSETS.OUTPUT_ASSIGN).toBe(8);
            expect(TONE_OFFSETS.SOURCE_TONE).toBe(9);
        });

        it('should have correct wave parameter offsets', () => {
            expect(TONE_OFFSETS.WAVE_BANK).toBe(13);
            expect(TONE_OFFSETS.WAVE_SEGMENT_TOP).toBe(14);
            expect(TONE_OFFSETS.WAVE_SEGMENT_LENGTH).toBe(15);
        });

        it('should have correct wave point offsets', () => {
            expect(TONE_OFFSETS.START_POINT).toBe(16);
            expect(TONE_OFFSETS.END_POINT).toBe(19);
            expect(TONE_OFFSETS.LOOP_POINT).toBe(22);
            expect(TONE_OFFSETS.LOOP_MODE).toBe(25);
        });

        it('should have correct LFO offsets', () => {
            expect(TONE_OFFSETS.LFO_RATE).toBe(28);
            expect(TONE_OFFSETS.LFO_DELAY).toBe(30);
            expect(TONE_OFFSETS.LFO_MODE).toBe(32);
        });

        it('should have correct TVA envelope offsets', () => {
            expect(TONE_OFFSETS.TVA_ENV_SUSTAIN_POINT).toBe(51);
            expect(TONE_OFFSETS.TVA_ENV_END_POINT).toBe(52);
            expect(TONE_OFFSETS.TVA_ENV_LEVEL_1).toBe(53);
        });

        it('should have correct TVF envelope offsets', () => {
            expect(TONE_OFFSETS.TVF_ENV_SUSTAIN_POINT).toBe(107);
            expect(TONE_OFFSETS.TVF_ENV_END_POINT).toBe(108);
            expect(TONE_OFFSETS.TVF_ENV_LEVEL_1).toBe(109);
        });
    });
});

describe('S-550 Address Building Functions', () => {
    describe('buildPatchAddress', () => {
        it('should build correct address for patch 0', () => {
            const addr = buildPatchAddress(0, 0x00);
            expect(addr).toEqual([0x00, 0x00, 0x00, 0x00]);
        });

        it('should build correct address for patch 1', () => {
            const addr = buildPatchAddress(1, 0x00);
            expect(addr).toEqual([0x00, 0x00, 0x04, 0x00]);
        });

        it('should build correct address for patch 31 (last S-550 patch)', () => {
            const addr = buildPatchAddress(31, 0x00);
            expect(addr).toEqual([0x00, 0x00, 0x7C, 0x00]);
        });

        it('should build correct address with offset', () => {
            const addr = buildPatchAddress(0, 0x18);
            expect(addr).toEqual([0x00, 0x00, 0x00, 0x18]);
        });
    });

    describe('buildPatchParamAddress', () => {
        it('should build correct address for patch name', () => {
            const addr = buildPatchParamAddress(0, PATCH_PARAMS.name);
            expect(addr).toEqual([0x00, 0x00, 0x00, 0x00]);
        });

        it('should build correct address for bender range', () => {
            const addr = buildPatchParamAddress(0, PATCH_PARAMS.benderRange);
            expect(addr).toEqual([0x00, 0x00, 0x00, 0x18]);
        });

        it('should build correct address for patch 5 bender range', () => {
            const addr = buildPatchParamAddress(5, PATCH_PARAMS.benderRange);
            expect(addr).toEqual([0x00, 0x00, 0x14, 0x18]);
        });
    });

    describe('buildToneAddress', () => {
        it('should build correct address for tone 0', () => {
            const addr = buildToneAddress(0, 0x00);
            expect(addr).toEqual([0x00, 0x03, 0x00, 0x00]);
        });

        it('should build correct address for tone 1', () => {
            const addr = buildToneAddress(1, 0x00);
            expect(addr).toEqual([0x00, 0x03, 0x02, 0x00]);
        });

        it('should build correct address for tone 31', () => {
            const addr = buildToneAddress(31, 0x00);
            expect(addr).toEqual([0x00, 0x03, 0x3E, 0x00]);
        });

        it('should build correct address for tone 32 (first extended S-550 tone)', () => {
            const addr = buildToneAddress(32, 0x00);
            expect(addr).toEqual([0x00, 0x03, 0x40, 0x00]);
        });

        it('should build correct address for tone 63 (last S-550 tone)', () => {
            const addr = buildToneAddress(63, 0x00);
            expect(addr).toEqual([0x00, 0x03, 0x7E, 0x00]);
        });

        it('should build correct address with offset', () => {
            const addr = buildToneAddress(0, TONE_OFFSETS.NAME);
            expect(addr).toEqual([0x00, 0x03, 0x00, 0x00]);
        });

        it('should build correct address with wave bank offset', () => {
            const addr = buildToneAddress(0, TONE_OFFSETS.WAVE_BANK);
            expect(addr).toEqual([0x00, 0x03, 0x00, 0x0D]);
        });
    });

    describe('buildSystemAddress', () => {
        it('should build correct address for master tune', () => {
            const addr = buildSystemAddress(SYSTEM_OFFSETS.MASTER_TUNE);
            expect(addr).toEqual([0x00, 0x00, 0x00, 0x00]);
        });

        it('should build correct address for master level', () => {
            const addr = buildSystemAddress(SYSTEM_OFFSETS.MASTER_LEVEL);
            expect(addr).toEqual([0x00, 0x00, 0x00, 0x01]);
        });

        it('should build correct address for MIDI channel', () => {
            const addr = buildSystemAddress(SYSTEM_OFFSETS.MIDI_CHANNEL);
            expect(addr).toEqual([0x00, 0x00, 0x00, 0x02]);
        });
    });
});

describe('calculateChecksum', () => {
    it('should calculate correct checksum for zero address and empty data', () => {
        const checksum = calculateChecksum([0x00, 0x00, 0x00, 0x00], []);
        expect(checksum).toBe(0x00);
    });

    it('should calculate correct checksum for address + data', () => {
        // Checksum is: 128 - (sum of all bytes & 0x7F)
        const address = [0x00, 0x03, 0x00, 0x00];
        const data = [0x7F];
        const checksum = calculateChecksum(address, data);
        // Sum = 3 + 127 = 130, 130 & 0x7F = 2, 128 - 2 = 126
        expect(checksum).toBe(126);
    });

    it('should return 0 when checksum would be 128', () => {
        // If sum & 0x7F = 0, then 128 - 0 = 128, which should become 0
        const checksum = calculateChecksum([0x00, 0x00, 0x00, 0x00], [0x00]);
        expect(checksum).toBe(0);
    });
});

describe('Bulk Dump Types', () => {
    it('should have correct bulk dump types', () => {
        expect(BULK_DUMP_TYPES.ALL_PATCHES).toBe(0x00);
        expect(BULK_DUMP_TYPES.ALL_TONES).toBe(0x01);
        expect(BULK_DUMP_TYPES.SINGLE_PATCH).toBe(0x02);
        expect(BULK_DUMP_TYPES.SINGLE_TONE).toBe(0x03);
        expect(BULK_DUMP_TYPES.WAVE_DATA).toBe(0x04);
        expect(BULK_DUMP_TYPES.ALL_DATA).toBe(0x7F);
    });
});

describe('Error Codes', () => {
    it('should have correct error codes', () => {
        expect(ERROR_CODES.CHECKSUM).toBe(0x00);
        expect(ERROR_CODES.UNKNOWN_COMMAND).toBe(0x01);
        expect(ERROR_CODES.WRONG_FORMAT).toBe(0x02);
        expect(ERROR_CODES.MEMORY_FULL).toBe(0x03);
        expect(ERROR_CODES.OUT_OF_RANGE).toBe(0x04);
    });
});

describe('Timing Constants', () => {
    it('should have timing constants defined', () => {
        expect(TIMING.ACK_TIMEOUT_MS).toBeDefined();
        expect(TIMING.ACK_TIMEOUT_MS).toBeGreaterThan(0);
        expect(TIMING.INTER_BYTE_DELAY_MS).toBeDefined();
        expect(TIMING.MAX_RETRIES).toBeDefined();
    });
});
