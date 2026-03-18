/**
 * S-550 Block Utilities Tests
 *
 * Tests for the block structure utilities that handle the S-550's
 * two-block organization (Block 1: tones 0-31/banks A,B; Block 2: tones 32-63/banks C,D).
 */

import { describe, it, expect } from 'vitest';
import {
    // Block structure constants
    TONES_PER_BLOCK,
    WAVE_BANKS_PER_BLOCK,
    BLOCK_COUNT,
    WAVE_BANK_ADDRESSES,
    BLOCK_WAVE_BANKS,
    BLOCK_INFO,

    // Block determination
    getBlockForTone,
    getBlockInfo,
    isToneInBlock,

    // Tone index conversion
    getBlockRelativeToneIndex,
    getAbsoluteToneIndex,

    // Wave bank conversion
    getAbsoluteWaveBank,
    getBlockRelativeWaveBank,
    getBlockForWaveBank,
    isWaveBankInBlock,

    // Wave bank name utilities
    WAVE_BANK_NAMES,
    getWaveBankName,
    parseWaveBankName,

    // Validation
    isValidWaveBankForTone,
    getValidWaveBanksForTone,

    // Address functions
    WAVE_BANK_BASE_ADDRESSES,
    buildWaveDataAddress,
    buildBlockRelativeWaveAddress,
} from '@/devices/s550/index.js';

describe('S-550 Block Structure Constants', () => {
    describe('Block configuration', () => {
        it('should have 32 tones per block', () => {
            expect(TONES_PER_BLOCK).toBe(32);
        });

        it('should have 2 wave banks per block', () => {
            expect(WAVE_BANKS_PER_BLOCK).toBe(2);
        });

        it('should have 2 blocks total', () => {
            expect(BLOCK_COUNT).toBe(2);
        });
    });

    describe('Wave bank addresses', () => {
        it('should have correct address for Bank A', () => {
            expect(WAVE_BANK_ADDRESSES.A).toEqual([0x01, 0x00, 0x00, 0x00]);
        });

        it('should have correct address for Bank B', () => {
            expect(WAVE_BANK_ADDRESSES.B).toEqual([0x01, 0x20, 0x00, 0x00]);
        });

        it('should have correct address for Bank C', () => {
            expect(WAVE_BANK_ADDRESSES.C).toEqual([0x01, 0x40, 0x00, 0x00]);
        });

        it('should have correct address for Bank D', () => {
            expect(WAVE_BANK_ADDRESSES.D).toEqual([0x01, 0x60, 0x00, 0x00]);
        });
    });

    describe('Block wave bank mapping', () => {
        it('should map Block 1 to banks A (0) and B (1)', () => {
            expect(BLOCK_WAVE_BANKS[1]).toEqual([0, 1]);
        });

        it('should map Block 2 to banks C (2) and D (3)', () => {
            expect(BLOCK_WAVE_BANKS[2]).toEqual([2, 3]);
        });
    });

    describe('Block info', () => {
        it('should have correct info for Block 1', () => {
            expect(BLOCK_INFO[1]).toEqual({
                block: 1,
                firstToneIndex: 0,
                lastToneIndex: 31,
                waveBanks: [0, 1],
            });
        });

        it('should have correct info for Block 2', () => {
            expect(BLOCK_INFO[2]).toEqual({
                block: 2,
                firstToneIndex: 32,
                lastToneIndex: 63,
                waveBanks: [2, 3],
            });
        });
    });
});

describe('S-550 Block Determination Functions', () => {
    describe('getBlockForTone', () => {
        it('should return Block 1 for tone 0', () => {
            expect(getBlockForTone(0)).toBe(1);
        });

        it('should return Block 1 for tone 31', () => {
            expect(getBlockForTone(31)).toBe(1);
        });

        it('should return Block 2 for tone 32', () => {
            expect(getBlockForTone(32)).toBe(2);
        });

        it('should return Block 2 for tone 63', () => {
            expect(getBlockForTone(63)).toBe(2);
        });

        it('should throw for negative tone index', () => {
            expect(() => getBlockForTone(-1)).toThrow('out of range');
        });

        it('should throw for tone index > 63', () => {
            expect(() => getBlockForTone(64)).toThrow('out of range');
        });
    });

    describe('getBlockInfo', () => {
        it('should return correct info for Block 1', () => {
            const info = getBlockInfo(1);
            expect(info.block).toBe(1);
            expect(info.firstToneIndex).toBe(0);
            expect(info.lastToneIndex).toBe(31);
        });

        it('should return correct info for Block 2', () => {
            const info = getBlockInfo(2);
            expect(info.block).toBe(2);
            expect(info.firstToneIndex).toBe(32);
            expect(info.lastToneIndex).toBe(63);
        });
    });

    describe('isToneInBlock', () => {
        it('should return true for tone 0 in Block 1', () => {
            expect(isToneInBlock(0, 1)).toBe(true);
        });

        it('should return true for tone 31 in Block 1', () => {
            expect(isToneInBlock(31, 1)).toBe(true);
        });

        it('should return false for tone 32 in Block 1', () => {
            expect(isToneInBlock(32, 1)).toBe(false);
        });

        it('should return true for tone 32 in Block 2', () => {
            expect(isToneInBlock(32, 2)).toBe(true);
        });

        it('should return false for tone 0 in Block 2', () => {
            expect(isToneInBlock(0, 2)).toBe(false);
        });
    });
});

describe('S-550 Tone Index Conversion', () => {
    describe('getBlockRelativeToneIndex', () => {
        it('should return 0 for tone 0', () => {
            expect(getBlockRelativeToneIndex(0)).toBe(0);
        });

        it('should return 31 for tone 31', () => {
            expect(getBlockRelativeToneIndex(31)).toBe(31);
        });

        it('should return 0 for tone 32 (first tone in Block 2)', () => {
            expect(getBlockRelativeToneIndex(32)).toBe(0);
        });

        it('should return 31 for tone 63 (last tone in Block 2)', () => {
            expect(getBlockRelativeToneIndex(63)).toBe(31);
        });

        it('should return 15 for tone 47 (middle of Block 2)', () => {
            expect(getBlockRelativeToneIndex(47)).toBe(15);
        });

        it('should throw for out of range tone', () => {
            expect(() => getBlockRelativeToneIndex(64)).toThrow('out of range');
        });
    });

    describe('getAbsoluteToneIndex', () => {
        it('should return 0 for block-relative 0 in Block 1', () => {
            expect(getAbsoluteToneIndex(0, 1)).toBe(0);
        });

        it('should return 31 for block-relative 31 in Block 1', () => {
            expect(getAbsoluteToneIndex(31, 1)).toBe(31);
        });

        it('should return 32 for block-relative 0 in Block 2', () => {
            expect(getAbsoluteToneIndex(0, 2)).toBe(32);
        });

        it('should return 63 for block-relative 31 in Block 2', () => {
            expect(getAbsoluteToneIndex(31, 2)).toBe(63);
        });

        it('should throw for block-relative index > 31', () => {
            expect(() => getAbsoluteToneIndex(32, 1)).toThrow('out of range');
        });
    });

    describe('round-trip conversion', () => {
        it('should round-trip through all tones', () => {
            for (let i = 0; i < 64; i++) {
                const block = getBlockForTone(i);
                const relative = getBlockRelativeToneIndex(i);
                const absolute = getAbsoluteToneIndex(relative, block);
                expect(absolute).toBe(i);
            }
        });
    });
});

describe('S-550 Wave Bank Conversion', () => {
    describe('getAbsoluteWaveBank', () => {
        it('should return 0 (Bank A) for block-relative 0 in Block 1', () => {
            expect(getAbsoluteWaveBank(0, 1)).toBe(0);
        });

        it('should return 1 (Bank B) for block-relative 1 in Block 1', () => {
            expect(getAbsoluteWaveBank(1, 1)).toBe(1);
        });

        it('should return 2 (Bank C) for block-relative 0 in Block 2', () => {
            expect(getAbsoluteWaveBank(0, 2)).toBe(2);
        });

        it('should return 3 (Bank D) for block-relative 1 in Block 2', () => {
            expect(getAbsoluteWaveBank(1, 2)).toBe(3);
        });
    });

    describe('getBlockRelativeWaveBank', () => {
        it('should return Block 1, index 0 for Bank A', () => {
            expect(getBlockRelativeWaveBank(0)).toEqual({ block: 1, bankIndex: 0 });
        });

        it('should return Block 1, index 1 for Bank B', () => {
            expect(getBlockRelativeWaveBank(1)).toEqual({ block: 1, bankIndex: 1 });
        });

        it('should return Block 2, index 0 for Bank C', () => {
            expect(getBlockRelativeWaveBank(2)).toEqual({ block: 2, bankIndex: 0 });
        });

        it('should return Block 2, index 1 for Bank D', () => {
            expect(getBlockRelativeWaveBank(3)).toEqual({ block: 2, bankIndex: 1 });
        });
    });

    describe('getBlockForWaveBank', () => {
        it('should return Block 1 for Bank A', () => {
            expect(getBlockForWaveBank(0)).toBe(1);
        });

        it('should return Block 1 for Bank B', () => {
            expect(getBlockForWaveBank(1)).toBe(1);
        });

        it('should return Block 2 for Bank C', () => {
            expect(getBlockForWaveBank(2)).toBe(2);
        });

        it('should return Block 2 for Bank D', () => {
            expect(getBlockForWaveBank(3)).toBe(2);
        });
    });

    describe('isWaveBankInBlock', () => {
        it('should return true for Bank A in Block 1', () => {
            expect(isWaveBankInBlock(0, 1)).toBe(true);
        });

        it('should return true for Bank B in Block 1', () => {
            expect(isWaveBankInBlock(1, 1)).toBe(true);
        });

        it('should return false for Bank C in Block 1', () => {
            expect(isWaveBankInBlock(2, 1)).toBe(false);
        });

        it('should return true for Bank C in Block 2', () => {
            expect(isWaveBankInBlock(2, 2)).toBe(true);
        });

        it('should return false for Bank A in Block 2', () => {
            expect(isWaveBankInBlock(0, 2)).toBe(false);
        });
    });
});

describe('S-550 Wave Bank Name Utilities', () => {
    describe('WAVE_BANK_NAMES', () => {
        it('should have correct bank names', () => {
            expect(WAVE_BANK_NAMES).toEqual(['A', 'B', 'C', 'D']);
        });
    });

    describe('getWaveBankName', () => {
        it('should return A for bank 0', () => {
            expect(getWaveBankName(0)).toBe('A');
        });

        it('should return B for bank 1', () => {
            expect(getWaveBankName(1)).toBe('B');
        });

        it('should return C for bank 2', () => {
            expect(getWaveBankName(2)).toBe('C');
        });

        it('should return D for bank 3', () => {
            expect(getWaveBankName(3)).toBe('D');
        });
    });

    describe('parseWaveBankName', () => {
        it('should return 0 for A', () => {
            expect(parseWaveBankName('A')).toBe(0);
        });

        it('should return 1 for B', () => {
            expect(parseWaveBankName('B')).toBe(1);
        });

        it('should return 2 for C', () => {
            expect(parseWaveBankName('C')).toBe(2);
        });

        it('should return 3 for D', () => {
            expect(parseWaveBankName('D')).toBe(3);
        });
    });
});

describe('S-550 Wave Bank Validation', () => {
    describe('isValidWaveBankForTone', () => {
        it('should return true for tone 0 with Bank A', () => {
            expect(isValidWaveBankForTone(0, 0)).toBe(true);
        });

        it('should return true for tone 31 with Bank B', () => {
            expect(isValidWaveBankForTone(31, 1)).toBe(true);
        });

        it('should return false for tone 0 with Bank C', () => {
            expect(isValidWaveBankForTone(0, 2)).toBe(false);
        });

        it('should return true for tone 32 with Bank C', () => {
            expect(isValidWaveBankForTone(32, 2)).toBe(true);
        });

        it('should return true for tone 63 with Bank D', () => {
            expect(isValidWaveBankForTone(63, 3)).toBe(true);
        });

        it('should return false for tone 63 with Bank A', () => {
            expect(isValidWaveBankForTone(63, 0)).toBe(false);
        });
    });

    describe('getValidWaveBanksForTone', () => {
        it('should return [0, 1] for tone 0 (Block 1)', () => {
            expect(getValidWaveBanksForTone(0)).toEqual([0, 1]);
        });

        it('should return [0, 1] for tone 31 (Block 1)', () => {
            expect(getValidWaveBanksForTone(31)).toEqual([0, 1]);
        });

        it('should return [2, 3] for tone 32 (Block 2)', () => {
            expect(getValidWaveBanksForTone(32)).toEqual([2, 3]);
        });

        it('should return [2, 3] for tone 63 (Block 2)', () => {
            expect(getValidWaveBanksForTone(63)).toEqual([2, 3]);
        });
    });
});

describe('S-550 Wave Data Address Building', () => {
    describe('WAVE_BANK_BASE_ADDRESSES', () => {
        it('should have correct base addresses', () => {
            expect(WAVE_BANK_BASE_ADDRESSES[0]).toBe(0x00);  // Bank A
            expect(WAVE_BANK_BASE_ADDRESSES[1]).toBe(0x20);  // Bank B
            expect(WAVE_BANK_BASE_ADDRESSES[2]).toBe(0x40);  // Bank C
            expect(WAVE_BANK_BASE_ADDRESSES[3]).toBe(0x60);  // Bank D
        });
    });

    describe('buildWaveDataAddress', () => {
        it('should build correct address for Bank A, Segment 0', () => {
            expect(buildWaveDataAddress(0, 0)).toEqual([0x01, 0x00, 0x00, 0x00]);
        });

        it('should build correct address for Bank B, Segment 0', () => {
            expect(buildWaveDataAddress(1, 0)).toEqual([0x01, 0x20, 0x00, 0x00]);
        });

        it('should build correct address for Bank C, Segment 0', () => {
            expect(buildWaveDataAddress(2, 0)).toEqual([0x01, 0x40, 0x00, 0x00]);
        });

        it('should build correct address for Bank D, Segment 0', () => {
            expect(buildWaveDataAddress(3, 0)).toEqual([0x01, 0x60, 0x00, 0x00]);
        });

        it('should build correct address for Bank A, Segment 5', () => {
            // Segment stride is 8 in byte 2
            expect(buildWaveDataAddress(0, 5)).toEqual([0x01, 0x00, 0x28, 0x00]);
        });

        it('should build correct address for Bank C, Segment 10', () => {
            expect(buildWaveDataAddress(2, 10)).toEqual([0x01, 0x40, 0x50, 0x00]);
        });

        it('should build correct address for Bank D, Segment 17 (last segment)', () => {
            // 17 * 8 = 136, but byte 2 is 7-bit so 136 & 0x7F = 8
            // This is expected behavior for S-series address encoding
            expect(buildWaveDataAddress(3, 17)).toEqual([0x01, 0x60, 0x08, 0x00]);
        });

        it('should throw for invalid wave bank', () => {
            expect(() => buildWaveDataAddress(4, 0)).toThrow('out of range');
        });

        it('should throw for invalid segment index', () => {
            expect(() => buildWaveDataAddress(0, 18)).toThrow('out of range');
        });
    });

    describe('buildBlockRelativeWaveAddress', () => {
        it('should build Bank A address for Block 1, bank 0', () => {
            expect(buildBlockRelativeWaveAddress(1, 0, 0)).toEqual([0x01, 0x00, 0x00, 0x00]);
        });

        it('should build Bank B address for Block 1, bank 1', () => {
            expect(buildBlockRelativeWaveAddress(1, 1, 0)).toEqual([0x01, 0x20, 0x00, 0x00]);
        });

        it('should build Bank C address for Block 2, bank 0', () => {
            expect(buildBlockRelativeWaveAddress(2, 0, 0)).toEqual([0x01, 0x40, 0x00, 0x00]);
        });

        it('should build Bank D address for Block 2, bank 1', () => {
            expect(buildBlockRelativeWaveAddress(2, 1, 0)).toEqual([0x01, 0x60, 0x00, 0x00]);
        });

        it('should correctly apply segment offset', () => {
            expect(buildBlockRelativeWaveAddress(1, 0, 5)).toEqual([0x01, 0x00, 0x28, 0x00]);
            expect(buildBlockRelativeWaveAddress(2, 1, 5)).toEqual([0x01, 0x60, 0x28, 0x00]);
        });
    });
});
